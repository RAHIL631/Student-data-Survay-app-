BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(108);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@rls-test.example', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'manager-one@rls-test.example', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'manager-two@rls-test.example', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'enumerator-one@rls-test.example', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'enumerator-two@rls-test.example', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'enumerator-three@rls-test.example', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'admin-b@rls-test.example', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'enumerator-b@rls-test.example', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

INSERT INTO public.organizations (id, name)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'RLS test organization A'),
  ('10000000-0000-0000-0000-000000000002', 'RLS test organization B');

INSERT INTO public.districts (id, organization_id, name, code)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'District One', 'D1'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'District Two', 'D2'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'District B', 'DB');

INSERT INTO public.profiles (id, organization_id, email, full_name, role, district_id)
VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin@rls-test.example', 'Admin', 'organization_admin', NULL),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'manager-one@rls-test.example', 'Manager One', 'district_manager', '20000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'manager-two@rls-test.example', 'Manager Two', 'district_manager', '20000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'enumerator-one@rls-test.example', 'Enumerator One', 'enumerator', '20000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'enumerator-two@rls-test.example', 'Enumerator Two', 'enumerator', '20000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'enumerator-three@rls-test.example', 'Enumerator Three', 'enumerator', '20000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'admin-b@rls-test.example', 'Admin B', 'organization_admin', NULL),
  ('00000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', 'enumerator-b@rls-test.example', 'Enumerator B', 'enumerator', '20000000-0000-0000-0000-000000000003');

INSERT INTO public.taluks (id, organization_id, district_id, name)
VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Taluk One'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Taluk Two'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'Taluk B');

INSERT INTO public.schools (id, organization_id, district_id, taluk_id, name, code)
VALUES
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'School One', 'S1'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'School Two', 'S2'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'School B', 'SB');

INSERT INTO public.screening_sessions (
  id, organization_id, district_id, taluk_id, school_id, name, beo_name,
  head_master_name, screening_faculty_name, screening_date, created_by
)
VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Session One', 'BEO', 'Head One', 'Faculty One', CURRENT_DATE, '00000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'Session Two', 'BEO', 'Head Two', 'Faculty Two', CURRENT_DATE, '00000000-0000-0000-0000-000000000003'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'Session B', 'BEO', 'Head B', 'Faculty B', CURRENT_DATE, '00000000-0000-0000-0000-000000000007');

INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
VALUES
  ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006'),
  ('10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000008');

INSERT INTO public.student_screenings (
  id, organization_id, session_id, district_id, taluk_id, school_id, si_number,
  student_name, class_name, section, sex, date_of_birth, age, height_cm,
  weight_kg, bmi, created_by
)
VALUES
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'RLS-A-1', 'Student A1', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, '00000000-0000-0000-0000-000000000006'),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'RLS-A-2', 'Student A2', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, '00000000-0000-0000-0000-000000000005'),
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'RLS-B-1', 'Student B1', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, '00000000-0000-0000-0000-000000000008');

SELECT throws_ok(
  $$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
    VALUES ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000006')$$,
  '42501',
  NULL,
  'assignment scope trigger rejects an assignment that mixes organizations'
);

INSERT INTO public.audit_logs (id, organization_id, district_id, action, record_type)
VALUES
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'update', 'policy_fixture'),
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'update', 'policy_fixture'),
  ('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', NULL, 'update', 'policy_fixture'),
  ('70000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', 'update', 'policy_fixture');

INSERT INTO public.student_screenings (
  id, organization_id, session_id, district_id, taluk_id, school_id, si_number,
  student_name, class_name, section, sex, date_of_birth, age, height_cm,
  weight_kg, bmi, created_by
)
VALUES
  ('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'RLS-A-4', 'Student A4', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, '00000000-0000-0000-0000-000000000006'),
  ('60000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'RLS-A-5', 'Student A5', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, '00000000-0000-0000-0000-000000000006');

SELECT is(
  (SELECT district_id FROM public.audit_logs
   WHERE record_type = 'student_screenings'
     AND record_id = '60000000-0000-0000-0000-000000000001'
     AND action = 'insert'
   LIMIT 1),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'screening insert audit event records its district'
);
UPDATE public.student_screenings
SET session_id = '50000000-0000-0000-0000-000000000002',
    district_id = '20000000-0000-0000-0000-000000000002',
    taluk_id = '30000000-0000-0000-0000-000000000002',
    school_id = '40000000-0000-0000-0000-000000000002'
WHERE id = '60000000-0000-0000-0000-000000000004';
SELECT ok(
  (SELECT district_id IS NULL FROM public.audit_logs
   WHERE record_type = 'student_screenings'
     AND record_id = '60000000-0000-0000-0000-000000000004'
     AND action = 'update'
   LIMIT 1),
  'district-changing screening audit event has unknown ownership'
);
DELETE FROM public.student_screenings
WHERE id = '60000000-0000-0000-0000-000000000004';
SELECT is(
  (SELECT district_id FROM public.audit_logs
   WHERE record_type = 'student_screenings'
     AND record_id = '60000000-0000-0000-0000-000000000004'
     AND action = 'delete'
   LIMIT 1),
  '20000000-0000-0000-0000-000000000002'::uuid,
  'screening delete audit event captures OLD district ownership'
);
DELETE FROM public.student_screenings
WHERE id = '60000000-0000-0000-0000-000000000005';
SELECT is(
  (SELECT district_id FROM public.audit_logs
   WHERE record_type = 'student_screenings'
     AND record_id = '60000000-0000-0000-0000-000000000005'
     AND action = 'delete'
   LIMIT 1),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'ordinary screening delete retains its district'
);

SELECT throws_ok(
  $$DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000006'$$,
  '23503',
  NULL,
  'profile deletion is restricted while screenings retain its creator'
);
SELECT is(
  (SELECT created_by FROM public.student_screenings WHERE id = '60000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-000000000006'::uuid,
  'restricted profile deletion preserves screening creator'
);

INSERT INTO public.districts (id, organization_id, name, code)
VALUES ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Delete Test District', 'D4');
SELECT lives_ok(
  $$DELETE FROM public.districts WHERE id = '20000000-0000-0000-0000-000000000004'$$,
  'district deletion does not break audit logging'
);
SELECT is(
  (SELECT district_id FROM public.audit_logs
   WHERE record_type = 'districts'
     AND record_id = '20000000-0000-0000-0000-000000000004'
     AND action = 'delete'
   LIMIT 1),
  '20000000-0000-0000-0000-000000000004'::uuid,
  'district delete audit event preserves deleted district identifier'
);

INSERT INTO public.screening_sessions (
  id, organization_id, district_id, taluk_id, school_id, name, beo_name,
  head_master_name, screening_faculty_name, screening_date, created_by
)
VALUES
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Cascade Test Session', 'BEO', 'Head', 'Faculty', CURRENT_DATE, '00000000-0000-0000-0000-000000000001');
INSERT INTO public.session_assignments (id, organization_id, session_id, enumerator_id)
VALUES ('90000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004');
SELECT lives_ok(
  $$DELETE FROM public.screening_sessions WHERE id = '50000000-0000-0000-0000-000000000004'$$,
  'session cascade deletes assignments without breaking audit logging'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs
   WHERE record_type = 'session_assignments'
     AND record_id = '90000000-0000-0000-0000-000000000002'
     AND action = 'delete'),
  1,
  'assignment cascade produces an audit event'
);
SELECT is(
  (SELECT district_id FROM public.audit_logs
   WHERE record_type = 'session_assignments'
     AND record_id = '90000000-0000-0000-0000-000000000002'
     AND action = 'delete'
   LIMIT 1),
  NULL::uuid,
  'cascade assignment audit ownership remains unknown when session is deleted'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::integer FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000004'),
  1,
  'district manager can read enumerators in their district'
);
SELECT is(
  (SELECT count(*)::integer FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000005'),
  0,
  'district manager cannot read profiles in another district'
);
SELECT is(
  (SELECT count(*)::integer FROM public.districts WHERE id = '20000000-0000-0000-0000-000000000001'),
  1,
  'district manager can read their own district'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE id = '70000000-0000-0000-0000-000000000001'),
  0,
  'viewer cannot read audit logs'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE id = '70000000-0000-0000-0000-000000000002'),
  0,
  'district manager cannot read another district audit logs'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE id = '70000000-0000-0000-0000-000000000003'),
  0,
  'district manager cannot read historical audit logs with unknown ownership'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE id = '70000000-0000-0000-0000-000000000004'),
  0,
  'district manager cannot read another organization audit logs'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs
   WHERE record_type = 'session_assignments'
     AND record_id = '90000000-0000-0000-0000-000000000002'
     AND action = 'delete'),
  0,
  'district manager cannot read cascade assignment audit with unknown ownership'
);
SELECT is(
  (SELECT count(*)::integer FROM public.districts WHERE id = '20000000-0000-0000-0000-000000000002'),
  0,
  'district manager cannot read another district'
);
SELECT is(
  (SELECT count(*)::integer FROM public.taluks WHERE id = '30000000-0000-0000-0000-000000000002'),
  0,
  'district manager cannot read another district taluks'
);
SELECT is(
  (SELECT count(*)::integer FROM public.schools WHERE id = '40000000-0000-0000-0000-000000000002'),
  0,
  'district manager cannot read another district schools'
);
SELECT is(
  (SELECT count(*)::integer FROM public.screening_sessions WHERE id = '50000000-0000-0000-0000-000000000001'),
  0,
  'viewer cannot read sessions without an explicit owner grant'
);
SELECT is(
  (SELECT count(*)::integer FROM public.screening_sessions WHERE id = '50000000-0000-0000-0000-000000000002'),
  0,
  'district manager cannot read sessions in another district'
);
SELECT is(
  (SELECT count(*)::integer FROM public.student_screenings WHERE id = '60000000-0000-0000-0000-000000000001'),
  0,
  'viewer cannot read screenings without an explicit owner grant'
);
SELECT is(
  (SELECT count(*)::integer FROM public.student_screenings WHERE id = '60000000-0000-0000-0000-000000000002'),
  0,
  'district manager cannot read screenings in another district'
);
SELECT is(
  (SELECT count(*)::integer FROM public.districts WHERE id = '20000000-0000-0000-0000-000000000003'),
  0,
  'district manager cannot read another organization district'
);
SELECT is(
  (SELECT count(*)::integer FROM public.screening_sessions WHERE id = '50000000-0000-0000-0000-000000000003'),
  0,
  'district manager cannot read another organization session'
);
SELECT is(
  (SELECT count(*)::integer FROM public.student_screenings WHERE id = '60000000-0000-0000-0000-000000000003'),
  0,
  'district manager cannot read another organization screening'
);
SELECT is(
  (SELECT count(*)::integer FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000007'),
  0,
  'district manager cannot read another organization profile'
);
SELECT is(
  (SELECT count(*)::integer FROM public.taluks WHERE id = '30000000-0000-0000-0000-000000000003'),
  0,
  'district manager cannot read another organization taluk'
);
SELECT is(
  (SELECT count(*)::integer FROM public.schools WHERE id = '40000000-0000-0000-0000-000000000003'),
  0,
  'district manager cannot read another organization school'
);
SELECT is(
  (SELECT count(*)::integer FROM public.session_assignments WHERE organization_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'district manager cannot read another organization assignment'
);
UPDATE public.screening_sessions
SET status = 'completed'
WHERE id = '50000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT status FROM public.screening_sessions WHERE id = '50000000-0000-0000-0000-000000000001'),
  NULL,
  'viewer cannot see or update an ungranted session'
);
UPDATE public.student_screenings
SET additional_remarks = 'Reviewed by district manager'
WHERE id = '60000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT additional_remarks FROM public.student_screenings WHERE id = '60000000-0000-0000-0000-000000000001'),
  NULL,
  'viewer cannot see or update an ungranted screening'
);
SELECT throws_ok(
  $$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
    VALUES ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006')$$,
  '42501',
  NULL,
  'district manager cannot assign enumerators to another district session'
);
SELECT throws_ok(
  $$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
    VALUES ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005')$$,
  '42501',
  NULL,
  'district manager cannot assign an enumerator from another district to their own district session'
);
SELECT throws_ok(
  $$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
    VALUES ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004')$$,
  '42501', NULL,
  'viewer cannot assign enumerators'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.audit_logs l
    JOIN public.session_assignments a ON a.id = l.record_id
    WHERE l.record_type = 'session_assignments'
      AND l.action = 'insert'
      AND l.district_id = '20000000-0000-0000-0000-000000000001'
      AND a.session_id = '50000000-0000-0000-0000-000000000001'
      AND a.enumerator_id = '00000000-0000-0000-0000-000000000004'
  ),
  'viewer cannot read assignment audit events'
);
DELETE FROM public.session_assignments
WHERE session_id = '50000000-0000-0000-0000-000000000002';
RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM public.session_assignments
   WHERE session_id = '50000000-0000-0000-0000-000000000002'),
  1,
  'district manager cannot delete assignments from another district'
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
    VALUES ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005')$$,
  '42501', NULL,
  'district manager cannot create an assignment across district boundaries'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
DELETE FROM public.session_assignments
WHERE session_id = '50000000-0000-0000-0000-000000000001'
  AND enumerator_id = '00000000-0000-0000-0000-000000000004';
RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM public.session_assignments
   WHERE session_id = '50000000-0000-0000-0000-000000000001'
     AND enumerator_id = '00000000-0000-0000-0000-000000000004'),
  0,
  'district manager can delete an assignment within their district'
);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
UPDATE public.screening_sessions
SET status = 'cancelled'
WHERE id = '50000000-0000-0000-0000-000000000002';
RESET ROLE;
SELECT is(
  (SELECT status FROM public.screening_sessions WHERE id = '50000000-0000-0000-0000-000000000002'),
  'active',
  'district manager cannot update a session in another district'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT is(auth.uid(), '00000000-0000-0000-0000-000000000001'::UUID, 'organization administrator JWT is active for the API test');
SELECT is(public.current_profile_is_active(), TRUE, 'organization administrator profile is active');
SELECT is(public.current_profile_organization_id(), '10000000-0000-0000-0000-000000000001'::UUID, 'organization administrator profile resolves the expected organization');
SELECT is(
  (SELECT count(*)::integer FROM public.districts),
  2,
  'organization admin can read all districts in their organization'
);
SELECT is(
  (SELECT count(*)::integer FROM public.profiles),
  6,
  'organization admin can read all profiles in their organization'
);
SELECT is(
  (SELECT count(*)::integer FROM public.screening_sessions),
  2,
  'organization admin can read all sessions in their organization'
);
SELECT is(
  (SELECT count(*)::integer FROM public.student_screenings),
  2,
  'organization admin can read all screenings in their organization'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs
   WHERE record_type = 'policy_fixture'
     AND organization_id = '10000000-0000-0000-0000-000000000001'),
  3,
  'organization admin can read own-organization audit logs including unknown ownership'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE id = '70000000-0000-0000-0000-000000000004'),
  0,
  'organization admin cannot read another organization audit logs'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE id = '70000000-0000-0000-0000-000000000003'),
  1,
  'organization admin can read historical audit logs with unknown ownership'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs
   WHERE record_type = 'session_assignments'
     AND record_id = '90000000-0000-0000-0000-000000000002'
     AND action = 'delete'),
  1,
  'organization admin can read cascade assignment audit with unknown ownership'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.audit_logs l
    WHERE l.record_type = 'session_assignments'
      AND l.action = 'insert'
      AND l.district_id = '20000000-0000-0000-0000-000000000001'
  ),
  'organization administrator can read correctly scoped assignment audit events'
);
SELECT is(
  (SELECT count(*)::integer FROM public.districts WHERE id = '20000000-0000-0000-0000-000000000003'),
  0,
  'organization admin cannot read another organization district'
);
SELECT is(
  (SELECT count(*)::integer FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000007'),
  0,
  'organization admin cannot read another organization profile'
);
SELECT is(
  (SELECT count(*)::integer FROM public.screening_sessions WHERE id = '50000000-0000-0000-0000-000000000003'),
  0,
  'organization admin cannot read another organization session'
);
SELECT is(
  (SELECT count(*)::integer FROM public.student_screenings WHERE id = '60000000-0000-0000-0000-000000000003'),
  0,
  'organization admin cannot read another organization screening'
);
SELECT is(
  (SELECT count(*)::integer FROM public.organizations WHERE id = '10000000-0000-0000-0000-000000000002'),
  0,
  'organization admin cannot read another organization'
);
SELECT is(
  (SELECT count(*)::integer FROM public.session_assignments WHERE organization_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'organization admin cannot read another organization assignment'
);
SELECT lives_ok(
  $$INSERT INTO public.districts (organization_id, name, code)
    VALUES ('10000000-0000-0000-0000-000000000001', 'District Three', 'D3')$$,
  'organization admin can create a district in their organization'
);
SELECT throws_ok(
  $$INSERT INTO public.districts (organization_id, name, code)
    VALUES ('10000000-0000-0000-0000-000000000002', 'Unauthorized District', 'DX')$$,
  '42501',
  NULL,
  'organization admin cannot create a district in another organization'
);
UPDATE public.profiles
SET full_name = 'Updated Manager One'
WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT is(
  (SELECT full_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002'),
  'Updated Manager One',
  'organization admin can update a profile in their organization'
);
SELECT lives_ok(
  $$INSERT INTO public.screening_sessions (
      organization_id, district_id, taluk_id, school_id, name, beo_name,
      head_master_name, screening_faculty_name, screening_date
    )
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      'Admin-created session', 'BEO', 'Head', 'Faculty', CURRENT_DATE
    )$$,
  'organization admin can create a session in their organization'
);
SELECT lives_ok(
  $$INSERT INTO public.student_screenings (
      organization_id, session_id, district_id, taluk_id, school_id, si_number,
      student_name, class_name, section, sex, date_of_birth, age, height_cm,
      weight_kg, bmi
    )
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000002',
      NULL, 'Admin-created screening', '5', 'A', 'Other',
      '2015-01-01', 10, 130, 30, 17.75
    )$$,
  'organization admin can create a screening in their organization'
);
SELECT lives_ok(
  $$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
    VALUES ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004')$$,
  'organization admin can create an assignment in their organization'
);
SELECT lives_ok(
  $$DELETE FROM public.session_assignments
    WHERE session_id = '50000000-0000-0000-0000-000000000001'
      AND enumerator_id = '00000000-0000-0000-0000-000000000004'$$,
  'organization admin can delete an assignment in their organization'
);
SELECT is(
  (SELECT count(*)::integer FROM public.session_assignments
   WHERE session_id = '50000000-0000-0000-0000-000000000001'
     AND enumerator_id = '00000000-0000-0000-0000-000000000004'),
  0,
  'organization admin deletion removes the selected assignment'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.audit_logs
          WHERE record_type = 'session_assignments'
            AND action = 'delete'
            AND district_id = '20000000-0000-0000-0000-000000000001'),
  'assignment delete audit event records its district'
);
INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
VALUES ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004');
SELECT throws_ok(
  $$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
    VALUES ('10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000008')$$,
  '42501',
  NULL,
  'organization admin cannot create an assignment in another organization'
);
UPDATE public.screening_sessions
SET status = 'completed'
WHERE id = '50000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT status FROM public.screening_sessions WHERE id = '50000000-0000-0000-0000-000000000001'),
  'completed',
  'organization admin can update a session in their organization'
);
SELECT throws_ok(
  $$INSERT INTO public.profiles (id, organization_id, email, full_name, role)
    VALUES ('00000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'new@rls-test.example', 'New Profile', 'enumerator')$$,
  '42501',
  NULL,
  'organization admin cannot insert profiles through the granted table operations'
);

UPDATE public.screening_sessions
SET status = 'completed'
WHERE id = '50000000-0000-0000-0000-000000000003';
RESET ROLE;
SELECT is(
  (SELECT status FROM public.screening_sessions WHERE id = '50000000-0000-0000-0000-000000000003'),
  'active',
  'organization admin cannot modify another organization session'
);
SET LOCAL ROLE authenticated;
UPDATE public.profiles
SET full_name = 'Unauthorized update'
WHERE id = '00000000-0000-0000-0000-000000000007';
RESET ROLE;
SELECT is(
  (SELECT full_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000007'),
  'Admin B',
  'organization admin cannot modify another organization profile'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::integer FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000004'),
  1,
  'enumerator can read their own profile'
);
SELECT is(
  (SELECT count(*)::integer FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000005'),
  0,
  'enumerator cannot read another profile'
);
SELECT is(
  (SELECT count(*)::integer FROM public.audit_logs WHERE record_type = 'policy_fixture'),
  0,
  'enumerator cannot read audit logs'
);
SELECT is(
  (SELECT count(*)::integer FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000007'),
  0,
  'enumerator cannot read another organization profile'
);
SELECT is(
  (SELECT count(*)::integer FROM public.organizations WHERE id = '10000000-0000-0000-0000-000000000002'),
  0,
  'enumerator cannot read another organization'
);
SELECT is(
  (SELECT count(*)::integer FROM public.districts),
  1,
  'enumerator can read only the district of assigned sessions'
);
SELECT is(
  (SELECT count(*)::integer FROM public.taluks),
  1,
  'enumerator can read taluks in their district'
);
SELECT is(
  (SELECT count(*)::integer FROM public.schools),
  1,
  'enumerator can read schools in their district'
);
SELECT is(
  (SELECT count(*)::integer FROM public.districts WHERE id = '20000000-0000-0000-0000-000000000002'),
  0,
  'enumerator cannot read a different-district location'
);
SELECT is(
  (SELECT count(*)::integer FROM public.taluks WHERE id = '30000000-0000-0000-0000-000000000002'),
  0,
  'enumerator cannot read a different-district taluk'
);
SELECT is(
  (SELECT count(*)::integer FROM public.schools WHERE id = '40000000-0000-0000-0000-000000000002'),
  0,
  'enumerator cannot read a different-district school'
);
SELECT is(
  (SELECT count(*)::integer FROM public.districts WHERE id = '20000000-0000-0000-0000-000000000003'),
  0,
  'enumerator cannot read another organization district'
);
SELECT is(
  (SELECT count(*)::integer FROM public.taluks WHERE id = '30000000-0000-0000-0000-000000000003'),
  0,
  'enumerator cannot read another organization taluk'
);
SELECT is(
  (SELECT count(*)::integer FROM public.schools WHERE id = '40000000-0000-0000-0000-000000000003'),
  0,
  'enumerator cannot read another organization school'
);
SELECT is(
  (SELECT count(*)::integer FROM public.screening_sessions WHERE id = '50000000-0000-0000-0000-000000000001'),
  1,
  'enumerator can read an assigned session'
);
SELECT is(
  (SELECT count(*)::integer FROM public.screening_sessions WHERE id = '50000000-0000-0000-0000-000000000002'),
  0,
  'enumerator cannot read an unassigned session'
);
SELECT is(
  (SELECT count(*)::integer FROM public.screening_sessions WHERE id = '50000000-0000-0000-0000-000000000003'),
  0,
  'enumerator cannot read another organization session'
);
SELECT is(
  (SELECT count(*)::integer FROM public.session_assignments WHERE enumerator_id = '00000000-0000-0000-0000-000000000004'),
  1,
  'enumerator can read their own assignment'
);
SELECT is(
  (SELECT count(*)::integer FROM public.session_assignments WHERE enumerator_id = '00000000-0000-0000-0000-000000000006'),
  0,
  'enumerator cannot read another enumerators assignment'
);
SELECT is(
  (SELECT count(*)::integer FROM public.session_assignments WHERE organization_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'enumerator cannot read another organization assignment'
);
SELECT is(
  (SELECT count(*)::integer FROM public.student_screenings WHERE id = '60000000-0000-0000-0000-000000000001'),
  1,
  'enumerator can read screenings in an assigned session'
);
SELECT is(
  (SELECT count(*)::integer FROM public.student_screenings WHERE id = '60000000-0000-0000-0000-000000000002'),
  0,
  'enumerator cannot read screenings in an unassigned session'
);
SELECT is(
  (SELECT count(*)::integer FROM public.student_screenings WHERE id = '60000000-0000-0000-0000-000000000003'),
  0,
  'enumerator cannot read another organization screening'
);
SELECT lives_ok(
  $$INSERT INTO public.student_screenings (
      organization_id, session_id, district_id, taluk_id, school_id, si_number,
      student_name, class_name, section, sex, date_of_birth, age, height_cm,
      weight_kg, bmi
    )
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      NULL, 'Enumerator-created screening', '5', 'A', 'Other',
      '2015-01-01', 10, 130, 30, 17.75
    )$$,
  'enumerator can create a screening in an assigned session'
);
SELECT throws_ok(
  $$INSERT INTO public.student_screenings (
      organization_id, session_id, district_id, taluk_id, school_id, si_number,
      student_name, class_name, section, sex, date_of_birth, age, height_cm,
      weight_kg, bmi
    )
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000002',
      'RLS-ENUM-UNASSIGNED', 'Unassigned screening', '5', 'A', 'Other',
      '2015-01-01', 10, 130, 30, 17.75
    )$$,
  '42501',
  NULL,
  'enumerator cannot create a screening in an unassigned session'
);
SELECT throws_ok(
  $$INSERT INTO public.student_screenings (
      organization_id, session_id, district_id, taluk_id, school_id, si_number,
      student_name, class_name, section, sex, date_of_birth, age, height_cm,
      weight_kg, bmi
    )
    VALUES (
      '10000000-0000-0000-0000-000000000002',
      '50000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000003',
      '30000000-0000-0000-0000-000000000003',
      '40000000-0000-0000-0000-000000000003',
      'RLS-ENUM-CROSS-ORG', 'Cross-organization screening', '5', 'A', 'Other',
      '2015-01-01', 10, 130, 30, 17.75
    )$$,
  '42501',
  NULL,
  'enumerator cannot insert a screening into another organization'
);
SELECT throws_ok(
  $$INSERT INTO public.screening_sessions (
      organization_id, district_id, taluk_id, school_id, name, beo_name,
      head_master_name, screening_faculty_name, screening_date
    )
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      'Enumerator-created session', 'BEO', 'Head', 'Faculty', CURRENT_DATE
    )$$,
  '42501',
  NULL,
  'enumerator cannot create screening sessions'
);
UPDATE public.student_screenings
SET student_name = 'Unauthorized enumerator update'
WHERE id = '60000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT is(
  (SELECT student_name FROM public.student_screenings WHERE id = '60000000-0000-0000-0000-000000000001'),
  'Student A1',
  'enumerator cannot update screening records'
);
SET LOCAL ROLE authenticated;
UPDATE public.profiles
SET full_name = 'Unauthorized enumerator update'
WHERE id = '00000000-0000-0000-0000-000000000004';
RESET ROLE;
SELECT is(
  (SELECT full_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000004'),
  'Enumerator One',
  'enumerator cannot update their profile under the current RLS policy'
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
    VALUES ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004')$$,
  '42501',
  NULL,
  'enumerator cannot insert assignments'
);
DELETE FROM public.session_assignments
WHERE session_id = '50000000-0000-0000-0000-000000000001'
  AND enumerator_id = '00000000-0000-0000-0000-000000000006';
RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM public.session_assignments
   WHERE session_id = '50000000-0000-0000-0000-000000000001'
     AND enumerator_id = '00000000-0000-0000-0000-000000000006'),
  1,
  'enumerator cannot delete assignments'
);
SET LOCAL ROLE authenticated;
DELETE FROM public.session_assignments
WHERE session_id = '50000000-0000-0000-0000-000000000001'
  AND enumerator_id = '00000000-0000-0000-0000-000000000004';
RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM public.session_assignments
   WHERE session_id = '50000000-0000-0000-0000-000000000001'
     AND enumerator_id = '00000000-0000-0000-0000-000000000004'),
  1,
  'enumerator cannot delete their own assignment'
);

SELECT * FROM finish();
ROLLBACK;
