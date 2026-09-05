import type { GameState, GameMode, PendingPlacement, MoveRecord, Tile, Letter } from './types';
import { createEmptyBoard } from './board';
import { createBag, drawTiles, seededRng, type Rng } from './bag';
import { validatePlacement } from './rules';
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
    lastAiPlacedCoords: [],
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
  | { type: 'COMMIT_AI_PLAY'; placements: PendingPlacement[]; dict: Dictionary }
  | { type: 'EXCHANGE'; indices: number[]; rng: Rng }
  | { type: 'PASS' }
  | { type: 'SHUFFLE_RACK'; rng: Rng }
  | { type: 'ASSIGN_BLANK'; r: number; c: number; letter: Letter }
  | { type: 'CLEAR_ERROR' };

function nextPlayerAndCheckEnd(
  state: GameState,
  nextIndex: 0 | 1,
  consecutivePasses: number,
): Partial<GameState> {
  const anyEmptyRack = state.players.some(p => p.rack.length === 0);
  const bagEmpty = state.bag.length === 0;
  const endedByPasses = consecutivePasses >= 6;
  const endedByEmpty = anyEmptyRack && bagEmpty;
  if (endedByPasses || endedByEmpty) {
    const adjusted = state.players.map(p => {
      const remainingPoints = p.rack.reduce((sum, t) => sum + (t.kind === 'letter' ? t.points : 0), 0);
      return { ...p, score: p.score - remainingPoints };
    }) as GameState['players'];
    if (endedByEmpty) {
      const emptyIdx = state.players.findIndex(p => p.rack.length === 0);
      const otherIdx = emptyIdx === 0 ? 1 : 0;
      const otherRemaining = state.players[otherIdx].rack.reduce(
        (s, t) => s + (t.kind === 'letter' ? t.points : 0),
        0,
      );
      adjusted[emptyIdx] = { ...adjusted[emptyIdx], score: adjusted[emptyIdx].score + otherRemaining };
    }
    return { status: 'ended', players: adjusted, currentPlayerIndex: nextIndex, consecutivePasses };
  }
  return { currentPlayerIndex: nextIndex, consecutivePasses };
}

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
        lastAiPlacedCoords: [],
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
    case 'COMMIT_PLAY': {
      const p = state.players[state.currentPlayerIndex];
      const isFirstMove = state.board.flat().every(c => c === null);
      const result = validatePlacement(state.board, state.pending, action.dict, isFirstMove);
      if (!result.ok) {
        return { ...state, lastError: result.reason };
      }

      const newBoard = state.board.map(row => [...row]);
      for (const pl of state.pending) {
        newBoard[pl.coord.r][pl.coord.c] = { tile: pl.tile, placedTurn: state.turn };
      }

      const drawCount = 7 - p.rack.length;
      const [drawn, newBag] = drawTiles(state.bag, drawCount);
      const newRack = [...p.rack, ...drawn];

      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = {
        ...p,
        rack: newRack,
        score: p.score + result.score,
      };

      const record: MoveRecord = {
        player: p.id,
        move: { kind: 'place', placements: state.pending },
        wordsFormed: result.formedWords.map(w => w.word),
        score: result.score,
      };

      const nextIndex = (state.currentPlayerIndex === 0 ? 1 : 0) as 0 | 1;

      return {
        ...state,
        board: newBoard,
        bag: newBag,
        players: newPlayers,
        pending: [],
        currentPlayerIndex: nextIndex,
        turn: state.turn + 1,
        history: [...state.history, record],
        lastFormedWords: result.formedWords,
        lastAiPlacedCoords: [],
        consecutivePasses: 0,
        lastError: null,
      };
    }
    case 'COMMIT_AI_PLAY': {
      const p = state.players[state.currentPlayerIndex];
      const isFirstMove = state.board.flat().every(c => c === null);
      const result = validatePlacement(state.board, action.placements, action.dict, isFirstMove);
      if (!result.ok) {
        return { ...state, lastError: `COM 手が違反: ${result.reason}` };
      }
      const newBoard = state.board.map(row => [...row]);
      for (const pl of action.placements) {
        newBoard[pl.coord.r][pl.coord.c] = { tile: pl.tile, placedTurn: state.turn };
      }
      let newRack = [...p.rack];
      for (const pl of action.placements) {
        let idx = newRack.indexOf(pl.tile);
        if (idx === -1) {
          idx = newRack.findIndex(t =>
            t.kind === pl.tile.kind &&
            (t.kind === 'letter' && pl.tile.kind === 'letter' ? t.letter === pl.tile.letter : true),
          );
        }
        if (idx !== -1) newRack.splice(idx, 1);
      }
      const drawCount = 7 - newRack.length;
      const [drawn, newBag] = drawTiles(state.bag, drawCount);
      newRack = [...newRack, ...drawn];

      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = {
        ...p,
        rack: newRack,
        score: p.score + result.score,
      };
      const record: MoveRecord = {
        player: p.id,
        move: { kind: 'place', placements: action.placements },
        wordsFormed: result.formedWords.map(w => w.word),
        score: result.score,
      };
      const nextIndex = (state.currentPlayerIndex === 0 ? 1 : 0) as 0 | 1;
      return {
        ...state,
        board: newBoard,
        bag: newBag,
        players: newPlayers,
        pending: [],
        currentPlayerIndex: nextIndex,
        turn: state.turn + 1,
        history: [...state.history, record],
        lastFormedWords: result.formedWords,
        lastAiPlacedCoords: action.placements.map(pl => pl.coord),
        consecutivePasses: 0,
        lastError: null,
      };
    }
    case 'EXCHANGE': {
      if (state.bag.length < 7) {
        return { ...state, lastError: '袋の残りが 7 枚未満のため交換できません' };
      }
      const p = state.players[state.currentPlayerIndex];
      const keep = p.rack.filter((_, i) => !action.indices.includes(i));
      const removed = p.rack.filter((_, i) => action.indices.includes(i));
      const newBag = [...state.bag, ...removed];
      for (let i = newBag.length - 1; i > 0; i--) {
        const j = Math.floor(action.rng() * (i + 1));
        [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
      }
      const [drawn, afterDraw] = drawTiles(newBag, action.indices.length);
      const newRack = [...keep, ...drawn];
      const newPlayers = [...state.players] as GameState['players'];
      newPlayers[state.currentPlayerIndex] = { ...p, rack: newRack };

      const nextIndex = (state.currentPlayerIndex === 0 ? 1 : 0) as 0 | 1;
      const endInfo = nextPlayerAndCheckEnd(
        { ...state, players: newPlayers, bag: afterDraw },
        nextIndex,
        0,
      );
      return {
        ...state,
        players: newPlayers,
        bag: afterDraw,
        pending: [],
        turn: state.turn + 1,
        history: [
          ...state.history,
          { player: p.id, move: { kind: 'exchange', tileIndices: action.indices }, wordsFormed: [], score: 0 },
        ],
        lastError: null,
        ...endInfo,
      };
    }
    case 'PASS': {
      const p = state.players[state.currentPlayerIndex];
      const nextIndex = (state.currentPlayerIndex === 0 ? 1 : 0) as 0 | 1;
      const newConsecutive = state.consecutivePasses + 1;
      const endInfo = nextPlayerAndCheckEnd(state, nextIndex, newConsecutive);
      return {
        ...state,
        turn: state.turn + 1,
        history: [
          ...state.history,
          { player: p.id, move: { kind: 'pass' }, wordsFormed: [], score: 0 },
        ],
        lastError: null,
        ...endInfo,
      };
    }
    case 'ASSIGN_BLANK': {
      const { r, c, letter } = action;
      const newPending = state.pending.map(pl =>
        pl.coord.r === r && pl.coord.c === c && pl.tile.kind === 'blank'
          ? { ...pl, tile: { ...pl.tile, assigned: letter } as Tile }
          : pl,
      );
      return { ...state, pending: newPending };
    }
    case 'CLEAR_ERROR':
      return { ...state, lastError: null };
    default:
      return state;
  }
}
