import { Building2, ClipboardList, LayoutDashboard, LogOut, MapPinned, School, Settings, ShieldCheck, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './context/AuthContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { DistrictsTaluksPage } from './pages/DistrictsTaluksPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { SchoolsPage } from './pages/SchoolsPage';
import { ScreeningSessionsPage } from './pages/ScreeningSessionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { StudentRegistrationPage } from './pages/StudentRegistrationPage';
import { StudentsPage } from './pages/StudentsPage';

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/users', label: 'Staff & access', icon: Users },
  { to: '/districts', label: 'Districts & taluks', icon: MapPinned },
  { to: '/schools', label: 'Schools', icon: School },
  { to: '/screening-sessions', label: 'Screening sessions', icon: ClipboardList },
  { to: '/assignments', label: 'Assignments', icon: Building2 },
  { to: '/students', label: 'Student screenings', icon: Users },
  { to: '/reports', label: 'Reports', icon: ClipboardList },
  { to: '/audit-logs', label: 'Audit history', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Unable to sign out of the admin portal.', error);
      setLogoutError(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  };

  return (
    <div className="min-h-screen min-h-dvh bg-slate-100 text-slate-900">
      {sidebarVisible && <button type="button" aria-label="Close admin navigation" onClick={() => setSidebarVisible(false)} className="fixed inset-0 z-20 bg-slate-950/50 md:hidden" />}
      <aside className={`${sidebarVisible ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-30 w-72 max-w-[85vw] flex-col bg-slate-950 text-white md:flex md:w-60 xl:w-72`}>
        <div className="flex items-center gap-3 border-b border-slate-800 p-5">
          <div className="rounded-xl bg-cyan-500/20 p-2 text-cyan-300"><ShieldCheck size={20} /></div>
          <div><p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Student Health</p><p className="text-lg font-bold">Admin portal</p></div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setSidebarVisible(false)} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-300 hover:bg-slate-800'}`}>
              <Icon size={17} /><span>{label}</span>
            </NavLink>
          ))}
          <Link to="/profile" onClick={() => setSidebarVisible(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"><Users size={17} />My profile</Link>
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="truncate text-sm font-semibold">{user?.name}</div>
          <div className="truncate text-xs text-slate-400">{user?.email}</div>
          <button onClick={() => void handleLogout()} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"><LogOut size={16} />Sign out</button>
          {logoutError && <p role="alert" className="mt-2 text-xs text-rose-300">{logoutError}</p>}
        </div>
      </aside>
      <main className="min-h-screen min-w-0 p-3 sm:p-4 md:ml-60 md:p-6 xl:ml-72 xl:p-8">
        <div className="min-h-[calc(100dvh-1.5rem)] min-w-0 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-5 md:min-h-[calc(100dvh-3rem)] md:p-6">
          <header className="mb-5 flex items-center justify-between gap-3 border-b border-slate-200 pb-4 sm:mb-6">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setSidebarVisible(true)} aria-label="Open admin navigation" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"><span className="text-lg">☰</span></button>
              <div className="min-w-0"><p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 sm:block">Organization management</p><h1 className="truncate text-lg font-bold sm:mt-1 sm:text-2xl">Administrator workspace</h1></div>
            </div>
            <div className="max-w-[40%] truncate rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">Organization admin</div>
          </header>
          {import.meta.env.DEV && sessionStorage.getItem('student-health-hub.local-test-session') === 'organization_admin' && <div role="status" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><strong>Local test mode:</strong> synthetic records only; invitations and data are not connected to Supabase.</div>}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center" role="status">Loading administrator workspace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'organization_admin') {
    const handleSignOut = async () => {
      setIsSigningOut(true);
      setError('');
      try {
        await logout();
        navigate('/login', { replace: true });
      } catch (signOutError) {
        console.error('Unable to end the non-admin session.', signOutError);
        setError(signOutError instanceof Error ? signOutError.message : 'Unable to sign out.');
      } finally {
        setIsSigningOut(false);
      }
    };
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4"><div className="card max-w-lg text-center"><h1 className="text-xl font-bold">Administrator access required</h1><p className="mt-3 text-sm text-slate-600">This account is not an organization administrator. Sign out and use the staff application instead.</p>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}<button disabled={isSigningOut} onClick={() => void handleSignOut()} className="mt-5 min-h-11 rounded-xl bg-cyan-700 px-5 py-2 font-semibold text-white disabled:opacity-50">{isSigningOut ? 'Signing out…' : 'Sign out'}</button></div></div>;
  }
  return children;
}

function AdminRoutes() {
  const { user } = useAuth();
  return <Routes>
      <Route path="/login" element={user?.role === 'organization_admin' ? <Navigate to="/dashboard" replace /> : <LoginPage adminOnly />} />
      <Route element={<AdminGuard><AdminLayout /></AdminGuard>}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<AdminDashboardPage />} />
      <Route path="/users" element={<AdminUsersPage />} />
      <Route path="/districts" element={<DistrictsTaluksPage />} />
      <Route path="/schools" element={<SchoolsPage />} />
      <Route path="/screening-sessions" element={<ScreeningSessionsPage />} />
      <Route path="/student-registration" element={<StudentRegistrationPage />} />
      <Route path="/assignments" element={<AssignmentsPage />} />
      <Route path="/students" element={<StudentsPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/audit-logs" element={<AuditLogsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>;
}

export default function AdminApp() {
  return <AuthProvider><AdminRoutes /></AuthProvider>;
}
