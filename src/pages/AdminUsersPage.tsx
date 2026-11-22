import { Link } from 'react-router-dom';
import { AccountActivationManagement } from '../components/AccountActivationManagement';
import { InvitationManagement } from '../components/InvitationManagement';
import { ViewerAccessManagement } from '../components/ViewerAccessManagement';

export function AdminUsersPage() {
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-2xl font-bold">Staff and access</h2><p className="mt-1 text-sm text-slate-600">Invite organization staff and manage their profile access.</p></div>
      <Link to="/dashboard" className="text-sm font-semibold text-cyan-700 hover:underline">Back to overview</Link>
    </div>
    <InvitationManagement />
    <ViewerAccessManagement />
    <AccountActivationManagement />
  </div>;
}
