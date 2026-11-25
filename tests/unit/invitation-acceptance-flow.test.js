import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptInvitationWithClient, finishInvitationSession } from '../../src/lib/invitationAcceptance.js';
import { getInvitationCallbackError, restoreInvitationSession } from '../../src/lib/invitationCallback.js';

const invitationId = '5bf75c02-4c91-457d-a7b3-57549ecbd43c';
const invitedUser = {
  id: '42c0916f-fcae-441e-9438-ef99a9b5543d',
  email: 'dhanushree.s10122005@gmail.com',
};

function makeClient({ preflight = true, acceptance = true, sessions, verifiedUser = invitedUser } = {}) {
  const calls = [];
  let sessionIndex = 0;
  let rpcIndex = 0;
  const rpcResults = [
    { data: preflight, error: null },
    typeof acceptance === 'object' ? acceptance : { data: acceptance, error: null },
  ];
  const sessionValues = sessions || [{ user: invitedUser, access_token: 'invite-session-token' }];
  const client = {
    calls,
    auth: {
      async getSession() {
        calls.push('getSession');
        const session = sessionValues[Math.min(sessionIndex, sessionValues.length - 1)];
        sessionIndex += 1;
        return { data: { session }, error: null };
      },
      async getUser(token) {
        calls.push(['getUser', token]);
        return { data: { user: verifiedUser }, error: null };
      },
      async updateUser(value) {
        calls.push(['updateUser', value]);
        return { error: null };
      },
    },
    async rpc(name, args) {
      calls.push(['rpc', name, args]);
      const result = rpcResults[rpcIndex] || { data: null, error: { code: 'unexpected_rpc' } };
      rpcIndex += 1;
      return result;
    },
  };
  return client;
}

test('valid invite callback updates password then accepts the exact invitation with entered name', async () => {
  const client = makeClient();

  const result = await acceptInvitationWithClient(client, invitationId, 'Dhanushree Enumerator', 'new password value');

  assert.deepEqual(result, { alreadyAccepted: false, outcome: 'approved' });
  assert.deepEqual(client.calls.filter((call) => Array.isArray(call) && call[0] === 'rpc'), [
    ['rpc', 'verify_user_invitation_context', { target_invitation_id: invitationId }],
    ['rpc', 'accept_user_invitation', {
      target_invitation_id: invitationId,
      target_full_name: 'Dhanushree Enumerator',
    }],
  ]);
  assert.deepEqual(client.calls.find((call) => Array.isArray(call) && call[0] === 'updateUser'), [
    'updateUser', { password: 'new password value' },
  ]);
  assert.ok(client.calls.findIndex((call) => Array.isArray(call) && call[0] === 'updateUser')
    < client.calls.findIndex((call) => Array.isArray(call) && call[0] === 'rpc' && call[1] === 'accept_user_invitation'));
});

test('already accepted retry uses the idempotent RPC without changing password again', async () => {
  const client = makeClient({ preflight: false, acceptance: true });

  const result = await acceptInvitationWithClient(client, invitationId, 'Dhanushree Enumerator', 'unused retry password');

  assert.deepEqual(result, { alreadyAccepted: true, outcome: 'approved' });
  assert.equal(client.calls.some((call) => Array.isArray(call) && call[0] === 'updateUser'), false);
  assert.deepEqual(client.calls.filter((call) => Array.isArray(call) && call[0] === 'rpc').map((call) => call[1]), [
    'verify_user_invitation_context', 'accept_user_invitation',
  ]);
});

test('a different browser account cannot update its password or accept the invite', async () => {
  const otherUser = { id: 'another-user', email: 'admin@example.test' };
  const client = makeClient({
    preflight: false,
    acceptance: { data: null, error: { code: '42501' } },
    sessions: [{ user: otherUser, access_token: 'admin-session-token' }],
    verifiedUser: otherUser,
  });

  await assert.rejects(
    acceptInvitationWithClient(client, invitationId, 'Enumerator', 'do not update'),
    /belongs to another account|invalid, expired|cancelled/i,
  );
  assert.equal(client.calls.some((call) => Array.isArray(call) && call[0] === 'updateUser'), false);
  assert.equal(client.calls.some((call) => Array.isArray(call) && call[0] === 'rpc' && call[1] === 'accept_user_invitation'), true);
});

test('session changes during setup stop before password mutation', async () => {
  const otherUser = { id: 'different-user', email: 'different@example.test' };
  const client = makeClient({
    sessions: [
      { user: invitedUser, access_token: 'invite-session-token' },
      { user: otherUser, access_token: 'other-session-token' },
    ],
    verifiedUser: invitedUser,
  });

  await assert.rejects(
    acceptInvitationWithClient(client, invitationId, 'Enumerator', 'password value'),
    /account changed during invitation setup/,
  );
  assert.equal(client.calls.some((call) => Array.isArray(call) && call[0] === 'updateUser'), false);
  assert.equal(client.calls.some((call) => Array.isArray(call) && call[0] === 'rpc' && call[1] === 'accept_user_invitation'), false);
});

test('session changes after password update report the partial state and do not accept as another user', async () => {
  const otherUser = { id: 'different-user', email: 'different@example.test' };
  const client = makeClient({
    sessions: [
      { user: invitedUser, access_token: 'invite-session-token' },
      { user: invitedUser, access_token: 'invite-session-token' },
      { user: otherUser, access_token: 'other-session-token' },
    ],
    verifiedUser: invitedUser,
  });

  await assert.rejects(
    acceptInvitationWithClient(client, invitationId, 'Enumerator', 'password value'),
    /password was updated.*account changed/s,
  );
  assert.equal(client.calls.filter((call) => Array.isArray(call) && call[0] === 'updateUser').length, 1);
  assert.equal(client.calls.some((call) => Array.isArray(call) && call[0] === 'rpc' && call[1] === 'accept_user_invitation'), false);
});

test('missing or unverifiable callback session never mutates password or calls acceptance RPC', async () => {
  const noSessionClient = makeClient({ sessions: [null] });
  await assert.rejects(
    acceptInvitationWithClient(noSessionClient, invitationId, 'Enumerator', 'password value'),
    /No valid invitation session/,
  );
  assert.equal(noSessionClient.calls.some((call) => Array.isArray(call) && call[0] === 'updateUser'), false);
  assert.equal(noSessionClient.calls.some((call) => Array.isArray(call) && call[0] === 'rpc'), false);

  const unverifiedClient = makeClient({ verifiedUser: { id: 'different', email: 'other@example.test' } });
  await assert.rejects(
    acceptInvitationWithClient(unverifiedClient, invitationId, 'Enumerator', 'password value'),
    /not a verified invitation account/,
  );
  assert.equal(unverifiedClient.calls.some((call) => Array.isArray(call) && call[0] === 'updateUser'), false);
  assert.equal(unverifiedClient.calls.some((call) => Array.isArray(call) && call[0] === 'rpc'), false);
});

test('malformed invitation UUID is rejected before auth or password operations', async () => {
  const client = makeClient();
  await assert.rejects(
    acceptInvitationWithClient(client, 'not-an-invitation-uuid', 'Enumerator', 'password value'),
    /invalid or missing its invitation reference/,
  );
  assert.deepEqual(client.calls, []);
});

test('preflight transport errors fail closed before changing password', async () => {
  const client = makeClient();
  client.rpc = async (name, args) => {
    client.calls.push(['rpc', name, args]);
    throw new Error('network unavailable');
  };

  await assert.rejects(
    acceptInvitationWithClient(client, invitationId, 'Enumerator', 'password value'),
    /could not be verified.*No password was changed/,
  );
  assert.equal(client.calls.some((call) => Array.isArray(call) && call[0] === 'updateUser'), false);
});

test('RPC failure after password update keeps the same invitation retryable and reports partial completion', async () => {
  const client = makeClient({ acceptance: { data: null, error: { code: '08006' } } });

  await assert.rejects(
    acceptInvitationWithClient(client, invitationId, 'Enumerator', 'password value'),
    /password was updated.*Retry this same invitation/s,
  );
  assert.equal(client.calls.filter((call) => Array.isArray(call) && call[0] === 'updateUser').length, 1);
});

test('expired callback errors are shown without exposing callback tokens', () => {
  assert.match(
    getInvitationCallbackError('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+expired'),
    /invalid or expired/i,
  );
  assert.equal(getInvitationCallbackError('', '#access_token=secret-token&refresh_token=secret-refresh&type=invite'), null);
});

test('direct token-hash invitation callbacks establish a session and remove token material from the URL', async () => {
  const calls = [];
  let currentUrl = `https://app.example.test/accept-invitation?invitation_id=${invitationId}&token_hash=one-time-token&type=invite`;
  const auth = {
    async verifyOtp(input) {
      calls.push(['verifyOtp', input]);
      return { data: { session: { user: invitedUser } }, error: null };
    },
    async getSession() {
      calls.push('getSession');
      return { data: { session: { user: invitedUser, access_token: 'invite-session-token' } }, error: null };
    },
  };

  const result = await restoreInvitationSession(auth, currentUrl, {
    getCurrentUrl: () => currentUrl,
    replaceUrl: (url) => { currentUrl = `https://app.example.test${url}`; },
  });

  assert.equal(result.error, null);
  assert.equal(result.session.user.id, invitedUser.id);
  assert.deepEqual(calls[0], ['verifyOtp', { token_hash: 'one-time-token', type: 'invite' }]);
  assert.equal(currentUrl, `https://app.example.test/accept-invitation?invitation_id=${invitationId}`);
});

test('invalid token-hash and unexchanged PKCE callbacks produce clear errors', async () => {
  let expiredUrl = `https://app.example.test/accept-invitation?invitation_id=${invitationId}&token_hash=expired&type=invite`;
  const expired = await restoreInvitationSession({
    async verifyOtp() { return { data: { session: null }, error: { code: 'otp_expired' } }; },
    async getSession() { return { data: { session: null }, error: null }; },
  }, expiredUrl, {
    getCurrentUrl: () => expiredUrl,
    replaceUrl: (url) => { expiredUrl = `https://app.example.test${url}`; },
  });
  assert.match(expired.error, /invalid or expired/i);
  assert.equal(expiredUrl, `https://app.example.test/accept-invitation?invitation_id=${invitationId}`);

  const pkceUrl = `https://app.example.test/accept-invitation?invitation_id=${invitationId}&code=unexchanged`;
  const pkce = await restoreInvitationSession({
    async getSession() { return { data: { session: null }, error: null }; },
  }, pkceUrl, { getCurrentUrl: () => pkceUrl });
  assert.match(pkce.error, /could not be exchanged/i);
});

test('successful acceptance closes only the local Auth session', async () => {
  const client = makeClient();
  client.auth.signOut = async (options) => {
    client.calls.push(['signOut', options]);
    return { error: null };
  };

  await finishInvitationSession(client);

  assert.deepEqual(client.calls.at(-1), ['signOut', { scope: 'local' }]);
});

test('Enumerator acceptance and idempotent retry return pending approval state', async () => {
  const client = makeClient({ acceptance: 'pending_approval' });
  assert.deepEqual(
    await acceptInvitationWithClient(client, invitationId, 'Dhanushree Enumerator', 'new password value'),
    { alreadyAccepted: false, outcome: 'pending_approval' },
  );
  const retry = makeClient({ preflight: false, acceptance: 'pending_approval' });
  assert.deepEqual(
    await acceptInvitationWithClient(retry, invitationId, 'Dhanushree Enumerator', 'unused retry password'),
    { alreadyAccepted: true, outcome: 'pending_approval' },
  );
  assert.equal(retry.calls.some((call) => Array.isArray(call) && call[0] === 'updateUser'), false);
});
