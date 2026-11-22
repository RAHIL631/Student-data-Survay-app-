BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('71000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'viewer-admin@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('71000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'viewer-manager@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('71000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'viewer-faculty-one@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('71000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'viewer-faculty-two@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');
INSERT INTO public.organizations (id, name)
VALUES ('72000000-0000-0000-0000-000000000001', 'Viewer access test organization');
INSERT INTO public.districts (id, organization_id, name, code)
VALUES
  ('73000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Viewer district', 'V1'),
  ('73000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', 'Other district', 'V2');
INSERT INTO public.profiles (id, organization_id, district_id, email, full_name, role)
VALUES
  ('71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', NULL, 'viewer-admin@example.test', 'Viewer Test Admin', 'organization_admin'),
  ('71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'viewer-manager@example.test', 'Viewer Test Manager', 'district_manager'),
  ('71000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'viewer-faculty-one@example.test', 'Viewer Faculty One', 'enumerator'),
  ('71000000-0000-0000-0000-000000000004', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', 'viewer-faculty-two@example.test', 'Viewer Faculty Two', 'enumerator');
INSERT INTO public.taluks (id, organization_id, district_id, name)
VALUES
  ('74000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'Viewer taluk'),
  ('74000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', 'Other taluk');
INSERT INTO public.schools (id, organization_id, district_id, taluk_id, name, code, created_by, owner_id)
VALUES
  ('75000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 'Viewer school', 'V-SCH', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001'),
  ('75000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000002', 'Other school', 'V-SCH-2', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001');
INSERT INTO public.screening_sessions (
  id, organization_id, district_id, taluk_id, school_id, name, beo_name,
  head_master_name, screening_faculty_name, screening_date, created_by, owner_id
)
VALUES
  ('76000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'Granted session', 'BEO', 'Head', 'Faculty One', CURRENT_DATE, '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003'),
  ('76000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000002', 'Unshared session', 'BEO', 'Head', 'Faculty Two', CURRENT_DATE, '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000004');
INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
VALUES
  ('72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003'),
  ('72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000004');
INSERT INTO public.student_screenings (
  id, organization_id, session_id, district_id, taluk_id, school_id, si_number,
  student_name, class_name, section, sex, date_of_birth, age, height_cm, weight_kg,
  bmi, created_by, owner_id
)
VALUES
  ('77000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'VIEWER-TEST-1', 'Viewer Grant Student', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003'),
  ('77000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000002', 'VIEWER-TEST-2', 'Unshared Student', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000004');

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(public.set_owner_data_grant('71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000003', TRUE), TRUE, 'administrator grants same-district faculty records to viewer');
SELECT is(public.set_owner_data_grant('71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000003', TRUE), TRUE, 'repeated grant is idempotent');
SELECT is((SELECT count(*)::INTEGER FROM public.owner_data_grants), 1, 'idempotent grant creates one row');
SELECT throws_ok($$SELECT public.set_owner_data_grant('71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000004', TRUE)$$, '42501', NULL, 'administrator cannot grant cross-district faculty data');
SELECT throws_ok($$INSERT INTO public.owner_data_grants (organization_id, viewer_id, owner_id, created_by) VALUES ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000001')$$, '42501', NULL, 'direct grant table writes are denied');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::INTEGER FROM public.screening_sessions WHERE id = '76000000-0000-0000-0000-000000000001'), 1, 'viewer can read an admin-created session assigned to granted faculty');
SELECT is((SELECT count(*)::INTEGER FROM public.screening_sessions WHERE id = '76000000-0000-0000-0000-000000000002'), 0, 'viewer cannot read ungranted session in another district');
SELECT is((SELECT count(*)::INTEGER FROM public.session_assignments WHERE session_id = '76000000-0000-0000-0000-000000000001'), 1, 'viewer can read assignments for granted faculty session');
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000001'), 1, 'viewer can read granted faculty screening');
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000002'), 0, 'viewer cannot read ungranted faculty screening');
SELECT is((SELECT count(*)::INTEGER FROM public.owner_data_grants), 1, 'viewer can read own active grant');
SELECT throws_ok($$INSERT INTO public.screening_sessions (organization_id, district_id, taluk_id, school_id, name, beo_name, head_master_name, screening_faculty_name, screening_date) VALUES ('72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'Viewer write blocked', 'BEO', 'Head', 'Faculty', CURRENT_DATE)$$, '42501', NULL, 'viewer cannot create sessions');
SELECT lives_ok($$UPDATE public.student_screenings SET student_name = 'Viewer write blocked' WHERE id = '77000000-0000-0000-0000-000000000001'$$, 'viewer update request is safely filtered by RLS');
SELECT is((SELECT student_name FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000001'), 'Viewer Grant Student', 'viewer cannot change screening data');
SELECT throws_ok($$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id) VALUES ('72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003')$$, '42501', NULL, 'viewer cannot create assignments');
SELECT is((SELECT count(*)::INTEGER FROM public.audit_logs), 0, 'viewer cannot read audit logs');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(public.set_owner_data_grant('71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000003', FALSE), TRUE, 'administrator revokes viewer grant');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::INTEGER FROM public.screening_sessions WHERE id = '76000000-0000-0000-0000-000000000001'), 0, 'revoked viewer access no longer exposes session');
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000001'), 0, 'revoked viewer access no longer exposes screening');
SELECT * FROM finish();
ROLLBACK;
