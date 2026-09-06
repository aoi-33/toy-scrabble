import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../../src/ui/useMediaQuery';

type Listener = (e: { matches: boolean }) => void;

function stubMatchMedia(initial: boolean) {
  const listeners: Listener[] = [];
  const mql = {
    matches: initial,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: (_: string, fn: Listener) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    emit(matches: boolean) {
      mql.matches = matches;
      for (const fn of [...listeners]) fn({ matches });
    },
    listenerCount: () => listeners.length,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('初期状態の matches を返す', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 769px)'));
    expect(result.current).toBe(true);
  });

  it('メディアクエリの変化に追従する', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 769px)'));
    expect(result.current).toBe(false);
    act(() => media.emit(true));
    expect(result.current).toBe(true);
  });

  it('アンマウント時にリスナーを外す', () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 769px)'));
    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});
