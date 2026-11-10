import { ArrowRight, LockKeyhole, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { isLocalTestLoginEnabled } from '../lib/localTestMode';
import type { Role } from '../types';

export function LoginPage({ adminOnly = false }: { adminOnly?: boolean }) {
  const navigate = useNavigate();
  const { login, loginAsLocalTestUser, logout, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isStartingLocalSession, setIsStartingLocalSession] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      const signedInUser = await login(email, password);
      if (adminOnly && signedInUser.role !== 'organization_admin') {
        await logout();
        setError('This sign-in is for organization administrators. Use the staff app for district supervisors and enumerators.');
        return;
      }
      navigate('/dashboard');
    } catch (loginError) {
      console.error('Unable to sign in.', loginError);
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in. Try again.');
    }
  };

  const handleLocalTestLogin = async (role: Role) => {
    setError('');
    setIsStartingLocalSession(true);
    try {
      if (adminOnly && role !== 'organization_admin') {
        throw new Error('Only the local administrator test account can use this portal.');
      }
      await loginAsLocalTestUser(role);
      navigate('/dashboard');
    } catch (loginError) {
      console.error('Unable to start local test session.', loginError);
      setError(loginError instanceof Error ? loginError.message : 'Unable to start local test session.');
    } finally {
      setIsStartingLocalSession(false);
    }
  };

  return (
    <main className="relative flex min-h-screen min-h-dvh items-center justify-center overflow-hidden bg-[#f1f6f7] p-3 sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-200/50 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[1.75rem] border border-white bg-white shadow-[0_30px_90px_-35px_rgba(15,23,42,0.3)] lg:min-h-[680px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative isolate flex min-h-64 flex-col justify-between overflow-hidden bg-slate-950 p-5 text-white sm:min-h-80 sm:p-8 lg:min-h-[680px] lg:p-10">
            <img
              src="/school-students.jpg"
              alt="Students reading at a government primary school in Goa"
              className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_45%]"
            />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/45 via-slate-950/15 to-slate-950/90" />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/35 via-transparent to-transparent" />
            <div className="relative flex items-center gap-3">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-2.5 text-cyan-200 shadow-lg backdrop-blur-sm"><ShieldCheck size={21} /></div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100">Karnataka school health</p>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Student Health Hub</h1>
              </div>
            </div>
            <div className="relative mt-10 max-w-lg sm:mt-14 lg:mt-auto lg:pb-3">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                {adminOnly ? 'Administrator workspace' : 'A healthier future starts at school'}
              </div>
              <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {adminOnly ? 'Support the people behind every screening.' : 'Care that reaches every student.'}
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-slate-100 sm:text-base">
                {adminOnly ? 'Coordinate districts, schools, and field teams from one secure workspace.' : 'A secure workspace for school health screenings and the teams who deliver them.'}
              </p>
            </div>
            <a
              href="https://commons.wikimedia.org/wiki/File:Government_Primary_School,Kharwada_Amona_Bicholim_Goa.jpg"
              target="_blank"
              rel="noreferrer"
              className="relative mt-6 w-fit text-[10px] text-white/75 underline decoration-white/40 underline-offset-2 hover:text-white"
            >
              Government school students · Saili Chodankar / Wikimedia Commons · CC BY-SA 4.0
            </a>
        </section>

        <section className="flex items-center justify-center px-5 py-8 sm:px-10 sm:py-10 lg:px-14">
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5 sm:space-y-6">
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">{adminOnly ? 'Administrator portal' : 'Staff portal'}</p>
                <h3 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Welcome back</h3>
                <p className="mt-2 text-sm text-slate-500">Sign in to continue to your workspace.</p>
              </div>

              {!isSupabaseConfigured && (
                <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Sign-in is unavailable until the backend is configured.
                </div>
              )}
              {authError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{authError}</div>}

              <div>
                <label htmlFor="login-email" className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
                <div className="relative">
                  <Mail aria-hidden="true" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@organization.org" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-100" />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <LockKeyhole aria-hidden="true" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-100" />
                </div>
              </div>

              {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

              <button type="submit" disabled={!isSupabaseConfigured} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 font-semibold text-white shadow-lg shadow-cyan-900/10 transition hover:bg-cyan-800 focus:outline-none focus:ring-4 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">
                <LogIn size={18} />
                Sign in
                <ArrowRight size={16} className="ml-auto opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </button>

            {isLocalTestLoginEnabled && (
              <details className="group rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 marker:hidden">
                  Developer preview <span className="ml-1 text-xs font-normal text-slate-500">· local test accounts</span>
                </summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {([
                      ['organization_admin', 'Local admin'],
                      ['district_manager', 'Local supervisor'],
                      ['enumerator', 'Local enumerator'],
                    ] as const).filter(([role]) => !adminOnly || role === 'organization_admin').map(([role, label]) => (
                      <button key={role} type="button" onClick={() => void handleLocalTestLogin(role)} disabled={isStartingLocalSession} className="flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 disabled:opacity-50">
                        {isStartingLocalSession ? 'Starting…' : label}
                      </button>
                    ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">Preview data stays in this browser and does not sync.</p>
              </details>
            )}
            {!adminOnly && <a href={import.meta.env.VITE_ADMIN_APP_URL || '/admin/'} className="block text-center text-sm font-medium text-cyan-800 underline-offset-4 hover:underline">Administrator? Open the admin portal</a>}
            <p className="pt-1 text-center text-xs text-slate-400">Authorized staff only · Student Health Hub</p>
          </form>
        </section>
      </div>
    </main>
  );
}
