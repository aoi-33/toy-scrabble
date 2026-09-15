import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => ({ state: 'ready' as const, requestMove: vi.fn() }),
}));

import App from '../../src/App';
import { reducer, createInitialState } from '../../src/game/reducer';
import { createDictionaryFromText } from '../../src/game/dictionary';
import { seededRng } from '../../src/game/bag';

const KEY = 'toy-scrabble:save';

/** 再開できるセーブを localStorage に置く。render() より前に呼ぶこと */
function seedSave() {
  const dict = createDictionaryFromText('CAT\nDOG\n');
  const state = reducer(createInitialState({ seed: 1, dict }), {
    type: 'START_GAME',
    mode: 'com-hard',
    rng: seededRng(1),
  });
  localStorage.setItem(KEY, JSON.stringify({ version: 1, state }));
  return state;
}

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

  it('セーブが無ければ CONTINUE を出さない', async () => {
    render(<App />);
    await screen.findByLabelText('mode-free');
    expect(screen.queryByLabelText('continue-game')).toBeNull();
  });

  it('セーブがあれば CONTINUE を出し、モード名と手数を見せる', async () => {
    const saved = seedSave();
    render(<App />);

    const button = await screen.findByLabelText('continue-game');
    expect(button.textContent).toContain('CONTINUE');
    expect(button.textContent).toContain('COM HARD');
    expect(button.textContent).toContain(`${saved.turn} 手目`);
  });

  it('辞書の読み込み中は CONTINUE を押せない', async () => {
    seedSave();
    render(<App />);
    // fetch の解決前は dict が null。復帰しても盤面を描けないので押させない
    expect(screen.getByLabelText('continue-game')).toBeDisabled();
  });

  it('CONTINUE を押すと保存された盤面に戻る', async () => {
    seedSave();
    render(<App />);

    const button = await screen.findByLabelText('continue-game');
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await screen.findByLabelText('cell-7-7');
    expect(screen.queryByLabelText('mode-free')).toBeNull();
  });
});
