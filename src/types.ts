export type Role = 'organization_admin' | 'district_manager' | 'enumerator';
export type InvitationRole = 'district_manager' | 'enumerator';
export type InvitationStatus = 'provisioning' | 'pending' | 'accepted' | 'cancelled' | 'expired' | 'failed';
export type InvitationAuthStatus = 'not_attempted' | 'in_flight' | 'accepted_by_auth' | 'rejected_by_auth' | 'unknown';
export type StudentScreeningStatus = 'Pending' | 'Complete';

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
  createdBy?: string | null;
  ownerId?: string | null;
  siNumber: string | null;
  studentName: string | null;
  className: string | null;
  section: string | null;
  sex: 'Male' | 'Female' | 'Other' | 'Prefer not to specify' | null;
  dateOfBirth: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  skeletalDeformity: 'No' | 'Yes' | 'Suspected' | 'Not assessed' | null;
  skeletalObservation: string | null;
  skinThicknessMm: number | null;
  midArmCircumferenceCm: number | null;
  additionalRemarks: string | null;
  districtId: string;
  talukId: string;
  schoolId: string;
  districtName: string;
  talukName: string;
  schoolName: string;
  screeningDate: string;
  status: StudentScreeningStatus;
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
  | 'users'
  | 'screening-sessions'
  | 'student-registration'
  | 'students'
  | 'schools'
  | 'districts'
  | 'enumerators'
  | 'invitations'
  | 'assignments'
  | 'reports'
  | 'audit-logs'
  | 'settings'
  | 'profile';
