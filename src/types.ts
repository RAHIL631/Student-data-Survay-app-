export type Role = 'organization_admin' | 'district_manager' | 'enumerator';

export type AppUser = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: Role;
  districtId?: string;
  schoolIds?: string[];
};

export type District = {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
};

export type Taluk = {
  id: string;
  name: string;
  districtId: string;
  status: 'active' | 'inactive';
};

export type School = {
  id: string;
  name: string;
  code: string;
  districtId: string;
  talukId: string;
  status: 'active' | 'inactive';
};

export type ScreeningSession = {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
  talukId: string;
  talukName: string;
  schoolId: string;
  schoolName: string;
  beoName: string;
  headMasterName: string;
  screeningFacultyName: string;
  date: string;
  status: 'active' | 'completed' | 'cancelled';
  enumerators: string[];
};

export type StudentRecord = {
  id: string;
  sessionId: string;
  siNumber: string;
  studentName: string;
  className: string;
  section: string;
  sex: 'Male' | 'Female' | 'Other' | 'Prefer not to specify';
  dateOfBirth: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bmi: number;
  skeletalDeformity: 'No' | 'Yes' | 'Suspected' | 'Not assessed';
  skeletalObservation: string;
  skinThicknessMm: number | null;
  midArmCircumferenceCm: number | null;
  additionalRemarks: string;
  districtId: string;
  talukId: string;
  schoolId: string;
  screeningDate: string;
  status: 'Pending' | 'Reviewed' | 'Synced';
};

export type PendingStudentSubmissionData = {
  organizationId: string;
  userId: string;
  sessionId: string;
  student: StudentRecord;
};

export type PendingStudentSubmission = {
  localId: string;
  idempotencyKey: string;
  data: PendingStudentSubmissionData;
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict' | 'resolved';
  attemptCount: number;
  nextRetryAt?: string;
  retryable?: boolean;
  lastError?: string;
  syncToken?: string;
  leaseExpiresAt?: string;
  syncedAt?: string;
  conflictType?: 'server_record_changed' | 'si_number_conflict' | 'duplicate_unverified';
  conflictMessage?: string;
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
  resolution?: 'keep_server';
  resolvedAt?: string;
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  recordType: string;
  timestamp: string;
  metadata: string;
};

export type RouteKey =
  | 'dashboard'
  | 'screening-sessions'
  | 'student-registration'
  | 'students'
  | 'schools'
  | 'districts'
  | 'enumerators'
  | 'assignments'
  | 'reports'
  | 'audit-logs'
  | 'settings'
  | 'profile';
