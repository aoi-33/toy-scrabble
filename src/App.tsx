import { useEffect, useState } from 'react';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { GameProvider, useGame } from './state/GameContext';
import { Board } from './ui/Board';
import { Rack } from './ui/Rack';
import { ScorePanel } from './ui/ScorePanel';
import { ActionBar } from './ui/ActionBar';
import { BlankLetterModal } from './ui/BlankLetterModal';
import { ExchangeModal } from './ui/ExchangeModal';
import { ModeSelect } from './ui/ModeSelect';
import { useSelectedTile } from './state/uiState';
import { seededRng } from './game/bag';
import { useAiWorker } from './ai/useAiWorker';
import { boardToSnapshot, rackToSnapshot } from './ai/snapshot';
import type { Difficulty } from './ai/types';

function GameShell() {
  const { state, dispatch, dict } = useGame();
  const dictUrl = dict ? `${import.meta.env.BASE_URL}dict/twl06.txt` : null;
  const ai = useAiWorker(dictUrl);
  const { selectedIndex, setSelectedIndex } = useSelectedTile();
  const [pendingBlank, setPendingBlank] = useState<{ r: number; c: number } | null>(null);
  const [showExchange, setShowExchange] = useState(false);

  useEffect(() => {
    if (state.status !== 'playing') return;
    if (state.mode === 'free') return;
    const currentId = state.players[state.currentPlayerIndex].id;
    if (currentId !== 'COM') return;
    if (ai.state !== 'ready') return;
    if (!dict) return;
    const difficulty: Difficulty =
      state.mode === 'com-easy' ? 'easy' :
      state.mode === 'com-medium' ? 'medium' : 'hard';
    const rack = state.players[state.currentPlayerIndex].rack;
    const snap = {
      board: boardToSnapshot(state.board),
      rack: rackToSnapshot(rack),
      bagRemaining: state.bag.length,
      isFirstMove: state.board.flat().every(c => c === null),
    };
    // eslint-disable-next-line no-undef
    console.log(`[AI] request move, difficulty=${difficulty}, rack=${rack.map(t => t.kind === 'letter' ? t.letter : '*').join('')}`);
    // 「思考中」インジケータを最低 500ms は見せる
    // eslint-disable-next-line no-undef
    const minDelay = new Promise(resolve => setTimeout(resolve, 500));
    Promise.all([ai.requestMove(snap, difficulty), minDelay]).then(([move]) => {
      // eslint-disable-next-line no-undef
      console.log('[AI] chose move:', move);
      if (move.kind === 'pass') {
        dispatch({ type: 'PASS' });
      } else if (move.kind === 'exchange') {
        dispatch({ type: 'EXCHANGE', indices: move.tileIndices, rng: seededRng(Date.now()) });
      } else {
        dispatch({ type: 'COMMIT_AI_PLAY', placements: move.placements, dict });
      }
    }).catch(err => {
      // eslint-disable-next-line no-undef
      console.error('[AI] move failed, passing:', err);
      dispatch({ type: 'PASS' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.currentPlayerIndex, state.mode, ai.state]);

  // COM の直近手をトースト表示（3.5 秒で自動消去）
  const [comToast, setComToast] = useState<string | null>(null);
  useEffect(() => {
    const last = state.history[state.history.length - 1];
    if (!last || last.player !== 'COM') return;
    let text: string;
    if (last.move.kind === 'place') {
      text = `🤖 COM: ${last.wordsFormed.join(' + ')} +${last.score}`;
    } else if (last.move.kind === 'pass') {
      text = '🤖 COM: PASS';
    } else {
      text = `🤖 COM: EXCHANGE (${last.move.tileIndices.length} 枚)`;
    }
    setComToast(text);
    // eslint-disable-next-line no-undef
    const t = setTimeout(() => setComToast(null), 3500);
    // eslint-disable-next-line no-undef
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.history.length]);

  if (state.status === 'setup') {
    return (
      <div className="p-6 text-center flex flex-col items-center gap-4">
        <h1 className="font-pixel text-2xl mb-2">Toy Scrabble</h1>
        <p className="font-pixel text-[10px] text-stone-400 mb-2">
          モードを選択してください
        </p>
        <ModeSelect
          disabled={!dict}
          onSelect={mode => dispatch({ type: 'START_GAME', mode })}
        />
        {!dict && (
          <p className="font-pixel text-[10px] text-stone-400">
            辞書を読み込んでいます (約 2.7MB)…
          </p>
        )}
      </div>
    );
  }

  if (state.status === 'ended') {
    const [p1, com] = state.players;
    const winner = p1.score > com.score ? 'P1' : com.score > p1.score ? 'COM' : 'DRAW';
    return (
      <div className="p-6 text-center flex flex-col items-center gap-4">
        <h1 className="font-pixel text-2xl">GAME OVER</h1>
        <div className="font-pixel">
          {winner === 'DRAW' ? 'DRAW' : `${winner} WINS!`}
        </div>
        <div className="font-pixel">
          P1: {p1.score}{'　'}COM: {com.score}
        </div>
        <button
          onClick={() => dispatch({ type: 'START_GAME', mode: state.mode })}
          className="font-pixel bg-yellow-300 text-stone-900 px-4 py-2 disabled:opacity-40"
          disabled={!dict}
        >
          {dict ? 'NEW GAME' : '読み込み中…'}
        </button>
      </div>
    );
  }

  // playing: dict は START_GAME 時点で必ずロード済み（setup 画面でボタンを無効化しているため）
  if (!dict) return null;

  const current = state.players[state.currentPlayerIndex];
  const isCOMTurn = state.mode !== 'free' && current.id === 'COM';

  function handleCellClick(r: number, c: number) {
    if (isCOMTurn) return;
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
    if (isCOMTurn) return;
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
        {ai.state === 'thinking' && (
          <div className="font-pixel text-xs text-yellow-300 animate-pulse">
            🤖 COM 思考中…
          </div>
        )}
        <Board
          board={state.board}
          pending={state.pending}
          onCellClick={handleCellClick}
          highlightCoords={state.lastAiPlacedCoords}
        />
        <div className={isCOMTurn ? 'pointer-events-none opacity-50' : ''}>
          <Rack
            rack={current.rack}
            selectedIndex={selectedIndex}
            onSelect={i => setSelectedIndex(i === selectedIndex ? null : i)}
          />
        </div>
        {(() => {
          const last = state.history[state.history.length - 1];
          if (!last) return null;
          const playerLabel = last.player === 'COM' ? '🤖 COM' : '👤 P1';
          let content: string;
          if (last.move.kind === 'place') {
            content = `${last.wordsFormed.join(' + ')} +${last.score}`;
          } else if (last.move.kind === 'pass') {
            content = 'PASS';
          } else {
            content = `EXCHANGE (${last.move.tileIndices.length} 枚)`;
          }
          return (
            <div className="font-pixel text-xs text-stone-300">
              直前手: {playerLabel}: {content}
            </div>
          );
        })()}

        {state.history.length > 0 && (
          <details className="font-pixel text-[10px] text-stone-400">
            <summary className="cursor-pointer">履歴 ({state.history.length} 手)</summary>
            <ol className="mt-2 max-h-32 overflow-y-auto text-left px-2">
              {state.history.slice(-8).reverse().map((rec, i) => {
                const num = state.history.length - i;
                const playerLabel = rec.player === 'COM' ? '🤖' : '👤';
                let content: string;
                if (rec.move.kind === 'place') {
                  content = `${rec.wordsFormed.join(' + ')} +${rec.score}`;
                } else if (rec.move.kind === 'pass') {
                  content = 'PASS';
                } else {
                  content = `EXCHANGE (${rec.move.tileIndices.length})`;
                }
                return (
                  <li key={num}>
                    {num}. {playerLabel} {content}
                  </li>
                );
              })}
            </ol>
          </details>
        )}
        <div className={isCOMTurn ? 'pointer-events-none opacity-50' : ''}>
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
        </div>

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

        {comToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-yellow-300 text-stone-900 px-6 py-3 rounded shadow-lg font-pixel text-sm z-40 animate-bounce">
            {comToast}
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
