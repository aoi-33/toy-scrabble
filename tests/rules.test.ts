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
