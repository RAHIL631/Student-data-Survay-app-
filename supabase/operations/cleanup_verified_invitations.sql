-- Reviewed one-time cleanup for the six invitation rows verified on
-- qghesdscscclbfevbypb. It preserves all Auth users and application profiles.
-- Any inventory, dependency, audit, or Admin-profile drift aborts the transaction.
BEGIN;

LOCK TABLE public.user_invitations IN SHARE ROW EXCLUSIVE MODE;

DO $cleanup$
DECLARE
  deleted_count INTEGER;
  invitation_count INTEGER;
BEGIN
  IF (SELECT count(*) FROM public.user_invitations) <> 6 THEN
    RAISE EXCEPTION 'Invitation inventory changed; expected exactly six rows';
  END IF;

  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('5bf75c02-4c91-457d-a7b3-57549ecbd43c'::uuid, 'dhanushree.s10122005@gmail.com', 'pending', 'accepted_by_auth', '42c0916f-fcae-441e-9438-ef99a9b5543d'::uuid),
      ('95049eb4-78ae-4123-b159-3ee7f6c54ae5'::uuid, 'shanthalasrinath2202@gmail.com', 'pending', 'accepted_by_auth', '250dd035-8767-4226-b9f5-b6c0d07a2ea0'::uuid),
      ('66cabd53-f96c-4e37-9d05-bf56d45ce8e2'::uuid, 'rahilhassan786786@gmail.com', 'pending', 'accepted_by_auth', '338748ef-b390-4a3d-a848-16f8acad9c43'::uuid),
      ('0040399f-b1c9-413e-ae88-2d058773e544'::uuid, 'mujeebpasha.k@gmail.com', 'pending', 'accepted_by_auth', 'ad071575-8f0a-4355-b5fe-6ac616372340'::uuid),
      ('eb446856-1859-4105-81e8-420584690d0e'::uuid, 'rahilhassan5697@gmail.com', 'cancelled', 'accepted_by_auth', 'cb672318-49e2-4bd4-8155-41386496cedf'::uuid),
      ('f1ebf7cc-8f49-4b16-904c-c163a65a10e9'::uuid, 'dhanushree.s2005@gmail.com', 'failed', 'rejected_by_auth', NULL::uuid)
    ) AS expected(id, email, status, auth_status, auth_user_id)
    LEFT JOIN public.user_invitations actual ON actual.id = expected.id
    WHERE actual.id IS NULL
      OR actual.email <> expected.email
      OR actual.status <> expected.status
      OR actual.auth_status <> expected.auth_status
      OR actual.auth_user_id IS DISTINCT FROM expected.auth_user_id
      OR actual.role <> 'enumerator'
      OR actual.organization_id <> 'a8d4cb78-830c-4d7e-9100-ab9c5906f2e5'::uuid
      OR actual.district_id <> '83fb2bf1-953f-43ca-a088-0712f0e529fd'::uuid
  ) THEN
    RAISE EXCEPTION 'Invitation rows no longer match the reviewed inventory';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'public.user_invitations'::regclass
  ) THEN
    RAISE EXCEPTION 'New inbound foreign key references user_invitations';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.user_invitations'::regclass
      AND NOT tgisinternal
      AND (tgtype & 8) = 8
  ) THEN
    RAISE EXCEPTION 'Delete trigger found on user_invitations';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE record_id IN (
      '5bf75c02-4c91-457d-a7b3-57549ecbd43c'::uuid,
      '95049eb4-78ae-4123-b159-3ee7f6c54ae5'::uuid,
      '66cabd53-f96c-4e37-9d05-bf56d45ce8e2'::uuid,
      '0040399f-b1c9-413e-ae88-2d058773e544'::uuid,
      'eb446856-1859-4105-81e8-420584690d0e'::uuid,
      'f1ebf7cc-8f49-4b16-904c-c163a65a10e9'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'Audit history references an invitation targeted for cleanup';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id IN (
      '42c0916f-fcae-441e-9438-ef99a9b5543d'::uuid,
      '250dd035-8767-4226-b9f5-b6c0d07a2ea0'::uuid,
      '338748ef-b390-4a3d-a848-16f8acad9c43'::uuid,
      'ad071575-8f0a-4355-b5fe-6ac616372340'::uuid,
      'cb672318-49e2-4bd4-8155-41386496cedf'::uuid
    ) OR lower(btrim(p.email)) IN (
      'dhanushree.s10122005@gmail.com', 'shanthalasrinath2202@gmail.com',
      'rahilhassan786786@gmail.com', 'mujeebpasha.k@gmail.com',
      'rahilhassan5697@gmail.com', 'dhanushree.s2005@gmail.com'
    )
  ) THEN
    RAISE EXCEPTION 'A targeted invitation now has an application profile';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '8c4f87bf-8960-4fb3-983f-16d9f5510943'::uuid
      AND lower(btrim(email)) = 'dhanushree.s1012@gmail.com'
      AND role = 'organization_admin'
      AND organization_id = 'a8d4cb78-830c-4d7e-9100-ab9c5906f2e5'::uuid
      AND is_active
  ) THEN
    RAISE EXCEPTION 'Expected Admin profile is absent or changed';
  END IF;

  DELETE FROM public.user_invitations
  WHERE id IN (
    '5bf75c02-4c91-457d-a7b3-57549ecbd43c'::uuid,
    '95049eb4-78ae-4123-b159-3ee7f6c54ae5'::uuid,
    '66cabd53-f96c-4e37-9d05-bf56d45ce8e2'::uuid,
    '0040399f-b1c9-413e-ae88-2d058773e544'::uuid,
    'eb446856-1859-4105-81e8-420584690d0e'::uuid,
    'f1ebf7cc-8f49-4b16-904c-c163a65a10e9'::uuid
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count <> 6 THEN
    RAISE EXCEPTION 'Expected to delete six invitation rows, deleted %', deleted_count;
  END IF;

  SELECT count(*) INTO invitation_count FROM public.user_invitations;
  IF invitation_count <> 0 THEN
    RAISE EXCEPTION 'Invitation table is not empty after cleanup';
  END IF;
END
$cleanup$;

COMMIT;
