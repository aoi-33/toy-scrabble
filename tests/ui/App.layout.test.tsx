import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => ({ state: 'ready' as const, requestMove: vi.fn() }),
}));

import App from '../../src/App';

describe('App のモバイルレイアウト', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => 'CAT\nDOG\n' }));
    // Task 10 で App が matchMedia を使うようになる。jsdom は未実装なので先に入れておく
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

  it('盤面を横スクロールできるコンテナで包む', async () => {
    await startFreePlay();
    const scroller = screen.getByTestId('board-scroller');
    expect(scroller.className).toContain('overflow-x-auto');
  });

  it('手札と操作ボタンを画面下部に固定する', async () => {
    await startFreePlay();
    const footer = screen.getByTestId('play-footer');
    expect(footer.className).toContain('sticky');
    expect(footer.className).toContain('bottom-0');
    // 手札と ActionBar が両方フッター内にある
    expect(footer.querySelector('[data-testid="rack-tiles"]')).not.toBeNull();
    expect(footer.textContent).toContain('PLAY');
  });

  it('sticky フッターが overflow を持つ要素の内側に入っていない', async () => {
    await startFreePlay();
    const footer = screen.getByTestId('play-footer');
    // position:sticky は overflow:auto/hidden の子孫では効かない。
    // 盤面の横スクロールラッパの中にフッターを入れてしまう事故を防ぐ。
    expect(screen.getByTestId('board-scroller').contains(footer)).toBe(false);
  });

  it('モバイルのアドレスバーを考慮して dvh を使う', async () => {
    await startFreePlay();
    const shell = screen.getByTestId('app-shell');
    // 100vh だとモバイルでアドレスバーの裏にフッターが隠れる
    expect(shell.className).toContain('min-h-[100dvh]');
    expect(shell.className).not.toContain('min-h-screen');
  });
});
