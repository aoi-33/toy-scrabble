import type { Letter } from '../game/types';
import { Sheet } from './Sheet';

const LETTERS: Letter[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as Letter[];

export function BlankLetterModal({
  onSelect,
  onCancel,
}: {
  onSelect: (letter: Letter) => void;
  onCancel: () => void;
}) {
  return (
    <Sheet title="Blank タイルの文字を選択" onDismiss={onCancel}>
      <div className="grid grid-cols-6 gap-1 justify-items-center">
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
    </Sheet>
  );
}
