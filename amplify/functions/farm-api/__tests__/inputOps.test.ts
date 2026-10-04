/**
 * @jest-environment node
 */
import type { AppSyncResolverEvent } from 'aws-lambda';
import { ulid } from 'ulid';
import { type InputTxn, inputBalance } from '../../../../src/domain/inputs';
import { SYSTEM_PROFILE_IDS } from '../../../../src/domain/rbac';
import { handler } from '../handler';
import { installFakeDdb } from './fakeDdb';

process.env['FARM_TABLE_NAME'] = 'FarmData-test';
const fake = installFakeDdb();

const T = '01J9ZQ3M5K8R2V7W4X6Y0A1B2C';
const F = '01J9ZQ3M5K8R2V7W4X6Y0A1B2E';
type Rec = Record<string, unknown>;
const call = (fieldName: string, args: Rec, sub = 'owner') =>
  handler({
    arguments: { tenantId: T, ...args },
    identity: { sub, claims: {} },
    info: { fieldName },
  } as unknown as AppSyncResolverEvent<Rec>) as Promise<Rec>;

let itemId = '';
const stored = () => [...fake.store.values()].find(i => i['id'] === itemId)!;
const txns = () =>
  [...fake.store.values()].filter(i => i['entityType'] === 'InputTxn');
const move = (type: string, quantity: number, extra: Rec = {}, sub = 'owner') =>
  call(
    'recordInputMovement',
    {
      itemId,
      operationId: ulid(),
      transactionType: type,
      quantity,
      transactionDate: '2026-10-04',
      ...extra,
    },
    sub
  );
function expectReconciled() {
  const sum = inputBalance(
    txns().map(
      t => ({ type: t['transactionType'], quantity: t['quantity'] }) as InputTxn
    )
  );
  expect(stored()['quantity']).toBe(sum);
}

beforeEach(async () => {
  fake.reset();
  await call('createTenant', {
    name: 'X',
    defaultTimezone: 'Asia/Colombo',
    defaultCurrency: 'LKR',
    defaultLocale: 'en',
    farmId: F,
    farmName: 'F',
  });
  itemId = ulid();
  await call('createInputItem', {
    farmId: F,
    itemId,
    name: 'Urea',
    category: 'FERTILIZER',
    unit: 'KG',
    reorderLevel: 5,
    openingQuantity: 25,
  });
});

describe('farm-input items (#80, AC-IN-005)', () => {
  it('opening stock is a STOCK_IN transaction; creating twice is idempotent', async () => {
    expect(stored()).toMatchObject({ quantity: 25, status: 'ACTIVE' });
    await call('createInputItem', {
      farmId: F,
      itemId,
      name: 'Urea',
      category: 'FERTILIZER',
      unit: 'KG',
      openingQuantity: 25,
    });
    expect(txns()).toHaveLength(1);
    expectReconciled();
  });

  it('stock in, use and signed adjustments keep quantity = Σ transactions', async () => {
    await move('STOCK_IN', 10.5);
    await move('STOCK_OUT', 12.25);
    await move('ADJUSTMENT', 0.25, { decrease: true, reason: 'Spilled' });
    expect(stored()['quantity']).toBe(23);
    expectReconciled();
  });

  it('a retried movement lands once', async () => {
    const operationId = ulid();
    await move('STOCK_OUT', 3, { operationId });
    await move('STOCK_OUT', 3, { operationId });
    expect(stored()['quantity']).toBe(22);
    expect(txns()).toHaveLength(2);
  });

  it('never below zero; adjustments need a reason', async () => {
    await expect(move('STOCK_OUT', 26)).rejects.toThrow(
      /^VALIDATION: quantity: only 25 kg/
    );
    await expect(move('ADJUSTMENT', 1)).rejects.toThrow(/^VALIDATION: reason/);
  });

  it('flags low stock at or below the reorder level', async () => {
    await move('STOCK_OUT', 20);
    const [item] = (await call('listInputItems', { farmId: F })) as Rec[];
    expect(item).toMatchObject({ quantity: 5, lowStock: true });
  });

  it('never touches produce stock', async () => {
    await move('STOCK_OUT', 1);
    expect(
      [...fake.store.values()].filter(i =>
        String(i['entityType']).startsWith('Produce')
      )
    ).toEqual([]);
  });

  it('archived items are hidden and frozen; the reorder level can be cleared', async () => {
    const v = stored()['version'] as number;
    const cleared = await call('updateInputItem', {
      itemId,
      expectedVersion: v,
      clearReorderLevel: true,
    });
    expect(cleared).toMatchObject({ reorderLevel: null, lowStock: false });
    await call('updateInputItem', {
      itemId,
      expectedVersion: v + 1,
      status: 'ARCHIVED',
    });
    expect(await call('listInputItems', { farmId: F })).toEqual([]);
    await expect(move('STOCK_IN', 1)).rejects.toThrow(/^VALIDATION: item/);
  });

  it('history is newest first and paginated', async () => {
    await move('STOCK_OUT', 1, { transactionDate: '2026-10-05' });
    await move('STOCK_OUT', 1, { transactionDate: '2026-10-06' });
    const page = await call('getInputItem', { itemId, limit: 2 });
    expect(
      (page['transactions'] as Rec[]).map(t => t['transactionDate'])
    ).toEqual(['2026-10-06', '2026-10-05']);
    const next = await call('getInputItem', {
      itemId,
      limit: 2,
      nextToken: page['nextToken'],
    });
    expect(next['transactions'] as Rec[]).toHaveLength(1);
  });

  it('needs input.manage: a viewer can see stock but not change it', async () => {
    fake.put({
      PK: `T#${T}`,
      SK: 'MEMBER#viewer',
      tenantId: T,
      userId: 'viewer',
      profileId: SYSTEM_PROFILE_IDS.viewer,
      status: 'ACTIVE',
    });
    await expect(
      call('listInputItems', { farmId: F }, 'viewer')
    ).resolves.toHaveLength(1);
    await expect(move('STOCK_OUT', 1, {}, 'viewer')).rejects.toThrow(
      /^FORBIDDEN/
    );
  });
});
