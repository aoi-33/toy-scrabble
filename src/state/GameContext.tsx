import { createContext, useContext, useReducer, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { GameState } from '../game/types';
import { reducer, createInitialState, type Action } from '../game/reducer';
import { createDictionaryFromText, type Dictionary } from '../game/dictionary';

type GameContextValue = {
  state: GameState;
  dispatch: (a: Action) => void;
  dict: Dictionary | null;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [dict, setDict] = useState<Dictionary | null>(null);
  const initial = useMemo(() => createInitialState({
    seed: Date.now(),
    dict: { words: new Set(), prefixes: new Set(['']) },
  }), []);
  const [state, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    (async () => {
      // eslint-disable-next-line no-undef
      const res = await fetch(`${import.meta.env.BASE_URL}dict/twl06.txt`);
      const text = await res.text();
      setDict(createDictionaryFromText(text));
    })();
  }, []);

  return <GameContext.Provider value={{ state, dispatch, dict }}>{children}</GameContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
