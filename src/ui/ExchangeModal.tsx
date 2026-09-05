import { useState } from 'react';
import type { Tile as TileType } from '../game/types';
import { Tile } from './Tile';

export function ExchangeModal({
  rack,
  onConfirm,
  onCancel,
}: {
  rack: TileType[];
  onConfirm: (indices: number[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    const s = new Set(selected);
    if (s.has(i)) s.delete(i);
    else s.add(i);
    setSelected(s);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-stone-800 p-4 rounded">
        <h2 className="font-pixel text-sm mb-3">交換するタイルを選択</h2>
        <div className="flex gap-1">
          {rack.map((tile, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className={selected.has(i) ? 'ring-4 ring-red-400' : ''}
              aria-label={`exchange-tile-${i}`}
            >
              <Tile tile={tile} variant={selected.has(i) ? 'in-rack-selected' : 'in-rack'} />
            </button>
          ))}
        </div>
        <div className="flex gap-3 mt-3 justify-end">
          <button onClick={onCancel} className="text-xs text-stone-300 underline">
            キャンセル
          </button>
          <button
            onClick={() => onConfirm([...selected])}
            disabled={selected.size === 0}
            className="font-pixel text-xs bg-yellow-300 text-stone-900 px-3 py-1 disabled:opacity-40"
          >
            OK ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
