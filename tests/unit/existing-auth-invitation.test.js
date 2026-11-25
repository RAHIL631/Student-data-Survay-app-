import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { restoreInvitationSession } from '../../src/lib/invitationCallback.js';

const migration = await readFile(new URL('../../supabase/migrations/20261205000000_reinvite_existing_auth_users.sql', import.meta.url), 'utf8');
const approvalMigration = await readFile(new URL('../../supabase/migrations/20261206000000_enumerator_approval_contract.sql', import.meta.url), 'utf8');
const edgeFunction = await readFile(new URL('../../supabase/functions/invite-user/index.ts', import.meta.url), 'utf8');

test('the forward migration permits profile-less existing Auth users and limits identity lookup to service_role', () => {
  const requestFunction = migration.split('CREATE OR REPLACE FUNCTION public.existing_auth_user_for_invitation')[0];
  assert.match(requestFunction, /IF EXISTS \([\s\S]*?FROM public\.profiles AS p[\s\S]*?\) THEN[\s\S]*?'conflict'/);
  assert.doesNotMatch(requestFunction, /FROM auth\.users AS u/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.existing_auth_user_for_invitation\(UUID\) TO service_role/);
  assert.match(migration, /i\.status = 'provisioning'[\s\S]*?i\.auth_status = 'in_flight'/);
});

test('acceptance matches the latest frontend approval result and keeps approval admin-scoped', async () => {
  assert.match(approvalMigration, /RETURNS TEXT/);
  assert.match(approvalMigration, /'pending_approval'/);
  assert.match(approvalMigration, /'approved'/);
  assert.match(approvalMigration, /public\.approve_enumerator_profile/);
  assert.match(approvalMigration, /public\.current_profile_role\(\) <> 'organization_admin'/);
  assert.match(approvalMigration, /INSERT INTO public\.audit_logs/);
  const provider = await readFile(new URL('../../src/context/AuthProvider.tsx', import.meta.url), 'utf8');
  const accountManager = await readFile(new URL('../../src/components/AccountActivationManagement.tsx', import.meta.url), 'utf8');
  assert.match(provider, /outcome === 'pending_approval'/);
  assert.match(accountManager, /approveEnumeratorProfile/);
});

test('existing Auth invitations use password recovery and new accounts use Auth invitation without changing identity', () => {
  assert.match(edgeFunction, /existing_auth_user_for_invitation/);
  assert.match(edgeFunction, /resetPasswordForEmail\(action\.email/);
  assert.match(edgeFunction, /inviteUserByEmail\(/);
  assert.match(edgeFunction, /resulting_auth_user_id: resultingAuthUserId/);
});

test('recovery token_hash links establish a session on the existing invitation route', async () => {
  const calls = [];
  const auth = {
    verifyOtp: async (input) => {
      calls.push(input);
      return { data: { session: { user: { id: 'existing-user' } } }, error: null };
    },
    getSession: async () => ({ data: { session: { user: { id: 'existing-user' } } }, error: null }),
  };
  const result = await restoreInvitationSession(
    auth,
    'https://app.test/accept-invitation?invitation_id=abc&token_hash=secret&type=recovery',
  );
  assert.equal(result.error, null);
  assert.equal(result.session.user.id, 'existing-user');
  assert.deepEqual(calls, [{ token_hash: 'secret', type: 'recovery' }]);
});

test('token hashes of another purpose are rejected without attempting verification', async () => {
  let called = false;
  const result = await restoreInvitationSession({
    verifyOtp: async () => { called = true; },
    getSession: async () => ({ data: { session: null }, error: null }),
  }, 'https://app.test/accept-invitation?invitation_id=abc&token_hash=secret&type=magiclink');
  assert.equal(called, false);
  assert.match(result.error, /invalid or expired/i);
});

test('a valid PKCE callback is not rejected while its restored session is available', async () => {
  const auth = {
    getSession: async () => ({ data: { session: { user: { id: 'pkce-user' } } }, error: null }),
  };
  const result = await restoreInvitationSession(
    auth,
    'https://app.test/accept-invitation?invitation_id=abc&code=one-time-code',
  );
  assert.equal(result.error, null);
  assert.equal(result.session.user.id, 'pkce-user');
});

test('an unexchanged PKCE callback reports a useful error when no session exists', async () => {
  const result = await restoreInvitationSession({
    getSession: async () => ({ data: { session: null }, error: null }),
  }, 'https://app.test/accept-invitation?invitation_id=abc&code=one-time-code');
  assert.match(result.error, /could not be exchanged/i);
});
