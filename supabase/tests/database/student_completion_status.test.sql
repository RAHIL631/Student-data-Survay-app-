BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('81000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'status-one@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('81000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'status-two@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

INSERT INTO public.organizations (id, name)
VALUES ('82000000-0000-0000-0000-000000000001', 'Completion status test');

INSERT INTO public.districts (id, organization_id, name, code)
VALUES ('83000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'Status District', 'STATUS');

INSERT INTO public.profiles (id, organization_id, email, full_name, role, district_id)
VALUES
  ('81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'status-one@example.test', 'Status Enumerator One', 'enumerator', '83000000-0000-0000-0000-000000000001'),
  ('81000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000001', 'status-two@example.test', 'Status Enumerator Two', 'enumerator', '83000000-0000-0000-0000-000000000001');

INSERT INTO public.taluks (id, organization_id, district_id, name)
VALUES ('84000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'Status Taluk');

INSERT INTO public.schools (id, organization_id, district_id, taluk_id, name, code)
VALUES ('85000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', 'Status School', 'STATUS-SCHOOL');

INSERT INTO public.screening_sessions (
  id, organization_id, district_id, taluk_id, school_id, name, beo_name,
  head_master_name, screening_faculty_name, screening_date, created_by
)
VALUES (
  '86000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',
  '84000000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001',
  'Status Session', 'BEO', 'Head', 'Faculty', CURRENT_DATE,
  '81000000-0000-0000-0000-000000000001'
);

INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
VALUES (
  '82000000-0000-0000-0000-000000000001',
  '86000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001'
);

INSERT INTO public.student_screenings (
  id, organization_id, session_id, district_id, taluk_id, school_id, screening_date, created_by
)
VALUES (
  '87000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000001',
  '86000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',
  '84000000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001',
  CURRENT_DATE,
  '81000000-0000-0000-0000-000000000001'
);

SELECT is(
  (SELECT status FROM public.student_screenings WHERE id = '87000000-0000-0000-0000-000000000001'),
  'Pending',
  'a newly saved record without demographics or observations is pending'
);

UPDATE public.student_screenings
SET si_number = 'STATUS-1',
    student_name = 'Status Student',
    class_name = '5',
    section = 'A',
    sex = 'Other',
    date_of_birth = CURRENT_DATE - INTERVAL '10 years',
    age = EXTRACT(YEAR FROM age(CURRENT_DATE, (CURRENT_DATE - INTERVAL '10 years')::date))::integer,
    height_cm = 130,
    weight_kg = 30,
    bmi = 17.75,
    skeletal_deformity = 'No',
    skin_thickness_mm = 0,
    mid_arm_circumference_cm = 0
WHERE id = '87000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT status FROM public.student_screenings WHERE id = '87000000-0000-0000-0000-000000000001'),
  'Complete',
  'No with complete valid details is complete and zero measurements are not blank'
);

UPDATE public.student_screenings
SET skeletal_deformity = 'Not assessed'
WHERE id = '87000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT status FROM public.student_screenings WHERE id = '87000000-0000-0000-0000-000000000001'),
  'Pending',
  'Not assessed is always pending'
);

UPDATE public.student_screenings
SET skeletal_deformity = 'Yes',
    skeletal_observation = 'Observation recorded'
WHERE id = '87000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT status FROM public.student_screenings WHERE id = '87000000-0000-0000-0000-000000000001'),
  'Complete',
  'Yes with an observation and valid measurements is complete'
);

UPDATE public.student_screenings
SET skeletal_deformity = 'Suspected',
    skeletal_observation = 'Observation recorded',
    skin_thickness_mm = NULL
WHERE id = '87000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT status FROM public.student_screenings WHERE id = '87000000-0000-0000-0000-000000000001'),
  'Pending',
  'a missing mandatory measurement returns a complete record to pending'
);

UPDATE public.student_screenings
SET skin_thickness_mm = 4.2,
    mid_arm_circumference_cm = NULL
WHERE id = '87000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT status FROM public.student_screenings WHERE id = '87000000-0000-0000-0000-000000000001'),
  'Pending',
  'a missing mid-arm measurement keeps the record pending'
);

UPDATE public.student_screenings
SET mid_arm_circumference_cm = 18.5,
    skeletal_deformity = 'No',
    skeletal_observation = NULL
WHERE id = '87000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT status FROM public.student_screenings WHERE id = '87000000-0000-0000-0000-000000000001'),
  'Complete',
  'No does not require an additional observation'
);

UPDATE public.student_screenings
SET student_name = NULL
WHERE id = '87000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT status FROM public.student_screenings WHERE id = '87000000-0000-0000-0000-000000000001'),
  'Pending',
  'removing a required demographic returns the record to pending'
);
UPDATE public.student_screenings
SET student_name = 'Status Student'
WHERE id = '87000000-0000-0000-0000-000000000001';

SELECT set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE public.student_screenings
SET skeletal_deformity = 'Suspected',
    skeletal_observation = 'Updated observation'
WHERE id = '87000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT status FROM public.student_screenings WHERE id = '87000000-0000-0000-0000-000000000001'),
  'Complete',
  'an enumerator can update their own record in an assigned session'
);

SELECT set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE public.student_screenings
SET skeletal_deformity = 'Not assessed',
    skeletal_observation = NULL
WHERE id = '87000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT status FROM public.student_screenings WHERE id = '87000000-0000-0000-0000-000000000001'),
  'Complete',
  'an unassigned enumerator cannot update another enumerators screening'
);

SELECT * FROM finish();
ROLLBACK;
