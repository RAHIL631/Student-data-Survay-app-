import type { StudentRecord, StudentScreeningStatus } from '../types';

export function calculateStudentScreeningStatus(
  student: Pick<
    StudentRecord,
    | 'siNumber'
    | 'studentName'
    | 'className'
    | 'section'
    | 'sex'
    | 'dateOfBirth'
    | 'age'
    | 'heightCm'
    | 'weightKg'
    | 'bmi'
    | 'skeletalDeformity'
    | 'skeletalObservation'
    | 'skinThicknessMm'
    | 'midArmCircumferenceCm'
    | 'sessionId'
    | 'districtId'
    | 'talukId'
    | 'schoolId'
    | 'screeningDate'
  >,
): StudentScreeningStatus;
