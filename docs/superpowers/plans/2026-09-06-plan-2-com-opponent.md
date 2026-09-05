# Plan 2: COM Opponent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable COM opponent with 3 difficulty levels (Easy / Medium / Hard). AI runs in a Web Worker with a strict per-move deadline so total wait ≤ 1s.

**Architecture:** New `src/ai/` module with pure `search.ts` (anchor-based legal-move generation, prefix-Set branch-pruning) and `difficulty.ts` (Easy = random from bottom 50%, Medium = random from top 30%, Hard = highest score). A dedicated Web Worker (`src/ai/worker.ts`) receives an `AISnapshot`, runs the search, returns the best `Move`. Main thread dispatches AI turns automatically via a `useEffect` that watches `currentPlayerIndex + status`. UI shows "COM 思考中…" during the worker round-trip and briefly highlights the played tiles.

**Tech Stack:**
- Web Worker (ES module — Vite handles bundling via `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`)
- Existing: React 18, `useReducer`, `@dnd-kit`, Vitest

**Reference:** `docs/design.md` § 4 (COM AI) — full architectural spec.

---

## Milestones

- **M1** Worker infrastructure + message types
- **M2** Anchor-based search with deadline (TDD, no worker — runs in main thread for testing)
- **M3** Difficulty selection strategy (TDD)
- **M4** Main-thread integration: `useAiWorker` hook + auto-dispatch on COM turn
- **M5** UI: enable COM modes in ModeSelect, "thinking" indicator, briefly highlight COM-placed tiles
- **M6** Verification + README update + tag

Commit after every task. Conventional commits (`feat`, `test`, `chore`).

---

# M1: Worker Infrastructure + Message Types

## Task 1.1: AI message types + AISnapshot

**Files:**
- Create: `src/ai/types.ts`

- [ ] **Step 1: Create `src/ai/types.ts`**

```typescript
import type { Letter, Move } from '../game/types';

export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Minimal snapshot for the AI Worker. Uses strings for board cells to make
 * structured-clone cheap. Blank tiles are represented as lowercase letters.
 */
export type AISnapshot = {
  /** 15x15. null = empty. lowercase letter = blank with assigned letter. uppercase = normal. */
  board: (string | null)[][];
  /** Rack tiles: letter or 'BLANK'. */
  rack: (Letter | 'BLANK')[];
  bagRemaining: number;
  isFirstMove: boolean;
};

export type WorkerRequest =
  | { type: 'INIT'; dictUrl: string }
  | { type: 'REQUEST_MOVE'; snapshot: AISnapshot; difficulty: Difficulty; requestId: number };

export type WorkerResponse =
  | { type: 'READY' }
  | { type: 'MOVE_RESULT'; move: Move; requestId: number }
  | { type: 'ERROR'; message: string; requestId?: number };
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc -b`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add src/ai/types.ts
git commit -m "feat(ai): add worker message types and AISnapshot"
```

## Task 1.2: Snapshot conversion helpers

**Files:**
- Create: `src/ai/snapshot.ts`
- Create: `tests/ai/snapshot.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
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
```

Verify fails.

- [ ] **Step 2: Create `src/ai/snapshot.ts`**

```typescript
import type { Board, Tile, Letter } from '../game/types';

export function boardToSnapshot(board: Board): (string | null)[][] {
  return board.map(row =>
    row.map(cell => {
      if (!cell) return null;
      if (cell.tile.kind === 'letter') return cell.tile.letter;
      return cell.tile.assigned ? cell.tile.assigned.toLowerCase() : '?';
    }),
  );
}

export function rackToSnapshot(rack: Tile[]): (Letter | 'BLANK')[] {
  return rack.map(t => (t.kind === 'letter' ? t.letter : ('BLANK' as const)));
}
```

Verify passes.

- [ ] **Step 3: Commit**

```bash
git add src/ai/snapshot.ts tests/ai/snapshot.test.ts
git commit -m "feat(ai): add board/rack → AISnapshot converters"
```

---

# M2: Anchor-Based Search

## Task 2.1: Anchor enumeration

**Files:**
- Create: `src/ai/search.ts`
- Create: `tests/ai/search.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
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
```

Verify fails.

- [ ] **Step 2: Create `src/ai/search.ts` — start with `findAnchors`**

```typescript
import type { Coord } from '../game/types';
import type { AISnapshot } from './types';

const BOARD_SIZE = 15;
const CENTER: Coord = { r: 7, c: 7 };

export function findAnchors(snap: AISnapshot): Coord[] {
  if (snap.isFirstMove) return [CENTER];
  const anchors: Coord[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (snap.board[r][c] !== null) continue;
      const neighbours: [number, number][] = [
        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
      ];
      if (neighbours.some(([nr, nc]) => snap.board[nr]?.[nc] != null)) {
        anchors.push({ r, c });
      }
    }
  }
  return anchors;
}
```

Verify passes. Commit: `feat(ai): enumerate anchor squares for search`
Stage: `src/ai/search.ts tests/ai/search.test.ts`

## Task 2.2: Word generation from anchor (horizontal only, no blanks)

**Files:**
- Modify: `src/ai/search.ts`
- Modify: `tests/ai/search.test.ts`

Generate all legal moves that PLACE at least one new tile starting from a given anchor along a given direction. Validate against dictionary using prefix check.

- [ ] **Step 1: Add failing tests**

```typescript
import { generateMovesAt } from '../../src/ai/search';
import { createDictionaryFromText } from '../../src/game/dictionary';

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
    // Anchor at 7,6 → build CAT (C at 6, existing A at 7, T at 8)
    // Anchor at 7,8 gets tested separately for coverage.
    const moves = generateMovesAt({ r: 7, c: 6 }, 'H', snap, dict);
    const words = moves.map(m => m.word);
    expect(words).toContain('CAT');
  });
});
```

Verify fails.

- [ ] **Step 2: Extend `src/ai/search.ts`**

Add these types and functions. This is the core of the search — read carefully.

```typescript
import type { Dictionary } from '../game/dictionary';
import { hasPrefix, isValidWord } from '../game/dictionary';
import { LETTER_POINTS, PREMIUM_BOARD } from '../game/board';
import type { Direction, Letter } from '../game/types';

export type Placement = { r: number; c: number; letter: Letter; fromBlank: boolean };
export type GeneratedMove = {
  word: string;
  placements: Placement[];  // only NEW tile placements (not existing tiles used)
  score: number;
};

function step(dir: Direction, forward: boolean): { dr: number; dc: number } {
  const sign = forward ? 1 : -1;
  return dir === 'H' ? { dr: 0, dc: sign } : { dr: sign, dc: 0 };
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

/** Walk backwards from `start` collecting existing letters, return the prefix and the start of the word. */
function leftExtension(
  snap: AISnapshot,
  start: { r: number; c: number },
  dir: Direction,
): { prefix: string; startR: number; startC: number } {
  const { dr, dc } = step(dir, false);
  let r = start.r + dr;
  let c = start.c + dc;
  let prefix = '';
  while (inBounds(r, c) && snap.board[r][c] !== null) {
    prefix = snap.board[r][c]!.toUpperCase() + prefix;
    r += dr;
    c += dc;
  }
  return { prefix, startR: r - dr, startC: c - dc };
}

/** Compute the cross-word formed perpendicular to `dir` through (r,c) if we place `letter` there.
 *  Returns null if there's no cross-neighbour (single letter, not a word). Returns "" for OK-no-cross,
 *  the full word string if the cross is a valid dictionary word, or "INVALID" if formed but not in dict. */
function crossWordAt(
  snap: AISnapshot,
  r: number,
  c: number,
  letter: string,
  dir: Direction,
  dict: Dictionary,
): { word: string; score: number } | null | 'INVALID' {
  const perp: Direction = dir === 'H' ? 'V' : 'H';
  const back = step(perp, false);
  const fwd = step(perp, true);
  let prefix = '';
  let r0 = r + back.dr;
  let c0 = c + back.dc;
  while (inBounds(r0, c0) && snap.board[r0][c0] !== null) {
    prefix = snap.board[r0][c0]!.toUpperCase() + prefix;
    r0 -= back.dr;
    c0 -= back.dc;
  }
  let suffix = '';
  let r1 = r + fwd.dr;
  let c1 = c + fwd.dc;
  const suffixExisting: { r: number; c: number; letter: string }[] = [];
  while (inBounds(r1, c1) && snap.board[r1][c1] !== null) {
    const ch = snap.board[r1][c1]!;
    suffix += ch.toUpperCase();
    suffixExisting.push({ r: r1, c: c1, letter: ch });
    r1 += fwd.dr;
    c1 += fwd.dc;
  }
  if (prefix.length === 0 && suffix.length === 0) return null;
  const word = prefix + letter + suffix;
  if (!isValidWord(dict, word)) return 'INVALID';
  // Score the cross word: only the new tile earns a letter premium; the placed tile also
  // applies its word multiplier (if any) to the whole cross word.
  const premium = PREMIUM_BOARD[r][c];
  const isBlank = snap.board[r][c] === null && letter !== letter.toUpperCase();
  // (Cross-word scoring handled elsewhere — see recordCandidate below.)
  return { word, score: 0 };
}

/** Extend forward from (r,c) along `dir`, consuming rack letters and existing tiles,
 *  emitting a move each time we form a valid word AND have placed >= 1 tile that touches an anchor. */
function extendForward(
  snap: AISnapshot,
  dict: Dictionary,
  dir: Direction,
  anchor: { r: number; c: number },
  startR: number,
  startC: number,
  prefix: string,
  rack: (Letter | 'BLANK')[],
  placementsSoFar: Placement[],
  results: GeneratedMove[],
): void {
  const { dr, dc } = step(dir, true);
  // Compute current cursor position: startR + prefix.length * (dr/dc unit already stepped for prefix from left extension?)
  // Instead, we track cursor explicitly by walking from startR/startC forward by prefix.length.
  const curR = startR + prefix.length * dr;
  const curC = startC + prefix.length * dc;

  // If the current cursor cell has an existing tile, consume it (no rack cost, no new placement).
  if (inBounds(curR, curC) && snap.board[curR][curC] !== null) {
    const ch = snap.board[curR][curC]!.toUpperCase();
    const newPrefix = prefix + ch;
    if (!hasPrefix(dict, newPrefix)) return;
    // Emit if word ends here and we've made a placement:
    if (placementsSoFar.length > 0 && isValidWord(dict, newPrefix)) {
      recordCandidate(snap, dict, dir, anchor, startR, startC, newPrefix, placementsSoFar, results);
    }
    extendForward(snap, dict, dir, anchor, startR, startC, newPrefix, rack, placementsSoFar, results);
    return;
  }

  // Otherwise: try each letter from rack.
  const tried = new Set<string>();
  for (let i = 0; i < rack.length; i++) {
    const tile = rack[i];
    const candidateLetters: Letter[] =
      tile === 'BLANK'
        ? (['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'] as Letter[])
        : [tile];
    for (const letter of candidateLetters) {
      const key = `${i}:${letter}`;
      if (tried.has(key)) continue;
      tried.add(key);
      const newPrefix = prefix + letter;
      if (!hasPrefix(dict, newPrefix)) continue;
      // Check cross-word at (curR, curC) if placing `letter` there
      if (inBounds(curR, curC)) {
        const cross = crossWordAt(snap, curR, curC, letter, dir, dict);
        if (cross === 'INVALID') continue;
      }
      const newPlacement: Placement = {
        r: curR,
        c: curC,
        letter,
        fromBlank: tile === 'BLANK',
      };
      const newRack = rack.slice();
      newRack.splice(i, 1);
      const newPlacements = [...placementsSoFar, newPlacement];
      // Anchor-touch check: we only emit words when the run of placements covers the anchor OR
      // the word extends past the anchor. For simplicity: check when word ends that any placement equals anchor.
      const touchesAnchor = newPlacements.some(p => p.r === anchor.r && p.c === anchor.c);
      if (touchesAnchor && isValidWord(dict, newPrefix)) {
        recordCandidate(snap, dict, dir, anchor, startR, startC, newPrefix, newPlacements, results);
      }
      extendForward(snap, dict, dir, anchor, startR, startC, newPrefix, newRack, newPlacements, results);
    }
  }
}

/** Given a full candidate word and placements, compute total score (main word + all cross words + bingo). */
function recordCandidate(
  snap: AISnapshot,
  dict: Dictionary,
  dir: Direction,
  _anchor: { r: number; c: number },
  startR: number,
  startC: number,
  word: string,
  placements: Placement[],
  results: GeneratedMove[],
): void {
  const { dr, dc } = step(dir, true);
  const placementByCoord = new Map<string, Placement>();
  for (const p of placements) placementByCoord.set(`${p.r},${p.c}`, p);

  // Main word score
  let mainSum = 0;
  let mainMult = 1;
  for (let i = 0; i < word.length; i++) {
    const r = startR + i * dr;
    const c = startC + i * dc;
    const pl = placementByCoord.get(`${r},${c}`);
    const letter = word[i];
    const base = pl?.fromBlank ? 0 : LETTER_POINTS[letter as Letter];
    if (pl) {
      const prem = PREMIUM_BOARD[r][c];
      let letterScore = base;
      if (prem === 'DL') letterScore *= 2;
      else if (prem === 'TL') letterScore *= 3;
      else if (prem === 'DW' || prem === 'STAR') mainMult *= 2;
      else if (prem === 'TW') mainMult *= 3;
      mainSum += letterScore;
    } else {
      mainSum += base;
    }
  }
  let total = mainSum * mainMult;

  // Cross words at each placement
  const perp: Direction = dir === 'H' ? 'V' : 'H';
  const backP = step(perp, false);
  const fwdP = step(perp, true);
  for (const p of placements) {
    let prefix = '';
    let r0 = p.r + backP.dr;
    let c0 = p.c + backP.dc;
    while (inBounds(r0, c0) && snap.board[r0][c0] !== null) {
      prefix = snap.board[r0][c0]!.toUpperCase() + prefix;
      r0 -= backP.dr;
      c0 -= backP.dc;
    }
    let suffix = '';
    let r1 = p.r + fwdP.dr;
    let c1 = p.c + fwdP.dc;
    while (inBounds(r1, c1) && snap.board[r1][c1] !== null) {
      suffix += snap.board[r1][c1]!.toUpperCase();
      r1 += fwdP.dr;
      c1 += fwdP.dc;
    }
    if (prefix.length === 0 && suffix.length === 0) continue;
    const crossWord = prefix + p.letter + suffix;
    if (!isValidWord(dict, crossWord)) return; // shouldn't happen if extendForward pre-checked; safety net
    let crossSum = 0;
    let crossMult = 1;
    // score existing prefix
    for (const ch of prefix) crossSum += LETTER_POINTS[ch as Letter];
    // score the placed letter with premium
    const base = p.fromBlank ? 0 : LETTER_POINTS[p.letter];
    const prem = PREMIUM_BOARD[p.r][p.c];
    let letterScore = base;
    if (prem === 'DL') letterScore *= 2;
    else if (prem === 'TL') letterScore *= 3;
    else if (prem === 'DW' || prem === 'STAR') crossMult *= 2;
    else if (prem === 'TW') crossMult *= 3;
    crossSum += letterScore;
    // score existing suffix
    for (const ch of suffix) crossSum += LETTER_POINTS[ch as Letter];
    total += crossSum * crossMult;
  }

  if (placements.length === 7) total += 50; // Bingo

  results.push({ word, placements, score: total });
}

export function generateMovesAt(
  anchor: { r: number; c: number },
  dir: Direction,
  snap: AISnapshot,
  dict: Dictionary,
): GeneratedMove[] {
  const results: GeneratedMove[] = [];
  const { prefix, startR, startC } = leftExtension(snap, anchor, dir);
  // If left-extension is non-empty, must not step through empty cells; extendForward handles that.
  extendForward(snap, dict, dir, anchor, startR, startC, prefix, snap.rack, [], results);
  return results;
}
```

Verify tests pass.

Commit: `feat(ai): implement anchor-based move generation for one direction`
Stage: `src/ai/search.ts tests/ai/search.test.ts`

## Task 2.3: Full-board search with deadline

**Files:**
- Modify: `src/ai/search.ts`
- Modify: `tests/ai/search.test.ts`

- [ ] **Step 1: Add failing tests**

```typescript
import { searchAllMoves } from '../../src/ai/search';

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
    const start = performance.now();
    const moves = searchAllMoves(snap, dict, { deadlineMs: 1 }); // absurdly short
    const elapsed = performance.now() - start;
    // Should return quickly (well under 50ms even with overhead)
    expect(elapsed).toBeLessThan(200);
    // May return zero or a few results — just ensure no crash and results is an array
    expect(Array.isArray(moves)).toBe(true);
  });
});
```

Verify fails.

- [ ] **Step 2: Implement `searchAllMoves`**

Add to `src/ai/search.ts`:

```typescript
export function searchAllMoves(
  snap: AISnapshot,
  dict: Dictionary,
  opts: { deadlineMs: number },
): GeneratedMove[] {
  const results: GeneratedMove[] = [];
  const deadline = performance.now() + opts.deadlineMs;
  const anchors = findAnchors(snap);
  // Order anchors: center-first, then by number of adjacent placed tiles (heuristic)
  const orderedAnchors = anchors
    .map(a => ({ a, d: Math.abs(a.r - 7) + Math.abs(a.c - 7) }))
    .sort((x, y) => x.d - y.d)
    .map(x => x.a);

  outer: for (const anchor of orderedAnchors) {
    for (const dir of ['H', 'V'] as const) {
      if (performance.now() > deadline) break outer;
      const moves = generateMovesAt(anchor, dir, snap, dict);
      results.push(...moves);
    }
  }
  return dedupeMoves(results);
}

function dedupeMoves(moves: GeneratedMove[]): GeneratedMove[] {
  const seen = new Map<string, GeneratedMove>();
  for (const m of moves) {
    const key = m.placements.map(p => `${p.r},${p.c},${p.letter}`).sort().join('|');
    const prev = seen.get(key);
    if (!prev || m.score > prev.score) seen.set(key, m);
  }
  return [...seen.values()];
}
```

Verify passes.

Commit: `feat(ai): search all anchors with deadline and dedupe results`
Stage: `src/ai/search.ts tests/ai/search.test.ts`

---

# M3: Difficulty Selection Strategy

## Task 3.1: `selectMove` for three difficulties

**Files:**
- Create: `src/ai/difficulty.ts`
- Create: `tests/ai/difficulty.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
    // scores 1..5 form the bottom half
    for (const p of picks) {
      expect(p!.score).toBeLessThanOrEqual(5);
    }
  });

  it('Medium picks from top 30%', () => {
    const rng = seededRng(1);
    const picks = Array.from({ length: 30 }, () => selectMove(moves, 'medium', rng));
    // top 30% of 10 = 3 → scores 8, 9, 10
    for (const p of picks) {
      expect(p!.score).toBeGreaterThanOrEqual(8);
    }
  });

  it('returns null when candidates array is empty', () => {
    expect(selectMove([], 'hard', seededRng(1))).toBeNull();
  });
});
```

Verify fails.

- [ ] **Step 2: Create `src/ai/difficulty.ts`**

```typescript
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
```

Verify passes.

Commit: `feat(ai): difficulty-based move selection (easy/medium/hard)`
Stage: `src/ai/difficulty.ts tests/ai/difficulty.test.ts`

---

# M4: Main-Thread Integration

## Task 4.1: Web Worker entrypoint

**Files:**
- Create: `src/ai/worker.ts`

- [ ] **Step 1: Create `src/ai/worker.ts`**

```typescript
/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from './types';
import { createDictionaryFromText, type Dictionary } from '../game/dictionary';
import { searchAllMoves } from './search';
import { selectMove } from './difficulty';
import { seededRng } from '../game/bag';
import type { Letter, Move, PendingPlacement, Tile } from '../game/types';

let dict: Dictionary | null = null;

// eslint-disable-next-line no-restricted-globals
const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (evt: MessageEvent<WorkerRequest>) => {
  const msg = evt.data;
  try {
    if (msg.type === 'INIT') {
      const res = await fetch(msg.dictUrl);
      const text = await res.text();
      dict = createDictionaryFromText(text);
      const ready: WorkerResponse = { type: 'READY' };
      ctx.postMessage(ready);
      return;
    }
    if (msg.type === 'REQUEST_MOVE') {
      if (!dict) throw new Error('dictionary not loaded');
      const deadlineMs = msg.difficulty === 'hard' ? 700 : 300;
      const candidates = searchAllMoves(msg.snapshot, dict, { deadlineMs });
      const chosen = selectMove(candidates, msg.difficulty, seededRng(Date.now()));

      let move: Move;
      if (!chosen) {
        // No legal move — exchange if bag allows, else pass
        if (msg.snapshot.bagRemaining >= 7 && msg.snapshot.rack.length > 0) {
          move = { kind: 'exchange', tileIndices: msg.snapshot.rack.map((_, i) => i).slice(0, 1) };
        } else {
          move = { kind: 'pass' };
        }
      } else {
        // Convert Placement[] → PendingPlacement[] (need to attach original rack index)
        const rackCopy = [...msg.snapshot.rack];
        const placements: PendingPlacement[] = chosen.placements.map(p => {
          let idx: number;
          if (p.fromBlank) {
            idx = rackCopy.indexOf('BLANK');
          } else {
            idx = rackCopy.indexOf(p.letter);
            if (idx === -1) idx = rackCopy.indexOf('BLANK'); // fallback
          }
          if (idx === -1) throw new Error(`AI placement letter not in rack: ${p.letter}`);
          rackCopy.splice(idx, 1);
          const tile: Tile = p.fromBlank
            ? { kind: 'blank', assigned: p.letter as Letter, points: 0 }
            : { kind: 'letter', letter: p.letter as Letter, points: LETTER_POINTS_LOCAL[p.letter as Letter] };
          return { coord: { r: p.r, c: p.c }, tile, rackIndex: idx };
        });
        move = { kind: 'place', placements };
      }

      const resp: WorkerResponse = { type: 'MOVE_RESULT', move, requestId: msg.requestId };
      ctx.postMessage(resp);
    }
  } catch (err) {
    const errResp: WorkerResponse = {
      type: 'ERROR',
      message: err instanceof Error ? err.message : String(err),
      requestId: msg.type === 'REQUEST_MOVE' ? msg.requestId : undefined,
    };
    ctx.postMessage(errResp);
  }
};

// Minimal letter-points table (avoid pulling board.ts into worker unnecessarily; keep in sync)
const LETTER_POINTS_LOCAL: Record<Letter, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};
```

Note: import `LETTER_POINTS` from `../game/board` instead of the local duplicate if bundle size and drift are concerns. Either is acceptable; the plan uses local for clarity but importing the shared const is cleaner. Prefer the shared import — delete the local table and add `import { LETTER_POINTS } from '../game/board';`.

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc -b`
Expected: exits 0

Commit: `feat(ai): add Web Worker entrypoint`
Stage: `src/ai/worker.ts`

## Task 4.2: `useAiWorker` React hook

**Files:**
- Create: `src/ai/useAiWorker.ts`

- [ ] **Step 1: Create `src/ai/useAiWorker.ts`**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import type { AISnapshot, Difficulty, WorkerRequest, WorkerResponse } from './types';
import type { Move } from '../game/types';

type State = 'uninitialized' | 'ready' | 'thinking';

export function useAiWorker(dictUrl: string | null) {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<State>('uninitialized');
  const pendingRef = useRef<Map<number, (move: Move) => void>>(new Map());
  const nextIdRef = useRef(1);

  useEffect(() => {
    if (!dictUrl) return;
    // eslint-disable-next-line no-undef
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = (evt: MessageEvent<WorkerResponse>) => {
      const msg = evt.data;
      if (msg.type === 'READY') {
        setState('ready');
      } else if (msg.type === 'MOVE_RESULT') {
        setState('ready');
        const cb = pendingRef.current.get(msg.requestId);
        if (cb) {
          pendingRef.current.delete(msg.requestId);
          cb(msg.move);
        }
      } else if (msg.type === 'ERROR') {
        setState('ready');
        // eslint-disable-next-line no-console, no-undef
        console.error('AI Worker error:', msg.message);
      }
    };
    const init: WorkerRequest = { type: 'INIT', dictUrl };
    w.postMessage(init);
    return () => {
      w.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
      setState('uninitialized');
    };
  }, [dictUrl]);

  const requestMove = useCallback(
    (snapshot: AISnapshot, difficulty: Difficulty): Promise<Move> => {
      return new Promise((resolve, reject) => {
        const w = workerRef.current;
        if (!w) return reject(new Error('worker not initialized'));
        const id = nextIdRef.current++;
        pendingRef.current.set(id, resolve);
        setState('thinking');
        const req: WorkerRequest = { type: 'REQUEST_MOVE', snapshot, difficulty, requestId: id };
        w.postMessage(req);
      });
    },
    [],
  );

  return { state, requestMove };
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc -b`
Expected: exits 0

Commit: `feat(ai): add useAiWorker hook for main-thread integration`
Stage: `src/ai/useAiWorker.ts`

## Task 4.3: Auto-dispatch on COM turn

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Wire the worker + auto-dispatch**

At the top of `GameShell` (before other state):
```tsx
import { useAiWorker } from './ai/useAiWorker';
import { boardToSnapshot, rackToSnapshot } from './ai/snapshot';
import type { Difficulty } from './ai/types';

// Inside GameShell, after `const { state, dispatch, dict } = useGame();`
const dictUrl = dict ? `${import.meta.env.BASE_URL}dict/twl06.txt` : null;
const ai = useAiWorker(dictUrl);
```

Then add a `useEffect` that fires when it becomes the COM's turn:
```tsx
useEffect(() => {
  if (state.status !== 'playing') return;
  if (state.mode === 'free') return;
  const currentId = state.players[state.currentPlayerIndex].id;
  if (currentId !== 'COM') return;
  if (ai.state !== 'ready') return;
  const difficulty: Difficulty =
    state.mode === 'com-easy' ? 'easy' :
    state.mode === 'com-medium' ? 'medium' : 'hard';
  const rack = state.players[state.currentPlayerIndex].rack;
  const snap = {
    board: boardToSnapshot(state.board),
    rack: rackToSnapshot(rack),
    bagRemaining: state.bag.length,
    isFirstMove: state.board.flat().every(c => c === null),
  };
  ai.requestMove(snap, difficulty).then(move => {
    if (!dict) return;
    if (move.kind === 'pass') {
      dispatch({ type: 'PASS' });
    } else if (move.kind === 'exchange') {
      dispatch({ type: 'EXCHANGE', indices: move.tileIndices, rng: seededRng(Date.now()) });
    } else {
      // place: dispatch each PLACE_PENDING then COMMIT_PLAY
      for (const pl of move.placements) {
        dispatch({ type: 'PLACE_PENDING', placement: pl });
      }
      dispatch({ type: 'COMMIT_PLAY', dict });
    }
  }).catch(err => {
    // eslint-disable-next-line no-console, no-undef
    console.error('AI move failed, passing:', err);
    dispatch({ type: 'PASS' });
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [state.status, state.currentPlayerIndex, state.mode, ai.state]);
```

**Note:** The `PLACE_PENDING` loop mutates state each iteration; a subsequent `PLACE_PENDING` reads the new state via the reducer. This works because React batches dispatches within the same event handler in React 18 automatically batched mode — but each dispatch queues a state update. The rackIndex must be recomputed by the reducer as tiles are removed. **The reducer's `PLACE_PENDING` uses `action.placement.rackIndex` directly to splice** — this will be wrong for subsequent placements because we're reading indices from the ORIGINAL rack. Fix: instead of dispatching multiple `PLACE_PENDING`, add a new reducer action `PLACE_ALL_PENDING` that takes an array and applies them in one shot with correct rack manipulation.

Wait — this is a real design issue. **Do NOT try to dispatch multiple PLACE_PENDING in a loop.** Add a new action:

- [ ] **Step 2: Add `COMMIT_AI_PLAY` action to reducer**

Modify `src/game/reducer.ts`. Add to the Action union:
```typescript
  | { type: 'COMMIT_AI_PLAY'; placements: PendingPlacement[]; dict: Dictionary }
```

Add case:
```typescript
    case 'COMMIT_AI_PLAY': {
      const p = state.players[state.currentPlayerIndex];
      const isFirstMove = state.board.flat().every(c => c === null);
      const result = validatePlacement(state.board, action.placements, action.dict, isFirstMove);
      if (!result.ok) {
        return { ...state, lastError: `COM 手が違反: ${result.reason}` };
      }
      const newBoard = state.board.map(row => [...row]);
      for (const pl of action.placements) {
        newBoard[pl.coord.r][pl.coord.c] = { tile: pl.tile, placedTurn: state.turn };
      }
      // Remove used tiles from COM's rack (match by identity or letter)
      let newRack = [...p.rack];
      for (const pl of action.placements) {
        // Prefer removing the exact tile object; fall back to matching by letter and blankness
        let idx = newRack.indexOf(pl.tile);
        if (idx === -1) {
          idx = newRack.findIndex(t =>
            t.kind === pl.tile.kind &&
            (t.kind === 'letter' && pl.tile.kind === 'letter' ? t.letter === pl.tile.letter : true),
          );
        }
        if (idx !== -1) newRack.splice(idx, 1);
      }
      // Draw replacements
      const drawCount = 7 - newRack.length;
      const [drawn, newBag] = drawTiles(state.bag, drawCount);
      newRack = [...newRack, ...drawn];

      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = {
        ...p,
        rack: newRack,
        score: p.score + result.score,
      };
      const record: MoveRecord = {
        player: p.id,
        move: { kind: 'place', placements: action.placements },
        wordsFormed: result.formedWords.map(w => w.word),
        score: result.score,
      };
      const nextIndex = (state.currentPlayerIndex === 0 ? 1 : 0) as 0 | 1;
      return {
        ...state,
        board: newBoard,
        bag: newBag,
        players: newPlayers,
        pending: [],
        currentPlayerIndex: nextIndex,
        turn: state.turn + 1,
        history: [...state.history, record],
        lastFormedWords: result.formedWords,
        consecutivePasses: 0,
        lastError: null,
      };
    }
```

Update `App.tsx` `useEffect`: for the `place` branch, use the single action:
```tsx
      dispatch({ type: 'COMMIT_AI_PLAY', placements: move.placements, dict });
```

Remove the `for` loop.

- [ ] **Step 3: Add reducer test for COMMIT_AI_PLAY**

Append to `tests/reducer.test.ts`:
```typescript
describe('reducer / COMMIT_AI_PLAY', () => {
  it('applies AI placements atomically and switches turn', () => {
    let s = reducer(createInitialState({ seed: 1, dict }), { type: 'START_GAME', mode: 'com-medium' });
    s = withRack(s, 1, ['C', 'A', 'T', 'X', 'Y', 'Z', 'Q']);
    // Simulate: it's now COM's turn (index 1)
    s = { ...s, currentPlayerIndex: 1 };
    const catTiles = s.players[1].rack.slice(0, 3);
    const placements = [
      { coord: { r: 7, c: 6 }, tile: catTiles[0], rackIndex: 0 },
      { coord: { r: 7, c: 7 }, tile: catTiles[1], rackIndex: 1 },
      { coord: { r: 7, c: 8 }, tile: catTiles[2], rackIndex: 2 },
    ];
    const next = reducer(s, { type: 'COMMIT_AI_PLAY', placements, dict });
    expect(next.board[7][6]?.tile).toMatchObject({ letter: 'C' });
    expect(next.players[1].score).toBeGreaterThan(0);
    expect(next.players[1].rack).toHaveLength(7);
    expect(next.currentPlayerIndex).toBe(0);
    expect(next.history).toHaveLength(1);
  });
});
```

Verify passes.

Commit: `feat(ai): dispatch AI turn via COMMIT_AI_PLAY action`
Stage: `src/App.tsx src/game/reducer.ts tests/reducer.test.ts`

---

# M5: UI Integration

## Task 5.1: Enable COM modes in ModeSelect

**Files:**
- Modify: `src/ui/ModeSelect.tsx`
- Modify: `tests/ui/ModeSelect.test.tsx`

- [ ] **Step 1: Update `OPTIONS` in `src/ui/ModeSelect.tsx`**

Change all three COM options `enabled: false` → `enabled: true` and remove the "Coming in Plan 2" badge rendering (or make it conditional on `enabled` remaining as false-fallback; simpler to remove the badge block since all are enabled now).

Replace the OPTIONS constant:
```typescript
const OPTIONS: ModeOption[] = [
  { mode: 'free', label: 'FREE PLAY', description: '2 人で交互にプレイ', enabled: true },
  { mode: 'com-easy', label: 'COM EASY', description: 'COM 対戦・初級', enabled: true },
  { mode: 'com-medium', label: 'COM MEDIUM', description: 'COM 対戦・中級', enabled: true },
  { mode: 'com-hard', label: 'COM HARD', description: 'COM 対戦・上級', enabled: true },
];
```

The "Coming in Plan 2" badge JSX becomes dead code — remove it (the `{!opt.enabled && ...}` block).

- [ ] **Step 2: Update tests**

`tests/ui/ModeSelect.test.tsx` — change the "COM modes are disabled" test to reflect that COM modes are now ENABLED (only the `disabled` prop can disable them):

```typescript
  it('COM modes are enabled by default', () => {
    render(<ModeSelect disabled={false} onSelect={() => {}} />);
    expect(screen.getByLabelText('mode-free')).not.toBeDisabled();
    expect(screen.getByLabelText('mode-com-easy')).not.toBeDisabled();
    expect(screen.getByLabelText('mode-com-medium')).not.toBeDisabled();
    expect(screen.getByLabelText('mode-com-hard')).not.toBeDisabled();
  });

  it('calls onSelect with the correct COM mode', () => {
    const onSelect = vi.fn();
    render(<ModeSelect disabled={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText('mode-com-hard'));
    expect(onSelect).toHaveBeenCalledWith('com-hard');
  });
```

Verify tests pass, build succeeds.

Commit: `feat(ui): enable COM modes in ModeSelect`
Stage: `src/ui/ModeSelect.tsx tests/ui/ModeSelect.test.tsx`

## Task 5.2: "COM 思考中" indicator + placed-tile highlight

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add thinking banner**

In the in-game return JSX, above `<Board>`:
```tsx
{ai.state === 'thinking' && (
  <div className="font-pixel text-xs text-yellow-300 animate-pulse">
    🤖 COM 思考中…
  </div>
)}
```

Also disable the Rack + ActionBar while `ai.state === 'thinking'` or when it's COM's turn (regardless of AI state) so the human can't interact.

Add near the top of the in-game render:
```tsx
const isCOMTurn = state.mode !== 'free' && current.id === 'COM';
```

Pass `disabled={isCOMTurn}` (or a similar prop) to `<Rack>` and `<ActionBar>`. This requires adding a `disabled` prop to `<Rack>` and updating tile selection to be no-op when disabled — but to keep this task minimal, we can simply wrap the Rack in a `<div className={isCOMTurn ? 'pointer-events-none opacity-50' : ''}>`. Same for `<ActionBar>`. Simpler and no interface change.

Update accordingly.

- [ ] **Step 2: Placed-tile highlight (optional polish)**

The `lastFormedWords` already shows what COM played. For visual highlight of the actual board tiles: skip in Plan 2, defer to Plan 4 polish. The word-strip is enough.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): show COM thinking indicator and lock UI during COM turn"
```

---

# M6: Verification + README

## Task 6.1: Final quality gates

- [ ] **Step 1: Run all tests**

Run: `npm run test`
Expected: PASS all (Plan 1 tests + Plan 2 additions ≈ 90+)

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: exit 0

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: dist/ produced, no TS errors. Vite should output a separate worker bundle.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`. In browser:
- Start "COM EASY" game → COM should play within ~1s and human turn resumes
- Try "COM MEDIUM" and "COM HARD" — verify each returns a move
- Verify "COM 思考中…" flashes briefly during COM turn
- Verify human cannot click the rack or ActionBar during COM turn

- [ ] **Step 5: Tag**

```bash
git tag plan-2-complete
```

## Task 6.2: Update README

**Files:**
- Modify: `scrabble/README.md`

- [ ] **Step 1: Edit README**

Update the "Plan 1 の制限事項" section to reflect Plan 2 completion. Change the COM AI line from "未実装" to "実装済み (Easy/Medium/Hard)". Move that item to a "変更履歴" or "対応済み" section, or simply delete it from the limitations.

Rewrite the "遊び方" step 1 to mention mode select:
> 1. `NEW GAME` の代わりに、`FREE PLAY` / `COM EASY` / `COM MEDIUM` / `COM HARD` から選択して開始

Add under limitations only the remaining items (dict lookup, mobile, deploy).

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for Plan 2 (COM opponent shipped)"
```

---

## Plan 2 Completion Checklist

- [ ] All Vitest tests pass (`npm run test`)
- [ ] ESLint clean (`npm run lint`)
- [ ] Production build succeeds and produces a worker bundle
- [ ] COM Easy/Medium/Hard all playable end-to-end
- [ ] COM 思考中 indicator visible during search
- [ ] Human rack/ActionBar disabled during COM turn
- [ ] README updated
- [ ] Tag `plan-2-complete` exists

**Next:** Plan 3 (WordDefinition + dictionary lookup) — English-Japanese meaning display, aligned with the "learning" angle.
