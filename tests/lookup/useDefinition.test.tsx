import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDefinition } from '../../src/lookup/useDefinition';
import type { DictLoader } from '../../src/lookup/dictLoader';
import type { LookupResult } from '../../src/lookup/types';

const FOUND: LookupResult = {
  kind: 'found',
  word: 'CAT',
  base: null,
  english: [['n', 'feline mammal']],
  japanese: ['猫'],
};

function loaderOf(...results: LookupResult[]): DictLoader & { lookup: ReturnType<typeof vi.fn> } {
  let call = 0;
  const lookup = vi.fn(async () => results[Math.min(call++, results.length - 1)]);
  return { lookup };
}

describe('useDefinition', () => {
  it('最初は loading で、解決後に結果を返す', async () => {
    const loader = loaderOf(FOUND);
    const { result } = renderHook(() => useDefinition(loader, 'CAT'));
    expect(result.current.state).toEqual({ kind: 'loading' });
    await waitFor(() => expect(result.current.state).toEqual(FOUND));
  });

  it('not-found をそのまま渡す', async () => {
    const loader = loaderOf({ kind: 'not-found' });
    const { result } = renderHook(() => useDefinition(loader, 'ZZZZ'));
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'not-found' }));
  });

  it('retry で引き直す', async () => {
    const loader = loaderOf({ kind: 'error' }, FOUND);
    const { result } = renderHook(() => useDefinition(loader, 'CAT'));
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'error' }));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state).toEqual(FOUND));
    expect(loader.lookup).toHaveBeenCalledTimes(2);
  });

  it('語が変わったら引き直す', async () => {
    const loader = loaderOf(FOUND);
    const { result, rerender } = renderHook(({ word }) => useDefinition(loader, word), {
      initialProps: { word: 'CAT' },
    });
    await waitFor(() => expect(result.current.state.kind).toBe('found'));
    rerender({ word: 'DOG' });
    await waitFor(() => expect(loader.lookup).toHaveBeenCalledTimes(2));
  });
});
