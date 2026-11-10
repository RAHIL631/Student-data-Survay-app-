import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const requiredDirectories = [
  'public',
  'src',
  'src/pages',
  'src/components',
  'src/context',
  'src/hooks',
  'src/lib',
  'admin',
  'supabase/migrations',
  'supabase/functions/admin-provision-user',
  'tests',
  'docs',
  '.github',
];

test('required project directories exist', () => {
  for (const dir of requiredDirectories) {
    const target = path.join(rootDir, dir);
    assert.equal(fs.existsSync(target), true, `Missing directory: ${dir}`);
  }
});

test('entry points exist', () => {
  const entryFiles = [
    'index.html',
    'src/main.tsx',
    'src/App.tsx',
    'src/lib/dataService.ts',
    'src/AdminApp.tsx',
    'src/pages/AdminDashboardPage.tsx',
    'src/pages/AdminUsersPage.tsx',
    'src/admin-main.tsx',
    'admin/index.html',
    'admin/src/admin-main.tsx',
    'vite.admin.config.ts',
    'supabase/migrations/002_live_backend.sql',
    'supabase/migrations/003_role_scope_hardening.sql',
    'supabase/functions/admin-provision-user/index.ts',
  ];

  for (const file of entryFiles) {
    const target = path.join(rootDir, file);
    assert.equal(fs.existsSync(target), true, `Missing file: ${file}`);
  }
});

test('local test sign-in is restricted to development builds', () => {
  const localTestMode = fs.readFileSync(path.join(rootDir, 'src/lib/localTestMode.ts'), 'utf8');
  assert.match(localTestMode, /import\.meta\.env\.DEV/);
});

test('demo data and placeholder backend clients are absent', () => {
  const removedFiles = [
    'src/data/mockData.ts',
    'src/lib/localData.ts',
    'src/services/supabase/client.js',
    'src/services/supabase/auth.service.js',
    'src/services/supabase/database.service.js',
  ];

  for (const file of removedFiles) {
    assert.equal(fs.existsSync(path.join(rootDir, file)), false, `Unexpected demo or placeholder file: ${file}`);
  }
});
