BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.schools
  ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.screening_sessions
  ADD COLUMN owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.student_screenings
  ADD COLUMN owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Existing session and screening creators are known and remain unchanged.
-- Existing schools have no creator history; leave both fields NULL rather than
-- attributing old records to an arbitrary administrator.
UPDATE public.screening_sessions SET owner_id = created_by WHERE owner_id IS NULL;
UPDATE public.student_screenings SET owner_id = created_by WHERE owner_id IS NULL;

CREATE INDEX profiles_active_org_role_idx
  ON public.profiles (organization_id, role, district_id) WHERE is_active;
CREATE INDEX schools_owner_idx ON public.schools (owner_id);
CREATE INDEX screening_sessions_owner_idx ON public.screening_sessions (owner_id);
CREATE INDEX student_screenings_owner_idx ON public.student_screenings (owner_id);

CREATE OR REPLACE FUNCTION public.current_profile_is_active()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_active
  )
$$;

CREATE OR REPLACE FUNCTION public.current_profile_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.organization_id FROM public.profiles p
  WHERE p.id = auth.uid() AND p.is_active
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role FROM public.profiles p
  WHERE p.id = auth.uid() AND p.is_active
$$;

CREATE OR REPLACE FUNCTION public.current_profile_district_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.district_id FROM public.profiles p
  WHERE p.id = auth.uid() AND p.is_active
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_to_session(target_session_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_profile_is_active() AND EXISTS (
    SELECT 1 FROM public.session_assignments sa
    WHERE sa.session_id = target_session_id AND sa.enumerator_id = auth.uid()
  )
$$;

-- Keep self-profile reads available so the frontend can show an inactive-account
-- message. All other profile reads still require an active, scoped caller.
DROP POLICY IF EXISTS profiles_read_organization ON public.profiles;
CREATE POLICY profiles_read_organization ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      is_active
      AND organization_id = public.current_profile_organization_id()
      AND (
        public.current_profile_role() = 'organization_admin'
        OR (
          public.current_profile_role() = 'district_manager'
          AND district_id = public.current_profile_district_id()
        )
      )
    )
  );

-- Organization administrators may create schools; district managers may create
-- schools only in their assigned district, matching their existing page access.
DROP POLICY IF EXISTS schools_admin_write ON public.schools;
CREATE POLICY schools_admin_write ON public.schools
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND district_id = public.current_profile_district_id()
      )
    )
  );

DROP POLICY IF EXISTS schools_admin_update ON public.schools;
CREATE POLICY schools_admin_update ON public.schools
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND district_id = public.current_profile_district_id()
      )
    )
  )
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND district_id = public.current_profile_district_id()
      )
    )
  );

DROP POLICY IF EXISTS schools_admin_delete ON public.schools;
CREATE POLICY schools_admin_delete ON public.schools
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND (
      public.current_profile_role() = 'organization_admin'
      OR (
        public.current_profile_role() = 'district_manager'
        AND district_id = public.current_profile_district_id()
      )
    )
  );

-- Active enumerators only; organization and district/session consistency remain
-- enforced by the existing composite foreign keys and scoped policies.
DROP POLICY IF EXISTS assignments_admin_manager_insert ON public.session_assignments;
CREATE POLICY assignments_admin_manager_insert ON public.session_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() IN ('organization_admin', 'district_manager')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = enumerator_id
        AND p.organization_id = public.current_profile_organization_id()
        AND p.role = 'enumerator'
        AND p.is_active
        AND (
          public.current_profile_role() = 'organization_admin'
          OR p.district_id = public.current_profile_district_id()
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.screening_sessions s
      WHERE s.id = session_id
        AND s.organization_id = public.current_profile_organization_id()
        AND (
          public.current_profile_role() = 'organization_admin'
          OR s.district_id = public.current_profile_district_id()
        )
    )
  );


-- Existing enumerators who become inactive immediately lose assignment-based
-- access even if old assignment rows remain for audit/history.
CREATE OR REPLACE FUNCTION public.set_school_owner_on_insert()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER schools_set_creator
  BEFORE INSERT OR UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.guard_created_by_attribution();
CREATE TRIGGER schools_set_owner
  BEFORE INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.set_school_owner_on_insert();

CREATE OR REPLACE FUNCTION public.set_session_owner_on_insert()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER screening_sessions_set_owner
  BEFORE INSERT ON public.screening_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_session_owner_on_insert();

CREATE OR REPLACE FUNCTION public.set_student_screening_owner_on_insert()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER student_screenings_set_owner
  BEFORE INSERT ON public.student_screenings
  FOR EACH ROW EXECUTE FUNCTION public.set_student_screening_owner_on_insert();

CREATE OR REPLACE FUNCTION public.set_profile_active(target_profile_id UUID, target_is_active BOOLEAN)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_org UUID;
  target_profile public.profiles%ROWTYPE;
  previous_value BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_profile_is_active()
    OR public.current_profile_role() <> 'organization_admin'
    OR target_profile_id = auth.uid()
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Account status change is not authorized';
  END IF;

  caller_org := public.current_profile_organization_id();
  SELECT p.* INTO target_profile FROM public.profiles p
  WHERE p.id = target_profile_id AND p.organization_id = caller_org
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Account status change is not authorized';
  END IF;

  previous_value := target_profile.is_active;
  IF previous_value = target_is_active THEN RETURN TRUE; END IF;

  UPDATE public.profiles SET is_active = target_is_active WHERE id = target_profile_id;
  INSERT INTO public.audit_logs (
    organization_id, district_id, actor_id, action, record_type, record_id, metadata
  ) VALUES (
    caller_org, target_profile.district_id, auth.uid(),
    CASE WHEN target_is_active THEN 'account_activated' ELSE 'account_deactivated' END,
    'profiles', target_profile_id,
    jsonb_build_object('previous_is_active', previous_value, 'is_active', target_is_active)
  );
  RETURN TRUE;
END
$$;

CREATE OR REPLACE FUNCTION public.transfer_record_ownership(
  target_record_type TEXT,
  target_record_id UUID,
  target_owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_org UUID;
  actor_role TEXT;
  actor_district UUID;
  target_profile public.profiles%ROWTYPE;
  row_org UUID;
  row_district UUID;
  row_session UUID;
  previous_owner UUID;
  record_table REGCLASS;
BEGIN
  IF actor_id IS NULL OR NOT public.current_profile_is_active() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ownership transfer is not authorized';
  END IF;
  actor_org := public.current_profile_organization_id();
  actor_role := public.current_profile_role();
  actor_district := public.current_profile_district_id();

  SELECT p.* INTO target_profile FROM public.profiles p
  WHERE p.id = target_owner_id AND p.organization_id = actor_org AND p.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ownership transfer is not authorized';
  END IF;

  IF target_record_type = 'schools' THEN
    SELECT s.organization_id, s.district_id, s.owner_id
    INTO row_org, row_district, previous_owner
    FROM public.schools s WHERE s.id = target_record_id FOR UPDATE;
    record_table := 'public.schools'::REGCLASS;
    IF target_profile.role NOT IN ('organization_admin', 'district_manager') THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ownership transfer is not authorized';
    END IF;
  ELSIF target_record_type = 'screening_sessions' THEN
    SELECT s.organization_id, s.district_id, s.owner_id
    INTO row_org, row_district, previous_owner
    FROM public.screening_sessions s WHERE s.id = target_record_id FOR UPDATE;
    record_table := 'public.screening_sessions'::REGCLASS;
    IF target_profile.role NOT IN ('organization_admin', 'district_manager') THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ownership transfer is not authorized';
    END IF;
  ELSIF target_record_type = 'student_screenings' THEN
    SELECT s.organization_id, s.district_id, s.session_id, s.owner_id
    INTO row_org, row_district, row_session, previous_owner
    FROM public.student_screenings s WHERE s.id = target_record_id FOR UPDATE;
    record_table := 'public.student_screenings'::REGCLASS;
    IF target_profile.role = 'enumerator' AND NOT public.is_assigned_to_session(row_session) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ownership transfer is not authorized';
    END IF;
    IF target_profile.role = 'enumerator' AND NOT EXISTS (
      SELECT 1 FROM public.session_assignments sa
      WHERE sa.session_id = row_session AND sa.enumerator_id = target_owner_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ownership transfer is not authorized';
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unsupported record type';
  END IF;

  IF row_org IS NULL OR row_org <> actor_org
    OR (actor_role = 'district_manager' AND row_district IS DISTINCT FROM actor_district)
    OR actor_role NOT IN ('organization_admin', 'district_manager', 'enumerator')
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ownership transfer is not authorized';
  END IF;
  IF actor_role = 'enumerator' AND (
    target_record_type <> 'student_screenings'
    OR previous_owner IS DISTINCT FROM actor_id
    OR target_profile.role <> 'enumerator'
    OR target_profile.district_id IS DISTINCT FROM row_district
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ownership transfer is not authorized';
  END IF;
  IF target_profile.role = 'district_manager'
    AND target_profile.district_id IS DISTINCT FROM row_district
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ownership transfer is not authorized';
  END IF;
  IF target_profile.role = 'enumerator' AND target_record_type <> 'student_screenings'
    AND NOT EXISTS (
      SELECT 1 FROM public.session_assignments sa
      WHERE sa.enumerator_id = target_owner_id
        AND sa.session_id = target_record_id
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ownership transfer is not authorized';
  END IF;
  IF previous_owner = target_owner_id THEN RETURN TRUE; END IF;

  EXECUTE format('UPDATE %s SET owner_id = $1 WHERE id = $2', record_table)
    USING target_owner_id, target_record_id;
  INSERT INTO public.audit_logs (
    organization_id, district_id, actor_id, action, record_type, record_id, metadata
  ) VALUES (
    row_org, row_district, actor_id, 'ownership_transferred', target_record_type,
    target_record_id,
    jsonb_build_object('previous_owner_id', previous_owner, 'owner_id', target_owner_id)
  );
  RETURN TRUE;
END
$$;

-- INSERT column grants keep the server-assigned ownership/creator fields private.
REVOKE INSERT ON TABLE public.schools FROM authenticated;
GRANT INSERT (
  organization_id, district_id, taluk_id, name, code, status
) ON TABLE public.schools TO authenticated;

REVOKE UPDATE ON TABLE public.schools FROM authenticated;
GRANT UPDATE (district_id, taluk_id, name, code, status, updated_at)
  ON TABLE public.schools TO authenticated;

REVOKE UPDATE ON TABLE public.screening_sessions FROM authenticated;
GRANT UPDATE (
  district_id, taluk_id, school_id, name, beo_name, head_master_name,
  screening_faculty_name, screening_date, status, updated_at
) ON TABLE public.screening_sessions TO authenticated;

REVOKE UPDATE ON TABLE public.student_screenings FROM authenticated;
GRANT UPDATE (
  session_id, district_id, taluk_id, school_id, si_number, student_name,
  class_name, section, sex, date_of_birth, age, height_cm, weight_kg, bmi,
  skeletal_deformity, skeletal_observation, skin_thickness_mm,
  mid_arm_circumference_cm, additional_remarks, screening_date, updated_at
) ON TABLE public.student_screenings TO authenticated;

REVOKE ALL ON FUNCTION public.set_school_owner_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_session_owner_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_student_screening_owner_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_profile_active(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_record_ownership(TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_is_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_profile_active(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_record_ownership(TEXT, UUID, UUID) TO authenticated;

COMMIT;
