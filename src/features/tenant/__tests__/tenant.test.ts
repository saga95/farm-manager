import { toApiError } from '@/lib/api';
import { PASSWORD_PATTERN, codeSchema, registerSchema } from '../authSchemas';
import { decideGate, pickTenant, safeRedirect } from '../selection';
import { setupSchema } from '../setupSchema';

const m = (tenantId: string, tenantName: string) => ({
  tenantId,
  tenantName,
  profileId: 'p',
  profileName: 'Owner',
  entitlements: ['farm.view'],
});

describe('pickTenant', () => {
  const list = [m('b', 'Beta farm'), m('a', 'Alpha farm')];

  it('returns null without memberships', () => {
    expect(pickTenant([], 'a')).toBeNull();
  });
  it('keeps the remembered tenant while the user still belongs to it', () => {
    expect(pickTenant(list, 'b')?.tenantId).toBe('b');
  });
  it('falls back to the first by name when the remembered one is gone', () => {
    expect(pickTenant(list, 'removed')?.tenantId).toBe('a');
    expect(pickTenant(list, null)?.tenantId).toBe('a');
  });
});

describe('decideGate', () => {
  const base = {
    authLoading: false,
    isAuthenticated: true,
    meLoading: false,
    hasTenant: true,
    path: '/farm',
  };

  it('waits while auth loads', () => {
    expect(decideGate({ ...base, authLoading: true })).toEqual({
      kind: 'wait',
    });
  });
  it('sends signed-out users to sign-in with a return path', () => {
    expect(decideGate({ ...base, isAuthenticated: false })).toEqual({
      kind: 'redirect',
      to: '/auth/login?redirect=%2Ffarm',
    });
  });
  it('sends users without a tenant to setup', () => {
    expect(decideGate({ ...base, hasTenant: false })).toEqual({
      kind: 'redirect',
      to: '/setup',
    });
  });
  it('surfaces a failed `me` instead of waiting forever', () => {
    expect(decideGate({ ...base, meLoading: true, meFailed: true })).toEqual({
      kind: 'error',
    });
  });
  it('renders for a member', () => {
    expect(decideGate(base)).toEqual({ kind: 'render' });
  });
});

describe('safeRedirect (no open redirects)', () => {
  it.each([
    ['/coconut/trees', '/coconut/trees'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    [undefined, '/'],
    [['/a'], '/'],
  ])('%p → %p', (input, out) => {
    expect(safeRedirect(input)).toBe(out);
  });
});

describe('auth schemas', () => {
  it('matches the Cognito password policy', () => {
    expect(PASSWORD_PATTERN.test('Coconut#2026')).toBe(true);
    expect(PASSWORD_PATTERN.test('coconut2026')).toBe(false);
    expect(PASSWORD_PATTERN.test('Coc#1')).toBe(false);
  });
  it('requires matching passwords', () => {
    const r = registerSchema({
      email: 'e',
      password: 'p',
      match: 'mismatch',
    }).safeParse({
      email: 'a@b.co',
      password: 'Coconut#2026',
      confirmPassword: 'Coconut#2027',
    });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0]?.message).toBe('mismatch');
  });
  it('accepts only 6-digit codes', () => {
    expect(codeSchema({ code: 'c' }).safeParse(' 123456 ').success).toBe(true);
    expect(codeSchema({ code: 'c' }).safeParse('12345a').success).toBe(false);
  });
});

describe('setupSchema', () => {
  const schema = setupSchema({
    required: 'req',
    tooLong: n => `max ${n}`,
    area: 'area',
  });
  const valid = {
    name: ' Saga Farms ',
    farmName: 'One-acre farm',
    farmArea: '1',
    farmAreaUnit: 'ACRE',
    farmLocationLabel: '',
    defaultTimezone: 'Asia/Colombo',
    defaultCurrency: 'LKR',
    defaultLocale: 'en',
  };

  it('normalises optional fields', () => {
    const r = schema.parse(valid);
    expect(r).toMatchObject({
      name: 'Saga Farms',
      farmArea: 1,
      farmLocationLabel: null,
    });
    expect(schema.parse({ ...valid, farmArea: '' }).farmArea).toBeNull();
  });
  it('rejects empty names and non-positive areas', () => {
    expect(schema.safeParse({ ...valid, name: '  ' }).success).toBe(false);
    expect(schema.safeParse({ ...valid, farmArea: '-2' }).success).toBe(false);
    expect(schema.safeParse({ ...valid, farmArea: 'abc' }).success).toBe(false);
  });
});

describe('toApiError', () => {
  it('maps farm-api error codes', () => {
    const e = toApiError('FORBIDDEN: Not allowed');
    expect(e.code).toBe('FORBIDDEN');
    expect(e.message).toBe('Not allowed');
  });
  it('maps AppSync auth failures and unknown messages', () => {
    expect(toApiError('Not Authorized to access me on type Query').code).toBe(
      'UNAUTHENTICATED'
    );
    expect(toApiError('boom').code).toBe('INTERNAL');
  });
});
