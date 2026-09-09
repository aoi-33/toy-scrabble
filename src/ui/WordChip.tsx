import type { MoveRecord } from '../game/types';

/** 履歴内のタップできる単語。タッチターゲットは既存方針どおり最小 44px */
export function WordChip({
  word,
  onSelect,
}: {
  word: string;
  onSelect: (word: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${word} の意味を見る`}
      onClick={() => onSelect(word)}
      className="inline-flex items-center min-h-[44px] px-1 underline decoration-dotted underline-offset-2 hover:text-amber-300"
    >
      {word}
    </button>
  );
}

/** 1 手ぶんの単語チップ列。pass / exchange には単語が無いので何も出さない */
export function MoveWords({
  record,
  onSelect,
}: {
  record: MoveRecord;
  onSelect: (word: string) => void;
}) {
  if (record.move.kind !== 'place') return null;
  return (
    <>
      {record.wordsFormed.map((word, i) => (
        <span key={`${word}-${i}`}>
          {i > 0 && ' + '}
          <WordChip word={word} onSelect={onSelect} />
        </span>
      ))}
    </>
  );
}
