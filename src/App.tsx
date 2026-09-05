import { useState } from 'react';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { GameProvider, useGame } from './state/GameContext';
import { Board } from './ui/Board';
import { Rack } from './ui/Rack';
import { ScorePanel } from './ui/ScorePanel';
import { ActionBar } from './ui/ActionBar';
import { BlankLetterModal } from './ui/BlankLetterModal';
import { ExchangeModal } from './ui/ExchangeModal';
import { useSelectedTile } from './state/uiState';
import { seededRng } from './game/bag';

function GameShell() {
  const { state, dispatch, dict } = useGame();
  const { selectedIndex, setSelectedIndex } = useSelectedTile();
  const [pendingBlank, setPendingBlank] = useState<{ r: number; c: number } | null>(null);
  const [showExchange, setShowExchange] = useState(false);

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
      if (tile.kind === 'blank' && tile.assigned === null) {
        setPendingBlank({ r, c });
      }
    }
  }

  function handleDragEnd(evt: DragEndEvent) {
    const source = evt.active.data.current;
    const target = evt.over?.data.current;
    if (source?.source === 'rack' && target && typeof target.r === 'number') {
      const index = source.index as number;
      const { r, c } = target as { r: number; c: number };
      if (state.board[r][c] !== null) return;
      const tile = current.rack[index];
      dispatch({
        type: 'PLACE_PENDING',
        placement: { coord: { r, c }, tile, rackIndex: index },
      });
      setSelectedIndex(null);
      if (tile.kind === 'blank' && tile.assigned === null) {
        setPendingBlank({ r, c });
      }
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
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
        <ActionBar
          canPlay={state.pending.length > 0}
          canRecall={state.pending.length > 0}
          onPlay={() => dispatch({ type: 'COMMIT_PLAY', dict })}
          onRecall={() => dispatch({ type: 'RECALL_ALL' })}
          onShuffle={() => dispatch({ type: 'SHUFFLE_RACK', rng: seededRng(Date.now()) })}
          onPass={() => {
            // eslint-disable-next-line no-undef
            if (confirm('本当に PASS しますか？')) dispatch({ type: 'PASS' });
          }}
          onExchange={() => setShowExchange(true)}
        />

        {state.lastError && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded font-pixel text-xs">
            {state.lastError}
            <button
              className="ml-2 underline"
              onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {pendingBlank && (
        <BlankLetterModal
          onSelect={l => {
            dispatch({ type: 'ASSIGN_BLANK', r: pendingBlank.r, c: pendingBlank.c, letter: l });
            setPendingBlank(null);
          }}
          onCancel={() => {
            dispatch({ type: 'RECALL_PENDING', coord: pendingBlank });
            setPendingBlank(null);
          }}
        />
      )}
      {showExchange && (
        <ExchangeModal
          rack={current.rack}
          onConfirm={indices => {
            dispatch({ type: 'EXCHANGE', indices, rng: seededRng(Date.now()) });
            setShowExchange(false);
          }}
          onCancel={() => setShowExchange(false)}
        />
      )}
    </DndContext>
  );
}

export default function App() {
  return (
    <GameProvider>
      <GameShell />
    </GameProvider>
  );
}
