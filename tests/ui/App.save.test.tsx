import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => ({ state: 'ready' as const, requestMove: vi.fn() }),
}));

import App from '../../src/App';

const KEY = 'toy-scrabble:save';

describe('App のセーブ', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => 'CAT\nDOG\n' }));
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  async function startFreePlay() {
    render(<App />);
    const free = await screen.findByLabelText('mode-free');
    await waitFor(() => expect(free).not.toBeDisabled());
    fireEvent.click(free);
    await screen.findByLabelText('cell-7-7');
  }

  it('ゲームを始めると進行状況が保存される', async () => {
    await startFreePlay();

    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    expect(saved.version).toBe(1);
    expect(saved.state.status).toBe('playing');
    expect(saved.state.mode).toBe('free');
  });

  it('ゲームが終わるとセーブが消える', async () => {
    await startFreePlay();
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());

    // 6 連続 PASS で終局する（reducer.ts:54）。confirm は true に stub 済み
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText('PASS'));
    }

    await screen.findByText('GAME OVER');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
