import { AlertCircle, Database, KeyRound, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <header className="page-heading">
        <div>
          <p className="page-heading__eyebrow">Workspace</p>
          <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
          <p className="mt-1 text-sm text-slate-600">Review the connection and security status for this workspace.</p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="connection-heading" className="card">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-800"><Database size={20} aria-hidden="true" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="connection-heading" className="font-bold text-slate-900">Backend connection</h3>
                <span className={`badge ${isSupabaseConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                  {isSupabaseConfigured ? 'Configured' : 'Setup required'}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-600">This application uses Supabase for authentication and organization data.</p>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 px-3">
            <div className="flex items-start justify-between gap-4 py-3 text-sm">
              <dt className="text-slate-500">Provider</dt>
              <dd className="font-medium text-slate-800">Supabase</dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-3 text-sm">
              <dt className="text-slate-500">Client configuration</dt>
              <dd className="max-w-[65%] break-all text-right font-medium text-slate-800">
                {isSupabaseConfigured ? 'Project URL and public key detected' : 'Project URL or public key missing'}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-3 text-sm">
              <dt className="text-slate-500">Organization</dt>
              <dd className="max-w-[65%] break-all text-right font-medium text-slate-800">{user?.organizationId || 'Not assigned'}</dd>
            </div>
          </dl>
          {!isSupabaseConfigured && <div role="status" className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-950">
            <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>Connect the project to Supabase before using real accounts or storing production records.</p>
          </div>}
        </section>

        <section aria-labelledby="security-heading" className="card">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-800"><ShieldCheck size={20} aria-hidden="true" /></div>
            <div>
              <h3 id="security-heading" className="font-bold text-slate-900">Security & account</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">Keep sign-in details private and review how access is configured.</p>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex gap-3">
              <KeyRound size={18} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Password and profile</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">Review your account details or update your password from Profile.</p>
                <Link to="/profile" className="mt-3 inline-flex min-h-10 items-center rounded-lg font-semibold text-cyan-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700">Open profile</Link>
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Row-level access policies are maintained in the Supabase migrations. Verify that migrations are applied to the connected project before using real student data.
          </p>
        </section>
      </div>
    </div>
  );
}
