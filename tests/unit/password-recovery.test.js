import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPasswordValidationError } from '../../src/lib/passwordValidation.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readSource = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

test('new password validation rejects empty, short, and mismatched values', () => {
  assert.equal(getPasswordValidationError('', ''), 'Enter a new password.');
  assert.equal(getPasswordValidationError('short', 'short'), 'Your password must be at least 8 characters.');
  assert.equal(getPasswordValidationError('long-enough', ''), 'Confirm your new password.');
  assert.equal(getPasswordValidationError('long-enough', 'different'), 'The passwords do not match.');
  assert.equal(getPasswordValidationError('long-enough', 'long-enough'), null);
});

test('password reset uses the recovery route and updates the authenticated password', () => {
  const authProvider = readSource('src/context/AuthProvider.tsx');
  const app = readSource('src/App.tsx');

  assert.match(authProvider, /resetPasswordForEmail\(email\.trim\(\)\.toLowerCase\(\),\s*\{\s*redirectTo:\s*`\$\{window\.location\.origin\}\/reset-password`/);
  assert.match(authProvider, /event === 'PASSWORD_RECOVERY'/);
  assert.match(authProvider, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(authProvider, /supabase\.auth\.signOut\(\{ scope: 'local' \}\)/);
  assert.match(app, /path="\/reset-password"/);
});

test('recovery state prevents normal role redirects and provides a password setup form', () => {
  const loginPage = readSource('src/pages/LoginPage.tsx');
  const resetPage = readSource('src/pages/ResetPasswordPage.tsx');
  const app = readSource('src/App.tsx');

  assert.match(loginPage, /isPasswordRecoveryActive/);
  assert.match(app, /if \(isPasswordRecoveryActive\)/);
  assert.match(resetPage, /New Password/);
  assert.match(resetPage, /Confirm New Password/);
  assert.match(resetPage, /Show passwords/);
  assert.match(resetPage, /Save New Password/);
});
