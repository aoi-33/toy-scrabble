import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => ({ state: 'ready' as const, requestMove: vi.fn() }),
}));

import App from '../../src/App';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('キーボードショートカット', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => 'CAT\nDOG\n' }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function startAndPlaceOneTile() {
    render(<App />);
    const free = await screen.findByLabelText('mode-free');
    await waitFor(() => expect(free).not.toBeDisabled());
    fireEvent.click(free);
    await screen.findByLabelText('cell-7-7');
    // 手札は毎回ランダムなので、ブランク（"?" 表示）以外を選ぶ。
    // ブランクだと文字選択シートが開いて pending の確定が止まる。
    const tile = [0, 1, 2, 3, 4, 5, 6]
      .map(i => screen.getByLabelText(`rack-${i}`))
      .find(btn => !btn.textContent?.includes('?'));
    if (!tile) throw new Error('ブランク以外の手札が見つからない');
    fireEvent.click(tile);
    fireEvent.click(screen.getByLabelText('cell-7-7'));
  }

  it('PC では Escape で仮配置を戻す', async () => {
    stubMatchMedia(true);
    await startAndPlaceOneTile();
    await waitFor(() => expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled());
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'RECALL' })).toBeDisabled());
  });

  it('モバイルではキー操作を受け付けない', async () => {
    stubMatchMedia(false);
    await startAndPlaceOneTile();
    await waitFor(() => expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled();
  });

  it('キーの押しっぱなしでは発火しない', async () => {
    stubMatchMedia(true);
    await startAndPlaceOneTile();
    await waitFor(() => expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled());
    fireEvent.keyDown(window, { key: 'Escape', repeat: true });
    expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled();
  });

  it('修飾キーとの同時押しは無視する', async () => {
    stubMatchMedia(true);
    await startAndPlaceOneTile();
    await waitFor(() => expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled());
    fireEvent.keyDown(window, { key: 'Escape', metaKey: true });
    expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled();
  });

  it('ボタンにフォーカスがあるときの Enter は PLAY を起こさない', async () => {
    stubMatchMedia(true);
    await startAndPlaceOneTile();
    const shuffle = screen.getByRole('button', { name: 'SHUFFLE' });
    shuffle.focus();
    fireEvent.keyDown(window, { key: 'Enter' });
    // PLAY が走っていれば仮配置が確定 or エラーで pending が変化する。
    // ここでは走っていないので RECALL は有効なまま。
    expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled();
  });

  it('EXCHANGE シート表示中の Escape は仮配置を消さない', async () => {
    stubMatchMedia(true);
    await startAndPlaceOneTile();
    fireEvent.click(screen.getByRole('button', { name: 'EXCHANGE' }));
    await screen.findByRole('dialog', { name: '交換するタイルを選択' });
    fireEvent.keyDown(window, { key: 'Escape' });
    // Sheet が閉じる
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // 仮配置は残っている（RECALL が有効なまま）
    expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled();
  });

  it('ルール表示中の Enter は PLAY を起こさない', async () => {
    stubMatchMedia(true);
    await startAndPlaceOneTile();

    fireEvent.click(screen.getByRole('button', { name: 'ルールを見る' }));
    await screen.findByRole('dialog', { name: 'RULES' });

    fireEvent.keyDown(window, { key: 'Enter' });

    // PLAY が走っていれば 1 文字の仮配置が検証されてエラーが出る
    expect(screen.queryByText('1 文字だけでは単語になりません')).toBeNull();
  });
});
