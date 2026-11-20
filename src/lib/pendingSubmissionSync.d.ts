import type { PendingStudentSubmissionData } from '../types';

type SyncOptions = {
  upload: (submission: PendingStudentSubmissionData, idempotencyKey: string) => Promise<void | string>;
  now?: () => number;
  leaseMs?: number;
  retryBaseMs?: number;
  scheduleRetries?: boolean;
};

export function syncPendingSubmissions(userId: string, options?: SyncOptions): Promise<number>;
export function stopPendingSubmissionRetries(userId: string): void;
export const PENDING_SUBMISSIONS_SYNCED_EVENT: string;
