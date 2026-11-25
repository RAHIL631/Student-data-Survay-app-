import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readSource = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

test('sign-in normalizes the email before Supabase password authentication', () => {
  const authProvider = readSource('src/context/AuthProvider.tsx');
  assert.match(authProvider, /const normalizedEmail = email\.trim\(\)\.toLowerCase\(\);/);
  assert.match(authProvider, /signInWithPassword\(\{ email: normalizedEmail, password \}\)/);
});

test('authenticated sessions load an active approved profile before granting application access', () => {
  const dataService = readSource('src/lib/dataService.ts');
  const app = readSource('src/App.tsx');
  const permissions = readSource('src/lib/permissions.ts');
  assert.match(dataService, /approval_status === 'pending'/);
  assert.match(dataService, /if \(!data\.is_active\)/);
  assert.match(app, /if \(!user\)\s*\{\s*return <Navigate to="\/login" replace \/>;\s*\}/);
  assert.match(app, /if \(!canAccessRoute\(user\.role, routeKey\)\)/);
  assert.match(permissions, /enumerator: \['dashboard', 'screening-sessions', 'student-registration', 'students', 'reports', 'profile'\]/);
});
