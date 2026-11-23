BEGIN;

CREATE OR REPLACE FUNCTION public.verify_user_invitation_context(target_invitation_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users AS u
    JOIN public.user_invitations AS i
      ON i.auth_user_id = u.id
    WHERE auth.uid() IS NOT NULL
      AND u.id = auth.uid()
      AND u.email_confirmed_at IS NOT NULL
      AND u.email IS NOT NULL
      AND i.id = target_invitation_id
      AND i.email = lower(btrim(u.email))
      AND i.status = 'pending'
      AND i.auth_status = 'accepted_by_auth'
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles AS p
        WHERE lower(btrim(p.email)) = lower(btrim(u.email))
      )
  )
$$;

REVOKE ALL ON FUNCTION public.verify_user_invitation_context(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_user_invitation_context(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_user_invitation(
  requested_email TEXT,
  requested_role TEXT,
  requested_district_id UUID,
  request_idempotency_key UUID
)
RETURNS TABLE (invitation_id UUID, created BOOLEAN, result_code TEXT)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  prior_invitation public.user_invitations%ROWTYPE;
  normalized_email TEXT;
  new_invitation_id UUID;
BEGIN
  IF auth.uid() IS NULL OR request_idempotency_key IS NULL
    OR requested_email IS NULL OR requested_role IS NULL OR requested_district_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation request is not authorized';
  END IF;

  normalized_email := lower(btrim(requested_email));
  IF normalized_email = ''
    OR normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR requested_role NOT IN ('district_manager', 'enumerator') THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'invalid_request'::TEXT;
    RETURN;
  END IF;

  SELECT p.* INTO actor
  FROM public.profiles AS p
  WHERE p.id = auth.uid() AND p.is_active;

  IF NOT FOUND OR actor.role <> 'organization_admin' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation request is not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.districts AS d
    WHERE d.id = requested_district_id
      AND d.organization_id = actor.organization_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Selected district is unavailable';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'invitation-idempotency:' || actor.id::TEXT || ':' || request_idempotency_key::TEXT, 0));
  SELECT i.* INTO prior_invitation
  FROM public.user_invitations AS i
  WHERE i.invited_by = actor.id AND i.idempotency_key = request_idempotency_key;
  IF FOUND THEN
    IF prior_invitation.email = normalized_email
      AND prior_invitation.role = requested_role
      AND prior_invitation.organization_id = actor.organization_id
      AND prior_invitation.district_id = requested_district_id THEN
      RETURN QUERY SELECT prior_invitation.id, FALSE, 'existing'::TEXT;
    ELSE
      RETURN QUERY SELECT NULL::UUID, FALSE, 'conflict'::TEXT;
    END IF;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('invitation-email:' || normalized_email, 0));
  IF EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE lower(btrim(p.email)) = normalized_email
  ) OR EXISTS (
    SELECT 1 FROM auth.users AS u
    WHERE lower(btrim(u.email)) = normalized_email
  ) THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'conflict'::TEXT;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.user_invitations (
      organization_id, district_id, invited_by, email, role, idempotency_key
    )
    VALUES (
      actor.organization_id, requested_district_id, actor.id,
      normalized_email, requested_role, request_idempotency_key
    )
    RETURNING id INTO new_invitation_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT i.* INTO prior_invitation
    FROM public.user_invitations AS i
    WHERE i.invited_by = actor.id AND i.idempotency_key = request_idempotency_key;
    IF FOUND AND prior_invitation.email = normalized_email
      AND prior_invitation.role = requested_role
      AND prior_invitation.organization_id = actor.organization_id
      AND prior_invitation.district_id = requested_district_id THEN
      RETURN QUERY SELECT prior_invitation.id, FALSE, 'existing'::TEXT;
    ELSE
      RETURN QUERY SELECT NULL::UUID, FALSE, 'conflict'::TEXT;
    END IF;
    RETURN;
  END;

  RETURN QUERY SELECT new_invitation_id, TRUE, 'created'::TEXT;
END
$$;

REVOKE ALL ON FUNCTION public.request_user_invitation(TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_user_invitation(TEXT, TEXT, UUID, UUID) TO authenticated;

COMMIT;
