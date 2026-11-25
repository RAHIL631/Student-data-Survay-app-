BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_approval_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_approval_status_check
      CHECK (approval_status IN ('pending', 'approved'));
  END IF;
END
$$;

CREATE POLICY profiles_read_own_pending_approval
  ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() AND approval_status = 'pending');

DROP FUNCTION public.accept_user_invitation(UUID, TEXT);

CREATE FUNCTION public.accept_user_invitation(
  target_invitation_id UUID,
  target_full_name TEXT
)
RETURNS TEXT
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invite public.user_invitations%ROWTYPE;
  auth_email TEXT;
  email_confirmed_at TIMESTAMPTZ;
  normalized_email TEXT;
  normalized_full_name TEXT;
  prior_approval_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;

  normalized_full_name := btrim(target_full_name);
  IF normalized_full_name IS NULL OR char_length(normalized_full_name) < 2
    OR char_length(normalized_full_name) > 120 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A full name of 2 to 120 characters is required';
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
  IF NOT FOUND OR invite.auth_user_id IS DISTINCT FROM auth.uid()
    OR invite.email <> normalized_email THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('profile-email:' || normalized_email, 0));

  IF invite.status = 'accepted' THEN
    SELECT p.approval_status INTO prior_approval_status
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.organization_id = invite.organization_id
      AND p.district_id IS NOT DISTINCT FROM invite.district_id
      AND p.email = invite.email
      AND p.full_name = normalized_full_name
      AND p.role = invite.role;
    IF FOUND THEN
      RETURN CASE WHEN prior_approval_status = 'pending' THEN 'pending_approval' ELSE 'approved' END;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;

  IF invite.status <> 'pending' OR invite.auth_status <> 'accepted_by_auth' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE lower(btrim(p.email)) = normalized_email
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'A profile already exists for this email';
  END IF;

  INSERT INTO public.profiles (
    id, organization_id, email, full_name, role, district_id, is_active, approval_status
  ) VALUES (
    auth.uid(), invite.organization_id, normalized_email, normalized_full_name,
    invite.role, invite.district_id, invite.role <> 'enumerator',
    CASE WHEN invite.role = 'enumerator' THEN 'pending' ELSE 'approved' END
  );

  UPDATE public.user_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = invite.id AND status = 'pending' AND auth_user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;

  RETURN CASE WHEN invite.role = 'enumerator' THEN 'pending_approval' ELSE 'approved' END;
END
$$;

CREATE OR REPLACE FUNCTION public.approve_enumerator_profile(target_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_org UUID;
  target public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_profile_is_active()
    OR public.current_profile_role() <> 'organization_admin'
    OR target_profile_id = auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Account approval is not authorized';
  END IF;

  actor_org := public.current_profile_organization_id();
  SELECT p.* INTO target FROM public.profiles AS p
  WHERE p.id = target_profile_id AND p.organization_id = actor_org
  FOR UPDATE;
  IF NOT FOUND OR target.role <> 'enumerator' OR target.approval_status <> 'pending' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
  SET approval_status = 'approved', is_active = TRUE
  WHERE id = target.id AND approval_status = 'pending' AND role = 'enumerator';
  IF NOT FOUND THEN RETURN FALSE; END IF;

  INSERT INTO public.audit_logs (
    organization_id, district_id, actor_id, action, record_type, record_id, metadata
  ) VALUES (
    actor_org, target.district_id, auth.uid(), 'account_approved',
    'profiles', target.id,
    jsonb_build_object('previous_approval_status', 'pending', 'approval_status', 'approved', 'is_active', TRUE)
  );
  RETURN TRUE;
END
$$;

REVOKE ALL ON FUNCTION public.accept_user_invitation(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_user_invitation(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.approve_enumerator_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_enumerator_profile(UUID) TO authenticated;

COMMIT;
