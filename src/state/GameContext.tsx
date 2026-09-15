import { createContext, useContext, useReducer, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { GameState } from '../game/types';
import { reducer, createInitialState, type Action } from '../game/reducer';
import { createDictionaryFromText, type Dictionary } from '../game/dictionary';
import { loadSave, saveGame, clearSave } from './saveGame';

type GameContextValue = {
  state: GameState;
  dispatch: (a: Action) => void;
  dict: Dictionary | null;
  savedGame: GameState | null;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [dict, setDict] = useState<Dictionary | null>(null);
  const initial = useMemo(() => createInitialState({
    seed: Date.now(),
    dict: { words: new Set(), prefixes: new Set(['']) },
  }), []);
  const [state, dispatch] = useReducer(reducer, initial);
  // 起動時に 1 回だけ読む。CONTINUE を出すかどうかの判断にしか使わない
  const [savedGame] = useState<GameState | null>(() => loadSave());

  useEffect(() => {
    (async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}dict/words.txt`);
      const text = await res.text();
      setDict(createDictionaryFromText(text));
    })();
  }, []);

  useEffect(() => {
    if (state.status === 'playing') {
      saveGame(state);
    } else if (state.status === 'ended') {
      clearSave();
    }
    // status === 'setup' は起動直後。ここで消すと CONTINUE を押す前にセーブが失われる
  }, [state]);

  return (
    <GameContext.Provider value={{ state, dispatch, dict, savedGame }}>
      {children}
    </GameContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
