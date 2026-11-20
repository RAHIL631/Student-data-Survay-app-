BEGIN;

CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES public.organizations(id) ON DELETE RESTRICT,
  district_id UUID NOT NULL,
  invited_by UUID NOT NULL,
  email TEXT NOT NULL CHECK (email = lower(btrim(email))),
  role TEXT NOT NULL
    CHECK (role IN ('district_manager', 'enumerator')),
  status TEXT NOT NULL DEFAULT 'provisioning'
    CHECK (status IN ('provisioning', 'pending', 'accepted', 'cancelled', 'expired', 'failed')),
  auth_status TEXT NOT NULL DEFAULT 'not_attempted'
    CHECK (auth_status IN ('not_attempted', 'in_flight', 'accepted_by_auth', 'rejected_by_auth', 'unknown')),
  auth_user_id UUID UNIQUE
    REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auth_request_started_at TIMESTAMPTZ,
  last_auth_response_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  failure_code TEXT CHECK (
    failure_code IS NULL
    OR failure_code IN ('auth_rejected', 'auth_unavailable', 'unexpected_failure')
  ),

  CONSTRAINT user_invitations_inviter_idempotency_key
    UNIQUE (invited_by, idempotency_key),
  CONSTRAINT user_invitations_district_fk
    FOREIGN KEY (organization_id, district_id)
    REFERENCES public.districts(organization_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT user_invitations_inviter_fk
    FOREIGN KEY (organization_id, invited_by)
    REFERENCES public.profiles(organization_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT user_invitations_accepted_timestamp_check
    CHECK (status <> 'accepted' OR accepted_at IS NOT NULL),
  CONSTRAINT user_invitations_cancelled_timestamp_check
    CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL),
  CONSTRAINT user_invitations_expired_timestamp_check
    CHECK (status <> 'expired' OR expired_at IS NOT NULL)
);

CREATE UNIQUE INDEX user_invitations_active_email_key
  ON public.user_invitations (email)
  WHERE status IN ('provisioning', 'pending');

CREATE INDEX user_invitations_org_history_idx
  ON public.user_invitations (organization_id, created_at DESC);
CREATE INDEX user_invitations_district_history_idx
  ON public.user_invitations (organization_id, district_id, created_at DESC);
CREATE INDEX user_invitations_status_history_idx
  ON public.user_invitations (organization_id, status, created_at DESC);

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_invitations_history_read
  ON public.user_invitations
  FOR SELECT TO authenticated
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

CREATE OR REPLACE FUNCTION public.guard_user_invitation_update()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.district_id IS DISTINCT FROM OLD.district_id
    OR NEW.invited_by IS DISTINCT FROM OLD.invited_by
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Invitation identity and scope are immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'provisioning' AND NEW.status IN ('pending', 'cancelled', 'failed'))
    OR (OLD.status = 'pending' AND NEW.status IN ('accepted', 'cancelled', 'expired'))
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Invalid invitation status transition';
  END IF;

  IF NEW.auth_status IS DISTINCT FROM OLD.auth_status AND NOT (
    (OLD.auth_status = 'not_attempted' AND NEW.auth_status = 'in_flight')
    OR (
      OLD.auth_status = 'in_flight'
      AND NEW.auth_status IN ('accepted_by_auth', 'rejected_by_auth', 'unknown')
    )
    OR (
      OLD.auth_status = 'unknown'
      AND NEW.auth_status IN ('accepted_by_auth', 'rejected_by_auth')
    )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Invalid Auth request status transition';
  END IF;

  IF NEW.status = 'accepted' AND NEW.accepted_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Accepted invitation requires accepted_at';
  END IF;
  IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Cancelled invitation requires cancelled_at';
  END IF;
  IF NEW.status = 'expired' AND NEW.expired_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Expired invitation requires expired_at';
  END IF;
  IF NEW.auth_status IS DISTINCT FROM OLD.auth_status
    AND NEW.auth_status = 'accepted_by_auth'
    AND NEW.auth_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Auth user is required for a successful invitation request';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER user_invitations_guard_update
  BEFORE UPDATE ON public.user_invitations
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_invitation_update();

CREATE TRIGGER user_invitations_set_updated_at
  BEFORE UPDATE ON public.user_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
  IF auth.uid() IS NULL
    OR request_idempotency_key IS NULL
    OR requested_email IS NULL
    OR requested_role IS NULL
    OR requested_district_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation request is not authorized';
  END IF;

  normalized_email := lower(btrim(requested_email));
  IF normalized_email = ''
    OR normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR requested_role NOT IN ('district_manager', 'enumerator') THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'conflict'::TEXT;
    RETURN;
  END IF;

  SELECT p.* INTO actor
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation request is not authorized';
  END IF;

  IF actor.role <> 'organization_admin'
    OR requested_role NOT IN ('district_manager', 'enumerator') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation request is not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.districts AS d
    WHERE d.id = requested_district_id
      AND d.organization_id = actor.organization_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation request is not authorized';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'invitation-idempotency:' || actor.id::TEXT || ':' || request_idempotency_key::TEXT,
      0
    )
  );

  SELECT i.* INTO prior_invitation
  FROM public.user_invitations AS i
  WHERE i.invited_by = actor.id
    AND i.idempotency_key = request_idempotency_key;

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
    pg_catalog.hashtextextended('invitation-email:' || normalized_email, 0)
  );

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
    WHERE i.invited_by = actor.id
      AND i.idempotency_key = request_idempotency_key;

    IF FOUND
      AND prior_invitation.email = normalized_email
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

CREATE OR REPLACE FUNCTION public.claim_user_invitation_auth_request(target_invitation_id UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized';
  END IF;

  UPDATE public.user_invitations
  SET auth_status = 'in_flight',
      auth_request_started_at = now()
  WHERE id = target_invitation_id
    AND status = 'provisioning'
    AND auth_status = 'not_attempted';

  RETURN FOUND;
END
$$;

CREATE OR REPLACE FUNCTION public.record_user_invitation_auth_result(
  target_invitation_id UUID,
  result_status TEXT,
  resulting_auth_user_id UUID DEFAULT NULL,
  safe_failure_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    OR result_status IS NULL
    OR result_status NOT IN ('accepted_by_auth', 'rejected_by_auth', 'unknown')
    OR (result_status = 'accepted_by_auth' AND resulting_auth_user_id IS NULL)
    OR (result_status <> 'accepted_by_auth' AND resulting_auth_user_id IS NOT NULL)
    OR (safe_failure_code IS NOT NULL
      AND safe_failure_code NOT IN ('auth_rejected', 'auth_unavailable', 'unexpected_failure'))
    OR (result_status <> 'rejected_by_auth' AND safe_failure_code IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not authorized';
  END IF;

  UPDATE public.user_invitations
  SET auth_status = result_status,
      auth_user_id = COALESCE(resulting_auth_user_id, auth_user_id),
      last_auth_response_at = CASE
        WHEN result_status = 'unknown' THEN last_auth_response_at
        ELSE now()
      END,
      failure_code = CASE
        WHEN result_status = 'rejected_by_auth' THEN safe_failure_code
        ELSE NULL
      END,
      status = CASE
        WHEN status = 'provisioning' AND result_status = 'accepted_by_auth' THEN 'pending'
        WHEN status = 'provisioning' AND result_status = 'rejected_by_auth' THEN 'failed'
        ELSE status
      END
  WHERE id = target_invitation_id
    AND status IN ('provisioning', 'cancelled')
    AND auth_status IN ('in_flight', 'unknown');

  RETURN FOUND;
END
$$;

CREATE OR REPLACE FUNCTION public.cancel_user_invitation(target_invitation_id UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor public.profiles%ROWTYPE;
  target public.user_invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT p.* INTO actor
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  SELECT i.* INTO target
  FROM public.user_invitations AS i
  WHERE i.id = target_invitation_id
  FOR UPDATE;
  IF NOT FOUND
    OR target.organization_id <> actor.organization_id
    OR actor.role <> 'organization_admin' THEN
    RETURN FALSE;
  END IF;

  IF target.status = 'cancelled' THEN
    RETURN TRUE;
  END IF;
  IF target.status NOT IN ('provisioning', 'pending') THEN
    RETURN FALSE;
  END IF;

  UPDATE public.user_invitations
  SET status = 'cancelled',
      cancelled_at = now()
  WHERE id = target.id
    AND status IN ('provisioning', 'pending');

  RETURN FOUND;
END
$$;

CREATE OR REPLACE FUNCTION public.accept_user_invitation(
  target_invitation_id UUID,
  requested_full_name TEXT
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invite public.user_invitations%ROWTYPE;
  auth_email TEXT;
  email_confirmed_at TIMESTAMPTZ;
  normalized_email TEXT;
BEGIN
  IF auth.uid() IS NULL
    OR requested_full_name IS NULL
    OR char_length(btrim(requested_full_name)) < 2
    OR char_length(btrim(requested_full_name)) > 120 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;

  SELECT u.email, u.email_confirmed_at
  INTO auth_email, email_confirmed_at
  FROM auth.users AS u
  WHERE u.id = auth.uid();

  IF NOT FOUND OR email_confirmed_at IS NULL OR auth_email IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;
  normalized_email := lower(btrim(auth_email));

  SELECT i.* INTO invite
  FROM public.user_invitations AS i
  WHERE i.id = target_invitation_id
  FOR UPDATE;

  IF NOT FOUND
    OR invite.auth_user_id IS DISTINCT FROM auth.uid()
    OR invite.email <> normalized_email THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('profile-email:' || normalized_email, 0)
  );

  IF invite.status = 'accepted' THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.organization_id = invite.organization_id
        AND p.district_id = invite.district_id
        AND p.email = invite.email
        AND p.full_name = btrim(requested_full_name)
        AND p.role = invite.role
    ) THEN
      RETURN TRUE;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;

  IF invite.status <> 'pending'
    OR invite.auth_status <> 'accepted_by_auth' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE lower(btrim(p.email)) = normalized_email
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;

  INSERT INTO public.profiles (id, organization_id, email, full_name, role, district_id)
  VALUES (
    auth.uid(), invite.organization_id, normalized_email,
    btrim(requested_full_name), invite.role, invite.district_id
  );

  UPDATE public.user_invitations
  SET status = 'accepted',
      accepted_at = now()
  WHERE id = invite.id
    AND status = 'pending'
    AND auth_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;

  RETURN TRUE;
END
$$;

REVOKE ALL ON TABLE public.user_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, organization_id, district_id, email, role, status, auth_status,
  created_at, last_auth_response_at, accepted_at, cancelled_at
) ON public.user_invitations TO authenticated;

REVOKE ALL ON FUNCTION public.guard_user_invitation_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_user_invitation(TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_user_invitation_auth_request(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_user_invitation_auth_result(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_user_invitation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_user_invitation(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.request_user_invitation(TEXT, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_user_invitation_auth_request(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_user_invitation_auth_result(UUID, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_user_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_user_invitation(UUID, TEXT) TO authenticated;

COMMIT;
