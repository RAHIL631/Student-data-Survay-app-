import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export function acceptInvitationWithClient(
  client: SupabaseClient<Database>,
  invitationId: string,
  fullName: string,
  password: string,
): Promise<{ alreadyAccepted: boolean; outcome: 'pending_approval' | 'approved' }>;

export function finishInvitationSession(client: SupabaseClient<Database>): Promise<void>;
