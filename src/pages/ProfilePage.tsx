import { Building2, KeyRound, Mail, MapPinned, ShieldCheck, UserRound } from 'lucide-react';
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
  const {
    data: organization,
    isLoading: isLoadingOrganization,
    error: organizationError,
    reload: reloadOrganization,
  } = useRemoteData(loadOrganization);
  const {
    data: districts,
    isLoading: isLoadingDistricts,
    error: districtsError,
    reload: reloadDistricts,
  } = useRemoteData(getDistricts);

  const district = districts?.find((item) => item.id === user?.districtId);
  const profileDetails = [
    { label: 'Email address', value: user?.email ?? 'Not available', icon: Mail },
    {
      label: 'Organization',
      value: isLoadingOrganization ? 'Loading organization…' : organization ?? 'Not available',
      icon: Building2,
    },
    {
      label: 'District',
      value: isLoadingDistricts
        ? 'Loading district…'
        : district?.name ?? (user?.districtId ? 'Assigned district' : 'Organization-wide'),
      icon: MapPinned,
    },
  ];

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
      <header className="page-heading">
        <div>
          <p className="page-heading__eyebrow">Account</p>
          <h2 className="text-2xl font-bold text-slate-900">Profile</h2>
          <p className="mt-1 text-sm text-slate-600">Review your account details and keep your sign-in secure.</p>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-2">
        <section aria-labelledby="account-details-heading" className="card overflow-hidden !p-0">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 px-5 py-6 text-white sm:px-7">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-cyan-100">
                <UserRound size={27} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Signed-in account</p>
                <h3 id="account-details-heading" className="mt-1 truncate text-xl font-bold">
                  {user?.name ?? 'User'}
                </h3>
                <span className="mt-2 inline-flex rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-100">
                  {user ? getRoleLabel(user.role) : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>

          <dl className="divide-y divide-slate-100 px-5 sm:px-7">
            {profileDetails.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex min-w-0 items-start gap-3 py-4">
                <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-500">
                  <Icon size={17} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd>
                </div>
              </div>
            ))}
          </dl>

          {(organizationError || districtsError) && (
            <div className="space-y-2 border-t border-slate-100 px-5 py-4 sm:px-7">
              {organizationError && <p role="alert" className="text-sm text-rose-700">Organization details could not be loaded. <button type="button" onClick={reloadOrganization} className="font-semibold underline underline-offset-2">Try again</button></p>}
              {districtsError && <p role="alert" className="text-sm text-rose-700">District details could not be loaded. <button type="button" onClick={reloadDistricts} className="font-semibold underline underline-offset-2">Try again</button></p>}
            </div>
          )}
        </section>

        <section aria-labelledby="password-heading" className="card space-y-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-800"><KeyRound size={20} aria-hidden="true" /></div>
            <div>
              <h3 id="password-heading" className="text-lg font-bold text-slate-900">Password & security</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">Choose a unique password and do not share your account with other screening staff.</p>
            </div>
          </div>

          {isSupabaseConfigured ? (
            <form onSubmit={(event) => void handlePasswordUpdate(event)} className="space-y-4">
              <label htmlFor="profile-new-password" className="block text-sm font-semibold text-slate-700">
                New password
                <input id="profile-new-password" required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal" />
              </label>
              <label htmlFor="profile-confirm-password" className="block text-sm font-semibold text-slate-700">
                Confirm new password
                <input id="profile-confirm-password" required type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal" />
              </label>
              <p className="text-xs leading-5 text-slate-500">Use at least 8 characters. You can also use this form after opening a password recovery link.</p>
              {passwordError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{passwordError}</p>}
              {passwordMessage && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{passwordMessage}</p>}
              <button type="submit" disabled={isSavingPassword} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 font-semibold text-white transition hover:bg-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 disabled:cursor-wait disabled:opacity-60">
                <ShieldCheck size={17} aria-hidden="true" />
                {isSavingPassword ? 'Updating password…' : 'Update password'}
              </button>
            </form>
          ) : (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              Password changes are unavailable until the application is connected to its authentication backend.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
