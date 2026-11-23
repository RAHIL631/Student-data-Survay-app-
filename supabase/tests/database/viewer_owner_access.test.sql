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
  ('71000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'viewer-faculty-two@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('71000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'viewer-faculty-other-district@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('71000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'viewer-faculty-other-org@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');
INSERT INTO public.organizations (id, name)
VALUES
  ('72000000-0000-0000-0000-000000000001', 'Viewer access test organization'),
  ('72000000-0000-0000-0000-000000000002', 'Other organization');
INSERT INTO public.districts (id, organization_id, name, code)
VALUES
  ('73000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'Viewer district', 'V1'),
  ('73000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', 'Other district', 'V2'),
  ('73000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000002', 'Other organization district', 'O1');
INSERT INTO public.profiles (id, organization_id, district_id, email, full_name, role)
VALUES
  ('71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', NULL, 'viewer-admin@example.test', 'Viewer Test Admin', 'organization_admin'),
  ('71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'viewer-manager@example.test', 'Viewer Test Manager', 'district_manager'),
  ('71000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'viewer-faculty-one@example.test', 'Viewer Faculty One', 'enumerator'),
  ('71000000-0000-0000-0000-000000000004', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'viewer-faculty-two@example.test', 'Viewer Faculty Two', 'enumerator'),
  ('71000000-0000-0000-0000-000000000005', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', 'viewer-faculty-other-district@example.test', 'Other District Faculty', 'enumerator'),
  ('71000000-0000-0000-0000-000000000006', '72000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000003', 'viewer-faculty-other-org@example.test', 'Other Organization Faculty', 'enumerator');
INSERT INTO public.taluks (id, organization_id, district_id, name)
VALUES
  ('74000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'Viewer taluk'),
  ('74000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', 'Other taluk'),
  ('74000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000003', 'Other organization taluk');
INSERT INTO public.schools (id, organization_id, district_id, taluk_id, name, code, created_by, owner_id)
VALUES
  ('75000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 'Viewer school', 'V-SCH', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001'),
  ('75000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000002', 'Other school', 'V-SCH-2', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001'),
  ('75000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000003', 'Other organization school', 'O-SCH', '71000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000006');
INSERT INTO public.screening_sessions (
  id, organization_id, district_id, taluk_id, school_id, name, beo_name,
  head_master_name, screening_faculty_name, screening_date, created_by, owner_id
)
VALUES
  ('76000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'Shared district session', 'BEO', 'Head', 'Faculty One and Two', CURRENT_DATE, '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001'),
  ('76000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000002', 'Other district session', 'BEO', 'Head', 'Other District Faculty', CURRENT_DATE, '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001'),
  ('76000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000003', '75000000-0000-0000-0000-000000000003', 'Other organization session', 'BEO', 'Head', 'Other Organization Faculty', CURRENT_DATE, '71000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000006');
INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
VALUES
  ('72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003'),
  ('72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000004'),
  ('72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000005'),
  ('72000000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000006');
INSERT INTO public.student_screenings (
  id, organization_id, session_id, district_id, taluk_id, school_id, si_number,
  student_name, class_name, section, sex, date_of_birth, age, height_cm, weight_kg,
  bmi, created_by, owner_id
)
VALUES
  ('77000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'VIEWER-TEST-1', 'Viewer Grant Student', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003'),
  ('77000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'VIEWER-TEST-2', 'Un-granted Faculty Student', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000004'),
  ('77000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000002', 'VIEWER-TEST-3', 'Other District Student', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000005'),
  ('77000000-0000-0000-0000-000000000004', '72000000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000003', '73000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000003', '75000000-0000-0000-0000-000000000003', 'VIEWER-TEST-4', 'Other Organization Student', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, '71000000-0000-0000-0000-000000000006', '71000000-0000-0000-0000-000000000006');

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::INTEGER FROM public.screening_sessions), 2, 'organization administrator retains access to organization sessions');
SELECT is((SELECT count(*)::INTEGER FROM public.session_assignments), 3, 'organization administrator retains access to organization assignments');
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings), 3, 'organization administrator retains access to organization screenings');
SELECT is(public.set_owner_data_grant('71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000003', TRUE), TRUE, 'administrator grants same-district faculty records to viewer');
SELECT is(public.set_owner_data_grant('71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000003', TRUE), TRUE, 'repeated grant is idempotent');
SELECT is((SELECT count(*)::INTEGER FROM public.owner_data_grants), 1, 'idempotent grant creates one row');
SELECT throws_ok($$SELECT public.set_owner_data_grant('71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000005', TRUE)$$, '42501', NULL, 'administrator cannot grant cross-district faculty data');
SELECT throws_ok($$SELECT public.set_owner_data_grant('71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000006', TRUE)$$, '42501', NULL, 'administrator cannot grant cross-organization faculty data');
SELECT throws_ok($$INSERT INTO public.owner_data_grants (organization_id, viewer_id, owner_id, created_by) VALUES ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000001')$$, '42501', NULL, 'direct grant table writes are denied');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::INTEGER FROM public.screening_sessions WHERE id = '76000000-0000-0000-0000-000000000001'), 1, 'viewer can read an admin-created session assigned to granted faculty');
SELECT is((SELECT count(*)::INTEGER FROM public.screening_sessions WHERE id = '76000000-0000-0000-0000-000000000002'), 0, 'viewer cannot read ungranted session in another district');
SELECT is((SELECT count(*)::INTEGER FROM public.screening_sessions WHERE id = '76000000-0000-0000-0000-000000000003'), 0, 'viewer cannot read a session in another organization');
SELECT is((SELECT count(*)::INTEGER FROM public.session_assignments WHERE session_id = '76000000-0000-0000-0000-000000000001' AND enumerator_id = '71000000-0000-0000-0000-000000000003'), 1, 'viewer can read the explicitly granted faculty assignment');
SELECT is((SELECT count(*)::INTEGER FROM public.session_assignments WHERE session_id = '76000000-0000-0000-0000-000000000001' AND enumerator_id = '71000000-0000-0000-0000-000000000004'), 0, 'viewer cannot read an ungranted faculty assignment in the same session');
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000001'), 1, 'viewer can read granted faculty screening');
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000002'), 0, 'viewer cannot read ungranted faculty screening in the same session');
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000003'), 0, 'viewer cannot read ungranted screening in another district');
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000004'), 0, 'viewer cannot read screening in another organization');
SELECT is((SELECT count(*)::INTEGER FROM public.owner_data_grants), 1, 'viewer can read own active grant');
SELECT is((SELECT count(*)::INTEGER FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000003'), 1, 'viewer can read the explicitly granted active enumerator profile');
SELECT is((SELECT count(*)::INTEGER FROM public.profiles WHERE id = '71000000-0000-0000-0000-000000000004'), 0, 'viewer cannot read an ungranted enumerator profile in the same district');
SELECT throws_ok($$INSERT INTO public.screening_sessions (organization_id, district_id, taluk_id, school_id, name, beo_name, head_master_name, screening_faculty_name, screening_date) VALUES ('72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'Viewer write blocked', 'BEO', 'Head', 'Faculty', CURRENT_DATE)$$, '42501', NULL, 'viewer cannot create sessions');
SELECT throws_ok($$INSERT INTO public.student_screenings (organization_id, session_id, district_id, taluk_id, school_id, si_number, student_name, class_name, section, sex, date_of_birth, age, height_cm, weight_kg, bmi, created_by) VALUES ('72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'VIEWER-INSERT-BLOCKED', 'Viewer Insert Blocked', '5', 'A', 'Other', '2015-01-01', 10, 130, 30, 17.75, '71000000-0000-0000-0000-000000000002')$$, '42501', NULL, 'viewer cannot insert screenings');
SELECT lives_ok($$UPDATE public.student_screenings SET student_name = 'Viewer write blocked' WHERE id = '77000000-0000-0000-0000-000000000001'$$, 'viewer update request is safely filtered by RLS');
SELECT is((SELECT student_name FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000001'), 'Viewer Grant Student', 'viewer cannot change screening data');
SELECT throws_ok($$DELETE FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000001'$$, '42501', NULL, 'viewer cannot delete screenings');
SELECT throws_ok($$INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id) VALUES ('72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002')$$, '42501', NULL, 'viewer cannot create assignments');
SELECT throws_ok($$UPDATE public.session_assignments SET enumerator_id = '71000000-0000-0000-0000-000000000004' WHERE session_id = '76000000-0000-0000-0000-000000000001' AND enumerator_id = '71000000-0000-0000-0000-000000000003'$$, '42501', NULL, 'viewer cannot update assignments');
SELECT lives_ok($$DELETE FROM public.session_assignments WHERE session_id = '76000000-0000-0000-0000-000000000001' AND enumerator_id = '71000000-0000-0000-0000-000000000003'$$, 'viewer delete request for an assignment is filtered by RLS');
SELECT is((SELECT count(*)::INTEGER FROM public.session_assignments WHERE session_id = '76000000-0000-0000-0000-000000000001' AND enumerator_id = '71000000-0000-0000-0000-000000000003'), 1, 'viewer cannot delete an assignment');
SELECT is((SELECT count(*)::INTEGER FROM public.audit_logs), 0, 'viewer cannot read audit logs');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(public.set_profile_active('71000000-0000-0000-0000-000000000002', FALSE), TRUE, 'administrator can deactivate the Viewer');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::INTEGER FROM public.screening_sessions WHERE id = '76000000-0000-0000-0000-000000000001'), 0, 'inactive Viewer cannot read granted session');
SELECT is((SELECT count(*)::INTEGER FROM public.session_assignments WHERE session_id = '76000000-0000-0000-0000-000000000001'), 0, 'inactive Viewer cannot read assignments');
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000001'), 0, 'inactive Viewer cannot read granted screening');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(public.set_profile_active('71000000-0000-0000-0000-000000000002', TRUE), TRUE, 'administrator can reactivate the Viewer');
SELECT is(public.set_profile_active('71000000-0000-0000-0000-000000000003', FALSE), TRUE, 'administrator can deactivate granted faculty');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::INTEGER FROM public.screening_sessions WHERE id = '76000000-0000-0000-0000-000000000001'), 0, 'inactive granted faculty cannot keep session visible');
SELECT is((SELECT count(*)::INTEGER FROM public.session_assignments WHERE session_id = '76000000-0000-0000-0000-000000000001' AND enumerator_id = '71000000-0000-0000-0000-000000000003'), 0, 'inactive granted faculty assignment is hidden');
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000001'), 0, 'inactive granted faculty screening is hidden');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(public.set_profile_active('71000000-0000-0000-0000-000000000003', TRUE), TRUE, 'administrator can reactivate granted faculty');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(public.set_owner_data_grant('71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000003', FALSE), TRUE, 'administrator revokes viewer grant');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::INTEGER FROM public.screening_sessions WHERE id = '76000000-0000-0000-0000-000000000001'), 0, 'revoking the only grant removes session visibility');
SELECT is((SELECT count(*)::INTEGER FROM public.session_assignments WHERE session_id = '76000000-0000-0000-0000-000000000001' AND enumerator_id = '71000000-0000-0000-0000-000000000003'), 0, 'revoking a grant removes that faculty assignment access');
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000001'), 0, 'revoking a grant removes that faculty screening access');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings WHERE id IN ('77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000002')), 2, 'organization administrator retains access to both same-session screenings');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::INTEGER FROM public.student_screenings WHERE session_id = '76000000-0000-0000-0000-000000000001'), 2, 'Enumerator retains access to screenings in the assigned session');
SELECT is((SELECT count(*)::INTEGER FROM public.session_assignments WHERE session_id = '76000000-0000-0000-0000-000000000001' AND enumerator_id = auth.uid()), 1, 'Enumerator retains access to their own session assignment');
SELECT * FROM finish();
ROLLBACK;
