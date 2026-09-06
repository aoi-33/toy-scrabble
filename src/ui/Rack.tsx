import type React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Tile as TileType } from '../game/types';
import { Tile } from './Tile';

function DraggableRackTile({
  tile,
  index,
  selected,
  onSelect,
}: {
  tile: TileType;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `rack-${index}`,
    data: { source: 'rack', index },
  });
  // touch-action: none が無いとタッチがスクロールに奪われ、ドラッグが始まらない
  const style: React.CSSProperties = {
    touchAction: 'none',
    ...(transform
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
      : {}),
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={`shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center ${
        selected ? 'ring-4 ring-yellow-300' : ''
      } ${isDragging ? 'opacity-50' : ''}`}
      aria-label={`rack-${index}`}
      type="button"
    >
      <Tile tile={tile} variant={selected ? 'in-rack-selected' : 'in-rack'} />
    </button>
  );
}

export function Rack({
  rack,
  selectedIndex,
  onSelect,
}: {
  rack: TileType[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      data-testid="rack-tiles"
      // 44px*7 + gap + padding = 348px。320px 端末には収まらないので横スクロールで逃がす
      className="flex gap-1 p-2 bg-stone-800 rounded max-w-full overflow-x-auto"
      // 手札タイルだけ盤面セルより大きくする
      style={{ '--cell-size': 'var(--rack-tile-size)' } as React.CSSProperties}
    >
      {rack.map((tile, i) => (
        <DraggableRackTile
          key={i}
          tile={tile}
          index={i}
          selected={i === selectedIndex}
          onSelect={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
