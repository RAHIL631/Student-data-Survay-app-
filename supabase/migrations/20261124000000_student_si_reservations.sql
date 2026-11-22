BEGIN;

CREATE TABLE public.student_si_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  target_student_id UUID,
  si_number TEXT NOT NULL CHECK (si_number = btrim(si_number) AND si_number <> '' AND length(si_number) <= 64),
  idempotency_key UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_si_reservations_request_key UNIQUE (requested_by, idempotency_key),
  CONSTRAINT student_si_reservations_session_fk
    FOREIGN KEY (organization_id, session_id)
    REFERENCES public.screening_sessions(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT student_si_reservations_requester_fk
    FOREIGN KEY (organization_id, requested_by)
    REFERENCES public.profiles(organization_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX student_si_reservations_active_number_key
  ON public.student_si_reservations (organization_id, si_number)
  WHERE consumed_at IS NULL;
CREATE INDEX student_si_reservations_expiry_idx
  ON public.student_si_reservations (expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.student_si_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_si_reservations FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.student_screenings
  ADD COLUMN si_reservation_id UUID;

DROP POLICY IF EXISTS screenings_enumerator_update_own_assigned ON public.student_screenings;
CREATE POLICY screenings_enumerator_update_own_assigned ON public.student_screenings
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'enumerator'
    AND (created_by = auth.uid() OR owner_id = auth.uid())
    AND public.is_assigned_to_session(session_id)
  )
  WITH CHECK (
    organization_id = public.current_profile_organization_id()
    AND public.current_profile_role() = 'enumerator'
    AND (created_by = auth.uid() OR owner_id = auth.uid())
    AND public.is_assigned_to_session(session_id)
  );

CREATE OR REPLACE FUNCTION public.reserve_student_si_number(
  target_session_id UUID,
  requested_si_number TEXT,
  request_idempotency_key UUID,
  target_student_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_profile public.profiles%ROWTYPE;
  target_session public.screening_sessions%ROWTYPE;
  existing_student public.student_screenings%ROWTYPE;
  existing_request public.student_si_reservations%ROWTYPE;
  existing_number public.student_si_reservations%ROWTYPE;
  reservation_id UUID;
  normalized_number TEXT := btrim(requested_si_number);
BEGIN
  IF actor_id IS NULL OR NOT public.current_profile_is_active()
    OR normalized_number IS NULL OR normalized_number = ''
    OR length(normalized_number) > 64 OR request_idempotency_key IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A valid active SI reservation request is required';
  END IF;

  SELECT p.* INTO actor_profile FROM public.profiles p
  WHERE p.id = actor_id AND p.is_active;
  SELECT s.* INTO target_session FROM public.screening_sessions s
  WHERE s.id = target_session_id
    AND (s.status = 'active' OR target_student_id IS NOT NULL);
  IF NOT FOUND OR target_session.organization_id <> actor_profile.organization_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SI number reservation is not authorized';
  END IF;

  IF actor_profile.role = 'district_manager'
    AND target_session.district_id IS DISTINCT FROM actor_profile.district_id
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SI number reservation is not authorized';
  ELSIF actor_profile.role = 'enumerator'
    AND NOT public.is_assigned_to_session(target_session_id)
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SI number reservation is not authorized';
  ELSIF actor_profile.role NOT IN ('organization_admin', 'district_manager', 'enumerator') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SI number reservation is not authorized';
  END IF;

  IF target_student_id IS NOT NULL THEN
    SELECT st.* INTO existing_student FROM public.student_screenings st
    WHERE st.id = target_student_id AND st.organization_id = actor_profile.organization_id
    FOR UPDATE;
    IF NOT FOUND OR existing_student.session_id <> target_session_id
      OR (actor_profile.role = 'district_manager' AND existing_student.district_id <> actor_profile.district_id)
      OR (actor_profile.role = 'enumerator'
        AND existing_student.created_by <> actor_id
        AND existing_student.owner_id <> actor_id)
    THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SI number reservation is not authorized';
    END IF;
  END IF;

  -- Serialize concurrent requests for the same organization/number before the
  -- duplicate and reservation checks below.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'student-si:' || actor_profile.organization_id::TEXT || ':' || normalized_number,
      0
    )
  );

  IF EXISTS (
    SELECT 1 FROM public.student_screenings st
    WHERE st.organization_id = actor_profile.organization_id
      AND st.si_number = normalized_number
      AND st.id IS DISTINCT FROM target_student_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'That SI number is already in use in this organization';
  END IF;

  SELECT r.* INTO existing_request FROM public.student_si_reservations r
  WHERE r.requested_by = actor_id AND r.idempotency_key = request_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF existing_request.organization_id <> actor_profile.organization_id
      OR existing_request.session_id <> target_session_id
      OR existing_request.si_number <> normalized_number
      OR existing_request.target_student_id IS DISTINCT FROM target_student_id
    THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'SI reservation idempotency key was reused with different data';
    END IF;
    IF existing_request.consumed_at IS NULL THEN
      UPDATE public.student_si_reservations SET expires_at = now() + interval '15 minutes'
      WHERE id = existing_request.id;
    END IF;
    RETURN existing_request.id;
  END IF;

  SELECT r.* INTO existing_number FROM public.student_si_reservations r
  WHERE r.organization_id = actor_profile.organization_id
    AND r.si_number = normalized_number
    AND r.consumed_at IS NULL
  FOR UPDATE;
  IF FOUND THEN
    IF existing_number.expires_at <= now() THEN
      UPDATE public.student_si_reservations
      SET session_id = target_session_id,
          requested_by = actor_id,
          target_student_id = target_student_id,
          idempotency_key = request_idempotency_key,
          expires_at = now() + interval '15 minutes'
      WHERE id = existing_number.id
      RETURNING id INTO reservation_id;
      RETURN reservation_id;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'That SI number is currently reserved';
  END IF;

  INSERT INTO public.student_si_reservations (
    organization_id, session_id, requested_by, target_student_id,
    si_number, idempotency_key, expires_at
  ) VALUES (
    actor_profile.organization_id, target_session_id, actor_id, target_student_id,
    normalized_number, request_idempotency_key, now() + interval '15 minutes'
  ) RETURNING id INTO reservation_id;
  RETURN reservation_id;
END
$$;

CREATE OR REPLACE FUNCTION public.consume_student_si_reservation()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reservation public.student_si_reservations%ROWTYPE;
  si_changed BOOLEAN;
BEGIN
  si_changed := TG_OP = 'INSERT' OR NEW.si_number IS DISTINCT FROM OLD.si_number;
  IF NOT si_changed OR NEW.si_number IS NULL THEN
    NEW.si_reservation_id := NULL;
    RETURN NEW;
  END IF;

  -- Trusted database maintenance without an end-user JWT can preserve existing
  -- workflows; all authenticated API writes need a valid reservation.
  IF auth.uid() IS NULL THEN
    NEW.si_reservation_id := NULL;
    RETURN NEW;
  END IF;

  SELECT r.* INTO reservation FROM public.student_si_reservations r
  WHERE r.id = NEW.si_reservation_id
    AND r.organization_id = NEW.organization_id
    AND r.session_id = NEW.session_id
    AND r.requested_by = auth.uid()
    AND r.si_number = NEW.si_number
    AND r.target_student_id IS NOT DISTINCT FROM NEW.id
  FOR UPDATE;
  IF NOT FOUND OR (reservation.consumed_at IS NOT NULL AND reservation.target_student_id IS DISTINCT FROM NEW.id)
    OR (reservation.consumed_at IS NULL AND reservation.expires_at <= now())
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A valid SI number reservation is required';
  END IF;

  UPDATE public.student_si_reservations
  SET consumed_at = COALESCE(consumed_at, now())
  WHERE id = reservation.id;
  NEW.si_reservation_id := NULL;
  RETURN NEW;
END
$$;

CREATE TRIGGER student_screenings_consume_si_reservation
  BEFORE INSERT OR UPDATE OF si_number ON public.student_screenings
  FOR EACH ROW EXECUTE FUNCTION public.consume_student_si_reservation();

CREATE OR REPLACE FUNCTION public.cleanup_expired_student_si_reservations()
RETURNS BIGINT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH deleted AS (
    DELETE FROM public.student_si_reservations
    WHERE consumed_at IS NULL AND expires_at <= now()
    RETURNING 1
  )
  SELECT count(*) FROM deleted
$$;

REVOKE INSERT ON TABLE public.student_screenings FROM authenticated;
GRANT INSERT (
  id, organization_id, session_id, district_id, taluk_id, school_id,
  si_number, student_name, class_name, section, sex, date_of_birth, age,
  height_cm, weight_kg, bmi, skeletal_deformity, skeletal_observation,
  skin_thickness_mm, mid_arm_circumference_cm, additional_remarks,
  screening_date, si_reservation_id
) ON TABLE public.student_screenings TO authenticated;
GRANT UPDATE (si_reservation_id) ON TABLE public.student_screenings TO authenticated;

REVOKE ALL ON FUNCTION public.reserve_student_si_number(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_student_si_number(UUID, TEXT, UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.consume_student_si_reservation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cleanup_expired_student_si_reservations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_student_si_reservations() TO service_role;

COMMIT;
