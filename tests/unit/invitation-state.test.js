import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyInvitationState } from '../../supabase/functions/invite-user/invitation-state.js';

test('only a never-attempted provisioning row is claimable', () => {
  assert.equal(classifyInvitationState({ status: 'provisioning', auth_status: 'not_attempted' }), 'claimable');
  assert.equal(classifyInvitationState({ status: 'provisioning', auth_status: 'in_flight' }), 'already_processing');
  assert.equal(classifyInvitationState({ status: 'provisioning', auth_status: 'unknown' }), 'outcome_unknown');
  assert.equal(classifyInvitationState({ status: 'provisioning', auth_status: 'accepted_by_auth' }), 'outcome_unknown');
});

test('existing pending, accepted, cancelled, failed, and expired invitations are never claimable', () => {
  assert.equal(classifyInvitationState({ status: 'pending', auth_status: 'accepted_by_auth' }), 'already_pending');
  assert.equal(classifyInvitationState({ status: 'pending', auth_status: 'in_flight' }), 'already_processing');
  assert.equal(classifyInvitationState({ status: 'pending', auth_status: 'unknown' }), 'outcome_unknown');
  assert.equal(classifyInvitationState({ status: 'accepted', auth_status: 'accepted_by_auth' }), 'already_accepted');
  assert.equal(classifyInvitationState({ status: 'cancelled', auth_status: 'accepted_by_auth' }), 'cancelled');
  assert.equal(classifyInvitationState({ status: 'failed', auth_status: 'rejected_by_auth' }), 'failed');
  assert.equal(classifyInvitationState({ status: 'pending', auth_status: 'rejected_by_auth' }), 'failed');
  assert.equal(classifyInvitationState({ status: 'expired', auth_status: 'unknown' }), 'expired');
  assert.equal(classifyInvitationState({ status: 'unexpected', auth_status: 'unexpected' }), 'outcome_unknown');
});
