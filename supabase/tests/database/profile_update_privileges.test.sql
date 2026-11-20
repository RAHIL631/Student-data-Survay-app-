BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT no_plan();

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('00000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated', 'profile-admin@privileges.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000202', 'authenticated', 'authenticated', 'profile-manager@privileges.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

INSERT INTO public.organizations (id, name)
VALUES ('10000000-0000-0000-0000-000000000201', 'Profile privilege test organization');

INSERT INTO public.districts (id, organization_id, name, code)
VALUES ('20000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000201', 'Profile privilege test district', 'PP1');

INSERT INTO public.profiles (id, organization_id, email, full_name, role, district_id)
VALUES
  ('00000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000201', 'profile-admin@privileges.test', 'Profile Admin', 'organization_admin', NULL),
  ('00000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000201', 'profile-manager@privileges.test', 'Profile Manager', 'district_manager', '20000000-0000-0000-0000-000000000201');

SELECT is(
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  FALSE,
  'authenticated role has no table-wide profile update privilege'
);
SELECT is(
  has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE'),
  TRUE,
  'authenticated role has only the profile full_name column update grant'
);
SELECT is(
  has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  FALSE,
  'authenticated role cannot update profile role'
);
SELECT is(
  has_column_privilege('authenticated', 'public.profiles', 'organization_id', 'UPDATE'),
  FALSE,
  'authenticated role cannot update profile organization'
);
SELECT is(
  has_column_privilege('authenticated', 'public.profiles', 'district_id', 'UPDATE'),
  FALSE,
  'authenticated role cannot update profile district'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000201","role":"authenticated"}', true);

SELECT lives_ok(
  $$UPDATE public.profiles SET full_name = 'Updated by admin' WHERE id = '00000000-0000-0000-0000-000000000202'$$,
  'organization admin can update a profile display name in their organization'
);
SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'organization_admin' WHERE id = '00000000-0000-0000-0000-000000000202'$$,
  '42501',
  NULL,
  'organization admin cannot elevate another profile role'
);
SELECT throws_ok(
  $$UPDATE public.profiles SET district_id = NULL WHERE id = '00000000-0000-0000-0000-000000000202'$$,
  '42501',
  NULL,
  'organization admin cannot change another profile district'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000202","role":"authenticated"}', true);

UPDATE public.profiles
SET full_name = 'Unauthorized manager edit'
WHERE id = '00000000-0000-0000-0000-000000000201';
RESET ROLE;
SELECT is(
  (SELECT full_name FROM public.profiles
   WHERE id = '00000000-0000-0000-0000-000000000201'),
  'Profile Admin',
  'district manager cannot update profiles under the organization-admin-only RLS policy'
);

SELECT * FROM finish();
ROLLBACK;
