export type Letter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';

export type Tile =
  | { kind: 'letter'; letter: Letter; points: number }
  | { kind: 'blank'; assigned: Letter | null; points: 0 };

export type Coord = { r: number; c: number };
export type Direction = 'H' | 'V';

export type PremiumSquare = 'DL' | 'TL' | 'DW' | 'TW' | 'STAR' | null;

export type PlacedTile = { tile: Tile; placedTurn: number };
export type Board = (PlacedTile | null)[][]; // 15x15

export type Rack = Tile[]; // max 7

export type PendingPlacement = { coord: Coord; tile: Tile; rackIndex: number };

export type Move =
  | { kind: 'place'; placements: PendingPlacement[] }
  | { kind: 'exchange'; tileIndices: number[] }
  | { kind: 'pass' };

export type PlayerId = 'P1' | 'COM';
export type Player = { id: PlayerId; name: string; score: number; rack: Rack };

export type GameStatus = 'setup' | 'playing' | 'ended';
export type GameMode = 'free' | 'com-easy' | 'com-medium' | 'com-hard';

export type FormedWord = {
  word: string;
  tiles: { coord: Coord; tile: Tile; fromPending: boolean }[];
  wordMultiplier: number;
  finalScore: number;
};

export type MoveRecord = {
  player: PlayerId;
  move: Move;
  wordsFormed: string[];
  score: number;
};

export type GameState = {
  mode: GameMode;
  status: GameStatus;
  board: Board;
  bag: Tile[];
  players: [Player, Player];
  currentPlayerIndex: 0 | 1;
  turn: number;
  pending: PendingPlacement[];
  history: MoveRecord[];
  lastFormedWords: FormedWord[];
  /** COM が直近で置いたマス座標（ハイライト用）。P1 のプレイ or 新規ゲームでクリア。 */
  lastAiPlacedCoords: Coord[];
  consecutivePasses: number;
  lastError: string | null;
};
