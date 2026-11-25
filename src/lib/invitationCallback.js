function parameters(searchOrHash) {
  const value = typeof searchOrHash === 'string' ? searchOrHash : '';
  return new URLSearchParams(value.startsWith('#') || value.startsWith('?') ? value.slice(1) : value);
}

/** Return a safe, non-token error for Auth callback failures on an invite URL. */
export function getInvitationCallbackError(search, hash) {
  const query = parameters(search);
  const fragment = parameters(hash);
  const errorCode = query.get('error_code') || fragment.get('error_code') || '';
  const error = query.get('error') || fragment.get('error') || '';
  const description = query.get('error_description') || fragment.get('error_description') || '';

  if (!errorCode && !error && !description) return null;
  if (/expired|invalid|otp/i.test(`${errorCode} ${error} ${description}`)) {
    return 'This invitation link is invalid or expired. Ask an organization administrator to check the existing invitation before requesting any replacement.';
  }
  return 'Supabase could not establish a session from this invitation link. Reopen the original email link or ask an organization administrator to check the existing invitation.';
}

/** Wait for Supabase URL-token processing and handle direct invite token_hash links. */
export async function restoreInvitationSession(auth, href, options = {}) {
  const initialUrl = new URL(href);
  let callbackError = getInvitationCallbackError(initialUrl.search, initialUrl.hash);

  if (initialUrl.pathname.endsWith('/accept-invitation')
    && initialUrl.searchParams.has('token_hash')) {
    const tokenHash = initialUrl.searchParams.get('token_hash');
    const tokenType = initialUrl.searchParams.get('type');
    if (!callbackError) {
      if ((tokenType !== 'invite' && tokenType !== 'recovery') || !tokenHash) {
        callbackError = 'This invitation link is invalid or expired. Ask an organization administrator to check the existing invitation.';
      } else {
        try {
          const { data, error } = await auth.verifyOtp({ token_hash: tokenHash, type: tokenType });
          if (error || !data?.session?.user?.id) {
            callbackError = 'This invitation link is invalid or expired. Ask an organization administrator to check the existing invitation.';
          }
        } catch {
          callbackError = 'Supabase could not establish a session from this invitation link. Reopen the original email link or ask an organization administrator to check the existing invitation.';
        }
      }
    }
    initialUrl.searchParams.delete('token_hash');
    initialUrl.searchParams.delete('type');
    options.replaceUrl?.(`${initialUrl.pathname}${initialUrl.search}${initialUrl.hash}`);
  }

  let session = null;
  try {
    const { data, error } = await auth.getSession();
    session = data?.session ?? null;
    if (error && !callbackError) {
      callbackError = 'Supabase could not establish a session from this invitation link. Reopen the original email link or ask an organization administrator to check the existing invitation.';
    }
  } catch {
    callbackError ||= 'Supabase could not establish a session from this invitation link. Reopen the original email link or ask an organization administrator to check the existing invitation.';
  }

  const currentUrl = new URL(options.getCurrentUrl?.() || href);
  if (!callbackError
    && !session
    && currentUrl.pathname.endsWith('/accept-invitation')
    && currentUrl.searchParams.has('code')) {
    callbackError = 'This invitation link could not be exchanged for a valid session. Reopen the original email link or ask an organization administrator to check it.';
  }

  return { session, error: callbackError };
}
