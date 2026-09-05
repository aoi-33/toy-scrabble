import type { GameState, GameMode, PendingPlacement } from './types';
import { createEmptyBoard } from './board';
import { createBag, drawTiles, seededRng, type Rng } from './bag';
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
  | { type: 'SHUFFLE_RACK'; rng: Rng }
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
    case 'PLACE_PENDING': {
      const p = state.players[state.currentPlayerIndex];
      const newRack = [...p.rack];
      newRack.splice(action.placement.rackIndex, 1);
      const newPending = [...state.pending, action.placement];
      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = { ...p, rack: newRack };
      return { ...state, players: newPlayers, pending: newPending, lastError: null };
    }
    case 'RECALL_PENDING': {
      const { r, c } = action.coord;
      const removed = state.pending.find(p => p.coord.r === r && p.coord.c === c);
      if (!removed) return state;
      const p = state.players[state.currentPlayerIndex];
      const newRack = [...p.rack, removed.tile];
      const newPending = state.pending.filter(p2 => !(p2.coord.r === r && p2.coord.c === c));
      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = { ...p, rack: newRack };
      return { ...state, players: newPlayers, pending: newPending };
    }
    case 'RECALL_ALL': {
      if (state.pending.length === 0) return state;
      const p = state.players[state.currentPlayerIndex];
      const newRack = [...p.rack, ...state.pending.map(x => x.tile)];
      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = { ...p, rack: newRack };
      return { ...state, players: newPlayers, pending: [] };
    }
    case 'SHUFFLE_RACK': {
      const p = state.players[state.currentPlayerIndex];
      const rack = [...p.rack];
      for (let i = rack.length - 1; i > 0; i--) {
        const j = Math.floor(action.rng() * (i + 1));
        [rack[i], rack[j]] = [rack[j], rack[i]];
      }
      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = { ...p, rack };
      return { ...state, players: newPlayers };
    }
    case 'CLEAR_ERROR':
      return { ...state, lastError: null };
    default:
      return state;
  }
}
