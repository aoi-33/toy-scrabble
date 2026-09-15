import type { GameState } from '../game/types';

const KEY = 'toy-scrabble:save';
const VERSION = 1;

export type SavedGame = { version: number; state: GameState };

/** 復帰直後に App.tsx が players[i].rack を無条件に読むので、そこだけは形を確かめる */
function isValidPlayer(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  return Array.isArray((value as { rack?: unknown }).rack);
}

/**
 * JSON.parse は何でも通すので、読み込んだ値が本当に再開できる盤面かを確かめる。
 * ここを通さないと、リリースをまたいで残った古い形のセーブで画面が真っ白になる。
 * タイル 1 枚ずつまでは見ない。現実に起きる壊れ方（スキーマ変更・書き込み中断）は
 * この粒度で捕まえられる。
 */
function isValidState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Partial<GameState>;
  if (s.status !== 'playing') return false;
  if (!Array.isArray(s.board) || s.board.length !== 15) return false;
  if (!s.board.every(row => Array.isArray(row) && row.length === 15)) return false;
  if (!Array.isArray(s.players) || s.players.length !== 2) return false;
  if (!(s.players as unknown[]).every(isValidPlayer)) return false;
  if (s.currentPlayerIndex !== 0 && s.currentPlayerIndex !== 1) return false;
  return Array.isArray(s.bag) && Array.isArray(s.pending) && Array.isArray(s.history);
}

function isSavedGame(value: unknown): value is SavedGame {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<SavedGame>;
  return v.version === VERSION && isValidState(v.state);
}

export function loadSave(): GameState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (err) {
    console.warn('[save] localStorage を読めませんでした', err);
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[save] セーブが壊れていました', err);
  }

  if (isSavedGame(parsed)) return parsed.state;

  // 再開できないセーブを残しても CONTINUE が出ないだけで邪魔なので捨てる
  clearSave();
  return null;
}

export function saveGame(state: GameState): void {
  const payload: SavedGame = { version: VERSION, state };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch (err) {
    // 容量超過やプライベートモード。保存できなくてもゲームは続けられる
    console.warn('[save] ゲームを保存できませんでした', err);
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    console.warn('[save] セーブを削除できませんでした', err);
  }
}
