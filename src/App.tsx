import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { GameProvider, useGame } from './state/GameContext';
import { Board } from './ui/Board';
import { Rack } from './ui/Rack';
import { ScorePanel } from './ui/ScorePanel';
import { ActionBar } from './ui/ActionBar';
import { BlankLetterModal } from './ui/BlankLetterModal';
import { ExchangeModal } from './ui/ExchangeModal';
import { ModeSelect } from './ui/ModeSelect';
import { AboutSheet } from './ui/AboutSheet';
import { RulesSheet } from './ui/RulesSheet';
import { useSelectedTile } from './state/uiState';
import { seededRng } from './game/bag';
import { useAiWorker } from './ai/useAiWorker';
import { boardToSnapshot, rackToSnapshot } from './ai/snapshot';
import type { Difficulty } from './ai/types';
import { useDndSensors } from './ui/dndSensors';
import { useMediaQuery } from './ui/useMediaQuery';
import { createDictLoader } from './lookup/dictLoader';
import { DefinitionSheet } from './ui/DefinitionSheet';
import { MoveWords } from './ui/WordChip';

function GameShell() {
  const { state, dispatch, dict } = useGame();
  const dictUrl = dict ? `${import.meta.env.BASE_URL}dict/words.txt` : null;
  const ai = useAiWorker(dictUrl);
  const { selectedIndex, setSelectedIndex } = useSelectedTile();
  const [pendingBlank, setPendingBlank] = useState<{ r: number; c: number } | null>(null);
  const [showExchange, setShowExchange] = useState(false);
  // 辞書ローダはバケットのキャッシュを持つので 1 回だけ作る
  const dictLoader = useMemo(() => createDictLoader(), []);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const sensors = useDndSensors();
  // キーボードショートカットは PC のみ（design.md §5.6）
  const isDesktop = useMediaQuery('(min-width: 769px)');

  // ワーカーは dispatch 前に ready へ戻るため、手番キーで二重依頼と遅延結果の誤適用を防ぐ
  const turnKey = `${state.status}:${state.turn}:${state.currentPlayerIndex}`;
  const currentTurnKeyRef = useRef(turnKey);
  useEffect(() => {
    currentTurnKeyRef.current = turnKey;
  });
  const aiRequestedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.status !== 'playing') {
      aiRequestedKeyRef.current = null;
      return;
    }
    if (state.mode === 'free') return;
    const currentId = state.players[state.currentPlayerIndex].id;
    if (currentId !== 'COM') return;
    if (ai.state !== 'ready') return;
    if (!dict) return;
    if (aiRequestedKeyRef.current === turnKey) return;
    aiRequestedKeyRef.current = turnKey;
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
    console.log(`[AI] request move, difficulty=${difficulty}, rack=${rack.map(t => t.kind === 'letter' ? t.letter : '*').join('')}`);
    // 「思考中」インジケータを最低 500ms は見せる
    const minDelay = new Promise(resolve => setTimeout(resolve, 500));
    Promise.all([ai.requestMove(snap, difficulty), minDelay]).then(([move]) => {
      console.log('[AI] chose move:', move);
      if (currentTurnKeyRef.current !== turnKey) return;
      if (move.kind === 'pass') {
        dispatch({ type: 'PASS' });
      } else if (move.kind === 'exchange') {
        dispatch({ type: 'EXCHANGE', indices: move.tileIndices, rng: seededRng(Date.now()) });
      } else {
        dispatch({ type: 'COMMIT_AI_PLAY', placements: move.placements, dict });
      }
    }).catch(err => {
      console.error('[AI] move failed, passing:', err);
      if (currentTurnKeyRef.current !== turnKey) return;
      dispatch({ type: 'PASS' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, state.mode, ai.state]);

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
    const t = setTimeout(() => setComToast(null), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.history.length]);

  // Enter = PLAY / Escape = RECALL ALL（PC のみ、design.md §5.6）
  const canPlay = state.status === 'playing' && state.pending.length > 0;
  const isHumanTurn =
    state.status === 'playing' &&
    (state.mode === 'free' || state.players[state.currentPlayerIndex].id !== 'COM');
  // シート表示中はショートカットを止める。Escape は Sheet 側が「閉じる」に使う
  const isSheetOpen =
    pendingBlank !== null || showExchange || selectedWord !== null || showAbout;

  useEffect(() => {
    if (!isDesktop || !isHumanTurn || isSheetOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      // 押しっぱなしの連射と、ブラウザ標準ショートカットの横取りを避ける
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        // ボタンや入力欄にフォーカスがある Enter は、その要素の操作が本来の意味
        const tag = document.activeElement?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (!canPlay || !dict) return;
        e.preventDefault();
        dispatch({ type: 'COMMIT_PLAY', dict });
      } else if (e.key === 'Escape') {
        if (!canPlay) return;
        e.preventDefault();
        dispatch({ type: 'RECALL_ALL' });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDesktop, isHumanTurn, isSheetOpen, canPlay, dict, dispatch]);

  if (state.status === 'setup') {
    return (
      <div className="min-h-[100dvh] p-4 md:p-6 text-center flex flex-col items-center justify-center gap-4">
        <h1 className="font-pixel text-2xl mb-2">Toy Scrabble</h1>
        <p className="font-pixel text-[10px] text-stone-400 mb-2">
          モードを選択してください
        </p>
        <ModeSelect
          disabled={!dict}
          onSelect={mode => dispatch({ type: 'START_GAME', mode, rng: seededRng(Date.now()) })}
        />
        {!dict && (
          <p className="font-pixel text-[10px] text-stone-400">
            辞書を読み込んでいます (約 2.7MB)…
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="font-pixel text-[10px] text-stone-400 hover:text-stone-200 min-h-[44px] px-3"
          >
            RULES
          </button>
          <button
            type="button"
            onClick={() => setShowAbout(true)}
            className="font-pixel text-[10px] text-stone-400 hover:text-stone-200 min-h-[44px] px-3"
          >
            ABOUT
          </button>
        </div>
        {showRules && <RulesSheet onDismiss={() => setShowRules(false)} />}
        {showAbout && <AboutSheet onDismiss={() => setShowAbout(false)} />}
      </div>
    );
  }

  if (state.status === 'ended') {
    const [p1, com] = state.players;
    const winner = p1.score > com.score ? 'P1' : com.score > p1.score ? 'COM' : 'DRAW';
    return (
      <div className="min-h-[100dvh] p-4 md:p-6 text-center flex flex-col items-center justify-center gap-4">
        <h1 className="font-pixel text-2xl">GAME OVER</h1>
        <div className="font-pixel">
          {winner === 'DRAW' ? 'DRAW' : `${winner} WINS!`}
        </div>
        <div className="font-pixel">
          P1: {p1.score}{'　'}COM: {com.score}
        </div>
        <button
          onClick={() => dispatch({ type: 'START_GAME', mode: state.mode, rng: seededRng(Date.now()) })}
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
      if (tile.kind === 'blank') {
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
      if (tile.kind === 'blank') {
        setPendingBlank({ r, c });
      }
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* min-h-screen(100vh) はモバイルでアドレスバー分ずれるので dvh を使う */}
      <div
        data-testid="app-shell"
        className="min-h-[100dvh] flex flex-col items-center gap-3 p-2 md:p-4"
      >
        <h1 className="font-pixel text-base md:text-xl">Toy Scrabble</h1>
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
        {/* 320px 幅ではセル下限 20px により盤面が数 px 溢れるため横スクロールを許す */}
        <div data-testid="board-scroller" className="w-full overflow-x-auto flex justify-center">
          <Board
            board={state.board}
            pending={state.pending}
            onCellClick={handleCellClick}
            highlightCoords={state.lastAiPlacedCoords}
          />
        </div>
        {(() => {
          const last = state.history[state.history.length - 1];
          if (!last) return null;
          const playerLabel = last.player === 'COM' ? '🤖 COM' : '👤 P1';
          return (
            <div className="font-pixel text-[10px] sm:text-xs text-stone-300">
              直前手: {playerLabel}:{' '}
              {last.move.kind === 'place' ? (
                <>
                  <MoveWords record={last} onSelect={setSelectedWord} /> +{last.score}
                </>
              ) : last.move.kind === 'pass' ? (
                'PASS'
              ) : (
                `EXCHANGE (${last.move.tileIndices.length} 枚)`
              )}
            </div>
          );
        })()}

        {state.history.length > 0 && (
          <details className="font-pixel text-[10px] text-stone-400">
            <summary className="cursor-pointer min-h-[44px] flex items-center">
              履歴 ({state.history.length} 手)
            </summary>
            <ol className="mt-2 max-h-32 overflow-y-auto text-left px-2">
              {state.history.slice(-8).reverse().map((rec, i) => {
                const num = state.history.length - i;
                const playerLabel = rec.player === 'COM' ? '🤖' : '👤';
                return (
                  <li key={num}>
                    {num}. {playerLabel}{' '}
                    {rec.move.kind === 'place' ? (
                      <>
                        <MoveWords record={rec} onSelect={setSelectedWord} /> +{rec.score}
                      </>
                    ) : rec.move.kind === 'pass' ? (
                      'PASS'
                    ) : (
                      `EXCHANGE (${rec.move.tileIndices.length})`
                    )}
                  </li>
                );
              })}
            </ol>
          </details>
        )}

        {/* 手札と操作は常に親指の届く画面下部に固定する（design.md §5.1）。
            mt-auto でコンテンツが短いときは下端へ、sticky bottom-0 で長いときも貼り付く。
            この要素を board-scroller（overflow-x-auto）の中に入れると sticky が効かなくなる。 */}
        <div
          data-testid="play-footer"
          className="sticky bottom-0 z-30 mt-auto w-full flex flex-col items-center gap-2 bg-stone-900/95 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {/* エラーはフッター内の通常フローに置く。fixed + 固定 bottom 値だと
              フッターの高さが変わったときに重なる。 */}
          {state.lastError && (
            <div className="flex items-center gap-2 bg-red-500 text-white px-4 rounded font-pixel text-xs">
              <span>{state.lastError}</span>
              <button
                className="px-3 min-h-[44px] min-w-[44px] underline"
                aria-label="エラーを閉じる"
                onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
              >
                ✕
              </button>
            </div>
          )}
          <div
            className={`w-full flex justify-center ${isCOMTurn ? 'pointer-events-none opacity-50' : ''}`}
          >
            <Rack
              rack={current.rack}
              selectedIndex={selectedIndex}
              onSelect={i => setSelectedIndex(i === selectedIndex ? null : i)}
            />
          </div>
          <div className={isCOMTurn ? 'pointer-events-none opacity-50' : ''}>
            <ActionBar
              canPlay={state.pending.length > 0}
              canRecall={state.pending.length > 0}
              onPlay={() => dispatch({ type: 'COMMIT_PLAY', dict })}
              onRecall={() => dispatch({ type: 'RECALL_ALL' })}
              onShuffle={() => dispatch({ type: 'SHUFFLE_RACK', rng: seededRng(Date.now()) })}
              onPass={() => {
                if (confirm('本当に PASS しますか？')) dispatch({ type: 'PASS' });
              }}
              onExchange={() => setShowExchange(true)}
            />
          </div>
        </div>

        {comToast && (
          <div className="fixed top-2 left-1/2 -translate-x-1/2 bg-yellow-300 text-stone-900 px-4 py-2 rounded shadow-lg font-pixel text-xs sm:text-sm z-40 animate-bounce">
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
      {selectedWord && (
        <DefinitionSheet
          loader={dictLoader}
          word={selectedWord}
          onDismiss={() => setSelectedWord(null)}
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
