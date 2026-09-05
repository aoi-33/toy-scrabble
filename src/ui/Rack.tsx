import type { Tile as TileType } from '../game/types';
import { Tile } from './Tile';

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
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          className={i === selectedIndex ? 'ring-4 ring-yellow-300' : ''}
          aria-label={`rack-${i}`}
        >
          <Tile tile={tile} variant={i === selectedIndex ? 'in-rack-selected' : 'in-rack'} />
        </button>
      ))}
    </div>
  );
}
