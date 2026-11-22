import { useState, type FormEvent } from 'react';
import { useRemoteData } from '../hooks/useRemoteData';
import { getOrganizationProfiles, getOwnerDataGrants, setOwnerDataGrant } from '../lib/dataService';

export function ViewerAccessManagement() {
  const { data: profiles, isLoading: profilesLoading, error: profilesError } = useRemoteData(getOrganizationProfiles);
  const { data: grants, isLoading: grantsLoading, error: grantsError, reload } = useRemoteData(getOwnerDataGrants);
  const [viewerId, setViewerId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');

  const viewers = (profiles ?? []).filter((profile) => profile.role === 'district_manager' && profile.isActive && profile.districtId);
  const selectedViewer = viewers.find((viewer) => viewer.id === viewerId);
  const faculty = (profiles ?? []).filter((profile) => profile.role === 'enumerator'
    && profile.isActive && selectedViewer?.districtId === profile.districtId);

  const updateGrant = async (targetViewerId: string, targetOwnerId: string, shouldGrant: boolean) => {
    setSaving(true);
    setActionError('');
    setMessage('');
    try {
      await setOwnerDataGrant(targetViewerId, targetOwnerId, shouldGrant);
      setMessage(shouldGrant ? 'Viewer access granted.' : 'Viewer access revoked.');
      await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Viewer access could not be changed.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!viewerId || !ownerId) return;
    await updateGrant(viewerId, ownerId, true);
    setOwnerId('');
  };

  const profileName = (profileId: string) => profiles?.find((profile) => profile.id === profileId)?.name ?? 'Unavailable profile';
  const visibleGrants = (grants ?? []).filter((grant) => {
    const viewer = profiles?.find((profile) => profile.id === grant.viewerId);
    const owner = profiles?.find((profile) => profile.id === grant.ownerId);
    return viewer?.role === 'district_manager' && owner?.role === 'enumerator';
  });

  return (
    <section className="card space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Viewer access</h3>
        <p className="mt-1 text-sm text-slate-600">Viewers can read screening data only for same-district faculty you grant here. Only active organization administrators can change grants.</p>
      </div>
      {profilesError && <p role="alert" className="text-sm text-rose-700">Viewer and faculty lists could not be loaded: {profilesError}</p>}
      {grantsError && <p role="alert" className="text-sm text-rose-700">Viewer grants could not be loaded: {grantsError} <button type="button" onClick={reload} className="underline">Retry</button></p>}
      {actionError && <p role="alert" className="text-sm text-rose-700">{actionError}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      <form onSubmit={(event) => void submit(event)} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm font-medium text-slate-700">Viewer
          <select required value={viewerId} onChange={(event) => { setViewerId(event.target.value); setOwnerId(''); }} disabled={profilesLoading} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <option value="">Select viewer</option>
            {viewers.map((viewer) => <option key={viewer.id} value={viewer.id}>{viewer.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Screening faculty
          <select required value={ownerId} onChange={(event) => setOwnerId(event.target.value)} disabled={!selectedViewer || profilesLoading} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <option value="">Select faculty</option>
            {faculty.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={saving || profilesLoading || !viewers.length || !faculty.length} className="self-end rounded-xl bg-cyan-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Grant read access'}
        </button>
      </form>
      {profilesLoading || grantsLoading ? <p role="status" className="text-sm text-slate-500">Loading viewer access…</p> : null}
      {!grantsError && !grantsLoading && visibleGrants.length === 0 && <p className="text-sm text-slate-500">No viewer access has been granted.</p>}
      {!grantsError && visibleGrants.length > 0 && (
        <div className="table-shell">
          <table>
            <thead><tr><th>Viewer</th><th>Screening faculty</th><th>Action</th></tr></thead>
            <tbody>{visibleGrants.map((grant) => (
              <tr key={`${grant.viewerId}-${grant.ownerId}`}>
                <td>{profileName(grant.viewerId)}</td>
                <td>{profileName(grant.ownerId)}</td>
                <td><button type="button" disabled={saving} onClick={() => void updateGrant(grant.viewerId, grant.ownerId, false)} className="text-sm font-medium text-rose-700 underline disabled:opacity-50">Revoke</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
