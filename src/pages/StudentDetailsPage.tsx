import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRemoteData } from '../hooks/useRemoteData';
import { useAuth } from '../context/AuthContext';
import { getStudentRecord } from '../lib/dataService';

function display(value: string | number | null): string {
  return value === null || value === '' ? '—' : String(value);
}

export function StudentDetailsPage() {
  const { user } = useAuth();
  const { studentId } = useParams();
  const navigate = useNavigate();
  const loadStudent = useCallback(
    () => studentId ? getStudentRecord(studentId) : Promise.resolve(null),
    [studentId],
  );
  const { data: student, isLoading, error, reload } = useRemoteData(loadStudent);

  if (isLoading) {
    return <p role="status" className="py-8 text-center text-sm text-slate-500">Loading student screening…</p>;
  }

  if (error || !student) {
    return (
      <div role="alert" className="space-y-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
        <p>{error ? `Student screening could not be loaded: ${error}` : 'This student screening was not found in your authorized scope.'}</p>
        <div className="flex gap-3">
          {error && <button onClick={reload} className="underline">Retry</button>}
          <button onClick={() => navigate('/students')} className="underline">Back to students</button>
        </div>
      </div>
    );
  }

  const fields: Array<[string, string | number | null]> = [
    ['Student ID', student.siNumber],
    ['Student Name', student.studentName],
    ['Gender', student.sex],
    ['Date of Birth', student.dateOfBirth],
    ['Age at Screening', student.age],
    ['Class', student.className],
    ['Section', student.section],
    ['School', student.schoolName],
    ['District', student.districtName],
    ['Taluk', student.talukName],
    ['Screening Date', student.screeningDate],
    ['Height (cm)', student.heightCm],
    ['Weight (kg)', student.weightKg],
    ['BMI', student.bmi],
    ['Skeletal Deformity', student.skeletalDeformity],
    ['Skeletal Observation', student.skeletalObservation],
    ['Skin Thickness (mm)', student.skinThicknessMm],
    ['Mid-Arm Circumference (cm)', student.midArmCircumferenceCm],
    ['Additional Remarks', student.additionalRemarks],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Student Screening Details</h2>
          <p className="mt-1 text-sm text-slate-600">Saved student and screening information.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/students')} className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Back to students</button>
          {user?.role !== 'district_manager' && <button onClick={() => navigate(`/student-registration?studentId=${encodeURIComponent(student.id)}`)} className="rounded-xl bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500">Edit screening</button>}
        </div>
      </div>

      <div className="card">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">Record</h3>
          <span className={`badge ${student.status === 'Complete' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`} aria-label={`Screening status: ${student.status}`}>{student.status}</span>
        </div>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-1 break-words text-sm text-slate-900">{display(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
