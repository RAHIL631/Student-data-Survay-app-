import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  Home,
  MapPinned,
  Menu,
  MoreHorizontal,
  School,
  Settings,
  ShieldCheck,
  UserCircle2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessRoute, getRoleLabel } from '../lib/permissions';
import { isLocalTestSessionActive } from '../lib/localTestMode';
import type { Role, RouteKey } from '../types';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', shortLabel: 'Home', icon: Home },
  { to: '/screening-sessions', label: 'Screening Sessions', shortLabel: 'Sessions', icon: ClipboardList },
  { to: '/student-registration', label: 'Student Registration', shortLabel: 'Register', icon: UserPlus },
  { to: '/students', label: 'Students', shortLabel: 'Students', icon: Users },
  { to: '/schools', label: 'Schools', shortLabel: 'Schools', icon: School },
  { to: '/districts', label: 'Districts & Taluks', shortLabel: 'Locations', icon: MapPinned },
  { to: '/enumerators', label: 'Screening Faculty', shortLabel: 'Faculty', icon: Users },
  { to: '/assignments', label: 'Assignments', shortLabel: 'Assignments', icon: ClipboardList },
  { to: '/reports', label: 'Reports', shortLabel: 'Reports', icon: BarChart3 },
  { to: '/audit-logs', label: 'Audit Logs', shortLabel: 'Audit logs', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
  { to: '/profile', label: 'Profile', shortLabel: 'Profile', icon: UserCircle2 },
];

const mobilePrimaryRoutes: Record<Role, string[]> = {
  organization_admin: ['/dashboard', '/screening-sessions', '/students'],
  district_manager: ['/dashboard', '/students', '/reports', '/profile'],
  enumerator: ['/dashboard', '/screening-sessions', '/student-registration', '/students'],
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [sidebarVisible, setSidebarVisible] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const [moreVisible, setMoreVisible] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const isLocalTest = isLocalTestSessionActive();
  const permittedNavItems = navItems.filter((item) => user && canAccessRoute(user.role, item.to.slice(1) as RouteKey));
  const primaryNavItems = permittedNavItems.filter((item) => user && mobilePrimaryRoutes[user.role].includes(item.to));
  const moreNavItems = permittedNavItems.filter((item) => !primaryNavItems.some((primaryItem) => primaryItem.to === item.to));
  const mobileNavCount = primaryNavItems.length + (moreNavItems.length ? 1 : 0);

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

      <main className={`app-mobile-main min-h-dvh min-w-0 p-0 transition-[margin] duration-200 md:p-6 xl:p-8 ${sidebarVisible ? 'md:ml-60 xl:ml-72' : ''}`}>
        <div className="mx-auto min-h-dvh min-w-0 max-w-screen-2xl bg-white p-4 md:min-h-[calc(100dvh-3rem)] md:rounded-2xl md:p-6 md:shadow-sm md:ring-1 md:ring-slate-200">
          <header className="app-mobile-header -mx-4 -mt-4 mb-5 flex min-w-0 items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 pb-3 pt-2 backdrop-blur sm:mb-6 sm:px-5 md:static md:mx-0 md:mt-0 md:bg-transparent md:px-0 md:pt-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setMoreVisible(false);
                  setSidebarVisible((visible) => !visible);
                }}
                aria-label={sidebarVisible ? 'Hide navigation sidebar' : 'Show navigation menu'}
                aria-expanded={sidebarVisible}
                aria-controls="app-navigation"
                className="shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600"
              >
                {sidebarVisible ? <X size={21} /> : <Menu size={21} />}
              </button>
              <div className="min-w-0">
                <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 sm:block">Operations overview</p>
                <h1 className="truncate text-lg font-bold text-slate-900 sm:mt-1 sm:text-2xl">Student Health Hub</h1>
              </div>
            </div>
            <div className="max-w-[42%] truncate rounded-full bg-emerald-100 px-2 py-1 text-right text-[10px] font-semibold text-emerald-700 sm:px-3 sm:text-xs">
              {user ? getRoleLabel(user.role) : 'Authenticated'}
            </div>
          </header>

          {isLocalTest && <div role="status" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>Local test mode:</strong> this is not authenticated by Supabase. Screening records are stored only in this browser and will not sync to your organization.
          </div>}
          <Outlet />
        </div>
      </main>

      {moreVisible && <button
        type="button"
        aria-label="Close additional navigation"
        onClick={() => setMoreVisible(false)}
        className="mobile-more-backdrop"
      />}
      {moreVisible && <nav id="mobile-more-menu" aria-label="More navigation" className="mobile-more-sheet">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">More</h2>
          <button type="button" onClick={() => setMoreVisible(false)} aria-label="Close more menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {moreNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMoreVisible(false)} className={({ isActive }) => `flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center text-xs font-medium ${isActive ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-slate-200 bg-white text-slate-700'}`}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>}

      {!sidebarVisible && <nav aria-label="Primary navigation" className={`mobile-bottom-nav ${mobileNavCount <= 4 ? 'mobile-bottom-nav--4' : 'mobile-bottom-nav--5'}`}>
        {primaryNavItems.map(({ to, shortLabel, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={() => setMoreVisible(false)} className={({ isActive }) => `mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`}>
            <Icon size={21} strokeWidth={isActiveRoute(pathname, to) ? 2.4 : 1.8} aria-hidden="true" />
            <span>{shortLabel}</span>
          </NavLink>
        ))}
        {moreNavItems.length > 0 && <button
          type="button"
          aria-label="More navigation options"
          aria-expanded={moreVisible}
          aria-controls="mobile-more-menu"
          onClick={() => setMoreVisible((visible) => !visible)}
          className={`mobile-bottom-nav__item ${moreVisible || moreNavItems.some((item) => item.to === pathname) ? 'mobile-bottom-nav__item--active' : ''}`}
        >
          <MoreHorizontal size={22} aria-hidden="true" />
          <span>More</span>
        </button>}
      </nav>}
    </div>
  );
}

function isActiveRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}
