import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('password sign in normalizes email before the Supabase request', () => {
  const source = fs.readFileSync(new URL('../../src/context/AuthProvider.tsx', import.meta.url), 'utf8');
  assert.match(source, /const normalizedEmail = email\.trim\(\)\.toLowerCase\(\);/);
  assert.match(source, /signInWithPassword\(\{ email: normalizedEmail, password \}\)/);
});
