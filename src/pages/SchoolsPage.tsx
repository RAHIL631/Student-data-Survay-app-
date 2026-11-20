import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { assignSchoolOwner, getDistricts, getOrganizationUsers, getSchools, getTaluks } from '../lib/dataService';
import { useRemoteData } from '../hooks/useRemoteData';
import { createSchool } from '../lib/dataService';

export function SchoolsPage() {
  const { user } = useAuth();
  const { data: schools, isLoading, error, reload } = useRemoteData(getSchools);
  const { data: districts, error: districtsError } = useRemoteData(getDistricts);
  const { data: taluks, error: taluksError } = useRemoteData(getTaluks);
  const { data: users, error: usersError, reload: reloadUsers } = useRemoteData(getOrganizationUsers);
  const [form, setForm] = useState({ name: '', code: '', districtId: '', talukId: '' });
  const [saveError, setSaveError] = useState('');
  const [ownerSaveError, setOwnerSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingSchoolId, setSavingSchoolId] = useState('');
  const [ownerSelections, setOwnerSelections] = useState<Record<string, string>>({});
  const canManage = user?.role === 'organization_admin';
  const canCreateSchool = canManage || user?.role === 'enumerator';
  const availableTaluks = (taluks ?? []).filter((taluk) => taluk.districtId === form.districtId);
  const screeningFaculty = (users ?? []).filter((member) => member.role === 'enumerator' && member.isActive);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError('');
    try {
      await createSchool({ organizationId: user.organizationId, ...form });
      setForm({ name: '', code: '', districtId: '', talukId: '' });
      reload();
    } catch (error) {
      console.error('Unable to create the school.', error);
      setSaveError(error instanceof Error ? error.message : 'Unable to create school.');
    } finally {
      setSaving(false);
    }
  };

  const handleOwnerChange = async (schoolId: string) => {
    const ownerId = ownerSelections[schoolId];
    if (!ownerId) return;

    setSavingSchoolId(schoolId);
    setOwnerSaveError('');
    try {
      await assignSchoolOwner(schoolId, ownerId);
      reload();
    } catch (error) {
      console.error('Unable to assign the school owner.', error);
      setOwnerSaveError(error instanceof Error ? error.message : 'The school assignment could not be saved.');
    } finally {
      setSavingSchoolId('');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Schools</h2>
      {(districtsError || taluksError) && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Location data could not be loaded: {districtsError ?? taluksError}</div>}
      {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Schools could not be loaded: {error} <button onClick={reload} className="ml-2 underline">Retry</button></div>}
      {usersError && canManage && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Staff accounts could not be loaded: {usersError} <button onClick={reloadUsers} className="ml-2 underline">Retry</button></div>}
      {canCreateSchool && <form onSubmit={(event) => void handleSubmit(event)} className="card grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <input aria-label="School name" required placeholder="School name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
        <input aria-label="School code" required placeholder="School code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
        <select aria-label="School district" required value={form.districtId} onChange={(event) => setForm((current) => ({ ...current, districtId: event.target.value, talukId: '' }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <option value="">Select district</option>{(districts ?? []).map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
        </select>
        <select aria-label="School taluk" required value={form.talukId} onChange={(event) => setForm((current) => ({ ...current, talukId: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <option value="">Select taluk</option>{availableTaluks.map((taluk) => <option key={taluk.id} value={taluk.id}>{taluk.name}</option>)}
        </select>
        <button disabled={saving || Boolean(districtsError) || Boolean(taluksError)} className="rounded-xl bg-cyan-600 px-4 py-2 font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Add school'}</button>
        {saveError && <p role="alert" className="text-sm text-rose-700 md:col-span-2 xl:col-span-5">{saveError}</p>}
      </form>}
      {ownerSaveError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{ownerSaveError}</div>}
      {isLoading && <p role="status" className="text-sm text-slate-500">Loading schools…</p>}
      {!isLoading && !error && schools?.length === 0 && <p className="text-sm text-slate-500">No schools have been added to this organization.</p>}
      {!error && (schools?.length ?? 0) > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(schools ?? []).map((school) => (
            <div key={school.id} className="card">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{school.name}</h3>
                <span className={`badge ${school.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{school.status}</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>School code: {school.code}</div>
                <div>District: {districts?.find((district) => district.id === school.districtId)?.name ?? school.districtId}</div>
                <div>Taluk: {taluks?.find((taluk) => taluk.id === school.talukId)?.name ?? school.talukId}</div>
                <div>Screening Faculty: {users?.find((member) => member.id === school.ownerId)?.name ?? (school.ownerId === user?.id ? user.name : 'Unassigned')}</div>
              </div>
              {canManage && <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor={`school-owner-${school.id}`}>Assign screening faculty for {school.name}</label>
                <select
                  id={`school-owner-${school.id}`}
                  value={ownerSelections[school.id] ?? (screeningFaculty.some((member) => member.id === school.ownerId) ? school.ownerId : '')}
                  onChange={(event) => setOwnerSelections((current) => ({ ...current, [school.id]: event.target.value }))}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  disabled={!screeningFaculty.length || Boolean(usersError)}
                >
                  <option value="">Select Screening Faculty</option>
                  {screeningFaculty.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => void handleOwnerChange(school.id)}
                  disabled={savingSchoolId === school.id || !(ownerSelections[school.id] ?? (screeningFaculty.some((member) => member.id === school.ownerId) ? school.ownerId : '')) || Boolean(usersError)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  {savingSchoolId === school.id ? 'Saving…' : 'Assign'}
                </button>
              </div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
