import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import {
  createStudentRoster,
  getStudentRosters,
  markStudentRosterEntryComplete,
  normalizeStudentNames,
  saveStudentRoster,
} from '../../src/lib/studentRosters.js';
import { extractNamesFromTextFragments } from '../../src/lib/studentRosterPdfText.js';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

test('student list normalization removes blank and duplicate names', () => {
  assert.deepEqual(normalizeStudentNames(['  Anu  Rao ', '', 'anu rao', 'Rahul Kumar']), ['Anu Rao', 'Rahul Kumar']);
});

test('roster entries are scoped to the owner and complete only after an explicit successful save', async () => {
  const roster = await saveStudentRoster({ userId: 'enumerator-one', sessionId: 'session-one', names: ['Asha Rao', 'Ravi Kumar'] });
  assert.equal(await markStudentRosterEntryComplete('another-user', roster.id, roster.entries[0].id), false);
  assert.equal(await markStudentRosterEntryComplete('enumerator-one', roster.id, roster.entries[0].id), true);
  const stored = await getStudentRosters('enumerator-one', 'session-one');
  assert.deepEqual(stored[0].entries.filter((entry) => !entry.completedAt).map((entry) => entry.name), ['Ravi Kumar']);
  assert.deepEqual(await getStudentRosters('another-user'), []);
});

test('student lists require a session and cap unique entries', () => {
  assert.throws(() => createStudentRoster({ userId: 'user', sessionId: '', names: ['Asha'] }), /screening session/);
  assert.throws(() => createStudentRoster({ userId: 'user', sessionId: 'session', names: Array.from({ length: 5001 }, (_, index) => `Student ${index}`) }), /5,000/);
});

test('PDF text parsing extracts names from a table and skips row numbers and columns', () => {
  const names = extractNamesFromTextFragments([
    { text: 'SI NO', x: 10, y: 300 }, { text: 'Student Name', x: 90, y: 300 }, { text: 'Class', x: 260, y: 300 },
    { text: '1', x: 10, y: 280 }, { text: 'Asha Rao', x: 90, y: 280 }, { text: '5', x: 260, y: 280 },
    { text: '2', x: 10, y: 260 }, { text: 'Ravi Kumar', x: 90, y: 260 }, { text: '6', x: 260, y: 260 },
  ]);
  assert.deepEqual(names, ['Asha Rao', 'Ravi Kumar']);
});
