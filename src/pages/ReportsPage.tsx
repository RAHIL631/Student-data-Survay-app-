import { useMemo, useState } from 'react';
import { useRemoteData } from '../hooks/useRemoteData';
import { getScreeningSessions, getStudentRecords } from '../lib/dataService';

type ExportScope = 'all' | 'school' | 'session' | 'filtered';

export function ReportsPage() {
  const { data: students, isLoading, error, reload } = useRemoteData(getStudentRecords);
  const { data: sessions, isLoading: sessionsLoading, error: sessionsError, reload: reloadSessions } = useRemoteData(getScreeningSessions);
  const [exportScope, setExportScope] = useState<ExportScope>('filtered');
  const [districtId, setDistrictId] = useState('');
  const [talukId, setTalukId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [className, setClassName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [sex, setSex] = useState('');
  const [screeningDate, setScreeningDate] = useState('');
  const [deformity, setDeformity] = useState('');
  const [bmiMin, setBmiMin] = useState('');
  const [bmiMax, setBmiMax] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState('');

  const rows = students ?? [];
  const availableSessions = sessions ?? [];
  const schoolOptions = useMemo(() => {
    const schools = new Map(availableSessions.map((session) => [session.schoolId, session.schoolName]));
    return [...schools.entries()].sort(([, left], [, right]) => left.localeCompare(right));
  }, [availableSessions]);
  const districtOptions = useMemo(() => {
    const districts = new Map(availableSessions.map((session) => [session.districtId, session.districtName]));
    return [...districts.entries()].sort(([, left], [, right]) => left.localeCompare(right));
  }, [availableSessions]);
  const talukOptions = useMemo(() => {
    const taluks = new Map(availableSessions
      .filter((session) => !districtId || session.districtId === districtId)
      .map((session) => [session.talukId, session.talukName]));
    return [...taluks.entries()].sort(([, left], [, right]) => left.localeCompare(right));
  }, [availableSessions, districtId]);

  const filteredStudents = useMemo(() => rows.filter((student) => (
    (!districtId || student.districtId === districtId) &&
    (!talukId || student.talukId === talukId) &&
    (!schoolId || student.schoolId === schoolId) &&
    (!sessionId || student.sessionId === sessionId) &&
    (!className || student.className === className) &&
    (!studentName || student.studentName.toLowerCase().includes(studentName.trim().toLowerCase())) &&
    (!sex || student.sex === sex) &&
    (!screeningDate || student.screeningDate === screeningDate) &&
    (!deformity || student.skeletalDeformity === deformity) &&
    (bmiMin === '' || student.bmi >= Number(bmiMin)) &&
    (bmiMax === '' || student.bmi <= Number(bmiMax))
  )), [rows, districtId, talukId, schoolId, sessionId, className, studentName, sex, screeningDate, deformity, bmiMin, bmiMax]);

  const exportStudents = useMemo(() => {
    if (exportScope === 'all') return rows;
    if (exportScope === 'school') return schoolId ? rows.filter((student) => student.schoolId === schoolId) : [];
    if (exportScope === 'session') return sessionId ? rows.filter((student) => student.sessionId === sessionId) : [];
    return filteredStudents;
  }, [exportScope, rows, schoolId, sessionId, filteredStudents]);

  const handleExcelExport = async () => {
    setExportError('');
    setExporting('excel');
    try {
      const { exportStudentExcel } = await import('../services/export/studentReport');
      await exportStudentExcel(exportStudents, availableSessions);
    } catch (error) {
      console.error('Unable to create the Excel screening report.', error);
      setExportError('The Excel report could not be created. Try again or contact your administrator.');
    } finally {
      setExporting(null);
    }
  };

  const handlePdfExport = async () => {
    setExportError('');
    setExporting('pdf');
    try {
      const { exportStudentPdf } = await import('../services/export/studentReport');
      await exportStudentPdf(exportStudents, availableSessions);
    } catch (error) {
      console.error('Unable to create the PDF screening report.', error);
      setExportError('The PDF report could not be created. Try again or contact your administrator.');
    } finally {
      setExporting(null);
    }
  };

  const studentsLoading = isLoading || sessionsLoading;
  const loadError = error || sessionsError;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reports</h2>
          <p className="mt-1 text-sm text-slate-600">Search and export only the student screenings available to your account.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={studentsLoading || Boolean(loadError) || exportStudents.length === 0 || exporting !== null} onClick={() => void handleExcelExport()} className="rounded-xl bg-cyan-700 px-4 py-2 font-medium text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">
            {exporting === 'excel' ? 'Preparing Excel…' : 'Export Excel'}
          </button>
          <button disabled={studentsLoading || Boolean(loadError) || exportStudents.length === 0 || exporting !== null} onClick={handlePdfExport} className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            {exporting === 'pdf' ? 'Preparing PDF…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {loadError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
        Report data could not be loaded: {loadError}
        {error && <button onClick={reload} className="ml-2 underline">Retry students</button>}
        {sessionsError && <button onClick={reloadSessions} className="ml-2 underline">Retry sessions</button>}
      </div>}
      {exportError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{exportError}</p>}
      {studentsLoading && <p role="status" className="text-sm text-slate-500">Loading report data…</p>}

      {!loadError && !studentsLoading && <section className="card space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900">Report filters and export preview</h3>
          <p className="mt-1 text-sm text-slate-500">BMI is exported as a measurement only; this report does not make a diagnosis.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Export records<select value={exportScope} onChange={(event) => setExportScope(event.target.value as ExportScope)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <option value="all">All available records</option><option value="school">Current school</option><option value="session">Current session</option><option value="filtered">Filtered records</option>
          </select></label>
          <label className="text-sm font-medium text-slate-700">District<select value={districtId} onChange={(event) => { setDistrictId(event.target.value); setTalukId(''); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">All districts</option>{districtOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Taluk<select value={talukId} onChange={(event) => setTalukId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">All taluks</option>{talukOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">School<select value={schoolId} onChange={(event) => setSchoolId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">All schools</option>{schoolOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Screening session<select value={sessionId} onChange={(event) => setSessionId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">All sessions</option>{availableSessions.map((session) => <option key={session.id} value={session.id}>{session.schoolName} · {session.date}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Class<select value={className} onChange={(event) => setClassName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">All classes</option>{[...new Set(rows.map((student) => student.className))].sort().map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Student name<input type="search" value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Search name" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Sex<select value={sex} onChange={(event) => setSex(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">All</option>{['Male', 'Female', 'Other', 'Prefer not to specify'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Screening date<input type="date" value={screeningDate} onChange={(event) => setScreeningDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Skeletal deformity<select value={deformity} onChange={(event) => setDeformity(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><option value="">All observations</option>{['No', 'Yes', 'Suspected', 'Not assessed'].map((value) => <option key={value}>{value}</option>)}</select></label>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="text-sm font-medium text-slate-700">BMI range</legend>
            <input aria-label="Minimum BMI" type="number" step="0.01" min="0" placeholder="Min" value={bmiMin} onChange={(event) => setBmiMin(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            <input aria-label="Maximum BMI" type="number" step="0.01" min="0" placeholder="Max" value={bmiMax} onChange={(event) => setBmiMax(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
          </fieldset>
        </div>
        {exportScope === 'school' && !schoolId && <p role="status" className="text-sm text-amber-800">Choose a school to export its records.</p>}
        {exportScope === 'session' && !sessionId && <p role="status" className="text-sm text-amber-800">Choose a session to export its records.</p>}
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700"><strong>{exportStudents.length}</strong> record{exportStudents.length === 1 ? '' : 's'} in this export preview.</div>
        {exportStudents.length === 0 ? <p className="text-sm text-slate-500">No student screenings match this export selection.</p> : <div className="table-shell">
          <table>
            <thead><tr><th>SI NO</th><th>School</th><th>Student</th><th>Class & sec</th><th>Sex</th><th>Age</th><th>BMI</th><th>Date</th></tr></thead>
            <tbody>{exportStudents.slice(0, 5).map((student) => (
              <tr key={student.id}><td>{student.siNumber}</td><td>{availableSessions.find((session) => session.id === student.sessionId)?.schoolName ?? student.schoolId}</td><td>{student.studentName}</td><td>{student.className} {student.section}</td><td>{student.sex}</td><td>{student.age}</td><td>{student.bmi}</td><td>{student.screeningDate}</td></tr>
            ))}</tbody>
          </table>
          {exportStudents.length > 5 && <p className="px-3 py-2 text-xs text-slate-500">Showing the first five records; the export includes all {exportStudents.length}.</p>}
        </div>}
      </section>}
    </div>
  );
}
