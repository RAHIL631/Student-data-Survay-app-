BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('71000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'si-admin@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('71000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'si-enumerator-one@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('71000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'si-enumerator-two@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');
INSERT INTO public.organizations (id, name)
VALUES ('72000000-0000-0000-0000-000000000001', 'SI reservation test organization');
INSERT INTO public.districts (id, organization_id, name, code)
VALUES ('73000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'SI district', 'SI1');
INSERT INTO public.profiles (id, organization_id, district_id, email, full_name, role)
VALUES
  ('71000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', NULL, 'si-admin@example.test', 'SI Admin', 'organization_admin'),
  ('71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'si-enumerator-one@example.test', 'SI Enumerator One', 'enumerator'),
  ('71000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'si-enumerator-two@example.test', 'SI Enumerator Two', 'enumerator');
INSERT INTO public.taluks (id, organization_id, district_id, name)
VALUES ('74000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'SI taluk');
INSERT INTO public.schools (id, organization_id, district_id, taluk_id, name, code, created_by, owner_id)
VALUES ('75000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 'SI school', 'SI-SCHOOL', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001');
INSERT INTO public.screening_sessions (
  id, organization_id, district_id, taluk_id, school_id, name, beo_name,
  head_master_name, screening_faculty_name, screening_date, created_by, owner_id
)
VALUES ('76000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'SI session', 'BEO', 'Head', 'Faculty', CURRENT_DATE, '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001');
INSERT INTO public.session_assignments (organization_id, session_id, enumerator_id)
VALUES
  ('72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002'),
  ('72000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003');

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.student_si_reservations', 'SELECT'),
  'authenticated clients cannot read the internal SI reservation ledger directly'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.cleanup_expired_student_si_reservations()', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.cleanup_expired_student_si_reservations()', 'EXECUTE'),
  'only the service role can run SI reservation cleanup'
);

SELECT lives_ok(
  format(
    $sql$INSERT INTO public.student_screenings (
      id, organization_id, session_id, district_id, taluk_id, school_id,
      si_number, student_name, screening_date, si_reservation_id
    ) VALUES (
      '77000000-0000-0000-0000-000000000001',
      '72000000-0000-0000-0000-000000000001',
      '76000000-0000-0000-0000-000000000001',
      '73000000-0000-0000-0000-000000000001',
      '74000000-0000-0000-0000-000000000001',
      '75000000-0000-0000-0000-000000000001',
      'SI-100', 'Reserved SI student', CURRENT_DATE, %L
    )$sql$,
    public.reserve_student_si_number(
      '76000000-0000-0000-0000-000000000001', 'SI-100',
      '78000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001'
    )
  ),
  'assigned enumerator can reserve and create a student screening with an SI number'
);

SELECT is(
  public.reserve_student_si_number('76000000-0000-0000-0000-000000000001', 'SI-100', '78000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001'),
  public.reserve_student_si_number('76000000-0000-0000-0000-000000000001', 'SI-100', '78000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000001'),
  'repeated reservation calls with the same key return the same reservation'
);

SELECT throws_ok(
  $$UPDATE public.student_screenings SET si_number = 'SI-101'
    WHERE id = '77000000-0000-0000-0000-000000000001'$$,
  '42501', NULL,
  'changing an SI number without a reservation is rejected'
);

SELECT lives_ok(
  format(
    $sql$UPDATE public.student_screenings
        SET si_number = 'SI-101', si_reservation_id = %L
      WHERE id = '77000000-0000-0000-0000-000000000001'$sql$,
    public.reserve_student_si_number(
      '76000000-0000-0000-0000-000000000001', 'SI-101',
      '78000000-0000-0000-0000-000000000002', '77000000-0000-0000-0000-000000000001'
    )
  ),
  'assigned owner can reserve a replacement SI number while editing a screening'
);
RESET ROLE;

SELECT is(
  (SELECT si_number FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000001'),
  'SI-101',
  'the edited SI number is saved'
);
SELECT is(
  (SELECT owner_id FROM public.student_screenings WHERE id = '77000000-0000-0000-0000-000000000001'),
  '71000000-0000-0000-0000-000000000002'::UUID,
  'student ownership is set to the authenticated creator'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.student_si_reservations WHERE si_number = 'SI-101' AND consumed_at IS NOT NULL),
  1,
  'consumed SI reservation is retained for idempotent retry tracking'
);

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.reserve_student_si_number(
      '76000000-0000-0000-0000-000000000001', 'SI-101',
      '78000000-0000-0000-0000-000000000003', NULL
    )$$,
  '23505', NULL,
  'another assigned enumerator cannot reserve a number already saved in the organization'
);
SELECT throws_ok(
  $$SELECT public.reserve_student_si_number(
      '76000000-0000-0000-0000-000000000001', 'SI-102',
      '78000000-0000-0000-0000-000000000004', '77000000-0000-0000-0000-000000000001'
    )$$,
  '42501', NULL,
  'another assigned enumerator cannot reserve an SI edit on a record they do not own'
);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT public.reserve_student_si_number(
  '76000000-0000-0000-0000-000000000001', 'SI-EXPIRED',
  '78000000-0000-0000-0000-000000000005', NULL
);
RESET ROLE;
UPDATE public.student_si_reservations
SET expires_at = now() - interval '1 second'
WHERE si_number = 'SI-EXPIRED';
SELECT set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.reserve_student_si_number(
      '76000000-0000-0000-0000-000000000001', 'SI-EXPIRED',
      '78000000-0000-0000-0000-000000000006', NULL
    )$$,
  'a different active enumerator can claim an expired reservation'
);
RESET ROLE;
SELECT is(
  (SELECT requested_by FROM public.student_si_reservations WHERE si_number = 'SI-EXPIRED'),
  '71000000-0000-0000-0000-000000000003'::UUID,
  'expired reservation reassignment updates the requester'
);

SELECT * FROM finish();
ROLLBACK;
