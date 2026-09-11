import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  it('ゲーム開始後もヘッダーの ? からルールを開ける', async () => {
    render(<App />);
    const free = await screen.findByLabelText('mode-free');
    await waitFor(() => expect(free).not.toBeDisabled());
    fireEvent.click(free);
    await screen.findByLabelText('cell-7-7');

    fireEvent.click(screen.getByRole('button', { name: 'ルールを見る' }));
    expect(screen.getByRole('dialog', { name: 'RULES' })).toBeInTheDocument();
  });

  // ActionBar は COM の手番中に親ごと pointer-events-none になる。
  // ルールの導線をそこに置くと思考中に読めなくなるので、ヘッダーにあることを固定する
  it('COM の思考中でもルールを開ける', async () => {
    render(<App />);
    const easy = await screen.findByLabelText('mode-com-easy');
    await waitFor(() => expect(easy).not.toBeDisabled());
    fireEvent.click(easy);

    fireEvent.click(screen.getByText('PASS'));
    await screen.findByText('🤖 COM 思考中…');

    const rulesButton = screen.getByRole('button', { name: 'ルールを見る' });
    // jsdom は pointer-events を fireEvent.click に反映しないので、クリックが通ること
    // だけでは配置場所を保証できない。無効化される祖先の下に無いことを直接見る
    expect(rulesButton.closest('.pointer-events-none')).toBeNull();

    fireEvent.click(rulesButton);
    expect(screen.getByRole('dialog', { name: 'RULES' })).toBeInTheDocument();
  });
});
