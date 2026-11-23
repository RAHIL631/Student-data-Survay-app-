BEGIN;

DROP FUNCTION public.accept_user_invitation(UUID);

CREATE FUNCTION public.accept_user_invitation(
  target_invitation_id UUID,
  target_full_name TEXT
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
  normalized_full_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;

  normalized_full_name := btrim(target_full_name);
  IF normalized_full_name IS NULL OR normalized_full_name = '' OR length(normalized_full_name) > 200 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A full name of 1 to 200 characters is required';
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
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'A profile already exists for this email';
  END IF;

  INSERT INTO public.profiles (
    id, organization_id, email, full_name, role, district_id, is_active
  )
  VALUES (
    auth.uid(), invite.organization_id, normalized_email, normalized_full_name,
    invite.role, invite.district_id, TRUE
  );

  UPDATE public.user_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = invite.id AND status = 'pending' AND auth_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation cannot be accepted';
  END IF;

  RETURN TRUE;
END
$$;

REVOKE ALL ON FUNCTION public.accept_user_invitation(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_user_invitation(UUID, TEXT) TO authenticated;

COMMIT;
