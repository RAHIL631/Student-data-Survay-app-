import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRemoteData } from '../hooks/useRemoteData';
import {
  createStudentScreening,
  getActiveSchoolsForOrganization,
  getDistricts,
  getStudentRecord,
  getScreeningSessions,
  getTaluks,
  updateStudentScreening,
} from '../lib/dataService';
import { getLocalDateString } from '../lib/date';
import { calculateAge, calculateBmi } from '../lib/permissions';
import { isLocalTestSessionActive } from '../lib/localTestMode';
import type { StudentRecord } from '../types';

const initialForm = {
  siNumber: '',
  studentName: '',
  className: '',
  section: '',
  sex: '',
  dateOfBirth: '',
  heightCm: '',
  weightKg: '',
  skeletalDeformity: '',
  skeletalObservation: '',
  skinThicknessMm: '',
  midArmCircumferenceCm: '',
  additionalRemarks: '',
  sessionId: '',
  districtId: '',
  talukId: '',
  schoolId: '',
};

const skeletalObservationRequiredMessage = 'Enter the type or observation when Skeletal Deformity is Yes or Suspected.';

function parseSex(value: string): StudentRecord['sex'] {
  switch (value) {
    case 'Male':
    case 'Female':
    case 'Other':
    case 'Prefer not to specify':
      return value;
    default:
      return null;
  }
}

function parseSkeletalDeformity(value: string): StudentRecord['skeletalDeformity'] {
  switch (value) {
    case 'No':
    case 'Yes':
    case 'Suspected':
    case 'Not assessed':
      return value;
    default:
      return null;
  }
}

export function StudentRegistrationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const studentId = searchParams.get('studentId');
  const isEditing = Boolean(studentId);
  const organizationId = user?.organizationId;
  const loadSchools = useCallback(
    () => organizationId ? getActiveSchoolsForOrganization(organizationId) : Promise.resolve([]),
    [organizationId],
  );
  const { data: sessions, isLoading: sessionsLoading, error: sessionsError } = useRemoteData(getScreeningSessions);
  const { data: districts, isLoading: districtsLoading, error: districtsError } = useRemoteData(getDistricts);
  const { data: taluks, isLoading: taluksLoading, error: taluksError } = useRemoteData(getTaluks);
  const { data: schools, isLoading: schoolsLoading, error: schoolsError, reload: reloadSchools } = useRemoteData(loadSchools);
  const loadStudent = useCallback(
    () => studentId ? getStudentRecord(studentId) : Promise.resolve(null),
    [studentId],
  );
  const { data: existingStudent, isLoading: studentLoading, error: studentError, reload: reloadStudent } = useRemoteData(loadStudent);
  const [form, setForm] = useState(() => ({ ...initialForm, sessionId: searchParams.get('sessionId') ?? '' }));
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveAnother = useRef(false);
  const initializedStudentId = useRef<string | null>(null);
  const pendingStudentId = useRef<string | null>(null);
  const pendingSiReservation = useRef<{ siNumber: string; key: string } | null>(null);

  const today = getLocalDateString();
  const heightCm = form.heightCm === '' ? null : Number(form.heightCm);
  const weightKg = form.weightKg === '' ? null : Number(form.weightKg);
  const skinThicknessMm = form.skinThicknessMm === '' ? null : Number(form.skinThicknessMm);
  const midArmCircumferenceCm = form.midArmCircumferenceCm === '' ? null : Number(form.midArmCircumferenceCm);
  const requiresSkeletalObservation = form.skeletalDeformity === 'Yes' || form.skeletalDeformity === 'Suspected';
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
  const screeningDate = isEditing ? existingStudent?.screeningDate ?? today : selectedSession?.date ?? today;
  const age = form.dateOfBirth ? calculateAge(form.dateOfBirth, screeningDate) : null;
  const bmi = heightCm !== null && weightKg !== null && heightCm > 0 && weightKg > 0
    ? calculateBmi(weightKg, heightCm)
    : null;

  useEffect(() => {
    if (!studentId || !existingStudent || initializedStudentId.current === studentId) return;

    setForm({
      siNumber: existingStudent.siNumber ?? '',
      studentName: existingStudent.studentName ?? '',
      className: existingStudent.className ?? '',
      section: existingStudent.section ?? '',
      sex: existingStudent.sex ?? '',
      dateOfBirth: existingStudent.dateOfBirth ?? '',
      heightCm: existingStudent.heightCm === null ? '' : String(existingStudent.heightCm),
      weightKg: existingStudent.weightKg === null ? '' : String(existingStudent.weightKg),
      skeletalDeformity: existingStudent.skeletalDeformity ?? '',
      skeletalObservation: existingStudent.skeletalObservation ?? '',
      skinThicknessMm: existingStudent.skinThicknessMm === null ? '' : String(existingStudent.skinThicknessMm),
      midArmCircumferenceCm: existingStudent.midArmCircumferenceCm === null ? '' : String(existingStudent.midArmCircumferenceCm),
      additionalRemarks: existingStudent.additionalRemarks ?? '',
      sessionId: existingStudent.sessionId,
      districtId: existingStudent.districtId,
      talukId: existingStudent.talukId,
      schoolId: existingStudent.schoolId,
    });
    initializedStudentId.current = studentId;
  }, [existingStudent, studentId]);

  useEffect(() => {
    if (isEditing) return;
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
  }, [form.sessionId, isEditing, sessions]);

  const handleChange = (key: keyof typeof initialForm, value: string) => {
    if (key === 'siNumber' && pendingSiReservation.current?.siNumber !== value.trim()) {
      pendingSiReservation.current = null;
    }
    setForm((current) => ({ ...current, [key]: value }));
    setSubmitted(false);
    setError('');
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
    setError('');

    if (requiresSkeletalObservation && !form.skeletalObservation.trim()) {
      setError(skeletalObservationRequiredMessage);
      return;
    }

    const sessionId = isEditing ? existingStudent?.sessionId : selectedSession?.id;
    const districtId = isEditing ? existingStudent?.districtId : selectedSchool?.districtId;
    const talukId = isEditing ? existingStudent?.talukId : selectedSchool?.talukId;
    const schoolId = isEditing ? existingStudent?.schoolId : selectedSchool?.id;

    if (!user || !sessionId || !districtId || !talukId || !schoolId || (isEditing && !existingStudent) || (!isEditing && (!selectedSchool || !selectedSession))) {
      setError('Select an active school and screening session available to your account.');
      return;
    }

    if (!isEditing && selectedSchool && selectedSession && (
      selectedSession.schoolId !== selectedSchool.id
      || selectedSession.districtId !== selectedSchool.districtId
      || selectedSession.talukId !== selectedSchool.talukId
    )) {
      setError('The selected school does not match the screening session location.');
      return;
    }

    if (
      (heightCm !== null && (!Number.isFinite(heightCm) || heightCm <= 0)) ||
      (weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0)) ||
      (skinThicknessMm !== null && (!Number.isFinite(skinThicknessMm) || skinThicknessMm < 0)) ||
      (midArmCircumferenceCm !== null && (!Number.isFinite(midArmCircumferenceCm) || midArmCircumferenceCm < 0)) ||
      (form.dateOfBirth !== '' && (typeof age !== 'number' || !Number.isFinite(age) || age < 0 || age > 120))
    ) {
      setError('Correct the invalid birth date or measurement values before saving.');
      return;
    }

    const savedAge = typeof age === 'number' && Number.isFinite(age) ? age : null;
    const savedBmi = bmi !== null && Number.isFinite(bmi) && bmi > 0 ? bmi : null;
    const normalizedSiNumber = form.siNumber.trim() || null;
    const submissionId = existingStudent?.id ?? pendingStudentId.current ?? crypto.randomUUID();
    if (!existingStudent) pendingStudentId.current = submissionId;
    if (normalizedSiNumber && (!existingStudent || normalizedSiNumber !== existingStudent.siNumber)
      && pendingSiReservation.current?.siNumber !== normalizedSiNumber) {
      pendingSiReservation.current = { siNumber: normalizedSiNumber, key: crypto.randomUUID() };
    }
    const record: StudentRecord = {
      id: submissionId,
      sessionId,
      siNumber: normalizedSiNumber,
      studentName: form.studentName.trim() || null,
      className: form.className.trim() || null,
      section: form.section.trim() || null,
      sex: parseSex(form.sex),
      dateOfBirth: form.dateOfBirth || null,
      age: savedAge,
      heightCm,
      weightKg,
      bmi: savedBmi,
      skeletalDeformity: parseSkeletalDeformity(form.skeletalDeformity),
      skeletalObservation: form.skeletalObservation.trim() || null,
      skinThicknessMm,
      midArmCircumferenceCm,
      additionalRemarks: form.additionalRemarks.trim() || null,
      districtId,
      talukId,
      schoolId,
      districtName: existingStudent?.districtName ?? '',
      talukName: existingStudent?.talukName ?? '',
      schoolName: existingStudent?.schoolName ?? selectedSchool?.name ?? '',
      screeningDate,
      status: existingStudent?.status ?? 'Pending',
    };

    setIsSaving(true);
    try {
      if (isEditing && existingStudent) {
        await updateStudentScreening({
          studentId: existingStudent.id,
          userId: user.id,
          student: record,
          siReservationKey: pendingSiReservation.current?.key,
        });
        navigate(`/students/${encodeURIComponent(existingStudent.id)}`);
      } else {
        await createStudentScreening({
          organizationId: user.organizationId,
          userId: user.id,
          sessionId,
          student: record,
          siReservationKey: pendingSiReservation.current?.key,
        });
        pendingStudentId.current = null;
        pendingSiReservation.current = null;
      }
      if (!isEditing && saveAnother.current && selectedSchool && selectedSession) {
        setForm({
          ...initialForm,
          districtId: selectedSchool.districtId,
          talukId: selectedSchool.talukId,
          schoolId: selectedSchool.id,
          sessionId: selectedSession.id,
        });
        setSubmitted(true);
      } else if (!isEditing) {
        navigate(`/students?sessionId=${encodeURIComponent(sessionId)}`);
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

  if (isEditing && studentLoading) {
    return <p role="status" className="py-8 text-center text-sm text-slate-500">Loading student screening…</p>;
  }

  if (isEditing && (studentError || !existingStudent)) {
    return (
      <div role="alert" className="space-y-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
        <p>{studentError ? `Student screening could not be loaded: ${studentError}` : 'This student screening was not found in your authorized scope.'}</p>
        <div className="flex gap-3">
          {studentError && <button onClick={reloadStudent} className="underline">Retry</button>}
          <button onClick={() => navigate('/students')} className="underline">Back to students</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900">{isEditing ? 'Edit Student Screening' : 'Student Screening'}</h2>
        <button type="button" onClick={() => navigate('/screening-sessions')} className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
      </div>
      {!isEditing && sessionsError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Screening sessions could not be loaded: {sessionsError}</div>}
      {!isEditing && !sessionsLoading && !sessionsError && !(sessions ?? []).some((session) => session.status === 'active') && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No active screening session is assigned or available to your account. Ask an administrator to create a session or assign you to one.</p>}

      <form onSubmit={(event) => void handleSubmit(event)} className="card space-y-5">
        {!isEditing ? (
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
              <select required value={form.sessionId} onChange={(event) => handleSessionChange(event.target.value)} disabled={!form.schoolId || sessionsLoading || Boolean(sessionsError) || isSaving} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <option value="">Select an active screening session</option>
                {availableSessions.map((session) => <option key={session.id} value={session.id}>{session.name} · {session.date}</option>)}
              </select>
            </label>
          </div>
          {districtsLoading && <p role="status" className="mt-2 text-sm text-slate-600">Loading districts…</p>}
          {taluksLoading && <p role="status" className="mt-2 text-sm text-slate-600">Loading taluks…</p>}
          {schoolsLoading && <p role="status" className="mt-2 text-sm text-slate-600">Loading active schools…</p>}
          {sessionsLoading && <p role="status" className="mt-2 text-sm text-slate-600">Loading screening sessions…</p>}
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
          {form.schoolId && !sessionsLoading && !sessionsError && availableSessions.length === 0 && (
            <p className="mt-2 text-sm text-slate-700">No active screening sessions are available for this school. Ask an administrator to create or assign a session.</p>
          )}
          {selectedSession && <div className="mt-2 grid gap-1 text-slate-700 sm:grid-cols-2">
            <span>School: {selectedSession.schoolName}</span><span>District: {selectedSession.districtName}</span>
            <span>Taluk: {selectedSession.talukName}</span><span>BEO: {selectedSession.beoName}</span>
            <span>Head Master: {selectedSession.headMasterName}</span><span>Screening Faculty: {selectedSession.screeningFacultyName}</span>
          </div>}
        </div>
        ) : (
          <div className="rounded-xl bg-cyan-50 p-4 text-sm text-cyan-950">
            <div className="font-semibold">Screening location</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <span>School: {existingStudent?.schoolName}</span>
              <span>District: {existingStudent?.districtName}</span>
              <span>Taluk: {existingStudent?.talukName}</span>
              <span>Screening date: {existingStudent?.screeningDate}</span>
            </div>
            <p className="mt-2 text-xs text-cyan-900">The original screening location and session are retained when editing.</p>
          </div>
        )}
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Student information</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">SI Number<input value={form.siNumber} onChange={(event) => handleChange('siNumber', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Student Name<input value={form.studentName} onChange={(event) => handleChange('studentName', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Class<select value={form.className} onChange={(event) => handleChange('className', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">Select class</option>{['1','2','3','4','5','6','7','8','9','10','Other'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Section<select value={form.section} onChange={(event) => handleChange('section', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">Select section</option>{['A','B','C','D','Other'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Sex<select value={form.sex} onChange={(event) => handleChange('sex', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">Select sex</option><option>Male</option><option>Female</option><option>Other</option><option>Prefer not to specify</option></select></label>
          <label className="text-sm font-medium text-slate-700">Date of Birth<input type="date" max={screeningDate} value={form.dateOfBirth} onChange={(event) => handleChange('dateOfBirth', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Height (cm)<input type="number" min="1" step="0.1" value={form.heightCm} onChange={(event) => handleChange('heightCm', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Weight (kg)<input type="number" min="0.1" step="0.1" value={form.weightKg} onChange={(event) => handleChange('weightKg', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Age at screening<input value={age ?? ''} readOnly className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">BMI (auto)<input value={bmi ?? ''} readOnly className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5" /></label>
        </div>

        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Screening observations</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Skeletal Deformity
            <select value={form.skeletalDeformity} onChange={(event) => handleChange('skeletalDeformity', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">Select response</option><option>No</option><option>Yes</option><option>Suspected</option><option>Not assessed</option></select>
          </label>
          {requiresSkeletalObservation && <label className="text-sm font-medium text-slate-700">
            Type / Observation <span className="text-rose-600" aria-hidden="true">*</span>
            <input
              required={requiresSkeletalObservation}
              value={form.skeletalObservation}
              onInvalid={(event) => {
                event.currentTarget.setCustomValidity(skeletalObservationRequiredMessage);
                setError(skeletalObservationRequiredMessage);
              }}
              onChange={(event) => {
                event.currentTarget.setCustomValidity('');
                handleChange('skeletalObservation', event.target.value);
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
            />
            <span className="mt-1 block text-xs font-normal text-slate-600">Required when Skeletal Deformity is Yes or Suspected.</span>
          </label>}
          <label className="text-sm font-medium text-slate-700">Skin Thickness (mm)<input type="number" min="0" step="0.1" value={form.skinThicknessMm} onChange={(event) => handleChange('skinThicknessMm', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Mid-Arm Circumference (cm)<input type="number" min="0" step="0.1" value={form.midArmCircumferenceCm} onChange={(event) => handleChange('midArmCircumferenceCm', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
        </div>
        <label className="block text-sm font-medium text-slate-700">Additional Remarks
          <textarea rows={3} value={form.additionalRemarks} onChange={(event) => handleChange('additionalRemarks', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
        </label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Incomplete records are saved as Pending. BMI is informational and not diagnostic. {isLocalTestSessionActive() ? 'Local test records stay in this browser and are not sent to Supabase.' : 'Screening data is saved to your organization database.'}
          </p>
          <div className="flex gap-2">
            <button type="submit" onClick={() => { saveAnother.current = false; }} disabled={isSaving || (!isEditing && (sessionsLoading || Boolean(sessionsError) || !selectedSession))} className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{isEditing ? 'Save changes' : 'Save student'}</button>
            {!isEditing && <button type="submit" onClick={() => { saveAnother.current = true; }} disabled={isSaving || sessionsLoading || Boolean(sessionsError) || !selectedSession} className="rounded-xl bg-cyan-600 px-4 py-2.5 font-medium text-white hover:bg-cyan-500 disabled:opacity-50">{isSaving ? 'Saving…' : 'Save & Add Another'}</button>}
          </div>
        </div>

        {submitted && <div role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Student screening saved.</div>}
        {error && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      </form>
    </div>
  );
}
