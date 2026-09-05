import { GameProvider, useGame } from './state/GameContext';
import { Board } from './ui/Board';
import { Rack } from './ui/Rack';
import { ScorePanel } from './ui/ScorePanel';
import { useSelectedTile } from './state/uiState';

function GameShell() {
  const { state, dispatch, dict } = useGame();
  const { selectedIndex, setSelectedIndex } = useSelectedTile();

  if (!dict) return <p className="p-6">辞書を読み込み中…</p>;

  if (state.status === 'setup') {
    return (
      <div className="p-6 text-center">
        <h1 className="font-pixel text-2xl mb-4">Toy Scrabble</h1>
        <button
          className="font-pixel bg-yellow-300 text-stone-900 px-4 py-2"
          onClick={() => dispatch({ type: 'START_GAME', mode: 'free' })}
        >
          NEW GAME
        </button>
      </div>
    );
  }

  const current = state.players[state.currentPlayerIndex];

  function handleCellClick(r: number, c: number) {
    if (state.pending.some(p => p.coord.r === r && p.coord.c === c)) {
      dispatch({ type: 'RECALL_PENDING', coord: { r, c } });
      return;
    }
    if (selectedIndex !== null && state.board[r][c] === null) {
      const tile = current.rack[selectedIndex];
      dispatch({
        type: 'PLACE_PENDING',
        placement: { coord: { r, c }, tile, rackIndex: selectedIndex },
      });
      setSelectedIndex(null);
    }
  }

  return (
    <div className="p-4 flex flex-col items-center gap-3">
      <h1 className="font-pixel text-xl">Toy Scrabble</h1>
      <ScorePanel
        p1Score={state.players[0].score}
        comScore={state.players[1].score}
        bagRemaining={state.bag.length}
        currentPlayerId={current.id}
      />
      <Board board={state.board} pending={state.pending} onCellClick={handleCellClick} />
      <Rack
        rack={current.rack}
        selectedIndex={selectedIndex}
        onSelect={i => setSelectedIndex(i === selectedIndex ? null : i)}
      />
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <GameShell />
    </GameProvider>
  );
}
