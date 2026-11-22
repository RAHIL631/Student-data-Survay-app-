const roleRoutes = Object.freeze({
  organization_admin: Object.freeze([
    'dashboard', 'users', 'screening-sessions', 'student-registration', 'students', 'schools',
    'districts', 'enumerators', 'assignments', 'reports', 'audit-logs', 'settings', 'profile',
  ]),
  district_manager: Object.freeze([
    'dashboard', 'screening-sessions', 'students', 'schools', 'districts', 'assignments', 'reports', 'profile',
  ]),
  enumerator: Object.freeze([
    'dashboard', 'screening-sessions', 'student-registration', 'students', 'reports', 'profile',
  ]),
});

export function canAccessRoute(role, routeKey) {
  return roleRoutes[role]?.includes(routeKey) ?? false;
}
