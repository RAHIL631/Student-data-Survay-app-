import type { StudentRecord } from '../types';

export function createStudentExportRows(students: StudentRecord[]): Record<string, string | number>[];
