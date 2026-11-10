import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import { createStudentScreening, getProfile } from '../lib/dataService';
import { supabase } from '../lib/supabase';
import { syncPendingSubmissions, stopPendingSubmissionRetries } from '../lib/pendingSubmissionSync';
import {
  endLocalTestSession,
  isLocalTestSessionActive,
  isLocalTestLoginEnabled,
  restoreLocalTestSession,
  startLocalTestSession,
} from '../lib/localTestMode';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Awaited<ReturnType<typeof getProfile>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      }).catch((error: unknown) => {
        console.error('Unable to synchronize pending student submissions.', error);
      });
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
      },
      loginAsLocalTestEnumerator: async () => {
        if (!isLocalTestLoginEnabled) {
          throw new Error('Temporary local sign-in is not enabled.');
        }
        setUser(startLocalTestSession());
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
    [user, isLoading, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
