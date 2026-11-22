import type { Role, RouteKey } from '../types';
import { serializeCsv } from './csv.js';
import { canAccessRoute } from './roleAccess.js';

export { canAccessRoute };

export function getRoleLabel(role: Role): string {
  switch (role) {
    case 'organization_admin': return 'Organization administrator';
    case 'district_manager': return 'District manager';
    case 'enumerator': return 'Enumerator';
  }
}

export function getHomeRoute(_role: Role): RouteKey {
  return 'dashboard';
}

export function calculateAge(dateOfBirth: string, screeningDate: string): number {
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const screening = new Date(`${screeningDate}T00:00:00.000Z`);
  const age = screening.getUTCFullYear() - birth.getUTCFullYear();
  const monthAdjustment = screening.getUTCMonth() - birth.getUTCMonth();

  if (monthAdjustment < 0 || (monthAdjustment === 0 && screening.getUTCDate() < birth.getUTCDate())) {
    return age - 1;
  }

  return age;
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
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
