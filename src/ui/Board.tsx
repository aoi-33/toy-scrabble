import type { Board as BoardType, PendingPlacement } from '../game/types';
import { PREMIUM_BOARD } from '../game/board';
import { Tile } from './Tile';

const PREMIUM_LABEL: Record<string, { label: string; className: string }> = {
  DL: { label: 'DL', className: 'bg-premium-dl' },
  TL: { label: 'TL', className: 'bg-premium-tl text-white' },
  DW: { label: 'DW', className: 'bg-premium-dw' },
  TW: { label: 'TW', className: 'bg-premium-tw text-white' },
  STAR: { label: '★', className: 'bg-premium-dw' },
};

export function Board({
  board,
  pending,
  onCellClick,
}: {
  board: BoardType;
  pending: PendingPlacement[];
  onCellClick: (r: number, c: number) => void;
}) {
  const pendingMap = new Map<string, PendingPlacement>();
  for (const p of pending) pendingMap.set(`${p.coord.r},${p.coord.c}`, p);

  return (
    <div
      role="grid"
      className="inline-grid gap-px bg-board-bg p-1"
      style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}
    >
      {board.flatMap((row, r) =>
        row.map((cell, c) => {
          const premium = PREMIUM_BOARD[r][c];
          const premiumInfo = premium ? PREMIUM_LABEL[premium] : null;
          const pendingHere = pendingMap.get(`${r},${c}`);
          return (
            <button
              key={`${r},${c}`}
              role="gridcell"
              aria-label={`cell-${r}-${c}`}
              className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[8px] font-pixel ${
                cell || pendingHere ? '' : premiumInfo?.className ?? 'bg-cell-bg'
              }`}
              onClick={() => onCellClick(r, c)}
            >
              {cell ? (
                <Tile tile={cell.tile} variant="on-board-confirmed" />
              ) : pendingHere ? (
                <Tile tile={pendingHere.tile} variant="on-board-pending" />
              ) : premium === 'STAR' ? (
                <span aria-label="center-star">★</span>
              ) : (
                <span>{premiumInfo?.label ?? ''}</span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
