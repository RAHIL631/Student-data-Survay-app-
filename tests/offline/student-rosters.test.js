import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import {
  createStudentRoster,
  getStudentRosters,
  normalizeStudentNames,
  saveStudentRoster,
  markStudentRosterEntryComplete,
} from '../../src/lib/studentRosters.js';
import { extractNamesFromTextFragments } from '../../src/lib/studentRosterPdfText.js';
import { claimNextPendingSubmission, getPendingSubmissions, savePendingSubmission, updateClaimedSubmission } from '../../src/lib/pendingSubmissions.js';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

test('student list normalization removes blank and duplicate names without changing display names', () => {
  assert.deepEqual(normalizeStudentNames(['  Anu  Rao ', '', 'anu rao', 'Rahul Kumar']), ['Anu Rao', 'Rahul Kumar']);
});

test('a selected list name is consumed only after explicit screening completion and remains account scoped', async () => {
  const roster = await saveStudentRoster({
    userId: 'enumerator-one',
    sessionId: 'session-one',
    fileName: 'class-5.pdf',
    names: ['Asha Rao', 'Ravi Kumar'],
  });
  assert.equal(roster.entries.length, 2);

  let stored = await getStudentRosters('enumerator-one', 'session-one');
  assert.deepEqual(stored[0].entries.filter((entry) => !entry.completedAt).map((entry) => entry.name), ['Asha Rao', 'Ravi Kumar']);

  assert.equal(await markStudentRosterEntryComplete('another-user', roster.id, roster.entries[0].id), false);
  assert.equal(await markStudentRosterEntryComplete('enumerator-one', roster.id, roster.entries[0].id), true);

  stored = await getStudentRosters('enumerator-one', 'session-one');
  assert.deepEqual(stored[0].entries.filter((entry) => !entry.completedAt).map((entry) => entry.name), ['Ravi Kumar']);
});

test('student lists require a screening session and cap unique names', () => {
  assert.throws(() => createStudentRoster({ userId: 'enumerator-one', sessionId: '', names: ['Asha'] }), /screening session/);
  assert.throws(() => createStudentRoster({ userId: 'enumerator-one', sessionId: 'session-one', names: Array.from({ length: 5001 }, (_, index) => `Student ${index}`) }), /5,000/);
});

test('PDF text extraction reads the student-name column and skips row numbers and other columns', () => {
  const names = extractNamesFromTextFragments([
    { text: 'SI NO', x: 10, y: 300 },
    { text: 'Student Name', x: 90, y: 300 },
    { text: 'Class', x: 260, y: 300 },
    { text: '1', x: 10, y: 280 },
    { text: 'Asha Rao', x: 90, y: 280 },
    { text: '5', x: 260, y: 280 },
    { text: '2', x: 10, y: 260 },
    { text: 'Ravi Kumar', x: 90, y: 260 },
    { text: '6', x: 260, y: 260 },
  ]);
  assert.deepEqual(names, ['Asha Rao', 'Ravi Kumar']);
});

test('PDF text extraction handles PDF text items that combine a table row into one string', () => {
  const names = extractNamesFromTextFragments([
    { text: 'SI NO Student Name Class', x: 28, y: 813 },
    { text: '1 Asha Rao 5', x: 28, y: 785 },
    { text: '2 Ravi Kumar 6', x: 28, y: 757 },
  ]);
  assert.deepEqual(names, ['Asha Rao', 'Ravi Kumar']);
});

test('PDF text extraction supports simple one-name-per-line lists with serial numbers', () => {
  const names = extractNamesFromTextFragments([
    { text: 'Student Name List', x: 10, y: 300 },
    { text: '1. Asha Rao', x: 10, y: 280 },
    { text: '2. Ravi Kumar', x: 10, y: 260 },
    { text: 'Page 1 of 1', x: 10, y: 10 },
  ]);
  assert.deepEqual(names, ['Asha Rao', 'Ravi Kumar']);
});

test('offline roster names remain held until the related screening syncs', async () => {
  const roster = await saveStudentRoster({ userId: 'enumerator-offline', sessionId: 'session-offline', names: ['Meera Nair'] });
  const entry = roster.entries[0];
  const submission = await savePendingSubmission({
    userId: 'enumerator-offline',
    organizationId: 'organization-offline',
    sessionId: 'session-offline',
    studentRosterId: roster.id,
    studentRosterEntryId: entry.id,
    student: { studentName: entry.name },
  });

  assert.equal((await getStudentRosters('enumerator-offline', 'session-offline'))[0].entries[0].completedAt, null);
  const claimed = await claimNextPendingSubmission('enumerator-offline');
  assert.equal(claimed.localId, submission.localId);
  await updateClaimedSubmission(claimed.localId, claimed.syncToken, { syncStatus: 'synced' });
  const synced = await getPendingSubmissions('enumerator-offline');
  assert.equal(synced[0].data.studentRosterEntryId, entry.id);
  await markStudentRosterEntryComplete('enumerator-offline', roster.id, synced[0].data.studentRosterEntryId);
  assert.ok((await getStudentRosters('enumerator-offline', 'session-offline'))[0].entries[0].completedAt);
});
