import { describe, it, expect } from 'vitest';
import { boardToSnapshot, rackToSnapshot } from '../../src/ai/snapshot';
import { createEmptyBoard } from '../../src/game/board';
import type { Tile } from '../../src/game/types';

describe('boardToSnapshot', () => {
  it('empties become null, letter tiles become uppercase, blank tiles become lowercase', () => {
    const b = createEmptyBoard();
    b[7][7] = { tile: { kind: 'letter', letter: 'A', points: 1 }, placedTurn: 1 };
    b[7][8] = { tile: { kind: 'blank', assigned: 'B', points: 0 }, placedTurn: 1 };
    const snap = boardToSnapshot(b);
    expect(snap[7][7]).toBe('A');
    expect(snap[7][8]).toBe('b');
    expect(snap[0][0]).toBeNull();
  });
});

describe('rackToSnapshot', () => {
  it('maps letter tiles to uppercase letters and blanks to "BLANK"', () => {
    const rack: Tile[] = [
      { kind: 'letter', letter: 'A', points: 1 },
      { kind: 'blank', assigned: null, points: 0 },
    ];
    expect(rackToSnapshot(rack)).toEqual(['A', 'BLANK']);
  });
});
