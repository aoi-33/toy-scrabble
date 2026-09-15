import type { GameState } from '../game/types';
import { MODE_LABELS } from './modeLabels';

export function ContinueButton({
  save,
  disabled,
  onContinue,
}: {
  save: GameState;
  disabled: boolean;
  onContinue: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onContinue}
      disabled={disabled}
      aria-label="continue-game"
      className="font-pixel text-xs px-4 py-3 min-h-[44px] w-full max-w-sm text-left bg-yellow-300 text-stone-900 hover:bg-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
    >
      <div>CONTINUE</div>
      <div className="text-[10px] font-normal mt-1 opacity-80">
        {MODE_LABELS[save.mode]}・{save.turn} 手目
      </div>
    </button>
  );
}
