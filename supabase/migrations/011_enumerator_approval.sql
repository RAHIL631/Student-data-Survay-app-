BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved'));

-- Let a pending user read only their own profile so the app can show the approval state.
CREATE POLICY profiles_read_own_pending_approval
  ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() AND approval_status = 'pending');

-- Replace the old acceptance RPC so an invited Enumerator cannot access organization
-- data until an administrator explicitly approves the account.
DROP FUNCTION IF EXISTS public.accept_user_invitation(UUID, TEXT);

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
  existing_approval_status TEXT;
BEGIN
  IF auth.uid() IS NULL
    OR target_full_name IS NULL
    OR char_length(btrim(target_full_name)) < 2
    OR char_length(btrim(target_full_name)) > 120 THEN
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
    SELECT p.approval_status INTO existing_approval_status
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND p.organization_id = invite.organization_id
      AND p.district_id = invite.district_id
      AND p.email = invite.email
      AND p.full_name = btrim(target_full_name)
      AND p.role = invite.role;
    IF FOUND THEN
      RETURN CASE WHEN existing_approval_status = 'pending' THEN 'pending_approval' ELSE 'approved' END;
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

  INSERT INTO public.profiles (
    id, organization_id, email, full_name, role, district_id, is_active, approval_status
  )
  VALUES (
    auth.uid(), invite.organization_id, normalized_email,
    btrim(target_full_name), invite.role, invite.district_id,
    invite.role <> 'enumerator',
    CASE WHEN invite.role = 'enumerator' THEN 'pending' ELSE 'approved' END
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

  RETURN CASE WHEN invite.role = 'enumerator' THEN 'pending_approval' ELSE 'approved' END;
END
$$;

REVOKE ALL ON FUNCTION public.accept_user_invitation(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_user_invitation(UUID, TEXT) TO authenticated;

COMMIT;
