import { act, renderHook } from '@testing-library/react';
import { usePersistentState } from '../usePersistentState';

describe('usePersistentState (#104 drafts)', () => {
  beforeEach(() => localStorage.clear());

  it('survives a remount (reload) and clears once saved', () => {
    const first = renderHook(() =>
      usePersistentState<string[]>('round.new', [])
    );
    act(() => first.result.current[1](['t1', 't2']));
    first.unmount();
    const second = renderHook(() =>
      usePersistentState<string[]>('round.new', [])
    );
    expect(second.result.current[0]).toEqual(['t1', 't2']);
    act(() => second.result.current[2]());
    second.unmount();
    const third = renderHook(() =>
      usePersistentState<string[]>('round.new', [])
    );
    expect(third.result.current[0]).toEqual([]);
  });

  it('a null key is plain state', () => {
    const { result } = renderHook(() => usePersistentState<number>(null, 1));
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);
    expect(localStorage.length).toBe(0);
  });
});

describe('usePersistentState with a late key', () => {
  beforeEach(() => localStorage.clear());
  it('loads the stored draft when the key arrives, without overwriting it', () => {
    localStorage.setItem('farm.draft.round.f1', JSON.stringify(['t9']));
    const { result, rerender } = renderHook(
      ({ k }: { k: string | null }) => usePersistentState<string[]>(k, []),
      {
        initialProps: { k: null as string | null },
      }
    );
    expect(result.current[0]).toEqual([]);
    rerender({ k: 'round.f1' });
    expect(result.current[0]).toEqual(['t9']);
    expect(
      JSON.parse(localStorage.getItem('farm.draft.round.f1') ?? '[]')
    ).toEqual(['t9']);
  });
});
