import type { Board, Coord, Direction, PendingPlacement, Tile, FormedWord } from './types';
import { PREMIUM_BOARD } from './board';
import type { Dictionary } from './dictionary';
import { isValidWord } from './dictionary';

export function detectDirection(placements: PendingPlacement[]): Direction | null {
  if (placements.length === 0) return null;
  if (placements.length === 1) return 'H';
  const rows = new Set(placements.map(p => p.coord.r));
  const cols = new Set(placements.map(p => p.coord.c));
  if (rows.size === 1) return 'H';
  if (cols.size === 1) return 'V';
  return null;
}

export type ValidationResult =
  | { ok: true; formedWords: FormedWord[]; score: number }
  | { ok: false; reason: string };

const CENTER: Coord = { r: 7, c: 7 };

export function validatePlacement(
  board: Board,
  placements: PendingPlacement[],
  dict: Dictionary,
  isFirstMove: boolean,
): ValidationResult {
  if (placements.length === 0) return { ok: false, reason: '配置がありません' };

  const direction = detectDirection(placements);
  if (direction === null) return { ok: false, reason: '配置は一直線に並べてください' };

  for (const p of placements) {
    if (board[p.coord.r]?.[p.coord.c] !== null) {
      return { ok: false, reason: '既存タイルの上には置けません' };
    }
  }

  const sorted = [...placements].sort((a, b) =>
    direction === 'H' ? a.coord.c - b.coord.c : a.coord.r - b.coord.r,
  );
  const fixed = direction === 'H' ? sorted[0].coord.r : sorted[0].coord.c;

  if (
    direction === 'H'
      ? sorted.some(p => p.coord.r !== fixed)
      : sorted.some(p => p.coord.c !== fixed)
  ) {
    return { ok: false, reason: '配置は一直線に並べてください' };
  }

  const first = direction === 'H' ? sorted[0].coord.c : sorted[0].coord.r;
  const last = direction === 'H' ? sorted[sorted.length - 1].coord.c : sorted[sorted.length - 1].coord.r;
  const pendingIndex = new Set(sorted.map(p => (direction === 'H' ? p.coord.c : p.coord.r)));
  for (let i = first; i <= last; i++) {
    const cell = direction === 'H' ? board[fixed][i] : board[i][fixed];
    if (!pendingIndex.has(i) && cell === null) {
      return { ok: false, reason: '配置に隙間があります' };
    }
  }

  if (isFirstMove) {
    const coversCenter = sorted.some(p => p.coord.r === CENTER.r && p.coord.c === CENTER.c);
    if (!coversCenter) return { ok: false, reason: '初手はセンター (中央マス) を通ってください' };
  } else {
    const touches = sorted.some(p => {
      const { r, c } = p.coord;
      const nb = [
        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
      ];
      return nb.some(([nr, nc]) => board[nr]?.[nc] != null);
    });
    if (!touches) return { ok: false, reason: '既存タイルに隣接して配置してください' };
  }

  const formedWords = extractAllFormedWords(board, sorted, direction);
  for (const fw of formedWords) {
    if (!isValidWord(dict, fw.word)) {
      return { ok: false, reason: `'${fw.word}' は辞書にありません` };
    }
  }

  const score = formedWords.reduce((sum, w) => sum + w.finalScore, 0)
    + (placements.length === 7 ? 50 : 0);

  return { ok: true, formedWords, score };
}

function tileLetter(tile: Tile): string {
  return tile.kind === 'letter' ? tile.letter : (tile.assigned ?? '?');
}

function tileScore(tile: Tile): number {
  return tile.kind === 'letter' ? tile.points : 0;
}

function scanWord(
  board: Board,
  pendingMap: Map<string, PendingPlacement>,
  start: Coord,
  direction: Direction,
): { tiles: { coord: Coord; tile: Tile; fromPending: boolean }[]; startCoord: Coord } {
  const step = direction === 'H' ? { r: 0, c: -1 } : { r: -1, c: 0 };
  let cur: Coord = { ...start };
  while (true) {
    const prev: Coord = { r: cur.r + step.r, c: cur.c + step.c };
    if (prev.r < 0 || prev.r > 14 || prev.c < 0 || prev.c > 14) break;
    const key = `${prev.r},${prev.c}`;
    const existing = board[prev.r][prev.c];
    const pending = pendingMap.get(key);
    if (existing === null && !pending) break;
    cur = prev;
  }
  const startCoord = { ...cur };

  const forward = direction === 'H' ? { r: 0, c: 1 } : { r: 1, c: 0 };
  const tiles: { coord: Coord; tile: Tile; fromPending: boolean }[] = [];
  while (cur.r >= 0 && cur.r <= 14 && cur.c >= 0 && cur.c <= 14) {
    const key = `${cur.r},${cur.c}`;
    const pending = pendingMap.get(key);
    const existing = board[cur.r][cur.c];
    if (pending) {
      tiles.push({ coord: { ...cur }, tile: pending.tile, fromPending: true });
    } else if (existing) {
      tiles.push({ coord: { ...cur }, tile: existing.tile, fromPending: false });
    } else {
      break;
    }
    cur = { r: cur.r + forward.r, c: cur.c + forward.c };
  }
  return { tiles, startCoord };
}

function scoreWordTiles(tiles: { coord: Coord; tile: Tile; fromPending: boolean }[]): {
  wordMultiplier: number;
  finalScore: number;
} {
  let sum = 0;
  let wordMultiplier = 1;
  for (const { coord, tile, fromPending } of tiles) {
    let letterScore = tileScore(tile);
    if (fromPending) {
      const premium = PREMIUM_BOARD[coord.r][coord.c];
      if (premium === 'DL') letterScore *= 2;
      else if (premium === 'TL') letterScore *= 3;
      else if (premium === 'DW' || premium === 'STAR') wordMultiplier *= 2;
      else if (premium === 'TW') wordMultiplier *= 3;
    }
    sum += letterScore;
  }
  return { wordMultiplier, finalScore: sum * wordMultiplier };
}

export function extractAllFormedWords(
  board: Board,
  placements: PendingPlacement[],
  direction: Direction,
): FormedWord[] {
  if (placements.length === 0) return [];
  const pendingMap = new Map<string, PendingPlacement>();
  for (const p of placements) pendingMap.set(`${p.coord.r},${p.coord.c}`, p);

  const words: FormedWord[] = [];

  const main = scanWord(board, pendingMap, placements[0].coord, direction);
  if (main.tiles.length >= 2) {
    const word = main.tiles.map(t => tileLetter(t.tile)).join('');
    const { wordMultiplier, finalScore } = scoreWordTiles(main.tiles);
    words.push({ word, tiles: main.tiles, wordMultiplier, finalScore });
  }

  const perpendicular: Direction = direction === 'H' ? 'V' : 'H';
  for (const p of placements) {
    const cross = scanWord(board, pendingMap, p.coord, perpendicular);
    if (cross.tiles.length >= 2) {
      const word = cross.tiles.map(t => tileLetter(t.tile)).join('');
      const { wordMultiplier, finalScore } = scoreWordTiles(cross.tiles);
      words.push({ word, tiles: cross.tiles, wordMultiplier, finalScore });
    }
  }

  return words;
}
