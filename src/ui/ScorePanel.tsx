import type { PlayerId } from '../game/types';

export function ScorePanel({
  p1Score,
  comScore,
  bagRemaining,
  currentPlayerId,
}: {
  p1Score: number;
  comScore: number;
  bagRemaining: number;
  currentPlayerId: PlayerId;
}) {
  return (
    <div className="flex justify-between items-center gap-4 font-pixel text-xs p-2 bg-stone-800">
      <div aria-label={currentPlayerId === 'P1' ? 'current-player-P1' : undefined}>
        P1: <span className="text-yellow-300">{p1Score}</span>
      </div>
      <div>🎒 {bagRemaining}</div>
      <div aria-label={currentPlayerId === 'COM' ? 'current-player-COM' : undefined}>
        COM: <span className="text-yellow-300">{comScore}</span>
      </div>
    </div>
  );
}
