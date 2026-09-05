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
