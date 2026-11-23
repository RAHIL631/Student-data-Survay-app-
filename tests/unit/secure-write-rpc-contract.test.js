import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataService = fs.readFileSync(path.join(rootDir, 'src/lib/dataService.ts'), 'utf8');

test('protected application writes use the authorization-checked database RPCs', () => {
  for (const rpc of [
    'create_screening_session_secure',
    'create_school_secure',
    'create_student_screening_secure',
    'update_student_screening_secure',
  ]) {
    assert.match(dataService, new RegExp(`\\.rpc\\('${rpc}'`));
  }

  for (const table of ['screening_sessions', 'schools', 'student_screenings']) {
    assert.doesNotMatch(dataService, new RegExp(`from\\('${table}'\\)\\s*\\.(?:insert|update|upsert)\\(`));
  }
});

test('district, taluk, and assignment mutations remain on their existing RLS paths', () => {
  assert.match(dataService, /from\('districts'\)\.insert\(/);
  assert.match(dataService, /from\('taluks'\)\.insert\(/);
  assert.match(dataService, /from\('session_assignments'\)\.insert\(/);
  assert.match(dataService, /from\('session_assignments'\)\s*\.delete\(/);
});
