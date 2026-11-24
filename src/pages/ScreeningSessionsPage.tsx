import { CalendarClock, Plus, Play } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRemoteData } from '../hooks/useRemoteData';
import { createScreeningSession, getOrganizationUsers, getSchools, getScreeningSessions } from '../lib/dataService';
import { getLocalDateString } from '../lib/date';

export function ScreeningSessionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: sessions, isLoading, error, reload } = useRemoteData(getScreeningSessions);
  const { data: schools, error: schoolsError } = useRemoteData(getSchools);
  const { data: users, error: usersError } = useRemoteData(getOrganizationUsers);
  const [showForm, setShowForm] = useState(false);
  const [schoolNameInput, setSchoolNameInput] = useState('');
  const [form, setForm] = useState({
    name: '',
    date: getLocalDateString(),
    schoolId: '',
    beoName: '',
    headMasterName: '',
  });
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const canCreate = user?.role === 'organization_admin' || user?.role === 'enumerator';
  const activeFaculty = (users ?? []).filter((member) => member.role === 'enumerator' && member.isActive);
  const activeFacultyIds = new Set(activeFaculty.map((member) => member.id));
  const activeSchools = (schools ?? []).filter((school) => school.status === 'active');
  const availableSchools = activeSchools.filter((school) =>
    user?.role === 'organization_admin'
      ? activeFacultyIds.has(school.ownerId)
      : user?.role === 'enumerator' && school.ownerId === user.id,
  );
  const schoolChoices = user?.role === 'organization_admin' ? activeSchools : availableSchools;
  const matchingSchoolChoices = schoolChoices.filter((school) =>
    `${school.name} ${school.code} ${activeFaculty.find((member) => member.id === school.ownerId)?.name ?? ''}`
      .toLocaleLowerCase()
      .includes(schoolNameInput.trim().toLocaleLowerCase()),
  );
  const selectedSchool = activeSchools.find((school) => school.id === form.schoolId);
  const selectedSchoolFaculty = selectedSchool
    ? activeFaculty.find((member) => member.id === selectedSchool.ownerId)
    : undefined;
  const screeningFacultyName = selectedSchoolFaculty?.name
    ?? (selectedSchool?.ownerId === user?.id ? user?.name ?? '' : '');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError('');
    const school = availableSchools.find((item) => item.id === form.schoolId);
    if (!user || !school) {
      setSaveError('Select an active school assigned to your account or to an active Screening Faculty account.');
      return;
    }

    setIsSaving(true);
    try {
      await createScreeningSession({
        organizationId: user.organizationId,
        name: form.name.trim(),
        date: form.date,
        beoName: form.beoName.trim(),
        headMasterName: form.headMasterName.trim(),
        screeningFacultyName: screeningFacultyName.trim(),
        school,
      });
      setForm({ name: '', date: getLocalDateString(), schoolId: '', beoName: '', headMasterName: '' });
      setSchoolNameInput('');
      setShowForm(false);
      reload();
    } catch (error) {
      console.error('Unable to create the screening session.', error);
      setSaveError(error instanceof Error ? error.message : 'The session could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900">Screening Sessions</h2>
        {canCreate && <button onClick={() => { setShowForm((visible) => !visible); setSaveError(''); }} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500"><Plus size={16} /> New session</button>}
      </div>

      {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Sessions could not be loaded: {error} <button onClick={reload} className="ml-2 underline">Retry</button></div>}
      {(schoolsError || (user?.role === 'organization_admin' && usersError)) && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Schools or Screening Faculty could not be loaded: {schoolsError ?? usersError}</div>}
      {showForm && (
        <form onSubmit={(event) => void handleSubmit(event)} className="card space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Create screening session</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Find school by name
              <input value={schoolNameInput} onChange={(event) => {
                setSchoolNameInput(event.target.value);
                setForm((current) => current.schoolId ? { ...current, schoolId: '' } : current);
              }} placeholder="Type a school name or code" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            </label>
            <label className="text-sm font-medium text-slate-700">Session name
              <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            </label>
            <label className="text-sm font-medium text-slate-700">Date
              <input required type="date" min={getLocalDateString()} value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            </label>
            <label className="text-sm font-medium text-slate-700">School
              <select required value={form.schoolId} onChange={(event) => setForm((current) => ({ ...current, schoolId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <option value="">Select a school</option>
                {matchingSchoolChoices.map((school) => {
                  const faculty = activeFaculty.find((member) => member.id === school.ownerId);
                  return <option key={school.id} value={school.id}>
                    {school.name}{user?.role === 'organization_admin' ? ` · ${faculty?.name ?? 'No active faculty assigned'}` : ''}
                  </option>;
                })}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">BEO name
              <input required value={form.beoName} onChange={(event) => setForm((current) => ({ ...current, beoName: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            </label>
            <label className="text-sm font-medium text-slate-700">Head Master
              <input required value={form.headMasterName} onChange={(event) => setForm((current) => ({ ...current, headMasterName: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            </label>
            <label className="text-sm font-medium text-slate-700">Screening Faculty
              <input required readOnly value={screeningFacultyName} placeholder="Assigned from the selected school" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-600" />
            </label>
          </div>
          {schoolChoices.length === 0 && <p role="status" className="text-sm text-amber-800">{schools?.length ? 'No active schools are available in your account scope.' : 'Add an active school before creating a session.'}</p>}
          {schoolNameInput.trim() && matchingSchoolChoices.length === 0 && <p role="status" className="text-sm text-amber-800">No school matches that name. Add it on the <a href="/schools" className="font-semibold underline">Schools page</a>, then return to create a session.</p>}
          {user?.role === 'organization_admin' && selectedSchool && !selectedSchoolFaculty && <p role="status" className="text-sm text-amber-800">{selectedSchool.name} has no active Screening Faculty assignment. Assign one on the <a href="/schools" className="font-semibold underline">Schools page</a>, then return here to create its session.</p>}
          {saveError && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{saveError}</div>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSaving || Boolean(schoolsError) || Boolean(user?.role === 'organization_admin' && usersError) || !availableSchools.length || !availableSchools.some((school) => school.id === form.schoolId)} className="rounded-xl bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500 disabled:opacity-50">{isSaving ? 'Saving…' : 'Save session'}</button>
          </div>
        </form>
      )}

      {isLoading && <p role="status" className="text-sm text-slate-500">Loading screening sessions…</p>}
      {!isLoading && !error && sessions?.length === 0 && <p className="text-sm text-slate-500">No screening sessions are available to your account.</p>}
      {!error && (sessions?.length ?? 0) > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(sessions ?? []).map((session) => (
            <div key={session.id} className="card">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900">{session.name}</div>
                <span className="badge bg-cyan-100 text-cyan-700">{session.status}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2"><CalendarClock size={16} /> {session.date}</div>
                <div>School: {session.schoolName}</div>
                <div>Screening Faculty: {session.enumerators.length}</div>
              </div>
              {session.status === 'active' && <button onClick={() => navigate(`/student-registration?sessionId=${encodeURIComponent(session.id)}`)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500"><Play size={16} /> Start screening</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
