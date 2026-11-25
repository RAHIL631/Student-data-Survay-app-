import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { createStudentScreening, getProfile } from '../lib/dataService';
import { supabase } from '../lib/supabase';
import { PENDING_SUBMISSIONS_SYNCED_EVENT, syncPendingSubmissions, stopPendingSubmissionRetries } from '../lib/pendingSubmissionSync';
import {
  endLocalTestSession,
  isLocalTestSessionActive,
  isLocalTestLoginEnabled,
  restoreLocalTestSession,
  startLocalTestSession,
} from '../lib/localTestMode';
import type { AppUser, Role } from '../types';

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
  const explicitLogout = useRef(false);
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
        if (active && requestId === profileLoadId.current) {
          setUser(null);
          setAuthError(error instanceof Error ? error.message : 'Unable to load your account profile.');
          setIsLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
        if (explicitLogout.current) {
          explicitLogout.current = false;
          void restoreProfile(null);
        } else {
          setUser(null);
          setAuthError('Your session expired. Sign in again to continue.');
          setIsLoading(false);
        }
        return;
      }

      if (passwordRecoveryActiveRef.current) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      void restoreProfile(session?.user.id ?? null);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
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

  useEffect(() => {
    if (!user || isLocalTestSessionActive()) {
      return;
    }

    const synchronize = () => {
      void syncPendingSubmissions(user.id, {
        upload: (submission, idempotencyKey) => createStudentScreening(submission, { idempotencyKey }),
      }).then((syncedCount) => {
        if (syncedCount > 0) {
          window.dispatchEvent(new CustomEvent(PENDING_SUBMISSIONS_SYNCED_EVENT, {
            detail: { userId: user.id, syncedCount },
          }));
        }
      }).catch((error: unknown) => console.error('Unable to synchronize pending student submissions.', error));
    };

    synchronize();
    window.addEventListener('online', synchronize);
    return () => {
      window.removeEventListener('online', synchronize);
      stopPendingSubmissionRetries(user.id);
    };
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      authError,
      isPasswordRecoveryActive,
      login: async (email: string, password: string): Promise<AppUser> => {
        if (!supabase) {
          throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your local .env file.');
        }

        const normalizedEmail = email.trim().toLowerCase();
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) {
          console.error('Supabase rejected the sign-in request.', error.message);
          throw new Error('Email or password is incorrect, or this account is unavailable.');
        }

        let profile: Awaited<ReturnType<typeof getProfile>>;
        try {
          profile = await getProfile(data.user.id);
        } catch (profileError) {
          explicitLogout.current = true;
          try {
            const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
            if (signOutError) {
              console.error('Unable to close an unapproved account session.', signOutError.message);
            }
          } catch (signOutError) {
            console.error('Unable to close an unapproved account session.', signOutError);
          } finally {
            explicitLogout.current = false;
            setUser(null);
            setAuthError(null);
          }
          throw profileError;
        }
        setUser(profile);
        setAuthError(null);
        return profile;
      },
      requestPasswordReset: async (email: string) => {
        if (!supabase) {
          throw new Error('Password recovery is unavailable until Supabase is configured.');
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          console.error('Unable to request password recovery.', error);
          throw new Error('The password recovery email could not be sent. Check the address and try again.');
        }
      },
      updatePassword: async (password: string) => {
        if (!supabase) {
          throw new Error('Password changes are unavailable until Supabase is configured.');
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
          console.error('Unable to update the account password.', error);
          throw new Error('The password could not be updated. Check the password requirements and try again.');
        }
      },
      finishPasswordRecovery: async () => {
        if (!supabase) {
          throw new Error('Supabase is not configured.');
        }

        explicitLogout.current = true;
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) {
          explicitLogout.current = false;
          throw new Error('The recovery session could not be closed. Try again.');
        }

        setPasswordRecoveryActive(false);
        profileLoadId.current += 1;
        setUser(null);
        setAuthError(null);
        setIsLoading(false);
      },
      loginAsLocalTestUser: async (role: Role): Promise<AppUser> => {
        if (!isLocalTestLoginEnabled) {
          throw new Error('Temporary local sign-in is not enabled.');
        }
        const profile = startLocalTestSession(role);
        setUser(profile);
        setAuthError(null);
        return profile;
      },
      acceptInvitation: async (invitationId: string, password: string, fullName: string) => {
        if (!supabase) {
          throw new Error('Supabase is not configured.');
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw new Error('The invitation session could not be verified.');
        }
        if (!session) {
          throw new Error('The invitation link is invalid or has expired. Open the link from your invitation email again.');
        }

        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) {
          throw new Error(passwordError.message);
        }

        const { data, error } = await supabase.rpc('accept_user_invitation', {
          target_invitation_id: invitationId,
          target_full_name: fullName.trim(),
        });
        if (error) {
          console.error('Invitation acceptance RPC failed.', { code: error.code });
          if (error.code === '42501') {
            throw new Error('Your password was updated, but the invitation could not be accepted for this account. It may no longer be pending. Do not request another invitation; ask an administrator to check the existing invitation.');
          }
          throw new Error('Your password was updated, but invitation acceptance could not be confirmed. Do not request another invitation; ask an administrator to check the existing invitation before retrying.');
        }
        if (data !== 'pending_approval' && data !== 'approved') {
          throw new Error('Your password was updated, but invitation acceptance could not be confirmed. Do not request another invitation; ask an administrator to check the existing invitation before retrying.');
        }

        if (data === 'pending_approval') {
          explicitLogout.current = true;
          const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
          if (signOutError) {
            explicitLogout.current = false;
            throw new Error('Your account was set up, but this invitation session could not be closed. Sign out, then wait for administrator approval before signing in.');
          }
          profileLoadId.current += 1;
          setUser(null);
          setAuthError(null);
          setIsLoading(false);
          return data;
        }

        const profile = await getProfile(session.user.id);
        profileLoadId.current += 1;
        setUser(profile);
        setAuthError(null);
        return data;
      },
      logout: async () => {
        if (!supabase) {
          endLocalTestSession();
          setUser(null);
          setAuthError(null);
          return;
        }

        endLocalTestSession();
        explicitLogout.current = true;
        const { error } = await supabase.auth.signOut();
        if (error) {
          explicitLogout.current = false;
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
