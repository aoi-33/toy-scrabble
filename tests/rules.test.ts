import { describe, it, expect } from 'vitest';
import { detectDirection } from '../src/game/rules';
import type { Letter, PendingPlacement, Tile } from '../src/game/types';

const T = (letter: string): Tile =>
  ({ kind: 'letter', letter: letter as Letter, points: 1 });

const P = (r: number, c: number, l: string): PendingPlacement =>
  ({ coord: { r, c }, tile: T(l), rackIndex: 0 });

describe('detectDirection', () => {
  it('returns H for placements all in same row', () => {
    const ps = [P(7, 5, 'C'), P(7, 6, 'A'), P(7, 7, 'T')];
    expect(detectDirection(ps)).toBe('H');
  });
  it('returns V for placements all in same column', () => {
    const ps = [P(5, 7, 'C'), P(6, 7, 'A'), P(7, 7, 'T')];
    expect(detectDirection(ps)).toBe('V');
  });
  it('returns H for single placement (conventional)', () => {
    const ps = [P(7, 7, 'A')];
    expect(detectDirection(ps)).toBe('H');
  });
  it('returns null for placements not on a single line', () => {
    const ps = [P(7, 5, 'C'), P(8, 6, 'A')];
    expect(detectDirection(ps)).toBeNull();
  });
});

import { validatePlacement } from '../src/game/rules';
import { createEmptyBoard } from '../src/game/board';
import { createDictionaryFromText } from '../src/game/dictionary';
import type { Board } from '../src/game/types';

const dict = createDictionaryFromText('CAT\nCATS\nAT\nBAT\nCAB\nCABS\nAB\n');

function place(board: Board, r: number, c: number, letter: string, turn = 1): Board {
  const b = board.map(row => [...row]);
  b[r][c] = { tile: { kind: 'letter', letter: letter as Letter, points: 1 }, placedTurn: turn };
  return b;
}

describe('validatePlacement — geometry', () => {
  it('fails on empty placements', () => {
    const res = validatePlacement(createEmptyBoard(), [], dict, true);
    expect(res.ok).toBe(false);
  });

  it('fails when placements not on a straight line', () => {
    const ps = [P(7, 7, 'C'), P(8, 8, 'A')];
    const res = validatePlacement(createEmptyBoard(), ps, dict, true);
    expect(res.ok).toBe(false);
  });

  it('fails on first move when placements do not cover center', () => {
    const ps = [P(0, 0, 'C'), P(0, 1, 'A'), P(0, 2, 'T')];
    const res = validatePlacement(createEmptyBoard(), ps, dict, true);
    expect(res.ok).toBe(false);
  });

  it('succeeds on first move through center forming a valid word', () => {
    const ps = [P(7, 6, 'C'), P(7, 7, 'A'), P(7, 8, 'T')];
    const res = validatePlacement(createEmptyBoard(), ps, dict, true);
    expect(res.ok).toBe(true);
  });

  it('fails when placements have gaps not filled by existing tiles', () => {
    const ps = [P(7, 6, 'C'), P(7, 8, 'T')];
    const res = validatePlacement(createEmptyBoard(), ps, dict, true);
    expect(res.ok).toBe(false);
  });

  it('fails on second move when new tiles are not adjacent to any existing tile', () => {
    let b = createEmptyBoard();
    b = place(b, 7, 7, 'A');
    const ps = [P(0, 0, 'C'), P(0, 1, 'A'), P(0, 2, 'T')];
    const res = validatePlacement(b, ps, dict, false);
    expect(res.ok).toBe(false);
  });

  it('fails when a formed word is not in the dictionary', () => {
    const ps = [P(7, 6, 'X'), P(7, 7, 'Y'), P(7, 8, 'Z')];
    const res = validatePlacement(createEmptyBoard(), ps, dict, true);
    expect(res.ok).toBe(false);
  });
});
