BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT no_plan();

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'invite-admin@org-a.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'invite-manager-one@org-a.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'invite-manager-two@org-a.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated', 'invite-enumerator@org-a.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000105', 'authenticated', 'authenticated', 'invite-admin@org-b.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000109', 'authenticated', 'authenticated', 'auth-only@org-b.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

INSERT INTO public.organizations (id, name)
VALUES
  ('10000000-0000-0000-0000-000000000101', 'Invitation test organization A'),
  ('10000000-0000-0000-0000-000000000102', 'Invitation test organization B');

INSERT INTO public.districts (id, organization_id, name, code)
VALUES
  ('20000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000101', 'Invitation district one', 'I1'),
  ('20000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000101', 'Invitation district two', 'I2'),
  ('20000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-000000000102', 'Invitation district B', 'IB');

INSERT INTO public.profiles (id, organization_id, email, full_name, role, district_id)
VALUES
  ('00000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000101', 'invite-admin@org-a.test', 'Invitation Admin', 'organization_admin', NULL),
  ('00000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000101', 'invite-manager-one@org-a.test', 'Invitation Manager One', 'district_manager', '20000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-000000000101', 'invite-manager-two@org-a.test', 'Invitation Manager Two', 'district_manager', '20000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-000000000101', 'invite-enumerator@org-a.test', 'Invitation Enumerator', 'enumerator', '20000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000105', '10000000-0000-0000-0000-000000000102', 'invite-admin@org-b.test', 'Invitation Admin B', 'organization_admin', NULL);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);

SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    '  District.Manager@Invite.Test  ', 'district_manager',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000101'
  )),
  'created',
  'organization admin can invite a district manager in their organization'
);
SELECT is(
  (SELECT email FROM public.user_invitations
   WHERE email = 'district.manager@invite.test'),
  'district.manager@invite.test',
  'invitation email is normalized'
);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'district.manager@invite.test', 'district_manager',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000101'
  )),
  'existing',
  'same inviter and exact idempotency payload returns existing operation'
);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'different@invite.test', 'district_manager',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000101'
  )),
  'conflict',
  'reusing idempotency key with changed payload returns generic conflict'
);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'district.manager@invite.test', 'district_manager',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000112'
  )),
  'conflict',
  'different idempotency key cannot create another active invitation for the same normalized email'
);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'enumerator-two@invite.test', 'enumerator',
    '20000000-0000-0000-0000-000000000102',
    '90000000-0000-0000-0000-000000000102'
  )),
  'created',
  'organization admin can invite an enumerator in another district of their organization'
);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'admin-enumerator-one@invite.test', 'enumerator',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000117'
  )),
  'created',
  'organization admin can invite an enumerator in the first district'
);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'invite-admin@org-a.test', 'enumerator',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000103'
  )),
  'conflict',
  'existing profile email is rejected without disclosing account details'
);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'auth-only@org-b.test', 'enumerator',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000113'
  )),
  'created',
  'profile-less existing Auth account can be invited without replacing its Auth identity'
);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'not-an-email', 'enumerator',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000119'
  )),
  'invalid_request',
  'malformed invitation data gets a safe actionable result code'
);
SELECT set_config(
  'test.invite_other_district_id',
  (SELECT id::TEXT FROM public.user_invitations WHERE email = 'enumerator-two@invite.test'),
  true
);
SELECT set_config(
  'test.admin_district_enumerator_id',
  (SELECT id::TEXT FROM public.user_invitations
   WHERE email = 'admin-enumerator-one@invite.test'),
  true
);
SELECT throws_ok(
  $$SELECT * FROM public.request_user_invitation(
    'cross-org@invite.test', 'enumerator',
    '20000000-0000-0000-0000-000000000103',
    '90000000-0000-0000-0000-000000000104'
  )$$,
  '22023',
  NULL,
  'invalid cross-organization district is reported distinctly'
);
SELECT throws_ok(
  $$SELECT * FROM public.request_user_invitation(
    'missing-district@invite.test', 'enumerator',
    '20000000-0000-0000-0000-000000000199',
    '90000000-0000-0000-0000-000000000120'
  )$$,
  '22023',
  NULL,
  'nonexistent district is rejected without creating an invitation'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}', true);

SELECT throws_ok(
  $$SELECT * FROM public.request_user_invitation(
    'enumerator-one@invite.test', 'enumerator',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000105'
  )$$,
  '42501',
  NULL,
  'viewer cannot create an enumerator invitation'
);
SELECT throws_ok(
  $$SELECT * FROM public.request_user_invitation(
    'enumerator-outside@invite.test', 'enumerator',
    '20000000-0000-0000-0000-000000000102',
    '90000000-0000-0000-0000-000000000106'
  )$$,
  '42501',
  NULL,
  'district manager cannot invite enumerator in another district'
);
SELECT throws_ok(
  $$SELECT * FROM public.request_user_invitation(
    'manager-outside@invite.test', 'district_manager',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000107'
  )$$,
  '42501',
  NULL,
  'district manager cannot invite another district manager'
);

SELECT is(
  (SELECT count(*)::INTEGER FROM public.user_invitations
   WHERE district_id = '20000000-0000-0000-0000-000000000101'),
  3,
  'viewer history includes invitations in their district, including an existing Auth user'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.user_invitations
   WHERE district_id = '20000000-0000-0000-0000-000000000102'),
  0,
  'district manager history hides other district invitations'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.user_invitations),
  3,
  'viewer cannot read other-district or other-organization invitations'
);
SELECT is(
  public.cancel_user_invitation(
    current_setting('test.admin_district_enumerator_id')::UUID
  ),
  FALSE,
  'viewer cannot cancel an invitation'
);
SELECT set_config(
  'test.invitation_cancelled_id',
  current_setting('test.admin_district_enumerator_id'),
  true
);
SELECT is(
  (SELECT auth_status FROM public.user_invitations
   WHERE id = current_setting('test.invitation_cancelled_id')::UUID),
  'not_attempted',
  'denied viewer cancellation leaves invitation state unchanged'
);
SELECT is(
  public.cancel_user_invitation(current_setting('test.invite_other_district_id')::UUID),
  FALSE,
  'district manager cannot cancel an invitation from another district'
);
SELECT is(
  public.cancel_user_invitation(
    (SELECT id FROM public.user_invitations
     WHERE email = 'district.manager@invite.test')
  ),
  FALSE,
  'district manager cannot cancel a district-manager invitation in their own district'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000104","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::INTEGER FROM public.user_invitations),
  0,
  'enumerator cannot read invitation history'
);
SELECT is(
  public.cancel_user_invitation(current_setting('test.invite_other_district_id')::UUID),
  FALSE,
  'enumerator cannot cancel invitations'
);
SELECT throws_ok(
  $$SELECT * FROM public.request_user_invitation(
    'blocked@invite.test', 'enumerator',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000108'
  )$$,
  '42501',
  NULL,
  'enumerator cannot invite users'
);
SELECT throws_ok(
  $$INSERT INTO public.user_invitations (
      organization_id, district_id, invited_by, email, role, idempotency_key
    ) VALUES (
      '10000000-0000-0000-0000-000000000101',
      '20000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000101',
      'direct-write@invite.test', 'enumerator',
      '90000000-0000-0000-0000-000000000109'
    )$$,
  '42501',
  NULL,
  'authenticated browser cannot insert invitations directly'
);
SELECT throws_ok(
  $$SELECT public.claim_user_invitation_auth_request(
    '00000000-0000-0000-0000-000000000101'
  )$$,
  '42501',
  NULL,
  'ordinary application role cannot claim privileged Auth request'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'accept-me@invite.test', 'enumerator',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000110'
  )),
  'created',
  'acceptance fixture invitation is created before its Auth user exists'
);
SELECT set_config(
  'test.acceptance_invitation_id',
  (SELECT id::TEXT FROM public.user_invitations WHERE email = 'accept-me@invite.test'),
  true
);
RESET ROLE;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('00000000-0000-0000-0000-000000000106', 'authenticated', 'authenticated', 'accept-me@invite.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000107', 'authenticated', 'authenticated', 'different-user@invite.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT is(
  public.claim_user_invitation_auth_request(
    current_setting('test.acceptance_invitation_id')::UUID
  ),
  TRUE,
  'service role can claim an Auth invitation request once'
);
SELECT is(
  public.claim_user_invitation_auth_request(
    current_setting('test.acceptance_invitation_id')::UUID
  ),
  FALSE,
  'same Auth invitation request cannot be claimed twice'
);
SELECT is(
  public.record_user_invitation_auth_result(
    current_setting('test.acceptance_invitation_id')::UUID,
    'accepted_by_auth',
    '00000000-0000-0000-0000-000000000106'
  ),
  TRUE,
  'service role records Auth success and moves invitation to pending'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000107', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000107","role":"authenticated"}', true);
SELECT throws_ok(
  $$SELECT public.accept_user_invitation(
    current_setting('test.acceptance_invitation_id')::UUID, 'Enumerator Test'
  )$$,
  '42501',
  NULL,
  'different authenticated user cannot accept invitation'
);
SELECT is(
  public.verify_user_invitation_context(
    current_setting('test.acceptance_invitation_id')::UUID
  ),
  FALSE,
  'preflight rejects a different authenticated user without accepting the invitation'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000106', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000106","role":"authenticated"}', true);
SELECT is(
  public.verify_user_invitation_context(
    current_setting('test.acceptance_invitation_id')::UUID
  ),
  TRUE,
  'preflight accepts the exact confirmed user and pending invitation context'
);
SELECT is(
  public.verify_user_invitation_context('ffffffff-ffff-4fff-8fff-ffffffffffff'::UUID),
  FALSE,
  'preflight rejects an unrelated invitation ID'
);
RESET ROLE;
SELECT is(
  (SELECT status FROM public.user_invitations
   WHERE id = current_setting('test.acceptance_invitation_id')::UUID),
  'pending',
  'preflight leaves the invitation pending when inspected by the test owner'
);
SET LOCAL ROLE authenticated;
SELECT is(
  public.accept_user_invitation(
    current_setting('test.acceptance_invitation_id')::UUID, 'Enumerator Test'
  ),
  'pending_approval',
  'Enumerator accepts and waits for administrator approval'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.profiles
   WHERE id = '00000000-0000-0000-0000-000000000106'
     AND organization_id = '10000000-0000-0000-0000-000000000101'
     AND district_id = '20000000-0000-0000-0000-000000000101'
     AND role = 'enumerator'),
  1,
  'acceptance creates profile using invitation scope and role'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.profiles
   WHERE id = '00000000-0000-0000-0000-000000000106'),
  1,
  'pending Enumerator can read only their own pending profile for approval status'
);
SELECT is(
  (SELECT is_active FROM public.profiles
   WHERE id = '00000000-0000-0000-0000-000000000106'),
  FALSE,
  'accepted Enumerator cannot access the application before approval'
);
SELECT is(
  public.accept_user_invitation(
    current_setting('test.acceptance_invitation_id')::UUID, 'Enumerator Test'
  ),
  'pending_approval',
  'exact repeated acceptance is idempotent before approval'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
SELECT is(
  public.approve_enumerator_profile('00000000-0000-0000-0000-000000000106'),
  TRUE,
  'active organization administrator approves a pending Enumerator in their organization'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}', true);
SELECT throws_ok(
  $$SELECT public.approve_enumerator_profile('00000000-0000-0000-0000-000000000106')$$,
  '42501',
  NULL,
  'Viewer cannot approve an Enumerator'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000106', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000106","role":"authenticated"}', true);
SELECT is(
  public.accept_user_invitation(
    current_setting('test.acceptance_invitation_id')::UUID, 'Enumerator Test'
  ),
  'approved',
  'accepted-and-approved invitation retries return approved status'
);
SELECT is(
  public.verify_user_invitation_context(
    current_setting('test.acceptance_invitation_id')::UUID
  ),
    FALSE,
    'preflight blocks password setup after the invitation and matching profile are already accepted'
);
RESET ROLE;
SELECT is(
  (SELECT full_name FROM public.profiles
   WHERE id = '00000000-0000-0000-0000-000000000106'),
  'Enumerator Test',
  'acceptance stores the name supplied by the invitee'
);
SELECT is(
  (SELECT approval_status FROM public.profiles
   WHERE id = '00000000-0000-0000-0000-000000000106'),
  'approved',
  'approval transition enables the Enumerator profile'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.audit_logs
   WHERE action = 'account_approved'
     AND record_id = '00000000-0000-0000-0000-000000000106'),
  1,
  'approval action is recorded in the audit log'
);
SELECT is(
  (SELECT status FROM public.user_invitations
   WHERE id = current_setting('test.acceptance_invitation_id')::UUID),
  'accepted',
  'accepted invitation reaches terminal accepted status'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'late-response@invite.test', 'enumerator',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000114'
  )),
  'created',
  'late-response fixture invitation is created'
);
SELECT set_config(
  'test.late_response_invitation_id',
  (SELECT id::TEXT FROM public.user_invitations WHERE email = 'late-response@invite.test'),
  true
);
RESET ROLE;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-000000000110', 'authenticated', 'authenticated',
  'late-response@invite.test', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT is(
  public.claim_user_invitation_auth_request(
    current_setting('test.late_response_invitation_id')::UUID
  ),
  TRUE,
  'Auth request is claimed before concurrent cancellation'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
SELECT is(
  public.cancel_user_invitation(
    current_setting('test.late_response_invitation_id')::UUID
  ),
  TRUE,
  'organization admin can cancel an in-flight invitation in their organization'
);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT is(
  public.record_user_invitation_auth_result(
    current_setting('test.late_response_invitation_id')::UUID,
    'accepted_by_auth',
    '00000000-0000-0000-0000-000000000110'
  ),
  TRUE,
  'late Auth success is recorded after cancellation'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000110', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000110","role":"authenticated"}', true);
SELECT throws_ok(
  $$SELECT public.accept_user_invitation(
    current_setting('test.late_response_invitation_id')::UUID, 'Late Test User'
  )$$,
  '42501',
  NULL,
  'still-valid Auth identity cannot accept a cancelled invitation'
);
RESET ROLE;
SELECT is(
  (SELECT status FROM public.user_invitations
   WHERE id = current_setting('test.late_response_invitation_id')::UUID),
  'cancelled',
  'late Auth response never reopens a cancelled invitation'
);
SELECT is(
  (SELECT auth_status FROM public.user_invitations
   WHERE id = current_setting('test.late_response_invitation_id')::UUID),
  'accepted_by_auth',
  'late Auth response records the known Auth result without claiming inbox delivery'
);
SELECT is(
  public.verify_user_invitation_context(
    current_setting('test.late_response_invitation_id')::UUID
  ),
  FALSE,
  'preflight rejects a cancelled invitation even when Auth accepted the user'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'unconfirmed@invite.test', 'enumerator',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000115'
  )),
  'created',
  'unconfirmed-user fixture invitation is created before its Auth user exists'
);
SELECT set_config(
  'test.unconfirmed_invitation_id',
  (SELECT id::TEXT FROM public.user_invitations WHERE email = 'unconfirmed@invite.test'),
  true
);
RESET ROLE;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-000000000108', 'authenticated', 'authenticated',
  'unconfirmed@invite.test', '', NULL, now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
);
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT lives_ok(
  $$SELECT public.claim_user_invitation_auth_request(
    current_setting('test.unconfirmed_invitation_id')::UUID
  )$$,
  'service role can claim unconfirmed-user fixture'
);
SELECT lives_ok(
  $$SELECT public.record_user_invitation_auth_result(
    current_setting('test.unconfirmed_invitation_id')::UUID,
    'accepted_by_auth',
    '00000000-0000-0000-0000-000000000108'
  )$$,
  'Auth invite response can be recorded before email confirmation'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000108', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000108","role":"authenticated"}', true);
SELECT throws_ok(
  $$SELECT public.accept_user_invitation(
    current_setting('test.unconfirmed_invitation_id')::UUID, 'Unconfirmed Test User'
  )$$,
  '42501',
  NULL,
  'unconfirmed Auth email cannot accept invitation'
);
SELECT is(
  public.verify_user_invitation_context(
    current_setting('test.unconfirmed_invitation_id')::UUID
  ),
  FALSE,
  'preflight rejects an unconfirmed Auth email'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'unlinked@invite.test', 'enumerator',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000118'
  )),
  'created',
  'unlinked-user fixture invitation is created'
);
SELECT set_config(
  'test.unlinked_invitation_id',
  (SELECT id::TEXT FROM public.user_invitations WHERE email = 'unlinked@invite.test'),
  true
);
RESET ROLE;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-000000000113', 'authenticated', 'authenticated',
  'unlinked@invite.test', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000113', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000113","role":"authenticated"}', true);
SELECT throws_ok(
  $$SELECT public.accept_user_invitation(
    current_setting('test.unlinked_invitation_id')::UUID, 'Unlinked Test User'
  )$$,
  '42501',
  NULL,
  'matching confirmed email without recorded Auth user ID cannot accept'
);
RESET ROLE;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-000000000111', 'authenticated', 'authenticated',
  'duplicate-profile-auth@invite.test', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
SELECT is(
  (SELECT result_code FROM public.request_user_invitation(
    'duplicate-profile@invite.test', 'enumerator',
    '20000000-0000-0000-0000-000000000101',
    '90000000-0000-0000-0000-000000000116'
  )),
  'created',
  'duplicate-profile fixture invitation is created'
);
SELECT set_config(
  'test.duplicate_profile_invitation_id',
  (SELECT id::TEXT FROM public.user_invitations WHERE email = 'duplicate-profile@invite.test'),
  true
);
RESET ROLE;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-000000000112', 'authenticated', 'authenticated',
  'duplicate-profile@invite.test', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
);

INSERT INTO public.profiles (id, organization_id, email, full_name, role, district_id)
VALUES (
  '00000000-0000-0000-0000-000000000111',
  '10000000-0000-0000-0000-000000000102',
  'duplicate-profile@invite.test',
  'Existing conflicting profile',
  'enumerator',
  '20000000-0000-0000-0000-000000000103'
);
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT lives_ok(
  $$SELECT public.claim_user_invitation_auth_request(
    current_setting('test.duplicate_profile_invitation_id')::UUID
  )$$,
  'service role can claim duplicate-profile fixture'
);
SELECT lives_ok(
  $$SELECT public.record_user_invitation_auth_result(
    current_setting('test.duplicate_profile_invitation_id')::UUID,
    'accepted_by_auth',
    '00000000-0000-0000-0000-000000000112'
  )$$,
  'Auth result can be recorded for duplicate-profile fixture'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000112', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000112","role":"authenticated"}', true);
SELECT is(
  public.verify_user_invitation_context(
    current_setting('test.duplicate_profile_invitation_id')::UUID
  ),
  FALSE,
  'preflight rejects a duplicate normalized profile email before password changes'
);
SELECT throws_ok(
  $$SELECT public.accept_user_invitation(
    current_setting('test.duplicate_profile_invitation_id')::UUID, 'Duplicate Test User'
  )$$,
  '23505',
  NULL,
  'existing normalized profile email blocks acceptance without linking or modification'
);
RESET ROLE;

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.record_user_invitation_auth_result(uuid,text,uuid,text)',
    'EXECUTE'
  ),
  FALSE,
  'authenticated role cannot record privileged Auth outcomes'
);
SELECT is(
  has_function_privilege(
    'authenticated',
    'public.accept_user_invitation(uuid,text)',
    'EXECUTE'
  ),
  TRUE,
  'authenticated role can execute guarded acceptance function'
);
SELECT is(
  has_function_privilege(
    'authenticated',
    'public.verify_user_invitation_context(uuid)',
    'EXECUTE'
  ),
  TRUE,
  'authenticated role can execute read-only invitation preflight'
);
SELECT is(
  has_function_privilege(
    'anon',
    'public.verify_user_invitation_context(uuid)',
    'EXECUTE'
  ),
  FALSE,
  'anonymous role cannot execute invitation preflight'
);

DELETE FROM auth.users
WHERE id = '00000000-0000-0000-0000-000000000106';
SELECT is(
  (SELECT status FROM public.user_invitations
   WHERE id = current_setting('test.acceptance_invitation_id')::UUID),
  'accepted',
  'deleting an invitee preserves accepted invitation history'
);
SELECT is(
  (SELECT auth_user_id FROM public.user_invitations
   WHERE id = current_setting('test.acceptance_invitation_id')::UUID),
  NULL::UUID,
  'deleting an Auth user clears only the historical Auth-user reference'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.profiles
   WHERE id = '00000000-0000-0000-0000-000000000106'),
  0,
  'deleting the Auth user cascades to its provisioned profile'
);

SELECT * FROM finish();
ROLLBACK;
