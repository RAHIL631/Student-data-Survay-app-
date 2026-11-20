import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRemoteData } from '../hooks/useRemoteData';
import { getDistricts, getOrganizationUsers, getOwnerDataGrants, manageOrganizationUser, provisionOrganizationUser, setOwnerDataGrant } from '../lib/dataService';
import { getLocalTestOrganizationName, isLocalTestSessionActive } from '../lib/localTestMode';

export function AdminUsersPage() {
  const { user } = useAuth();
  const { data: users, isLoading, error, reload } = useRemoteData(getOrganizationUsers);
  const { data: districts, error: districtsError } = useRemoteData(getDistricts);
  const { data: grants, isLoading: grantsLoading, error: grantsError, reload: reloadGrants } = useRemoteData(getOwnerDataGrants);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'enumerator' as 'district_manager' | 'enumerator', districtId: '' });
  const [grantForm, setGrantForm] = useState({ viewerId: '', ownerId: '' });
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  const [grantError, setGrantError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGranting, setIsGranting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setSaveError('');
    if (!user || user.role !== 'organization_admin') {
      setSaveError('An organization administrator must be signed in to invite staff.');
      return;
    }
    if (form.fullName.trim().length < 2 || !form.email.trim() || !form.districtId) {
      setSaveError('Enter the staff member’s name and email and select a district.');
      return;
    }
    setIsSaving(true);
    try {
      const result = await provisionOrganizationUser({ ...form, fullName: form.fullName.trim(), email: form.email.trim().toLowerCase() });
      setForm({ fullName: '', email: '', role: 'enumerator', districtId: '' });
      setMessage(result.warning ?? 'Invitation sent. The staff member must accept the email invitation to set their password.');
      reload();
    } catch (inviteError) {
      console.error('Unable to invite organization staff.', inviteError);
      setSaveError(inviteError instanceof Error ? inviteError.message : 'Unable to invite staff.');
    } finally {
      setIsSaving(false);
    }
  };

  const localTest = isLocalTestSessionActive();
  const viewers = (users ?? []).filter((member) => member.role === 'district_manager' && member.isActive);
  const screeningFaculty = (users ?? []).filter((member) => member.role === 'enumerator' && member.isActive);

  const handleAccountAction = async (targetUserId: string, action: 'reset_password' | 'deactivate' | 'reactivate') => {
    if (action === 'deactivate' && !window.confirm('Deactivate this account? Its data will be kept, but the user will lose access.')) {
      return;
    }

    setAccountMessage('');
    setAccountError('');
    setIsSaving(true);
    try {
      const result = await manageOrganizationUser({ userId: targetUserId, action });
      setAccountMessage(result.warning ?? (
        action === 'reset_password'
          ? 'Password recovery email sent.'
          : action === 'deactivate'
            ? 'Account deactivated. Its records were kept.'
            : 'Account reactivated.'
      ));
      reload();
    } catch (actionError) {
      console.error('Unable to update the staff account.', actionError);
      setAccountError(actionError instanceof Error ? actionError.message : 'The staff account could not be updated.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGrantSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGrantError('');
    if (!user || user.role !== 'organization_admin') {
      setGrantError('An administrator must be signed in to grant viewer access.');
      return;
    }

    setIsGranting(true);
    try {
      await setOwnerDataGrant(grantForm.viewerId, grantForm.ownerId, true);
      setGrantForm({ viewerId: '', ownerId: '' });
      await reloadGrants();
    } catch (error) {
      console.error('Unable to grant viewer access.', error);
      setGrantError(error instanceof Error ? error.message : 'Viewer access could not be granted.');
    } finally {
      setIsGranting(false);
    }
  };

  const handleRevokeGrant = async (viewerId: string, ownerId: string) => {
    setGrantError('');
    setIsGranting(true);
    try {
      await setOwnerDataGrant(viewerId, ownerId, false);
      await reloadGrants();
    } catch (error) {
      console.error('Unable to revoke viewer access.', error);
      setGrantError(error instanceof Error ? error.message : 'Viewer access could not be revoked.');
    } finally {
      setIsGranting(false);
    }
  };

  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold">Staff & access</h2><p className="mt-1 text-sm text-slate-600">Invite Screening Faculty and Viewers, assign schools, and grant read-only access. Administrator accounts are provisioned by an existing platform owner.</p></div>
    {localTest && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Account invitations are disabled in local test mode. This test session has no Auth user or database profile.</div>}
    <form onSubmit={(event) => void handleSubmit(event)} className="card space-y-4">
      <h3 className="text-lg font-semibold">Invite staff</h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium">Full name<input required minLength={2} maxLength={120} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} autoComplete="name" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
        <label className="text-sm font-medium">Email address<input required type="email" maxLength={254} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} autoComplete="email" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
        <label className="text-sm font-medium">Role<select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as 'district_manager' | 'enumerator' }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="enumerator">Screening Faculty</option><option value="district_manager">Viewer</option></select></label>
        <label className="text-sm font-medium">Assigned district<select required value={form.districtId} onChange={(event) => setForm((current) => ({ ...current, districtId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">Select district</option>{(districts ?? []).map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}</select></label>
      </div>
      {districtsError && <p role="alert" className="text-sm text-rose-700">Districts could not be loaded: {districtsError}</p>}
      {accountMessage && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{accountMessage}</p>}
      {accountError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{accountError}</p>}
      <button type="submit" disabled={isSaving || Boolean(districtsError) || !districts?.length || localTest} className="min-h-11 rounded-xl bg-cyan-700 px-5 py-2.5 font-semibold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? 'Sending invitation…' : 'Send invitation'}</button>
    </form>
    <section className="card space-y-4">
      <div><h3 className="text-lg font-semibold">Organization users</h3><p className="mt-1 text-sm text-slate-500">{localTest ? getLocalTestOrganizationName() : `Organization ID: ${user?.organizationId ?? 'Unavailable'}`}</p></div>
      {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Users could not be loaded: {error}<button onClick={reload} className="ml-2 underline">Retry</button></div>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {saveError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{saveError}</p>}
      {isLoading ? <p role="status" className="text-sm text-slate-500">Loading staff…</p> : (users ?? []).length === 0 ? <p className="text-sm text-slate-500">No staff are provisioned yet.</p> : <div className="table-shell"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>District</th><th>Status</th>{user?.role === 'organization_admin' && <th>Account actions</th>}</tr></thead><tbody>{(users ?? []).map((member) => <tr key={member.id}><td>{member.name}</td><td>{member.email}</td><td>{member.role === 'district_manager' ? 'Viewer' : member.role === 'organization_admin' ? 'Administrator' : 'Screening Faculty'}</td><td>{districts?.find((district) => district.id === member.districtId)?.name ?? (member.districtId ? 'Assigned district' : 'Organization-wide')}</td><td>{member.isActive ? 'Active' : 'Inactive'}</td>{user?.role === 'organization_admin' && <td><div className="flex flex-wrap gap-2"><button type="button" disabled={isSaving || localTest || !member.isActive} onClick={() => void handleAccountAction(member.id, 'reset_password')} className="text-sm font-medium text-cyan-800 underline disabled:opacity-50">Send reset email</button>{member.role !== 'organization_admin' && (member.isActive ? <button type="button" disabled={isSaving || localTest} onClick={() => void handleAccountAction(member.id, 'deactivate')} className="text-sm font-medium text-rose-700 underline disabled:opacity-50">Deactivate</button> : <button type="button" disabled={isSaving || localTest} onClick={() => void handleAccountAction(member.id, 'reactivate')} className="text-sm font-medium text-emerald-700 underline disabled:opacity-50">Reactivate</button>)}</div></td>}</tr>)}</tbody></table></div>}
    </section>
    {user?.role === 'organization_admin' && <section className="card space-y-4">
      <div><h3 className="text-lg font-semibold">Viewer access</h3><p className="mt-1 text-sm text-slate-500">Viewers can read screening data for the faculty members explicitly granted here.</p></div>
      <form onSubmit={(event) => void handleGrantSubmit(event)} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm font-medium">Viewer<select required value={grantForm.viewerId} onChange={(event) => setGrantForm((current) => ({ ...current, viewerId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">Select viewer</option>{viewers.map((viewer) => <option key={viewer.id} value={viewer.id}>{viewer.name}</option>)}</select></label>
        <label className="text-sm font-medium">Screening Faculty<select required value={grantForm.ownerId} onChange={(event) => setGrantForm((current) => ({ ...current, ownerId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">Select faculty</option>{screeningFaculty.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}</select></label>
        <button type="submit" disabled={isGranting || localTest || !viewers.length || !screeningFaculty.length} className="self-end rounded-xl bg-cyan-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{isGranting ? 'Saving…' : 'Grant read access'}</button>
      </form>
      {grantError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{grantError}</p>}
      {grantsError && <p role="alert" className="text-sm text-rose-700">Viewer grants could not be loaded: {grantsError} <button type="button" onClick={reloadGrants} className="underline">Retry</button></p>}
      {grantsLoading ? <p role="status" className="text-sm text-slate-500">Loading viewer grants…</p> : !grantsError && !(grants ?? []).length ? <p className="text-sm text-slate-500">No viewer access has been granted.</p> : !grantsError && <div className="table-shell"><table><thead><tr><th>Viewer</th><th>Screening Faculty</th><th>Action</th></tr></thead><tbody>{(grants ?? []).map((grant) => <tr key={`${grant.viewerId}-${grant.ownerId}`}><td>{users?.find((member) => member.id === grant.viewerId)?.name ?? grant.viewerId}</td><td>{users?.find((member) => member.id === grant.ownerId)?.name ?? grant.ownerId}</td><td><button type="button" onClick={() => void handleRevokeGrant(grant.viewerId, grant.ownerId)} disabled={isGranting} className="text-sm font-medium text-rose-700 underline disabled:opacity-50">Revoke</button></td></tr>)}</tbody></table></div>}
    </section>}
  </div>;
}
