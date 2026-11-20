import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getStudentRecords } from '../lib/dataService';
import { useRemoteData } from '../hooks/useRemoteData';

export function StudentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [search, setSearch] = useState('');
  const { data: students, isLoading, error, reload } = useRemoteData(getStudentRecords);
  const query = search.trim().toLowerCase();
  const filteredStudents = (students ?? [])
    .filter((student) => !sessionId || student.sessionId === sessionId)
    .filter((student) => `${student.studentName ?? ''} ${student.siNumber ?? ''}`.toLowerCase().includes(query));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900">Students</h2>
          <button onClick={() => navigate(sessionId ? `/student-registration?sessionId=${encodeURIComponent(sessionId)}` : '/screening-sessions')} className="rounded-xl bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500">{sessionId ? 'Add student' : 'Start screening'}</button>
        </div>
        <input
          aria-label="Search student or SI number"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search student or SI number"
          className="w-full max-w-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
        />
      </div>

      {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Student records could not be loaded: {error} <button onClick={reload} className="ml-2 underline">Retry</button></div>}
      {isLoading ? <p role="status" className="text-sm text-slate-500">Loading student screenings…</p> : null}
      {!isLoading && !error && filteredStudents.length === 0 && <p className="text-sm text-slate-500">{query ? 'No students match this search.' : sessionId ? 'No students have been screened in this session yet.' : 'No student screenings have been recorded.'}</p>}

      {!error && filteredStudents.length > 0 && (
        <div className="table-shell">
          <table>
            <thead><tr><th>SI Number</th><th>Name</th><th>Class</th><th>Sex</th><th>Status</th><th>Age</th><th>School</th><th>Action</th></tr></thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>{student.siNumber ?? '—'}</td>
                  <td>{student.studentName ?? '—'}</td>
                  <td>{student.className ?? '—'}</td>
                  <td>{student.sex ?? '—'}</td>
                  <td><span className={`badge ${student.status === 'Complete' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{student.status}</span></td>
                  <td>{student.age ?? '—'}</td>
                  <td>{student.schoolName}</td>
                  <td><button onClick={() => navigate(`/students/${encodeURIComponent(student.id)}`)} className="font-medium text-cyan-700 hover:underline">View details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
