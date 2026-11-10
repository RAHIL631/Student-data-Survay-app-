import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {
  claimNextPendingSubmission,
  deletePendingSubmission,
  getPendingSubmissions,
  resolveConflictKeepServer,
  savePendingSubmission,
} from '../../src/lib/pendingSubmissions.js';
import {
  stopPendingSubmissionRetries,
  syncPendingSubmissions,
} from '../../src/lib/pendingSubmissionSync.js';
import {
  DuplicateStudentSubmissionError,
  verifyDuplicateStudentSubmission,
} from '../../src/lib/studentSubmissionIdempotency.js';

const submissionData = {
  organizationId: 'organization-1',
  userId: 'enumerator-1',
  sessionId: 'session-1',
  student: {
    id: '',
    sessionId: 'session-1',
    siNumber: 'SI-100',
    studentName: 'Test Student',
    className: '5',
    section: 'A',
    sex: 'Prefer not to specify',
    dateOfBirth: '2015-01-01',
    age: 10,
    heightCm: 130,
    weightKg: 28,
    bmi: 16.57,
    skeletalDeformity: 'Not assessed',
    skeletalObservation: '',
    skinThicknessMm: null,
    midArmCircumferenceCm: null,
    additionalRemarks: '',
    districtId: 'district-1',
    talukId: 'taluk-1',
    schoolId: 'school-1',
    screeningDate: '2025-01-01',
    status: 'Pending',
  },
};

function makeSavedRow(data, overrides = {}) {
  const { student } = data;
  return {
    organization_id: data.organizationId,
    created_by: data.userId,
    session_id: data.sessionId,
    district_id: student.districtId,
    taluk_id: student.talukId,
    school_id: student.schoolId,
    si_number: student.siNumber,
    student_name: student.studentName,
    class_name: student.className,
    section: student.section,
    sex: student.sex,
    date_of_birth: student.dateOfBirth,
    age: student.age,
    height_cm: String(student.heightCm),
    weight_kg: String(student.weightKg),
    bmi: String(student.bmi),
    skeletal_deformity: student.skeletalDeformity,
    skeletal_observation: student.skeletalObservation,
    skin_thickness_mm: student.skinThicknessMm === null ? null : String(student.skinThicknessMm),
    mid_arm_circumference_cm: student.midArmCircumferenceCm === null ? null : String(student.midArmCircumferenceCm),
    additional_remarks: student.additionalRemarks,
    screening_date: student.screeningDate,
    status: student.status,
    ...overrides,
  };
}

test('saving a pending submission persists its local ID, payload, timestamp, and status', async () => {
  const saved = await savePendingSubmission(submissionData);

  assert.match(saved.localId, /^[0-9a-f-]{36}$/i);
  assert.match(saved.idempotencyKey, /^[0-9a-f-]{36}$/i);
  assert.deepEqual(saved.data, submissionData);
  assert.ok(Number.isFinite(Date.parse(saved.createdAt)));
  assert.equal(saved.syncStatus, 'pending');

  await deletePendingSubmission(saved.localId);
});

test('pending submissions can be retrieved, including by enumerator', async () => {
  const saved = await savePendingSubmission(submissionData);

  try {
    const allPending = await getPendingSubmissions();
    const userPending = await getPendingSubmissions(submissionData.userId);

    assert.ok(allPending.some((record) => record.localId === saved.localId));
    assert.ok(userPending.some((record) => record.localId === saved.localId));
    assert.deepEqual(userPending[0].data, submissionData);
    assert.equal(userPending[0].idempotencyKey, saved.idempotencyKey);
  } finally {
    await deletePendingSubmission(saved.localId);
  }
});

test('pending submissions can be deleted by local ID', async () => {
  const saved = await savePendingSubmission(submissionData);

  await deletePendingSubmission(saved.localId);

  const pending = await getPendingSubmissions();
  assert.equal(pending.some((record) => record.localId === saved.localId), false);
});

test('a confirmed upload marks the stored submission as synced without deleting it', async () => {
  const saved = await savePendingSubmission(submissionData);
  let uploadedData;
  let uploadedIdempotencyKey;

  try {
    await syncPendingSubmissions(submissionData.userId, {
      scheduleRetries: false,
      upload: async (data, idempotencyKey) => {
        uploadedData = data;
        uploadedIdempotencyKey = idempotencyKey;
      },
    });

    const stored = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.deepEqual(uploadedData, submissionData);
    assert.equal(uploadedIdempotencyKey, saved.idempotencyKey);
    assert.equal(stored.syncStatus, 'synced');
    assert.ok(Number.isFinite(Date.parse(stored.syncedAt)));
  } finally {
    stopPendingSubmissionRetries(submissionData.userId);
    await deletePendingSubmission(saved.localId);
  }
});

test('temporary server errors retry with backoff and eventually sync', async () => {
  const saved = await savePendingSubmission(submissionData);
  const now = { value: Date.now() };
  let uploadCount = 0;
  const usedKeys = [];
  const options = {
    scheduleRetries: false,
    now: () => now.value,
    retryBaseMs: 100,
    upload: async (_data, idempotencyKey) => {
      uploadCount += 1;
      usedKeys.push(idempotencyKey);
      if (uploadCount === 1) {
        const error = new Error('Temporary server error');
        error.status = 503;
        throw error;
      }
    },
  };

  try {
    await syncPendingSubmissions(submissionData.userId, options);
    let stored = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.equal(stored.syncStatus, 'failed');
    assert.equal(stored.retryable, true);
    assert.equal(Date.parse(stored.nextRetryAt), now.value + 100);

    now.value += 101;
    await syncPendingSubmissions(submissionData.userId, options);
    stored = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.equal(uploadCount, 2);
    assert.deepEqual(usedKeys, [saved.idempotencyKey, saved.idempotencyKey]);
    assert.equal(stored.syncStatus, 'synced');
  } finally {
    stopPendingSubmissionRetries(submissionData.userId);
    await deletePendingSubmission(saved.localId);
  }
});

test('a lost success response is safely acknowledged by retrying the same idempotency key', async () => {
  const saved = await savePendingSubmission(submissionData);
  const savedRows = new Map();
  const usedKeys = [];
  let lostResponse = true;
  let now = Date.now();

  try {
    const upload = async (data, idempotencyKey) => {
      usedKeys.push(idempotencyKey);
      if (savedRows.has(idempotencyKey)) {
        const existing = savedRows.get(idempotencyKey);
        await verifyDuplicateStudentSubmission(
          { ...data, idempotencyKey },
          async (organizationId, id) => {
            assert.equal(organizationId, data.organizationId);
            assert.equal(id, idempotencyKey);
            return existing;
          },
          async () => null,
        );
        return;
      }

      savedRows.set(idempotencyKey, makeSavedRow(data, { id: idempotencyKey }));
      if (lostResponse) {
        lostResponse = false;
        throw new TypeError('Connection dropped after the server saved the record.');
      }
    };

    const options = { scheduleRetries: false, now: () => now, retryBaseMs: 100, upload };
    await syncPendingSubmissions(submissionData.userId, options);
    let stored = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.equal(stored.syncStatus, 'failed');
    assert.equal(stored.retryable, true);

    now += 101;
    await syncPendingSubmissions(submissionData.userId, options);
    stored = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.equal(stored.syncStatus, 'synced');
    assert.equal(savedRows.size, 1);
    assert.deepEqual(usedKeys, [saved.idempotencyKey, saved.idempotencyKey]);
  } finally {
    stopPendingSubmissionRetries(submissionData.userId);
    await deletePendingSubmission(saved.localId);
  }
});

test('duplicate primary-key response is acknowledged only when the persisted row matches', async () => {
  const saved = await savePendingSubmission(submissionData);
  const input = { ...submissionData, idempotencyKey: saved.idempotencyKey };
  let siLookupCount = 0;

  try {
    await verifyDuplicateStudentSubmission(
      input,
      async (organizationId, id) => {
        assert.equal(organizationId, submissionData.organizationId);
        assert.equal(id, saved.idempotencyKey);
        return makeSavedRow(submissionData);
      },
      async () => {
        siLookupCount += 1;
        return null;
      },
    );
    assert.equal(siLookupCount, 0);

    await assert.rejects(
      verifyDuplicateStudentSubmission(
        input,
        async () => makeSavedRow(submissionData, { student_name: 'Different student' }),
        async () => null,
      ),
      (error) => error instanceof DuplicateStudentSubmissionError &&
        error.code === 'IDEMPOTENCY_KEY_CONFLICT' &&
        error.conflictType === 'server_record_changed' &&
        error.serverRecord.studentName === 'Different student',
    );
  } finally {
    await deletePendingSubmission(saved.localId);
  }
});

test('duplicate SI number is acknowledged only for the same saved submission', async () => {
  const saved = await savePendingSubmission(submissionData);
  const input = { ...submissionData, idempotencyKey: saved.idempotencyKey };

  try {
    await verifyDuplicateStudentSubmission(
      input,
      async () => null,
      async (organizationId, siNumber) => {
        assert.equal(organizationId, submissionData.organizationId);
        assert.equal(siNumber, submissionData.student.siNumber);
        return makeSavedRow(submissionData, { id: 'existing-different-primary-key' });
      },
    );

    await assert.rejects(
      verifyDuplicateStudentSubmission(
        input,
        async () => null,
        async () => makeSavedRow(submissionData, { student_name: 'Different student' }),
      ),
      (error) => error instanceof DuplicateStudentSubmissionError &&
        error.code === 'STUDENT_SI_NUMBER_CONFLICT' &&
        error.conflictType === 'si_number_conflict',
    );

    await assert.rejects(
      verifyDuplicateStudentSubmission(input, async () => null, async () => null),
      (error) => error instanceof DuplicateStudentSubmissionError &&
        error.code === 'DUPLICATE_NOT_VERIFIABLE' &&
        error.conflictType === 'duplicate_unverified',
    );
  } finally {
    await deletePendingSubmission(saved.localId);
  }
});

test('online duplicate SI responses are acknowledged only when all saved fields match', async () => {
  await verifyDuplicateStudentSubmission(
    submissionData,
    async () => {
      assert.fail('Online submissions without an idempotency key must not query by row ID.');
    },
    async () => makeSavedRow(submissionData),
  );

  await assert.rejects(
    verifyDuplicateStudentSubmission(
      submissionData,
      async () => null,
      async () => makeSavedRow(submissionData, { session_id: 'another-session' }),
    ),
    (error) => error instanceof DuplicateStudentSubmissionError && error.code === 'STUDENT_SI_NUMBER_CONFLICT',
  );
});

test('a same-key server record changed after submission becomes a preserved conflict', async () => {
  const saved = await savePendingSubmission(submissionData);

  try {
    await syncPendingSubmissions(submissionData.userId, {
      scheduleRetries: false,
      upload: async () => {
        await verifyDuplicateStudentSubmission(
          { ...submissionData, idempotencyKey: saved.idempotencyKey },
          async () => makeSavedRow(submissionData, {
            id: saved.idempotencyKey,
            student_name: 'Updated on server',
            height_cm: '132',
          }),
          async () => null,
        );
      },
    });

    const stored = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.equal(stored.syncStatus, 'conflict');
    assert.equal(stored.conflictType, 'server_record_changed');
    assert.equal(stored.serverRecord.studentName, 'Updated on server');
    assert.deepEqual(stored.data, submissionData);

    const next = await claimNextPendingSubmission(submissionData.userId, Date.now(), 1000);
    assert.equal(next, null);
  } finally {
    stopPendingSubmissionRetries(submissionData.userId);
    await deletePendingSubmission(saved.localId);
  }
});

test('a different student using the SI number becomes a conflict and can be explicitly resolved without deleting local data', async () => {
  const saved = await savePendingSubmission(submissionData);

  try {
    await syncPendingSubmissions(submissionData.userId, {
      scheduleRetries: false,
      upload: async () => {
        await verifyDuplicateStudentSubmission(
          { ...submissionData, idempotencyKey: saved.idempotencyKey },
          async () => null,
          async () => makeSavedRow(submissionData, {
            id: 'existing-student-id',
            student_name: 'Different student',
          }),
        );
      },
    });

    let stored = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.equal(stored.syncStatus, 'conflict');
    assert.equal(stored.conflictType, 'si_number_conflict');
    assert.equal(stored.serverRecord.studentName, 'Different student');
    assert.match(stored.conflictMessage, /already belongs to a different student/);

    assert.equal(await resolveConflictKeepServer(saved.localId, 'another-user'), false);
    assert.equal(await resolveConflictKeepServer(saved.localId, submissionData.userId), true);

    stored = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.equal(stored.syncStatus, 'resolved');
    assert.equal(stored.resolution, 'keep_server');
    assert.deepEqual(stored.data, submissionData);
    assert.ok(Number.isFinite(Date.parse(stored.resolvedAt)));
  } finally {
    stopPendingSubmissionRetries(submissionData.userId);
    await deletePendingSubmission(saved.localId);
  }
});

test('temporary failures are retried automatically after the backoff delay', async () => {
  const saved = await savePendingSubmission(submissionData);
  let uploadCount = 0;

  try {
    await syncPendingSubmissions(submissionData.userId, {
      retryBaseMs: 20,
      upload: async () => {
        uploadCount += 1;
        if (uploadCount === 1) {
          const error = new Error('Temporary server error');
          error.status = 503;
          throw error;
        }
      },
    });

    const deadline = Date.now() + 2000;
    let stored;
    while (Date.now() < deadline) {
      stored = (await getPendingSubmissions(submissionData.userId))
        .find((record) => record.localId === saved.localId);
      if (stored.syncStatus === 'synced') {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    assert.equal(uploadCount, 2);
    assert.equal(stored.syncStatus, 'synced');
  } finally {
    stopPendingSubmissionRetries(submissionData.userId);
    await deletePendingSubmission(saved.localId);
  }
});

test('network loss during upload preserves the pending record for the next online event', async () => {
  const saved = await savePendingSubmission(submissionData);
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
    await syncPendingSubmissions(submissionData.userId, {
      scheduleRetries: false,
      upload: async () => {
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
        throw new TypeError('Network connection lost');
      },
    });

    const afterDisconnect = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.equal(afterDisconnect.syncStatus, 'pending');
    assert.equal(afterDisconnect.retryable, true);
    assert.equal(afterDisconnect.lastError, 'Network connection lost');

    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
    await syncPendingSubmissions(submissionData.userId, {
      scheduleRetries: false,
      upload: async () => {},
    });
    const afterReconnect = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.equal(afterReconnect.syncStatus, 'synced');
  } finally {
    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    } else {
      delete globalThis.navigator;
    }
    stopPendingSubmissionRetries(submissionData.userId);
    await deletePendingSubmission(saved.localId);
  }
});

test('concurrent sync triggers do not upload the same submission twice', async () => {
  const saved = await savePendingSubmission(submissionData);
  let uploadCount = 0;

  try {
    const options = {
      scheduleRetries: false,
      upload: async () => {
        uploadCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
      },
    };
    await Promise.all([
      syncPendingSubmissions(submissionData.userId, options),
      syncPendingSubmissions(submissionData.userId, options),
    ]);

    assert.equal(uploadCount, 1);
    const stored = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.equal(stored.syncStatus, 'synced');
  } finally {
    stopPendingSubmissionRetries(submissionData.userId);
    await deletePendingSubmission(saved.localId);
  }
});

test('permanent authorization errors remain failed without retry', async () => {
  const saved = await savePendingSubmission(submissionData);

  try {
    await syncPendingSubmissions(submissionData.userId, {
      scheduleRetries: false,
      upload: async () => {
        const error = new Error('Not authorized');
        error.status = 403;
        throw error;
      },
    });

    const stored = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.equal(stored.syncStatus, 'failed');
    assert.equal(stored.retryable, false);
    assert.equal(stored.nextRetryAt, undefined);
  } finally {
    stopPendingSubmissionRetries(submissionData.userId);
    await deletePendingSubmission(saved.localId);
  }
});

test('a crashed syncing record is reclaimed after its persisted lease expires', async () => {
  const saved = await savePendingSubmission(submissionData);
  const startTime = Date.now();
  const claimed = await claimNextPendingSubmission(submissionData.userId, startTime, 100);
  assert.equal(claimed.localId, saved.localId);

  try {
    await syncPendingSubmissions(submissionData.userId, {
      scheduleRetries: false,
      now: () => startTime + 101,
      upload: async () => {},
    });

    const stored = (await getPendingSubmissions(submissionData.userId))
      .find((record) => record.localId === saved.localId);
    assert.equal(stored.syncStatus, 'synced');
  } finally {
    await deletePendingSubmission(saved.localId);
  }
});

test('separate workers cannot claim the same record at the same time', async () => {
  const saved = await savePendingSubmission(submissionData);

  try {
    const claims = await Promise.all([
      claimNextPendingSubmission(submissionData.userId, Date.now(), 60_000),
      claimNextPendingSubmission(submissionData.userId, Date.now(), 60_000),
    ]);

    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(claims.filter((claim) => claim?.localId === saved.localId).length, 1);
  } finally {
    await deletePendingSubmission(saved.localId);
  }
});
