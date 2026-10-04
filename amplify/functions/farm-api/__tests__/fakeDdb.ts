/**
 * Minimal in-memory FarmData for handler tests: Get, BatchGet, Query (PK/GSI1
 * equality) and TransactWrite with attribute_not_exists conditions.
 */
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

type Item = Record<string, unknown>;

export function installFakeDdb() {
  const store = new Map<string, Item>();
  const k = (pk: unknown, sk: unknown) => `${String(pk)}|${String(sk)}`;
  const mock = mockClient(DynamoDBDocumentClient);

  mock.on(GetCommand).callsFake(input => {
    const item = store.get(k(input.Key.PK, input.Key.SK));
    return { Item: item ? structuredClone(item) : undefined };
  });

  mock.on(PutCommand).callsFake(input => {
    const item = input.Item as Item;
    store.set(k(item['PK'], item['SK']), structuredClone(item));
    return {};
  });

  // Supports `SET a = :x, b = :y` with an optional `tenantId = :tenant` condition.
  mock.on(UpdateCommand).callsFake(input => {
    const key = k(input.Key?.['PK'], input.Key?.['SK']);
    const existing = store.get(key);
    const values = input.ExpressionAttributeValues ?? {};
    if (
      !existing ||
      (String(input.ConditionExpression ?? '').includes('tenantId = :tenant') &&
        existing['tenantId'] !== values[':tenant'])
    ) {
      throw new ConditionalCheckFailedException({
        message: 'Condition failed',
        $metadata: {},
      });
    }
    const assignments = String(input.UpdateExpression)
      .replace(/^SET\s+/, '')
      .split(',');
    for (const a of assignments) {
      const [attr, ref] = a.split('=').map(x => x.trim());
      existing[attr as string] = structuredClone(values[ref as string]);
    }
    return {};
  });

  mock.on(BatchGetCommand).callsFake(input => {
    const Responses: Record<string, Item[]> = {};
    for (const [table, req] of Object.entries(input.RequestItems ?? {})) {
      const keysReq = (req as { Keys: Item[] }).Keys;
      Responses[table] = keysReq
        .map(key => store.get(k(key['PK'], key['SK'])))
        .filter((i): i is Item => Boolean(i));
    }
    return { Responses };
  });

  mock.on(QueryCommand).callsFake(input => {
    const pkAttr = input.IndexName ? `${input.IndexName}PK` : 'PK';
    const want = input.ExpressionAttributeValues?.[':pk'];
    const prefix = String(input.KeyConditionExpression ?? '').includes(
      'begins_with'
    )
      ? String(input.ExpressionAttributeValues?.[':sk'] ?? '')
      : null;
    return {
      Items: [...store.values()]
        .filter(i => i[pkAttr] === want)
        .filter(i => prefix === null || String(i['SK']).startsWith(prefix))
        .map(i => structuredClone(i)),
    };
  });

  type Put = {
    Item: Item;
    ConditionExpression?: string;
    ExpressionAttributeValues?: Item;
  };
  const conditionHolds = (put: Put): boolean => {
    const cond = put.ConditionExpression ?? '';
    const existing = store.get(k(put.Item['PK'], put.Item['SK']));
    if (cond.includes('attribute_not_exists')) return !existing;
    if (cond.includes('version = :v')) {
      return (
        Boolean(existing) &&
        existing?.['version'] === put.ExpressionAttributeValues?.[':v'] &&
        (!cond.includes('tenantId = :t') ||
          existing?.['tenantId'] === put.ExpressionAttributeValues?.[':t'])
      );
    }
    return true;
  };

  mock.on(TransactWriteCommand).callsFake(input => {
    const puts = (input.TransactItems ?? []).map((t: { Put: Put }) => t.Put);
    if (!puts.every(conditionHolds)) {
      throw new TransactionCanceledException({
        message: 'Transaction cancelled',
        $metadata: {},
      });
    }
    puts.forEach(p =>
      store.set(k(p.Item['PK'], p.Item['SK']), structuredClone(p.Item))
    );
    return {};
  });

  return {
    store,
    mock,
    put: (item: Item) => store.set(k(item['PK'], item['SK']), item),
    reset: () => {
      store.clear();
    },
  };
}
