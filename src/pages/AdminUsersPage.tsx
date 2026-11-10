import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRemoteData } from '../hooks/useRemoteData';
import { getDistricts, getOrganizationUsers, provisionOrganizationUser } from '../lib/dataService';
import { getLocalTestOrganizationName, isLocalTestSessionActive } from '../lib/localTestMode';

export function AdminUsersPage() {
  const { user } = useAuth();
  const { data: users, isLoading, error, reload } = useRemoteData(getOrganizationUsers);
  const { data: districts, error: districtsError } = useRemoteData(getDistricts);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'enumerator' as 'district_manager' | 'enumerator', districtId: '' });
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold">Staff & access</h2><p className="mt-1 text-sm text-slate-600">Invite district supervisors and enumerators. Organization administrators are provisioned securely by an existing platform owner.</p></div>
    {localTest && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Account invitations are disabled in local test mode. This test session has no Auth user or database profile.</div>}
    <form onSubmit={(event) => void handleSubmit(event)} className="card space-y-4">
      <h3 className="text-lg font-semibold">Invite organization staff</h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium">Full name<input required minLength={2} maxLength={120} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} autoComplete="name" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
        <label className="text-sm font-medium">Email address<input required type="email" maxLength={254} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} autoComplete="email" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
        <label className="text-sm font-medium">Role<select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as 'district_manager' | 'enumerator' }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="enumerator">Enumerator</option><option value="district_manager">District supervisor</option></select></label>
        <label className="text-sm font-medium">Assigned district<select required value={form.districtId} onChange={(event) => setForm((current) => ({ ...current, districtId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">Select district</option>{(districts ?? []).map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}</select></label>
      </div>
      {districtsError && <p role="alert" className="text-sm text-rose-700">Districts could not be loaded: {districtsError}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {saveError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{saveError}</p>}
      <button type="submit" disabled={isSaving || Boolean(districtsError) || !districts?.length || localTest} className="min-h-11 rounded-xl bg-cyan-700 px-5 py-2.5 font-semibold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? 'Sending invitation…' : 'Send invitation'}</button>
    </form>
    <section className="card space-y-4">
      <div><h3 className="text-lg font-semibold">Organization users</h3><p className="mt-1 text-sm text-slate-500">{localTest ? getLocalTestOrganizationName() : `Organization ID: ${user?.organizationId ?? 'Unavailable'}`}</p></div>
      {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Users could not be loaded: {error}<button onClick={reload} className="ml-2 underline">Retry</button></div>}
      {isLoading ? <p role="status" className="text-sm text-slate-500">Loading staff…</p> : (users ?? []).length === 0 ? <p className="text-sm text-slate-500">No staff are provisioned yet.</p> : <div className="table-shell"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>District</th></tr></thead><tbody>{(users ?? []).map((member) => <tr key={member.id}><td>{member.name}</td><td>{member.email}</td><td>{member.role === 'district_manager' ? 'District supervisor' : member.role.replace('_', ' ')}</td><td>{districts?.find((district) => district.id === member.districtId)?.name ?? (member.districtId ? 'Assigned district' : 'Organization-wide')}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
