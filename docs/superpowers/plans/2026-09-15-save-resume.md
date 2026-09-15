# 途中のゲームを保存して続きから遊ぶ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 進行中のゲームを localStorage に 1 つだけ保存し、次回起動時にホーム画面の `CONTINUE` から再開できるようにする。

**Architecture:** localStorage への出入口を `src/state/saveGame.ts` 1 つに閉じ込め、`GameProvider` が `useEffect` で `status` を見ながら保存・削除する。復元は reducer の `RESTORE_GAME` action 1 つで行い、起動時の画面は今までどおり必ず setup から始まる。

**Tech Stack:** React 18 + TypeScript (strict) + Vite 5 + Tailwind 3.4 / Vitest 2 + @testing-library/react 16 + jsdom

**Spec:** `docs/superpowers/specs/2026-09-15-save-resume-design.md`

---

## 前提知識

実装を始める前にこれだけ知っておいてください。

1. **テストは `fireEvent` を使う。`@testing-library/user-event` は依存に入っていない。** 新しく入れないこと。
2. **`tsconfig.app.json` の `include` は `["src", "tests"]`。** テストも `tsc -b` で型検査される。Vitest は esbuild なので型を無視する。**テストが緑でも `npx tsc -b` が赤になることがある**ので、必ず両方走らせる。
3. **lint はリポジトリ全体に対して `npx eslint .` で走らせる。** `npm run lint` は使えない。
4. **`eslint.config.js` は編集できない**（フックで保護されている）。既存ルールを通るコードを書くこと。とくに **`catch {}` のような空ブロックを書かない** — 握りつぶす場合も `console.warn` を 1 行入れる。
5. **新しく eslint の `disable` コメントを足さないこと。**
6. **コメントと文言は日本語**。変数名・関数名・ファイル名は英語。
7. **コミットメッセージは 1 行**。`Co-Authored-By` 行は付けない。
8. **`git push` はしない。** すべてのタスクが終わったあと、ユーザーが自分で実行する。
9. jsdom は `localStorage` を本物として持っている。**モックせず実物を使い、`beforeEach` で `localStorage.clear()` する。**
10. テスト実行の出力は `PASS (n) FAIL (n)` の形に要約されることがある。件数で判断すること。

## ファイル構成

| ファイル | 種別 | 責務 |
|---|---|---|
| `src/state/saveGame.ts` | 新規 | localStorage への読み書きと、読み込み時の検証。ここ以外で localStorage に触らない |
| `src/game/reducer.ts` | 変更 | `RESTORE_GAME` action を追加 |
| `src/state/GameContext.tsx` | 変更 | `status` を見て保存・削除する `useEffect`。起動時に 1 回だけ `loadSave()` |
| `src/ui/modeLabels.ts` | 新規 | `GameMode` → 表示名。`ModeSelect` と `ContinueButton` が共有する |
| `src/ui/ModeSelect.tsx` | 変更 | 表示名を `modeLabels.ts` から取るようにする（純リファクタ） |
| `src/ui/ContinueButton.tsx` | 新規 | ホーム画面の `CONTINUE` ボタン |
| `src/App.tsx` | 変更 | setup 画面に `CONTINUE` を置き、モード選択に上書き確認を挟む |
| `tests/saveGame.test.ts` | 新規 | `saveGame.ts` の壊れ方を網羅 |
| `tests/reducer.test.ts` | 変更 | `RESTORE_GAME` を 1 件追加 |
| `tests/ui/ModeSelect.test.tsx` | 変更 | 表示名のリファクタを守る 1 件を追加 |
| `tests/ui/App.save.test.tsx` | 新規 | 保存・削除・`CONTINUE`・上書き確認の配線 |
| `README.md` | 変更 | 遊び方と変更履歴 |

---

### Task 1: セーブの読み書きモジュール

**Files:**
- Create: `src/state/saveGame.ts`
- Test: `tests/saveGame.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/saveGame.test.ts` を新規作成します。

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadSave, saveGame, clearSave } from '../src/state/saveGame';
import { reducer, createInitialState } from '../src/game/reducer';
import { createDictionaryFromText } from '../src/game/dictionary';
import { seededRng } from '../src/game/bag';

// saveGame.ts の外から見たキーは外部契約なので、テスト側にも直接書いて固定する
const KEY = 'toy-scrabble:save';

const dict = createDictionaryFromText('CAT\nDOG\n');

function playingState() {
  return reducer(createInitialState({ seed: 1, dict }), {
    type: 'START_GAME',
    mode: 'com-hard',
    rng: seededRng(1),
  });
}

describe('saveGame / loadSave', () => {
  beforeEach(() => {
    localStorage.clear();
    // 壊れたセーブのテストで console.warn が出るので黙らせる
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('保存したものをそのまま読み戻せる', () => {
    const state = playingState();
    saveGame(state);
    expect(loadSave()).toEqual(state);
  });

  it('保存が無ければ null を返す', () => {
    expect(loadSave()).toBeNull();
  });

  it('version が違うセーブは null を返し、キーも消す', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 999, state: playingState() }));
    expect(loadSave()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('壊れた JSON は null を返し、キーも消す', () => {
    localStorage.setItem(KEY, '{壊れている');
    expect(loadSave()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('status が playing でないセーブは null を返す', () => {
    const setup = createInitialState({ seed: 1, dict });
    localStorage.setItem(KEY, JSON.stringify({ version: 1, state: setup }));
    expect(loadSave()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('board が 15x15 でないセーブは null を返す', () => {
    const broken = { ...playingState(), board: [[null]] };
    localStorage.setItem(KEY, JSON.stringify({ version: 1, state: broken }));
    expect(loadSave()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('setItem が例外を投げても saveGame は throw しない', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveGame(playingState())).not.toThrow();
  });

  it('clearSave はセーブを消す', () => {
    saveGame(playingState());
    clearSave();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗することを確認する**

Run: `npx vitest run tests/saveGame.test.ts`

Expected: FAIL。`src/state/saveGame.ts` が存在しないので解決エラーになります。

- [ ] **Step 3: 実装する**

`src/state/saveGame.ts` を新規作成します。

```ts
import type { GameState } from '../game/types';

const KEY = 'toy-scrabble:save';
const VERSION = 1;

export type SavedGame = { version: number; state: GameState };

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
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/saveGame.test.ts`

Expected: PASS (8) FAIL (0)

- [ ] **Step 5: 型と lint を確認する**

Run: `npx tsc -b && npx eslint .`

Expected: `TypeScript: No errors found` と `ESLint: No issues found`

- [ ] **Step 6: コミットする**

```bash
git add src/state/saveGame.ts tests/saveGame.test.ts
git commit -m "feat: ゲームの保存と読み込みを行う saveGame モジュールを追加する"
```

---

### Task 2: RESTORE_GAME action

**Files:**
- Modify: `src/game/reducer.ts:29-40`（`Action` 型）と `src/game/reducer.ts:321-322`（`CLEAR_ERROR` の case の隣）
- Test: `tests/reducer.test.ts`（末尾に describe を 1 つ追加）

- [ ] **Step 1: 失敗するテストを書く**

`tests/reducer.test.ts` の末尾に次を追加します。ファイル先頭の import（`reducer`, `createInitialState`, `createDictionaryFromText`, `seededRng`）と `const dict` は既にあるので、そのまま使えます。

```ts
describe('reducer / RESTORE_GAME', () => {
  it('渡された state をそのまま返す', () => {
    const initial = createInitialState({ seed: 1, dict });
    const saved = reducer(initial, { type: 'START_GAME', mode: 'com-hard', rng: seededRng(7) });

    const restored = reducer(initial, { type: 'RESTORE_GAME', state: saved });

    expect(restored).toEqual(saved);
    expect(restored.status).toBe('playing');
    expect(restored.mode).toBe('com-hard');
  });
});
```

- [ ] **Step 2: 失敗することを確認する**

Run: `npx vitest run tests/reducer.test.ts`

Expected: FAIL。`RESTORE_GAME` は `Action` に無いので `default` 節に落ち、`restored` が `initial`（`status: 'setup'`）のまま返ります。

- [ ] **Step 3: 実装する**

`src/game/reducer.ts` の `Action` 型に 1 行足します。`CLEAR_ERROR` の行の直後です。

```ts
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESTORE_GAME'; state: GameState };
```

`CLEAR_ERROR` の `case` の直後に `case` を足します。

```ts
    case 'CLEAR_ERROR':
      return { ...state, lastError: null };
    case 'RESTORE_GAME':
      return action.state;
    default:
      return state;
```

`GameState` は `src/game/reducer.ts:1` で既に import 済みなので、import の変更は要りません。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/reducer.test.ts`

Expected: FAIL (0)

- [ ] **Step 5: コミットする**

```bash
git add src/game/reducer.ts tests/reducer.test.ts
git commit -m "feat: 保存した state を復元する RESTORE_GAME を reducer に追加する"
```

---

### Task 3: GameContext で保存と削除を行う

**Files:**
- Modify: `src/state/GameContext.tsx`（全体）
- Test: `tests/ui/App.save.test.tsx`（新規）

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/App.save.test.tsx` を新規作成します。

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => ({ state: 'ready' as const, requestMove: vi.fn() }),
}));

import App from '../../src/App';

const KEY = 'toy-scrabble:save';

describe('App のセーブ', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => 'CAT\nDOG\n' }));
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  async function startFreePlay() {
    render(<App />);
    const free = await screen.findByLabelText('mode-free');
    await waitFor(() => expect(free).not.toBeDisabled());
    fireEvent.click(free);
    await screen.findByLabelText('cell-7-7');
  }

  it('ゲームを始めると進行状況が保存される', async () => {
    await startFreePlay();

    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    expect(saved.version).toBe(1);
    expect(saved.state.status).toBe('playing');
    expect(saved.state.mode).toBe('free');
  });

  it('ゲームが終わるとセーブが消える', async () => {
    await startFreePlay();
    await waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());

    // 6 連続 PASS で終局する（reducer.ts:54）。confirm は true に stub 済み
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText('PASS'));
    }

    await screen.findByText('GAME OVER');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗することを確認する**

Run: `npx vitest run tests/ui/App.save.test.tsx`

Expected: FAIL (2)。まだ誰も `saveGame()` を呼んでいないので `localStorage.getItem(KEY)` が `null` のままです。

- [ ] **Step 3: 実装する**

`src/state/GameContext.tsx` を次の内容に置き換えます。

```tsx
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
```

末尾の `react-refresh/only-export-components` の disable は**既存のものをそのまま残しています**。新規に足したものではありません。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/ui/App.save.test.tsx`

Expected: PASS (2) FAIL (0)

- [ ] **Step 5: 既存テストが壊れていないことを確認する**

Run: `npx vitest run && npx tsc -b && npx eslint .`

Expected: FAIL (0)、`TypeScript: No errors found`、`ESLint: No issues found`

- [ ] **Step 6: コミットする**

```bash
git add src/state/GameContext.tsx tests/ui/App.save.test.tsx
git commit -m "feat: 対局中は進行状況を保存し、終局したら消す"
```

---

### Task 4: モード表示名を共有モジュールに切り出す

`ContinueButton` が「COM HARD」のようなモード名を出すため、`ModeSelect` が持っている
表示名を共有できる場所へ移します。振る舞いは変わらない純粋なリファクタです。

`ModeSelect.tsx` から直接 export しない理由は、component ファイルが非コンポーネントも
export すると `react-refresh/only-export-components` に触れるためです。新しい disable
コメントを足さない方針なので、別モジュールにします。

**Files:**
- Create: `src/ui/modeLabels.ts`
- Modify: `src/ui/ModeSelect.tsx:1-52`
- Test: `tests/ui/ModeSelect.test.tsx`（1 件追加）

- [ ] **Step 1: 失敗するテストを書く**

現在の `tests/ui/ModeSelect.test.tsx` は `aria-label` しか見ておらず、画面に出る表示名を
誰も守っていません。リファクタで表示名が消えても気付けないので、先に 1 件足します。
`describe` の中、既存の最後の `it` の後ろに追加してください。

```tsx
  it('モード名を画面に表示する', () => {
    render(<ModeSelect disabled={false} onSelect={() => {}} />);
    expect(screen.getByLabelText('mode-free').textContent).toContain('FREE PLAY');
    expect(screen.getByLabelText('mode-com-hard').textContent).toContain('COM HARD');
  });
```

- [ ] **Step 2: 現時点では通ることを確認する**

Run: `npx vitest run tests/ui/ModeSelect.test.tsx`

Expected: PASS (7) FAIL (0)

このテストは新機能ではなく、これから行うリファクタの安全網です。**今は通って正しい。**
Step 4 のあとも通り続けることが目的です。

- [ ] **Step 3: 実装する**

`src/ui/modeLabels.ts` を新規作成します。

```ts
import type { GameMode } from '../game/types';

export const MODE_LABELS: Record<GameMode, string> = {
  free: 'FREE PLAY',
  'com-easy': 'COM EASY',
  'com-medium': 'COM MEDIUM',
  'com-hard': 'COM HARD',
};
```

`src/ui/ModeSelect.tsx` を次の内容に置き換えます。`ModeOption` から `label` を落とし、
表示時に `MODE_LABELS` を引くようにしています。

```tsx
import type { GameMode } from '../game/types';
import { MODE_LABELS } from './modeLabels';

type ModeOption = {
  mode: GameMode;
  description: string;
  enabled: boolean;
};

const OPTIONS: ModeOption[] = [
  { mode: 'free', description: '2 人で交互にプレイ', enabled: true },
  { mode: 'com-easy', description: 'COM 対戦・初級', enabled: true },
  { mode: 'com-medium', description: 'COM 対戦・中級', enabled: true },
  { mode: 'com-hard', description: 'COM 対戦・上級', enabled: true },
];

export function ModeSelect({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (mode: GameMode) => void;
}) {
  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      {OPTIONS.map(opt => {
        const isDisabled = disabled || !opt.enabled;
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => opt.enabled && onSelect(opt.mode)}
            disabled={isDisabled}
            aria-label={`mode-${opt.mode}`}
            className={`relative font-pixel text-xs px-4 py-3 min-h-[44px] text-left transition ${
              opt.enabled
                ? 'bg-yellow-300 text-stone-900 hover:bg-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed'
                : 'bg-stone-700 text-stone-400 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span>{MODE_LABELS[opt.mode]}</span>
            </div>
            <div className="text-[10px] font-normal mt-1 opacity-80">
              {opt.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/ui/ModeSelect.test.tsx && npx tsc -b && npx eslint .`

Expected: PASS (7) FAIL (0)、`TypeScript: No errors found`、`ESLint: No issues found`

- [ ] **Step 5: コミットする**

```bash
git add src/ui/modeLabels.ts src/ui/ModeSelect.tsx tests/ui/ModeSelect.test.tsx
git commit -m "refactor: モード表示名を modeLabels に切り出して共有できるようにする"
```

---

### Task 5: ホーム画面の CONTINUE ボタン

**Files:**
- Create: `src/ui/ContinueButton.tsx`
- Modify: `src/App.tsx:25`（`useGame()` の分割代入）、`src/App.tsx:144-180`（setup 画面）
- Test: `tests/ui/App.save.test.tsx`（追記）

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/App.save.test.tsx` の import に次の 3 行を足します（`import App` の下）。

```tsx
import { reducer, createInitialState } from '../../src/game/reducer';
import { createDictionaryFromText } from '../../src/game/dictionary';
import { seededRng } from '../../src/game/bag';
```

`const KEY = 'toy-scrabble:save';` の下にヘルパーを足します。

```tsx
/** 再開できるセーブを localStorage に置く。render() より前に呼ぶこと */
function seedSave() {
  const dict = createDictionaryFromText('CAT\nDOG\n');
  const state = reducer(createInitialState({ seed: 1, dict }), {
    type: 'START_GAME',
    mode: 'com-hard',
    rng: seededRng(1),
  });
  localStorage.setItem(KEY, JSON.stringify({ version: 1, state }));
  return state;
}
```

`describe` の末尾に次の 4 件を足します。

```tsx
  it('セーブが無ければ CONTINUE を出さない', async () => {
    render(<App />);
    await screen.findByLabelText('mode-free');
    expect(screen.queryByLabelText('continue-game')).toBeNull();
  });

  it('セーブがあれば CONTINUE を出し、モード名と手数を見せる', async () => {
    const saved = seedSave();
    render(<App />);

    const button = await screen.findByLabelText('continue-game');
    expect(button.textContent).toContain('CONTINUE');
    expect(button.textContent).toContain('COM HARD');
    expect(button.textContent).toContain(`${saved.turn} 手目`);
  });

  it('辞書の読み込み中は CONTINUE を押せない', async () => {
    seedSave();
    render(<App />);
    // fetch の解決前は dict が null。復帰しても盤面を描けないので押させない
    expect(screen.getByLabelText('continue-game')).toBeDisabled();
  });

  it('CONTINUE を押すと保存された盤面に戻る', async () => {
    seedSave();
    render(<App />);

    const button = await screen.findByLabelText('continue-game');
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await screen.findByLabelText('cell-7-7');
    expect(screen.queryByLabelText('mode-free')).toBeNull();
  });
```

- [ ] **Step 2: 失敗することを確認する**

Run: `npx vitest run tests/ui/App.save.test.tsx`

Expected: FAIL (3)。`continue-game` という `aria-label` を持つ要素がまだ無いためです
（`セーブが無ければ CONTINUE を出さない` だけは、要素が無いので今も通ります）。

- [ ] **Step 3: ContinueButton を作る**

`src/ui/ContinueButton.tsx` を新規作成します。

```tsx
import type { GameState } from '../game/types';
import { MODE_LABELS } from './modeLabels';

export function ContinueButton({
  save,
  disabled,
  onContinue,
}: {
  save: GameState;
  disabled: boolean;
  onContinue: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onContinue}
      disabled={disabled}
      aria-label="continue-game"
      className="font-pixel text-xs px-4 py-3 min-h-[44px] w-full max-w-sm text-left bg-yellow-300 text-stone-900 hover:bg-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
    >
      <div>CONTINUE</div>
      <div className="text-[10px] font-normal mt-1 opacity-80">
        {MODE_LABELS[save.mode]}・{save.turn} 手目
      </div>
    </button>
  );
}
```

- [ ] **Step 4: App に配線する**

`src/App.tsx:12`（`RulesSheet` の import の下）に足します。

```tsx
import { ContinueButton } from './ui/ContinueButton';
```

`src/App.tsx:25` を書き換えます。

```tsx
  const { state, dispatch, dict, savedGame } = useGame();
```

setup 画面（`src/App.tsx:144-180`）の `<p>モードを選択してください</p>` と `<ModeSelect ...>` の
**間**に `ContinueButton` を挿します。`ModeSelect` の外に置くのは、`ModeSelect` が
`GameMode` を 1 つ選ぶためのコンポーネントであり、`CONTINUE` はモードではないからです。

```tsx
        <p className="font-pixel text-[10px] text-stone-400 mb-2">
          モードを選択してください
        </p>
        {savedGame && (
          <ContinueButton
            save={savedGame}
            disabled={!dict}
            onContinue={() => dispatch({ type: 'RESTORE_GAME', state: savedGame })}
          />
        )}
        <ModeSelect
          disabled={!dict}
          onSelect={mode => dispatch({ type: 'START_GAME', mode, rng: seededRng(Date.now()) })}
        />
```

`disabled={!dict}` が要る理由: 復帰後の画面は `Board` を描きますが、`GameShell` は辞書が
未ロードだと `null` を返します（`src/App.tsx:206`）。辞書を待たずに押せると真っ白な画面に
なります。

- [ ] **Step 5: テストが通ることを確認する**

Run: `npx vitest run tests/ui/App.save.test.tsx`

Expected: PASS (6) FAIL (0)

- [ ] **Step 6: 全体を確認する**

Run: `npx vitest run && npx tsc -b && npx eslint .`

Expected: FAIL (0)、`TypeScript: No errors found`、`ESLint: No issues found`

- [ ] **Step 7: コミットする**

```bash
git add src/ui/ContinueButton.tsx src/App.tsx tests/ui/App.save.test.tsx
git commit -m "feat: ホーム画面の CONTINUE から途中のゲームを再開できるようにする"
```

---

### Task 6: 新しいモードを選ぶときの上書き確認

セーブは 1 つしか無いので、誤タップで進行中の対局が消えないようにします。

**Files:**
- Modify: `src/App.tsx`（setup 画面の `ModeSelect` の `onSelect`）
- Test: `tests/ui/App.save.test.tsx`（追記）

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/App.save.test.tsx` の `describe` 末尾に 2 件足します。

```tsx
  it('セーブがある状態でモードを押すと確認が出て、キャンセルすれば始まらない', async () => {
    seedSave();
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmSpy);

    render(<App />);
    const free = await screen.findByLabelText('mode-free');
    await waitFor(() => expect(free).not.toBeDisabled());
    fireEvent.click(free);

    expect(confirmSpy).toHaveBeenCalled();
    // キャンセルしたので setup 画面のまま。盤面は出ない
    expect(screen.queryByLabelText('cell-7-7')).toBeNull();
    expect(screen.getByLabelText('continue-game')).toBeInTheDocument();
  });

  it('セーブが無いときは確認を出さずに始まる', async () => {
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmSpy);

    render(<App />);
    const free = await screen.findByLabelText('mode-free');
    await waitFor(() => expect(free).not.toBeDisabled());
    fireEvent.click(free);

    await screen.findByLabelText('cell-7-7');
    expect(confirmSpy).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: 失敗することを確認する**

Run: `npx vitest run tests/ui/App.save.test.tsx`

Expected: FAIL (1)。`セーブがある状態で…` が落ちます。まだ確認を挟んでいないので
`confirmSpy` は呼ばれず、そのまま新しいゲームが始まって盤面が出ます。

- [ ] **Step 3: 実装する**

`src/App.tsx` の setup 画面の `return` の**手前**にハンドラを定義します
（`if (state.status === 'setup') {` の直後です）。

ブロックの中なので `function` 宣言ではなくアロー関数の `const` にします。
`no-inner-declarations` を踏まずに済みます。

```tsx
  if (state.status === 'setup') {
    // セーブは 1 つしか無い。誤タップで進行中の対局を失わないよう確認を挟む
    const handleSelectMode = (mode: GameMode) => {
      if (savedGame && !confirm('途中のゲームが消えます。新しく始めますか？')) return;
      dispatch({ type: 'START_GAME', mode, rng: seededRng(Date.now()) });
    };

    return (
```

`ModeSelect` の `onSelect` を差し替えます。

```tsx
        <ModeSelect disabled={!dict} onSelect={handleSelectMode} />
```

`GameMode` 型の import を `src/App.tsx` の先頭に足します。`import type { Difficulty }` の
行の隣が収まりがよいです。

```tsx
import type { GameMode } from './game/types';
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/ui/App.save.test.tsx`

Expected: PASS (8) FAIL (0)

- [ ] **Step 5: 全体を確認する**

Run: `npx vitest run && npx tsc -b && npx eslint .`

Expected: FAIL (0)、`TypeScript: No errors found`、`ESLint: No issues found`

- [ ] **Step 6: コミットする**

```bash
git add src/App.tsx tests/ui/App.save.test.tsx
git commit -m "feat: セーブがあるとき新規ゲームの開始前に確認する"
```

---

### Task 7: README を更新する

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 遊び方に 1 項目足す**

`## 遊び方（Plan 1 時点）` の番号付きリストの `1.` の**前**に新しい `1.` を入れ、
以降の番号を 1 つずつ繰り下げます。つまり先頭を次のようにします。

```markdown
1. 途中で閉じたゲームがあると、ホーム画面の一番上に `CONTINUE` が出る。押すと続きから遊べる
2. ホーム画面で `FREE PLAY` / `COM EASY` / `COM MEDIUM` / `COM HARD` から選択してゲーム開始
```

以降の項目（`2.` 以降だったもの）を `3.` から順に振り直してください。最後は `10.` になります。

- [ ] **Step 2: 変更履歴の先頭に追記する**

`## 変更履歴` の直下、既存の一番上の行の**前**に足します。

```markdown
- **2026-09-15** 途中のゲームを保存して続きから遊べるようにした。対局中の状態を localStorage に 1 つだけ保存し、ホーム画面の `CONTINUE` から再開できる。セーブがある状態で新しいモードを選ぶと確認が出る。終局すると保存は消える。
```

- [ ] **Step 3: 番号が通っていることを目で確認する**

Run: `grep -n "^[0-9]*\." README.md | head -20`

Expected: `1.` から `10.` まで飛びなく並んでいること。

- [ ] **Step 4: コミットする**

```bash
git add README.md
git commit -m "docs: 途中のゲームを再開できるようになったことを README に書く"
```

---

## 完了条件

すべてのタスクが終わったら次を確認します。

- [ ] `npx vitest run` が FAIL (0)。件数は着手前より **18 件**増えている
      （saveGame 8 + reducer 1 + ModeSelect 1 + App.save 8）。
      着手前の総数は Task 1 に入る前に `npx vitest run` を 1 回走らせて控えておくこと
- [ ] `npx tsc -b` が `TypeScript: No errors found`
- [ ] `npx eslint .` が `ESLint: No issues found`
- [ ] `git status --short` が空
- [ ] ブラウザで手動確認する
  - `npx vite build && npx vite preview` で開く
  - `FREE PLAY` を始めて数手打つ → タブを閉じる → 開き直す → `CONTINUE` が出る
  - `CONTINUE` を押すと盤面・スコア・手札が閉じる前と同じ
  - もう一度ホームに戻る手段は無いので、確認は開き直しで行う
  - DevTools の Application → Local Storage に `toy-scrabble:save` が見える
  - セーブがある状態で `COM EASY` を押すと確認ダイアログが出る

**`git push` はしない。** ユーザーが自分で実行します。
