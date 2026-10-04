/**
 * Member invites (#37, SRS §4.3). An owner invites an email address with a
 * profile; whoever signs in with that VERIFIED email can accept. No Cognito
 * admin calls: people create their own account, then join.
 */

export const INVITE_TTL_DAYS = 14;

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED';

/** Lower-case, trimmed; null when it doesn't look like an email address. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@#]+@[^\s@#]+\.[^\s@#]+$/.test(email) ? email : null;
}

export function inviteExpiry(nowIso: string, days = INVITE_TTL_DAYS): string {
  return new Date(Date.parse(nowIso) + days * 86_400_000).toISOString();
}

export function isInviteOpen(
  invite: { status: string; expiresAt: string },
  nowIso: string
): boolean {
  return invite.status === 'PENDING' && invite.expiresAt > nowIso;
}
