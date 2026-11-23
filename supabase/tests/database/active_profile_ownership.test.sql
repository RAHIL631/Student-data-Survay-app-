BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('81000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-admin@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('81000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'owner-manager@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('81000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'owner-enum-one@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('81000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'owner-enum-two@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('81000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'owner-inactive@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');
INSERT INTO public.organizations (id, name)
VALUES ('82000000-0000-0000-0000-000000000001', 'Active and ownership test organization');
INSERT INTO public.districts (id, organization_id, name, code)
VALUES ('83000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'Ownership district', 'OWN');
INSERT INTO public.profiles (id, organization_id, district_id, email, full_name, role, is_active)
VALUES
  ('81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', NULL, 'owner-admin@example.test', 'Owner Admin', 'organization_admin', TRUE),
  ('81000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'owner-manager@example.test', 'Owner Manager', 'district_manager', TRUE),
  ('81000000-0000-0000-0000-000000000003', '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'owner-enum-one@example.test', 'Owner Enumerator One', 'enumerator', TRUE),
  ('81000000-0000-0000-0000-000000000004', '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'owner-enum-two@example.test', 'Owner Enumerator Two', 'enumerator', TRUE),
  ('81000000-0000-0000-0000-000000000005', '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'owner-inactive@example.test', 'Inactive Enumerator', 'enumerator', FALSE);
INSERT INTO public.taluks (id, organization_id, district_id, name)
VALUES ('84000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'Ownership taluk');
INSERT INTO public.schools (id, organization_id, district_id, taluk_id, name, code, created_by, owner_id)
VALUES ('85000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', 'Owned school', 'OWN-SCH', '81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001');
INSERT INTO public.screening_sessions (
  id, organization_id, district_id, taluk_id, school_id, name, beo_name,
  head_master_name, screening_faculty_name, screening_date, created_by, owner_id
)
VALUES ('86000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', 'Shared session', 'BEO', 'Head', 'Faculty', CURRENT_DATE, '81000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001');
INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
VALUES
  ('82000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000003'),
  ('82000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000004');

SELECT is(
  (SELECT count(*)::INTEGER FROM public.session_assignments WHERE session_id = '86000000-0000-0000-0000-000000000001'),
  2,
  'a screening session supports multiple enumerator assignments'
);
SELECT is(public.current_profile_is_active(), FALSE, 'no request identity is treated as active');
SELECT is(
  (SELECT count(*)::INTEGER FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active'),
  1,
  'profile activation is represented by a database column'
);

SELECT set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(public.current_profile_is_active(), TRUE, 'active profile helper recognizes an active administrator');
SELECT is(
  (SELECT count(*)::INTEGER FROM public.profiles WHERE id = '81000000-0000-0000-0000-000000000005'),
  1,
  'active administrator can read an inactive member profile to restore access'
);
SELECT lives_ok(
  $$INSERT INTO public.schools (organization_id, district_id, taluk_id, name, code, status)
    VALUES ('82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', 'New owned school', 'OWN-NEW', 'active')$$,
  'organization administrator can create a school without supplying owner or creator metadata'
);
SELECT is(
  (SELECT owner_id FROM public.schools WHERE code = 'OWN-NEW'),
  '81000000-0000-0000-0000-000000000001'::UUID,
  'school owner is set by the database from the authenticated identity'
);
SELECT is(
  (SELECT created_by FROM public.schools WHERE code = 'OWN-NEW'),
  '81000000-0000-0000-0000-000000000001'::UUID,
  'school creator attribution is set by the database from the authenticated identity'
);
SELECT throws_ok(
  $$UPDATE public.schools SET owner_id = '81000000-0000-0000-0000-000000000002' WHERE code = 'OWN-NEW'$$,
  '42501', NULL,
  'clients cannot change owner columns directly'
);
SELECT lives_ok(
  $$SELECT public.transfer_record_ownership('schools', '85000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002')$$,
  'an organization administrator can transfer ownership within the organization'
);
SELECT is(
  (SELECT owner_id FROM public.schools WHERE id = '85000000-0000-0000-0000-000000000001'),
  '81000000-0000-0000-0000-000000000002'::UUID,
  'ownership transfer updates only the owner field'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.audit_logs WHERE action = 'ownership_transferred' AND record_id = '85000000-0000-0000-0000-000000000001'),
  1,
  'ownership transfer writes an explicit audit event'
);
SELECT throws_ok(
  $$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
    VALUES ('82000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000005')$$,
  '42501', NULL,
  'an active administrator cannot assign an inactive enumerator'
);
SELECT lives_ok(
  $$SELECT public.set_profile_active('81000000-0000-0000-0000-000000000005', TRUE)$$,
  'an active organization administrator can activate a member account'
);
SELECT lives_ok(
  $$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
    VALUES ('82000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000005')$$,
  'an active enumerator can be assigned after administrator activation'
);
RESET ROLE;

SELECT is(
  (SELECT is_active FROM public.profiles WHERE id = '81000000-0000-0000-0000-000000000005'),
  TRUE,
  'administrator activation updates the profile status'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.audit_logs WHERE action = 'account_activated' AND record_id = '81000000-0000-0000-0000-000000000005'),
  1,
  'account activation writes an audit event'
);

UPDATE public.profiles SET is_active = FALSE WHERE id = '81000000-0000-0000-0000-000000000004';
SELECT set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::INTEGER FROM public.profiles WHERE id = '81000000-0000-0000-0000-000000000004'),
  0,
  'Viewer cannot read an inactive profile even in the same district'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000004', true);
SELECT set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(public.current_profile_is_active(), FALSE, 'inactive profile is rejected by the database helper');
SELECT is(public.current_profile_role(), NULL::TEXT, 'inactive profile has no effective database role');
SELECT is((SELECT count(*)::INTEGER FROM public.screening_sessions), 0, 'inactive enumerator cannot read assigned sessions');
SELECT is(
  (SELECT is_active FROM public.profiles WHERE id = auth.uid()),
  FALSE,
  'inactive user can read own status to receive a clear client-side sign-out'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000004', true);
SELECT set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.set_profile_active('81000000-0000-0000-0000-000000000001', FALSE)$$,
  '42501', NULL,
  'inactive user cannot activate or deactivate accounts'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
