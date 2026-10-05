/**
 * Change history (#105, §31, DQ-007) and CSV export (#106, §5.2).
 *
 * - listAudit (audit.view): one record's history (its own partition) or the
 *   tenant's whole feed (GSI1), newest first, paginated with a
 *   partition-checked token. Actor ids are shown as member emails.
 * - exportCsv (export.data): trees, harvests, samples, sales or stock
 *   movements for ONE farm of the caller's tenant, as CSV (formula-safe).
 */

import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import {
  type Column,
  EXPORT_KINDS,
  exportFilename,
  toCsv,
} from '../../../../src/domain/export';
import { isUlid, keys } from '../../../../src/domain/keys';
import { type Item, queryPrefix, requireItem } from '../lib/crud';
import { ddb, tableName } from '../lib/db';
import { ApiError } from '../lib/errors';
import { tenantOperation } from '../lib/operation';
import { treeHarvests, treeSamples } from '../lib/treeSnapshot';

const idLike = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

function decodeToken(
  token: string | null | undefined,
  attr: string,
  pk: string
) {
  if (!token) return undefined;
  let start: Record<string, unknown>;
  try {
    start = JSON.parse(
      Buffer.from(token, 'base64url').toString('utf8')
    ) as Record<string, unknown>;
  } catch {
    throw new ApiError('VALIDATION', 'nextToken: invalid');
  }
  if (start[attr] !== pk)
    throw new ApiError('VALIDATION', 'nextToken: invalid');
  return start;
}

export const listAudit = tenantOperation({
  name: 'listAudit',
  entitlement: 'audit.view',
  input: z.object({
    tenantId: z.string().min(1),
    entityId: idLike.nullish(),
    limit: z.number().int().min(1).max(100).nullish(),
    nextToken: z.string().max(2000).nullish(),
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    const byEntity = Boolean(input.entityId);
    const pk = byEntity
      ? keys.audit(tenantId, input.entityId as string, '0', 'x').PK
      : keys.auditFeedPk(tenantId);
    const pkAttr = byEntity ? 'PK' : 'GSI1PK';
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        ...(byEntity ? {} : { IndexName: 'GSI1' }),
        KeyConditionExpression: `${pkAttr} = :pk`,
        ExpressionAttributeValues: { ':pk': pk },
        ScanIndexForward: false,
        Limit: input.limit ?? 30,
        ExclusiveStartKey: decodeToken(input.nextToken, pkAttr, pk),
      })
    );
    const members = await queryPrefix(
      keys.tenantPk(tenantId),
      keys.prefix.members
    );
    const emails = new Map(
      members.map(m => [
        String(m['userId']),
        (m['email'] as string | undefined) ?? null,
      ])
    );
    return {
      entries: (res.Items ?? [])
        .filter(
          i => i['tenantId'] === tenantId && i['entityType'] === 'AuditLog'
        )
        .map(i => ({
          id: String(i['SK']),
          at: String(i['at']),
          action: String(i['action']),
          entityId: String(i['entityId'] ?? ''),
          actorId: String(i['actorId'] ?? ''),
          actorEmail: emails.get(String(i['actorId'])) ?? null,
          details: JSON.stringify(i['details'] ?? {}),
        })),
      nextToken: res.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString(
            'base64url'
          )
        : null,
    };
  },
});

// ─── CSV export ───────────────────────────────────────────────────────────────

type Row = Item;
const str = (k: string) => (r: Row) =>
  r[k] as string | number | null | undefined;

export const exportCsv = tenantOperation({
  name: 'exportCsv',
  entitlement: 'export.data',
  input: z.object({
    tenantId: z.string().min(1),
    farmId: z.string().refine(isUlid, 'must be a ULID'),
    kind: z.enum(EXPORT_KINDS),
  }),
  handler: async (input, ctx) => {
    const { tenantId } = ctx.access;
    const farm = await requireItem(
      keys.farm(tenantId, input.farmId),
      ctx,
      'Farm'
    );
    const pk = keys.farmPk(tenantId, input.farmId);
    const own = (i: Item) => i['tenantId'] === tenantId;
    const trees = (await queryPrefix(pk, keys.prefix.trees)).filter(
      t => own(t) && t['entityType'] === 'Tree'
    );
    let csv: string;

    if (input.kind === 'trees') {
      const cols: Column<Row>[] = [
        { header: 'Tree code', value: str('code') },
        { header: 'Label', value: str('displayLabel') },
        { header: 'Status', value: str('status') },
        { header: 'Variety', value: str('variety') },
        { header: 'Planted', value: str('plantedAt') },
        { header: 'Last plucked', value: str('lastHarvestDate') },
        { header: 'Latest sample size', value: str('latestSampleSize') },
        { header: 'Notes', value: str('notes') },
      ];
      csv = toCsv(
        [...trees].sort((a, b) =>
          String(a['code']).localeCompare(String(b['code']))
        ),
        cols
      );
    } else if (input.kind === 'harvests' || input.kind === 'samples') {
      const load = input.kind === 'harvests' ? treeHarvests : treeSamples;
      const rows = (
        await Promise.all(trees.map(t => load(ctx, String(t['id']))))
      )
        .flat()
        .filter(r => !r['deletedAt'])
        .sort((a, b) => String(a['SK']).localeCompare(String(b['SK'])));
      const cols: Column<Row>[] =
        input.kind === 'harvests'
          ? [
              { header: 'Date', value: str('harvestDate') },
              { header: 'Tree code', value: str('treeCode') },
              { header: 'Nuts', value: str('quantity') },
              { header: 'Quality', value: str('recordQuality') },
              { header: 'Source', value: str('source') },
              {
                header: 'Used for predictions',
                value: r => (r['excludeFromPrediction'] ? 'no' : 'yes'),
              },
              { header: 'Round id', value: str('roundId') },
              { header: 'Notes', value: str('notes') },
            ]
          : [
              { header: 'Date', value: str('sampledAt') },
              { header: 'Tree code', value: str('treeCode') },
              { header: 'Size', value: str('sizeClass') },
              { header: 'Weight', value: str('weight') },
              { header: 'Weight unit', value: str('weightUnit') },
              { header: 'Notes', value: str('notes') },
            ];
      csv = toCsv(rows, cols);
    } else if (input.kind === 'sales') {
      const sales = (await queryPrefix(pk, keys.prefix.sales)).filter(
        s => own(s) && s['entityType'] === 'Sale' && !s['deletedAt']
      );
      // One row per sale line, so size / price detail is kept
      const rows = sales.flatMap(s =>
        ((s['lines'] as Item[]) ?? []).map(
          (l, i): Row => ({ ...s, line: l, lineNo: i + 1 })
        )
      );
      const line = (k: string) => (r: Row) =>
        (r['line'] as Item)[k] as string | number | null;
      csv = toCsv(rows, [
        { header: 'Sale date', value: str('saleDate') },
        { header: 'Sale id', value: str('id') },
        { header: 'Buyer', value: str('buyerName') },
        { header: 'Crop', value: str('cropCode') },
        { header: 'Line', value: str('lineNo') },
        { header: 'Size', value: line('sizeClass') },
        { header: 'Quantity', value: line('quantity') },
        { header: 'Unit', value: str('quantityUnit') },
        { header: 'Unit price', value: line('unitPrice') },
        { header: 'Line amount', value: line('lineAmount') },
        { header: 'Sale calculated total', value: str('calculatedAmount') },
        { header: 'Sale amount received', value: str('actualAmountReceived') },
        { header: 'Currency', value: str('currency') },
        {
          header: 'Source',
          value: r => (r['backfilled'] ? String(r['source']) : 'LIVE_APP'),
        },
      ]);
    } else {
      const batches = (await queryPrefix(pk, keys.prefix.batches)).filter(own);
      const rows = (
        await Promise.all(
          batches.map(b =>
            queryPrefix(
              keys.produceTxn(tenantId, String(b['id']), '0000-00-00', 'x').PK,
              'TX#'
            ).then(txns =>
              txns.map(
                (x): Row => ({
                  ...x,
                  cropCode: b['cropCode'],
                  batchDate: b['batchDate'],
                })
              )
            )
          )
        )
      )
        .flat()
        .sort((a, b) =>
          String(a['transactionDate']).localeCompare(
            String(b['transactionDate'])
          )
        );
      csv = toCsv(rows, [
        { header: 'Date', value: str('transactionDate') },
        { header: 'Crop', value: str('cropCode') },
        { header: 'Batch date', value: str('batchDate') },
        { header: 'Movement', value: str('transactionType') },
        { header: 'Quantity', value: str('quantity') },
        { header: 'Unit', value: str('unit') },
        { header: 'State', value: str('state') },
        { header: 'From state', value: str('fromState') },
        { header: 'To state', value: str('toState') },
        { header: 'Reason', value: str('reason') },
        { header: 'Notes', value: str('notes') },
      ]);
    }
    return {
      filename: exportFilename(
        input.kind,
        String(farm['name'] ?? 'farm'),
        ctx.now.slice(0, 10)
      ),
      csv,
    };
  },
});
