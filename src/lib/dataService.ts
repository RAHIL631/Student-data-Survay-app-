import type { PostgrestError } from '@supabase/supabase-js';
import type { AppUser, AuditLog, District, InvitationRole, OwnerDataGrant, School, ScreeningSession, StudentRecord, Taluk } from '../types';
import { verifyDuplicateStudentSubmission } from './studentSubmissionIdempotency.js';
import type { Database } from './database.types';
import { requireSupabase } from './supabase';
import {
  getLocalTestAuditLogs,
  getLocalTestDashboardSummary,
  getLocalTestDistricts,
  getLocalTestUsers,
  getLocalTestOrganizationName,
  getLocalTestSchools,
  getLocalTestSessions,
  getLocalTestStudents,
  getLocalTestTaluks,
  getLocalTestUser,
  isLocalTestSessionActive,
  saveLocalTestStudent,
} from './localTestMode';

function throwIfError(error: PostgrestError | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

export type InvitationHistoryRecord = Pick<
  Database['public']['Tables']['user_invitations']['Row'],
  | 'id'
  | 'email'
  | 'role'
  | 'status'
  | 'auth_status'
  | 'created_at'
  | 'last_auth_response_at'
  | 'accepted_at'
  | 'cancelled_at'
>;

export type InvitationSubmissionResult =
  | { status: 'auth_request_accepted'; invitationId: string }
  | { status: 'already_processing' | 'outcome_unknown' };

export async function getProfile(userId: string): Promise<AppUser> {
  if (isLocalTestSessionActive() && userId === getLocalTestUser().id) {
    return getLocalTestUser();
  }

  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, organization_id, email, full_name, role, district_id, is_active, approval_status')
    .eq('id', userId)
    .maybeSingle();

  throwIfError(error);
  if (!data) {
    throw new Error('Your account is authenticated but has no organization profile. Ask an organization administrator to provision your profile.');
  }
  if (data.approval_status === 'pending') {
    throw new Error('Your account is waiting for administrator approval. You will be able to sign in after it is approved.');
  }
  if (!data.is_active) {
    throw new Error('This account is inactive. Contact an administrator for access.');
  }

  return {
    id: data.id,
    organizationId: data.organization_id,
    email: data.email,
    name: data.full_name,
    role: data.role,
    isActive: data.is_active,
    approvalStatus: data.approval_status,
    districtId: data.district_id ?? undefined,
  };
}

export async function getDistricts(): Promise<District[]> {
  if (isLocalTestSessionActive()) {
    return getLocalTestDistricts();
  }

  const { data, error } = await requireSupabase()
    .from('districts')
    .select('id, name, code, status')
    .order('name');

  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status,
  }));
}

export async function getOrganizationName(organizationId: string): Promise<string> {
  if (isLocalTestSessionActive() && organizationId === getLocalTestUser().organizationId) {
    return getLocalTestOrganizationName();
  }

  const { data, error } = await requireSupabase()
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single();

  throwIfError(error);
  if (!data) {
    throw new Error('The organization profile could not be found.');
  }
  return data.name;
}

export async function getTaluks(): Promise<Taluk[]> {
  if (isLocalTestSessionActive()) {
    return getLocalTestTaluks();
  }

  const { data, error } = await requireSupabase()
    .from('taluks')
    .select('id, name, district_id, status')
    .order('name');

  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    districtId: row.district_id,
    status: row.status,
  }));
}

export async function getSchools(): Promise<School[]> {
  if (isLocalTestSessionActive()) {
    return getLocalTestSchools();
  }

  const { data, error } = await requireSupabase()
    .from('schools')
    .select('id, owner_id, name, code, district_id, taluk_id, status')
    .order('name');

  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    code: row.code,
    districtId: row.district_id,
    talukId: row.taluk_id,
    status: row.status,
  }));
}

export async function getActiveSchoolsForOrganization(organizationId: string): Promise<School[]> {
  if (isLocalTestSessionActive()) {
    return organizationId === getLocalTestUser().organizationId
      ? getLocalTestSchools().filter((school) => school.status === 'active')
      : [];
  }

  const { data, error } = await requireSupabase()
    .from('schools')
    .select('id, owner_id, name, code, district_id, taluk_id, status')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('name');

  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    code: row.code,
    districtId: row.district_id,
    talukId: row.taluk_id,
    status: row.status,
  }));
}

export async function getScreeningSessions(): Promise<ScreeningSession[]> {
  if (isLocalTestSessionActive()) {
    return getLocalTestSessions();
  }

  const client = requireSupabase();
  const [
    { data: sessions, error: sessionsError },
    { data: assignments, error: assignmentsError },
    { data: schools, error: schoolsError },
    { data: districts, error: districtsError },
    { data: taluks, error: taluksError },
  ] = await Promise.all([
    client.from('screening_sessions')
      .select('id, owner_id, name, district_id, taluk_id, school_id, beo_name, head_master_name, screening_faculty_name, screening_date, status')
      .order('screening_date', { ascending: false }),
    client.from('session_assignments').select('session_id, enumerator_id'),
    client.from('schools').select('id, name'),
    client.from('districts').select('id, name'),
    client.from('taluks').select('id, name'),
  ]);

  throwIfError(sessionsError);
  throwIfError(assignmentsError);
  throwIfError(schoolsError);
  throwIfError(districtsError);
  throwIfError(taluksError);

  const schoolNames = new Map((schools ?? []).map((school) => [school.id, school.name]));
  const districtNames = new Map((districts ?? []).map((district) => [district.id, district.name]));
  const talukNames = new Map((taluks ?? []).map((taluk) => [taluk.id, taluk.name]));

  return (sessions ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    districtId: row.district_id,
    districtName: districtNames.get(row.district_id) ?? row.district_id,
    talukId: row.taluk_id,
    talukName: talukNames.get(row.taluk_id) ?? row.taluk_id,
    schoolId: row.school_id,
    schoolName: schoolNames.get(row.school_id) ?? row.school_id,
    beoName: row.beo_name,
    headMasterName: row.head_master_name,
    screeningFacultyName: row.screening_faculty_name,
    date: row.screening_date,
    status: row.status,
    enumerators: [...new Set([
      row.owner_id,
      ...(assignments ?? [])
        .filter((assignment) => assignment.session_id === row.id)
        .map((assignment) => assignment.enumerator_id),
    ])],
  }));
}

export async function getStudentRecords(): Promise<StudentRecord[]> {
  if (isLocalTestSessionActive()) {
    return getLocalTestStudents();
  }

  const { data, error } = await requireSupabase()
    .from('student_screenings')
    .select('id, owner_id, session_id, si_number, student_name, class_name, section, sex, date_of_birth, age, height_cm, weight_kg, bmi, skeletal_deformity, skeletal_observation, skin_thickness_mm, mid_arm_circumference_cm, additional_remarks, district_id, taluk_id, school_id, screening_date, status')
    .order('screening_date', { ascending: false });

  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    sessionId: row.session_id ?? '',
    siNumber: row.si_number,
    studentName: row.student_name,
    className: row.class_name ?? '',
    section: row.section ?? '',
    sex: row.sex ?? 'Prefer not to specify',
    dateOfBirth: row.date_of_birth ?? '',
    age: row.age ?? 0,
    heightCm: Number(row.height_cm ?? 0),
    weightKg: Number(row.weight_kg ?? 0),
    bmi: Number(row.bmi ?? 0),
    skeletalDeformity: row.skeletal_deformity ?? 'Not assessed',
    skeletalObservation: row.skeletal_observation ?? '',
    skinThicknessMm: row.skin_thickness_mm === null ? null : Number(row.skin_thickness_mm),
    midArmCircumferenceCm: row.mid_arm_circumference_cm === null ? null : Number(row.mid_arm_circumference_cm),
    additionalRemarks: row.additional_remarks ?? '',
    districtId: row.district_id ?? '',
    talukId: row.taluk_id ?? '',
    schoolId: row.school_id ?? '',
    screeningDate: row.screening_date,
    status: row.status,
  }));
}

export async function getEnumerators(): Promise<AppUser[]> {
  if (isLocalTestSessionActive()) {
    return getLocalTestUsers().filter((user) => user.role === 'enumerator');
  }

  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, organization_id, email, full_name, role, district_id, is_active, approval_status')
    .eq('role', 'enumerator')
    .eq('is_active', true)
    .order('full_name');

  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    name: row.full_name,
    role: row.role,
    isActive: row.is_active,
    approvalStatus: row.approval_status,
    districtId: row.district_id ?? undefined,
  }));
}

export async function getOrganizationUsers(): Promise<AppUser[]> {
  if (isLocalTestSessionActive()) {
    return getLocalTestUsers();
  }

  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, organization_id, email, full_name, role, district_id, is_active, approval_status')
    .order('full_name');
  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    name: row.full_name,
    role: row.role,
    isActive: row.is_active,
    approvalStatus: row.approval_status,
    districtId: row.district_id ?? undefined,
  }));
}

export async function getOwnerDataGrants(): Promise<OwnerDataGrant[]> {
  if (isLocalTestSessionActive()) {
    return [];
  }

  const { data, error } = await requireSupabase()
    .from('owner_data_grants')
    .select('viewer_id, owner_id')
    .order('viewer_id');
  throwIfError(error);
  return (data ?? []).map((row) => ({
    viewerId: row.viewer_id,
    ownerId: row.owner_id,
  }));
}

export async function setOwnerDataGrant(viewerId: string, ownerId: string, shouldGrant: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc('set_owner_data_grant', {
    target_viewer_id: viewerId,
    target_owner_id: ownerId,
    should_grant: shouldGrant,
  });
  throwIfError(error);
}

export async function manageOrganizationUser(input: {
  userId: string;
  action: 'reset_password' | 'deactivate' | 'reactivate' | 'approve';
}): Promise<{ warning?: string }> {
  if (isLocalTestSessionActive()) {
    throw new Error('Account management is not available in local test mode.');
  }

  const { data, error } = await requireSupabase().functions.invoke('admin-provision-user', {
    body: { action: input.action, targetUserId: input.userId },
  });
  if (error) {
    throw new Error(error.message);
  }
  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : 'The account action could not be completed.');
  }
  return { warning: typeof data?.warning === 'string' ? data.warning : undefined };
}

export async function getUserInvitations(): Promise<InvitationHistoryRecord[]> {
  const { data, error } = await requireSupabase()
    .from('user_invitations')
    .select('id, email, role, status, auth_status, created_at, last_auth_response_at, accepted_at, cancelled_at')
    .order('created_at', { ascending: false })
    .limit(100);

  throwIfError(error);
  return data ?? [];
}

export async function createUserInvitation(input: {
  email: string;
  role: InvitationRole;
  districtId: string;
  idempotencyKey: string;
}): Promise<InvitationSubmissionResult> {
  const { data, error } = await requireSupabase().functions.invoke<{
    invitationId?: string;
    status?: string;
    code?: string;
  }>('invite-user', {
    body: {
      action: 'invite',
      email: input.email,
      role: input.role,
      districtId: input.districtId,
      idempotencyKey: input.idempotencyKey,
    },
  });

  if (error) {
    const status = error.context instanceof Response ? error.context.status : undefined;
    if (status !== undefined && status >= 400 && status < 500) {
      throw new Error('The invitation could not be created. Check your permissions and invitation history.');
    }
    throw new Error('The invitation outcome could not be confirmed. Check invitation history before trying again.');
  }
  if (data?.status === 'auth_request_accepted' && data.invitationId) {
    return { status: 'auth_request_accepted', invitationId: data.invitationId };
  }
  if (data?.status === 'already_processing' || data?.status === 'outcome_unknown') {
    return { status: data.status };
  }
  throw new Error('The invitation outcome could not be confirmed. Check invitation history before trying again.');
}

export async function cancelUserInvitation(invitationId: string): Promise<void> {
  const { data, error } = await requireSupabase().functions.invoke<{ status?: string }>(
    'invite-user',
    { body: { action: 'cancel', invitationId } },
  );
  if (error || data?.status !== 'cancelled') {
    throw new Error('This invitation could not be cancelled. It may already be complete or outside your authorized scope.');
  }
}

export async function getAssignments(): Promise<Array<{
  session: ScreeningSession;
  enumerators: AppUser[];
}>> {
  if (isLocalTestSessionActive()) {
    const sessions = getLocalTestSessions();
    const enumerators = getLocalTestUsers().filter((user) => user.role === 'enumerator');
    return sessions.map((session) => ({ session, enumerators }));
  }

  const client = requireSupabase();
  const [sessions, assignments, profiles] = await Promise.all([
    getScreeningSessions(),
    client.from('session_assignments').select('session_id, enumerator_id'),
    client.from('profiles')
      .select('id, organization_id, email, full_name, role, district_id, is_active')
      .eq('role', 'enumerator')
      .eq('is_active', true)
      .order('full_name'),
  ]);

  throwIfError(assignments.error);
  throwIfError(profiles.error);

  const enumerators = (profiles.data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    name: row.full_name,
    role: row.role,
    isActive: row.is_active,
    districtId: row.district_id ?? undefined,
  }));

  return sessions.map((session) => {
    const assignedEnumerators: AppUser[] = [];
    const assignedIds = new Set([
      session.ownerId,
      ...(assignments.data ?? [])
        .filter((assignment) => assignment.session_id === session.id)
        .map((assignment) => assignment.enumerator_id),
    ]);
    for (const assignedId of assignedIds) {
      const enumerator = enumerators.find((candidate) => candidate.id === assignedId);
      if (enumerator) assignedEnumerators.push(enumerator);
    }

    return { session, enumerators: assignedEnumerators };
  });
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  if (isLocalTestSessionActive()) {
    return getLocalTestAuditLogs();
  }

  const { data, error } = await requireSupabase()
    .from('audit_logs')
    .select('id, actor_id, action, record_type, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(250);

  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    actor: row.actor_id ?? 'System',
    action: row.action,
    recordType: row.record_type,
    timestamp: row.created_at,
    metadata: JSON.stringify(row.metadata),
  }));
}

export async function createScreeningSession(input: {
  organizationId: string;
  name: string;
  date: string;
  beoName: string;
  headMasterName: string;
  screeningFacultyName: string;
  school: Pick<School, 'id' | 'districtId' | 'talukId'>;
}): Promise<void> {
  const { error } = await requireSupabase().from('screening_sessions').insert({
    organization_id: input.organizationId,
    name: input.name,
    beo_name: input.beoName,
    head_master_name: input.headMasterName,
    screening_faculty_name: input.screeningFacultyName,
    screening_date: input.date,
    school_id: input.school.id,
    district_id: input.school.districtId,
    taluk_id: input.school.talukId,
    status: 'active',
  });

  throwIfError(error);
}

export async function createDistrict(input: {
  organizationId: string;
  name: string;
  code: string;
}): Promise<void> {
  const { error } = await requireSupabase().from('districts').insert({
    organization_id: input.organizationId,
    name: input.name.trim(),
    code: input.code.trim(),
    status: 'active',
  });
  throwIfError(error);
}

export async function createTaluk(input: {
  organizationId: string;
  districtId: string;
  name: string;
}): Promise<void> {
  const { error } = await requireSupabase().from('taluks').insert({
    organization_id: input.organizationId,
    district_id: input.districtId,
    name: input.name.trim(),
    status: 'active',
  });
  throwIfError(error);
}

export async function createSchool(input: {
  organizationId: string;
  districtId: string;
  talukId: string;
  name: string;
  code: string;
}): Promise<void> {
  const { error } = await requireSupabase().from('schools').insert({
    organization_id: input.organizationId,
    district_id: input.districtId,
    taluk_id: input.talukId,
    name: input.name.trim(),
    code: input.code.trim(),
    status: 'active',
  });
  throwIfError(error);
}

export async function assignSchoolOwner(schoolId: string, ownerId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('assign_school_owner', {
    target_school_id: schoolId,
    target_owner_id: ownerId,
  });
  throwIfError(error);
}

export async function assignEnumerator(input: {
  organizationId: string;
  sessionId: string;
  enumeratorId: string;
}): Promise<void> {
  const { error } = await requireSupabase().from('session_assignments').insert({
    organization_id: input.organizationId,
    session_id: input.sessionId,
    enumerator_id: input.enumeratorId,
  });
  throwIfError(error);
}

export async function unassignEnumerator(input: {
  sessionId: string;
  enumeratorId: string;
}): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('session_assignments')
    .delete()
    .eq('session_id', input.sessionId)
    .eq('enumerator_id', input.enumeratorId)
    .select('id')
    .maybeSingle();

  throwIfError(error);
  if (!data) {
    throw new Error('No authorized matching assignment was found.');
  }
}

export async function createStudentScreening(input: {
  organizationId: string;
  userId: string;
  sessionId: string;
  student: StudentRecord;
}, options?: { idempotencyKey?: string }): Promise<string> {
  if (isLocalTestSessionActive()) {
    const session = getLocalTestSessions().find((item) => item.id === input.sessionId);
    const actor = getLocalTestUser();
    if (
      !session ||
      input.userId !== actor.id ||
      (actor.role !== 'organization_admin' && !session.enumerators.includes(actor.id))
    ) {
      throw new Error('The local test session is not assigned to this enumerator.');
    }
    const savedStudents = getLocalTestStudents().filter((student) => student.sessionId === input.sessionId);
    const maxSiNumber = savedStudents.reduce((max, student) => {
      const number = Number(student.siNumber);
      return Number.isInteger(number) ? Math.max(max, number) : max;
    }, 0);
    const siNumber = input.student.siNumber || String(maxSiNumber + 1);
    saveLocalTestStudent({
      ...input.student,
      ownerId: session.ownerId,
      siNumber,
      id: input.student.id || crypto.randomUUID(),
    }, actor.id, session.ownerId);
    return siNumber;
  }

  const client = requireSupabase();
  const idempotencyKey = options?.idempotencyKey ?? crypto.randomUUID();
  const { data: siNumber, error: numberError } = await client.rpc('reserve_student_si_number', {
    target_session_id: input.sessionId,
    target_idempotency_key: idempotencyKey,
  });
  throwIfError(numberError);
  if (!siNumber) {
    throw new Error('A student SI number could not be assigned for this session.');
  }

  const student = { ...input.student, siNumber };
  const { error, status } = await client.from('student_screenings').insert({
    id: idempotencyKey,
    organization_id: input.organizationId,
    session_id: input.sessionId,
    district_id: student.districtId,
    taluk_id: student.talukId,
    school_id: student.schoolId,
    si_number: student.siNumber,
    student_name: student.studentName,
    class_name: student.className,
    section: student.section,
    sex: student.sex,
    date_of_birth: student.dateOfBirth,
    age: student.age,
    height_cm: student.heightCm,
    weight_kg: student.weightKg,
    bmi: student.bmi,
    skeletal_deformity: student.skeletalDeformity,
    skeletal_observation: student.skeletalObservation,
    skin_thickness_mm: student.skinThicknessMm,
    mid_arm_circumference_cm: student.midArmCircumferenceCm,
    additional_remarks: student.additionalRemarks,
    screening_date: student.screeningDate,
    status: 'Pending',
  });

  if (error) {
    if (error.code === '23505') {
      await verifyDuplicateStudentSubmission(
        { ...input, student, idempotencyKey },
        async (organizationId, id) => {
          const { data, error: lookupError, status: lookupStatus } = await client
            .from('student_screenings')
            .select('id, organization_id, created_by, session_id, district_id, taluk_id, school_id, si_number, student_name, class_name, section, sex, date_of_birth, age, height_cm, weight_kg, bmi, skeletal_deformity, skeletal_observation, skin_thickness_mm, mid_arm_circumference_cm, additional_remarks, screening_date, status')
            .eq('organization_id', organizationId)
            .eq('id', id)
            .maybeSingle();
          if (lookupError) {
            const lookupFailure = new Error(lookupError.message);
            Object.assign(lookupFailure, { code: lookupError.code, status: lookupStatus });
            throw lookupFailure;
          }
          return data;
        },
        async (organizationId, siNumber) => {
          const { data, error: lookupError, status: lookupStatus } = await client
            .from('student_screenings')
            .select('id, organization_id, created_by, session_id, district_id, taluk_id, school_id, si_number, student_name, class_name, section, sex, date_of_birth, age, height_cm, weight_kg, bmi, skeletal_deformity, skeletal_observation, skin_thickness_mm, mid_arm_circumference_cm, additional_remarks, screening_date, status')
            .eq('organization_id', organizationId)
            .eq('session_id', input.sessionId)
            .eq('si_number', siNumber)
            .maybeSingle();
          if (lookupError) {
            const lookupFailure = new Error(lookupError.message);
            Object.assign(lookupFailure, { code: lookupError.code, status: lookupStatus });
            throw lookupFailure;
          }
          return data;
        },
      );
      return siNumber;
    }

    const submissionError = new Error(error.message);
    Object.assign(submissionError, { code: error.code, status });
    throw submissionError;
  }
  return siNumber;
}

export async function getDashboardSummary(): Promise<{
  studentCount: number;
  sessionCount: number;
  enumeratorCount: number;
  districtCount: number;
}> {
  if (isLocalTestSessionActive()) {
    return getLocalTestDashboardSummary();
  }

  const client = requireSupabase();
  const [students, sessions, enumerators, districts] = await Promise.all([
    client.from('student_screenings').select('id', { count: 'exact', head: true }),
    client.from('screening_sessions').select('id', { count: 'exact', head: true }),
    client.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'enumerator'),
    client.from('districts').select('id', { count: 'exact', head: true }),
  ]);

  throwIfError(students.error);
  throwIfError(sessions.error);
  throwIfError(enumerators.error);
  throwIfError(districts.error);

  return {
    studentCount: students.count ?? 0,
    sessionCount: sessions.count ?? 0,
    enumeratorCount: enumerators.count ?? 0,
    districtCount: districts.count ?? 0,
  };
}
