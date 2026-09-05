import type { Difficulty } from './types';
import type { GeneratedMove } from './search';
import type { Rng } from '../game/bag';

export function selectMove(
  candidates: GeneratedMove[],
  difficulty: Difficulty,
  rng: Rng,
): GeneratedMove | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => b.score - a.score);

  switch (difficulty) {
    case 'hard':
      return sorted[0];
    case 'medium': {
      const cutoff = Math.max(1, Math.ceil(sorted.length * 0.3));
      const pool = sorted.slice(0, cutoff);
      return pool[Math.floor(rng() * pool.length)];
    }
    case 'easy': {
      const startIdx = Math.floor(sorted.length / 2);
      const pool = sorted.slice(startIdx);
      return pool[Math.floor(rng() * pool.length)];
    }
  }
}
