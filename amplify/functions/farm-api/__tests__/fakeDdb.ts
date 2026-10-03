/**
 * Minimal in-memory FarmData for handler tests: Get, BatchGet, Query (PK/GSI1
 * equality) and TransactWrite with attribute_not_exists conditions.
 */
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
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
    return {
      Items: [...store.values()]
        .filter(i => i[pkAttr] === want)
        .map(i => structuredClone(i)),
    };
  });

  mock.on(TransactWriteCommand).callsFake(input => {
    const puts = (input.TransactItems ?? []).map(
      (t: { Put: { Item: Item } }) => t.Put.Item
    );
    if (puts.some(i => store.has(k(i['PK'], i['SK'])))) {
      throw new TransactionCanceledException({
        message: 'Transaction cancelled',
        $metadata: {},
      });
    }
    puts.forEach(i => store.set(k(i['PK'], i['SK']), structuredClone(i)));
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
