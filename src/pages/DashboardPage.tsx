import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppWindow, Filter, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { getDashboardSummary, getDistricts, getScreeningSessions, getStudentRecords } from '../lib/dataService';
import { formatNumber } from '../lib/utils';
import { useRemoteData } from '../hooks/useRemoteData';

export function DashboardPage() {
  const navigate = useNavigate();
  const loadDashboard = useCallback(async () => {
    const [summary, districts, sessions, students] = await Promise.all([
      getDashboardSummary(),
      getDistricts(),
      getScreeningSessions(),
      getStudentRecords(),
    ]);

    return { summary, districts, sessions, students };
  }, []);
  const { data, isLoading, error, reload } = useRemoteData(loadDashboard);

  if (isLoading) {
    return <p role="status" className="py-8 text-center text-sm text-slate-500">Loading organization data…</p>;
  }

  if (error || !data) {
    return (
      <div role="alert" className="space-y-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
        <p>Dashboard data could not be loaded: {error ?? 'No data returned.'}</p>
        <button onClick={reload} className="rounded-lg border border-rose-300 px-3 py-1.5 font-medium hover:bg-rose-100">Retry</button>
      </div>
    );
  }

  const summaryCards = [
    { label: 'Students screened', value: data.summary.studentCount, icon: Users },
    { label: 'Sessions', value: data.summary.sessionCount, icon: AppWindow },
    { label: 'Enumerators', value: data.summary.enumeratorCount, icon: ShieldCheck },
    { label: 'Districts', value: data.summary.districtCount, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-cyan-50 p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ready to screen students?</h2>
          <p className="mt-1 text-sm text-slate-600">Open a session you manage or have been assigned to and start entering screenings.</p>
        </div>
        <button onClick={() => navigate('/screening-sessions')} className="min-h-11 rounded-xl bg-cyan-600 px-5 py-2.5 font-semibold text-white hover:bg-cyan-500">Start a survey</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
                <div className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(value)}</div>
              </div>
              <div className="rounded-xl bg-cyan-100 p-3 text-cyan-700"><Icon size={18} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">District coverage</h3>
            <Filter className="text-slate-400" size={18} />
          </div>
          {data.districts.length === 0 ? <p className="text-sm text-slate-500">No districts have been added.</p> : (
            <div className="space-y-3">
              {data.districts.map((district) => (
                <div key={district.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="font-medium text-slate-700">{district.name}</span>
                  <span className={`badge ${district.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{district.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Recent screening activity</h3>
          {data.sessions.length === 0 ? <p className="text-sm text-slate-500">No screening sessions have been created.</p> : (
            <div className="space-y-3">
              {data.sessions.slice(0, 5).map((session) => (
                <div key={session.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div>
                    <div className="font-medium text-slate-800">{session.name}</div>
                    <div className="text-sm text-slate-500">{session.date}</div>
                  </div>
                  <span className="badge bg-cyan-100 text-cyan-700">{session.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Recent student screenings</h3>
        {data.students.length === 0 ? <p className="text-sm text-slate-500">No students have been screened.</p> : (
          <div className="table-shell">
            <table>
              <thead><tr><th>SI Number</th><th>Name</th><th>Class</th><th>School</th><th>Status</th></tr></thead>
              <tbody>
                {data.students.slice(0, 10).map((student) => (
                  <tr key={student.id}>
                    <td>{student.siNumber}</td>
                    <td>{student.studentName}</td>
                    <td>{student.className}</td>
                    <td>{student.schoolName}</td>
                    <td><span className={`badge ${student.status === 'Complete' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{student.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
