import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRemoteData } from '../hooks/useRemoteData';
import {
  createStudentScreening,
  getActiveSchoolsForOrganization,
  getDistricts,
  getScreeningSessions,
  getTaluks,
} from '../lib/dataService';
import { getLocalDateString } from '../lib/date';
import { calculateAge, calculateBmi } from '../lib/permissions';
import { isLocalTestSessionActive } from '../lib/localTestMode';
import {
  getPendingSubmissions,
  PENDING_SUBMISSIONS_CHANGED_EVENT,
  resolveConflictKeepServer,
  savePendingSubmission,
} from '../lib/pendingSubmissions';
import { PENDING_SUBMISSIONS_SYNCED_EVENT } from '../lib/pendingSubmissionSync';
import type { PendingStudentSubmission, StudentRecord } from '../types';

const initialForm = {
  siNumber: '',
  studentName: '',
  className: '',
  section: '',
  sex: '',
  dateOfBirth: '',
  heightCm: '',
  weightKg: '',
  skeletalDeformity: 'Not assessed',
  skeletalObservation: '',
  skinThicknessMm: '',
  midArmCircumferenceCm: '',
  additionalRemarks: '',
  sessionId: '',
  districtId: '',
  talukId: '',
  schoolId: '',
};

function getStudentDraftKey(userId: string): string {
  return `student-health-hub.student-draft.v1.${userId}`;
}

function hasStudentDraft(form: typeof initialForm): boolean {
  return Object.entries(form).some(([key, value]) => key !== 'sessionId' && value.trim() !== '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDateOfBirth(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;

  const [, day, month, year] = match;
  const isoDate = `${year}-${month}-${day}`;
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === isoDate ? isoDate : null;
}

function formatDateOfBirthInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isStudentSex(value: string): value is StudentRecord['sex'] {
  return value === 'Male' || value === 'Female' || value === 'Other' || value === 'Prefer not to specify';
}

function isSkeletalDeformity(value: string): value is StudentRecord['skeletalDeformity'] {
  return value === 'No' || value === 'Yes' || value === 'Suspected' || value === 'Not assessed';
}

export function StudentRegistrationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const organizationId = user?.organizationId;
  const loadSchools = useCallback(
    () => organizationId ? getActiveSchoolsForOrganization(organizationId) : Promise.resolve([]),
    [organizationId],
  );
  const { data: sessions, isLoading, error: sessionsError } = useRemoteData(getScreeningSessions);
  const { data: districts, isLoading: districtsLoading, error: districtsError } = useRemoteData(getDistricts);
  const { data: taluks, isLoading: taluksLoading, error: taluksError } = useRemoteData(getTaluks);
  const { data: schools, isLoading: schoolsLoading, error: schoolsError, reload: reloadSchools } = useRemoteData(loadSchools);
  const [form, setForm] = useState(() => ({ ...initialForm, sessionId: searchParams.get('sessionId') ?? '' }));
  const [submitted, setSubmitted] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'online' | 'offline' | null>(null);
  const [error, setError] = useState('');
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingStudentSubmission[]>([]);
  const [pendingStorageError, setPendingStorageError] = useState('');
  const [pendingResolutionId, setPendingResolutionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSiNumber, setSavedSiNumber] = useState('');
  const [draftOwnerId, setDraftOwnerId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [draftClock, setDraftClock] = useState(Date.now());
  const [draftError, setDraftError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const saveAnother = useRef(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;
    const refreshPendingSubmissions = () => {
      void getPendingSubmissions(user.id)
        .then((submissions) => {
          if (active) {
            setPendingSubmissions(submissions);
            setPendingStorageError('');
          }
        })
        .catch((storageError: unknown) => {
          console.error('Unable to load pending offline submissions.', storageError);
          if (active) {
            setPendingStorageError('Offline submissions could not be loaded from this device.');
          }
        });
    };
    const handleSynchronized = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; syncedCount: number }>).detail;
      if (!detail || detail.userId !== user.id || detail.syncedCount < 1) return;
      setSyncMessage(`${detail.syncedCount} records synced successfully.`);
      refreshPendingSubmissions();
    };
    refreshPendingSubmissions();
    window.addEventListener(PENDING_SUBMISSIONS_CHANGED_EVENT, refreshPendingSubmissions);
    window.addEventListener(PENDING_SUBMISSIONS_SYNCED_EVENT, handleSynchronized);
    window.addEventListener('focus', refreshPendingSubmissions);

    return () => {
      active = false;
      window.removeEventListener(PENDING_SUBMISSIONS_CHANGED_EVENT, refreshPendingSubmissions);
      window.removeEventListener(PENDING_SUBMISSIONS_SYNCED_EVENT, handleSynchronized);
      window.removeEventListener('focus', refreshPendingSubmissions);
    };
  }, [user]);

  const urlSessionId = searchParams.get('sessionId') ?? '';
  useEffect(() => {
    if (!user) {
      setDraftOwnerId(null);
      return;
    }

    setDraftOwnerId(null);
    try {
      const saved = localStorage.getItem(getStudentDraftKey(user.id));
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (!isRecord(parsed) || !isRecord(parsed.form)) {
          throw new Error('The saved student draft has an invalid format.');
        }

        const restored = { ...initialForm };
        for (const key of Object.keys(initialForm) as Array<keyof typeof initialForm>) {
          const value = parsed.form[key];
          if (typeof value === 'string') restored[key] = value;
        }
        setForm({ ...restored, sessionId: urlSessionId || restored.sessionId });
        setDraftSavedAt(typeof parsed.savedAt === 'string' && Number.isFinite(Date.parse(parsed.savedAt)) ? parsed.savedAt : '');
        setIsDirty(hasStudentDraft(restored));
      } else {
        setForm({ ...initialForm, sessionId: urlSessionId });
        setDraftSavedAt('');
        setIsDirty(false);
      }
      setDraftError('');
    } catch (restoreError) {
      console.error('Unable to restore the student draft.', restoreError);
      setDraftError('The saved student draft could not be restored. It remains on this device.');
    } finally {
      setDraftOwnerId(user.id);
    }
  }, [user?.id, urlSessionId]);

  useEffect(() => {
    if (!user || draftOwnerId !== user.id || draftError) return;
    const key = getStudentDraftKey(user.id);
    if (!hasStudentDraft(form)) {
      try {
        localStorage.removeItem(key);
        setDraftSavedAt('');
      } catch (storageError) {
        console.error('Unable to clear the empty student draft.', storageError);
        setDraftError('The empty draft could not be cleared from this device.');
      }
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const savedAt = new Date().toISOString();
        localStorage.setItem(key, JSON.stringify({ form, savedAt }));
        setDraftSavedAt(savedAt);
        setDraftError('');
      } catch (storageError) {
        console.error('Unable to save the student draft on this device.', storageError);
        setDraftError('The draft could not be saved on this device.');
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [form, user?.id, draftOwnerId, draftError]);

  useEffect(() => {
    if (!draftSavedAt) return;
    const timer = window.setInterval(() => setDraftClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [draftSavedAt]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  const today = getLocalDateString();
  const heightCm = Number(form.heightCm);
  const weightKg = Number(form.weightKg);
  const skinThicknessMm = form.skinThicknessMm === '' ? null : Number(form.skinThicknessMm);
  const midArmCircumferenceCm = form.midArmCircumferenceCm === '' ? null : Number(form.midArmCircumferenceCm);
  const availableTaluks = (taluks ?? []).filter((taluk) => taluk.districtId === form.districtId);
  const availableSchools = (schools ?? []).filter((school) =>
    school.status === 'active'
    && school.districtId === form.districtId
    && school.talukId === form.talukId,
  );
  const selectedSchool = availableSchools.find((school) => school.id === form.schoolId);
  const availableSessions = (sessions ?? []).filter((session) =>
    session.status === 'active'
    && session.districtId === form.districtId
    && session.talukId === form.talukId
    && session.schoolId === form.schoolId,
  );
  const selectedSession = availableSessions.find((session) => session.id === form.sessionId);
  const screeningDate = selectedSession?.date ?? today;
  const dateOfBirth = parseDateOfBirth(form.dateOfBirth);
  const age = dateOfBirth ? calculateAge(dateOfBirth, screeningDate) : '';
  const bmi = calculateBmi(weightKg, heightCm);

  useEffect(() => {
    const session = sessions?.find((candidate) =>
      candidate.id === form.sessionId && candidate.status === 'active',
    );
    if (!session) return;

    setForm((current) => current.sessionId === session.id
      && current.districtId === session.districtId
      && current.talukId === session.talukId
      && current.schoolId === session.schoolId
      ? current
      : {
          ...current,
          districtId: session.districtId,
          talukId: session.talukId,
          schoolId: session.schoolId,
        });
  }, [form.sessionId, sessions]);

  const handleChange = (key: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSubmitted(false);
    setSubmissionStatus(null);
    setSavedSiNumber('');
    setDraftError('');
    setIsDirty(true);
    setError('');
  };

  const clearSavedDraft = (userId: string) => {
    try {
      localStorage.removeItem(getStudentDraftKey(userId));
      setDraftSavedAt('');
      setDraftError('');
    } catch (storageError) {
      console.error('Unable to clear the saved student draft.', storageError);
      setDraftError('The student was saved, but the local draft could not be cleared from this device.');
    }
    setIsDirty(false);
  };

  const handleCancel = () => {
    if (isDirty && hasStudentDraft(form) && !window.confirm('Discard the unsaved student details?')) return;
    if (user) clearSavedDraft(user.id);
    navigate('/screening-sessions');
  };

  const handleKeepServerVersion = async (localId: string) => {
    if (!user) {
      return;
    }

    try {
      const resolved = await resolveConflictKeepServer(localId, user.id);
      if (!resolved) {
        throw new Error('This conflict could not be resolved. Refresh the page and review its current status.');
      }
      setPendingResolutionId(null);
    } catch (resolutionError) {
      console.error('Unable to resolve the student submission conflict.', resolutionError);
      setPendingStorageError(resolutionError instanceof Error ? resolutionError.message : 'The conflict could not be resolved.');
    }
  };

  const handleDistrictChange = (districtId: string) => {
    setForm((current) => ({ ...current, districtId, talukId: '', schoolId: '', sessionId: '' }));
    setSubmitted(false);
    setError('');
  };

  const handleTalukChange = (talukId: string) => {
    setForm((current) => ({ ...current, talukId, schoolId: '', sessionId: '' }));
    setSubmitted(false);
    setError('');
  };

  const handleSchoolChange = (schoolId: string) => {
    setForm((current) => ({ ...current, schoolId, sessionId: '' }));
    setSubmitted(false);
    setError('');
  };

  const handleSessionChange = (sessionId: string) => {
    const session = sessions?.find((candidate) => candidate.id === sessionId);
    setForm((current) => ({
      ...current,
      sessionId,
      ...(session ? {
        districtId: session.districtId,
        talukId: session.talukId,
        schoolId: session.schoolId,
      } : {}),
    }));
    setSubmitted(false);
    setError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(false);
    setSubmissionStatus(null);
    setError('');

    if (!user || !selectedSchool || !selectedSession) {
      setError('Select an active school and screening session available to your account.');
      return;
    }

    if (
      selectedSession.schoolId !== selectedSchool.id
      || selectedSession.districtId !== selectedSchool.districtId
      || selectedSession.talukId !== selectedSchool.talukId
    ) {
      setError('The selected school does not match the screening session location.');
      return;
    }

    if (
      !Number.isFinite(heightCm) || heightCm <= 0 ||
      !Number.isFinite(weightKg) || weightKg <= 0 ||
      (skinThicknessMm !== null && (!Number.isFinite(skinThicknessMm) || skinThicknessMm < 0)) ||
      (midArmCircumferenceCm !== null && (!Number.isFinite(midArmCircumferenceCm) || midArmCircumferenceCm < 0)) ||
      !dateOfBirth || dateOfBirth > screeningDate ||
      typeof age !== 'number' || !Number.isInteger(age) || age < 0 || age > 120
    ) {
      setError('Enter a valid date of birth as DD/MM/YYYY (age must be 0–120 at screening), and positive height and weight measurements.');
      return;
    }

    if (!form.studentName.trim() || !form.className.trim() || !form.section.trim()) {
      setError('Enter the student name, class, and section before saving.');
      return;
    }

    if (!isStudentSex(form.sex) || !isSkeletalDeformity(form.skeletalDeformity)) {
      setError('Choose a valid sex and screening observation before saving.');
      return;
    }

    if ((form.skeletalDeformity === 'Yes' || form.skeletalDeformity === 'Suspected') && !form.skeletalObservation.trim()) {
      setError('Describe the skeletal observation when it is marked Yes or Suspected.');
      return;
    }

    const record: StudentRecord = {
      id: '',
      ownerId: selectedSession.ownerId,
      sessionId: selectedSession.id,
      siNumber: '',
      studentName: form.studentName.trim(),
      className: form.className.trim(),
      section: form.section.trim(),
      sex: form.sex,
      dateOfBirth,
      age,
      heightCm,
      weightKg,
      bmi,
      skeletalDeformity: form.skeletalDeformity,
      skeletalObservation: form.skeletalObservation.trim(),
      skinThicknessMm,
      midArmCircumferenceCm,
      additionalRemarks: form.additionalRemarks.trim(),
      districtId: selectedSchool.districtId,
      talukId: selectedSchool.talukId,
      schoolId: selectedSchool.id,
      screeningDate,
      status: 'Pending',
    };

    setIsSaving(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const submission = {
        organizationId: user.organizationId,
        userId: user.id,
        sessionId: selectedSession.id,
        student: record,
      };

      if (!isLocalTestSessionActive() && !navigator.onLine) {
        await savePendingSubmission(submission, { idempotencyKey });
        clearSavedDraft(user.id);
        setForm({ ...initialForm, sessionId: selectedSession.id });
        setSubmissionStatus('offline');
        setSavedSiNumber('');
        setSubmitted(true);
        saveAnother.current = false;
        return;
      }

      const siNumber = await createStudentScreening(submission, { idempotencyKey });
      clearSavedDraft(user.id);
      setSubmissionStatus('online');
      setSavedSiNumber(siNumber);
      if (saveAnother.current) {
        setForm({
          ...initialForm,
          districtId: selectedSchool.districtId,
          talukId: selectedSchool.talukId,
          schoolId: selectedSchool.id,
          sessionId: selectedSession.id,
        });
        setSubmitted(true);
      } else {
        navigate(`/students?sessionId=${encodeURIComponent(selectedSession.id)}`);
      }
      saveAnother.current = false;
    } catch (saveError) {
      console.error('Unable to save the student screening.', saveError);
      setError(saveError instanceof Error ? saveError.message : 'The student screening could not be saved.');
    } finally {
      saveAnother.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Student Screening</h2>
          <p className="mt-1 text-sm text-slate-600">Enter the student’s details and measurements for this screening session.</p>
        </div>
        <button type="button" onClick={handleCancel} className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
      </div>
        {pendingSubmissions.length > 0 && <section aria-label="Offline submission status" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-900">Saved submissions on this device</h3>
          <ul className="space-y-2">
            {pendingSubmissions.map((submission) => {
              const statusLabel = {
                pending: 'Pending',
                syncing: 'Syncing',
                synced: 'Synced',
                failed: 'Failed',
                conflict: 'Conflict',
                resolved: 'Resolved — kept server',
              }[submission.syncStatus];
              const statusStyle = {
                pending: 'bg-amber-100 text-amber-900',
                syncing: 'bg-sky-100 text-sky-900',
                synced: 'bg-emerald-100 text-emerald-900',
                failed: 'bg-rose-100 text-rose-900',
                conflict: 'bg-rose-100 text-rose-900',
                resolved: 'bg-slate-200 text-slate-800',
              }[submission.syncStatus];

              return <li key={submission.localId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm">
                <span>SI Number {submission.data.student.siNumber || 'assigned when synced'} · {new Date(submission.createdAt).toLocaleString()}</span>
                <span className={`rounded-full px-2.5 py-1 font-medium ${statusStyle}`}>{statusLabel}</span>
                {submission.lastError && <span className="basis-full text-xs text-rose-800">{submission.lastError}{submission.retryable ? ' — will retry automatically when possible.' : ''}</span>}
                {submission.syncStatus === 'conflict' && <div className="basis-full space-y-3 rounded-lg border border-rose-200 bg-white p-3">
                  <p className="font-medium text-rose-900">No server data was changed. The offline submission is preserved and will not be retried automatically.</p>
                  {submission.serverRecord && <dl className="grid gap-x-4 gap-y-1 text-xs text-slate-700 sm:grid-cols-2">
                    <div><dt className="inline font-semibold">Server student: </dt><dd className="inline">{submission.serverRecord.studentName}</dd></div>
                    <div><dt className="inline font-semibold">Server SI Number: </dt><dd className="inline">{submission.serverRecord.siNumber}</dd></div>
                    <div><dt className="inline font-semibold">Server date of birth: </dt><dd className="inline">{submission.serverRecord.dateOfBirth ?? 'Not recorded'}</dd></div>
                    <div><dt className="inline font-semibold">Server screening date: </dt><dd className="inline">{submission.serverRecord.screeningDate}</dd></div>
                    <div><dt className="inline font-semibold">Server status: </dt><dd className="inline">{submission.serverRecord.status}</dd></div>
                    <div><dt className="inline font-semibold">Server height / weight: </dt><dd className="inline">{submission.serverRecord.heightCm ?? '—'} cm / {submission.serverRecord.weightKg ?? '—'} kg</dd></div>
                  </dl>}
                  <p className="text-xs text-slate-700">Compare with the local SI Number {submission.data.student.siNumber}, student {submission.data.student.studentName}, date of birth {submission.data.student.dateOfBirth}, and screening date {submission.data.student.screeningDate}. If unsure, leave this conflict unresolved and contact your administrator.</p>
                  {pendingResolutionId === submission.localId
                    ? <div role="alert" className="space-y-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-950">
                      <p>Keep the server version? The local submission will stay on this device as resolved and will not be sent again. This does not delete the local record.</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void handleKeepServerVersion(submission.localId)} className="rounded-lg bg-slate-800 px-3 py-2 font-medium text-white">Confirm keep server version</button>
                        <button type="button" onClick={() => setPendingResolutionId(null)} className="rounded-lg border border-slate-300 px-3 py-2 font-medium">Cancel</button>
                      </div>
                    </div>
                    : <button type="button" onClick={() => setPendingResolutionId(submission.localId)} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-medium text-rose-900 hover:bg-rose-50">Resolve by keeping server version</button>}
                </div>}
                {submission.syncStatus === 'resolved' && <span className="basis-full text-xs text-slate-700">The server version was explicitly kept. The offline copy remains stored on this device and will not sync.</span>}
              </li>;
            })}
          </ul>
        </section>}
        {pendingStorageError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{pendingStorageError}</div>}
        {draftError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{draftError}</div>}
        {syncMessage && <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{syncMessage}</div>}
        {sessionsError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Screening sessions could not be loaded: {sessionsError}</div>}
      {!isLoading && !sessionsError && !(sessions ?? []).some((session) => session.status === 'active') && <div role="status" className="flex flex-col gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"><p>No active screening session is assigned or available to your account. Student records must belong to an active session before they can be saved.</p>{user?.role === 'organization_admin' && <button type="button" onClick={() => navigate('/screening-sessions')} className="shrink-0 self-start rounded-lg bg-amber-900 px-3 py-2 font-semibold text-white hover:bg-amber-950 sm:self-auto">Create or assign a session</button>}</div>}
      {!isLoading && !sessionsError && form.sessionId && !selectedSession && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">The selected session is no longer active or is unavailable. Choose an active session to continue.</p>}

      <form onSubmit={(event) => void handleSubmit(event)} className="card space-y-5">
        {draftSavedAt && <p role="status" className="text-xs font-medium text-slate-500">Draft saved {Math.max(0, Math.floor((draftClock - Date.parse(draftSavedAt)) / 1000))}s ago.</p>}
        <div className="rounded-xl bg-cyan-50 p-4 text-sm text-cyan-950">
          <div className="font-semibold">Screening location</div>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <label className="block font-medium">District
              <select required value={form.districtId} onChange={(event) => handleDistrictChange(event.target.value)} disabled={districtsLoading || Boolean(districtsError) || isSaving} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <option value="">Select a district</option>
                {(districts ?? []).map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
              </select>
            </label>
            <label className="block font-medium">Taluk
              <select required value={form.talukId} onChange={(event) => handleTalukChange(event.target.value)} disabled={!form.districtId || taluksLoading || Boolean(taluksError) || isSaving} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <option value="">Select a taluk</option>
                {availableTaluks.map((taluk) => <option key={taluk.id} value={taluk.id}>{taluk.name}</option>)}
              </select>
            </label>
            <label className="block font-medium">Select School
              <select required value={form.schoolId} onChange={(event) => handleSchoolChange(event.target.value)} disabled={!form.districtId || !form.talukId || schoolsLoading || Boolean(schoolsError) || isSaving} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <option value="">Select a school</option>
                {availableSchools.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.code}</option>)}
              </select>
            </label>
            <label className="block font-medium">Active screening session
              <select required value={form.sessionId} onChange={(event) => handleSessionChange(event.target.value)} disabled={!form.schoolId || isLoading || Boolean(sessionsError) || isSaving} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <option value="">Select an active screening session</option>
                {availableSessions.map((session) => <option key={session.id} value={session.id}>{session.name} · {session.date}</option>)}
              </select>
            </label>
          </div>
          {districtsLoading && <p role="status" className="mt-2 text-sm text-slate-600">Loading districts…</p>}
          {taluksLoading && <p role="status" className="mt-2 text-sm text-slate-600">Loading taluks…</p>}
          {schoolsLoading && <p role="status" className="mt-2 text-sm text-slate-600">Loading active schools…</p>}
          {isLoading && <p role="status" className="mt-2 text-sm text-slate-600">Loading screening sessions…</p>}
          {!districtsLoading && !districtsError && (districts ?? []).length === 0 && (
            <p className="mt-2 text-sm text-slate-700">No districts are available in your authorized scope. Ask an administrator to configure a district.</p>
          )}
          {form.districtId && !taluksLoading && !taluksError && availableTaluks.length === 0 && (
            <p className="mt-2 text-sm text-slate-700">No taluks are available for this district.</p>
          )}
          {(districtsError || taluksError || schoolsError) && (
            <div role="alert" className="mt-2 text-sm text-rose-800">
              {districtsError && <p>Districts could not be loaded: {districtsError}</p>}
              {taluksError && <p>Taluks could not be loaded: {taluksError}</p>}
              {schoolsError && <p>Schools could not be loaded: {schoolsError} <button type="button" onClick={reloadSchools} className="underline">Retry</button></p>}
            </div>
          )}
          {!schoolsLoading && !schoolsError && (schools ?? []).length === 0 && (
            <p className="mt-2 text-sm text-slate-700">No active schools are available in your authorized scope. Ask an administrator to add an active school.</p>
          )}
          {form.districtId && form.talukId && !schoolsLoading && !schoolsError && availableSchools.length === 0 && (schools ?? []).length > 0 && (
            <p className="mt-2 text-sm text-slate-700">No active schools are available for this district and taluk.</p>
          )}
          {form.schoolId && !isLoading && !sessionsError && availableSessions.length === 0 && (
            <div className="mt-2 flex flex-col gap-2 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"><p>No active screening sessions are available for this school. Create or assign a session, then return here; your student draft will remain saved.</p>{user?.role === 'organization_admin' && <button type="button" onClick={() => navigate('/screening-sessions')} className="self-start font-semibold text-cyan-800 underline sm:self-auto">Go to Screening Sessions</button>}</div>
          )}
          {selectedSession && <div className="mt-2 grid gap-1 text-slate-700 sm:grid-cols-2">
            <span>School: {selectedSession.schoolName}</span><span>District: {selectedSession.districtName}</span>
            <span>Taluk: {selectedSession.talukName}</span><span>BEO: {selectedSession.beoName}</span>
            <span>Head Master: {selectedSession.headMasterName}</span><span>Screening Faculty: {selectedSession.screeningFacultyName}</span>
          </div>}
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Student information</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">SI NO<input readOnly value="Assigned automatically on save" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-500" /><span className="mt-1 block text-xs font-normal text-slate-500">The number restarts for each screening session.</span></label>
          <label className="text-sm font-medium text-slate-700">Student Name<input required maxLength={200} autoComplete="off" value={form.studentName} onChange={(event) => handleChange('studentName', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Class / Grade<select required value={form.className} onChange={(event) => handleChange('className', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">Select class</option>{[...Array.from({ length: 10 }, (_, index) => String(index + 1)), 'Other'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Section<select required value={form.section} onChange={(event) => handleChange('section', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">Select section</option>{['A', 'B', 'C', 'D', 'Other'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Sex<select required value={form.sex} onChange={(event) => handleChange('sex', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">Select an option</option><option>Male</option><option>Female</option><option>Other</option><option>Prefer not to specify</option></select></label>
          <label className="text-sm font-medium text-slate-700">Date of Birth (DD/MM/YYYY)<input required type="text" inputMode="numeric" autoComplete="off" maxLength={10} pattern="\d{2}/\d{2}/\d{4}" placeholder="DD/MM/YYYY" value={form.dateOfBirth} onChange={(event) => handleChange('dateOfBirth', formatDateOfBirthInput(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /><span className="mt-1 block text-xs font-normal text-slate-500">Age is calculated using the screening date.</span></label>
          <label className="text-sm font-medium text-slate-700">Height (cm)<input required type="number" min="1" step="0.1" value={form.heightCm} onChange={(event) => handleChange('heightCm', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Weight (kg)<input required type="number" min="0.1" step="0.1" value={form.weightKg} onChange={(event) => handleChange('weightKg', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Age at screening<input value={age} readOnly className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">BMI (auto)<input value={bmi || ''} readOnly className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5" /></label>
        </div>

        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Screening observations</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Skeletal Deformity
            <select value={form.skeletalDeformity} onChange={(event) => handleChange('skeletalDeformity', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option>No</option><option>Yes</option><option>Suspected</option><option>Not assessed</option></select>
          </label>
          {(form.skeletalDeformity === 'Yes' || form.skeletalDeformity === 'Suspected') && <label className="text-sm font-medium text-slate-700">Type / Observation
            <textarea required rows={2} maxLength={1000} value={form.skeletalObservation} onChange={(event) => handleChange('skeletalObservation', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </label>}
          <label className="text-sm font-medium text-slate-700">Skin Thickness (mm)<span className="mt-1 block text-xs font-normal text-slate-500">Optional — leave blank if not measured.</span><input type="number" min="0" step="0.1" value={form.skinThicknessMm} onChange={(event) => handleChange('skinThicknessMm', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Mid-Arm Circumference (cm)<span className="mt-1 block text-xs font-normal text-slate-500">Optional — leave blank if not measured.</span><input type="number" min="0" step="0.1" value={form.midArmCircumferenceCm} onChange={(event) => handleChange('midArmCircumferenceCm', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
        </div>
        <label className="block text-sm font-medium text-slate-700">Additional Remarks
          <textarea rows={3} maxLength={2000} value={form.additionalRemarks} onChange={(event) => handleChange('additionalRemarks', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            BMI is informational and not diagnostic. {isLocalTestSessionActive() ? 'Local test records stay in this browser and are not sent to Supabase.' : 'Screening data is saved to your organization database.'}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="submit" title={!selectedSession ? 'Choose an active screening session before saving.' : undefined} onClick={() => { saveAnother.current = false; }} disabled={isSaving || isLoading || Boolean(sessionsError) || !selectedSession} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4">Save student</button>
            <button type="submit" title={!selectedSession ? 'Choose an active screening session before saving.' : undefined} onClick={() => { saveAnother.current = true; }} disabled={isSaving || isLoading || Boolean(sessionsError) || !selectedSession} className="rounded-xl bg-cyan-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4">{isSaving ? 'Saving…' : 'Save & Add Another'}</button>
          </div>
          {!selectedSession && <p role="status" className="text-right text-sm text-amber-800">Select an active screening session to enable saving. Your draft is saved on this device.</p>}
        </div>

        {submitted && <div role="status" className={`rounded-xl px-4 py-3 text-sm ${submissionStatus === 'offline' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}>{submissionStatus === 'offline' ? 'Offline — data saved on this device. It is pending and will sync automatically when connected; the SI NO will be assigned when synced.' : `Student screening saved with SI NO ${savedSiNumber}.`}</div>}
        {error && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      </form>
    </div>
  );
}
