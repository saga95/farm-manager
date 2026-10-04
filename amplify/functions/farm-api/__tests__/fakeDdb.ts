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
    let items = [...store.values()]
      .filter(i => i[pkAttr] === want)
      .filter(i => prefix === null || String(i['SK']).startsWith(prefix));
    if (input.Limit === undefined && !input.ExclusiveStartKey)
      return { Items: items.map(i => structuredClone(i)) };
    // Paged queries: sort by SK, honour direction, start key and limit
    items = items.sort((a, b) =>
      String(a['SK']).localeCompare(String(b['SK']))
    );
    if (input.ScanIndexForward === false) items.reverse();
    const start = input.ExclusiveStartKey as Item | undefined;
    if (start) {
      const at = items.findIndex(
        i => i['PK'] === start['PK'] && i['SK'] === start['SK']
      );
      items = items.slice(at + 1);
    }
    const page = input.Limit ? items.slice(0, input.Limit) : items;
    const last = page.at(-1);
    return {
      Items: page.map(i => structuredClone(i)),
      ...(input.Limit && items.length > input.Limit && last
        ? { LastEvaluatedKey: { PK: last['PK'], SK: last['SK'] } }
        : {}),
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

  type Del = {
    Key: Item;
    ConditionExpression?: string;
    ExpressionAttributeValues?: Item;
  };
  const deleteHolds = (del: Del): boolean => {
    const existing = store.get(k(del.Key['PK'], del.Key['SK']));
    const m = /^(\w+) = (:\w+)$/.exec(del.ConditionExpression ?? '');
    if (!m) return true;
    return (
      Boolean(existing) &&
      existing?.[m[1]!] === del.ExpressionAttributeValues?.[m[2]!]
    );
  };

  mock.on(TransactWriteCommand).callsFake(input => {
    const ops = (input.TransactItems ?? []) as { Put?: Put; Delete?: Del }[];
    const puts = ops.flatMap(t => (t.Put ? [t.Put] : []));
    const dels = ops.flatMap(t => (t.Delete ? [t.Delete] : []));
    if (!puts.every(conditionHolds) || !dels.every(deleteHolds)) {
      throw new TransactionCanceledException({
        message: 'Transaction cancelled',
        $metadata: {},
      });
    }
    puts.forEach(p =>
      store.set(k(p.Item['PK'], p.Item['SK']), structuredClone(p.Item))
    );
    dels.forEach(d => store.delete(k(d.Key['PK'], d.Key['SK'])));
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
