BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES (
  '91000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
  'created-by-admin@example.test', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
);
INSERT INTO public.organizations (id, name)
VALUES ('92000000-0000-0000-0000-000000000001', 'Created-by test organization');
INSERT INTO public.districts (id, organization_id, name, code)
VALUES (
  '93000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001', 'Created-by district', 'CB1'
);
INSERT INTO public.profiles (id, organization_id, email, full_name, role)
VALUES (
  '91000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  'created-by-admin@example.test', 'Created-by Admin', 'organization_admin'
);
INSERT INTO public.taluks (id, organization_id, district_id, name)
VALUES (
  '94000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001', 'Created-by taluk'
);
INSERT INTO public.schools (id, organization_id, district_id, taluk_id, name, code)
VALUES (
  '95000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001', 'Created-by school', 'CB-SCHOOL'
);

SELECT is(
  has_column_privilege('authenticated', 'public.screening_sessions', 'created_by', 'INSERT'),
  FALSE,
  'authenticated clients cannot supply screening session creator attribution'
);
SELECT is(
  has_column_privilege('authenticated', 'public.student_screenings', 'created_by', 'INSERT'),
  FALSE,
  'authenticated clients cannot supply screening creator attribution'
);
SELECT is(
  has_function_privilege('authenticated', 'public.guard_created_by_attribution()', 'EXECUTE'),
  FALSE,
  'authenticated clients cannot call the trigger function directly'
);

SELECT set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

INSERT INTO public.screening_sessions (
  organization_id, district_id, taluk_id, school_id, name, beo_name,
  head_master_name, screening_faculty_name, screening_date
)
VALUES (
  '92000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001',
  'Created-by session', 'BEO', 'Head', 'Faculty', CURRENT_DATE
);
INSERT INTO public.student_screenings (
  organization_id, session_id, district_id, taluk_id, school_id, screening_date
)
VALUES (
  '92000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.screening_sessions WHERE name = 'Created-by session'),
  '93000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000001', CURRENT_DATE
);

SELECT is(
  (SELECT created_by FROM public.screening_sessions
   WHERE name = 'Created-by session'),
  '91000000-0000-0000-0000-000000000001'::uuid,
  'database trigger sets session creator to the authenticated user'
);
SELECT is(
  (SELECT created_by FROM public.student_screenings
   WHERE session_id = (SELECT id FROM public.screening_sessions WHERE name = 'Created-by session')),
  '91000000-0000-0000-0000-000000000001'::uuid,
  'database trigger sets screening creator to the authenticated user'
);
SELECT throws_ok(
  $$UPDATE public.screening_sessions
    SET created_by = '91000000-0000-0000-0000-000000000002'
    WHERE name = 'Created-by session'$$,
  '42501', NULL,
  'authenticated clients cannot change session creator attribution'
);
SELECT throws_ok(
  $$UPDATE public.student_screenings
    SET created_by = '91000000-0000-0000-0000-000000000002'
    WHERE session_id = (SELECT id FROM public.screening_sessions WHERE name = 'Created-by session')$$,
  '42501', NULL,
  'authenticated clients cannot change screening creator attribution'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
