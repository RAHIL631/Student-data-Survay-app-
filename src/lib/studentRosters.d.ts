export type StudentRosterEntry = { id: string; name: string; completedAt: string | null };
export type StudentRoster = {
  id: string;
  userId: string;
  sessionId: string;
  fileName: string;
  createdAt: string;
  entries: StudentRosterEntry[];
};
export function normalizeStudentNames(rawNames: unknown[]): string[];
export function createStudentRoster(input: { userId: string; sessionId: string; fileName?: string; names: unknown[] }): StudentRoster;
export function saveStudentRoster(input: { userId: string; sessionId: string; fileName?: string; names: unknown[] }): Promise<StudentRoster>;
export function getStudentRosters(userId: string, sessionId?: string): Promise<StudentRoster[]>;
export function markStudentRosterEntryComplete(userId: string, rosterId: string, entryId: string): Promise<boolean>;
