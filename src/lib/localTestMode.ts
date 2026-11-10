import type { AppUser, AuditLog, District, Role, School, ScreeningSession, StudentRecord, Taluk } from '../types';
import { getLocalDateString } from './date';
import { isSupabaseConfigured } from './supabase';

const SESSION_KEY = 'student-health-hub.local-test-session';
const DATA_KEY = 'student-health-hub.local-test-data';

export const isLocalTestLoginEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_TEST_LOGIN === 'true' && !isSupabaseConfigured;

const localUsers: Record<Role, AppUser> = {
  organization_admin: {
    id: 'local-test-admin',
    organizationId: 'local-test-organization',
    name: 'Local Test Administrator',
    email: 'admin@local.test',
    role: 'organization_admin',
  },
  district_manager: {
    id: 'local-test-manager',
    organizationId: 'local-test-organization',
    name: 'Local Test District Supervisor',
    email: 'manager@local.test',
    role: 'district_manager',
    districtId: 'local-test-district',
  },
  enumerator: {
    id: 'local-test-enumerator',
    organizationId: 'local-test-organization',
    name: 'Local Test Enumerator',
    email: 'enumerator@local.test',
    role: 'enumerator',
    districtId: 'local-test-district',
  },
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
  enumerators: [localUsers.enumerator.id],
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

export function startLocalTestSession(role: Role): AppUser {
  if (!isLocalTestLoginEnabled) {
    throw new Error('Local test sign-in is disabled. Configure VITE_ENABLE_LOCAL_TEST_LOGIN=true with no Supabase credentials.');
  }
  sessionStorage.setItem(SESSION_KEY, role);
  return localUsers[role];
}

export function restoreLocalTestSession(): AppUser | null {
  if (!isLocalTestLoginEnabled) return null;
  const role = sessionStorage.getItem(SESSION_KEY);
  return role && role in localUsers ? localUsers[role as Role] : null;
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

export function getLocalTestUsers(): AppUser[] {
  return Object.values(localUsers);
}

export function getLocalTestStudents(): StudentRecord[] {
  return readData().students;
}

export function getLocalTestAuditLogs(): AuditLog[] {
  return readData().auditLogs;
}

export function saveLocalTestStudent(student: StudentRecord, actorId: string): void {
  const data = readData();
  if (data.students.some((existing) => existing.siNumber === student.siNumber)) {
    throw new Error('A student with this SI Number is already saved in local test data.');
  }

  data.students = [student, ...data.students];
  data.auditLogs = [{
    id: crypto.randomUUID(),
    actor: getLocalTestUsers().find((user) => user.id === actorId)?.name ?? actorId,
    action: 'insert',
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
  const user = restoreLocalTestSession();
  if (!user) {
    throw new Error('No local test user is signed in.');
  }
  return user;
}
