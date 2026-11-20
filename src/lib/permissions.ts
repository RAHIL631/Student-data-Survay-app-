import type { Role, RouteKey } from '../types';
import { serializeCsv } from './csv.js';

const roleAccess: Record<Role, RouteKey[]> = {
  organization_admin: ['dashboard', 'users', 'screening-sessions', 'student-registration', 'students', 'schools', 'districts', 'enumerators', 'assignments', 'reports', 'audit-logs', 'settings', 'profile'],
  district_manager: ['dashboard', 'students', 'reports', 'profile'],
  enumerator: ['dashboard', 'screening-sessions', 'student-registration', 'students', 'reports', 'profile'],
};

export function canAccessRoute(role: Role, routeKey: RouteKey): boolean {
  return roleAccess[role].includes(routeKey);
}

export function getRoleLabel(role: Role): string {
  if (role === 'organization_admin') return 'Administrator';
  if (role === 'district_manager') return 'Viewer';
  return 'Screening Faculty';
}

export function calculateAge(dateOfBirth: string, screeningDate: string): number {
  const birth = parseDateOnly(dateOfBirth);
  const screening = parseDateOnly(screeningDate);
  if (!birth || !screening) return Number.NaN;

  const age = screening.year - birth.year;
  const monthAdjustment = screening.month - birth.month;
  if (monthAdjustment < 0 || (monthAdjustment === 0 && screening.day < birth.day)) {
    return age - 1;
  }

  return age;
}

function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function calculateBmi(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm) {
    return 0;
  }

  const heightInMeters = heightCm / 100;
  return Number((weightKg / (heightInMeters * heightInMeters)).toFixed(2));
}

export function exportCsv(filename: string, rows: Record<string, string | number | null>[]): void {
  if (!rows.length) {
    return;
  }

  const csv = serializeCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
