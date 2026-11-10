const DATABASE_NAME = 'student-health-hub-offline';
const DATABASE_VERSION = 1;
const STORE_NAME = 'pendingSubmissions';
export const PENDING_SUBMISSIONS_CHANGED_EVENT = 'student-health-hub:pending-submissions-changed';

/**
 * @typedef {import('../types').PendingStudentSubmission} PendingStudentSubmission
 * @typedef {import('../types').PendingStudentSubmissionData} PendingStudentSubmissionData
 */

function openDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('Offline storage is unavailable in this browser.'));
  }

  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'localId' });
        store.createIndex('userId', 'data.userId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error('Unable to open offline storage.'));
    request.onblocked = () => reject(new Error('Offline storage is blocked by another open app window.'));
  });
}

function withStore(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;

    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Offline storage operation failed.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Offline storage operation was cancelled.'));
    };

    try {
      result = operation(store);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  }));
}

function notifyPendingSubmissionsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PENDING_SUBMISSIONS_CHANGED_EVENT));
  }
}

/**
 * @param {PendingStudentSubmissionData} data
 * @returns {Promise<PendingStudentSubmission>}
 */
export function savePendingSubmission(data) {
  const submission = {
    localId: globalThis.crypto.randomUUID(),
    idempotencyKey: globalThis.crypto.randomUUID(),
    data,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
    attemptCount: 0,
  };

  return withStore('readwrite', (store) => {
    store.add(submission);
    return submission;
  }).then((saved) => {
    notifyPendingSubmissionsChanged();
    return saved;
  });
}

/**
 * @param {string} [userId]
 * @returns {Promise<PendingStudentSubmission[]>}
 */
export function getPendingSubmissions(userId) {
  return withStore('readonly', (store) => {
    const request = userId
      ? store.index('userId').getAll(userId)
      : store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result.sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
      request.onerror = () => reject(request.error ?? new Error('Unable to read offline submissions.'));
    });
  });
}

/**
 * Atomically claims one due record so another tab cannot upload it concurrently.
 * @param {string} userId
 * @param {number} now
 * @param {number} leaseMs
 * @returns {Promise<PendingStudentSubmission | null>}
 */
export function claimNextPendingSubmission(userId, now, leaseMs) {
  return withStore('readwrite', (store) => new Promise((resolve, reject) => {
    const request = store.index('userId').getAll(userId);

    request.onsuccess = () => {
      const currentTime = now ?? Date.now();
      const leaseDuration = leaseMs ?? 5 * 60 * 1000;
      const dueSubmission = request.result
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .find((submission) => {
          if (submission.syncStatus === 'pending') {
            return true;
          }
          if (submission.syncStatus === 'failed') {
            return submission.retryable === true &&
              (!submission.nextRetryAt || Date.parse(submission.nextRetryAt) <= currentTime);
          }
          return submission.syncStatus === 'syncing' &&
            Date.parse(submission.leaseExpiresAt ?? '') <= currentTime;
        });

      if (!dueSubmission) {
        resolve(null);
        return;
      }

      const claimed = {
        ...dueSubmission,
        idempotencyKey: dueSubmission.idempotencyKey ?? globalThis.crypto.randomUUID(),
        syncStatus: 'syncing',
        attemptCount: (dueSubmission.attemptCount ?? 0) + 1,
        syncToken: globalThis.crypto.randomUUID(),
        leaseExpiresAt: new Date(currentTime + leaseDuration).toISOString(),
      };
      delete claimed.nextRetryAt;
      delete claimed.lastError;
      delete claimed.retryable;
      store.put(claimed);
      resolve(claimed);
    };

    request.onerror = () => reject(request.error ?? new Error('Unable to claim an offline submission.'));
  })).then((claimed) => {
    if (claimed) {
      notifyPendingSubmissionsChanged();
    }
    return claimed;
  });
}

/**
 * Applies an update only if this worker still owns the claim.
 * @param {string} localId
 * @param {string} syncToken
 * @param {Partial<PendingStudentSubmission>} updates
 * @returns {Promise<boolean>}
 */
export function updateClaimedSubmission(localId, syncToken, updates) {
  return withStore('readwrite', (store) => new Promise((resolve, reject) => {
    const request = store.get(localId);
    request.onsuccess = () => {
      const submission = request.result;
      if (!submission || submission.syncStatus !== 'syncing' || submission.syncToken !== syncToken) {
        resolve(false);
        return;
      }

      const updated = { ...submission, ...updates };
      if (updates.syncStatus !== 'syncing') {
        delete updated.syncToken;
        delete updated.leaseExpiresAt;
      }
      store.put(updated);
      resolve(true);
    };
    request.onerror = () => reject(request.error ?? new Error('Unable to update an offline submission.'));
  })).then((updated) => {
    if (updated) {
      notifyPendingSubmissionsChanged();
    }
    return updated;
  });
}

/**
 * Explicitly acknowledges the server version while retaining the offline payload locally.
 * @param {string} localId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export function resolveConflictKeepServer(localId, userId) {
  return withStore('readwrite', (store) => new Promise((resolve, reject) => {
    const request = store.get(localId);
    request.onsuccess = () => {
      const submission = request.result;
      if (!submission || submission.data.userId !== userId || submission.syncStatus !== 'conflict') {
        resolve(false);
        return;
      }

      store.put({
        ...submission,
        syncStatus: 'resolved',
        resolution: 'keep_server',
        resolvedAt: new Date().toISOString(),
      });
      resolve(true);
    };
    request.onerror = () => reject(request.error ?? new Error('Unable to resolve the offline submission conflict.'));
  })).then((resolved) => {
    if (resolved) {
      notifyPendingSubmissionsChanged();
    }
    return resolved;
  });
}

/**
 * @param {string} localId
 * @returns {Promise<void>}
 */
export function deletePendingSubmission(localId) {
  return withStore('readwrite', (store) => {
    store.delete(localId);
  }).then(() => notifyPendingSubmissionsChanged());
}
