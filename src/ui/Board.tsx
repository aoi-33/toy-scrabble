import type React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Board as BoardType, Coord, PendingPlacement } from '../game/types';
import { PREMIUM_BOARD } from '../game/board';
import { Tile } from './Tile';

const PREMIUM_LABEL: Record<string, { label: string; className: string }> = {
  DL: { label: 'DL', className: 'bg-premium-dl' },
  TL: { label: 'TL', className: 'bg-premium-tl text-white' },
  DW: { label: 'DW', className: 'bg-premium-dw' },
  TW: { label: 'TW', className: 'bg-premium-tw text-white' },
  STAR: { label: '★', className: 'bg-premium-dw' },
};

function DroppableCell({
  r,
  c,
  isEmpty,
  cellClassName,
  children,
  onClick,
}: {
  r: number;
  c: number;
  isEmpty: boolean;
  cellClassName: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${r}-${c}`,
    data: { r, c },
    disabled: !isEmpty,
  });
  return (
    <button
      ref={setNodeRef}
      role="gridcell"
      aria-label={`cell-${r}-${c}`}
      className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[8px] font-pixel ${cellClassName} ${isOver ? 'ring-2 ring-yellow-400' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Board({
  board,
  pending,
  onCellClick,
  highlightCoords = [],
}: {
  board: BoardType;
  pending: PendingPlacement[];
  onCellClick: (r: number, c: number) => void;
  /** ハイライト対象のマス座標（例: COM の直近手のタイル）。金色のリングで強調。 */
  highlightCoords?: Coord[];
}) {
  const pendingMap = new Map<string, PendingPlacement>();
  for (const p of pending) pendingMap.set(`${p.coord.r},${p.coord.c}`, p);
  const highlightSet = new Set(highlightCoords.map(co => `${co.r},${co.c}`));

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
          const isEmpty = !cell && !pendingHere;
          const isHighlighted = highlightSet.has(`${r},${c}`);
          const cellClassName = `${
            isEmpty ? premiumInfo?.className ?? 'bg-cell-bg' : ''
          } ${isHighlighted ? 'ring-4 ring-yellow-300 ring-offset-1 ring-offset-board-bg animate-pulse' : ''}`;
          return (
            <DroppableCell
              key={`${r},${c}`}
              r={r}
              c={c}
              isEmpty={isEmpty}
              cellClassName={cellClassName}
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
            </DroppableCell>
          );
        }),
      )}
    </div>
  );
}
