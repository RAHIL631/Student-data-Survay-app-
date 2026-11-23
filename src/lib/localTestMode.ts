import type { AppUser, AuditLog, District, School, ScreeningSession, StudentRecord, Taluk } from '../types';
import { getLocalDateString } from './date';
import { calculateStudentScreeningStatus } from './screeningStatus.js';
import { isSupabaseConfigured } from './supabase';

const SESSION_KEY = 'student-health-hub.local-test-session';
const DATA_KEY = 'student-health-hub.local-test-data';

export const isLocalTestLoginEnabled =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_LOCAL_TEST_LOGIN === 'true' &&
  !isSupabaseConfigured;

const localUser: AppUser = {
  id: 'local-test-enumerator',
  organizationId: 'local-test-organization',
  name: 'Local Test Enumerator',
  email: 'enumerator@local.test',
  role: 'enumerator',
  districtId: 'local-test-district',
};

const district: District = {
  id: 'local-test-district',
  name: 'Local Test District',
  code: 'LOCAL',
  status: 'active',
};

const taluk: Taluk = {
  id: 'local-test-taluk',
  name: 'Local Test Taluk',
  districtId: district.id,
  status: 'active',
};

const school: School = {
  id: 'local-test-school',
  name: 'Local Test School',
  code: 'LOCAL-001',
  districtId: district.id,
  talukId: taluk.id,
  status: 'active',
};

const session: ScreeningSession = {
  id: 'local-test-session',
  name: 'Local Test Screening Session',
  districtId: district.id,
  districtName: district.name,
  talukId: taluk.id,
  talukName: taluk.name,
  schoolId: school.id,
  schoolName: school.name,
  beoName: 'Local Test BEO',
  headMasterName: 'Local Test Head Master',
  screeningFacultyName: 'Local Test Faculty',
  date: getLocalDateString(),
  status: 'active',
  enumerators: [localUser.id],
};

type LocalTestData = {
  students: StudentRecord[];
  auditLogs: AuditLog[];
};

function readData(): LocalTestData {
  const stored = localStorage.getItem(DATA_KEY);
  if (!stored) {
    return { students: [], auditLogs: [] };
  }

  try {
    const data: unknown = JSON.parse(stored);
    if (
      typeof data === 'object' &&
      data !== null &&
      'students' in data &&
      Array.isArray(data.students) &&
      'auditLogs' in data &&
      Array.isArray(data.auditLogs)
    ) {
      return data as LocalTestData;
    }
  } catch (error) {
    console.error('Unable to read local test data.', error);
  }

  throw new Error('Local test data is invalid. Clear this site’s local storage and sign in again.');
}

function saveData(data: LocalTestData): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

export function startLocalTestSession(): AppUser {
  if (!isLocalTestLoginEnabled) {
    throw new Error('Local test sign-in is disabled. Configure VITE_ENABLE_LOCAL_TEST_LOGIN=true with no Supabase credentials.');
  }
  sessionStorage.setItem(SESSION_KEY, 'enumerator');
  return localUser;
}

export function restoreLocalTestSession(): AppUser | null {
  return isLocalTestLoginEnabled && sessionStorage.getItem(SESSION_KEY) === 'enumerator' ? localUser : null;
}

export function endLocalTestSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isLocalTestSessionActive(): boolean {
  return restoreLocalTestSession() !== null;
}

export function getLocalTestDistricts(): District[] {
  return [district];
}

export function getLocalTestTaluks(): Taluk[] {
  return [taluk];
}

export function getLocalTestSchools(): School[] {
  return [school];
}

export function getLocalTestSessions(): ScreeningSession[] {
  return [session];
}

export function getLocalTestStudents(): StudentRecord[] {
  return readData().students.map((student) => ({
    ...student,
    siNumber: student.siNumber ?? null,
    studentName: student.studentName ?? null,
    className: student.className ?? null,
    section: student.section ?? null,
    sex: student.sex ?? null,
    dateOfBirth: student.dateOfBirth ?? null,
    age: student.age ?? null,
    heightCm: student.heightCm ?? null,
    weightKg: student.weightKg ?? null,
    bmi: student.bmi ?? null,
    skeletalDeformity: student.skeletalDeformity ?? null,
    skeletalObservation: student.skeletalObservation ?? null,
    skinThicknessMm: student.skinThicknessMm ?? null,
    midArmCircumferenceCm: student.midArmCircumferenceCm ?? null,
    additionalRemarks: student.additionalRemarks ?? null,
    districtName: student.districtName ?? district.name,
    talukName: student.talukName ?? taluk.name,
    schoolName: student.schoolName ?? school.name,
    status: calculateStudentScreeningStatus(student),
  }));
}

export function getLocalTestAuditLogs(): AuditLog[] {
  return readData().auditLogs;
}

export function saveLocalTestStudent(student: StudentRecord, actorId: string): void {
  const data = readData();
  if (student.siNumber && data.students.some((existing) => existing.siNumber === student.siNumber)) {
    throw new Error('A student with this SI Number is already saved in local test data.');
  }

  data.students = [{
    ...student,
    createdBy: student.createdBy ?? actorId,
    ownerId: student.ownerId ?? actorId,
    schoolName: school.name,
    districtName: district.name,
    talukName: taluk.name,
  }, ...data.students];
  data.auditLogs = [{
    id: crypto.randomUUID(),
    actor: localUser.name,
    action: 'insert',
    recordType: 'student_screenings',
    timestamp: new Date().toISOString(),
    metadata: JSON.stringify({ studentId: student.id, actorId }),
  }, ...data.auditLogs];
  saveData(data);
}

export function updateLocalTestStudent(student: StudentRecord, actorId: string): void {
  const data = readData();
  const existingIndex = data.students.findIndex((existing) => existing.id === student.id);
  if (existingIndex < 0) {
    throw new Error('The local test screening record could not be found.');
  }
  if (student.siNumber && data.students.some((existing) => existing.id !== student.id && existing.siNumber === student.siNumber)) {
    throw new Error('A student with this SI Number is already saved in local test data.');
  }

  data.students[existingIndex] = {
    ...student,
    schoolName: school.name,
    districtName: district.name,
    talukName: taluk.name,
  };
  data.auditLogs = [{
    id: crypto.randomUUID(),
    actor: localUser.name,
    action: 'update',
    recordType: 'student_screenings',
    timestamp: new Date().toISOString(),
    metadata: JSON.stringify({ studentId: student.id, actorId }),
  }, ...data.auditLogs];
  saveData(data);
}

export function getLocalTestDashboardSummary(): {
  studentCount: number;
  sessionCount: number;
  enumeratorCount: number;
  districtCount: number;
} {
  return {
    studentCount: readData().students.length,
    sessionCount: 1,
    enumeratorCount: 1,
    districtCount: 1,
  };
}

export function getLocalTestOrganizationName(): string {
  return 'Local Test Organization';
}

export function getLocalTestUser(): AppUser {
  return localUser;
}
