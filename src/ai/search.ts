import type { Coord, Direction, Letter } from '../game/types';
import type { Dictionary } from '../game/dictionary';
import { hasPrefix, isValidWord } from '../game/dictionary';
import { LETTER_POINTS, PREMIUM_BOARD } from '../game/board';
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

export type Placement = { r: number; c: number; letter: Letter; fromBlank: boolean };
export type GeneratedMove = {
  word: string;
  placements: Placement[];
  score: number;
};

function step(dir: Direction, forward: boolean): { dr: number; dc: number } {
  const sign = forward ? 1 : -1;
  return dir === 'H' ? { dr: 0, dc: sign } : { dr: sign, dc: 0 };
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

/** スナップショットの小文字はブランク由来なので 0 点。 */
function charPoints(ch: string): number {
  return ch === ch.toLowerCase() ? 0 : LETTER_POINTS[ch as Letter];
}

/** 語の直後に既存タイルが続いていないか。続く場合その語は盤面上の実際の語ではない。 */
function endsWord(snap: AISnapshot, dir: Direction, startR: number, startC: number, len: number): boolean {
  const { dr, dc } = step(dir, true);
  const r = startR + len * dr;
  const c = startC + len * dc;
  return !inBounds(r, c) || snap.board[r][c] === null;
}

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

/** Verify that placing `letter` at (r,c) would form a legal cross-word (or no cross-word).
 *  Returns true if OK (no cross OR cross is a valid word), false if the cross-word is invalid. */
function crossWordOk(
  snap: AISnapshot,
  r: number,
  c: number,
  letter: string,
  dir: Direction,
  dict: Dictionary,
): boolean {
  const perp: Direction = dir === 'H' ? 'V' : 'H';
  const back = step(perp, false);
  const fwd = step(perp, true);
  let prefix = '';
  let r0 = r + back.dr;
  let c0 = c + back.dc;
  while (inBounds(r0, c0) && snap.board[r0][c0] !== null) {
    prefix = snap.board[r0][c0]!.toUpperCase() + prefix;
    r0 += back.dr;
    c0 += back.dc;
  }
  let suffix = '';
  let r1 = r + fwd.dr;
  let c1 = c + fwd.dc;
  while (inBounds(r1, c1) && snap.board[r1][c1] !== null) {
    suffix += snap.board[r1][c1]!.toUpperCase();
    r1 += fwd.dr;
    c1 += fwd.dc;
  }
  if (prefix.length === 0 && suffix.length === 0) return true;
  const word = prefix + letter + suffix;
  return isValidWord(dict, word);
}

function recordCandidate(
  snap: AISnapshot,
  dir: Direction,
  startR: number,
  startC: number,
  word: string,
  placements: Placement[],
  results: GeneratedMove[],
): void {
  const { dr, dc } = step(dir, true);
  const placementByCoord = new Map<string, Placement>();
  for (const p of placements) placementByCoord.set(`${p.r},${p.c}`, p);

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
      // 既存タイルはプレミアム無効
      mainSum += charPoints(snap.board[r][c]!);
    }
  }
  let total = mainSum * mainMult;

  const perp: Direction = dir === 'H' ? 'V' : 'H';
  const backP = step(perp, false);
  const fwdP = step(perp, true);
  for (const p of placements) {
    // 大文字化するとブランク（小文字）の 0 点情報が失われるため、生の文字のまま集める
    let prefix = '';
    let r0 = p.r + backP.dr;
    let c0 = p.c + backP.dc;
    while (inBounds(r0, c0) && snap.board[r0][c0] !== null) {
      prefix = snap.board[r0][c0]! + prefix;
      r0 += backP.dr;
      c0 += backP.dc;
    }
    let suffix = '';
    let r1 = p.r + fwdP.dr;
    let c1 = p.c + fwdP.dc;
    while (inBounds(r1, c1) && snap.board[r1][c1] !== null) {
      suffix += snap.board[r1][c1]!;
      r1 += fwdP.dr;
      c1 += fwdP.dc;
    }
    if (prefix.length === 0 && suffix.length === 0) continue;
    let crossSum = 0;
    let crossMult = 1;
    for (const ch of prefix) crossSum += charPoints(ch);
    const base = p.fromBlank ? 0 : LETTER_POINTS[p.letter];
    const prem = PREMIUM_BOARD[p.r][p.c];
    let letterScore = base;
    if (prem === 'DL') letterScore *= 2;
    else if (prem === 'TL') letterScore *= 3;
    else if (prem === 'DW' || prem === 'STAR') crossMult *= 2;
    else if (prem === 'TW') crossMult *= 3;
    crossSum += letterScore;
    for (const ch of suffix) crossSum += charPoints(ch);
    total += crossSum * crossMult;
  }

  if (placements.length === 7) total += 50;
  results.push({ word, placements, score: total });
}

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
  const curR = startR + prefix.length * dr;
  const curC = startC + prefix.length * dc;

  if (!inBounds(curR, curC)) return;

  // If current cell has an existing tile: consume it (no rack cost, no new placement)
  if (snap.board[curR][curC] !== null) {
    const ch = snap.board[curR][curC]!.toUpperCase();
    const newPrefix = prefix + ch;
    if (!hasPrefix(dict, newPrefix)) return;
    if (placementsSoFar.length > 0 && isValidWord(dict, newPrefix)
        && endsWord(snap, dir, startR, startC, newPrefix.length)) {
      const touchesAnchor = placementsSoFar.some(p => p.r === anchor.r && p.c === anchor.c);
      if (touchesAnchor) {
        recordCandidate(snap, dir, startR, startC, newPrefix, placementsSoFar, results);
      }
    }
    extendForward(snap, dict, dir, anchor, startR, startC, newPrefix, rack, placementsSoFar, results);
    return;
  }

  // Empty cell: try each rack letter
  const tried = new Set<string>();
  for (let i = 0; i < rack.length; i++) {
    const tile = rack[i];
    const candidateLetters: Letter[] =
      tile === 'BLANK'
        ? (['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'] as Letter[])
        : [tile];
    for (const letter of candidateLetters) {
      const dupKey = `${tile}:${letter}`;
      // Skip duplicate letters at the same recursion level to avoid producing the same word twice
      if (tried.has(dupKey)) continue;
      tried.add(dupKey);
      const newPrefix = prefix + letter;
      if (!hasPrefix(dict, newPrefix)) continue;
      if (!crossWordOk(snap, curR, curC, letter, dir, dict)) continue;
      const newPlacement: Placement = {
        r: curR, c: curC, letter, fromBlank: tile === 'BLANK',
      };
      const newRack = rack.slice();
      newRack.splice(i, 1);
      const newPlacements = [...placementsSoFar, newPlacement];
      const touchesAnchor = newPlacements.some(p => p.r === anchor.r && p.c === anchor.c);
      if (touchesAnchor && isValidWord(dict, newPrefix)
          && endsWord(snap, dir, startR, startC, newPrefix.length)) {
        recordCandidate(snap, dir, startR, startC, newPrefix, newPlacements, results);
      }
      extendForward(snap, dict, dir, anchor, startR, startC, newPrefix, newRack, newPlacements, results);
    }
  }
}

function isAnchorCell(snap: AISnapshot, r: number, c: number): boolean {
  const neighbours: [number, number][] = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
  return neighbours.some(([nr, nc]) => snap.board[nr]?.[nc] != null);
}

export function generateMovesAt(
  anchor: { r: number; c: number },
  dir: Direction,
  snap: AISnapshot,
  dict: Dictionary,
  deadline?: number,
): GeneratedMove[] {
  const results: GeneratedMove[] = [];
  const { prefix, startR, startC } = leftExtension(snap, anchor, dir);
  extendForward(snap, dict, dir, anchor, startR, startC, prefix, snap.rack, [], results);

  // 既存タイルが直前に無い場合、アンカーより手前の空マスからも語を始める
  // （既存タイルの左・上へ延ばす手はここでしか見つからない）
  if (prefix.length === 0) {
    const { dr, dc } = step(dir, false);
    const maxOffset = Math.min(snap.rack.length - 1, 6);
    for (let k = 1; k <= maxOffset; k++) {
      const r = anchor.r + k * dr;
      const c = anchor.c + k * dc;
      if (!inBounds(r, c) || snap.board[r][c] !== null) break;
      // そのマス自体がアンカーなら、そこを起点とする探索で生成されるので任せる
      if (isAnchorCell(snap, r, c)) break;
      // eslint-disable-next-line no-undef
      if (deadline !== undefined && performance.now() > deadline) break;
      extendForward(snap, dict, dir, anchor, r, c, '', snap.rack, [], results);
    }
  }
  return results;
}

export function searchAllMoves(
  snap: AISnapshot,
  dict: Dictionary,
  opts: { deadlineMs: number },
): GeneratedMove[] {
  const results: GeneratedMove[] = [];
  // eslint-disable-next-line no-undef
  const deadline = performance.now() + opts.deadlineMs;
  const anchors = findAnchors(snap);
  const orderedAnchors = anchors
    .map(a => ({ a, d: Math.abs(a.r - 7) + Math.abs(a.c - 7) }))
    .sort((x, y) => x.d - y.d)
    .map(x => x.a);

  outer: for (const anchor of orderedAnchors) {
    for (const dir of ['H', 'V'] as const) {
      // eslint-disable-next-line no-undef
      if (performance.now() > deadline) break outer;
      const moves = generateMovesAt(anchor, dir, snap, dict, deadline);
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
