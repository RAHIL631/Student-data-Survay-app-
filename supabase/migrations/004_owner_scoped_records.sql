ALTER TABLE public.profiles
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.schools
  ADD COLUMN owner_id UUID,
  ADD COLUMN created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN updated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN deleted_at TIMESTAMPTZ;

ALTER TABLE public.screening_sessions
  ADD COLUMN owner_id UUID,
  ADD COLUMN updated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN deleted_at TIMESTAMPTZ;

ALTER TABLE public.student_screenings
  ADD COLUMN owner_id UUID,
  ADD COLUMN updated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN deleted_at TIMESTAMPTZ;

UPDATE public.screening_sessions AS session
SET owner_id = COALESCE(
      (
        SELECT MIN(assignment.enumerator_id::TEXT)::UUID
        FROM public.session_assignments AS assignment
        WHERE assignment.session_id = session.id
        HAVING COUNT(DISTINCT assignment.enumerator_id) = 1
      ),
      CASE
        WHEN (
          SELECT profile.role
          FROM public.profiles AS profile
          WHERE profile.id = session.created_by
        ) = 'enumerator' THEN session.created_by
        ELSE (
          SELECT profile.id
          FROM public.profiles AS profile
          WHERE profile.organization_id = session.organization_id
            AND profile.role = 'organization_admin'
          ORDER BY profile.created_at, profile.id
          LIMIT 1
        )
      END
    ),
    updated_by = created_by;

UPDATE public.student_screenings AS student
SET owner_id = session.owner_id,
    updated_by = student.created_by
FROM public.screening_sessions AS session
WHERE session.id = student.session_id;

UPDATE public.schools AS school
SET owner_id = COALESCE(
  (
    SELECT MIN(session.owner_id::TEXT)::UUID
    FROM public.screening_sessions AS session
    WHERE session.school_id = school.id
    HAVING COUNT(DISTINCT session.owner_id) = 1
  ),
  (
    SELECT profile.id
    FROM public.profiles AS profile
    WHERE profile.organization_id = school.organization_id
      AND profile.role = 'organization_admin'
    ORDER BY profile.created_at, profile.id
    LIMIT 1
  )
);

UPDATE public.schools
SET created_by = owner_id,
    updated_by = owner_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.schools
    WHERE owner_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot assign legacy schools: create an organization administrator or map each school owner before applying this migration.';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.current_profile_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active
$$;

ALTER TABLE public.schools
  ALTER COLUMN owner_id SET NOT NULL,
  ALTER COLUMN created_by SET NOT NULL,
  ALTER COLUMN updated_by SET NOT NULL,
  ADD CONSTRAINT schools_owner_profile_fkey
    FOREIGN KEY (organization_id, owner_id)
    REFERENCES public.profiles(organization_id, id);

ALTER TABLE public.screening_sessions
  ALTER COLUMN owner_id SET NOT NULL,
  ALTER COLUMN updated_by SET NOT NULL,
  ADD CONSTRAINT screening_sessions_owner_profile_fkey
    FOREIGN KEY (organization_id, owner_id)
    REFERENCES public.profiles(organization_id, id);

ALTER TABLE public.student_screenings
  ALTER COLUMN owner_id SET NOT NULL,
  ALTER COLUMN updated_by SET NOT NULL,
  ADD CONSTRAINT student_screenings_owner_profile_fkey
    FOREIGN KEY (organization_id, owner_id)
    REFERENCES public.profiles(organization_id, id);

CREATE TABLE public.owner_data_grants (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, viewer_id, owner_id),
  FOREIGN KEY (organization_id, viewer_id)
    REFERENCES public.profiles(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, owner_id)
    REFERENCES public.profiles(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE public.student_si_counters (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.screening_sessions(id) ON DELETE CASCADE,
  last_number BIGINT NOT NULL CHECK (last_number >= 0),
  PRIMARY KEY (organization_id, owner_id, session_id),
  FOREIGN KEY (organization_id, owner_id)
    REFERENCES public.profiles(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE public.student_si_reservations (
  idempotency_key UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.screening_sessions(id) ON DELETE CASCADE,
  si_number TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, owner_id, session_id, si_number),
  FOREIGN KEY (organization_id, owner_id)
    REFERENCES public.profiles(organization_id, id) ON DELETE CASCADE
);

ALTER TABLE public.student_si_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_si_reservations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reserve_student_si_number(target_session_id UUID, target_idempotency_key UUID)
RETURNS TEXT
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role TEXT := public.current_profile_role();
  target_organization_id UUID;
  target_owner_id UUID;
  existing_session_id UUID;
  existing_owner_id UUID;
  allocated_number BIGINT;
  candidate TEXT;
BEGIN
  IF actor_id IS NULL OR actor_role IS NULL OR actor_role NOT IN ('organization_admin', 'enumerator') THEN
    RAISE EXCEPTION 'An active administrator or Screening Faculty account is required.'
      USING ERRCODE = '42501';
  END IF;
  IF target_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'A submission key is required.'
      USING ERRCODE = '22023';
  END IF;

  SELECT session.organization_id, session.owner_id
  INTO target_organization_id, target_owner_id
  FROM public.screening_sessions AS session
  WHERE session.id = target_session_id
    AND session.deleted_at IS NULL
    AND (
      actor_role = 'organization_admin'
      OR session.owner_id = actor_id
    );
  IF target_organization_id IS NULL THEN
    RAISE EXCEPTION 'The screening session is unavailable.'
      USING ERRCODE = '42501';
  END IF;

  SELECT reservation.session_id, reservation.owner_id, reservation.si_number
  INTO existing_session_id, existing_owner_id, candidate
  FROM public.student_si_reservations AS reservation
  WHERE reservation.idempotency_key = target_idempotency_key;
  IF FOUND THEN
    IF existing_session_id <> target_session_id OR existing_owner_id <> target_owner_id THEN
      RAISE EXCEPTION 'This submission key is already reserved for another session.'
        USING ERRCODE = '23505';
    END IF;
    RETURN candidate;
  END IF;

  SELECT student.session_id, student.owner_id, student.si_number
  INTO existing_session_id, existing_owner_id, candidate
  FROM public.student_screenings AS student
  WHERE student.id = target_idempotency_key;
  IF FOUND THEN
    IF existing_session_id <> target_session_id OR existing_owner_id <> target_owner_id THEN
      RAISE EXCEPTION 'This submission key is already in use.'
        USING ERRCODE = '23505';
    END IF;
    RETURN candidate;
  END IF;

  INSERT INTO public.student_si_counters (organization_id, owner_id, session_id, last_number)
  VALUES (
    target_organization_id,
    target_owner_id,
    target_session_id,
    COALESCE((
      SELECT MAX(CASE WHEN student.si_number ~ '^[0-9]{1,18}$' THEN student.si_number::BIGINT END)
      FROM public.student_screenings AS student
      WHERE student.organization_id = target_organization_id
        AND student.owner_id = target_owner_id
        AND student.session_id = target_session_id
        AND student.si_number ~ '^[0-9]{1,18}$'
    ), 0)
  )
  ON CONFLICT (organization_id, owner_id, session_id) DO NOTHING;

  SELECT counter.last_number
  INTO allocated_number
  FROM public.student_si_counters AS counter
  WHERE counter.organization_id = target_organization_id
    AND counter.owner_id = target_owner_id
    AND counter.session_id = target_session_id
  FOR UPDATE;

  SELECT reservation.session_id, reservation.owner_id, reservation.si_number
  INTO existing_session_id, existing_owner_id, candidate
  FROM public.student_si_reservations AS reservation
  WHERE reservation.idempotency_key = target_idempotency_key;
  IF FOUND THEN
    IF existing_session_id <> target_session_id OR existing_owner_id <> target_owner_id THEN
      RAISE EXCEPTION 'This submission key is already reserved for another session.'
        USING ERRCODE = '23505';
    END IF;
    RETURN candidate;
  END IF;

  LOOP
    allocated_number := allocated_number + 1;
    candidate := allocated_number::TEXT;
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.student_screenings AS student
      WHERE student.organization_id = target_organization_id
        AND student.session_id = target_session_id
        AND student.si_number = candidate
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.student_si_reservations AS reservation
      WHERE reservation.organization_id = target_organization_id
        AND reservation.session_id = target_session_id
        AND reservation.si_number = candidate
    );
  END LOOP;

  UPDATE public.student_si_counters
  SET last_number = allocated_number
  WHERE organization_id = target_organization_id
    AND owner_id = target_owner_id
    AND session_id = target_session_id;

  INSERT INTO public.student_si_reservations (
    idempotency_key, organization_id, owner_id, session_id, si_number, created_by
  )
  VALUES (
    target_idempotency_key, target_organization_id, target_owner_id,
    target_session_id, candidate, actor_id
  );
  RETURN candidate;
END
$$;

CREATE OR REPLACE FUNCTION public.can_view_owner_data(target_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.owner_data_grants AS grant_row
    JOIN public.profiles AS viewer
      ON viewer.id = auth.uid()
     AND viewer.organization_id = grant_row.organization_id
     AND viewer.role = 'district_manager'
     AND viewer.is_active
    WHERE grant_row.viewer_id = auth.uid()
      AND grant_row.owner_id = target_owner_id
  )
$$;

CREATE OR REPLACE FUNCTION public.enforce_owned_record_metadata()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role TEXT := public.current_profile_role();
  assigned_owner_id UUID;
BEGIN
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = actor_id AND is_active
  ) THEN
    RAISE EXCEPTION 'An active authenticated profile is required.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := actor_id;
    NEW.created_at := COALESCE(NEW.created_at, now());
    IF TG_TABLE_NAME = 'screening_sessions' AND actor_role = 'organization_admin' THEN
      SELECT school.owner_id INTO assigned_owner_id
      FROM public.schools AS school
      WHERE school.id = NEW.school_id
        AND school.organization_id = NEW.organization_id
        AND school.deleted_at IS NULL;
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles AS owner
        WHERE owner.id = assigned_owner_id
          AND owner.organization_id = NEW.organization_id
          AND owner.role = 'enumerator'
          AND owner.is_active
      ) THEN
        RAISE EXCEPTION 'Assign this school to an active Screening Faculty account before creating a session.'
          USING ERRCODE = '22023';
      END IF;
      NEW.owner_id := assigned_owner_id;
    ELSIF TG_TABLE_NAME = 'student_screenings' THEN
      SELECT session.owner_id INTO assigned_owner_id
      FROM public.screening_sessions AS session
      WHERE session.id = NEW.session_id
        AND session.organization_id = NEW.organization_id
        AND session.deleted_at IS NULL;
      IF assigned_owner_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.student_si_reservations AS reservation
        WHERE reservation.idempotency_key = NEW.id
          AND reservation.organization_id = NEW.organization_id
          AND reservation.owner_id = assigned_owner_id
          AND reservation.session_id = NEW.session_id
          AND reservation.si_number = NEW.si_number
      ) THEN
        RAISE EXCEPTION 'Reserve a valid SI number for this student and session before saving.'
          USING ERRCODE = '22023';
      END IF;
      NEW.owner_id := assigned_owner_id;
    ELSE
      NEW.owner_id := actor_id;
    END IF;
  ELSE
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
      AND NOT (actor_role = 'organization_admin' AND TG_TABLE_NAME = 'schools') THEN
      RAISE EXCEPTION 'Record ownership cannot be changed by this operation.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT (actor_role = 'organization_admin' AND TG_TABLE_NAME = 'schools') THEN
      NEW.owner_id := OLD.owner_id;
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.deleted_by := CASE
      WHEN NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN actor_id
      ELSE OLD.deleted_by
    END;
  END IF;

  NEW.updated_by := actor_id;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER schools_enforce_owner_metadata
  BEFORE INSERT OR UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_record_metadata();
CREATE TRIGGER screening_sessions_enforce_owner_metadata
  BEFORE INSERT OR UPDATE ON public.screening_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_record_metadata();
CREATE TRIGGER student_screenings_enforce_owner_metadata
  BEFORE INSERT OR UPDATE ON public.student_screenings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_record_metadata();

CREATE OR REPLACE FUNCTION public.assign_school_owner(target_school_id UUID, target_owner_id UUID)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.current_profile_role() IS DISTINCT FROM 'organization_admin' THEN
    RAISE EXCEPTION 'Only an administrator can assign a school.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = target_owner_id
      AND profile.organization_id = public.current_profile_organization_id()
      AND profile.role = 'enumerator'
      AND profile.is_active
  ) THEN
    RAISE EXCEPTION 'Select an active screening faculty account in this organization.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.screening_sessions AS session
    WHERE session.school_id = target_school_id
      AND session.owner_id <> target_owner_id
  ) THEN
    RAISE EXCEPTION 'This school already has sessions owned by another Screening Faculty account and cannot be reassigned.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.schools
  SET owner_id = target_owner_id
  WHERE id = target_school_id
    AND organization_id = public.current_profile_organization_id()
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The school could not be found.'
      USING ERRCODE = 'P0002';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_owner_data_grant(
  target_viewer_id UUID,
  target_owner_id UUID,
  should_grant BOOLEAN
)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_organization_id UUID := public.current_profile_organization_id();
BEGIN
  IF public.current_profile_role() IS DISTINCT FROM 'organization_admin' THEN
    RAISE EXCEPTION 'Only an administrator can change viewer access.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS viewer
    WHERE viewer.id = target_viewer_id
      AND viewer.organization_id = actor_organization_id
      AND viewer.role = 'district_manager'
      AND viewer.is_active
  ) OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS owner
    WHERE owner.id = target_owner_id
      AND owner.organization_id = actor_organization_id
      AND owner.role = 'enumerator'
      AND owner.is_active
  ) THEN
    RAISE EXCEPTION 'Select an active viewer and screening faculty in this organization.'
      USING ERRCODE = '22023';
  END IF;

  IF should_grant THEN
    INSERT INTO public.owner_data_grants (organization_id, viewer_id, owner_id, created_by)
    VALUES (actor_organization_id, target_viewer_id, target_owner_id, auth.uid())
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.owner_data_grants
    WHERE owner_data_grants.organization_id = actor_organization_id
      AND viewer_id = target_viewer_id
      AND owner_id = target_owner_id;
  END IF;
END
$$;

ALTER TABLE public.owner_data_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_data_grants_admin_manage ON public.owner_data_grants
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
  )
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
    AND created_by = auth.uid()
  );
CREATE POLICY owner_data_grants_viewer_read ON public.owner_data_grants
  FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    AND public.current_profile_role() = 'district_manager'
  );

DROP POLICY profiles_read_organization ON public.profiles;
CREATE POLICY profiles_read_organization ON public.profiles
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR id = auth.uid()
    )
  );

DROP POLICY schools_read_organization ON public.schools;
DROP POLICY schools_admin_write ON public.schools;
DROP POLICY schools_admin_update ON public.schools;
DROP POLICY schools_admin_delete ON public.schools;
CREATE POLICY schools_owner_read ON public.schools
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND deleted_at IS NULL
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'enumerator'
        AND owner_id = auth.uid()
      )
      OR (
        public.current_profile_role() = 'district_manager'
        AND public.can_view_owner_data(owner_id)
      )
    )
  );
CREATE POLICY schools_admin_insert ON public.schools
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
  );
CREATE POLICY schools_owner_insert ON public.schools
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'enumerator'
    AND owner_id = auth.uid()
    AND created_by = auth.uid()
  );
CREATE POLICY schools_admin_update ON public.schools
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
  );
CREATE POLICY schools_owner_update ON public.schools
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'enumerator'
    AND owner_id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'enumerator'
    AND owner_id = auth.uid()
  );

DROP POLICY sessions_read_assigned_scope ON public.screening_sessions;
DROP POLICY sessions_admin_manager_insert ON public.screening_sessions;
DROP POLICY sessions_admin_manager_update ON public.screening_sessions;
CREATE POLICY sessions_owner_read ON public.screening_sessions
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND deleted_at IS NULL
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'enumerator'
        AND owner_id = auth.uid()
      )
      OR (
        public.current_profile_role() = 'district_manager'
        AND public.can_view_owner_data(owner_id)
      )
    )
  );
CREATE POLICY sessions_owner_insert ON public.screening_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND created_by = auth.uid()
    AND (
      (
        public.current_profile_role() = 'organization_admin'
        AND EXISTS (
          SELECT 1 FROM public.schools AS school
          WHERE school.id = screening_sessions.school_id
            AND school.organization_id = screening_sessions.organization_id
            AND school.deleted_at IS NULL
        )
      )
      OR (
        public.current_profile_role() = 'enumerator'
        AND owner_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.schools AS school
          WHERE school.id = screening_sessions.school_id
            AND school.organization_id = screening_sessions.organization_id
            AND school.owner_id = auth.uid()
            AND school.deleted_at IS NULL
        )
      )
    )
  );
CREATE POLICY sessions_owner_update ON public.screening_sessions
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND deleted_at IS NULL
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'enumerator'
        AND owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'enumerator'
        AND owner_id = auth.uid()
      )
    )
  );

DROP POLICY screenings_read_assigned_scope ON public.student_screenings;
DROP POLICY screenings_insert_assigned_scope ON public.student_screenings;
DROP POLICY screenings_admin_manager_update ON public.student_screenings;
CREATE POLICY screenings_owner_read ON public.student_screenings
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND deleted_at IS NULL
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'enumerator'
        AND owner_id = auth.uid()
      )
      OR (
        public.current_profile_role() = 'district_manager'
        AND public.can_view_owner_data(owner_id)
      )
    )
  );
CREATE POLICY screenings_owner_insert ON public.student_screenings
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND created_by = auth.uid()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'enumerator'
        AND owner_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.screening_sessions AS session
          WHERE session.id = student_screenings.session_id
            AND session.organization_id = student_screenings.organization_id
            AND session.owner_id = auth.uid()
            AND session.deleted_at IS NULL
        )
      )
    )
  );
CREATE POLICY screenings_owner_update ON public.student_screenings
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND deleted_at IS NULL
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'enumerator'
        AND owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'enumerator'
        AND owner_id = auth.uid()
      )
    )
  );

DROP POLICY assignments_admin_manager_insert ON public.session_assignments;
DROP POLICY assignments_admin_manager_delete ON public.session_assignments;
CREATE POLICY assignments_admin_insert ON public.session_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles AS profile
      WHERE profile.id = session_assignments.enumerator_id
        AND profile.organization_id = session_assignments.organization_id
        AND profile.role = 'enumerator'
        AND profile.is_active
    )
    AND EXISTS (
      SELECT 1 FROM public.screening_sessions AS session
      WHERE session.id = session_assignments.session_id
        AND session.organization_id = session_assignments.organization_id
        AND session.owner_id = session_assignments.enumerator_id
        AND session.deleted_at IS NULL
    )
  );
CREATE POLICY assignments_admin_delete ON public.session_assignments
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'organization_admin'
  );

REVOKE INSERT, UPDATE ON public.schools, public.screening_sessions, public.student_screenings FROM authenticated;
GRANT INSERT (organization_id, district_id, taluk_id, name, code, status)
  ON public.schools TO authenticated;
GRANT UPDATE (name, code, district_id, taluk_id, status, deleted_at)
  ON public.schools TO authenticated;
GRANT INSERT (organization_id, district_id, taluk_id, school_id, name, beo_name, head_master_name, screening_faculty_name, screening_date, status)
  ON public.screening_sessions TO authenticated;
GRANT UPDATE (name, beo_name, head_master_name, screening_faculty_name, screening_date, status, deleted_at)
  ON public.screening_sessions TO authenticated;
GRANT INSERT (id, organization_id, session_id, district_id, taluk_id, school_id, si_number, student_name, class_name, section, sex, date_of_birth, age, height_cm, weight_kg, bmi, skeletal_deformity, skeletal_observation, skin_thickness_mm, mid_arm_circumference_cm, additional_remarks, screening_date, status)
  ON public.student_screenings TO authenticated;
GRANT UPDATE (student_name, class_name, section, sex, date_of_birth, age, height_cm, weight_kg, bmi, skeletal_deformity, skeletal_observation, skin_thickness_mm, mid_arm_circumference_cm, additional_remarks, status, deleted_at)
  ON public.student_screenings TO authenticated;
REVOKE DELETE ON public.schools, public.screening_sessions, public.student_screenings FROM authenticated;
REVOKE ALL ON FUNCTION public.can_view_owner_data(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reserve_student_si_number(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_school_owner(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_owner_data_grant(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_owner_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_student_si_number(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_school_owner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_owner_data_grant(UUID, UUID, BOOLEAN) TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.owner_data_grants TO authenticated;

CREATE INDEX schools_owner_idx ON public.schools (organization_id, owner_id) WHERE deleted_at IS NULL;
CREATE INDEX screening_sessions_owner_idx ON public.screening_sessions (organization_id, owner_id, screening_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX student_screenings_owner_idx ON public.student_screenings (organization_id, owner_id, screening_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX owner_data_grants_viewer_idx ON public.owner_data_grants (organization_id, viewer_id);
