import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canAccessRoute, canEditStudentScreening } from '../../src/lib/roleAccess.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readSource = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

test('only organization administrators can access staff management', () => {
  assert.equal(canAccessRoute('organization_admin', 'users'), true);
  assert.equal(canAccessRoute('district_manager', 'users'), false);
  assert.equal(canAccessRoute('enumerator', 'users'), false);
  assert.equal(canAccessRoute('enumerator', 'schools'), true);
  assert.equal(canAccessRoute('unexpected', 'users'), false);

  const app = readSource('src/App.tsx');
  assert.match(app, /path="\/users"\s+element=\{<AdminUsersPage \/>\}/);
  assert.match(app, /canAccessRoute\(user\.role, routeKey\)/);
});

test('screening edit affordance follows the database ownership roles', () => {
  const owned = { createdBy: 'enumerator-a', ownerId: 'enumerator-a' };
  const transferred = { createdBy: 'enumerator-a', ownerId: 'enumerator-b' };
  const other = { createdBy: 'enumerator-b', ownerId: 'enumerator-b' };

  assert.equal(canEditStudentScreening('organization_admin', 'admin', other), true);
  assert.equal(canEditStudentScreening('enumerator', 'enumerator-a', owned), true);
  assert.equal(canEditStudentScreening('enumerator', 'enumerator-b', transferred), true);
  assert.equal(canEditStudentScreening('enumerator', 'enumerator-c', other), false);
  assert.equal(canEditStudentScreening('district_manager', 'viewer', owned), false);
});

test('dashboard loads current RLS-scoped summary, profiles, and districts with retry UI', () => {
  const page = readSource('src/pages/AdminDashboardPage.tsx');
  assert.match(page, /getDashboardSummary\(\)/);
  assert.match(page, /getOrganizationProfiles\(\)/);
  assert.match(page, /getDistricts\(\)/);
  assert.match(page, /approvalStatus === 'pending'/);
  assert.match(page, /Awaiting approval/);
  assert.match(page, /useRemoteData\(load\)/);
  assert.match(page, /onClick=\{reload\}/);
  assert.doesNotMatch(page, /getOwnerDataGrants|setOwnerDataGrant/);
});

test('school assignment and Enumerator location writes use the scoped RPC contract', () => {
  const schoolsPage = readSource('src/pages/SchoolsPage.tsx');
  const service = readSource('src/lib/dataService.ts');
  const migration = readSource('supabase/migrations/20261208000000_school_workflow_compatibility.sql');
  assert.match(schoolsPage, /assignSchoolOwner\(assignmentForm\.schoolId, assignmentForm\.ownerId\)/);
  assert.match(schoolsPage, /district\.id === user\?\.districtId/);
  assert.match(service, /rpc\('assign_school_owner'/);
  assert.match(migration, /current_profile_role\(\) <> 'organization_admin'/);
  assert.match(migration, /target_enumerator\.district_id IS DISTINCT FROM target_school\.district_id/);
  assert.match(migration, /s\.owner_id = actor_id AND s\.district_id = actor_district/);
});

test('approval uses the authenticated database RPC and only approved active Enumerators qualify as faculty', () => {
  const activation = readSource('src/components/AccountActivationManagement.tsx');
  const schools = readSource('src/pages/SchoolsPage.tsx');
  const service = readSource('src/lib/dataService.ts');
  const migration = readSource('supabase/migrations/20261206000000_enumerator_approval_contract.sql');

  assert.match(activation, /approveEnumeratorProfile\(profileId\)/);
  assert.match(activation, /onClick=\{\(\) => void approve\(profile\.id\)\}/);
  assert.match(activation, /await reload\(\)/);
  assert.match(service, /rpc\('approve_enumerator_profile',\s*\{\s*target_profile_id: profileId/s);
  assert.match(service, /profile\?\.role === 'enumerator'[\s\S]*profile\.is_active[\s\S]*profile\.approval_status === 'approved'/);
  assert.doesNotMatch(service.slice(service.indexOf('export async function approveEnumeratorProfile'), service.indexOf('export async function setProfileActive')), /functions\.invoke|admin-provision-user/);
  assert.match(schools, /member\.role === 'enumerator'[\s\S]*member\.isActive[\s\S]*member\.approvalStatus === 'approved'[\s\S]*member\.districtId === selectedAssignmentSchool\?\.districtId/);
  assert.match(migration, /public\.current_profile_role\(\) <> 'organization_admin'/);
  assert.match(migration, /target\.organization_id = actor_org|p\.organization_id = actor_org/);
  assert.match(migration, /INSERT INTO public\.audit_logs/);
});

test('staff page uses existing invitation and account activation workflows', () => {
  const page = readSource('src/pages/AdminUsersPage.tsx');
  const invitations = readSource('src/components/InvitationManagement.tsx');
  const viewerAccess = readSource('src/components/ViewerAccessManagement.tsx');
  const activation = readSource('src/components/AccountActivationManagement.tsx');
  const service = readSource('src/lib/dataService.ts');

  assert.match(page, /<InvitationManagement \/>/);
  assert.match(page, /<AccountActivationManagement \/>/);
  assert.match(page, /<ViewerAccessManagement \/>/);
  assert.match(viewerAccess, /getOwnerDataGrants/);
  assert.match(viewerAccess, /setOwnerDataGrant\(targetViewerId, targetOwnerId, shouldGrant\)/);
  assert.match(viewerAccess, /profile\.role === 'district_manager'.*profile\.isActive/s);
  assert.match(viewerAccess, /selectedViewer\?\.districtId === profile\.districtId/);
  assert.match(invitations, /user\?\.role === 'organization_admin'/);
  assert.match(invitations, /createUserInvitation\(/);
  assert.match(invitations, /cancelUserInvitation\(/);
  assert.match(service, /functions\.invoke[^;]*'invite-user'/s);
  assert.match(activation, /setProfileActive\(profileId, nextStatus\)/);
  assert.match(service, /rpc\('set_profile_active'/);
  assert.doesNotMatch(page + invitations, /getOwnerDataGrants|setOwnerDataGrant|admin-provision-user/);
});

test('admin dashboard is the organization administrator home with Viewer role label', () => {
  const page = readSource('src/App.tsx');
  const permissions = readSource('src/lib/permissions.ts');
  assert.match(page, /user\?\.role === 'organization_admin' \? <AdminDashboardPage \/>/);
  assert.match(permissions, /case 'district_manager': return 'Viewer'/);
  assert.match(permissions, /return 'dashboard'/);
});

test('assignment choices are active and restricted to the selected session district', () => {
  const page = readSource('src/pages/AssignmentsPage.tsx');
  const service = readSource('src/lib/dataService.ts');
  assert.match(page, /enumerator\.districtId === selectedSession\.districtId/);
  assert.match(page, /disabled=\{saving \|\| sessionsLoading \|\| enumeratorsLoading/);
  assert.match(page, /Assignment options could not be loaded/);
  assert.match(service, /\.eq\('role', 'enumerator'\)[\s\S]*\.eq\('is_active', true\)/);
});

test('dashboard student total is labeled as records rather than completed screenings', () => {
  const dashboard = readSource('src/pages/DashboardPage.tsx');
  const adminDashboard = readSource('src/pages/AdminDashboardPage.tsx');
  const service = readSource('src/lib/dataService.ts');
  assert.match(dashboard, /label: 'Student records', value: data\.summary\.studentCount/);
  assert.match(adminDashboard, /title: 'Students screened', count: data\.summary\.studentCount/);
  assert.match(service, /studentCount: students\.count \?\? 0/);
  assert.match(service, /from\('student_screenings'\)\.select\('id', \{ count: 'exact', head: true \}\)/);
});

test('inactive member visibility is limited to an active same-organization administrator', () => {
  const migration = readSource('supabase/migrations/20261203000000_admin_inactive_profile_visibility.sql');
  const databaseTest = readSource('supabase/tests/database/active_profile_ownership.test.sql');
  assert.match(migration, /organization_id = public\.current_profile_organization_id\(\)/);
  assert.match(migration, /public\.current_profile_is_active\(\)/);
  assert.match(migration, /public\.current_profile_role\(\) = 'organization_admin'/);
  assert.match(migration, /is_active\s+AND public\.current_profile_role\(\) = 'district_manager'/);
  assert.match(databaseTest, /active administrator can read an inactive member profile to restore access/);
  assert.match(databaseTest, /Viewer cannot read an inactive profile even in the same district/);
});

test('screening edit controls match administrator and Enumerator ownership policies', () => {
  const details = readSource('src/pages/StudentDetailsPage.tsx');
  const registration = readSource('src/pages/StudentRegistrationPage.tsx');
  const service = readSource('src/lib/dataService.ts');
  const ownershipMigration = readSource('supabase/migrations/20261124000000_student_si_reservations.sql');
  assert.match(details, /canEditStudentScreening\(user\?\.role, user\?\.id, student\)/);
  assert.match(registration, /canEditStudentScreening\(user\.role, user\.id, existingStudent\)/);
  assert.match(service, /created_by, owner_id/);
  assert.match(ownershipMigration, /screenings_enumerator_update_own_assigned[\s\S]*created_by = auth\.uid\(\) OR owner_id = auth\.uid\(\)/);
  assert.match(ownershipMigration, /public\.is_assigned_to_session\(session_id\)/);
});
