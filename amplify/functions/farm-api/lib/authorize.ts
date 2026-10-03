/**
 * Server-side tenant authorization (ADR-0001 §3):
 * sub → TenantMember → Profile → Roles → entitlements.
 */

import { BatchGetCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { keys } from '../../../../src/domain/keys';
import {
  type Entitlement,
  type MemberRecord,
  type ProfileRecord,
  RbacError,
  type RoleRecord,
  buildTenantRbac,
  resolveMemberEntitlements,
} from '../../../../src/domain/rbac';
import { ddb, tableName } from './db';
import { forbidden } from './errors';

export interface TenantAccess {
  tenantId: string;
  member: MemberRecord;
  profile: ProfileRecord;
  entitlements: ReadonlySet<Entitlement>;
}

/** Loads RBAC records and resolves entitlements. Any failure → FORBIDDEN (no detail leak). */
export async function loadTenantAccess(
  tenantId: string,
  userId: string
): Promise<TenantAccess> {
  const TableName = tableName();
  const { Item: member } = await ddb.send(
    new GetCommand({ TableName, Key: keys.member(tenantId, userId) })
  );
  if (!member || member['tenantId'] !== tenantId) throw forbidden();

  const memberRecord: MemberRecord = {
    userId: member['userId'] as string,
    profileId: member['profileId'] as string,
    status: member['status'] as MemberRecord['status'],
  };

  const { Item: profile } = await ddb.send(
    new GetCommand({
      TableName,
      Key: keys.profile(tenantId, memberRecord.profileId),
    })
  );
  if (!profile) throw forbidden();
  const profileRecord = profile as unknown as ProfileRecord;

  const roleIds = profileRecord.roleIds ?? [];
  let roles: RoleRecord[] = [];
  if (roleIds.length > 0) {
    const res = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [TableName]: { Keys: roleIds.map(id => keys.role(tenantId, id)) },
        },
      })
    );
    roles = (res.Responses?.[TableName] ?? []) as unknown as RoleRecord[];
  }

  try {
    const entitlements = resolveMemberEntitlements(
      buildTenantRbac(roles, [profileRecord]),
      memberRecord
    );
    return {
      tenantId,
      member: memberRecord,
      profile: profileRecord,
      entitlements,
    };
  } catch (e) {
    if (e instanceof RbacError) throw forbidden();
    throw e;
  }
}
