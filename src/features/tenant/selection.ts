import type { Membership } from '@/lib/api';

export const TENANT_STORAGE_KEY = 'farm:currentTenantId';

/**
 * Choose the active tenant: the remembered one if the user still belongs to it,
 * otherwise the first membership (sorted by name for a stable default).
 */
export function pickTenant(
  memberships: readonly Membership[],
  rememberedId: string | null
): Membership | null {
  if (memberships.length === 0) return null;
  const remembered = rememberedId
    ? memberships.find(m => m.tenantId === rememberedId)
    : undefined;
  if (remembered) return remembered;
  return (
    [...memberships].sort((a, b) =>
      a.tenantName.localeCompare(b.tenantName)
    )[0] ?? null
  );
}

export type GateDecision =
  | { kind: 'wait' }
  | { kind: 'error' }
  | { kind: 'redirect'; to: string }
  | { kind: 'render' };

/**
 * Where an authenticated app page should send the user (pure, unit-tested).
 * - signed out → /auth/login?redirect=<path>
 * - signed in without any tenant → /setup
 */
export function decideGate(input: {
  authLoading: boolean;
  isAuthenticated: boolean;
  meLoading: boolean;
  meFailed?: boolean;
  hasTenant: boolean;
  path: string;
}): GateDecision {
  if (input.authLoading) return { kind: 'wait' };
  if (!input.isAuthenticated) {
    return {
      kind: 'redirect',
      to: `/auth/login?redirect=${encodeURIComponent(input.path)}`,
    };
  }
  if (input.meFailed) return { kind: 'error' };
  if (input.meLoading) return { kind: 'wait' };
  if (!input.hasTenant) return { kind: 'redirect', to: '/setup' };
  return { kind: 'render' };
}

/** Only allow same-site relative redirects (prevents open-redirects via ?redirect=). */
export function safeRedirect(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback;
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\')
  )
    return fallback;
  return value;
}
