import { LogIn, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { isLocalTestLoginEnabled } from '../lib/localTestMode';
import { getHomeRoute } from '../lib/permissions';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login,
    loginAsLocalTestEnumerator,
    requestPasswordReset,
    authError,
    user,
    isLoading,
    isPasswordRecoveryActive,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingLocalSession, setIsStartingLocalSession] = useState(false);

  useEffect(() => {
    if (!isLoading && isPasswordRecoveryActive) {
      navigate('/reset-password', { replace: true });
    } else if (!isLoading && user) {
      navigate(`/${getHomeRoute(user.role)}`, { replace: true });
    }
  }, [isLoading, isPasswordRecoveryActive, navigate, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      if (isForgotPassword) {
        await requestPasswordReset(email);
        setMessage('If an account exists for this email, a password reset link has been sent.');
        return;
      }

      const profile = await login(email, password);
      navigate(`/${getHomeRoute(profile.role)}`, { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error
        ? loginError.message
        : isForgotPassword ? 'Unable to request a password reset. Try again.' : 'Unable to sign in. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocalTestLogin = async () => {
    setError('');
    setIsStartingLocalSession(true);
    try {
      await loginAsLocalTestEnumerator();
      navigate('/dashboard');
    } catch (loginError) {
      console.error('Unable to start local test session.', loginError);
      setError(loginError instanceof Error ? loginError.message : 'Unable to start local test session.');
    } finally {
      setIsStartingLocalSession(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-3 sm:p-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
        <div className="grid md:grid-cols-2">
          <div className="bg-slate-950 p-6 text-slate-50 sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-cyan-500/20 p-2 text-cyan-300"><ShieldCheck size={18} /></div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">School health</p>
                <h1 className="text-2xl font-bold">Student Health Hub</h1>
              </div>
            </div>
            <h2 className="text-3xl font-bold leading-tight">Secure student screening, reporting, and operations management.</h2>
            <p className="mt-4 max-w-md text-sm text-slate-300">
              Manage health screening sessions, student records, assignments, reporting, and one-click export workflows with role-based access.
            </p>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 p-6 sm:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-700">Supabase sign in</p>
              <h3 className="mt-2 text-2xl font-bold text-slate-900">
                {isForgotPassword ? 'Reset your password' : 'Access the application'}
              </h3>
            </div>

            {location.state?.passwordResetSuccess && (
              <div role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Your password has been updated. Sign in with your new password.
              </div>
            )}
            {location.state?.invitationAccepted && (
              <div role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Your account is ready. Sign in with the password you just created.
              </div>
            )}
            {!isSupabaseConfigured && (
              <div role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Backend not configured. Add your Supabase project URL and public anon key to a local <code>.env</code> file, then restart the app.
              </div>
            )}
            {authError && !error && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{authError}</div>}

            <div>
              <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-cyan-500" />
            </div>

            {!isForgotPassword && (
              <div>
                <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-cyan-500" />
              </div>
            )}

            {message && <div role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
            {error && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

            <button type="submit" disabled={!isSupabaseConfigured || isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50">
              {!isForgotPassword && <LogIn size={18} />}
              {isSubmitting
                ? isForgotPassword ? 'Sending reset link…' : 'Signing in…'
                : isForgotPassword ? 'Send reset link' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(!isForgotPassword);
                setError('');
                setMessage('');
              }}
              className="w-full text-sm font-medium text-cyan-700 underline"
            >
              {isForgotPassword ? 'Back to sign in' : 'Forgot password?'}
            </button>
            {isLocalTestLoginEnabled && (
              <div className="space-y-2 border-t border-slate-200 pt-4">
                <p className="text-xs text-amber-800">Temporary local test access. This is not a real account and will not sync data to Supabase.</p>
                <button type="button" onClick={() => void handleLocalTestLogin()} disabled={isStartingLocalSession} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50">
                  {isStartingLocalSession ? 'Starting…' : 'Continue as local enumerator'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
