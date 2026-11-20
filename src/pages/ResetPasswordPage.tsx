import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPasswordValidationError } from '../lib/passwordValidation.js';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const {
    finishPasswordRecovery,
    isLoading,
    isPasswordRecoveryActive,
    updatePassword,
  } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinishingRecovery, setIsFinishingRecovery] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [error, setError] = useState('');

  const finishRecovery = async (showSuccess: boolean) => {
    setError('');
    setIsFinishingRecovery(true);
    try {
      await finishPasswordRecovery();
      navigate('/login', {
        replace: true,
        state: { passwordResetSuccess: showSuccess },
      });
    } catch {
      setError(passwordUpdated
        ? 'Your password was updated, but the recovery session could not be closed. Try again.'
        : 'The recovery session could not be closed. Try again.');
    } finally {
      setIsFinishingRecovery(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const validationError = getPasswordValidationError(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      await updatePassword(password);
      setPasswordUpdated(true);
      await finishRecovery(true);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update your password. Request a new reset link and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Set a new password</h1>
        {isLoading && <p role="status" className="mt-3 text-sm text-slate-600">Verifying your password reset link…</p>}
        {!isLoading && !isPasswordRecoveryActive && (
          <div className="mt-4 space-y-4">
            <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
              {error || 'This password reset link is invalid or has expired. Request a new link to continue.'}
            </p>
            <Link to="/login" className="inline-block text-sm font-medium text-cyan-700 underline">Return to sign in</Link>
          </div>
        )}
        {!isLoading && isPasswordRecoveryActive && passwordUpdated && (
          <div className="mt-4 space-y-4">
            <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              Your password was updated. Finish the recovery session to return to sign in.
            </p>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
            <button
              type="button"
              onClick={() => void finishRecovery(true)}
              disabled={isFinishingRecovery}
              className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {isFinishingRecovery ? 'Finishing recovery…' : 'Continue to sign in'}
            </button>
          </div>
        )}
        {!isLoading && isPasswordRecoveryActive && !passwordUpdated && (
          <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-4">
            <p className="text-sm text-slate-600">Choose a new password for your account.</p>
            <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
              New Password
              <input
                id="new-password"
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              />
            </label>
            <label htmlFor="confirm-new-password" className="block text-sm font-medium text-slate-700">
              Confirm New Password
              <input
                id="confirm-new-password"
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              />
            </label>
            <button
              type="button"
              onClick={() => setIsPasswordVisible(!isPasswordVisible)}
              aria-label={isPasswordVisible ? 'Hide passwords' : 'Show passwords'}
              aria-pressed={isPasswordVisible}
              className="flex items-center gap-2 text-sm font-medium text-cyan-700"
            >
              {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              {isPasswordVisible ? 'Hide passwords' : 'Show passwords'}
            </button>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {isSaving ? 'Saving password…' : 'Save New Password'}
            </button>
            <button
              type="button"
              onClick={() => void finishRecovery(false)}
              disabled={isFinishingRecovery}
              className="w-full text-sm font-medium text-cyan-700 underline disabled:opacity-50"
            >
              Cancel and return to sign in
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
