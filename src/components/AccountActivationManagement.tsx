import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRemoteData } from '../hooks/useRemoteData';
import { getOrganizationProfiles, setProfileActive } from '../lib/dataService';

export function AccountActivationManagement() {
  const { user } = useAuth();
  const { data: profiles, isLoading, error, reload } = useRemoteData(getOrganizationProfiles);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const changeStatus = async (profileId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    if (!nextStatus && !window.confirm('Deactivate this account? It will lose access to protected Student Health Hub data immediately.')) return;
    setSavingId(profileId);
    setActionError('');
    try {
      await setProfileActive(profileId, nextStatus);
      reload();
    } catch (statusError) {
      console.error('Unable to change account status.', statusError);
      setActionError(statusError instanceof Error ? statusError.message : 'Account status could not be changed.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="card space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Account access</h3>
        <p className="mt-1 text-sm text-slate-600">Only an active organization administrator can change another organization member’s access. Status changes are recorded in the audit log.</p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">Account list could not be loaded: {error} <button onClick={reload} className="underline">Retry</button></p>}
      {actionError && <p role="alert" className="text-sm text-rose-700">{actionError}</p>}
      {isLoading && <p role="status" className="text-sm text-slate-500">Loading organization accounts…</p>}
      {!isLoading && !error && !profiles?.length && <p className="text-sm text-slate-500">No organization profiles are available.</p>}
      {!!profiles?.length && (
        <div className="table-shell">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td>{profile.name}</td>
                  <td>{profile.email}</td>
                  <td className="capitalize">{profile.role.replace('_', ' ')}</td>
                  <td>{profile.isActive ? 'Active' : 'Inactive'}</td>
                  <td>
                    {profile.id === user?.id ? <span className="text-slate-500">Current account</span> : (
                      <button
                        type="button"
                        disabled={savingId === profile.id}
                        onClick={() => void changeStatus(profile.id, profile.isActive)}
                        className={`font-medium underline disabled:opacity-50 ${profile.isActive ? 'text-rose-700' : 'text-emerald-700'}`}
                      >
                        {savingId === profile.id ? 'Saving…' : profile.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
