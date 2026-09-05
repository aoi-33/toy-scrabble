import type { GameState, GameMode, PendingPlacement } from './types';
import { createEmptyBoard } from './board';
import { createBag, drawTiles, seededRng } from './bag';
import type { Dictionary } from './dictionary';

export function createInitialState(opts: { seed: number; dict: Dictionary }): GameState {
  const rng = seededRng(opts.seed);
  return {
    mode: 'free',
    status: 'setup',
    board: createEmptyBoard(),
    bag: createBag(rng),
    players: [
      { id: 'P1', name: 'Player 1', score: 0, rack: [] },
      { id: 'COM', name: 'COM', score: 0, rack: [] },
    ],
    currentPlayerIndex: 0,
    turn: 0,
    pending: [],
    history: [],
    lastFormedWords: [],
    consecutivePasses: 0,
    lastError: null,
  };
}

export type Action =
  | { type: 'START_GAME'; mode: GameMode }
  | { type: 'PLACE_PENDING'; placement: PendingPlacement }
  | { type: 'RECALL_PENDING'; coord: { r: number; c: number } }
  | { type: 'RECALL_ALL' }
  | { type: 'COMMIT_PLAY'; dict: Dictionary }
  | { type: 'CLEAR_ERROR' };

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const [p1Rack, afterP1] = drawTiles(state.bag, 7);
      const [comRack, afterCom] = drawTiles(afterP1, 7);
      return {
        ...state,
        mode: action.mode,
        status: 'playing',
        bag: afterCom,
        players: [
          { ...state.players[0], rack: p1Rack, score: 0 },
          { ...state.players[1], rack: comRack, score: 0 },
        ],
        currentPlayerIndex: 0,
        turn: 1,
        pending: [],
        history: [],
        lastFormedWords: [],
        consecutivePasses: 0,
        lastError: null,
      };
    }
    default:
      return state;
  }
}
