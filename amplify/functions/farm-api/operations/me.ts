/**
 * me: the caller's identity and tenant memberships with resolved entitlements.
 * The UI uses entitlements only to show/hide controls (ADR-0001 §7).
 */

import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { keys } from '../../../../src/domain/keys';
import { ddb, tableName } from '../lib/db';
import { ApiError } from '../lib/errors';
import { loadTenantAccess } from '../lib/authorize';
import { userOperation } from '../lib/operation';

export interface MembershipView {
  tenantId: string;
  tenantName: string;
  profileId: string;
  profileName: string;
  entitlements: string[];
}

export const me = userOperation({
  name: 'me',
  input: z.object({}).passthrough(),
  handler: async (_input, ctx) => {
    const TableName = tableName();
    const GSI1PK = keys.userPk(ctx.userId);
    const res = await ddb.send(
      new QueryCommand({
        TableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': GSI1PK },
      })
    );

    const memberships: MembershipView[] = [];
    for (const item of res.Items ?? []) {
      // Defence in depth: the index key is the caller's own sub, but verify anyway.
      if (item['userId'] !== ctx.userId || item['status'] !== 'ACTIVE')
        continue;
      try {
        const access = await loadTenantAccess(
          item['tenantId'] as string,
          ctx.userId
        );
        memberships.push({
          tenantId: access.tenantId,
          tenantName: String(item['tenantName'] ?? ''),
          profileId: access.profile.id,
          profileName: access.profile.name,
          entitlements: [...access.entitlements].sort(),
        });
      } catch (e) {
        // Inactive profile etc.: membership exists but grants nothing; omit it.
        if (!(e instanceof ApiError)) throw e;
      }
    }

    return { userId: ctx.userId, email: ctx.email ?? null, memberships };
  },
});
