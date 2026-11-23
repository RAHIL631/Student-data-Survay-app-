import type { Role, RouteKey } from '../types';

export function canAccessRoute(role: Role, routeKey: RouteKey): boolean;
export function canEditStudentScreening(
  role: Role | null | undefined,
  userId: string | null | undefined,
  student: { createdBy?: string | null; ownerId?: string | null } | null | undefined,
): boolean;
