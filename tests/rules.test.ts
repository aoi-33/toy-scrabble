import { describe, it, expect } from 'vitest';
import { detectDirection } from '../src/game/rules';
import { LETTER_POINTS } from '../src/game/board';
import type { Letter, PendingPlacement, Tile } from '../src/game/types';

const T = (letter: string): Tile =>
  ({ kind: 'letter', letter: letter as Letter, points: LETTER_POINTS[letter as Letter] });

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

import { extractAllFormedWords } from '../src/game/rules';

describe('extractAllFormedWords', () => {
  it('extracts single main horizontal word', () => {
    const ps = [P(7, 6, 'C'), P(7, 7, 'A'), P(7, 8, 'T')];
    const words = extractAllFormedWords(createEmptyBoard(), ps, 'H');
    expect(words.map(w => w.word)).toEqual(['CAT']);
  });

  it('extracts main + cross word when placement extends existing tile', () => {
    let b = createEmptyBoard();
    b = place(b, 7, 7, 'A');
    const ps = [P(8, 7, 'T')];
    const words = extractAllFormedWords(b, ps, 'V');
    expect(words.map(w => w.word).sort()).toEqual(['AT']);
  });

  it('extracts main word with existing tile inside', () => {
    let b = createEmptyBoard();
    b = place(b, 7, 7, 'A');
    const ps = [P(7, 6, 'C'), P(7, 8, 'T')];
    const words = extractAllFormedWords(b, ps, 'H');
    expect(words.map(w => w.word)).toEqual(['CAT']);
  });

  it('extracts perpendicular cross words for each placement that creates one', () => {
    let b = createEmptyBoard();
    b = place(b, 7, 6, 'C');
    b = place(b, 7, 7, 'A');
    b = place(b, 7, 8, 'T');
    const ps = [P(6, 7, 'B'), P(8, 7, 'T')];
    const words = extractAllFormedWords(b, ps, 'V');
    expect(words.map(w => w.word).sort()).toEqual(['BAT']);
  });

  it('ignores 1-letter cross fragments', () => {
    let b = createEmptyBoard();
    b = place(b, 7, 7, 'A');
    const ps = [P(7, 8, 'T')];
    const words = extractAllFormedWords(b, ps, 'H');
    expect(words.map(w => w.word)).toEqual(['AT']);
  });
});

describe('validatePlacement — scoring', () => {
  const scoringDict = createDictionaryFromText('CAT\nCATS\nBAT\nBATH\nQI\nQUIZ\nATS\nAT\nAS\nAEIOUST\n');

  it('applies center DW to first word covering (7,7)', () => {
    const ps = [P(7, 6, 'C'), P(7, 7, 'A'), P(7, 8, 'T')];
    const res = validatePlacement(createEmptyBoard(), ps, scoringDict, true);
    // Points: C=3, A=1, T=1. sum=5. STAR at (7,7) → wordMult *= 2. finalScore = 10.
    expect(res).toMatchObject({ ok: true, score: 10 });
  });

  it('applies DL on a new tile in a simple case', () => {
    let b = createEmptyBoard();
    b = place(b, 2, 0, 'A');
    const ps = [P(3, 0, 'T'), P(4, 0, 'S')];
    const res = validatePlacement(b, ps, scoringDict, false);
    // Word: ATS. A=1(existing, no premium), T=1 on DL(3,0)*2=2, S=1(no premium). sum=4. Score=4.
    expect(res).toMatchObject({ ok: true, score: 4 });
  });

  it('adds 50 bonus for Bingo (7-tile play)', () => {
    const ps = [
      P(7, 4, 'A'), P(7, 5, 'E'), P(7, 6, 'I'), P(7, 7, 'O'),
      P(7, 8, 'U'), P(7, 9, 'S'), P(7, 10, 'T'),
    ];
    const res = validatePlacement(createEmptyBoard(), ps, scoringDict, true);
    // A=1,E=1,I=1,O=1,U=1,S=1,T=1 = 7. STAR mult *=2 → 14. Bingo +50 → 64.
    expect(res).toMatchObject({ ok: true, score: 64 });
  });

  it('scores blank tile as 0 points', () => {
    const dictLocal = createDictionaryFromText('CAT\n');
    const blankA: Tile = { kind: 'blank', assigned: 'A', points: 0 };
    const ps: PendingPlacement[] = [
      { coord: { r: 7, c: 6 }, tile: T('C'), rackIndex: 0 },
      { coord: { r: 7, c: 7 }, tile: blankA, rackIndex: 1 },
      { coord: { r: 7, c: 8 }, tile: T('T'), rackIndex: 2 },
    ];
    const res = validatePlacement(createEmptyBoard(), ps, dictLocal, true);
    // C=3, A=0 (blank), T=1. STAR → *2. = 8.
    expect(res).toMatchObject({ ok: true, score: 8 });
  });
});
