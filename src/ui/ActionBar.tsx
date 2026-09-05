export function ActionBar({
  canPlay,
  canRecall,
  onPlay,
  onRecall,
  onShuffle,
  onPass,
  onExchange,
}: {
  canPlay: boolean;
  canRecall: boolean;
  onPlay: () => void;
  onRecall: () => void;
  onShuffle: () => void;
  onPass: () => void;
  onExchange: () => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      <button
        onClick={onPlay}
        disabled={!canPlay}
        className="font-pixel text-xs bg-green-500 text-white px-3 py-2 disabled:opacity-40"
      >
        PLAY
      </button>
      <button
        onClick={onRecall}
        disabled={!canRecall}
        className="font-pixel text-xs bg-stone-500 text-white px-3 py-2 disabled:opacity-40"
      >
        RECALL
      </button>
      <button onClick={onExchange} className="font-pixel text-xs bg-stone-600 text-white px-3 py-2">
        EXCHANGE
      </button>
      <button onClick={onShuffle} className="font-pixel text-xs bg-stone-600 text-white px-3 py-2">
        SHUFFLE
      </button>
      <button onClick={onPass} className="font-pixel text-xs bg-red-500 text-white px-3 py-2">
        PASS
      </button>
    </div>
  );
}
