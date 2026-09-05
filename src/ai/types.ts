import type { Letter, Move } from '../game/types';

export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Minimal snapshot for the AI Worker. Uses strings for board cells to make
 * structured-clone cheap. Blank tiles are represented as lowercase letters.
 */
export type AISnapshot = {
  /** 15x15. null = empty. lowercase letter = blank with assigned letter. uppercase = normal. */
  board: (string | null)[][];
  /** Rack tiles: letter or 'BLANK'. */
  rack: (Letter | 'BLANK')[];
  bagRemaining: number;
  isFirstMove: boolean;
};

export type WorkerRequest =
  | { type: 'INIT'; dictUrl: string }
  | { type: 'REQUEST_MOVE'; snapshot: AISnapshot; difficulty: Difficulty; requestId: number };

export type WorkerResponse =
  | { type: 'READY' }
  | { type: 'MOVE_RESULT'; move: Move; requestId: number }
  | { type: 'ERROR'; message: string; requestId?: number };
