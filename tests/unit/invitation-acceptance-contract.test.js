import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyInvitationState } from '../../supabase/functions/invite-user/invitation-state.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readSource = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

test('invitation acceptance verifies the callback session and invitation before updating a password', () => {
  const supabase = readSource('src/lib/supabase.ts');
  const acceptance = readSource('src/lib/invitationAcceptance.js');
  const route = readSource('src/App.tsx');

  assert.match(supabase, /detectSessionInUrl:\s*true/);
  assert.match(supabase, /persistSession:\s*true/);
  assert.match(route, /path="\/accept-invitation" element=\{<AcceptInvitationPage \/>\}/);
  assert.match(acceptance, /auth\.getUser\(session\.access_token\)/);
  assert.match(acceptance, /verifiedUser\.id !== expectedUserId/);
  assert.match(acceptance, /verify_user_invitation_context/);

  const preflightIndex = acceptance.indexOf("'verify_user_invitation_context'");
  const passwordUpdateIndex = acceptance.indexOf('auth.updateUser({ password })', preflightIndex);
  const finalIdentityCheckIndex = acceptance.indexOf('await verifyCurrentSession();', passwordUpdateIndex);
  const acceptanceIndex = acceptance.indexOf("client.rpc('accept_user_invitation'", finalIdentityCheckIndex);
  assert.ok(preflightIndex >= 0 && preflightIndex < passwordUpdateIndex);
  assert.ok(passwordUpdateIndex < finalIdentityCheckIndex && finalIdentityCheckIndex < acceptanceIndex);
  const acceptanceFlow = acceptance;
  assert.doesNotMatch(acceptanceFlow, /console\.(?:log|warn|error)\(/i);
});

test('invitation callback stays public and login waits for profile restoration', () => {
  const app = readSource('src/App.tsx');
  const login = readSource('src/pages/LoginPage.tsx');
  const acceptancePage = readSource('src/pages/AcceptInvitationPage.tsx');
  const provider = readSource('src/context/AuthProvider.tsx');
  const callbackParser = readSource('src/lib/invitationCallback.js');
  const invitationFunction = readSource('supabase/functions/invite-user/index.ts');
  const acceptanceRouteIndex = app.indexOf('<Route path="/accept-invitation"');
  const protectedRouteIndex = app.indexOf('<Route element={<ProtectedRoute>');

  assert.ok(acceptanceRouteIndex >= 0 && protectedRouteIndex > acceptanceRouteIndex);
  assert.match(login, /if \(!isLoading && isPasswordRecoveryActive\)/);
  assert.match(login, /else if \(!isLoading && user\)/);
  assert.match(acceptancePage, /isAuthReady && !acceptedForApproval && !invitationCallbackError && invitationId/);
  assert.match(provider, /restoreInvitationSession\(authClient\.auth,[\s\S]*setIsAuthReady\(true\)/);
  assert.match(callbackParser, /error_code/);
  assert.match(invitationFunction, /redirectUrl\.searchParams\.set\('invitation_id', request\.invitation_id\)/);
});

test('login suppresses stale restored-profile errors when a sign-in result is present', () => {
  const provider = readSource('src/context/AuthProvider.tsx');
  const login = readSource('src/pages/LoginPage.tsx');
  const loginFlow = provider.slice(provider.indexOf('login: async'), provider.indexOf('requestPasswordReset: async'));

  assert.ok(loginFlow.indexOf('setAuthError(null)') < loginFlow.indexOf('signInWithPassword'));
  assert.match(login, /authError && !error/);
});

test('successful sign-in restores the profile for the authenticated Auth UID', () => {
  const provider = readSource('src/context/AuthProvider.tsx');
  const dataService = readSource('src/lib/dataService.ts');
  const loginFlow = provider.slice(provider.indexOf('login: async'), provider.indexOf('requestPasswordReset: async'));

  assert.match(loginFlow, /getProfile\(data\.user\.id\)/);
  assert.match(dataService, /\.eq\('id', userId\)/);
  assert.match(dataService, /organizationId: data\.organization_id/);
  assert.match(dataService, /districtId: data\.district_id \?\? undefined/);
});

test('failed acceptance can safely retry the same invitation after a password update', () => {
  const acceptance = readSource('src/lib/invitationAcceptance.js');
  const provider = readSource('src/context/AuthProvider.tsx');
  const databaseTest = readSource('supabase/tests/database/user_invitations.test.sql');
  const acceptanceFlow = acceptance;
  const acceptanceCallIndex = provider.indexOf('await acceptInvitationWithClient(');
  const signOutCallIndex = provider.indexOf('await finishInvitationSession(', acceptanceCallIndex);

  assert.ok(acceptanceCallIndex >= 0 && signOutCallIndex > acceptanceCallIndex);
  assert.match(acceptanceFlow, /Retry this same invitation/);
  assert.match(acceptanceFlow, /do not request another invitation/i);
  assert.match(acceptance, /The invitation was accepted and your profile was created, but automatic sign-out failed/);
  assert.match(acceptance, /Your account is set up; sign out manually before returning to sign in/);
  assert.match(acceptanceFlow, /Your password was updated, but invitation acceptance was not confirmed/);
  assert.match(acceptanceFlow, /No password was changed/);
  assert.doesNotMatch(acceptanceFlow, /Sign outof other accounts/);
  assert.doesNotMatch(acceptanceFlow, /No further invitation changes were made/);
  assert.match(databaseTest, /exact repeated acceptance is idempotent/);
  assert.match(databaseTest, /preflight blocks password setup after the invitation and matching profile are already accepted/);
  assert.match(databaseTest, /acceptance creates profile using invitation scope and role/);
});

test('acceptance page uses UTF-8 loading ellipses and ignores duplicate submissions', () => {
  const page = readSource('src/pages/AcceptInvitationPage.tsx');
  const submitHandler = page.slice(page.indexOf('const handleSubmit'), page.indexOf('\n  return ('));

  assert.match(submitHandler, /if \(isSaving\)\s*\{\s*event\.preventDefault\(\);\s*return;/);
  assert.ok(submitHandler.indexOf('if (isSaving)') < submitHandler.indexOf('if (!invitationId)'));
  assert.ok(page.includes(`Verifying your invitation\u2026`));
  assert.ok(page.includes(`Setting password\u2026`));
  assert.doesNotMatch(page, /Verifying your invitation(?:â€¦|�)|Setting password(?:â€¦|�)/);
});

test('invitation preflight is identity-bound and read-only', () => {
  const migration = readSource('supabase/migrations/20261202000000_invitation_preflight_and_safe_request_errors.sql');
  const preflight = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.verify_user_invitation_context'),
    migration.indexOf('REVOKE ALL ON FUNCTION public.verify_user_invitation_context'),
  );

  assert.match(preflight, /SECURITY DEFINER/);
  assert.match(preflight, /SET search_path = ''/);
  assert.match(preflight, /u\.id = auth\.uid\(\)/);
  assert.match(preflight, /u\.email_confirmed_at IS NOT NULL/);
  assert.match(preflight, /i\.auth_status = 'accepted_by_auth'/);
  assert.match(preflight, /i\.status = 'pending'/);
  assert.match(preflight, /NOT EXISTS \([\s\S]*public\.profiles/);
  assert.doesNotMatch(preflight, /INSERT\s+INTO|UPDATE\s+public\.user_invitations|DELETE\s+FROM/i);
});

test('invitation creation returns safe authorization, district, validation, and conflict codes', () => {
  const edge = readSource('supabase/functions/invite-user/index.ts');
  const corsPolicy = readSource('supabase/functions/invite-user/cors-policy.js');
  const requestMigration = readSource('supabase/migrations/20261202000000_invitation_preflight_and_safe_request_errors.sql');
  const service = readSource('src/lib/dataService.ts');

  assert.match(edge, /requestError\.code === '42501'[\s\S]*not_authorized/);
  assert.match(edge, /requestError\.code === '22023'[\s\S]*invalid_district/);
  assert.match(edge, /request\?\.result_code === 'invalid_request'[\s\S]*invalid_invitation_request/);
  assert.match(edge, /request\.result_code === 'conflict'[\s\S]*invitation_conflict/);
  assert.match(edge, /defaultInvitationRedirectOrigin = productionInvitationOrigin/);
  assert.match(corsPolicy, /productionInvitationOrigin = 'https:\/\/student-data-survay-app\.vercel\.app'/);
  assert.match(requestMigration, /actor\.role <> 'organization_admin'/);
  assert.match(requestMigration, /d\.organization_id = actor\.organization_id/);
  assert.match(requestMigration, /auth\.users AS u/);
  assert.match(service, /case 'invalid_district'/);
  assert.match(service, /case 'invitation_conflict'/);
  assert.doesNotMatch(edge, /console\.(?:log|warn|error)\([^\n]*(?:token|password|service.role)/i);
});

test('existing invitation states are classified without permitting a second Auth invitation', () => {
  assert.equal(classifyInvitationState({ status: 'pending', auth_status: 'accepted_by_auth' }), 'already_pending');
  assert.equal(classifyInvitationState({ status: 'accepted', auth_status: 'accepted_by_auth' }), 'already_accepted');
  assert.equal(classifyInvitationState({ status: 'provisioning', auth_status: 'in_flight' }), 'already_processing');
  assert.equal(classifyInvitationState({ status: 'provisioning', auth_status: 'unknown' }), 'outcome_unknown');
  assert.equal(classifyInvitationState({ status: 'provisioning', auth_status: 'not_attempted' }), 'claimable');
  assert.equal(classifyInvitationState({ status: 'cancelled', auth_status: 'accepted_by_auth' }), 'cancelled');
  assert.equal(classifyInvitationState({ status: 'failed', auth_status: 'rejected_by_auth' }), 'failed');
  assert.equal(classifyInvitationState({ status: 'expired', auth_status: 'accepted_by_auth' }), 'expired');
  assert.equal(classifyInvitationState({ status: 'pending', auth_status: 'unknown' }), 'outcome_unknown');

  const edge = readSource('supabase/functions/invite-user/index.ts');
  const existingCheck = edge.indexOf('if (!request.created)');
  const claim = edge.indexOf("'claim_user_invitation_auth_request'");
  const send = edge.indexOf('serviceClient.auth.admin.inviteUserByEmail');
  assert.ok(existingCheck >= 0 && existingCheck < claim && claim < send);
  assert.match(edge.slice(existingCheck, claim), /classifyInvitationState/);
  assert.match(edge.slice(existingCheck, claim), /existingState !== 'claimable'/);
  assert.match(edge, /if \(claimed !== true\)[\s\S]*classifyInvitationState\(latest/);
  assert.match(edge, /\.select\('status, auth_status'\)/);
});

test('accepted invitation preflight cannot authorize another password update', () => {
  const migration = readSource('supabase/migrations/20261202000000_invitation_preflight_and_safe_request_errors.sql');
  const preflight = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.verify_user_invitation_context'),
    migration.indexOf('REVOKE ALL ON FUNCTION public.verify_user_invitation_context'),
  );
  const acceptanceFlow = readSource('src/lib/invitationAcceptance.js');
  const preflightIndex = acceptanceFlow.indexOf("'verify_user_invitation_context'");
  const passwordUpdateIndex = acceptanceFlow.indexOf('auth.updateUser({ password })');

  assert.match(preflight, /i\.status = 'pending'/);
  assert.doesNotMatch(preflight, /i\.status = 'accepted'/);
  assert.match(acceptanceFlow, /preflightError/);
  assert.match(acceptanceFlow, /invitationVerified !== true/);
  assert.ok(preflightIndex >= 0 && preflightIndex < passwordUpdateIndex);
  assert.match(acceptanceFlow, /No password was changed/);
  const databaseTest = readSource('supabase/tests/database/user_invitations.test.sql');
  assert.match(databaseTest, /exact repeated acceptance is idempotent/);
  assert.match(databaseTest, /preflight blocks password setup after the invitation and matching profile are already accepted/);
});
