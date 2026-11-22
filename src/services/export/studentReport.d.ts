import type { StudentRecord } from '../../types';

export const STUDENT_REPORT_HEADINGS: readonly string[];
export function getStudentReportFilename(students: StudentRecord[], extension: 'xlsx' | 'pdf', now?: Date): string;
export function createStudentExcelWorkbook(students: StudentRecord[]): Promise<unknown>;
export function createStudentPdfDocument(students: StudentRecord[], generatedAt?: Date): Promise<unknown>;
export function exportStudentExcel(students: StudentRecord[]): Promise<void>;
export function exportStudentPdf(students: StudentRecord[], generatedAt?: Date): Promise<void>;
