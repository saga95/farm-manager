/**
 * Shared persistence helpers implementing ADR-0002 / ADR-0004:
 * - createWithAudit: conditional put (client ULID) + audit entry in one transaction;
 *   an identical retry by the same actor is an idempotent replay.
 * - updateWithAudit: optimistic locking on `version` + audit entry.
 * - queryPrefix: tenant-scoped partition query with begins_with.
 */

import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { type Key, keys } from '../../../../src/domain/keys';
import { ddb, tableName } from './db';
import { ApiError, notFound } from './errors';
import type { TenantContext } from './operation';

export type Item = Record<string, unknown>;

/** Internal attributes never returned to clients. */
const INTERNAL = new Set([
  'PK',
  'SK',
  'GSI1PK',
  'GSI1SK',
  'GSI2PK',
  'GSI2SK',
  'entityType',
]);

export function toView<T>(item: Item): T {
  return Object.fromEntries(
    Object.entries(item).filter(([k]) => !INTERNAL.has(k))
  ) as T;
}

/** Drop undefined/null-from-client optional fields so updates don't erase by accident. */
export function definedOnly(
  obj: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

function auditPut(
  ctx: TenantContext,
  entityId: string,
  action: string,
  details: Item
) {
  return {
    Put: {
      TableName: tableName(),
      Item: {
        ...keys.audit(ctx.access.tenantId, entityId, ctx.now, ulid()),
        entityType: 'AuditLog',
        tenantId: ctx.access.tenantId,
        at: ctx.now,
        actorId: ctx.userId,
        action,
        entityId,
        details,
      },
    },
  };
}

export async function getItem(key: Key): Promise<Item | undefined> {
  const { Item } = await ddb.send(
    new GetCommand({ TableName: tableName(), Key: key })
  );
  return Item;
}

/** Fetch an item that must exist and belong to the caller's tenant (ADR-0001 §3). */
export async function requireItem(
  key: Key,
  ctx: TenantContext,
  what = 'Record'
): Promise<Item> {
  const item = await getItem(key);
  if (!item || item['tenantId'] !== ctx.access.tenantId)
    throw notFound(`${what} not found`);
  return item;
}

export async function createWithAudit(opts: {
  ctx: TenantContext;
  key: Key;
  id: string;
  entityType: string;
  attributes: Item;
  action: string;
}): Promise<Item> {
  const { ctx, key, id } = opts;
  const item: Item = {
    ...key,
    ...keys.byId(id),
    GSI2SK: opts.entityType.toUpperCase(),
    entityType: opts.entityType,
    ...opts.attributes,
    id,
    tenantId: ctx.access.tenantId,
    version: 1,
    createdAt: ctx.now,
    createdBy: ctx.userId,
    updatedAt: ctx.now,
    updatedBy: ctx.userId,
  };

  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName(),
              Item: item,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          auditPut(ctx, id, opts.action, { after: opts.attributes }),
        ],
      })
    );
    return item;
  } catch (e) {
    if (!(e instanceof TransactionCanceledException)) throw e;
    const existing = await getItem(key);
    // Idempotent replay (ADR-0004 §1): same actor, same id → return what's stored.
    if (
      existing &&
      existing['id'] === id &&
      existing['createdBy'] === ctx.userId &&
      existing['tenantId'] === ctx.access.tenantId
    ) {
      return existing;
    }
    throw new ApiError('CONFLICT', 'Id already in use');
  }
}

export async function updateWithAudit(opts: {
  ctx: TenantContext;
  key: Key;
  expectedVersion: number;
  changes: Item;
  action: string;
}): Promise<Item> {
  const { ctx, key, expectedVersion } = opts;
  const current = await requireItem(key, opts.ctx);
  if (current['version'] !== expectedVersion) {
    throw new ApiError(
      'CONFLICT',
      `Record changed (version ${String(current['version'])})`
    );
  }
  const changes = definedOnly(opts.changes);
  const next: Item = {
    ...current,
    ...changes,
    version: expectedVersion + 1,
    updatedAt: ctx.now,
    updatedBy: ctx.userId,
  };
  const before = Object.fromEntries(
    Object.keys(changes).map(k => [k, current[k]])
  );

  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName(),
              Item: next,
              ConditionExpression: 'version = :v AND tenantId = :t',
              ExpressionAttributeValues: {
                ':v': expectedVersion,
                ':t': ctx.access.tenantId,
              },
            },
          },
          auditPut(ctx, String(current['id']), opts.action, {
            before,
            after: changes,
          }),
        ],
      })
    );
    return next;
  } catch (e) {
    if (e instanceof TransactionCanceledException) {
      throw new ApiError(
        'CONFLICT',
        'Record changed by someone else; reload and try again'
      );
    }
    throw e;
  }
}

/** Get an entity by id via GSI2; returns undefined unless it belongs to the caller's tenant. */
export async function getById(
  id: string,
  ctx: TenantContext
): Promise<Item | undefined> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': keys.byId(id).GSI2PK },
    })
  );
  return (res.Items ?? []).find(i => i['tenantId'] === ctx.access.tenantId);
}

export async function queryPrefix(
  pk: string,
  skPrefix: string
): Promise<Item[]> {
  const items: Item[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': pk, ':sk': skPrefix },
        ExclusiveStartKey,
      })
    );
    items.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/** BatchGet up to any number of keys (chunks of 100); missing keys are skipped. */
export async function batchGetItems(keyList: readonly Key[]): Promise<Item[]> {
  const out: Item[] = [];
  const TableName = tableName();
  for (let i = 0; i < keyList.length; i += 100) {
    const res = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [TableName]: { Keys: keyList.slice(i, i + 100).map(k => ({ ...k })) },
        },
      })
    );
    out.push(...(res.Responses?.[TableName] ?? []));
  }
  return out;
}
