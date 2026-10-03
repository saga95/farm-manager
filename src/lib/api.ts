/**
 * Typed client for the Farm Manager API (custom AppSync operations, ADR-0001).
 * Errors from farm-api arrive as `<CODE>: <detail>` and are mapped to ApiError.
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'INTERNAL'
  | 'NETWORK';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const KNOWN: readonly ApiErrorCode[] = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION',
  'CONFLICT',
  'INTERNAL',
];

/** Map a GraphQL error message (`CODE: detail`) to an ApiError. */
export function toApiError(message: string | undefined): ApiError {
  const match = /^([A-Z_]+):\s*(.*)$/s.exec(message ?? '');
  const code = match?.[1] as ApiErrorCode | undefined;
  if (code && KNOWN.includes(code)) return new ApiError(code, match?.[2] ?? '');
  if (/unauthorized|not authorized|no current user/i.test(message ?? '')) {
    return new ApiError('UNAUTHENTICATED', message ?? '');
  }
  return new ApiError('INTERNAL', message ?? 'Unexpected error');
}

let client: ReturnType<typeof generateClient<Schema>> | undefined;
const api = () => (client ??= generateClient<Schema>({ authMode: 'userPool' }));

type Result<T> = {
  data?: T | null;
  errors?: readonly { message: string }[] | null;
};

function unwrap<T>(res: Result<T>): T {
  if (res.errors && res.errors.length > 0)
    throw toApiError(res.errors[0]?.message);
  if (res.data === undefined || res.data === null)
    throw new ApiError('INTERNAL', 'Empty response');
  return res.data;
}

export interface Membership {
  tenantId: string;
  tenantName: string;
  profileId: string;
  profileName: string;
  entitlements: string[];
}

export interface Me {
  userId: string;
  email: string | null;
  memberships: Membership[];
}

export async function fetchMe(): Promise<Me> {
  const data = unwrap((await api().queries.me()) as Result<Me>);
  return { ...data, memberships: [...data.memberships] };
}

export interface CreateTenantVariables {
  tenantId: string;
  name: string;
  defaultTimezone: string;
  defaultCurrency: string;
  defaultLocale: string;
  farmId: string;
  farmName: string;
  farmArea?: number | null;
  farmAreaUnit?: string | null;
  farmLocationLabel?: string | null;
}

export async function createTenant(
  variables: CreateTenantVariables
): Promise<{ tenantId: string; farmId: string; replayed: boolean }> {
  return unwrap(
    (await api().mutations.createTenant(variables)) as Result<{
      tenantId: string;
      farmId: string;
      replayed: boolean;
    }>
  );
}
