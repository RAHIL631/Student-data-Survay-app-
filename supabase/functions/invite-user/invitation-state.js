/**
 * Classify a persisted invitation before deciding whether Auth may be called.
 * Only a provisioning row whose Auth request has never been attempted is
 * claimable. Every other state must be returned without sending another mail.
 */
export function classifyInvitationState({ status, auth_status }) {
  if (status === 'accepted') return 'already_accepted';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'expired') return 'expired';
  if (status === 'failed' || auth_status === 'rejected_by_auth') return 'failed';

  if (status === 'pending') {
    if (auth_status === 'accepted_by_auth') return 'already_pending';
    if (auth_status === 'in_flight') return 'already_processing';
    return 'outcome_unknown';
  }

  if (status === 'provisioning') {
    if (auth_status === 'not_attempted') return 'claimable';
    if (auth_status === 'in_flight') return 'already_processing';
    if (auth_status === 'unknown') return 'outcome_unknown';
  }

  return 'outcome_unknown';
}
