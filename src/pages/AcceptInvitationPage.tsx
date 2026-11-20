import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { acceptInvitation, isLoading } = useAuth();
  const invitationId = searchParams.get('invitation_id');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!invitationId) {
      setError('The invitation link is missing its invitation reference.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await acceptInvitation(invitationId, password);
      navigate('/dashboard', { replace: true });
    } catch (acceptError: unknown) {
      setError(acceptError instanceof Error ? acceptError.message : 'The invitation could not be accepted.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Accept your invitation</h1>
        {isLoading && <p role="status" className="mt-3 text-sm text-slate-600">Verifying your invitation…</p>}
        {!isLoading && invitationId && (
          <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-4">
            <p className="text-sm text-slate-600">Choose a password to finish setting up your account.</p>
            <label className="block text-sm font-medium text-slate-700">
              New password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Confirm password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              />
            </label>
            <button type="submit" disabled={isSaving} className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
              {isSaving ? 'Setting password…' : 'Set password and accept invitation'}
            </button>
          </form>
        )}
        {!isLoading && !invitationId && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
            The invitation link is missing its invitation reference.
          </p>
        )}
        {error && (
          <div className="mt-4 space-y-3">
            <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>
            <Link to="/login" className="inline-block text-sm font-medium text-cyan-700 underline">Return to sign in</Link>
          </div>
        )}
      </section>
    </main>
  );
}
