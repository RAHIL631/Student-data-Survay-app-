BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
 ('91000000-0000-0000-0000-000000000001','authenticated','authenticated','write-admin@example.test','',now(),now(),now(),'{}','{}'),
 ('91000000-0000-0000-0000-000000000002','authenticated','authenticated','write-enum-a@example.test','',now(),now(),now(),'{}','{}'),
 ('91000000-0000-0000-0000-000000000003','authenticated','authenticated','write-enum-b@example.test','',now(),now(),now(),'{}','{}'),
 ('91000000-0000-0000-0000-000000000004','authenticated','authenticated','write-viewer@example.test','',now(),now(),now(),'{}','{}'),
 ('91000000-0000-0000-0000-000000000005','authenticated','authenticated','write-inactive@example.test','',now(),now(),now(),'{}','{}');
INSERT INTO public.organizations (id, name) VALUES
 ('92000000-0000-0000-0000-000000000001','Write RPC org'),
 ('92000000-0000-0000-0000-000000000002','Write RPC other org');
INSERT INTO public.districts (id, organization_id, name, code) VALUES
 ('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','Write district','WR'),
 ('93000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000001','Other district','WR2'),
 ('93000000-0000-0000-0000-000000000003','92000000-0000-0000-0000-000000000002','Other org district','WR3');
INSERT INTO public.profiles (id, organization_id, district_id, email, full_name, role, is_active) VALUES
 ('91000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001',NULL,'write-admin@example.test','Write Admin','organization_admin',TRUE),
 ('91000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','write-enum-a@example.test','Write Enum A','enumerator',TRUE),
 ('91000000-0000-0000-0000-000000000003','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','write-enum-b@example.test','Write Enum B','enumerator',TRUE),
 ('91000000-0000-0000-0000-000000000004','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','write-viewer@example.test','Write Viewer','district_manager',TRUE),
 ('91000000-0000-0000-0000-000000000005','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','write-inactive@example.test','Inactive Enum','enumerator',FALSE);
INSERT INTO public.taluks (id, organization_id, district_id, name) VALUES
 ('94000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','Write taluk'),
 ('94000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000002','Other taluk'),
 ('94000000-0000-0000-0000-000000000003','92000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000003','Other org taluk');
INSERT INTO public.schools (id, organization_id, district_id, taluk_id, name, code, created_by, owner_id) VALUES
 ('95000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001','Write school','W-SCH','91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001'),
 ('95000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000002','Other school','W-SCH2','91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001'),
 ('95000000-0000-0000-0000-000000000003','92000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000003','94000000-0000-0000-0000-000000000003','Other org school','W-SCH3','91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001');

SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',TRUE);
SELECT set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',TRUE);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.create_school_secure('{"district_id":"93000000-0000-0000-0000-000000000001","taluk_id":"94000000-0000-0000-0000-000000000001","name":"RPC School","code":"RPC-SCH"}'::jsonb)$$,'active organization administrator can create a same-organization school');
SELECT throws_ok($$SELECT public.create_school_secure('{"district_id":"93000000-0000-0000-0000-000000000003","taluk_id":"94000000-0000-0000-0000-000000000003","name":"Cross Org","code":"X-SCH"}'::jsonb)$$,'42501',NULL,'administrator cannot create a school in another organization');
SELECT lives_ok($$SELECT public.create_screening_session_secure('{"school_id":"95000000-0000-0000-0000-000000000001","name":"RPC session A","beo_name":"BEO","head_master_name":"Head","screening_faculty_name":"Faculty A","screening_date":"2026-11-23"}'::jsonb)$$,'active administrator can create a session for an active organization school');
SELECT is((SELECT created_by FROM public.screening_sessions WHERE name='RPC session A'),'91000000-0000-0000-0000-000000000001'::uuid,'session creator is derived from auth.uid');
SELECT is((SELECT owner_id FROM public.screening_sessions WHERE name='RPC session A'),'91000000-0000-0000-0000-000000000001'::uuid,'session owner is set by the existing trigger');
SELECT throws_ok($$SELECT public.create_screening_session_secure('{"school_id":"95000000-0000-0000-0000-000000000003","name":"Cross org session","beo_name":"BEO","head_master_name":"Head","screening_faculty_name":"Faculty","screening_date":"2026-11-23"}'::jsonb)$$,'42501',NULL,'administrator cannot create a session for another organization school');
RESET ROLE;

INSERT INTO public.screening_sessions (id, organization_id, district_id, taluk_id, school_id, name, beo_name, head_master_name, screening_faculty_name, screening_date, created_by, owner_id)
VALUES
 ('96000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001','95000000-0000-0000-0000-000000000001','Enum A session','BEO','Head','A','2026-11-23','91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001'),
 ('96000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001','95000000-0000-0000-0000-000000000001','Enum B session','BEO','Head','B','2026-11-23','91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001'),
 ('96000000-0000-0000-0000-000000000003','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000002','94000000-0000-0000-0000-000000000002','95000000-0000-0000-0000-000000000002','Other district session','BEO','Head','Other','2026-11-23','91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001');
INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id) VALUES
 ('92000000-0000-0000-0000-000000000001','96000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002'),
 ('92000000-0000-0000-0000-000000000001','96000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000003');

SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',TRUE);
SELECT set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',TRUE);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.create_student_screening_secure('97000000-0000-0000-0000-000000000006','{"session_id":"96000000-0000-0000-0000-000000000001","student_name":"Admin Created","class_name":"5","section":"A"}',NULL)$$,'active organization administrator can create a screening in their organization');
SELECT lives_ok($$SELECT public.update_student_screening_secure('97000000-0000-0000-0000-000000000006','{"student_name":"Admin Edited","si_number":null}',NULL)$$,'active organization administrator can update organization screening');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',TRUE);
SELECT set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}',TRUE);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.create_student_screening_secure('97000000-0000-0000-0000-000000000001','{"session_id":"96000000-0000-0000-0000-000000000001","si_number":"RPC-SI-1","student_name":"RPC Student A","class_name":"5","section":"A","sex":"Other","date_of_birth":"2015-01-01","age":11,"height_cm":130,"weight_kg":30,"bmi":17.75,"skeletal_deformity":"No","skin_thickness_mm":0,"mid_arm_circumference_cm":0,"screening_date":"2026-11-23"}'::jsonb,public.reserve_student_si_number('96000000-0000-0000-0000-000000000001','RPC-SI-1','98000000-0000-0000-0000-000000000001','97000000-0000-0000-0000-000000000001'))$$,'assigned enumerator creates screening after SI reservation');
SELECT is((SELECT created_by FROM public.student_screenings WHERE id='97000000-0000-0000-0000-000000000001'),'91000000-0000-0000-0000-000000000002'::uuid,'screening creator is derived from authenticated identity');
SELECT is((SELECT owner_id FROM public.student_screenings WHERE id='97000000-0000-0000-0000-000000000001'),'91000000-0000-0000-0000-000000000002'::uuid,'screening owner is set by the existing trigger');
SELECT is((SELECT status FROM public.student_screenings WHERE id='97000000-0000-0000-0000-000000000001'),'Complete','database computes complete status for complete screening answers');
SELECT lives_ok($$SELECT public.update_student_screening_secure('97000000-0000-0000-0000-000000000001','{"si_number":"RPC-SI-1","student_name":"RPC Student A Edited","class_name":"5","section":"A","sex":"Other","date_of_birth":"2015-01-01","age":11,"height_cm":130,"weight_kg":30,"bmi":17.75,"skeletal_deformity":"No","skin_thickness_mm":0,"mid_arm_circumference_cm":0}',NULL)$$,'enumerator can update own screening while still assigned');
SELECT is((SELECT student_name FROM public.student_screenings WHERE id='97000000-0000-0000-0000-000000000001'),'RPC Student A Edited','secure update changes screening data');
SELECT throws_ok($$SELECT public.create_student_screening_secure('97000000-0000-0000-0000-000000000002','{"session_id":"96000000-0000-0000-0000-000000000002","student_name":"Unassigned","class_name":"5","section":"A","sex":"Other","date_of_birth":"2015-01-01","age":11,"height_cm":130,"weight_kg":30,"bmi":17.75}',NULL)$$,'42501',NULL,'enumerator cannot create screening in another enumerators unassigned session');
SELECT throws_ok($$SELECT public.create_student_screening_secure('97000000-0000-0000-0000-000000000003','{"session_id":"96000000-0000-0000-0000-000000000002","student_name":"Cross org","class_name":"5","section":"A","sex":"Other","date_of_birth":"2015-01-01","age":11,"height_cm":130,"weight_kg":30,"bmi":17.75}',NULL)$$,'42501',NULL,'enumerator cannot create screening in an unassigned session');
SELECT throws_ok($$SELECT public.create_student_screening_secure('97000000-0000-0000-0000-000000000007','{"session_id":"96000000-0000-0000-0000-000000000003","student_name":"Other district","class_name":"5","section":"A"}',NULL)$$,'42501',NULL,'enumerator cannot write screening in another district');
SELECT throws_ok($$SELECT public.create_student_screening_secure('97000000-0000-0000-0000-000000000004','{"session_id":"96000000-0000-0000-0000-000000000001","sex":"invalid"}',NULL)$$,'23514',NULL,'invalid screening values are rejected by table constraints');
SELECT lives_ok($$SELECT public.create_student_screening_secure('97000000-0000-0000-0000-000000000005','{"session_id":"96000000-0000-0000-0000-000000000001","student_name":"Incomplete","class_name":"5","section":"A"}',NULL)$$,'valid incomplete screening can be saved as Pending per existing workflow');
SELECT is((SELECT status FROM public.student_screenings WHERE id='97000000-0000-0000-0000-000000000005'),'Pending','incomplete screening remains Pending');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',TRUE);
SELECT set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}',TRUE);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.update_student_screening_secure('97000000-0000-0000-0000-000000000001','{"student_name":"Tampered","si_number":"RPC-SI-1"}',NULL)$$,'42501',NULL,'enumerator cannot modify another enumerators screening');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000004',TRUE);
SELECT set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000004","role":"authenticated"}',TRUE);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.create_school_secure('{"district_id":"93000000-0000-0000-0000-000000000001","taluk_id":"94000000-0000-0000-0000-000000000001","name":"Viewer","code":"VW"}'::jsonb)$$,'42501',NULL,'Viewer cannot create schools');
SELECT throws_ok($$SELECT public.create_screening_session_secure('{}'::jsonb)$$,'42501',NULL,'Viewer cannot create sessions');
SELECT throws_ok($$SELECT public.create_student_screening_secure(gen_random_uuid(),'{}'::jsonb,NULL)$$,'42501',NULL,'Viewer cannot create screenings');
SELECT throws_ok($$SELECT public.update_student_screening_secure('97000000-0000-0000-0000-000000000001','{"student_name":"Viewer edit"}'::jsonb,NULL)$$,'42501',NULL,'Viewer cannot update screenings');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000005',TRUE);
SELECT set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000005","role":"authenticated"}',TRUE);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.create_student_screening_secure(gen_random_uuid(),'{}'::jsonb,NULL)$$,'42501',NULL,'inactive account cannot write screenings');
SELECT throws_ok($$SELECT public.create_school_secure('{}'::jsonb)$$,'42501',NULL,'inactive account cannot write schools');
RESET ROLE;

SELECT is((SELECT count(*)::integer FROM public.audit_logs WHERE record_type='student_screenings' AND record_id='97000000-0000-0000-0000-000000000001'),'2'::integer,'screening create and edit both preserve existing audit triggers');
SELECT ok(NOT has_function_privilege('anon','public.create_student_screening_secure(uuid,jsonb,uuid)','EXECUTE'),'anon cannot execute secure screening RPC');
SELECT ok(has_function_privilege('authenticated','public.create_student_screening_secure(uuid,jsonb,uuid)','EXECUTE'),'authenticated can execute secure screening RPC');
SELECT * FROM finish();
ROLLBACK;
