import type { PostgrestError } from '@supabase/supabase-js';
import type { AppUser, AuditLog, District, InvitationRole, School, ScreeningSession, StudentRecord, Taluk } from '../types';
import type { Database } from './database.types';
import { requireSupabase } from './supabase';
import { calculateStudentScreeningStatus } from './screeningStatus.js';
import {
  getLocalTestAuditLogs,
  getLocalTestDashboardSummary,
  getLocalTestDistricts,
  getLocalTestOrganizationName,
  getLocalTestSchools,
  getLocalTestSessions,
  getLocalTestStudents,
  getLocalTestTaluks,
  getLocalTestUser,
  isLocalTestSessionActive,
  saveLocalTestStudent,
  updateLocalTestStudent,
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

export class InactiveProfileError extends Error {
  constructor() {
    super('This account is inactive. Contact an organization administrator to restore access.');
    this.name = 'InactiveProfileError';
  }
}

export type ManagedProfile = {
  id: string;
  name: string;
  email: string;
  role: AppUser['role'];
  districtId: string | null;
  isActive: boolean;
};

export async function getProfile(userId: string): Promise<AppUser> {
  if (isLocalTestSessionActive() && userId === getLocalTestUser().id) {
    return getLocalTestUser();
  }

  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, organization_id, email, full_name, role, district_id, is_active')
    .eq('id', userId)
    .maybeSingle();

  throwIfError(error);
  if (!data) {
    throw new Error('Your account is authenticated but has no organization profile. Ask an organization administrator to provision your profile.');
  }
  if (!data.is_active) throw new InactiveProfileError();

  return {
    id: data.id,
    organizationId: data.organization_id,
    email: data.email,
    name: data.full_name,
    role: data.role,
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
    .select('id, name, code, district_id, taluk_id, status')
    .order('name');

  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
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
    .select('id, name, code, district_id, taluk_id, status')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('name');

  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
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
      .select('id, name, district_id, taluk_id, school_id, beo_name, head_master_name, screening_faculty_name, screening_date, status')
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
    enumerators: (assignments ?? [])
      .filter((assignment) => assignment.session_id === row.id)
      .map((assignment) => assignment.enumerator_id),
  }));
}

export async function getStudentRecords(): Promise<StudentRecord[]> {
  if (isLocalTestSessionActive()) {
    return getLocalTestStudents();
  }

  const client = requireSupabase();
  const pageSize = 500;
  const students: StudentRecord[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('student_screenings')
      .select('id, session_id, si_number, student_name, class_name, section, sex, date_of_birth, age, height_cm, weight_kg, bmi, skeletal_deformity, skeletal_observation, skin_thickness_mm, mid_arm_circumference_cm, additional_remarks, district_id, taluk_id, school_id, screening_date, status')
      .order('screening_date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);

    throwIfError(error);
    const page = data ?? [];
    students.push(...page.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      siNumber: row.si_number,
      studentName: row.student_name,
      className: row.class_name,
      section: row.section,
      sex: row.sex,
      dateOfBirth: row.date_of_birth,
      age: row.age,
      heightCm: row.height_cm,
      weightKg: row.weight_kg,
      bmi: row.bmi,
      skeletalDeformity: row.skeletal_deformity,
      skeletalObservation: row.skeletal_observation,
      skinThicknessMm: row.skin_thickness_mm,
      midArmCircumferenceCm: row.mid_arm_circumference_cm,
      additionalRemarks: row.additional_remarks,
      districtId: row.district_id,
      talukId: row.taluk_id,
      schoolId: row.school_id,
      districtName: '',
      talukName: '',
      schoolName: '',
      screeningDate: row.screening_date,
      status: row.status,
    })));

    if (page.length < pageSize) {
      break;
    }
  }

  const districtIds = [...new Set(students.map((student) => student.districtId))];
  const talukIds = [...new Set(students.map((student) => student.talukId))];
  const schoolIds = [...new Set(students.map((student) => student.schoolId))];
  const districtNames = new Map<string, string>();
  const talukNames = new Map<string, string>();
  const schoolNames = new Map<string, string>();

  for (let offset = 0; offset < districtIds.length; offset += pageSize) {
    const { data, error } = await client.from('districts').select('id, name').in('id', districtIds.slice(offset, offset + pageSize));
    throwIfError(error);
    for (const district of data ?? []) districtNames.set(district.id, district.name);
  }
  for (let offset = 0; offset < talukIds.length; offset += pageSize) {
    const { data, error } = await client.from('taluks').select('id, name').in('id', talukIds.slice(offset, offset + pageSize));
    throwIfError(error);
    for (const taluk of data ?? []) talukNames.set(taluk.id, taluk.name);
  }
  for (let offset = 0; offset < schoolIds.length; offset += pageSize) {
    const { data, error } = await client.from('schools').select('id, name').in('id', schoolIds.slice(offset, offset + pageSize));
    throwIfError(error);
    for (const school of data ?? []) schoolNames.set(school.id, school.name);
  }

  return students.map((student) => ({
    ...student,
    districtName: districtNames.get(student.districtId) ?? '',
    talukName: talukNames.get(student.talukId) ?? '',
    schoolName: schoolNames.get(student.schoolId) ?? '',
  }));
}

export async function getStudentRecord(studentId: string): Promise<StudentRecord | null> {
  const students = await getStudentRecords();
  return students.find((student) => student.id === studentId) ?? null;
}

export async function getEnumerators(): Promise<AppUser[]> {
  if (isLocalTestSessionActive()) {
    return [getLocalTestUser()];
  }

  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, organization_id, email, full_name, role, district_id')
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
    districtId: row.district_id ?? undefined,
  }));
}

export async function getOrganizationProfiles(): Promise<ManagedProfile[]> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, full_name, email, role, district_id, is_active')
    .order('full_name');
  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.full_name,
    email: row.email,
    role: row.role,
    districtId: row.district_id,
    isActive: row.is_active,
  }));
}

export async function setProfileActive(profileId: string, isActive: boolean): Promise<void> {
  const { data, error } = await requireSupabase().rpc('set_profile_active', {
    target_profile_id: profileId,
    target_is_active: isActive,
  });
  throwIfError(error);
  if (data !== true) throw new Error('The account status could not be changed.');
}

export async function transferRecordOwnership(input: {
  recordType: 'schools' | 'screening_sessions' | 'student_screenings';
  recordId: string;
  ownerId: string;
}): Promise<void> {
  const { data, error } = await requireSupabase().rpc('transfer_record_ownership', {
    target_record_type: input.recordType,
    target_record_id: input.recordId,
    target_owner_id: input.ownerId,
  });
  throwIfError(error);
  if (data !== true) throw new Error('The record owner could not be changed.');
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

export type OwnerDataGrant = { viewerId: string; ownerId: string };

export async function getOwnerDataGrants(): Promise<OwnerDataGrant[]> {
  const { data, error } = await requireSupabase()
    .from('owner_data_grants')
    .select('viewer_id, owner_id')
    .order('viewer_id');
  throwIfError(error);
  return (data ?? []).map((row) => ({ viewerId: row.viewer_id, ownerId: row.owner_id }));
}

export async function setOwnerDataGrant(viewerId: string, ownerId: string, shouldGrant: boolean): Promise<void> {
  const { data, error } = await requireSupabase().rpc('set_owner_data_grant', {
    target_viewer_id: viewerId,
    target_owner_id: ownerId,
    should_grant: shouldGrant,
  });
  throwIfError(error);
  if (data !== true) throw new Error('Viewer access could not be changed.');
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
    const enumerators = [getLocalTestUser()];
    return sessions.map((session) => ({ session, enumerators }));
  }

  const client = requireSupabase();
  const [sessions, assignments, profiles] = await Promise.all([
    getScreeningSessions(),
    client.from('session_assignments').select('session_id, enumerator_id'),
    client.from('profiles')
      .select('id, organization_id, email, full_name, role, district_id')
      .eq('role', 'enumerator')
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
    districtId: row.district_id ?? undefined,
  }));

  return sessions.map((session) => {
    const assignedEnumerators: AppUser[] = [];
    for (const assignment of assignments.data ?? []) {
      if (assignment.session_id !== session.id) continue;
      const enumerator = enumerators.find((candidate) => candidate.id === assignment.enumerator_id);
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
  siReservationKey?: string;
}): Promise<void> {
  if (isLocalTestSessionActive()) {
    const session = getLocalTestSessions().find((item) => item.id === input.sessionId);
    if (!session || !session.enumerators.includes(input.userId)) {
      throw new Error('The local test session is not assigned to this enumerator.');
    }
    const student = { ...input.student, id: input.student.id || crypto.randomUUID() };
    saveLocalTestStudent({
      ...student,
      status: calculateStudentScreeningStatus(student),
    }, input.userId);
    return;
  }

  const student = input.student;
  const client = requireSupabase();
  const studentId = student.id || crypto.randomUUID();
  const requestedSiNumber = student.siNumber?.trim() || null;
  let reservationId: string | null = null;
  if (requestedSiNumber) {
    if (!input.siReservationKey) throw new Error('Reserve the SI number before saving this screening.');
    const { data, error: reservationError } = await client.rpc('reserve_student_si_number', {
      target_session_id: input.sessionId,
      requested_si_number: requestedSiNumber,
      request_idempotency_key: input.siReservationKey,
      requested_student_id: studentId,
    });
    throwIfError(reservationError);
    if (!data) throw new Error('The SI number could not be reserved.');
    reservationId = data;
  }

  const payload = {
    id: studentId,
    organization_id: input.organizationId,
    session_id: input.sessionId,
    district_id: student.districtId,
    taluk_id: student.talukId,
    school_id: student.schoolId,
    si_number: requestedSiNumber,
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
    si_reservation_id: reservationId,
  };
  const { error } = await client.from('student_screenings').insert(payload);

  if (!error) return;
  if (error.code === '23505') {
    const { data: existing, error: lookupError } = await client.from('student_screenings')
      .select('id, organization_id, session_id, district_id, taluk_id, school_id, si_number, student_name, class_name, section, sex, date_of_birth, age, height_cm, weight_kg, bmi, skeletal_deformity, skeletal_observation, skin_thickness_mm, mid_arm_circumference_cm, additional_remarks, screening_date, created_by')
      .eq('id', studentId)
      .maybeSingle();
    throwIfError(lookupError);
    const matches = existing
      && existing.created_by === input.userId
      && Object.entries(payload).every(([key, value]) => key === 'si_reservation_id' || existing[key as keyof typeof existing] === value);
    if (matches) return;
  }
  throwIfError(error);
}

export async function updateStudentScreening(input: {
  studentId: string;
  userId: string;
  student: StudentRecord;
  siReservationKey?: string;
}): Promise<void> {
  if (isLocalTestSessionActive()) {
    updateLocalTestStudent({
      ...input.student,
      status: calculateStudentScreeningStatus(input.student),
    }, input.userId);
    return;
  }

  const client = requireSupabase();
  const { data: current, error: readError } = await client
    .from('student_screenings')
    .select('id, organization_id, session_id, si_number')
    .eq('id', input.studentId)
    .maybeSingle();
  throwIfError(readError);
  if (!current) throw new Error('The screening record could not be loaded in your authorized scope.');

  const requestedSiNumber = input.student.siNumber?.trim() || null;
  let reservationId: string | null = null;
  if (requestedSiNumber && requestedSiNumber !== current.si_number) {
    if (!input.siReservationKey) throw new Error('Reserve the SI number before saving this screening.');
    const { data: reserved, error: reservationError } = await client.rpc('reserve_student_si_number', {
      target_session_id: current.session_id,
      requested_si_number: requestedSiNumber,
      request_idempotency_key: input.siReservationKey,
      requested_student_id: input.studentId,
    });
    throwIfError(reservationError);
    if (!reserved) throw new Error('The SI number could not be reserved.');
    reservationId = reserved;
  }

  const { data, error } = await client
    .from('student_screenings')
    .update({
      si_number: requestedSiNumber,
      student_name: input.student.studentName,
      class_name: input.student.className,
      section: input.student.section,
      sex: input.student.sex,
      date_of_birth: input.student.dateOfBirth,
      age: input.student.age,
      height_cm: input.student.heightCm,
      weight_kg: input.student.weightKg,
      bmi: input.student.bmi,
      skeletal_deformity: input.student.skeletalDeformity,
      skeletal_observation: input.student.skeletalObservation,
      skin_thickness_mm: input.student.skinThicknessMm,
      mid_arm_circumference_cm: input.student.midArmCircumferenceCm,
      additional_remarks: input.student.additionalRemarks,
      si_reservation_id: reservationId,
    })
    .eq('id', input.studentId)
    .select('id')
    .maybeSingle();

  throwIfError(error);
  if (!data) {
    throw new Error('The screening record could not be updated in your authorized scope.');
  }
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
    client.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'enumerator').eq('is_active', true),
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
