import { inviteExpiry, isInviteOpen, normalizeEmail } from '../invites';

describe('invites (#37)', () => {
  it('normalizes emails and rejects junk', () => {
    expect(normalizeEmail('  Helper@Example.COM ')).toBe('helper@example.com');
    expect(normalizeEmail('not an email')).toBeNull();
    expect(normalizeEmail('a#b@x.lk')).toBeNull();
  });

  it('expires after 14 days; accepted or revoked invites are closed', () => {
    const now = '2026-10-05T00:00:00.000Z';
    const expiresAt = inviteExpiry(now);
    expect(expiresAt).toBe('2026-10-19T00:00:00.000Z');
    expect(isInviteOpen({ status: 'PENDING', expiresAt }, now)).toBe(true);
    expect(
      isInviteOpen({ status: 'PENDING', expiresAt }, '2026-10-20T00:00:00.000Z')
    ).toBe(false);
    expect(isInviteOpen({ status: 'REVOKED', expiresAt }, now)).toBe(false);
  });
});
