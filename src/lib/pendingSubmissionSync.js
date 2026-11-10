import {
  claimNextPendingSubmission,
  getPendingSubmissions,
  updateClaimedSubmission,
} from './pendingSubmissions.js';

const DEFAULT_RETRY_BASE_MS = 1000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;
const LEASE_DURATION_MS = 5 * 60 * 1000;
const LEASE_REFRESH_INTERVAL_MS = 60 * 1000;
const activeRuns = new Map();
const retryTimers = new Map();

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function errorProperties(error) {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const cause = 'cause' in error && error.cause && typeof error.cause === 'object'
    ? errorProperties(error.cause)
    : {};

  return {
    status: 'status' in error && typeof error.status === 'number' ? error.status : cause.status,
    code: 'code' in error && typeof error.code === 'string' ? error.code : cause.code,
    isTypeError: error instanceof TypeError || cause.isTypeError === true,
  };
}

function isRetryableError(error) {
  const { status, code, isTypeError } = errorProperties(error);
  if (status === 0 || status === 408 || status === 429 || (status !== undefined && status >= 500)) {
    return true;
  }
  if (status !== undefined && status >= 400) {
    return false;
  }
  if (code && (/^08/.test(code) || /^40(001|P01)$/.test(code) || /^53/.test(code) || /^57/.test(code) || /^PGRST00[01]$/.test(code))) {
    return true;
  }
  return isTypeError || !isOnline();
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'The submission could not be synchronized.';
}

async function uploadClaimedSubmission(submission, upload, options) {
  const now = options.now ?? Date.now;
  const syncToken = submission.syncToken;
  const refreshLease = () => {
    void updateClaimedSubmission(submission.localId, syncToken, {
      leaseExpiresAt: new Date(now() + LEASE_DURATION_MS).toISOString(),
    }).catch((error) => console.error('Unable to refresh the offline submission lease.', error));
  };
  const leaseInterval = globalThis.setInterval(refreshLease, LEASE_REFRESH_INTERVAL_MS);

  try {
    if (!isOnline()) {
      await updateClaimedSubmission(submission.localId, syncToken, {
        syncStatus: 'pending',
        retryable: true,
        lastError: 'The device went offline before synchronization started.',
      });
      return;
    }

    await upload(submission.data, submission.idempotencyKey);
    await updateClaimedSubmission(submission.localId, syncToken, {
      syncStatus: 'synced',
      syncedAt: new Date(now()).toISOString(),
      retryable: false,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    if (error && typeof error === 'object' && 'conflictType' in error) {
      await updateClaimedSubmission(submission.localId, syncToken, {
        syncStatus: 'conflict',
        retryable: false,
        conflictType: error.conflictType,
        conflictMessage: message,
        ...(error.serverRecord ? { serverRecord: error.serverRecord } : {}),
        lastError: message,
      });
      return;
    }

    if (!isOnline()) {
      await updateClaimedSubmission(submission.localId, syncToken, {
        syncStatus: 'pending',
        retryable: true,
        lastError: message,
      });
      return;
    }

    const retryable = isRetryableError(error);
    const retryBaseMs = options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
    const retryDelay = Math.min(
      retryBaseMs * (2 ** Math.max(0, submission.attemptCount - 1)),
      MAX_RETRY_DELAY_MS,
    );
    await updateClaimedSubmission(submission.localId, syncToken, {
      syncStatus: 'failed',
      retryable,
      ...(retryable ? { nextRetryAt: new Date(now() + retryDelay).toISOString() } : {}),
      lastError: message,
    });
    console.error(`Unable to synchronize offline submission ${submission.localId}.`, error);
  } finally {
    globalThis.clearInterval(leaseInterval);
  }
}

async function scheduleNextRetry(userId, options) {
  const currentTimer = retryTimers.get(userId);
  if (currentTimer) {
    globalThis.clearTimeout(currentTimer);
    retryTimers.delete(userId);
  }
  if (options.scheduleRetries === false || !isOnline()) {
    return;
  }

  const submissions = await getPendingSubmissions(userId);
  const dueTimes = submissions.flatMap((submission) => {
    if (submission.syncStatus === 'failed' && submission.retryable && submission.nextRetryAt) {
      return [Date.parse(submission.nextRetryAt)];
    }
    if (submission.syncStatus === 'syncing' && submission.leaseExpiresAt) {
      return [Date.parse(submission.leaseExpiresAt)];
    }
    return [];
  }).filter(Number.isFinite);

  if (dueTimes.length === 0) {
    return;
  }

  const nextDelay = Math.max(0, Math.min(...dueTimes) - (options.now ?? Date.now)());
  const timer = globalThis.setTimeout(() => {
    retryTimers.delete(userId);
    void syncPendingSubmissions(userId, options).catch((error) => {
      console.error('Unable to retry pending student submissions.', error);
    });
  }, nextDelay);
  retryTimers.set(userId, timer);
}

/**
 * Synchronizes this user's saved records through the active Supabase client.
 * The uploader and clock options allow deterministic storage/sync tests.
 */
export function syncPendingSubmissions(userId, options = {}) {
  const existingRun = activeRuns.get(userId);
  if (existingRun) {
    return existingRun;
  }

  const upload = options.upload;
  if (!upload) {
    return Promise.reject(new Error('An authenticated student submission function is required for synchronization.'));
  }
  const run = (async () => {
    if (!isOnline()) {
      return;
    }

    while (isOnline()) {
      const submission = await claimNextPendingSubmission(
        userId,
        (options.now ?? Date.now)(),
        options.leaseMs ?? LEASE_DURATION_MS,
      );
      if (!submission) {
        break;
      }

      await uploadClaimedSubmission(submission, upload, options);
    }
  })();

  activeRuns.set(userId, run);
  return run.finally(() => {
    activeRuns.delete(userId);
    void scheduleNextRetry(userId, options).catch((error) => {
      console.error('Unable to schedule the next offline submission retry.', error);
    });
  });
}

export function stopPendingSubmissionRetries(userId) {
  const timer = retryTimers.get(userId);
  if (timer) {
    globalThis.clearTimeout(timer);
    retryTimers.delete(userId);
  }
}
