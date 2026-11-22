BEGIN;

-- Avoid PL/pgSQL name resolution ambiguity between the update parameter and
-- student_si_reservations.target_student_id column.
DROP FUNCTION public.reserve_student_si_number(UUID, TEXT, UUID, UUID);

CREATE FUNCTION public.reserve_student_si_number(
  target_session_id UUID,
  requested_si_number TEXT,
  request_idempotency_key UUID,
  requested_student_id UUID DEFAULT NULL
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
    AND (s.status = 'active' OR requested_student_id IS NOT NULL);
  IF target_session.id IS NULL
    OR actor_profile.id IS NULL
    OR target_session.organization_id <> actor_profile.organization_id
  THEN
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

  IF requested_student_id IS NOT NULL THEN
    SELECT st.* INTO existing_student FROM public.student_screenings st
    WHERE st.id = requested_student_id AND st.organization_id = actor_profile.organization_id
    FOR UPDATE;
    IF existing_student.id IS NOT NULL AND (
      existing_student.session_id <> target_session_id
      OR (actor_profile.role = 'district_manager' AND existing_student.district_id <> actor_profile.district_id)
      OR (actor_profile.role = 'enumerator'
        AND existing_student.created_by <> actor_id
        AND existing_student.owner_id <> actor_id)
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SI number reservation is not authorized';
    END IF;
  END IF;

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
      AND st.id IS DISTINCT FROM requested_student_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'That SI number is already in use in this organization';
  END IF;

  SELECT r.* INTO existing_request FROM public.student_si_reservations r
  WHERE r.requested_by = actor_id AND r.idempotency_key = request_idempotency_key
  FOR UPDATE;
  IF existing_request.id IS NOT NULL THEN
    IF existing_request.organization_id <> actor_profile.organization_id
      OR existing_request.session_id <> target_session_id
      OR existing_request.si_number <> normalized_number
      OR existing_request.target_student_id IS DISTINCT FROM requested_student_id
    THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'SI reservation idempotency key was reused with different data';
    END IF;
    IF existing_request.consumed_at IS NULL THEN
      UPDATE public.student_si_reservations r SET expires_at = now() + interval '15 minutes'
      WHERE r.id = existing_request.id;
    END IF;
    RETURN existing_request.id;
  END IF;

  SELECT r.* INTO existing_number FROM public.student_si_reservations r
  WHERE r.organization_id = actor_profile.organization_id
    AND r.si_number = normalized_number
    AND r.consumed_at IS NULL
  FOR UPDATE;
  IF existing_number.id IS NOT NULL THEN
    IF existing_number.expires_at <= now() THEN
      UPDATE public.student_si_reservations r
      SET session_id = target_session_id,
          requested_by = actor_id,
          target_student_id = requested_student_id,
          idempotency_key = request_idempotency_key,
          expires_at = now() + interval '15 minutes'
      WHERE r.id = existing_number.id
      RETURNING r.id INTO reservation_id;
      RETURN reservation_id;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'That SI number is currently reserved';
  END IF;

  INSERT INTO public.student_si_reservations (
    organization_id, session_id, requested_by, target_student_id,
    si_number, idempotency_key, expires_at
  ) VALUES (
    actor_profile.organization_id, target_session_id, actor_id, requested_student_id,
    normalized_number, request_idempotency_key, now() + interval '15 minutes'
  ) RETURNING id INTO reservation_id;
  RETURN reservation_id;
END
$$;

REVOKE ALL ON FUNCTION public.reserve_student_si_number(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_student_si_number(UUID, TEXT, UUID, UUID) TO authenticated;

COMMIT;
