BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT no_plan();

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@owner-test.example', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'viewer@owner-test.example', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'owner-one@owner-test.example', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'owner-two@owner-test.example', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

INSERT INTO public.organizations (id, name)
VALUES ('10000000-0000-0000-0000-000000000001', 'Owner scope test organization');

INSERT INTO public.districts (id, organization_id, name, code)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'District One', 'D1'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'District Two', 'D2');

INSERT INTO public.profiles (id, organization_id, email, full_name, role, district_id)
VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin@owner-test.example', 'Admin', 'organization_admin', NULL),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'viewer@owner-test.example', 'Viewer', 'district_manager', '20000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'owner-one@owner-test.example', 'Owner One', 'enumerator', '20000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'owner-two@owner-test.example', 'Owner Two', 'enumerator', '20000000-0000-0000-0000-000000000002');

INSERT INTO public.taluks (id, organization_id, district_id, name)
VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Taluk One'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Taluk Two');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

INSERT INTO public.schools (organization_id, district_id, taluk_id, name, code)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'School One',
  'S1'
)
RETURNING set_config('test.school_one_id', id::TEXT, true);
INSERT INTO public.schools (organization_id, district_id, taluk_id, name, code)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  'School Two',
  'S2'
)
RETURNING set_config('test.school_two_id', id::TEXT, true);
SELECT public.assign_school_owner(
  current_setting('test.school_one_id')::UUID,
  '00000000-0000-0000-0000-000000000003'
);
SELECT public.assign_school_owner(
  current_setting('test.school_two_id')::UUID,
  '00000000-0000-0000-0000-000000000004'
);

INSERT INTO public.screening_sessions (
  organization_id, district_id, taluk_id, school_id, name, beo_name,
  head_master_name, screening_faculty_name, screening_date
)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  current_setting('test.school_one_id')::UUID,
  'Session One',
  'BEO',
  'Head One',
  'Faculty One',
  CURRENT_DATE
)
RETURNING set_config('test.session_one_id', id::TEXT, true);
INSERT INTO public.screening_sessions (
  organization_id, district_id, taluk_id, school_id, name, beo_name,
  head_master_name, screening_faculty_name, screening_date
)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  current_setting('test.school_two_id')::UUID,
  'Session Two',
  'BEO',
  'Head Two',
  'Faculty Two',
  CURRENT_DATE
)
RETURNING set_config('test.session_two_id', id::TEXT, true);

SELECT set_config(
  'test.student_one_key',
  '60000000-0000-0000-0000-000000000001',
  true
);
SELECT set_config(
  'test.student_one_si',
  public.reserve_student_si_number(
    current_setting('test.session_one_id')::UUID,
    '60000000-0000-0000-0000-000000000001'
  ),
  true
);
SELECT set_config(
  'test.student_two_key',
  '60000000-0000-0000-0000-000000000002',
  true
);
SELECT set_config(
  'test.student_two_si',
  public.reserve_student_si_number(
    current_setting('test.session_two_id')::UUID,
    '60000000-0000-0000-0000-000000000002'
  ),
  true
);

INSERT INTO public.student_screenings (
  id, organization_id, session_id, district_id, taluk_id, school_id, si_number,
  student_name, class_name, section, sex, date_of_birth, age, height_cm,
  weight_kg, bmi, screening_date, status
)
VALUES
  (current_setting('test.student_one_key')::UUID, '10000000-0000-0000-0000-000000000001', current_setting('test.session_one_id')::UUID, '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_setting('test.school_one_id')::UUID, current_setting('test.student_one_si'), 'Student One', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, CURRENT_DATE, 'Pending'),
  (current_setting('test.student_two_key')::UUID, '10000000-0000-0000-0000-000000000001', current_setting('test.session_two_id')::UUID, '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', current_setting('test.school_two_id')::UUID, current_setting('test.student_two_si'), 'Student Two', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, CURRENT_DATE, 'Pending');

INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
VALUES ('10000000-0000-0000-0000-000000000001', current_setting('test.session_one_id')::UUID, '00000000-0000-0000-0000-000000000003');

SELECT public.set_owner_data_grant(
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  TRUE
);

SELECT set_config(
  'test.viewer_insert_key',
  '60000000-0000-0000-0000-000000000003',
  true
);
SELECT set_config(
  'test.viewer_insert_si',
  public.reserve_student_si_number(
    current_setting('test.session_one_id')::UUID,
    '60000000-0000-0000-0000-000000000003'
  ),
  true
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT ok(
  public.can_view_owner_data('00000000-0000-0000-0000-000000000003'),
  'viewer can read data from an explicitly granted owner'
);
SELECT ok(
  NOT public.can_view_owner_data('00000000-0000-0000-0000-000000000004'),
  'viewer cannot read data from an ungranted owner'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.districts WHERE id = '20000000-0000-0000-0000-000000000001'),
  1,
  'viewer can read master data for their district'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.districts WHERE id = '20000000-0000-0000-0000-000000000002'),
  0,
  'viewer cannot read another district master data'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.screening_sessions WHERE id = current_setting('test.session_one_id')::UUID),
  1,
  'viewer can read a granted screening session'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.screening_sessions WHERE id = current_setting('test.session_two_id')::UUID),
  0,
  'viewer cannot read an ungranted screening session'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.student_screenings WHERE id = current_setting('test.student_one_key')::UUID),
  1,
  'viewer can read a screening record owned by a granted faculty member'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.student_screenings WHERE id = current_setting('test.student_two_key')::UUID),
  0,
  'viewer cannot read a screening record owned by an ungranted faculty member'
);

UPDATE public.screening_sessions
SET status = 'completed'
WHERE id = current_setting('test.session_one_id')::UUID;
UPDATE public.student_screenings
SET additional_remarks = 'Viewer write attempt'
WHERE id = current_setting('test.student_one_key')::UUID;
SELECT throws_ok(
  $$INSERT INTO public.student_screenings (
      id, organization_id, session_id, district_id, taluk_id, school_id, si_number,
      student_name, class_name, section, sex, date_of_birth, age, height_cm,
      weight_kg, bmi, screening_date, status
    )
    VALUES (
      current_setting('test.viewer_insert_key')::UUID,
      '10000000-0000-0000-0000-000000000001',
      current_setting('test.session_one_id')::UUID,
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      current_setting('test.school_one_id')::UUID,
      current_setting('test.viewer_insert_si'),
      'Viewer Insert Attempt', '5', 'A', 'Other', '2015-01-01', 10, 130, 30,
      17.75, CURRENT_DATE, 'Pending'
    )$$,
  '42501',
  NULL,
  'viewer cannot insert a screening record'
);
SELECT throws_ok(
  $$DELETE FROM public.student_screenings WHERE id = current_setting('test.student_one_key')::UUID$$,
  '42501',
  NULL,
  'viewer cannot delete a screening record'
);
SELECT throws_ok(
  $$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
    VALUES ('10000000-0000-0000-0000-000000000001', current_setting('test.session_two_id')::UUID, '00000000-0000-0000-0000-000000000004')$$,
  '42501',
  NULL,
  'viewer cannot assign screening faculty'
);
DELETE FROM public.session_assignments
WHERE session_id = current_setting('test.session_one_id')::UUID;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT status FROM public.screening_sessions WHERE id = current_setting('test.session_one_id')::UUID),
  'active',
  'viewer update cannot change screening session status'
);
SELECT is(
  (SELECT additional_remarks IS NULL FROM public.student_screenings WHERE id = current_setting('test.student_one_key')::UUID),
  TRUE,
  'viewer update cannot change student data'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.student_screenings),
  2,
  'administrator can read both owners records'
);
SELECT is(
  (SELECT owner_id FROM public.student_screenings WHERE id = current_setting('test.student_one_key')::UUID),
  '00000000-0000-0000-0000-000000000003'::UUID,
  'student owner is inherited from the screening session'
);
SELECT is(
  (SELECT owner_id FROM public.student_screenings WHERE id = current_setting('test.student_two_key')::UUID),
  '00000000-0000-0000-0000-000000000004'::UUID,
  'each student record keeps its own session owner'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.session_assignments WHERE session_id = current_setting('test.session_one_id')::UUID),
  1,
  'viewer cannot delete screening assignments'
);
SELECT throws_ok(
  $$UPDATE public.student_screenings
    SET owner_id = '00000000-0000-0000-0000-000000000004'
    WHERE id = current_setting('test.student_one_key')::UUID$$,
  '42501',
  NULL,
  'authenticated clients cannot change record ownership'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
