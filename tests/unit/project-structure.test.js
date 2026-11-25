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
  'supabase/migrations',
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
    'src/pages/AdminDashboardPage.tsx',
    'src/pages/AdminUsersPage.tsx',
    'supabase/migrations/002_live_backend.sql',
    'supabase/migrations/20261206000000_enumerator_approval_contract.sql',
    'supabase/migrations/20261208000000_school_workflow_compatibility.sql',
  ];

  for (const file of entryFiles) {
    const target = path.join(rootDir, file);
    assert.equal(fs.existsSync(target), true, `Missing file: ${file}`);
  }
});

test('administrator views are integrated into the unified frontend', () => {
  const app = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8');
  const layout = fs.readFileSync(path.join(rootDir, 'src/components/Layout.tsx'), 'utf8');
  const permissions = fs.readFileSync(path.join(rootDir, 'src/lib/roleAccess.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

  assert.match(app, /<Route path="\/users" element={<AdminUsersPage \/>} \/>/);
  assert.match(app, /user\?\.role === 'organization_admin' \? <AdminDashboardPage \/> : <DashboardPage \/>/);
  assert.match(layout, /to: '\/users', label: 'Staff & Access'/);
  assert.match(permissions, /organization_admin: Object\.freeze\(\[[\s\S]*'users'/);
  assert.equal(fs.existsSync(path.join(rootDir, 'supabase/functions/admin-provision-user')), false);
  assert.equal(Object.keys(packageJson.scripts).some((script) => script.endsWith(':admin')), false);
  assert.equal(fs.existsSync(path.join(rootDir, 'admin/index.html')), false);
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
