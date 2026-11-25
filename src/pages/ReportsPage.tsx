import { useMemo, useState } from 'react';
import { useRemoteData } from '../hooks/useRemoteData';
import { getScreeningSessions, getStudentRecords } from '../lib/dataService';
import { exportCsv } from '../lib/permissions';
import { createStudentExportRows } from '../lib/studentExport.js';

export function ReportsPage() {
  const { data: students, isLoading, error, reload } = useRemoteData(getStudentRecords);
  const { data: sessions } = useRemoteData(getScreeningSessions);
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const reportStudents = students ?? [];
  const exportData = useMemo(() => createStudentExportRows(reportStudents), [students]);
  const exportDisabled = isLoading || Boolean(error) || reportStudents.length === 0 || exporting !== null;

  const handleCsvExport = () => {
    setExportError('');
    try {
      exportCsv('student-health-report.csv', exportData);
    } catch (error) {
      console.error('Unable to export the student health report.', error);
      setExportError('The CSV student health report could not be exported. Try again.');
    }
  };

  const handleStructuredExport = async (format: 'excel' | 'pdf') => {
    setExportError('');
    setExporting(format);
    try {
      const report = await import('../services/export/studentReport.js');
      if (format === 'excel') await report.exportStudentExcel(reportStudents, sessions ?? []);
      else await report.exportStudentPdf(reportStudents, sessions ?? []);
    } catch (error) {
      console.error(`Unable to create the ${format.toUpperCase()} screening report.`, error);
      setExportError(`The ${format.toUpperCase()} student health report could not be exported. Try again.`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reports</h2>
          <p className="mt-1 text-sm text-slate-600">Student screenings available to your account.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={exportDisabled} onClick={handleCsvExport} className="rounded-xl bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50">Export CSV</button>
          <button disabled={exportDisabled} onClick={() => void handleStructuredExport('excel')} className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{exporting === 'excel' ? 'Preparing Excel…' : 'Export Excel'}</button>
          <button disabled={exportDisabled} onClick={() => void handleStructuredExport('pdf')} className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{exporting === 'pdf' ? 'Preparing PDF…' : 'Export PDF'}</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Report data could not be loaded: {error} <button onClick={reload} className="ml-2 underline">Retry</button></div>}
      {exportError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{exportError}</div>}
      {isLoading && <p role="status" className="text-sm text-slate-500">Loading report data…</p>}
      {!isLoading && !error && reportStudents.length === 0 && <p className="text-sm text-slate-500">No student screenings are available for this report.</p>}

      {!error && reportStudents.length > 0 && (
        <div className="table-shell">
          <table>
            <thead><tr><th>Student ID</th><th>Name</th><th>School</th><th>District</th><th>Taluk</th><th>Screening date</th><th>Status</th><th>Skeletal deformity</th><th>Skin thickness (mm)</th><th>Mid-arm circumference (cm)</th></tr></thead>
            <tbody>
              {reportStudents.map((student) => (
                <tr key={student.id}>
                  <td>{student.siNumber ?? ''}</td><td>{student.studentName ?? ''}</td>
                  <td>{student.schoolName}</td><td>{student.districtName}</td><td>{student.talukName}</td>
                  <td>{student.screeningDate}</td><td>{student.status}</td>
                  <td>{student.skeletalDeformity ?? ''}</td><td>{student.skinThicknessMm ?? ''}</td><td>{student.midArmCircumferenceCm ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
