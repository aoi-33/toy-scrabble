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
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={`${selected ? 'ring-4 ring-yellow-300' : ''} ${isDragging ? 'opacity-50' : ''}`}
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
    <div className="inline-flex gap-1 p-2 bg-stone-800 rounded">
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
