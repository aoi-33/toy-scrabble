import { describe, it, expect } from 'vitest';
import { findAnchors } from '../../src/ai/search';
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
