import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { getProfile } from '../lib/dataService';
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

        const profile = await getProfile(data.user.id);
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
      acceptInvitation: async (invitationId: string, password: string) => {
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
        });
        if (error || data !== true) {
          throw new Error('This invitation cannot be accepted. It may have been cancelled or already used.');
        }

        const profile = await getProfile(session.user.id);
        profileLoadId.current += 1;
        setUser(profile);
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
