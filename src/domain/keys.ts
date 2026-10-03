/**
 * DynamoDB key builders for the single `FarmData` table (ADR-0002).
 *
 * The ONLY place key strings are constructed. Every partition key starts with
 * `T#<tenantId>`, so handlers that build keys from the authorized tenant can
 * never address another tenant's data.
 */

const SEP = '#';
const assertId = (label: string, id: string): string => {
  if (!id || id.includes(SEP))
    throw new Error(`Invalid ${label}: ${JSON.stringify(id)}`);
  return id;
};

const t = (tenantId: string) => `T${SEP}${assertId('tenantId', tenantId)}`;

export interface Key {
  PK: string;
  SK: string;
}

/** GSI1 partition holding a user's memberships. */
const userPk = (userId: string): string =>
  `U${SEP}${assertId('userId', userId)}`;

export const keys = {
  tenant: (tenantId: string): Key => ({ PK: t(tenantId), SK: 'TENANT' }),

  member: (tenantId: string, userId: string): Key => ({
    PK: t(tenantId),
    SK: `MEMBER${SEP}${assertId('userId', userId)}`,
  }),
  /** GSI1: tenants of a user (only ever queried with the caller's own sub). */
  memberByUser: (userId: string, tenantId: string) => ({
    GSI1PK: userPk(userId),
    GSI1SK: t(tenantId),
  }),
  userPk,

  role: (tenantId: string, roleId: string): Key => ({
    PK: t(tenantId),
    SK: `ROLE${SEP}${assertId('roleId', roleId)}`,
  }),
  profile: (tenantId: string, profileId: string): Key => ({
    PK: t(tenantId),
    SK: `PROFILE${SEP}${assertId('profileId', profileId)}`,
  }),

  farm: (tenantId: string, farmId: string): Key => ({
    PK: t(tenantId),
    SK: `FARM${SEP}${assertId('farmId', farmId)}`,
  }),

  /** GSI2: get any entity by id; results MUST be tenant-checked. */
  byId: (id: string) => ({ GSI2PK: `ID${SEP}${assertId('id', id)}` }),

  audit: (
    tenantId: string,
    entityId: string,
    at: string,
    auditId: string
  ): Key => ({
    PK: `${t(tenantId)}${SEP}AUD${SEP}${assertId('entityId', entityId)}`,
    SK: `${at}${SEP}${assertId('auditId', auditId)}`,
  }),

  prefix: {
    members: 'MEMBER#',
    roles: 'ROLE#',
    profiles: 'PROFILE#',
    farms: 'FARM#',
  },
  tenantPk: t,
} as const;

/** ULID: 26 Crockford base32 characters (ADR-0004 client-generated ids). */
export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const isUlid = (value: string): boolean => ULID_PATTERN.test(value);
