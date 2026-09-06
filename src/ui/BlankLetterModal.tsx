import type { Letter } from '../game/types';

const LETTERS: Letter[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as Letter[];

export function BlankLetterModal({
  onSelect,
  onCancel,
}: {
  onSelect: (letter: Letter) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-stone-800 p-4 rounded">
        <h2 className="font-pixel text-sm mb-3">Blank タイルの文字を選択</h2>
        <div className="grid grid-cols-6 gap-1">
          {LETTERS.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => onSelect(l)}
              aria-label={`letter-${l}`}
              className="min-w-[44px] min-h-[44px] bg-tile-wood text-stone-900 font-bold"
            >
              {l}
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="mt-3 px-3 min-h-[44px] text-xs text-stone-300 underline">
          キャンセル
        </button>
      </div>
    </div>
  );
}
