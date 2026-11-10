import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRemoteData } from '../hooks/useRemoteData';
import { getDistricts, getOrganizationName } from '../lib/dataService';
import { getRoleLabel } from '../lib/permissions';

export function ProfilePage() {
  const { user } = useAuth();
  const loadOrganization = useCallback(() => getOrganizationName(user?.organizationId ?? ''), [user?.organizationId]);
  const { data: organization, isLoading, error } = useRemoteData(loadOrganization);
  const { data: districts } = useRemoteData(getDistricts);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Profile</h2>
      <div className="card max-w-xl">
        <div className="space-y-3 text-sm text-slate-700">
          <div><span className="font-semibold">Name:</span> {user?.name}</div>
          <div><span className="font-semibold">Email:</span> {user?.email}</div>
          <div><span className="font-semibold">Role:</span> {user ? getRoleLabel(user.role) : 'Unavailable'}</div>
          <div><span className="font-semibold">Organization:</span> {isLoading ? 'Loading…' : organization ?? 'Unavailable'}</div>
          {error && <div role="alert" className="text-rose-700">Organization could not be loaded: {error}</div>}
          <div><span className="font-semibold">District:</span> {districts?.find((district) => district.id === user?.districtId)?.name ?? (user?.districtId ? 'Assigned district' : 'Organization-wide')}</div>
        </div>
      </div>
    </div>
  );
}
