/**
 * Team access (#121, #37, SRS §4.3, PR-003, AC-TN-003, US-027).
 *
 * - Members: invite by email with a profile; the invitee signs up / signs in
 *   with that (Cognito-verified) email and accepts. Change a member's profile,
 *   suspend or remove them.
 * - Roles and profiles are tenant data: create, rename, edit, archive. The
 *   entitlement catalogue is fixed by the system.
 *
 * Guardrails (src/domain/rbac/guards), all enforced here on the server:
 * - no escalation: nobody grants entitlements they don't hold;
 * - no lock-out: at least one active member keeps tenant.manage + member.manage;
 * - the built-in Owner profile can't be archived.
 * Access is resolved per request (lib/authorize), so a change applies on the
 * member's next request. Every change is audited (§31).
 */

import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { z } from 'zod';
import { keys } from '../../../../src/domain/keys';
import {
  ALL_ENTITLEMENTS,
  type Entitlement,
  type MemberRecord,
  type ProfileRecord,
  RbacError,
  type RoleRecord,
  assertKnownEntitlements,
  assertKnownRoles,
  assertNoEscalation,
  assertNoLockout,
  assertProfileDeletable,
  buildTenantRbac,
  entitlementsForProfile,
  entitlementsForRoleIds,
  inviteExpiry,
  isInviteOpen,
  normalizeEmail,
} from '../../../../src/domain/rbac';
import { type Item, getItem, queryPrefix } from '../lib/crud';
import { ddb, tableName } from '../lib/db';
import { ApiError, notFound } from '../lib/errors';
import {
  type UserContext,
  tenantOperation,
  userOperation,
} from '../lib/operation';

type TxItems = NonNullable<TransactWriteCommandInput['TransactItems']>;

const idLike = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'invalid id');
const emailInput = z.string().trim().max(254);
const name = z.string().trim().min(1).max(60);
const version = z.number().int().min(0);
const STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
const MEMBER_STATUSES = ['ACTIVE', 'SUSPENDED', 'REMOVED'] as const;

function rbacError(e: unknown): never {
  if (e instanceof RbacError) {
    if (e.code === 'ESCALATION') throw new ApiError('FORBIDDEN', e.message);
    throw new ApiError('VALIDATION', `${e.code.toLowerCase()}: ${e.message}`);
  }
  throw e;
}

function audit(
  tenantId: string,
  ctx: { userId: string; now: string },
  entityId: string,
  action: string,
  details: Item
) {
  return {
    Put: {
      TableName: tableName(),
      Item: {
        ...keys.audit(tenantId, entityId, ctx.now, ulid()),
        entityType: 'AuditLog',
        tenantId,
        at: ctx.now,
        actorId: ctx.userId,
        action,
        entityId,
        details,
      },
    },
  };
}

/** Put guarded by the stored version (records seeded without one count as 0). */
function versionedPut(tenantId: string, item: Item, expected: number) {
  return {
    Put: {
      TableName: tableName(),
      Item: item,
      ConditionExpression:
        expected === 0
          ? 'attribute_not_exists(version) AND tenantId = :t'
          : 'version = :v AND tenantId = :t',
      ExpressionAttributeValues:
        expected === 0
          ? { ':t': tenantId }
          : { ':v': expected, ':t': tenantId },
    },
  };
}

async function commit(items: TxItems) {
  try {
    await ddb.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (e) {
    if (e instanceof TransactionCanceledException)
      throw new ApiError(
        'CONFLICT',
        'Someone changed this meanwhile; reload and try again'
      );
    throw e;
  }
}

/** Everything RBAC for one tenant, as stored. */
async function loadAll(tenantId: string) {
  const pk = keys.tenantPk(tenantId);
  const [roles, profiles, members, invites] = await Promise.all([
    queryPrefix(pk, keys.prefix.roles),
    queryPrefix(pk, keys.prefix.profiles),
    queryPrefix(pk, keys.prefix.members),
    queryPrefix(pk, keys.prefix.invites),
  ]);
  return { roles, profiles, members, invites };
}

const asRole = (r: Item): RoleRecord => ({
  id: String(r['id']),
  name: String(r['name']),
  entitlements: (r['entitlements'] as Entitlement[]) ?? [],
  isSystem: Boolean(r['isSystem']),
  status: (r['status'] as RoleRecord['status']) ?? 'ACTIVE',
});
const asProfile = (p: Item): ProfileRecord => ({
  id: String(p['id']),
  name: String(p['name']),
  roleIds: (p['roleIds'] as string[]) ?? [],
  isSystem: Boolean(p['isSystem']),
  status: (p['status'] as ProfileRecord['status']) ?? 'ACTIVE',
});
const asMember = (m: Item): MemberRecord => ({
  userId: String(m['userId']),
  profileId: String(m['profileId']),
  status: m['status'] as MemberRecord['status'],
});

const roleView = (r: Item) => ({
  ...asRole(r),
  version: Number(r['version'] ?? 0),
});
const profileView = (p: Item) => ({
  ...asProfile(p),
  version: Number(p['version'] ?? 0),
});

// ─── Read ──────────────────────────────────────────────────────────────────────

export const getTeam = tenantOperation({
  name: 'getTeam',
  entitlement: 'member.manage',
  input: z.object({ tenantId: z.string().min(1) }),
  handler: async (input, ctx) => {
    const all = await loadAll(ctx.access.tenantId);
    const profiles = new Map(
      all.profiles.map(p => [String(p['id']), String(p['name'])])
    );
    return {
      members: all.members
        .filter(m => m['status'] !== 'REMOVED')
        .map(m => ({
          userId: m['userId'],
          email: m['email'] ?? null,
          profileId: m['profileId'],
          profileName: profiles.get(String(m['profileId'])) ?? null,
          status: m['status'],
          isMe: m['userId'] === ctx.userId,
          version: Number(m['version'] ?? 0),
          joinedAt: m['createdAt'] ?? null,
        })),
      invites: all.invites
        .filter(i =>
          isInviteOpen(i as { status: string; expiresAt: string }, ctx.now)
        )
        .map(i => ({
          email: i['email'],
          profileId: i['profileId'],
          profileName: profiles.get(String(i['profileId'])) ?? null,
          expiresAt: i['expiresAt'],
          invitedBy: i['invitedByEmail'] ?? null,
        })),
      roles: all.roles.map(roleView),
      profiles: all.profiles.map(profileView),
      catalogue: [...ALL_ENTITLEMENTS],
      myEntitlements: [...ctx.access.entitlements].sort(),
    };
  },
});

// ─── Invites (#37) ─────────────────────────────────────────────────────────────

export const inviteMember = tenantOperation({
  name: 'inviteMember',
  entitlement: 'member.manage',
  input: z.object({
    tenantId: z.string().min(1),
    email: emailInput,
    profileId: idLike,
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    const email = normalizeEmail(input.email);
    if (!email)
      throw new ApiError('VALIDATION', 'email: enter a valid email address');
    const all = await loadAll(tenantId);
    const rbac = buildTenantRbac(
      all.roles.map(asRole),
      all.profiles.map(asProfile)
    );
    const profile = rbac.profiles.get(input.profileId);
    if (!profile || profile.status !== 'ACTIVE')
      throw notFound('Profile not found');
    try {
      assertNoEscalation(
        ctx.access.entitlements,
        entitlementsForProfile(rbac, input.profileId)
      );
    } catch (e) {
      rbacError(e);
    }
    if (all.members.some(m => m['email'] === email && m['status'] === 'ACTIVE'))
      throw new ApiError('CONFLICT', 'email: already a member');
    const tenant = await getItem(keys.tenant(tenantId));
    const invite: Item = {
      ...keys.invite(tenantId, email),
      ...keys.inviteByEmail(email, tenantId),
      entityType: 'Invite',
      tenantId,
      tenantName: tenant?.['name'] ?? null,
      email,
      profileId: input.profileId,
      status: 'PENDING',
      expiresAt: inviteExpiry(ctx.now),
      invitedBy: ctx.userId,
      invitedByEmail: ctx.email ?? null,
      createdAt: ctx.now,
    };
    await commit([
      { Put: { TableName: tableName(), Item: invite } },
      audit(tenantId, ctx, email, 'member.invite', {
        email,
        profileId: input.profileId,
      }),
    ]);
    return {
      email,
      profileId: input.profileId,
      profileName: profile.name,
      expiresAt: invite['expiresAt'],
    };
  },
});

export const revokeInvite = tenantOperation({
  name: 'revokeInvite',
  entitlement: 'member.manage',
  input: z.object({ tenantId: z.string().min(1), email: emailInput }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    const email = normalizeEmail(input.email);
    if (!email) throw notFound('Invite not found');
    const invite = await getItem(keys.invite(tenantId, email));
    if (!invite) throw notFound('Invite not found');
    await commit([
      {
        Put: {
          TableName: tableName(),
          Item: { ...invite, status: 'REVOKED', revokedAt: ctx.now },
        },
      },
      audit(tenantId, ctx, email, 'member.revokeInvite', { email }),
    ]);
    return true;
  },
});

export const myInvites = userOperation({
  name: 'myInvites',
  input: z.object({}).passthrough(),
  handler: (_input, ctx) => invitesFor(ctx),
});

/** Open invites for the caller's verified email. */
async function invitesFor(ctx: UserContext) {
  const email = ctx.email ? normalizeEmail(ctx.email) : null;
  if (!email) return [];
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': keys.inviteByEmail(email, 'x').GSI1PK,
      },
    })
  );
  return (res.Items ?? [])
    .filter(i => i['entityType'] === 'Invite' && i['email'] === email)
    .filter(i =>
      isInviteOpen(i as { status: string; expiresAt: string }, ctx.now)
    )
    .map(i => ({
      tenantId: String(i['tenantId']),
      tenantName: String(i['tenantName'] ?? ''),
      invitedBy: (i['invitedByEmail'] as string | null) ?? null,
      expiresAt: String(i['expiresAt']),
    }));
}

export const acceptInvite = userOperation({
  name: 'acceptInvite',
  input: z.object({ tenantId: idLike }),
  handler: async (input, ctx) => {
    const email = ctx.email ? normalizeEmail(ctx.email) : null;
    if (!email)
      throw new ApiError('FORBIDDEN', 'Your account has no verified email');
    const invite = await getItem(keys.invite(input.tenantId, email));
    if (
      !invite ||
      !isInviteOpen(invite as { status: string; expiresAt: string }, ctx.now)
    )
      throw notFound('Invite not found or expired');
    const existing = await getItem(keys.member(input.tenantId, ctx.userId));
    if (existing?.['status'] === 'ACTIVE')
      return { tenantId: input.tenantId, joined: true };

    const member: Item = {
      ...keys.member(input.tenantId, ctx.userId),
      ...keys.memberByUser(ctx.userId, input.tenantId),
      entityType: 'TenantMember',
      tenantId: input.tenantId,
      userId: ctx.userId,
      email,
      tenantName: invite['tenantName'],
      profileId: invite['profileId'],
      status: 'ACTIVE',
      version: Number(existing?.['version'] ?? 0) + 1,
      invitedBy: invite['invitedBy'],
      createdAt: existing?.['createdAt'] ?? ctx.now,
      createdBy: ctx.userId,
      updatedAt: ctx.now,
    };
    await commit([
      {
        Put: {
          TableName: tableName(),
          Item: member,
          // Never overwrite an active membership (e.g. an owner)
          ConditionExpression: 'attribute_not_exists(PK) OR status = :removed',
          ExpressionAttributeValues: { ':removed': 'REMOVED' },
        },
      },
      {
        Put: {
          TableName: tableName(),
          Item: {
            ...invite,
            status: 'ACCEPTED',
            acceptedAt: ctx.now,
            acceptedBy: ctx.userId,
          },
          ConditionExpression: 'status = :p',
          ExpressionAttributeValues: { ':p': 'PENDING' },
        },
      },
      audit(input.tenantId, ctx, ctx.userId, 'member.join', {
        email,
        profileId: invite['profileId'],
      }),
    ]);
    return { tenantId: input.tenantId, joined: true };
  },
});

// ─── Members ───────────────────────────────────────────────────────────────────

export const updateMember = tenantOperation({
  name: 'updateMember',
  entitlement: 'member.manage',
  input: z.object({
    tenantId: z.string().min(1),
    userId: z.string().min(1).max(128),
    expectedVersion: version,
    profileId: idLike.nullish(),
    status: z.enum(MEMBER_STATUSES).nullish(),
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    const all = await loadAll(tenantId);
    const stored = all.members.find(m => m['userId'] === input.userId);
    if (!stored || stored['status'] === 'REMOVED')
      throw notFound('Member not found');
    const rbac = buildTenantRbac(
      all.roles.map(asRole),
      all.profiles.map(asProfile)
    );
    const next: MemberRecord = {
      ...asMember(stored),
      ...(input.profileId ? { profileId: input.profileId } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    try {
      if (input.profileId) {
        const p = rbac.profiles.get(input.profileId);
        if (!p || p.status !== 'ACTIVE') throw notFound('Profile not found');
        assertNoEscalation(
          ctx.access.entitlements,
          entitlementsForProfile(rbac, input.profileId)
        );
      }
      assertNoLockout(
        rbac,
        all.members.map(m =>
          m['userId'] === input.userId ? next : asMember(m)
        )
      );
    } catch (e) {
      rbacError(e);
    }
    const item: Item = {
      ...stored,
      profileId: next.profileId,
      status: next.status,
      version: input.expectedVersion + 1,
      updatedAt: ctx.now,
      updatedBy: ctx.userId,
    };
    await commit([
      versionedPut(tenantId, item, input.expectedVersion),
      audit(tenantId, ctx, input.userId, 'member.update', {
        before: { profileId: stored['profileId'], status: stored['status'] },
        after: { profileId: next.profileId, status: next.status },
      }),
    ]);
    return {
      userId: input.userId,
      profileId: next.profileId,
      status: next.status,
      version: item['version'],
    };
  },
});

// ─── Roles & profiles (#121) ───────────────────────────────────────────────────

/** Validate a proposed RBAC state: no lock-out with the new roles/profiles. */
function checkLockout(
  roles: RoleRecord[],
  profiles: ProfileRecord[],
  members: Item[]
) {
  assertNoLockout(buildTenantRbac(roles, profiles), members.map(asMember));
}

export const saveRole = tenantOperation({
  name: 'saveRole',
  entitlement: 'role.manage',
  input: z.object({
    tenantId: z.string().min(1),
    roleId: idLike,
    expectedVersion: version,
    name,
    entitlements: z.array(z.string().max(60)).max(100),
    status: z.enum(STATUSES).nullish(),
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    const all = await loadAll(tenantId);
    const stored = all.roles.find(r => r['id'] === input.roleId);
    const roles = all.roles.map(asRole);
    const before = stored ? asRole(stored) : null;
    try {
      assertKnownEntitlements(input.entitlements);
      const added = input.entitlements.filter(
        e => !before?.entitlements.includes(e)
      );
      assertNoEscalation(ctx.access.entitlements, added);
      const next: RoleRecord = {
        id: input.roleId,
        name: input.name,
        entitlements: [...new Set(input.entitlements)].sort(),
        isSystem: before?.isSystem ?? false,
        status: input.status ?? before?.status ?? 'ACTIVE',
      };
      checkLockout(
        stored
          ? roles.map(r => (r.id === next.id ? next : r))
          : [...roles, next],
        all.profiles.map(asProfile),
        all.members
      );
      const item: Item = {
        ...(stored ?? {
          ...keys.role(tenantId, input.roleId),
          entityType: 'Role',
          tenantId,
          createdAt: ctx.now,
          createdBy: ctx.userId,
        }),
        ...next,
        version: input.expectedVersion + 1,
        updatedAt: ctx.now,
        updatedBy: ctx.userId,
      };
      await commit([
        stored
          ? versionedPut(tenantId, item, input.expectedVersion)
          : {
              Put: {
                TableName: tableName(),
                Item: item,
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
        audit(
          tenantId,
          ctx,
          input.roleId,
          stored ? 'role.update' : 'role.create',
          {
            before: before
              ? {
                  name: before.name,
                  entitlements: before.entitlements,
                  status: before.status,
                }
              : null,
            after: {
              name: next.name,
              entitlements: next.entitlements,
              status: next.status,
            },
          }
        ),
      ]);
      return { ...next, version: item['version'] };
    } catch (e) {
      return rbacError(e);
    }
  },
});

export const saveProfile = tenantOperation({
  name: 'saveProfile',
  entitlement: 'profile.manage',
  input: z.object({
    tenantId: z.string().min(1),
    profileId: idLike,
    expectedVersion: version,
    name,
    roleIds: z.array(idLike).max(50),
    status: z.enum(STATUSES).nullish(),
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    const all = await loadAll(tenantId);
    const stored = all.profiles.find(p => p['id'] === input.profileId);
    const roles = all.roles.map(asRole);
    const profiles = all.profiles.map(asProfile);
    const rbac = buildTenantRbac(roles, profiles);
    const before = stored ? asProfile(stored) : null;
    try {
      const roleIds = [...new Set(input.roleIds)];
      assertKnownRoles(rbac, roleIds);
      const status = input.status ?? before?.status ?? 'ACTIVE';
      if (status === 'ARCHIVED') assertProfileDeletable(input.profileId);
      const had = before
        ? entitlementsForRoleIds(rbac, before.roleIds)
        : new Set<Entitlement>();
      const added = [...entitlementsForRoleIds(rbac, roleIds)].filter(
        e => !had.has(e)
      );
      assertNoEscalation(ctx.access.entitlements, added);
      const next: ProfileRecord = {
        id: input.profileId,
        name: input.name,
        roleIds,
        isSystem: before?.isSystem ?? false,
        status,
      };
      checkLockout(
        roles,
        stored
          ? profiles.map(p => (p.id === next.id ? next : p))
          : [...profiles, next],
        all.members
      );
      const item: Item = {
        ...(stored ?? {
          ...keys.profile(tenantId, input.profileId),
          entityType: 'Profile',
          tenantId,
          createdAt: ctx.now,
          createdBy: ctx.userId,
        }),
        ...next,
        version: input.expectedVersion + 1,
        updatedAt: ctx.now,
        updatedBy: ctx.userId,
      };
      await commit([
        stored
          ? versionedPut(tenantId, item, input.expectedVersion)
          : {
              Put: {
                TableName: tableName(),
                Item: item,
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
        audit(
          tenantId,
          ctx,
          input.profileId,
          stored ? 'profile.update' : 'profile.create',
          {
            before: before
              ? {
                  name: before.name,
                  roleIds: before.roleIds,
                  status: before.status,
                }
              : null,
            after: {
              name: next.name,
              roleIds: next.roleIds,
              status: next.status,
            },
          }
        ),
      ]);
      return { ...next, version: item['version'] };
    } catch (e) {
      return rbacError(e);
    }
  },
});
