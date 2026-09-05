import type { GameMode } from '../game/types';

type ModeOption = {
  mode: GameMode;
  label: string;
  description: string;
  enabled: boolean;
};

const OPTIONS: ModeOption[] = [
  { mode: 'free', label: 'FREE PLAY', description: '2 人で交互にプレイ', enabled: true },
  { mode: 'com-easy', label: 'COM EASY', description: 'COM 対戦・初級', enabled: true },
  { mode: 'com-medium', label: 'COM MEDIUM', description: 'COM 対戦・中級', enabled: true },
  { mode: 'com-hard', label: 'COM HARD', description: 'COM 対戦・上級', enabled: true },
];

export function ModeSelect({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (mode: GameMode) => void;
}) {
  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      {OPTIONS.map(opt => {
        const isDisabled = disabled || !opt.enabled;
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => opt.enabled && onSelect(opt.mode)}
            disabled={isDisabled}
            aria-label={`mode-${opt.mode}`}
            className={`relative font-pixel text-xs px-4 py-3 text-left transition ${
              opt.enabled
                ? 'bg-yellow-300 text-stone-900 hover:bg-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed'
                : 'bg-stone-700 text-stone-400 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span>{opt.label}</span>
            </div>
            <div className="text-[10px] font-normal mt-1 opacity-80">
              {opt.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}
