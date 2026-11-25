export function getInvitationCallbackError(search: string, hash: string): string | null;
export function restoreInvitationSession(
  auth: {
    getSession(): Promise<{ data: { session: { user?: { id?: string } } | null }, error: unknown }>;
    verifyOtp(input: { token_hash: string; type: 'invite' }): Promise<{ data: { session: { user?: { id?: string } } | null }, error: unknown }>;
  },
  href: string,
  options?: { getCurrentUrl?: () => string; replaceUrl?: (url: string) => void },
): Promise<{ session: { user?: { id?: string } } | null; error: string | null }>;
