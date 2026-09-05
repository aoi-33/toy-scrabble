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
