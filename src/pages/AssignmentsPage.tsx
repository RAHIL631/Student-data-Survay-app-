import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAssignments } from '../lib/dataService';
import { useRemoteData } from '../hooks/useRemoteData';
import { assignEnumerator, getEnumerators, getScreeningSessions, unassignEnumerator } from '../lib/dataService';
import { useRemoteData as useRemoteResource } from '../hooks/useRemoteData';

export function AssignmentsPage() {
  const { user } = useAuth();
  const { data: assignments, isLoading, error, reload } = useRemoteData(getAssignments);
  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
    reload: reloadSessions,
  } = useRemoteResource(getScreeningSessions);
  const {
    data: enumerators,
    isLoading: enumeratorsLoading,
    error: enumeratorsError,
    reload: reloadEnumerators,
  } = useRemoteResource(getEnumerators);
  const [form, setForm] = useState({ sessionId: '', enumeratorId: '' });
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const canManage = user?.role === 'organization_admin';
  const selectedSession = sessions?.find((session) => session.id === form.sessionId);
  const availableEnumerators = (enumerators ?? []).filter((enumerator) =>
    selectedSession && enumerator.districtId === selectedSession.districtId,
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError('');
    try {
      await assignEnumerator({ organizationId: user.organizationId, ...form });
      setForm({ sessionId: '', enumeratorId: '' });
      reload();
    } catch (error) {
      console.error('Unable to assign the enumerator to the screening session.', error);
      setSaveError(error instanceof Error ? error.message : 'Unable to save the assignment.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (sessionId: string, enumeratorId: string) => {
    if (!window.confirm('Remove this enumerator assignment? The database records assignment removal in the audit log.')) {
      return;
    }

    setRemoving(`${sessionId}:${enumeratorId}`);
    setSaveError('');
    try {
      await unassignEnumerator({ sessionId, enumeratorId });
      reload();
    } catch (error) {
      console.error('Unable to remove the enumerator assignment.', error);
      setSaveError(error instanceof Error ? error.message : 'Unable to remove the assignment.');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Assignments</h2>
      {(sessionsError || enumeratorsError) && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
        Assignment options could not be loaded: {sessionsError ?? enumeratorsError}
        <button type="button" onClick={() => { reloadSessions(); reloadEnumerators(); }} className="ml-2 underline">Retry</button>
      </div>}
      {canManage && <form onSubmit={(event) => void handleSubmit(event)} className="card grid gap-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm font-medium text-slate-700">Screening session
          <select required value={form.sessionId} onChange={(event) => setForm((current) => ({ ...current, sessionId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <option value="">Select session</option>{(sessions ?? []).filter((session) => session.status === 'active').map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Enumerator
          <select required value={form.enumeratorId} onChange={(event) => setForm((current) => ({ ...current, enumeratorId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <option value="">Select enumerator</option>{availableEnumerators.map((enumerator) => <option key={enumerator.id} value={enumerator.id}>{enumerator.name} · {enumerator.email}</option>)}
          </select>
        </label>
        <button disabled={saving || sessionsLoading || enumeratorsLoading || Boolean(sessionsError) || Boolean(enumeratorsError) || !availableEnumerators.length} className="self-end rounded-xl bg-cyan-600 px-4 py-2.5 font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Assign'}</button>
      </form>}
      {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Assignments could not be loaded: {error} <button onClick={reload} className="ml-2 underline">Retry</button></div>}
      {isLoading && <p role="status" className="text-sm text-slate-500">Loading assignments…</p>}
      {!isLoading && !error && assignments?.length === 0 && <p className="text-sm text-slate-500">No screening sessions or assignments are available.</p>}
      {!error && (assignments?.length ?? 0) > 0 && (
        <div className="table-shell">
          <table>
            <thead><tr><th>Session</th><th>Assigned enumerators</th><th>Status</th>{canManage && <th>Actions</th>}</tr></thead>
            <tbody>
              {(assignments ?? []).map(({ session, enumerators }) => (
                <tr key={session.id}>
                  <td>{session.name}</td>
                  <td>
                    {enumerators.map((enumerator) => enumerator.name).join(', ') || 'No enumerators assigned'}
                  </td>
                  <td><span className="badge bg-emerald-100 text-emerald-700">{session.status}</span></td>
                  {canManage && (
                    <td>
                      <ul className="space-y-1">
                        {enumerators.map((enumerator) => (
                          <li key={enumerator.id}>
                            <button
                              type="button"
                              disabled={removing === `${session.id}:${enumerator.id}`}
                              onClick={() => void handleUnassign(session.id, enumerator.id)}
                              className="text-sm font-medium text-rose-700 underline disabled:opacity-50"
                            >
                              {removing === `${session.id}:${enumerator.id}` ? 'Removing…' : `Remove ${enumerator.name}`}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {saveError && <p role="alert" className="text-sm text-rose-700">{saveError}</p>}
    </div>
  );
}
