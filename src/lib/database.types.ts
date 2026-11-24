export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Relationship<
  ForeignKeyName extends string,
  Columns extends string[],
  ReferencedRelation extends string,
  ReferencedColumns extends string[],
> = {
  foreignKeyName: ForeignKeyName;
  columns: Columns;
  isOneToOne: boolean;
  referencedRelation: ReferencedRelation;
  referencedColumns: ReferencedColumns;
};

type Table<
  Row,
  Insert,
  Update = Partial<Insert>,
  Relationships extends Relationship<string, string[], string, string[]>[] = [],
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

type ProfileRow = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  role: 'organization_admin' | 'district_manager' | 'enumerator';
  district_id: string | null;
  is_active: boolean;
  approval_status: 'pending' | 'approved';
  created_at: string;
  updated_at: string;
};

type DistrictRow = {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

type TalukRow = {
  id: string;
  organization_id: string;
  district_id: string;
  name: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

type SchoolRow = {
  id: string;
  organization_id: string;
  owner_id: string;
  created_by: string;
  updated_by: string;
  deleted_by: string | null;
  deleted_at: string | null;
  district_id: string;
  taluk_id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

type ScreeningSessionRow = {
  id: string;
  organization_id: string;
  owner_id: string;
  created_by: string;
  updated_by: string;
  deleted_by: string | null;
  deleted_at: string | null;
  district_id: string;
  taluk_id: string;
  school_id: string;
  name: string;
  beo_name: string;
  head_master_name: string;
  screening_faculty_name: string;
  screening_date: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
};

type StudentScreeningRow = {
  id: string;
  organization_id: string;
  owner_id: string;
  created_by: string;
  updated_by: string;
  deleted_by: string | null;
  deleted_at: string | null;
  session_id: string | null;
  district_id: string | null;
  taluk_id: string | null;
  school_id: string | null;
  si_number: string;
  student_name: string;
  class_name: string;
  section: string;
  sex: 'Male' | 'Female' | 'Other' | 'Prefer not to specify';
  date_of_birth: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  bmi: number;
  skeletal_deformity: 'No' | 'Yes' | 'Suspected' | 'Not assessed' | null;
  skeletal_observation: string | null;
  skin_thickness_mm: number | null;
  mid_arm_circumference_cm: number | null;
  additional_remarks: string | null;
  screening_date: string;
  status: 'Pending' | 'Reviewed' | 'Synced';
  created_at: string;
  updated_at: string;
};

type AuditLogRow = {
  id: string;
  organization_id: string;
  district_id: string | null;
  actor_id: string | null;
  action: string;
  record_type: string;
  record_id: string | null;
  metadata: Json;
  created_at: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type AssignmentRow = {
  id: string;
  organization_id: string;
  session_id: string;
  enumerator_id: string;
  created_at: string;
};

type OwnerDataGrantRow = {
  organization_id: string;
  viewer_id: string;
  owner_id: string;
  created_by: string;
  created_at: string;
};

type UserInvitationRow = {
  id: string;
  organization_id: string;
  district_id: string;
  invited_by: string;
  email: string;
  role: 'district_manager' | 'enumerator';
  status: 'provisioning' | 'pending' | 'accepted' | 'cancelled' | 'expired' | 'failed';
  auth_status: 'not_attempted' | 'in_flight' | 'accepted_by_auth' | 'rejected_by_auth' | 'unknown';
  auth_user_id: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  auth_request_started_at: string | null;
  last_auth_response_at: string | null;
  accepted_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  failure_code: 'auth_rejected' | 'auth_unavailable' | 'unexpected_failure' | null;
};

type OrganizationInsert = { id?: string; name: string; created_at?: string; updated_at?: string };
type ProfileInsert = {
  id: string;
  organization_id: string;
  email: string;
  full_name?: string;
  role: ProfileRow['role'];
  district_id?: string | null;
  is_active?: boolean;
  approval_status?: ProfileRow['approval_status'];
  created_at?: string;
  updated_at?: string;
};
type ProfileUpdate = {
  full_name?: string;
  is_active?: boolean;
  approval_status?: ProfileRow['approval_status'];
};
type DistrictInsert = {
  id?: string;
  organization_id: string;
  name: string;
  code: string;
  status?: DistrictRow['status'];
  created_at?: string;
  updated_at?: string;
};
type TalukInsert = {
  id?: string;
  organization_id: string;
  district_id: string;
  name: string;
  status?: TalukRow['status'];
  created_at?: string;
  updated_at?: string;
};
type SchoolInsert = {
  id?: string;
  organization_id: string;
  district_id: string;
  taluk_id: string;
  name: string;
  code: string;
  status?: SchoolRow['status'];
  created_at?: string;
  updated_at?: string;
};
type SessionInsert = {
  id?: string;
  organization_id: string;
  district_id: string;
  taluk_id: string;
  school_id: string;
  name: string;
  beo_name: string;
  head_master_name: string;
  screening_faculty_name: string;
  screening_date: string;
  status?: ScreeningSessionRow['status'];
  created_at?: string;
  updated_at?: string;
};
type StudentInsert = {
  id?: string;
  organization_id: string;
  session_id: string;
  district_id: string;
  taluk_id: string;
  school_id: string;
  si_number: string;
  student_name: string;
  class_name: string;
  section: string;
  sex: StudentScreeningRow['sex'];
  date_of_birth: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  bmi: number;
  skeletal_deformity?: StudentScreeningRow['skeletal_deformity'];
  skeletal_observation?: string | null;
  skin_thickness_mm?: number | null;
  mid_arm_circumference_cm?: number | null;
  additional_remarks?: string | null;
  screening_date?: string;
  status?: StudentScreeningRow['status'];
  created_at?: string;
  updated_at?: string;
};
type AuditInsert = {
  id?: string;
  organization_id: string;
  district_id?: string | null;
  actor_id?: string | null;
  action: string;
  record_type: string;
  record_id?: string | null;
  metadata?: Json;
  created_at?: string;
};
type AssignmentInsert = {
  id?: string;
  organization_id: string;
  session_id: string;
  enumerator_id: string;
  created_at?: string;
};
type OwnerDataGrantInsert = Omit<OwnerDataGrantRow, 'created_at' | 'created_by'>
  & Partial<Pick<OwnerDataGrantRow, 'created_at' | 'created_by'>>;
type UserInvitationInsert = {
  id?: string;
  organization_id: string;
  district_id: string;
  invited_by: string;
  email: string;
  role: UserInvitationRow['role'];
  status?: UserInvitationRow['status'];
  auth_status?: UserInvitationRow['auth_status'];
  auth_user_id?: string | null;
  idempotency_key: string;
  created_at?: string;
  updated_at?: string;
  auth_request_started_at?: string | null;
  last_auth_response_at?: string | null;
  accepted_at?: string | null;
  cancelled_at?: string | null;
  expired_at?: string | null;
  failure_code?: UserInvitationRow['failure_code'];
};
type UserInvitationRelationships = [
  Relationship<'user_invitations_organization_id_fkey', ['organization_id'], 'organizations', ['id']>,
  Relationship<
    'user_invitations_district_fk',
    ['organization_id', 'district_id'],
    'districts',
    ['organization_id', 'id']
  >,
  Relationship<
    'user_invitations_inviter_fk',
    ['organization_id', 'invited_by'],
    'profiles',
    ['organization_id', 'id']
  >,
];
type OrganizationRelationships = [];
type DistrictRelationships = [
  Relationship<'districts_organization_id_fkey', ['organization_id'], 'organizations', ['id']>,
];
type ProfileRelationships = [
  Relationship<'profiles_district_id_fkey', ['district_id'], 'districts', ['id']>,
  Relationship<
    'profiles_organization_district_fkey',
    ['organization_id', 'district_id'],
    'districts',
    ['organization_id', 'id']
  >,
  Relationship<'profiles_organization_id_fkey', ['organization_id'], 'organizations', ['id']>,
];
type TalukRelationships = [
  Relationship<'taluks_district_id_fkey', ['district_id'], 'districts', ['id']>,
  Relationship<
    'taluks_organization_district_fkey',
    ['organization_id', 'district_id'],
    'districts',
    ['organization_id', 'id']
  >,
  Relationship<'taluks_organization_id_fkey', ['organization_id'], 'organizations', ['id']>,
];
type SchoolRelationships = [
  Relationship<'schools_district_id_fkey', ['district_id'], 'districts', ['id']>,
  Relationship<
    'schools_organization_district_fkey',
    ['organization_id', 'district_id'],
    'districts',
    ['organization_id', 'id']
  >,
  Relationship<'schools_organization_id_fkey', ['organization_id'], 'organizations', ['id']>,
  Relationship<
    'schools_organization_taluk_district_fkey',
    ['organization_id', 'taluk_id', 'district_id'],
    'taluks',
    ['organization_id', 'id', 'district_id']
  >,
  Relationship<'schools_taluk_id_fkey', ['taluk_id'], 'taluks', ['id']>,
];
type SessionRelationships = [
  Relationship<'screening_sessions_created_by_fkey', ['created_by'], 'profiles', ['id']>,
  Relationship<'screening_sessions_district_id_fkey', ['district_id'], 'districts', ['id']>,
  Relationship<
    'screening_sessions_organization_id_created_by_fkey',
    ['organization_id', 'created_by'],
    'profiles',
    ['organization_id', 'id']
  >,
  Relationship<
    'screening_sessions_organization_id_fkey',
    ['organization_id'],
    'organizations',
    ['id']
  >,
  Relationship<
    'screening_sessions_organization_id_school_id_district_id_t_fkey',
    ['organization_id', 'school_id', 'district_id', 'taluk_id'],
    'schools',
    ['organization_id', 'id', 'district_id', 'taluk_id']
  >,
  Relationship<'screening_sessions_school_id_fkey', ['school_id'], 'schools', ['id']>,
  Relationship<'screening_sessions_taluk_id_fkey', ['taluk_id'], 'taluks', ['id']>,
];
type AssignmentRelationships = [
  Relationship<'session_assignments_enumerator_id_fkey', ['enumerator_id'], 'profiles', ['id']>,
  Relationship<
    'session_assignments_organization_id_enumerator_id_fkey',
    ['organization_id', 'enumerator_id'],
    'profiles',
    ['organization_id', 'id']
  >,
  Relationship<
    'session_assignments_organization_id_fkey',
    ['organization_id'],
    'organizations',
    ['id']
  >,
  Relationship<
    'session_assignments_organization_id_session_id_fkey',
    ['organization_id', 'session_id'],
    'screening_sessions',
    ['organization_id', 'id']
  >,
  Relationship<
    'session_assignments_session_id_fkey',
    ['session_id'],
    'screening_sessions',
    ['id']
  >,
];
type StudentScreeningRelationships = [
  Relationship<'student_screenings_created_by_fkey', ['created_by'], 'profiles', ['id']>,
  Relationship<'student_screenings_district_id_fkey', ['district_id'], 'districts', ['id']>,
  Relationship<
    'student_screenings_org_creator_fkey',
    ['organization_id', 'created_by'],
    'profiles',
    ['organization_id', 'id']
  >,
  Relationship<
    'student_screenings_org_session_fkey',
    ['organization_id', 'session_id', 'district_id', 'taluk_id', 'school_id'],
    'screening_sessions',
    ['organization_id', 'id', 'district_id', 'taluk_id', 'school_id']
  >,
  Relationship<
    'student_screenings_organization_id_fkey',
    ['organization_id'],
    'organizations',
    ['id']
  >,
  Relationship<'student_screenings_school_id_fkey', ['school_id'], 'schools', ['id']>,
  Relationship<'student_screenings_session_id_fkey', ['session_id'], 'screening_sessions', ['id']>,
  Relationship<'student_screenings_taluk_id_fkey', ['taluk_id'], 'taluks', ['id']>,
];
type AuditLogRelationships = [
  Relationship<'audit_logs_actor_id_fkey', ['actor_id'], 'profiles', ['id']>,
  Relationship<'audit_logs_organization_id_fkey', ['organization_id'], 'organizations', ['id']>,
];
export type Database = {
  public: {
    Tables: {
      organizations: Table<OrganizationRow, OrganizationInsert, Partial<OrganizationInsert>, OrganizationRelationships>;
      profiles: Table<ProfileRow, ProfileInsert, ProfileUpdate, ProfileRelationships>;
      districts: Table<DistrictRow, DistrictInsert, Partial<DistrictInsert>, DistrictRelationships>;
      taluks: Table<TalukRow, TalukInsert, Partial<TalukInsert>, TalukRelationships>;
      schools: Table<SchoolRow, SchoolInsert, Partial<SchoolInsert>, SchoolRelationships>;
      screening_sessions: Table<ScreeningSessionRow, SessionInsert, Partial<SessionInsert>, SessionRelationships>;
      session_assignments: Table<AssignmentRow, AssignmentInsert, Partial<AssignmentInsert>, AssignmentRelationships>;
      user_invitations: Table<
        UserInvitationRow,
        UserInvitationInsert,
        Partial<UserInvitationInsert>,
        UserInvitationRelationships
      >;
      owner_data_grants: Table<OwnerDataGrantRow, OwnerDataGrantInsert>;
      student_screenings: Table<
        StudentScreeningRow,
        StudentInsert,
        Partial<StudentInsert>,
        StudentScreeningRelationships
      >;
      audit_logs: Table<AuditLogRow, AuditInsert, Partial<AuditInsert>, AuditLogRelationships>;
    };
    Views: Record<string, never>;
    Functions: {
      current_profile_district_id: { Args: Record<PropertyKey, never>; Returns: string };
      current_profile_organization_id: { Args: Record<PropertyKey, never>; Returns: string };
      current_profile_role: { Args: Record<PropertyKey, never>; Returns: string };
      is_assigned_to_session: { Args: { target_session_id: string }; Returns: boolean };
      assign_school_owner: {
        Args: { target_school_id: string; target_owner_id: string };
        Returns: undefined;
      };
      set_owner_data_grant: {
        Args: { target_viewer_id: string; target_owner_id: string; should_grant: boolean };
        Returns: undefined;
      };
      can_view_owner_data: {
        Args: { target_owner_id: string };
        Returns: boolean;
      };
      reserve_student_si_number: {
        Args: { target_session_id: string; target_idempotency_key: string };
        Returns: string;
      };
      request_user_invitation: {
        Args: {
          requested_email: string;
          requested_role: string;
          requested_district_id: string;
          request_idempotency_key: string;
        };
        Returns: Array<{ invitation_id: string | null; created: boolean; result_code: string }>;
      };
      claim_user_invitation_auth_request: {
        Args: { target_invitation_id: string };
        Returns: boolean;
      };
      record_user_invitation_auth_result: {
        Args: {
          target_invitation_id: string;
          result_status: string;
          resulting_auth_user_id?: string | null;
          safe_failure_code?: string | null;
        };
        Returns: boolean;
      };
      cancel_user_invitation: {
        Args: { target_invitation_id: string };
        Returns: boolean;
      };
      accept_user_invitation: {
        Args: { target_invitation_id: string; target_full_name: string };
        Returns: 'pending_approval' | 'approved';
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
