/**
 * defineOperation: one place for identity, validation, tenant authorization
 * and error mapping (ADR-0001 Consequences). Every AppSync field is declared
 * with this so a missing entitlement check is impossible by construction.
 */

import type { AppSyncIdentityCognito, AppSyncResolverEvent } from 'aws-lambda';
import { ZodError, type ZodType } from 'zod';
import {
  type Entitlement,
  RbacError,
  requireEntitlement,
} from '../../../../src/domain/rbac';
import { ApiError, forbidden } from './errors';
import { type TenantAccess, loadTenantAccess } from './authorize';

export interface UserContext {
  userId: string;
  email: string | undefined;
  /** Request time (ISO). Passed in so handlers stay deterministic in tests. */
  now: string;
}

export interface TenantContext extends UserContext {
  access: TenantAccess;
}

type Handler<I, O, C> = (input: I, ctx: C) => Promise<O>;

export type Operation =
  | {
      kind: 'user';
      name: string;
      run: (
        event: AppSyncResolverEvent<Record<string, unknown>>,
        now: string
      ) => Promise<unknown>;
    }
  | {
      kind: 'tenant';
      name: string;
      entitlement: Entitlement;
      run: (
        event: AppSyncResolverEvent<Record<string, unknown>>,
        now: string
      ) => Promise<unknown>;
    };

function userFrom(
  event: AppSyncResolverEvent<Record<string, unknown>>,
  now: string
): UserContext {
  const identity = event.identity as AppSyncIdentityCognito | null | undefined;
  const sub = identity?.sub;
  if (!sub) throw new ApiError('UNAUTHENTICATED', 'Sign in required');
  const email = (identity.claims as Record<string, unknown> | undefined)?.[
    'email'
  ];
  return {
    userId: sub,
    email: typeof email === 'string' ? email : undefined,
    now,
  };
}

function parse<I>(schema: ZodType<I>, args: unknown): I {
  try {
    return schema.parse(args ?? {});
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      throw new ApiError(
        'VALIDATION',
        first
          ? `${first.path.join('.') || 'input'}: ${first.message}`
          : 'Invalid input'
      );
    }
    throw e;
  }
}

/** An operation that needs a signed-in user but no tenant membership (me, createTenant). */
export function userOperation<I, O>(def: {
  name: string;
  input: ZodType<I>;
  handler: Handler<I, O, UserContext>;
}): Operation {
  return {
    kind: 'user',
    name: def.name,
    run: async (event, now) =>
      def.handler(parse(def.input, event.arguments), userFrom(event, now)),
  };
}

/**
 * A tenant-scoped operation. The input MUST contain `tenantId`; it is verified
 * against the caller's membership and the declared entitlement before the handler runs.
 */
export function tenantOperation<I extends { tenantId: string }, O>(def: {
  name: string;
  entitlement: Entitlement;
  input: ZodType<I>;
  handler: Handler<I, O, TenantContext>;
}): Operation {
  return {
    kind: 'tenant',
    name: def.name,
    entitlement: def.entitlement,
    run: async (event, now) => {
      const user = userFrom(event, now);
      const input = parse(def.input, event.arguments);
      const access = await loadTenantAccess(input.tenantId, user.userId);
      try {
        requireEntitlement(access.entitlements, def.entitlement);
      } catch (e) {
        if (e instanceof RbacError) throw forbidden();
        throw e;
      }
      return def.handler(input, { ...user, access });
    },
  };
}
