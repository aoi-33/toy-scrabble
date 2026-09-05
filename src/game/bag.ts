import type { Tile, Letter } from './types';
import { LETTER_POINTS, LETTER_COUNTS } from './board';

export type Rng = () => number; // returns [0, 1)

// Mulberry32 seeded PRNG
export function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBag(rng: Rng): Tile[] {
  const tiles: Tile[] = [];
  for (const [key, count] of Object.entries(LETTER_COUNTS)) {
    for (let i = 0; i < count; i++) {
      if (key === 'BLANK') {
        tiles.push({ kind: 'blank', assigned: null, points: 0 });
      } else {
        const letter = key as Letter;
        tiles.push({ kind: 'letter', letter, points: LETTER_POINTS[letter] });
      }
    }
  }
  // Fisher–Yates
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

export function drawTiles(bag: Tile[], n: number): [Tile[], Tile[]] {
  const drawn = bag.slice(0, n);
  const rest = bag.slice(drawn.length);
  return [drawn, rest];
}
