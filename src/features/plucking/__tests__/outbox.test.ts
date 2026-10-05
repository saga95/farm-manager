import { flushOutbox, harvestOutbox } from '../outbox';

const entry = (
  treeId: string,
  quantity: number,
  harvestId = `h-${treeId}`
) => ({
  tenantId: 't',
  roundId: 'r1',
  treeId,
  harvestId,
  quantity,
  approximate: false,
});

describe('capture outbox (#103)', () => {
  beforeEach(() => {
    localStorage.clear();
    harvestOutbox.reset();
  });

  it('keeps counts on the phone; an edit keeps the first id (no duplicates)', () => {
    harvestOutbox.put(entry('a', 12, 'first'));
    harvestOutbox.put(entry('a', 14, 'second'));
    expect(harvestOutbox.list()).toEqual([
      expect.objectContaining({
        harvestId: 'first',
        quantity: 14,
        state: 'PENDING',
      }),
    ]);
    expect(
      JSON.parse(localStorage.getItem('farm.outbox.harvests.v1') ?? '[]')
    ).toHaveLength(1);
  });

  it('sends oldest first, stops while still offline, and resumes later', async () => {
    harvestOutbox.put(entry('a', 12));
    harvestOutbox.put(entry('b', 9));
    const send = jest
      .fn()
      .mockResolvedValueOnce({ result: 'SENT' })
      .mockResolvedValueOnce({ result: 'OFFLINE' });
    const first = await flushOutbox(send);
    expect(first.sent.map(e => e.treeId)).toEqual(['a']);
    expect(first.remaining).toBe(1);
    expect(harvestOutbox.list()[0]).toMatchObject({
      treeId: 'b',
      attempts: 1,
      state: 'PENDING',
    });
    const second = await flushOutbox(
      jest.fn().mockResolvedValue({ result: 'SENT' })
    );
    expect(second.sent.map(e => e.harvestId)).toEqual(['h-b']);
    expect(harvestOutbox.list()).toEqual([]);
  });

  it('a refused count stays visible with the reason and is not resent', async () => {
    harvestOutbox.put(entry('a', 12));
    await flushOutbox(async () => ({
      result: 'REFUSED',
      error: 'Round is no longer open',
    }));
    expect(harvestOutbox.list()[0]).toMatchObject({
      state: 'FAILED',
      error: 'Round is no longer open',
    });
    const send = jest.fn();
    await flushOutbox(send);
    expect(send).not.toHaveBeenCalled();
  });
});
