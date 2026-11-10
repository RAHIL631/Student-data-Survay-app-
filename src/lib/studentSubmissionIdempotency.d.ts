import type { PendingStudentSubmissionData } from '../types';

type SavedStudentRow = {
  organization_id: string;
  id: string;
  created_by: string;
  session_id: string | null;
  district_id: string | null;
  taluk_id: string | null;
  school_id: string | null;
  si_number: string;
  student_name: string;
  class_name: string | null;
  section: string | null;
  sex: string | null;
  date_of_birth: string | null;
  age: number | null;
  height_cm: number | string | null;
  weight_kg: number | string | null;
  bmi: number | string | null;
  skeletal_deformity: string | null;
  skeletal_observation: string | null;
  skin_thickness_mm: number | string | null;
  mid_arm_circumference_cm: number | string | null;
  additional_remarks: string | null;
  screening_date: string;
  status: string;
};

type IdempotentSubmissionInput = PendingStudentSubmissionData & {
  idempotencyKey?: string;
};

export function isSameSavedStudentSubmission(row: SavedStudentRow, input: PendingStudentSubmissionData): boolean;

export class DuplicateStudentSubmissionError extends Error {
  code: string;
  status: number;
  conflictType: 'server_record_changed' | 'si_number_conflict' | 'duplicate_unverified';
  serverRecord?: {
    id: string;
    studentName: string;
    siNumber: string;
    dateOfBirth: string | null;
    sessionId: string | null;
    screeningDate: string;
    status: string;
    heightCm: number | null;
    weightKg: number | null;
  };
}

export function verifyDuplicateStudentSubmission(
  input: IdempotentSubmissionInput,
  findById: (organizationId: string, id: string) => Promise<SavedStudentRow | null>,
  findBySiNumber: (organizationId: string, siNumber: string) => Promise<SavedStudentRow | null>,
): Promise<void>;
