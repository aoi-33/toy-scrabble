import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => ({ state: 'ready' as const, requestMove: vi.fn() }),
}));

import App from '../../src/App';

describe('App の辞書表示', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => 'CAT\nDOG\n' }));
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function startFreePlay() {
    render(<App />);
    const free = await screen.findByLabelText('mode-free');
    await waitFor(() => expect(free).not.toBeDisabled());
    fireEvent.click(free);
    await screen.findByLabelText('cell-7-7');
  }

  it('起動直後は辞書シートが開いていない', async () => {
    await startFreePlay();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('履歴が無いうちは単語チップが出ない', async () => {
    await startFreePlay();
    expect(screen.queryByRole('button', { name: / の意味を見る/ })).not.toBeInTheDocument();
  });

  it('辞書バケットを取りに行かない（単語をタップするまで fetch しない）', async () => {
    await startFreePlay();
    // eslint-disable-next-line no-undef
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    // mock.calls の要素は any[] なのでタプル分解は strict で通らない。先頭要素を直接見る
    expect(calls.every((call: unknown[]) => !String(call[0]).includes('dict/defs/'))).toBe(true);
  });
});
