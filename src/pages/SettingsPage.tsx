import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { InvitationManagement } from '../components/InvitationManagement';
import { AccountActivationManagement } from '../components/AccountActivationManagement';

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Admin Portal</h2>
      {user?.role === 'organization_admin' && <InvitationManagement />}
      {user?.role === 'organization_admin' && <AccountActivationManagement />}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="font-semibold text-slate-900">Backend connection</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div>Provider: Supabase</div>
            <div>Client configuration: {isSupabaseConfigured ? 'Configured' : 'Missing project URL or anon key'}</div>
            <div>Organization ID: {user?.organizationId}</div>
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-900">Security</h3>
          <p className="mt-4 text-sm text-slate-600">
            Data access is enforced by Supabase Row Level Security policies in the applied database migrations.
            Authentication and account provisioning must be managed through your Supabase project.
          </p>
        </div>
      </div>
    </div>
  );
}
