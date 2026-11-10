import { ChevronRight, Menu, ShieldCheck, UserCircle2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessRoute, getRoleLabel } from '../lib/permissions';
import { isLocalTestSessionActive } from '../lib/localTestMode';
import type { RouteKey } from '../types';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/screening-sessions', label: 'Screening Sessions' },
  { to: '/student-registration', label: 'Student Registration' },
  { to: '/students', label: 'Students' },
  { to: '/schools', label: 'Schools' },
  { to: '/districts', label: 'Districts & Taluks' },
  { to: '/enumerators', label: 'Enumerators' },
  { to: '/assignments', label: 'Assignments' },
  { to: '/reports', label: 'Reports' },
  { to: '/audit-logs', label: 'Audit Logs' },
  { to: '/settings', label: 'Settings' },
  { to: '/profile', label: 'Profile' },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarVisible, setSidebarVisible] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const [logoutError, setLogoutError] = useState('');
  const isLocalTest = isLocalTestSessionActive();

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const updateSidebar = () => setSidebarVisible(desktop.matches);
    desktop.addEventListener('change', updateSidebar);
    return () => desktop.removeEventListener('change', updateSidebar);
  }, []);

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await logout();
    } catch (error) {
      console.error('Unable to sign out.', error);
      setLogoutError(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {sidebarVisible && <button
        type="button"
        aria-label="Close navigation menu"
        onClick={() => setSidebarVisible(false)}
        className="fixed inset-0 z-20 bg-slate-950/50 md:hidden"
      />}
      {sidebarVisible && (
      <aside id="app-navigation" className="fixed inset-y-0 left-0 z-30 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-slate-950 text-slate-100 md:w-60 xl:w-72">
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4 md:px-6 md:py-5">
          <div className="rounded-xl bg-cyan-500/20 p-2 text-cyan-300"><ShieldCheck size={18} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold tracking-[0.2em] text-cyan-300 uppercase">Student Health</div>
            <div className="text-lg font-bold">Hub</div>
          </div>
          <button type="button" onClick={() => setSidebarVisible(false)} aria-label="Close navigation" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white md:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.filter((item) => user && canAccessRoute(user.role, item.to.slice(1) as RouteKey)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-300 hover:bg-slate-800'
                }`
              }
              onClick={() => {
                if (!window.matchMedia('(min-width: 768px)').matches) setSidebarVisible(false);
              }}
            >
              <span>{item.label}</span>
              <ChevronRight size={14} className="opacity-80" />
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-200">
              <UserCircle2 size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{user?.name ?? 'User'}</div>
              <div className="truncate text-xs text-slate-300">{user ? getRoleLabel(user.role) : 'User'}</div>
            </div>
          </div>
          <button onClick={() => void handleLogout()} className="mt-3 w-full rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600">
            Logout
          </button>
          {logoutError && <p role="alert" className="mt-2 text-xs text-rose-300">{logoutError}</p>}
        </div>
      </aside>
      )}

      <main className={`min-h-screen min-w-0 p-3 transition-[margin] duration-200 sm:p-4 md:p-6 xl:p-8 ${sidebarVisible ? 'md:ml-60 xl:ml-72' : ''}`}>
        <div className="min-w-0 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-5 md:p-6">
          <div className="mb-5 flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 pb-4 sm:mb-6 sm:gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarVisible((visible) => !visible)}
                aria-label={sidebarVisible ? 'Hide navigation sidebar' : 'Show navigation sidebar'}
                aria-expanded={sidebarVisible}
                aria-controls="app-navigation"
                className="shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600"
              >
                <Menu size={22} />
              </button>
              <div className="min-w-0">
              <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 sm:block">Operations overview</p>
              <h1 className="truncate text-lg font-bold text-slate-900 sm:mt-1 sm:text-2xl">Student Health Hub</h1>
              </div>
            </div>
            <div className="max-w-[42%] truncate rounded-full bg-emerald-100 px-2 py-1 text-right text-[10px] font-semibold text-emerald-700 sm:px-3 sm:text-xs">
              {user ? getRoleLabel(user.role) : 'Authenticated'}
            </div>
          </div>

          {isLocalTest && <div role="status" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>Local test mode:</strong> this is not authenticated by Supabase. Screening records are stored only in this browser and will not sync to your organization.
          </div>}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
