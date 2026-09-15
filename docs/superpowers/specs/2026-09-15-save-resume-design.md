# 途中のゲームを保存して続きから遊ぶ 設計

## 背景

アプリを閉じると進行中の対局が消える。スマートフォンではホーム画面から起動しても、
着信やタブの破棄で簡単に離脱が起きる。24 手目まで進んだ対局が一瞬で失われると、
腰を据えて 1 局遊ぶこと自体が難しい。

## ゴール

進行中のゲームを 1 つだけ保存し、次回起動時にホーム画面の `CONTINUE` から再開できるようにする。

## 非ゴール

- セーブスロットを複数持たない（1 つだけ）
- 終了した対局の保存・戦績の蓄積はしない
- 手を戻す（undo）機能は作らない
- 端末間の同期はしない

## 前提の確認

実装を読んで裏を取った事実。これらが成り立つので設計が単純で済む。

- `GameState`（`src/game/types.ts:46-61`）は関数・Map・Date を含まない純粋なデータで、
  そのまま `JSON.stringify` / `JSON.parse` を通せる
- 乱数は state に入っていない。`START_GAME` と `EXCHANGE` が action の引数として
  `Rng` を受け取る（`src/game/reducer.ts:30,36`）ので、復元時に乱数の内部状態を
  持ち越す必要がない
- COM への着手依頼は `turnKey` を deps に持つ `useEffect`（`src/App.tsx:48-89`）で走る。
  マウント時にも評価されるため、COM の思考中に閉じても復帰後に自動で再依頼される

**これは Service Worker のキャッシュとは別の仕組みである。** `public/sw.js` が持つのは
アセットと辞書ファイルで、ゲームの進行は localStorage に置く。

## 全体構成

```
localStorage["toy-scrabble:save"]
        ▲                  │
        │ saveGame()       │ loadSave()
        │                  ▼
   src/state/saveGame.ts（新規・localStorage への出入口はここだけ）
        ▲                  │
        │                  ▼
   src/state/GameContext.tsx（書き込みの useEffect / 起動時の読み込み）
                           │
                           ▼
   src/App.tsx setup 画面 ──> ContinueButton（新規）
                           └─> RESTORE_GAME を dispatch
```

### 復元を `RESTORE_GAME` action にする理由

reducer に `{ type: 'RESTORE_GAME'; state: GameState }` を足し、`return action.state` だけを行う。
セーブは起動時に 1 回読んで `GameProvider` が保持し、`CONTINUE` 押下で dispatch する。

`useReducer(reducer, initial, init)` の第 3 引数で最初から復元済みの state を作る案は採らない。
起動時点で `status` が `playing` になり、「起動時は必ずホーム画面から始まる」という決定と衝突する。

セーブ専用の Context を別に立てる案も採らない。Provider が 2 段になるだけで、
ゲーム状態とセーブという不可分なものを人為的に切り離す。

## コンポーネント

### `src/state/saveGame.ts`（新規）

localStorage に触れるのはこのファイルだけにする。

```ts
import type { GameState } from '../game/types';

const KEY = 'toy-scrabble:save';
const VERSION = 1;

export type SavedGame = { version: number; state: GameState };

export function loadSave(): GameState | null;
export function saveGame(state: GameState): void;
export function clearSave(): void;
```

**`loadSave()` の検証が最も重要な部分。** `JSON.parse` は何でも通すため、将来 `GameState` の
形を変えたときに古いセーブが残っていると画面が真っ白になる。ユーザーから見ると
「アプリが壊れた」であり、しかも自力で復旧できない。次を順に確かめ、1 つでも外れたら
**`null` を返したうえで `clearSave()` を呼ぶ**。

1. `JSON.parse` が成功する
2. `version === 1`
3. `state.status === 'playing'`（`setup` / `ended` を復元しても意味がない）
4. `board` が 15 行あり、各行が 15 要素
5. `players` が 2 要素
6. `currentPlayerIndex` が `0` または `1`
7. `bag` / `pending` / `history` が配列

タイル 1 枚ずつまでは検証しない。依存を増やさずに全構造を検証するのは割に合わず、
現実に起きる壊れ方 — リリース間のスキーマ変更と書き込み途中での中断 — は
この浅いチェックで捕まえられる。

**`saveGame()` は失敗を握りつぶす。** Safari のプライベートモードや容量超過で `setItem` は
例外を投げるが、そこでゲームを止める理由はない。`try/catch` で `console.warn` に留め、
結果として `CONTINUE` が出ないだけにする。

サイズは盤面 225 マス＋袋＋履歴で数十 KB。上限 5MB に対して余裕がある。袋が 100 枚しか
ないため履歴も 50 手程度で頭打ちになり、間引きは要らない。

### `src/game/reducer.ts`（変更）

`Action` に `| { type: 'RESTORE_GAME'; state: GameState }` を足し、`case` は `return action.state;` のみ。

### `src/state/GameContext.tsx`（変更）

書き込みは `state` を見る `useEffect` 1 本で、`status` によって分岐する。

- `playing` → `saveGame(state)`
- `ended` → `clearSave()`（続きから遊ぶものが無い）
- `setup` → 何もしない

**`setup` で `clearSave()` を呼んではいけない。** 起動直後の status は `setup` なので、
`CONTINUE` を押す前にセーブが消える。

読み込みは起動時 1 回だけ。`useState(() => loadSave())` で保持し、`GameContextValue` に
2 つ足して外へ出す。`clearSavedGame` は `CONTINUE` 押下後にボタンを消すために使う
（localStorage は消さない。復帰した対局はそのまま保存され続ける）。

```ts
type GameContextValue = {
  state: GameState;
  dispatch: (a: Action) => void;
  dict: Dictionary | null;
  savedGame: GameState | null;   // 追加
  clearSavedGame: () => void;    // 追加
};
```

### `src/ui/modeLabels.ts`（新規）

```ts
import type { GameMode } from '../game/types';

export const MODE_LABELS: Record<GameMode, string> = {
  free: 'FREE PLAY',
  'com-easy': 'COM EASY',
  'com-medium': 'COM MEDIUM',
  'com-hard': 'COM HARD',
};
```

モード名は `ModeSelect.tsx:10-15` の `OPTIONS` が既に持っているが、そこから export すると
component ファイルが非コンポーネントも出すことになり `react-refresh/only-export-components` に
触れる。既存の eslint disable コメントを増やさないため別モジュールに切り出し、
`ModeSelect` と `ContinueButton` の両方がこれを参照する。

### `src/ui/ContinueButton.tsx`（新規）

```ts
export function ContinueButton({
  save,
  disabled,
  onContinue,
}: {
  save: GameState;
  disabled: boolean;
  onContinue: () => void;
})
```

`ModeSelect` の**外**、その上に置く。`ModeSelect` は `GameMode` を 1 つ選ぶための
コンポーネントであり、`CONTINUE` はモードではない。

表示は `CONTINUE` と、その下に小さく `${MODE_LABELS[save.mode]}・${save.turn} 手目`。
`aria-label="continue-game"`。スタイルは `ModeSelect` のボタン（`bg-yellow-300` 系、
`min-h-[44px]`）に合わせる。

**`disabled` が要る理由。** 復帰後の画面は `Board` を描くが、`GameShell` は辞書が未ロードだと
`null` を返す（`src/App.tsx:206`）。辞書を待たずに押せると真っ白な画面になるので、
`ModeSelect` と同じく `!dict` の間は押せなくする。

### `src/App.tsx` setup 画面（変更）

1. `ModeSelect` の上に `{savedGame && <ContinueButton save={savedGame} disabled={!dict} onContinue={...} />}`
2. `onContinue` は `dispatch({ type: 'RESTORE_GAME', state: savedGame })` してから `savedGame` を `null` にする
3. `ModeSelect` の `onSelect` を包み、セーブがあるときは確認を挟む

```ts
function handleSelectMode(mode: GameMode) {
  if (savedGame && !confirm('途中のゲームが消えます。新しく始めますか？')) return;
  dispatch({ type: 'START_GAME', mode, rng: seededRng(Date.now()) });
}
```

`confirm` は `src/App.tsx:376` の PASS で既に使っている手段で、テストからは
`vi.stubGlobal('confirm', ...)` で押さえられる。

## データフロー

**保存されるまで**
手を打つ → reducer が新しい `GameState` を返す → `GameContext` の `useEffect` が
`status === 'playing'` を見て `saveGame(state)` → localStorage に `{version:1, state}` が入る。

**復帰するまで**
起動 → `GameProvider` が `loadSave()` を 1 回呼ぶ → 検証を通れば `savedGame` に入る →
setup 画面に `CONTINUE` が出る → 押す → `RESTORE_GAME` → `status` が `playing` になり盤面が出る →
COM の手番だった場合は `App.tsx:48-89` の effect がマウント時に走って着手を再依頼する。

**消えるまで**
ゲームが `ended` になる → `useEffect` が `clearSave()`。
または セーブがある状態でモードを選び、確認に OK → `START_GAME` で `status` が `playing` になり、
次の `useEffect` が新ゲームでセーブを上書きする（古い対局はここで失われる）。

## エラー処理

| 起こること | 扱い |
|---|---|
| 保存が無い | `loadSave()` が `null`。`CONTINUE` を出さない |
| 保存が壊れている / 版が古い | `null` を返しキーも消す。`CONTINUE` を出さない |
| `setItem` が例外（容量超過・プライベートモード） | `console.warn` のみ。ゲームは続行し、`CONTINUE` が出なくなるだけ |
| `localStorage` 自体が使えない | `loadSave()` / `saveGame()` / `clearSave()` すべて `try/catch` で無害化 |
| 復帰時に辞書が未ロード | `CONTINUE` を `disabled` にして押させない |

## テスト

### `tests/saveGame.test.ts`（新規・ユニット）

壊れ方を網羅する層。jsdom が localStorage を持つので実物で検証し、モックは使わない。
`beforeEach` で `localStorage.clear()`。

- 保存したものを読み戻せる
- `version` が違うと `null` を返し、キーも消えている
- 壊れた JSON でも `null` を返し、キーも消えている
- `status` が `'setup'` / `'ended'` の保存は `null`
- `board` が 15×15 でなければ `null`
- `setItem` が例外を投げても `saveGame()` は throw しない

### `tests/reducer.test.ts`（既存に 1 件追加）

- `RESTORE_GAME` が渡された state をそのまま返す

### `tests/ui/App.save.test.tsx`（新規・コンポーネント）

配線の層。`tests/ui/App.about.test.tsx` の型をなぞる（`useAiWorker` を mock、
`fetch` と `matchMedia` を stub、`fireEvent` を使う。`user-event` は依存に無い）。

- 保存が無ければ `CONTINUE` が出ない
- 保存があれば `CONTINUE` が出て、モード名と手数が読める
- 辞書ロード前は `CONTINUE` が押せない
- `CONTINUE` を押すと盤面（`cell-7-7`）に復帰する
- 保存がある状態でモードを押すと `confirm` が出て、キャンセルすれば `setup` のまま
- 手を進めると localStorage にセーブが書かれる
- `ended` になるとセーブが消える

## 受け入れ条件

- 対局中にタブを閉じて開き直すと、ホーム画面に `CONTINUE` が出て続きから遊べる
- COM の思考中に閉じても、復帰後に COM が着手する
- 保存がある状態でモードを押すと確認が出る。キャンセルすれば対局は残る
- ゲームが終わるとセーブは消え、次回起動時に `CONTINUE` は出ない
- 保存が壊れていても画面は白くならず、ホーム画面が普通に出る
