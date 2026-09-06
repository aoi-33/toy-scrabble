import type { Tile as TileType } from '../game/types';

export type TileVariant =
  | 'in-rack'
  | 'in-rack-selected'
  | 'on-board-confirmed'
  | 'on-board-pending';

const VARIANT_CLASSES: Record<TileVariant, string> = {
  'in-rack': 'bg-tile-wood text-stone-900 shadow-[2px_2px_0_rgba(0,0,0,0.4)]',
  'in-rack-selected': 'bg-tile-wood text-stone-900 ring-4 ring-yellow-300 shadow-[2px_2px_0_rgba(0,0,0,0.4)]',
  'on-board-confirmed': 'bg-tile-wood text-stone-900 shadow-[1px_1px_0_rgba(0,0,0,0.4)]',
  'on-board-pending': 'bg-yellow-100 text-stone-900 ring-2 ring-yellow-500',
};

export function Tile({ tile, variant }: { tile: TileType; variant: TileVariant }) {
  const displayLetter =
    tile.kind === 'letter' ? tile.letter : (tile.assigned ?? '?');
  const showPoints = tile.kind === 'letter';
  return (
    <div
      className={`relative w-[var(--cell-size)] h-[var(--cell-size)] text-[max(12px,calc(var(--cell-size)*0.5))] flex items-center justify-center font-bold select-none ${VARIANT_CLASSES[variant]}`}
    >
      <span>{displayLetter}</span>
      {showPoints && (
        <span className="absolute bottom-0 right-0.5 text-[max(7px,calc(var(--cell-size)*0.22))] font-normal">
          {tile.points}
        </span>
      )}
    </div>
  );
}
