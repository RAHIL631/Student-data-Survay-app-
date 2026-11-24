import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { assignSchoolOwner, createSchool, getDistricts, getOrganizationUsers, getSchools, getTaluks } from '../lib/dataService';
import { useRemoteData } from '../hooks/useRemoteData';

export function SchoolsPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: schools, isLoading, error, reload } = useRemoteData(getSchools);
  const { data: districts, error: districtsError } = useRemoteData(getDistricts);
  const { data: taluks, error: taluksError } = useRemoteData(getTaluks);
  const { data: users, error: usersError, reload: reloadUsers } = useRemoteData(getOrganizationUsers);
  const [form, setForm] = useState({ name: '', code: '', districtId: '', talukId: '' });
  const [assignmentForm, setAssignmentForm] = useState(() => ({ schoolId: '', ownerId: searchParams.get('facultyId') ?? '' }));
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [ownerSaveError, setOwnerSaveError] = useState('');
  const [ownerSaveMessage, setOwnerSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const canManage = user?.role === 'organization_admin';
  const canCreateSchool = canManage || user?.role === 'enumerator';
  const requestedFaculty = (users ?? []).find((member) => member.id === assignmentForm.ownerId && member.role === 'enumerator' && member.isActive);
  const availableTaluks = (taluks ?? []).filter((taluk) => taluk.districtId === form.districtId);
  const screeningFaculty = (users ?? []).filter((member) => member.role === 'enumerator' && member.isActive);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      await createSchool({
        organizationId: user.organizationId,
        ...form,
        name: form.name.trim(),
        code: form.code.trim(),
      });
      setForm({ name: '', code: '', districtId: '', talukId: '' });
      setSaveMessage(canManage
        ? 'School added. Assign an active Screening Faculty account to it before creating a screening session.'
        : 'School added to your account. You can now create a screening session for it.');
      await reload();
    } catch (error) {
      console.error('Unable to create the school.', error);
      setSaveError(error instanceof Error ? error.message : 'Unable to create school.');
    } finally {
      setSaving(false);
    }
  };

  const handleOwnerChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignmentForm.schoolId || !assignmentForm.ownerId) return;
    setIsAssigning(true);
    setOwnerSaveError('');
    setOwnerSaveMessage('');
    try {
      await assignSchoolOwner(assignmentForm.schoolId, assignmentForm.ownerId);
      setOwnerSaveMessage(`School assigned to ${requestedFaculty?.name ?? 'Screening Faculty'}.`);
      await reload();
    } catch (error) {
      console.error('Unable to assign the school owner.', error);
      setOwnerSaveError(error instanceof Error ? error.message : 'The school assignment could not be saved.');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Schools</h2>
        <p className="mt-1 text-sm text-slate-600">Type a school name to add it, then assign Screening Faculty before creating a screening session.</p>
      </div>
      {requestedFaculty && <p role="status" className="rounded-xl bg-cyan-50 p-4 text-sm text-cyan-950">Choose a school in the assignment form to assign it to {requestedFaculty.name}, then press Assign faculty.</p>}
      {saveMessage && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{saveMessage}</p>}
      {(districtsError || taluksError) && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Location data could not be loaded: {districtsError ?? taluksError}</div>}
      {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Schools could not be loaded: {error} <button type="button" onClick={reload} className="ml-2 underline">Retry</button></div>}
      {usersError && canManage && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Staff accounts could not be loaded: {usersError} <button type="button" onClick={reloadUsers} className="ml-2 underline">Retry</button></div>}

      {canManage && <form onSubmit={(event) => void handleOwnerChange(event)} className="card grid gap-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm font-medium text-slate-700">School
          <select required value={assignmentForm.schoolId} onChange={(event) => setAssignmentForm((current) => ({ ...current, schoolId: event.target.value }))} disabled={isLoading || Boolean(error)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <option value="">Select school</option>
            {(schools ?? []).filter((school) => school.status === 'active').map((school) => <option key={school.id} value={school.id}>{school.name} · {school.code}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Screening Faculty
          <select required value={assignmentForm.ownerId} onChange={(event) => setAssignmentForm((current) => ({ ...current, ownerId: event.target.value }))} disabled={!screeningFaculty.length || Boolean(usersError)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <option value="">Select active faculty</option>
            {screeningFaculty.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={isAssigning || !assignmentForm.schoolId || !assignmentForm.ownerId || Boolean(error) || Boolean(usersError)} className="self-end rounded-xl bg-cyan-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{isAssigning ? 'Assigning…' : 'Assign faculty'}</button>
        {!screeningFaculty.length && !usersError && <p role="status" className="text-sm text-amber-800 md:col-span-3">Approve a Screening Faculty account before assigning a school.</p>}
      </form>}
      {ownerSaveMessage && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{ownerSaveMessage}</p>}
      {ownerSaveError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{ownerSaveError}</div>}

      {canCreateSchool && <form onSubmit={(event) => void handleSubmit(event)} className="card grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm font-medium text-slate-700">School name
          <input aria-label="School name" required maxLength={160} autoComplete="off" placeholder="Type the school name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
        </label>
        <label className="text-sm font-medium text-slate-700">School code
          <input aria-label="School code" required maxLength={40} autoComplete="off" placeholder="School code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
        </label>
        <label className="text-sm font-medium text-slate-700">District
          <select aria-label="School district" required value={form.districtId} onChange={(event) => setForm((current) => ({ ...current, districtId: event.target.value, talukId: '' }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <option value="">Select district</option>
            {(districts ?? []).map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Taluk
          <select aria-label="School taluk" required value={form.talukId} onChange={(event) => setForm((current) => ({ ...current, talukId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <option value="">Select taluk</option>
            {availableTaluks.map((taluk) => <option key={taluk.id} value={taluk.id}>{taluk.name}</option>)}
          </select>
          {form.districtId && availableTaluks.length === 0 && <span className="mt-1 block text-xs font-normal text-amber-800">No taluks are configured for this district. Add one in Districts &amp; Taluks first.</span>}
        </label>
        <button disabled={saving || Boolean(districtsError) || Boolean(taluksError) || !districts?.length || !availableTaluks.length} className="self-end rounded-xl bg-cyan-600 px-4 py-2.5 font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Add school'}</button>
        {saveError && <p role="alert" className="text-sm text-rose-700 md:col-span-2 xl:col-span-5">{saveError}</p>}
      </form>}

      {isLoading && <p role="status" className="text-sm text-slate-500">Loading schools…</p>}
      {!isLoading && !error && schools?.length === 0 && <p className="text-sm text-slate-500">No schools have been added to this organization.</p>}
      {!error && (schools?.length ?? 0) > 0 && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(schools ?? []).map((school) => <div key={school.id} className="card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">{school.name}</h3>
            <span className={`badge ${school.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{school.status}</span>
          </div>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div>School code: {school.code}</div>
            <div>District: {districts?.find((district) => district.id === school.districtId)?.name ?? school.districtId}</div>
            <div>Taluk: {taluks?.find((taluk) => taluk.id === school.talukId)?.name ?? school.talukId}</div>
            <div>Screening Faculty: {screeningFaculty.find((member) => member.id === school.ownerId)?.name ?? 'Unassigned'}</div>
          </div>
        </div>)}
      </div>}
    </div>
  );
}
