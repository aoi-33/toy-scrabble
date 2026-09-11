import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState, useCallback } from 'react';
import type { Move } from '../../src/game/types';

const requestMove = vi.fn<(snapshot: unknown, difficulty: unknown) => Promise<Move>>();

// COM 思考中の表示を再現するため、実ワーカーと同じ状態遷移を持つ mock を使う
vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => {
    const [state, setState] = useState<'ready' | 'thinking'>('ready');
    const request = useCallback((snapshot: unknown, difficulty: unknown) => {
      setState('thinking');
      const promise = requestMove(snapshot, difficulty);
      promise.then(() => setState('ready'));
      return promise;
    }, []);
    return { state, requestMove: request };
  },
}));

import App from '../../src/App';

describe('App のルール表示', () => {
  beforeEach(() => {
    requestMove.mockReset();
    // 解決しない Promise を返して thinking のまま留める
    requestMove.mockImplementation(() => new Promise<Move>(() => {}));
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
  });

  it('モード選択画面に RULES ボタンがある', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: 'RULES' })).toBeInTheDocument();
  });

  it('起動直後はルールが開いていない', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'RULES' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('RULES を押すとルールのダイアログが開く', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'RULES' }));
    expect(screen.getByRole('dialog', { name: 'RULES' })).toBeInTheDocument();
    expect(screen.getByText(/同じ行か同じ列に一直線/)).toBeInTheDocument();
  });

  it('閉じるとダイアログが消える', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'RULES' }));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
