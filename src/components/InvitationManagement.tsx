import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRemoteData } from '../hooks/useRemoteData';
import {
  cancelUserInvitation,
  createUserInvitation,
  getDistricts,
  getUserInvitations,
} from '../lib/dataService';
import type { InvitationRole } from '../types';

function describeInvitation(status: string, authStatus: string): string {
  if (status === 'cancelled') return 'Cancelled — acceptance is blocked, though an already-sent Auth link may still open.';
  if (status === 'accepted') return 'Accepted and profile provisioned.';
  if (status === 'failed') return 'Auth rejected the request; no profile was provisioned.';
  if (status === 'expired') return 'Expired by an authorized process.';
  if (authStatus === 'accepted_by_auth') return 'Auth accepted the invite request; email delivery is not verified.';
  if (authStatus === 'unknown' || authStatus === 'in_flight') return 'Auth outcome is uncertain; do not retry. Contact an authorized operator.';
  if (authStatus === 'rejected_by_auth') return 'Auth rejected the request.';
  return 'Invitation request has not been confirmed by Auth.';
}

export function InvitationManagement() {
  const { user } = useAuth();
  const { data: districts, isLoading: districtsLoading, error: districtsError } = useRemoteData(getDistricts);
  const { data: invitations, isLoading, error, reload } = useRemoteData(getUserInvitations);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('enumerator');
  const [districtId, setDistrictId] = useState(user?.districtId ?? '');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const isOrganizationAdmin = user?.role === 'organization_admin';
  const canInvite = isOrganizationAdmin;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !canInvite) return;

    const assignedDistrictId = isOrganizationAdmin ? districtId : user.districtId;
    if (!assignedDistrictId) {
      setSaveError('Select a district before creating an invitation.');
      return;
    }

    setSaving(true);
    setMessage('');
    setSaveError('');
    try {
      const result = await createUserInvitation({
        email: email.trim().toLowerCase(),
        role,
        districtId: assignedDistrictId,
        idempotencyKey,
      });
      if (result.status === 'auth_request_accepted') {
        setMessage('Supabase Auth accepted the invitation request. Email delivery is not verified; check the invitation history for acceptance status.');
        setEmail('');
        setIdempotencyKey(crypto.randomUUID());
      } else if (result.status === 'already_processing') {
        setMessage('This idempotent request was already claimed. Check invitation history; no resend was attempted.');
        setIdempotencyKey(crypto.randomUUID());
      } else {
        setMessage('The Auth outcome is uncertain. Do not retry; check invitation history and contact an authorized operator.');
      }
      reload();
    } catch (requestError) {
      console.error('Unable to complete invitation request.', requestError);
      setSaveError(requestError instanceof Error ? requestError.message : 'The invitation request could not be completed.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (invitationId: string) => {
    const confirmed = window.confirm(
      'Cancel this invitation? A previously sent Auth link may remain valid, but the application will reject acceptance and will not provision a profile.',
    );
    if (!confirmed) return;

    setCancellingId(invitationId);
    setSaveError('');
    setMessage('');
    try {
      await cancelUserInvitation(invitationId);
      setMessage('Invitation cancelled. Any later acceptance attempt will be rejected.');
      reload();
    } catch (cancelError) {
      console.error('Unable to cancel invitation.', cancelError);
      setSaveError(cancelError instanceof Error ? cancelError.message : 'The invitation could not be cancelled.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <section className="card space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">User invitations</h3>
        <p className="mt-1 text-sm text-slate-600">
          Resending is not available. Auth acceptance and inbox delivery are tracked separately.
        </p>
      </div>

      {canInvite && (
        <form onSubmit={(event) => void submit(event)} className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
          <label className="text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              required
              maxLength={320}
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setIdempotencyKey(crypto.randomUUID());
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Role
            <select
              value={role}
              onChange={(event) => {
                const nextRole = event.target.value;
                if (nextRole === 'district_manager' || nextRole === 'enumerator') {
                  setRole(nextRole);
                  setIdempotencyKey(crypto.randomUUID());
                }
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
            >
              {isOrganizationAdmin && <option value="district_manager">Viewer</option>}
              <option value="enumerator">Screening faculty</option>
            </select>
          </label>
          {isOrganizationAdmin ? (
            <label className="text-sm font-medium text-slate-700">
              District
              <select
                required
                value={districtId}
                onChange={(event) => {
                  setDistrictId(event.target.value);
                  setIdempotencyKey(crypto.randomUUID());
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <option value="">Select district</option>
                {(districts ?? []).map((district) => (
                  <option key={district.id} value={district.id}>{district.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="text-sm font-medium text-slate-700">
              District
              <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                {districts?.find((district) => district.id === user?.districtId)?.name ?? 'Your assigned district'}
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={saving || districtsLoading || (isOrganizationAdmin && !(districts?.length ?? 0))}
            className="self-end rounded-xl bg-cyan-600 px-4 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Sending…' : 'Invite'}
          </button>
          {districtsError && <p role="alert" className="text-sm text-rose-700 md:col-span-4">Districts could not be loaded: {districtsError}</p>}
        </form>
      )}

      {message && <p role="status" className="rounded-xl bg-cyan-50 p-3 text-sm text-cyan-950">{message}</p>}
      {saveError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{saveError}</p>}
      {error && (
        <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          Invitation history could not be loaded: {error}
          <button type="button" onClick={reload} className="ml-2 underline">Retry</button>
        </div>
      )}
      {isLoading && <p role="status" className="text-sm text-slate-500">Loading invitation history…</p>}
      {!isLoading && !error && !invitations?.length && <p className="text-sm text-slate-500">No invitations are available in your authorized scope.</p>}

      {!!invitations?.length && (
        <div className="table-shell">
          <table>
            <thead>
              <tr><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Action</th></tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => {
                const canCancel = invitation.status === 'provisioning'
                  || invitation.status === 'pending';
                const roleAllowed = isOrganizationAdmin;
                return (
                  <tr key={invitation.id}>
                    <td>{invitation.email}</td>
                    <td>{invitation.role === 'district_manager' ? 'Viewer' : 'Screening faculty'}</td>
                    <td>{describeInvitation(invitation.status, invitation.auth_status)}</td>
                    <td>{new Date(invitation.created_at).toLocaleString()}</td>
                    <td>
                      {canCancel && roleAllowed && (
                        <button
                          type="button"
                          disabled={cancellingId === invitation.id}
                          onClick={() => void cancel(invitation.id)}
                          className="font-medium text-rose-700 underline disabled:opacity-50"
                        >
                          {cancellingId === invitation.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
