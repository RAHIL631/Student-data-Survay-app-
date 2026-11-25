import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { getProfile, InactiveProfileError, PendingApprovalError } from '../lib/dataService';
import { acceptInvitationWithClient, finishInvitationSession } from '../lib/invitationAcceptance.js';
import { restoreInvitationSession } from '../lib/invitationCallback.js';
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
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [invitationCallbackError, setInvitationCallbackError] = useState<string | null>(null);
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
      setIsAuthReady(true);
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
        if (error instanceof InactiveProfileError || error instanceof PendingApprovalError) {
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

    void restoreInvitationSession(authClient.auth, window.location.href, {
      getCurrentUrl: () => window.location.href,
      replaceUrl: (url) => window.history.replaceState(window.history.state, '', url),
    }).then(({ session, error: callbackError }) => {
      if (active) {
        setInvitationCallbackError(callbackError);
        setIsAuthReady(true);
      }
      return restoreProfile(session?.user?.id ?? null);
    }).catch((error: unknown) => {
      console.error('Unable to restore the Supabase session.', error);
      if (active) {
        setAuthError(error instanceof Error ? error.message : 'Unable to restore the Supabase session.');
        setIsAuthReady(true);
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
      isAuthReady,
      invitationCallbackError,
      authError,
      isPasswordRecoveryActive,
      login: async (email: string, password: string) => {
        if (!supabase) {
          throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your local .env file.');
        }

        // A restored session may have failed profile loading before the user
        // explicitly signs in. Clear that stale warning so it cannot be
        // displayed alongside the result of this sign-in attempt.
        setAuthError(null);
        const normalizedEmail = email.trim().toLowerCase();
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) {
          throw new Error(error.message);
        }

        let profile;
        try {
          profile = await getProfile(data.user.id);
        } catch (profileError) {
          if (profileError instanceof InactiveProfileError || profileError instanceof PendingApprovalError) {
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

        const normalizedEmail = email.trim().toLowerCase();
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
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
        const { outcome } = await acceptInvitationWithClient(supabase, invitationId, fullName, password);
        if (outcome === 'pending_approval') {
          await finishInvitationSession(supabase);
          profileLoadId.current += 1;
          setUser(null);
          setAuthError(null);
          return outcome;
        }
        await finishInvitationSession(supabase);
        profileLoadId.current += 1;
        setUser(null);
        setAuthError(null);
        return outcome;
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
    [user, isLoading, isAuthReady, invitationCallbackError, authError, isPasswordRecoveryActive],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
