import type { Board, Coord, Direction, PendingPlacement, FormedWord } from './types';
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

// Placeholder — implemented in Task 3.3
export function extractAllFormedWords(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _board: Board,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _placements: PendingPlacement[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _direction: Direction,
): FormedWord[] {
  return [];
}
