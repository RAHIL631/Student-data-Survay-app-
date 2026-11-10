import type { PendingStudentSubmission, PendingStudentSubmissionData } from '../types';

export const PENDING_SUBMISSIONS_CHANGED_EVENT: string;
export function savePendingSubmission(data: PendingStudentSubmissionData): Promise<PendingStudentSubmission>;
export function getPendingSubmissions(userId?: string): Promise<PendingStudentSubmission[]>;
export function claimNextPendingSubmission(userId: string, now?: number, leaseMs?: number): Promise<PendingStudentSubmission | null>;
export function updateClaimedSubmission(localId: string, syncToken: string, updates: Partial<PendingStudentSubmission>): Promise<boolean>;
export function resolveConflictKeepServer(localId: string, userId: string): Promise<boolean>;
export function deletePendingSubmission(localId: string): Promise<void>;
