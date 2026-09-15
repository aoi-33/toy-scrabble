import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadSave, saveGame, clearSave } from '../src/state/saveGame';
import { reducer, createInitialState } from '../src/game/reducer';
import { createDictionaryFromText } from '../src/game/dictionary';
import { seededRng } from '../src/game/bag';

// saveGame.ts の外から見たキーは外部契約なので、テスト側にも直接書いて固定する
const KEY = 'toy-scrabble:save';

const dict = createDictionaryFromText('CAT\nDOG\n');

function playingState() {
  return reducer(createInitialState({ seed: 1, dict }), {
    type: 'START_GAME',
    mode: 'com-hard',
    rng: seededRng(1),
  });
}

describe('saveGame / loadSave', () => {
  beforeEach(() => {
    localStorage.clear();
    // 壊れたセーブのテストで console.warn が出るので黙らせる
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('保存したものをそのまま読み戻せる', () => {
    const state = playingState();
    saveGame(state);
    expect(loadSave()).toEqual(state);
  });

  it('保存が無ければ null を返す', () => {
    expect(loadSave()).toBeNull();
  });

  it('version が違うセーブは null を返し、キーも消す', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 999, state: playingState() }));
    expect(loadSave()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('壊れた JSON は null を返し、キーも消す', () => {
    localStorage.setItem(KEY, '{壊れている');
    expect(loadSave()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('status が playing でないセーブは null を返す', () => {
    const setup = createInitialState({ seed: 1, dict });
    localStorage.setItem(KEY, JSON.stringify({ version: 1, state: setup }));
    expect(loadSave()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('board が 15x15 でないセーブは null を返す', () => {
    const broken = { ...playingState(), board: [[null]] };
    localStorage.setItem(KEY, JSON.stringify({ version: 1, state: broken }));
    expect(loadSave()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('setItem が例外を投げても saveGame は throw しない', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveGame(playingState())).not.toThrow();
  });

  it('clearSave はセーブを消す', () => {
    saveGame(playingState());
    clearSave();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
