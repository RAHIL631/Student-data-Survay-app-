import { Plus, Search, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getScreeningSessions, getStudentRecords } from '../lib/dataService';
import { useRemoteData } from '../hooks/useRemoteData';

export function StudentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [search, setSearch] = useState('');
  const { data: students, isLoading, error, reload } = useRemoteData(getStudentRecords);
  const { data: sessions, error: sessionsError, reload: reloadSessions } = useRemoteData(getScreeningSessions);
  const activeSession = sessions?.find((session) => session.id === sessionId && session.status === 'active');
  const query = search.trim().toLowerCase();
  const filteredStudents = (students ?? [])
    .filter((student) => !sessionId || student.sessionId === sessionId)
    .filter((student) => `${student.studentName} ${student.siNumber}`.toLowerCase().includes(query));

  return (
    <div className="space-y-6">
      <header className="page-heading">
        <div>
          <p className="page-heading__eyebrow">Records</p>
          <h2 className="text-2xl font-bold text-slate-900">Students</h2>
          <p className="mt-1 text-sm text-slate-600">Find student screenings saved to your account.</p>
        </div>
        <button onClick={() => navigate(activeSession ? `/student-registration?sessionId=${encodeURIComponent(activeSession.id)}` : '/screening-sessions')} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 font-semibold text-white transition hover:bg-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">
          <Plus size={17} aria-hidden="true" />
          {activeSession ? 'Add student' : 'Start screening'}
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Student records could not be loaded: {error} <button onClick={reload} className="ml-2 underline">Retry</button></div>}
      {sessionsError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Screening sessions could not be checked: {sessionsError} <button onClick={reloadSessions} className="ml-2 underline">Retry</button></div>}
      {isLoading ? <p role="status" className="text-sm text-slate-500">Loading student screenings…</p> : null}

      {!error && !isLoading && (
        <section aria-label="Student screening records" className="card space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="student-record-search" className="relative block w-full max-w-lg">
              <span className="sr-only">Search by student name or SI number</span>
              <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="student-record-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or SI number"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10"
              />
              {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear student search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-200">
                <X size={16} aria-hidden="true" />
              </button>}
            </label>
            <p aria-live="polite" className="text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-800">{filteredStudents.length}</span> of {students?.length ?? 0} records
            </p>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <UserRound size={24} className="mx-auto text-slate-400" aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-slate-800">{query ? 'No matching students' : 'No student screenings yet'}</h3>
              <p className="mt-1 text-sm text-slate-500">{query ? 'Try another name or SI number.' : sessionId ? 'No students have been screened in this session yet.' : 'Student screenings will appear here after they are saved.'}</p>
              {query && <button type="button" onClick={() => setSearch('')} className="mt-3 min-h-10 rounded-lg px-3 font-semibold text-cyan-800 hover:bg-cyan-50">Clear search</button>}
            </div>
          ) : (
            <>
              <div className="table-shell hidden md:block">
                <table>
                  <thead><tr><th>SI Number</th><th>Name</th><th>Class</th><th>Sex</th><th>Status</th><th>Age</th></tr></thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td>{student.siNumber}</td>
                        <td>{student.studentName}</td>
                        <td>{student.className}</td>
                        <td>{student.sex}</td>
                        <td><span className="badge bg-cyan-100 text-cyan-800">{student.status}</span></td>
                        <td>{student.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 md:hidden">
                {filteredStudents.map((student) => (
                  <li key={student.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="rounded-xl bg-cyan-50 p-2 text-cyan-800"><UserRound size={18} aria-hidden="true" /></div>
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold text-slate-900">{student.studentName}</h3>
                          <p className="mt-0.5 text-xs text-slate-500">SI No. {student.siNumber}</p>
                        </div>
                      </div>
                      <span className="badge shrink-0 bg-cyan-50 text-cyan-800">{student.status}</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                      <div><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Class</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{student.className}</dd></div>
                      <div><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Sex</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{student.sex}</dd></div>
                      <div><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Age</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{student.age}</dd></div>
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
