import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canAccessRoute } from '../../src/lib/roleAccess.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readSource = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

test('only organization administrators can access staff management', () => {
  assert.equal(canAccessRoute('organization_admin', 'users'), true);
  assert.equal(canAccessRoute('district_manager', 'users'), false);
  assert.equal(canAccessRoute('enumerator', 'users'), false);
  assert.equal(canAccessRoute('unexpected', 'users'), false);

  const app = readSource('src/App.tsx');
  assert.match(app, /path="\/users"\s+element=\{<AdminUsersPage \/>\}/);
  assert.match(app, /canAccessRoute\(user\.role, routeKey\)/);
});

test('dashboard loads current RLS-scoped summary, profiles, and districts with retry UI', () => {
  const page = readSource('src/pages/AdminDashboardPage.tsx');
  assert.match(page, /getDashboardSummary\(\)/);
  assert.match(page, /getOrganizationProfiles\(\)/);
  assert.match(page, /getDistricts\(\)/);
  assert.match(page, /useRemoteData\(load\)/);
  assert.match(page, /onClick=\{reload\}/);
  assert.doesNotMatch(page, /getOwnerDataGrants|setOwnerDataGrant/);
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
