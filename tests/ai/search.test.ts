import { describe, it, expect } from 'vitest';
import { findAnchors, generateMovesAt, searchAllMoves } from '../../src/ai/search';
import { createDictionaryFromText } from '../../src/game/dictionary';
import type { AISnapshot } from '../../src/ai/types';

function empty(): (string | null)[][] {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

describe('findAnchors', () => {
  it('returns only center (7,7) on first move', () => {
    const snap: AISnapshot = {
      board: empty(),
      rack: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      bagRemaining: 86,
      isFirstMove: true,
    };
    expect(findAnchors(snap)).toEqual([{ r: 7, c: 7 }]);
  });

  it('returns empty cells adjacent to a placed tile', () => {
    const b = empty();
    b[7][7] = 'A';
    const snap: AISnapshot = {
      board: b,
      rack: ['B'],
      bagRemaining: 0,
      isFirstMove: false,
    };
    const anchors = findAnchors(snap);
    expect(anchors).toContainEqual({ r: 6, c: 7 });
    expect(anchors).toContainEqual({ r: 8, c: 7 });
    expect(anchors).toContainEqual({ r: 7, c: 6 });
    expect(anchors).toContainEqual({ r: 7, c: 8 });
    expect(anchors).not.toContainEqual({ r: 7, c: 7 });
    expect(anchors).not.toContainEqual({ r: 5, c: 7 });
  });
});

const dict = createDictionaryFromText('CAT\nCATS\nAT\nTAB\nAB\nAS\nATS\nBAT\nBATS\nCAB\nCABS\nEAT\nEATS\nHAT\nRAT\n');

describe('generateMovesAt (H direction)', () => {
  it('generates CAT starting from center on first move', () => {
    const snap: AISnapshot = {
      board: empty(),
      rack: ['C', 'A', 'T'],
      bagRemaining: 0,
      isFirstMove: true,
    };
    const moves = generateMovesAt({ r: 7, c: 7 }, 'H', snap, dict);
    const words = moves.map(m => m.word);
    expect(words).toContain('CAT');
  });

  it('extends existing tiles horizontally', () => {
    const b = empty();
    b[7][7] = 'A';
    const snap: AISnapshot = {
      board: b,
      rack: ['C', 'T'],
      bagRemaining: 0,
      isFirstMove: false,
    };
    const moves = generateMovesAt({ r: 7, c: 6 }, 'H', snap, dict);
    const words = moves.map(m => m.word);
    expect(words).toContain('CAT');
  });
});

describe('searchAllMoves', () => {
  it('returns at least one CAT-like word on empty first move', () => {
    const snap: AISnapshot = {
      board: empty(),
      rack: ['C', 'A', 'T', 'X', 'Y', 'Z', 'Q'],
      bagRemaining: 86,
      isFirstMove: true,
    };
    const moves = searchAllMoves(snap, dict, { deadlineMs: 1000 });
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.some(m => m.word === 'CAT')).toBe(true);
  });

  it('respects the deadline and returns partial results', () => {
    const snap: AISnapshot = {
      board: empty(),
      rack: ['C', 'A', 'T', 'S', 'B', 'E'],
      bagRemaining: 86,
      isFirstMove: true,
    };
    // eslint-disable-next-line no-undef
    const start = performance.now();
    const moves = searchAllMoves(snap, dict, { deadlineMs: 1 });
    // eslint-disable-next-line no-undef
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
    expect(Array.isArray(moves)).toBe(true);
  });
});
