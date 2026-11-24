import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRemoteData } from '../hooks/useRemoteData';
import { getAssignments } from '../lib/dataService';

export function AssignmentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: assignments, isLoading, error, reload } = useRemoteData(getAssignments);
  const canManage = user?.role === 'organization_admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold text-slate-900">Assignments</h2>{canManage && <button type="button" onClick={() => navigate('/schools')} className="rounded-xl bg-cyan-700 px-4 py-2.5 font-semibold text-white hover:bg-cyan-800">Manage school faculty</button>}</div>
      <p className="rounded-xl bg-cyan-50 p-4 text-sm text-cyan-950">Each screening session belongs to the active Screening Faculty assigned to its school. To change a session’s faculty, update the school assignment; the database applies the same rule when a session is created.</p>
      {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Assignments could not be loaded: {error} <button onClick={reload} className="ml-2 underline">Retry</button></div>}
      {isLoading && <p role="status" className="text-sm text-slate-500">Loading assignments…</p>}
      {!isLoading && !error && assignments?.length === 0 && <p className="text-sm text-slate-500">No screening sessions are available. Create a session after assigning an active Screening Faculty account to a school.</p>}
      {!error && (assignments?.length ?? 0) > 0 && (
        <div className="table-shell">
          <table>
            <thead><tr><th>Session</th><th>Assigned enumerators</th><th>Status</th></tr></thead>
            <tbody>
              {(assignments ?? []).map(({ session, enumerators }) => (
                <tr key={session.id}>
                  <td>{session.name}</td>
                  <td>{enumerators.map((enumerator) => enumerator.name).join(', ') || 'No Screening Faculty assigned'}</td>
                  <td><span className="badge bg-emerald-100 text-emerald-700">{session.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
