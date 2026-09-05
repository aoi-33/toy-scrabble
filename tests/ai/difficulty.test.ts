import { describe, it, expect } from 'vitest';
import { selectMove } from '../../src/ai/difficulty';
import type { GeneratedMove } from '../../src/ai/search';
import { seededRng } from '../../src/game/bag';

const mkMove = (word: string, score: number): GeneratedMove => ({
  word, score, placements: [],
});

describe('selectMove', () => {
  const moves = [
    mkMove('A', 1), mkMove('B', 2), mkMove('C', 3), mkMove('D', 4),
    mkMove('E', 5), mkMove('F', 6), mkMove('G', 7), mkMove('H', 8),
    mkMove('I', 9), mkMove('J', 10),
  ];

  it('Hard always picks the highest-scoring move', () => {
    const picked = selectMove(moves, 'hard', seededRng(1));
    expect(picked?.word).toBe('J');
  });

  it('Easy picks from bottom 50%', () => {
    const rng = seededRng(1);
    const picks = Array.from({ length: 30 }, () => selectMove(moves, 'easy', rng));
    for (const p of picks) {
      expect(p!.score).toBeLessThanOrEqual(5);
    }
  });

  it('Medium picks from top 30%', () => {
    const rng = seededRng(1);
    const picks = Array.from({ length: 30 }, () => selectMove(moves, 'medium', rng));
    for (const p of picks) {
      expect(p!.score).toBeGreaterThanOrEqual(8);
    }
  });

  it('returns null when candidates array is empty', () => {
    expect(selectMove([], 'hard', seededRng(1))).toBeNull();
  });
});
