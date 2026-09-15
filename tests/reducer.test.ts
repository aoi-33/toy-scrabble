import { describe, it, expect } from 'vitest';
import { reducer, createInitialState } from '../src/game/reducer';
import { createDictionaryFromText } from '../src/game/dictionary';
import { seededRng } from '../src/game/bag';

const dict = createDictionaryFromText('CAT\nCATS\nAT\nBAT\nCAB\nCABS\nAB\n');

describe('createInitialState', () => {
  it('has status "setup" before START_GAME', () => {
    const s = createInitialState({ seed: 1, dict });
    expect(s.status).toBe('setup');
    expect(s.board.flat().every(c => c === null)).toBe(true);
    expect(s.bag).toHaveLength(100);
    expect(s.players[0].rack).toHaveLength(0);
  });
});

describe('reducer / START_GAME', () => {
  it('deals 7 tiles to each player, sets status playing, currentPlayerIndex=0', () => {
    const initial = createInitialState({ seed: 1, dict });
    const next = reducer(initial, { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    expect(next.status).toBe('playing');
    expect(next.mode).toBe('free');
    expect(next.players[0].rack).toHaveLength(7);
    expect(next.players[1].rack).toHaveLength(7);
    expect(next.bag).toHaveLength(100 - 14);
    expect(next.currentPlayerIndex).toBe(0);
    expect(next.turn).toBe(1);
  });
});

describe('reducer / PLACE_PENDING & RECALL', () => {
  const initial = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });

  it('PLACE_PENDING adds to pending and removes from rack', () => {
    const tile = initial.players[0].rack[0];
    const next = reducer(initial, {
      type: 'PLACE_PENDING',
      placement: { coord: { r: 7, c: 7 }, tile, rackIndex: 0 },
    });
    expect(next.pending).toHaveLength(1);
    expect(next.players[0].rack).toHaveLength(6);
  });

  it('RECALL_ALL restores all pending tiles to rack', () => {
    const tile = initial.players[0].rack[0];
    const placed = reducer(initial, {
      type: 'PLACE_PENDING',
      placement: { coord: { r: 7, c: 7 }, tile, rackIndex: 0 },
    });
    const recalled = reducer(placed, { type: 'RECALL_ALL' });
    expect(recalled.pending).toHaveLength(0);
    expect(recalled.players[0].rack).toHaveLength(7);
  });

  it('RECALL_PENDING restores a single tile by coord', () => {
    const t0 = initial.players[0].rack[0];
    let s = reducer(initial, {
      type: 'PLACE_PENDING',
      placement: { coord: { r: 7, c: 7 }, tile: t0, rackIndex: 0 },
    });
    // Note: after first PLACE_PENDING, s.players[0].rack[0] is the ORIGINAL rack[1].
    const t1 = s.players[0].rack[0];
    s = reducer(s, {
      type: 'PLACE_PENDING',
      placement: { coord: { r: 7, c: 8 }, tile: t1, rackIndex: 0 },
    });
    const recalled = reducer(s, { type: 'RECALL_PENDING', coord: { r: 7, c: 7 } });
    expect(recalled.pending).toHaveLength(1);
    expect(recalled.players[0].rack).toHaveLength(6);
  });
});

describe('reducer / SHUFFLE_RACK', () => {
  it('reorders rack deterministically with same rng seed', () => {
    const s0 = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    const s1 = reducer(s0, { type: 'SHUFFLE_RACK', rng: seededRng(999) });
    const s2 = reducer(s0, { type: 'SHUFFLE_RACK', rng: seededRng(999) });
    expect(s1.players[0].rack).toEqual(s2.players[0].rack);
    expect(s1.players[0].rack).toHaveLength(7);
  });
});

import type { GameState, Letter, Tile } from '../src/game/types';
import { LETTER_POINTS } from '../src/game/board';

// Utility to force a specific rack for deterministic COMMIT tests
function withRack(state: GameState, playerIndex: 0 | 1, letters: string[]): GameState {
  const rack: Tile[] = letters.map(l => ({
    kind: 'letter',
    letter: l as Letter,
    points: LETTER_POINTS[l as Letter],
  }));
  const newPlayers = [...state.players] as GameState['players'];
  newPlayers[playerIndex] = { ...newPlayers[playerIndex], rack };
  return { ...state, players: newPlayers };
}

describe('reducer / COMMIT_PLAY', () => {
  it('places pending tiles on board, awards score, switches turn, redraws to 7', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    s = withRack(s, 0, ['C', 'A', 'T', 'X', 'Y', 'Z', 'Q']);
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 6 }, tile: s.players[0].rack[0], rackIndex: 0 } });
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 7 }, tile: s.players[0].rack[0], rackIndex: 0 } });
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 8 }, tile: s.players[0].rack[0], rackIndex: 0 } });

    const committed = reducer(s, { type: 'COMMIT_PLAY', dict });
    expect(committed.pending).toHaveLength(0);
    expect(committed.board[7][6]?.tile).toMatchObject({ letter: 'C' });
    expect(committed.board[7][7]?.tile).toMatchObject({ letter: 'A' });
    expect(committed.board[7][8]?.tile).toMatchObject({ letter: 'T' });
    expect(committed.players[0].score).toBeGreaterThan(0);
    expect(committed.players[0].rack).toHaveLength(7);
    expect(committed.currentPlayerIndex).toBe(1);
    expect(committed.turn).toBe(2);
    expect(committed.history).toHaveLength(1);
    expect(committed.consecutivePasses).toBe(0);
    expect(committed.lastFormedWords.map(w => w.word)).toContain('CAT');
  });

  it('sets lastError and does not change board on invalid word', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    s = withRack(s, 0, ['X', 'Y', 'Z', 'A', 'B', 'C', 'D']);
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 6 }, tile: s.players[0].rack[0], rackIndex: 0 } });
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 7 }, tile: s.players[0].rack[0], rackIndex: 0 } });
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 8 }, tile: s.players[0].rack[0], rackIndex: 0 } });

    const bad = reducer(s, { type: 'COMMIT_PLAY', dict });
    expect(bad.lastError).toBeTruthy();
    expect(bad.board.flat().every(c => c === null)).toBe(true);
    expect(bad.pending).toHaveLength(3);
    expect(bad.currentPlayerIndex).toBe(0);
  });
});

describe('reducer / EXCHANGE', () => {
  it('swaps selected rack tiles with new draws when bag has >= 7 tiles', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    const originalRack = [...s.players[0].rack];
    const beforeBag = s.bag.length;
    s = reducer(s, { type: 'EXCHANGE', indices: [0, 1, 2], rng: seededRng(7) });
    expect(s.players[0].rack).toHaveLength(7);
    expect(s.bag.length).toBe(beforeBag);
    expect(s.players[0].rack.slice(0, 4)).toEqual(originalRack.slice(3));
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.consecutivePasses).toBe(0);
  });

  it('rejects EXCHANGE when bag has < 7 tiles remaining', () => {
    let s = createInitialState({ seed: 1, dict });
    s = reducer(s, { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    s = { ...s, bag: s.bag.slice(0, 6) };
    const next = reducer(s, { type: 'EXCHANGE', indices: [0], rng: seededRng(1) });
    expect(next.lastError).toBeTruthy();
    expect(next.players[0].rack).toHaveLength(7);
    expect(next.currentPlayerIndex).toBe(0);
  });
});

describe('reducer / PASS', () => {
  it('increments consecutivePasses and switches turn', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    s = reducer(s, { type: 'PASS' });
    expect(s.consecutivePasses).toBe(1);
    expect(s.currentPlayerIndex).toBe(1);
    s = reducer(s, { type: 'PASS' });
    expect(s.consecutivePasses).toBe(2);
  });

  it('ends game after 6 consecutive passes', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    for (let i = 0; i < 6; i++) s = reducer(s, { type: 'PASS' });
    expect(s.status).toBe('ended');
  });

  it('ends game when a player empties rack and bag is empty', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    s = { ...s, bag: [], players: [{ ...s.players[0], rack: [] }, s.players[1]] };
    s = reducer(s, { type: 'PASS' });
    expect(s.status).toBe('ended');
  });
});

describe('reducer / COMMIT_AI_PLAY', () => {
  it('applies AI placements atomically and switches turn', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'com-medium', rng: seededRng(1) });
    s = withRack(s, 1, ['C', 'A', 'T', 'X', 'Y', 'Z', 'Q']);
    s = { ...s, currentPlayerIndex: 1 };
    const catTiles = s.players[1].rack.slice(0, 3);
    const placements = [
      { coord: { r: 7, c: 6 }, tile: catTiles[0], rackIndex: 0 },
      { coord: { r: 7, c: 7 }, tile: catTiles[1], rackIndex: 1 },
      { coord: { r: 7, c: 8 }, tile: catTiles[2], rackIndex: 2 },
    ];
    const next = reducer(s, { type: 'COMMIT_AI_PLAY', placements, dict });
    expect(next.board[7][6]?.tile).toMatchObject({ letter: 'C' });
    expect(next.players[1].score).toBeGreaterThan(0);
    expect(next.players[1].rack).toHaveLength(7);
    expect(next.currentPlayerIndex).toBe(0);
    expect(next.history).toHaveLength(1);
  });
});

describe('reducer / 終局判定', () => {
  it('COMMIT_PLAY で手札と袋が空になったら終局し、残タイルを精算する', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    s = withRack(s, 0, ['C', 'A', 'T']);
    s = withRack(s, 1, ['Q', 'Z']); // 10 + 10 点ぶんの残タイル
    s = { ...s, bag: [] };
    for (let i = 0; i < 3; i++) {
      s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 6 + i }, tile: s.players[0].rack[0], rackIndex: 0 } });
    }
    const scoreBefore = 0;
    s = reducer(s, { type: 'COMMIT_PLAY', dict });
    expect(s.status).toBe('ended');
    expect(s.players[0].rack).toHaveLength(0);
    // 相手の残 20 点を加算、相手は 20 点減点
    expect(s.players[0].score).toBe(scoreBefore + 5 * 2 + 20);
    expect(s.players[1].score).toBe(-20);
  });
});

describe('reducer / NEW GAME', () => {
  it('START_GAME は盤面と袋を作り直す', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    s = withRack(s, 0, ['C', 'A', 'T', 'X', 'Y', 'Z', 'Q']);
    for (let i = 0; i < 3; i++) {
      s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 6 + i }, tile: s.players[0].rack[0], rackIndex: 0 } });
    }
    s = reducer(s, { type: 'COMMIT_PLAY', dict });
    expect(s.board[7][7]).not.toBeNull();

    s = reducer(s, { type: 'START_GAME', mode: 'free', rng: seededRng(2) });
    expect(s.board.flat().every(c => c === null)).toBe(true);
    expect(s.bag).toHaveLength(100 - 14);
    expect(s.players[0].rack).toHaveLength(7);
    expect(s.players[1].rack).toHaveLength(7);
  });
});

describe('reducer / 仮配置を残したまま手番を終える', () => {
  function tileCount(s: GameState): number {
    return s.bag.length
      + s.players[0].rack.length
      + s.players[1].rack.length
      + s.pending.length
      + s.board.flat().filter(c => c !== null).length;
  }

  it('PASS は仮配置を現プレイヤーの手札へ戻す', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    const p1RackBefore = s.players[0].rack.length;
    const comRackBefore = s.players[1].rack.length;
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 7 }, tile: s.players[0].rack[0], rackIndex: 0 } });
    s = reducer(s, { type: 'PASS' });
    expect(s.pending).toHaveLength(0);
    expect(s.players[0].rack).toHaveLength(p1RackBefore);
    expect(s.players[1].rack).toHaveLength(comRackBefore);
    expect(tileCount(s)).toBe(100);
  });

  it('EXCHANGE は仮配置を失わない', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 7 }, tile: s.players[0].rack[0], rackIndex: 0 } });
    s = reducer(s, { type: 'EXCHANGE', indices: [0], rng: seededRng(3) });
    expect(s.pending).toHaveLength(0);
    expect(s.players[0].rack).toHaveLength(7);
    expect(tileCount(s)).toBe(100);
  });
});

describe('reducer / ASSIGN_BLANK', () => {
  it('assigns a letter to a pending blank tile', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    const blank: Tile = { kind: 'blank', assigned: null, points: 0 };
    s = { ...s, players: [{ ...s.players[0], rack: [blank] }, s.players[1]] };
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 7 }, tile: blank, rackIndex: 0 } });
    s = reducer(s, { type: 'ASSIGN_BLANK', r: 7, c: 7, letter: 'A' });
    expect(s.pending[0].tile).toMatchObject({ kind: 'blank', assigned: 'A' });
  });

  it('RECALL したブランクは指定文字が解除される', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free', rng: seededRng(1) });
    const blank: Tile = { kind: 'blank', assigned: null, points: 0 };
    s = { ...s, players: [{ ...s.players[0], rack: [blank] }, s.players[1]] };
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 7 }, tile: blank, rackIndex: 0 } });
    s = reducer(s, { type: 'ASSIGN_BLANK', r: 7, c: 7, letter: 'A' });
    s = reducer(s, { type: 'RECALL_PENDING', coord: { r: 7, c: 7 } });
    expect(s.players[0].rack[0]).toMatchObject({ kind: 'blank', assigned: null });

    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 7 }, tile: s.players[0].rack[0], rackIndex: 0 } });
    s = reducer(s, { type: 'ASSIGN_BLANK', r: 7, c: 7, letter: 'B' });
    s = reducer(s, { type: 'RECALL_ALL' });
    expect(s.players[0].rack[0]).toMatchObject({ kind: 'blank', assigned: null });
  });
});

describe('reducer / RESTORE_GAME', () => {
  it('渡された state をそのまま返す', () => {
    const initial = createInitialState({ seed: 1, dict });
    const saved = reducer(initial, { type: 'START_GAME', mode: 'com-hard', rng: seededRng(7) });

    const restored = reducer(initial, { type: 'RESTORE_GAME', state: saved });

    expect(restored).toEqual(saved);
    expect(restored.status).toBe('playing');
    expect(restored.mode).toBe('com-hard');
  });

  it('保存時のエラー表示は復元しない', () => {
    const initial = createInitialState({ seed: 1, dict });
    const saved = reducer(initial, { type: 'START_GAME', mode: 'com-hard', rng: seededRng(7) });

    const restored = reducer(initial, {
      type: 'RESTORE_GAME',
      state: { ...saved, lastError: 'CAT は辞書にありません' },
    });

    expect(restored.lastError).toBeNull();
  });
});
