function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function acceptanceError(error, passwordUpdated) {
  if (error?.code === '23505') {
    return new Error(passwordUpdated
      ? 'Your password was updated, but a profile already exists for this email. Ask an organization administrator to reconcile the existing profile.'
      : 'A profile already exists for this email, so this invitation cannot create another one. Ask an organization administrator to reconcile the existing profile.');
  }
  if (error?.code === '42501') {
    return new Error(passwordUpdated
      ? 'Your password was updated, but this invitation is no longer available or does not match this account. It may have been cancelled or already used. Return to sign in if setup was already completed; otherwise ask an organization administrator to check the invitation status.'
      : 'This invitation is invalid, expired, cancelled, already used, or belongs to another account. No password was changed. Return to sign in if setup was already completed; otherwise ask an organization administrator to check this invitation.');
  }
  return new Error(passwordUpdated
    ? `Your password was updated, but invitation acceptance could not be confirmed (${error?.code || 'database_error'}). Retry this same invitation; do not request another invitation. Contact an administrator if the result remains unclear.`
    : `Invitation acceptance could not be confirmed (${error?.code || 'database_error'}). No password was changed. Retry this same invitation if it is still pending.`);
}

/**
 * Complete an invite only with the user established by the Auth callback.
 * The database RPC remains the authority for invitation ownership and scope.
 */
export async function acceptInvitationWithClient(client, invitationId, fullName, password) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invitationId)) {
    throw new Error('This invitation link is invalid or missing its invitation reference. No password was changed.');
  }
  const normalizedFullName = typeof fullName === 'string' ? fullName.trim() : '';
  if (normalizedFullName.length < 2 || normalizedFullName.length > 120) {
    throw new Error('Enter a full name of 2 to 120 characters before accepting the invitation. No password was changed.');
  }

  const auth = client.auth;
  const { data: sessionData, error: sessionError } = await auth.getSession();
  const session = sessionData?.session;
  if (sessionError || !session) {
    throw new Error('No valid invitation session is active. Reopen the original invitation link and try again.');
  }

  const expectedUserId = session.user?.id;
  const expectedEmail = normalizeEmail(session.user?.email);
  if (!expectedUserId || !expectedEmail || !session.access_token) {
    throw new Error('The invitation session is incomplete. Reopen the original invitation link and try again.');
  }

  let passwordUpdated = false;
  const verifyCurrentSession = async () => {
    const { data: currentSessionData, error: currentSessionError } = await auth.getSession();
    const currentSession = currentSessionData?.session;
    if (currentSessionError || !currentSession
      || currentSession.user?.id !== expectedUserId
      || normalizeEmail(currentSession.user?.email) !== expectedEmail) {
      throw new Error(passwordUpdated
        ? 'Your password was updated, but the signed-in account changed before invitation acceptance. Reopen the original invitation in a private browser window and retry the same invitation.'
        : 'The signed-in account changed during invitation setup. No invitation was accepted; reopen the original invitation in a private browser window.');
    }

    const { data: verifiedData, error: verifyError } = await auth.getUser(currentSession.access_token);
    const verifiedUser = verifiedData?.user;
    if (verifyError || !verifiedUser
      || verifiedUser.id !== expectedUserId
      || normalizeEmail(verifiedUser.email) !== expectedEmail) {
      throw new Error(passwordUpdated
        ? 'Your password was updated, but the invitation account could not be reverified. Reopen the original invitation in a private browser window and retry the same invitation.'
        : 'The invitation account could not be verified. No invitation was accepted; reopen the original invitation in a private browser window.');
    }
  };

  const { data: verifiedData, error: verifyError } = await auth.getUser(session.access_token);
  const verifiedUser = verifiedData?.user;
  if (verifyError || !verifiedUser
    || verifiedUser.id !== expectedUserId
    || normalizeEmail(verifiedUser.email) !== expectedEmail) {
    throw new Error('The active session is not a verified invitation account. No password was changed. Open the original invitation link in a private browser window.');
  }

  let preflightResult;
  try {
    preflightResult = await client.rpc(
      'verify_user_invitation_context',
      { target_invitation_id: invitationId },
    );
  } catch {
    throw new Error('The invitation could not be verified. No password was changed. Reopen the original invitation or contact an administrator.');
  }
  const { data: invitationVerified, error: preflightError } = preflightResult;
  if (preflightError) {
    throw new Error(`The invitation could not be verified (${preflightError.code || 'verification_error'}). No password was changed. Reopen the original invitation or contact an administrator.`);
  }

  // If a prior request committed but its response was lost, the preflight is
  // now false. Ask the idempotent acceptance RPC to confirm the exact user and
  // invitation, including whether an Enumerator is awaiting approval.
  if (invitationVerified !== true) {
    await verifyCurrentSession();
    let acceptanceResult;
    try {
      acceptanceResult = await client.rpc('accept_user_invitation', {
        target_invitation_id: invitationId,
        target_full_name: normalizedFullName,
      });
    } catch {
      throw acceptanceError({ code: 'network_error' }, false);
    }
    const { data, error } = acceptanceResult;
    if (error) throw acceptanceError(error, false);
    if (data !== true && data !== 'pending_approval' && data !== 'approved') {
      throw new Error('This invitation is no longer available or belongs to another account. No password was changed.');
    }
    return { alreadyAccepted: true, outcome: data === true ? 'approved' : data };
  }

  await verifyCurrentSession();
  let passwordResult;
  try {
    passwordResult = await auth.updateUser({ password });
  } catch {
    throw new Error('The password update could not be confirmed. The invitation remains available; retry this same invitation and do not request another one.');
  }
  if (passwordResult.error) {
    throw new Error(`The password update could not be confirmed: ${passwordResult.error.message}. The invitation remains available; retry this same invitation and do not request another one.`);
  }
  passwordUpdated = true;

  await verifyCurrentSession();
  let acceptanceResult;
  try {
    acceptanceResult = await client.rpc('accept_user_invitation', {
      target_invitation_id: invitationId,
      target_full_name: normalizedFullName,
    });
  } catch {
    throw acceptanceError({ code: 'network_error' }, true);
  }
  const { data, error } = acceptanceResult;
  if (error) throw acceptanceError(error, true);
  if (data !== true && data !== 'pending_approval' && data !== 'approved') {
    throw new Error('Your password was updated, but invitation acceptance was not confirmed. Retry this same invitation if it is still pending.');
  }

  return { alreadyAccepted: false, outcome: data === true ? 'approved' : data };
}

export async function finishInvitationSession(client) {
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) {
    throw new Error('The invitation was accepted and your profile was created, but automatic sign-out failed. Your account is set up; sign out manually before returning to sign in.');
  }
}
