import { useCallback, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRemoteData } from '../hooks/useRemoteData';
import { getDistricts, getOrganizationName } from '../lib/dataService';
import { getRoleLabel } from '../lib/permissions';
import { isSupabaseConfigured } from '../lib/supabase';

export function ProfilePage() {
  const { user, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const loadOrganization = useCallback(() => getOrganizationName(user?.organizationId ?? ''), [user?.organizationId]);
  const { data: organization, isLoading, error } = useRemoteData(loadOrganization);
  const { data: districts } = useRemoteData(getDistricts);

  const handlePasswordUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (password.length < 8) {
      setPasswordError('Use at least 8 characters for the new password.');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('The passwords do not match.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await updatePassword(password);
      setPassword('');
      setConfirmPassword('');
      setPasswordMessage('Password updated successfully.');
    } catch (error) {
      console.error('Unable to update the profile password.', error);
      setPasswordError(error instanceof Error ? error.message : 'The password could not be updated.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Profile</h2>
      <div className="card max-w-xl">
        <div className="space-y-3 text-sm text-slate-700">
          <div><span className="font-semibold">Name:</span> {user?.name}</div>
          <div><span className="font-semibold">Email:</span> {user?.email}</div>
          <div><span className="font-semibold">Role:</span> {user ? getRoleLabel(user.role) : 'Unavailable'}</div>
          <div><span className="font-semibold">Organization:</span> {isLoading ? 'Loading…' : organization ?? 'Unavailable'}</div>
          {error && <div role="alert" className="text-rose-700">Organization could not be loaded: {error}</div>}
          <div><span className="font-semibold">District:</span> {districts?.find((district) => district.id === user?.districtId)?.name ?? (user?.districtId ? 'Assigned district' : 'Organization-wide')}</div>
        </div>
        {isSupabaseConfigured && <form onSubmit={(event) => void handlePasswordUpdate(event)} className="card max-w-xl space-y-4">
          <div><h3 className="font-semibold text-slate-900">Change password</h3><p className="mt-1 text-sm text-slate-500">Use this form after opening a password recovery link or to update your current password.</p></div>
          <label className="block text-sm font-medium text-slate-700">New password<input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="block text-sm font-medium text-slate-700">Confirm new password<input required type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          {passwordError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{passwordError}</p>}
          {passwordMessage && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{passwordMessage}</p>}
          <button type="submit" disabled={isSavingPassword} className="rounded-xl bg-cyan-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{isSavingPassword ? 'Updating…' : 'Update password'}</button>
        </form>}
      </div>
    </div>
  );
}
