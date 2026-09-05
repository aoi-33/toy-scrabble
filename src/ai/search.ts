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
