import type React from 'react';
import { useState } from 'react';
import type { Tile as TileType } from '../game/types';
import { Tile } from './Tile';
import { Sheet } from './Sheet';

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
    <Sheet title="交換するタイルを選択" onDismiss={onCancel}>
      <div
        className="flex gap-1 justify-center flex-wrap"
        // 手札と同じ大きさで見せる
        style={{ '--cell-size': 'var(--rack-tile-size)' } as React.CSSProperties}
      >
        {rack.map((tile, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center ${
              selected.has(i) ? 'ring-4 ring-red-400' : ''
            }`}
            aria-label={`exchange-tile-${i}`}
          >
            <Tile tile={tile} variant={selected.has(i) ? 'in-rack-selected' : 'in-rack'} />
          </button>
        ))}
      </div>
      <div className="flex gap-3 mt-3 justify-end items-center">
        <button onClick={onCancel} className="text-xs text-stone-300 underline min-h-[44px] px-2">
          キャンセル
        </button>
        <button
          onClick={() => onConfirm([...selected])}
          disabled={selected.size === 0}
          className="font-pixel text-xs bg-yellow-300 text-stone-900 px-3 min-h-[44px] disabled:opacity-40"
        >
          OK ({selected.size})
        </button>
      </div>
    </Sheet>
  );
}
