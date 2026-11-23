import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { getProfile, InactiveProfileError } from '../lib/dataService';
import { supabase } from '../lib/supabase';
import {
  endLocalTestSession,
  isLocalTestLoginEnabled,
  restoreLocalTestSession,
  startLocalTestSession,
} from '../lib/localTestMode';

const PASSWORD_RECOVERY_STORAGE_KEY = 'student-health-hub:password-recovery';

function readPasswordRecoveryState() {
  try {
    return window.sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === 'active';
  } catch (error) {
    console.error('Unable to restore the password recovery state.', error);
    return false;
  }
}

function persistPasswordRecoveryState(isActive: boolean) {
  try {
    if (isActive) {
      window.sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, 'active');
    } else {
      window.sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Unable to persist the password recovery state.', error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Awaited<ReturnType<typeof getProfile>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPasswordRecoveryActive, setIsPasswordRecoveryActive] = useState(readPasswordRecoveryState);
  const profileLoadId = useRef(0);
  const passwordRecoveryActiveRef = useRef(isPasswordRecoveryActive);

  const setPasswordRecoveryActive = (isActive: boolean) => {
    passwordRecoveryActiveRef.current = isActive;
    persistPasswordRecoveryState(isActive);
    setIsPasswordRecoveryActive(isActive);
  };

  useEffect(() => {
    if (!supabase) {
      setPasswordRecoveryActive(false);
      setUser(restoreLocalTestSession());
      setIsLoading(false);
      return;
    }
    const authClient = supabase;

    let active = true;
    const restoreProfile = async (userId: string | null) => {
      const requestId = ++profileLoadId.current;
      if (passwordRecoveryActiveRef.current) {
        if (active && requestId === profileLoadId.current) {
          setUser(null);
          setAuthError(null);
          setIsLoading(false);
        }
        return;
      }

      if (!userId) {
        if (active && requestId === profileLoadId.current) {
          setUser(null);
          setAuthError(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const profile = await getProfile(userId);
        if (active && requestId === profileLoadId.current) {
          setUser(profile);
          setAuthError(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Unable to load the authenticated account profile.', error);
        if (error instanceof InactiveProfileError) {
          await authClient.auth.signOut({ scope: 'local' });
        }
        if (active && requestId === profileLoadId.current) {
          setUser(null);
          setAuthError(error instanceof Error ? error.message : 'Unable to load your account profile.');
          setIsLoading(false);
        }
      }
    };

    const { data: { subscription } } = authClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryActive(true);
        profileLoadId.current += 1;
        setUser(null);
        setAuthError(null);
        setIsLoading(false);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setPasswordRecoveryActive(false);
      }

      if (passwordRecoveryActiveRef.current) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      void restoreProfile(session?.user.id ?? null);
    });

    void authClient.auth.getSession().then(({ data, error }) => {
      if (error) {
        throw error;
      }
      return restoreProfile(data.session?.user.id ?? null);
    }).catch((error: unknown) => {
      console.error('Unable to restore the Supabase session.', error);
      if (active) {
        setAuthError(error instanceof Error ? error.message : 'Unable to restore the Supabase session.');
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      authError,
      isPasswordRecoveryActive,
      login: async (email: string, password: string) => {
        if (!supabase) {
          throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your local .env file.');
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw new Error(error.message);
        }

        let profile;
        try {
          profile = await getProfile(data.user.id);
        } catch (profileError) {
          if (profileError instanceof InactiveProfileError) {
            await supabase.auth.signOut({ scope: 'local' });
          }
          throw profileError;
        }
        setUser(profile);
        setAuthError(null);
        return profile;
      },
      requestPasswordReset: async (email: string) => {
        if (!supabase) {
          throw new Error('Supabase is not configured.');
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          throw new Error(error.message);
        }
      },
      updatePassword: async (password: string) => {
        if (!supabase) {
          throw new Error('Supabase is not configured.');
        }
        if (!passwordRecoveryActiveRef.current) {
          throw new Error('Open a valid password reset link before setting a new password.');
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw new Error('The password recovery session could not be verified.');
        }
        if (!data.session) {
          setPasswordRecoveryActive(false);
          throw new Error('This password reset link is invalid or has expired. Request a new link and try again.');
        }

        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          throw new Error(error.message);
        }
      },
      finishPasswordRecovery: async () => {
        if (!supabase) {
          throw new Error('Supabase is not configured.');
        }

        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) {
          throw new Error(error.message);
        }

        setPasswordRecoveryActive(false);
        profileLoadId.current += 1;
        setUser(null);
        setAuthError(null);
        setIsLoading(false);
      },
      loginAsLocalTestEnumerator: async () => {
        if (!isLocalTestLoginEnabled) {
          throw new Error('Temporary local sign-in is not enabled.');
        }
        setUser(startLocalTestSession());
        setAuthError(null);
      },
      acceptInvitation: async (invitationId: string, fullName: string, password: string) => {
        if (!supabase) {
          throw new Error('Supabase is not configured.');
        }
        const authClient = supabase;

        const { data: { session }, error: sessionError } = await authClient.auth.getSession();
        if (sessionError) {
          throw new Error('The invitation session could not be verified. Sign out of other accounts and reopen the invitation in a private browser window.');
        }
        if (!session) {
          throw new Error('No invitation session is active. Sign out of other accounts, then reopen the invitation link in a private browser window.');
        }

        let passwordUpdated = false;
        const verifyCurrentSession = async (expectedUserId: string, expectedEmail: string) => {
          const { data: { session: currentSession }, error: currentSessionError } = await authClient.auth.getSession();
          if (currentSessionError || !currentSession
            || currentSession.user.id !== expectedUserId
            || currentSession.user.email?.trim().toLowerCase() !== expectedEmail) {
            const statusMessage = passwordUpdated
              ? 'Your password was updated, but invitation acceptance was not confirmed.'
              : 'No password was changed.';
            throw new Error(`${statusMessage} This browser session changed during invitation setup. Reopen the original invitation in a private browser window.`);
          }

          const { data: { user: verifiedUser }, error: verifyError } = await authClient.auth.getUser(currentSession.access_token);
          if (verifyError || !verifiedUser
            || verifiedUser.id !== expectedUserId
            || verifiedUser.email?.trim().toLowerCase() !== expectedEmail) {
            throw new Error('The signed-in account could not be verified as the invited user. Sign out of other accounts and reopen the invitation in a private browser window.');
          }
        };

        const { data: { user: verifiedUser }, error: verifyError } = await authClient.auth.getUser(session.access_token);
        const expectedEmail = session.user.email?.trim().toLowerCase();
        if (verifyError || !verifiedUser || !expectedEmail
          || verifiedUser.id !== session.user.id
          || verifiedUser.email?.trim().toLowerCase() !== expectedEmail) {
          throw new Error('The active browser session does not match a verified invitation account. Sign out of other accounts and reopen the invitation in a private browser window.');
        }

        const { data: invitationVerified, error: preflightError } = await authClient.rpc(
          'verify_user_invitation_context',
          { target_invitation_id: invitationId },
        );
        if (preflightError || invitationVerified !== true) {
          throw new Error('This invitation is not available for password setup, or we could not verify the current session. No password was changed. If you already completed setup, return to the sign-in page. Otherwise, sign out of other accounts and reopen the original invitation in a private browser window.');
        }

        await verifyCurrentSession(verifiedUser.id, expectedEmail);

        const { error: passwordError } = await authClient.auth.updateUser({ password });
        if (passwordError) {
          throw new Error(passwordError.message);
        }
        passwordUpdated = true;

        await verifyCurrentSession(verifiedUser.id, expectedEmail);

        const { data, error } = await authClient.rpc('accept_user_invitation', {
          target_invitation_id: invitationId,
          target_full_name: fullName.trim(),
        });
        if (error) {
          if (error.code === '23505') {
            throw new Error('Your password was updated, but a profile already exists for this email. Do not request another invitation; contact an organization administrator to reconcile the account.');
          }
          if (error.code === '42501') {
            throw new Error('Your password was updated, but this invitation was not accepted for the current session. Sign out of other accounts and reopen the original invitation in a private browser window. Do not request another invitation; ask an administrator to check its status if the problem continues.');
          }
          throw new Error(`Your password was updated, but invitation acceptance could not be confirmed (${error.code || 'database_error'}). Retry this same invitation if it is still pending; do not request another invitation. Contact an administrator if the result remains unclear.`);
        }
        if (data !== true) {
          throw new Error('Your password was updated, but no invitation acceptance was confirmed. Retry this same invitation if it is still pending; do not request another invitation.');
        }

        const { error: signOutError } = await authClient.auth.signOut({ scope: 'local' });
        if (signOutError) {
          throw new Error('The invitation was accepted and your profile was created, but automatic sign-out failed. Your account is set up; sign out manually before returning to the sign-in page.');
        }
        profileLoadId.current += 1;
        setUser(null);
        setAuthError(null);
      },
      logout: async () => {
        if (!supabase) {
          endLocalTestSession();
          setUser(null);
          setAuthError(null);
          return;
        }

        const { error } = await supabase.auth.signOut();
        if (error) {
          throw new Error(error.message);
        }

        setUser(null);
        setAuthError(null);
      },
    }),
    [user, isLoading, authError, isPasswordRecoveryActive],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
