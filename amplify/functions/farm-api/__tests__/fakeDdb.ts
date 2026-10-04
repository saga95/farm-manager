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
    const skAttr = input.IndexName ? `${input.IndexName}SK` : 'SK';
    const cond = String(input.KeyConditionExpression ?? '');
    const vals = input.ExpressionAttributeValues ?? {};
    const want = vals[':pk'];
    const prefix = cond.includes('begins_with')
      ? String(vals[':sk'] ?? '')
      : null;
    const between = cond.includes('BETWEEN')
      ? [String(vals[':a']), String(vals[':b'])]
      : null;
    let items = [...store.values()]
      .filter(i => i[pkAttr] === want)
      .filter(i => prefix === null || String(i[skAttr]).startsWith(prefix))
      .filter(
        i =>
          between === null ||
          (String(i[skAttr]) >= between[0]! && String(i[skAttr]) <= between[1]!)
      );
    if (input.Limit === undefined && !input.ExclusiveStartKey)
      return { Items: items.map(i => structuredClone(i)) };
    // Paged queries: sort by the sort key, honour direction, start key and limit
    items = items.sort((a, b) =>
      String(a[skAttr]).localeCompare(String(b[skAttr]))
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
    const lastKey = last
      ? {
          PK: last['PK'],
          SK: last['SK'],
          ...(input.IndexName
            ? { [pkAttr]: last[pkAttr], [skAttr]: last[skAttr] }
            : {}),
        }
      : undefined;
    return {
      Items: page.map(i => structuredClone(i)),
      ...(input.Limit && items.length > input.Limit && lastKey
        ? { LastEvaluatedKey: lastKey }
        : {}),
    };
  });

  type Put = {
    Item: Item;
    ConditionExpression?: string;
    ExpressionAttributeValues?: Item;
  };
  /**
   * Tiny DynamoDB condition evaluator: clauses joined by AND, optional
   * parenthesised OR groups, `a = :v`, attribute_exists / attribute_not_exists.
   */
  const evalCondition = (
    cond: string,
    existing: Item | undefined,
    values: Item | undefined
  ): boolean => {
    const splitTop = (expr: string, sep: string) => {
      const parts: string[] = [];
      let depth = 0;
      let buf = '';
      for (let i = 0; i < expr.length; i += 1) {
        const ch = expr[i]!;
        if (ch === '(') depth += 1;
        if (ch === ')') depth -= 1;
        if (depth === 0 && expr.startsWith(sep, i)) {
          parts.push(buf);
          buf = '';
          i += sep.length - 1;
        } else buf += ch;
      }
      parts.push(buf);
      return parts.map(x => x.trim()).filter(Boolean);
    };
    const clause = (c: string): boolean => {
      let x = c.trim();
      if (x.startsWith('(') && x.endsWith(')')) x = x.slice(1, -1);
      const ors = splitTop(x, ' OR ');
      if (ors.length > 1) return ors.some(clause);
      const ands = splitTop(x, ' AND ');
      if (ands.length > 1) return ands.every(clause);
      let m = /^attribute_not_exists\((\w+)\)$/.exec(x);
      if (m)
        return m[1] === 'PK'
          ? !existing
          : !existing || existing[m[1]!] === undefined;
      m = /^attribute_exists\((\w+)\)$/.exec(x);
      if (m) return Boolean(existing) && existing![m[1]!] !== undefined;
      m = /^(\w+) = (:\w+)$/.exec(x);
      if (m) return Boolean(existing) && existing![m[1]!] === values?.[m[2]!];
      throw new Error(`fakeDdb: unsupported condition ${x}`);
    };
    return cond.trim() === '' ? true : clause(cond);
  };

  const conditionHolds = (put: Put): boolean =>
    evalCondition(
      put.ConditionExpression ?? '',
      store.get(k(put.Item['PK'], put.Item['SK'])),
      put.ExpressionAttributeValues
    );

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
