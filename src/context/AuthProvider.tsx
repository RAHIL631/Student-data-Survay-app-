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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Awaited<ReturnType<typeof getProfile>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const explicitLogout = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setUser(restoreLocalTestSession());
      setIsLoading(false);
      return;
    }

    let active = true;
    const restoreProfile = async (userId: string | null) => {
      if (!userId) {
        if (active) {
          setUser(null);
          setAuthError(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const profile = await getProfile(userId);
        if (active) {
          setUser(profile);
          setAuthError(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Unable to load the authenticated account profile.', error);
        if (active) {
          setUser(null);
          setAuthError(error instanceof Error ? error.message : 'Unable to load your account profile.');
          setIsLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
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
      login: async (email: string, password: string): Promise<AppUser> => {
        if (!supabase) {
          throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your local .env file.');
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          console.error('Supabase rejected the sign-in request.', error.message);
          throw new Error('Email or password is incorrect, or this account is unavailable.');
        }

        const profile = await getProfile(data.user.id);
        setUser(profile);
        setAuthError(null);
        return profile;
      },
      requestPasswordReset: async (email: string): Promise<void> => {
        if (!supabase) {
          throw new Error('Password recovery is unavailable until Supabase is configured.');
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
        if (error) {
          console.error('Unable to request password recovery.', error);
          throw new Error('The password recovery email could not be sent. Check the address and try again.');
        }
      },
      updatePassword: async (password: string): Promise<void> => {
        if (!supabase) {
          throw new Error('Password changes are unavailable until Supabase is configured.');
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          console.error('Unable to update the account password.', error);
          throw new Error('The password could not be updated. Check the password requirements and try again.');
        }
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
    [user, isLoading, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
