import { describe, it, expect } from 'vitest';
import { reducer, createInitialState } from '../src/game/reducer';
import { createDictionaryFromText } from '../src/game/dictionary';

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
