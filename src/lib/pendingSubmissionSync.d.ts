import type { PendingStudentSubmissionData } from '../types';

type SyncOptions = {
  upload: (submission: PendingStudentSubmissionData, idempotencyKey: string) => Promise<void>;
  now?: () => number;
  leaseMs?: number;
  retryBaseMs?: number;
  scheduleRetries?: boolean;
};

export function syncPendingSubmissions(userId: string, options?: SyncOptions): Promise<void>;
export function stopPendingSubmissionRetries(userId: string): void;
