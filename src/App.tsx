import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from './components/Layout';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './context/AuthContext';
import { canAccessRoute } from './lib/permissions';
import type { RouteKey } from './types';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { DashboardPage } from './pages/DashboardPage';
import { ScreeningSessionsPage } from './pages/ScreeningSessionsPage';
import { StudentRegistrationPage } from './pages/StudentRegistrationPage';
import { StudentsPage } from './pages/StudentsPage';
import { SchoolsPage } from './pages/SchoolsPage';
import { DistrictsTaluksPage } from './pages/DistrictsTaluksPage';
import { EnumeratorsPage } from './pages/EnumeratorsPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { LoginPage } from './pages/LoginPage';

function RoleDashboardPage() {
  const { user } = useAuth();
  return user?.role === 'organization_admin' ? <AdminDashboardPage /> : <DashboardPage />;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { pathname } = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600" role="status">
        Restoring your workspace...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const routeKey = pathname === '/' ? 'dashboard' : pathname.slice(1) as RouteKey;
  if (!canAccessRoute(user.role, routeKey)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<RoleDashboardPage />} />
          <Route path="/users" element={<AdminUsersPage />} />
          <Route path="/screening-sessions" element={<ScreeningSessionsPage />} />
          <Route path="/student-registration" element={<StudentRegistrationPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/schools" element={<SchoolsPage />} />
          <Route path="/districts" element={<DistrictsTaluksPage />} />
          <Route path="/enumerators" element={<EnumeratorsPage />} />
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
