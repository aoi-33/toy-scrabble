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
    const next = reducer(initial, { type: 'START_GAME', mode: 'free' });
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
  const initial = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });

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
    const s0 = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
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
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
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
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
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
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
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
    s = reducer(s, { type: 'START_GAME', mode: 'free' });
    s = { ...s, bag: s.bag.slice(0, 6) };
    const next = reducer(s, { type: 'EXCHANGE', indices: [0], rng: seededRng(1) });
    expect(next.lastError).toBeTruthy();
    expect(next.players[0].rack).toHaveLength(7);
    expect(next.currentPlayerIndex).toBe(0);
  });
});

describe('reducer / PASS', () => {
  it('increments consecutivePasses and switches turn', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
    s = reducer(s, { type: 'PASS' });
    expect(s.consecutivePasses).toBe(1);
    expect(s.currentPlayerIndex).toBe(1);
    s = reducer(s, { type: 'PASS' });
    expect(s.consecutivePasses).toBe(2);
  });

  it('ends game after 6 consecutive passes', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
    for (let i = 0; i < 6; i++) s = reducer(s, { type: 'PASS' });
    expect(s.status).toBe('ended');
  });

  it('ends game when a player empties rack and bag is empty', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
    s = { ...s, bag: [], players: [{ ...s.players[0], rack: [] }, s.players[1]] };
    s = reducer(s, { type: 'PASS' });
    expect(s.status).toBe('ended');
  });
});

describe('reducer / ASSIGN_BLANK', () => {
  it('assigns a letter to a pending blank tile', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'free' });
    const blank: Tile = { kind: 'blank', assigned: null, points: 0 };
    s = { ...s, players: [{ ...s.players[0], rack: [blank] }, s.players[1]] };
    s = reducer(s, { type: 'PLACE_PENDING', placement: { coord: { r: 7, c: 7 }, tile: blank, rackIndex: 0 } });
    s = reducer(s, { type: 'ASSIGN_BLANK', r: 7, c: 7, letter: 'A' });
    expect(s.pending[0].tile).toMatchObject({ kind: 'blank', assigned: 'A' });
  });
});
