# ルール表示（RULES シート）設計

## 背景

アプリ内にゲームのルールがどこにも書かれていない。README の「遊び方」は操作手順だけで、
配置の制約（一直線・隙間なし・初手は中央・既存タイルへの隣接）や得点計算、終了時の精算は
リポジトリを読まないと分からない。初見の利用者が `配置は一直線に並べてください` のような
エラーを見ても、なぜ弾かれたのか理解できない。

## ゴール

ホーム画面とプレイ中の両方から、ゲームのルールを 1 タップで読めるようにする。

## 非ゴール

- チュートリアル（対話的な手順案内）は作らない
- GAME OVER 画面からの導線は作らない
- ルール本文の多言語化はしない（日本語のみ）

## 全体構成

`AboutSheet` が確立している「`Sheet` でラップ + 日本語本文 + 閉じるボタン」の型をそのままなぞる。
新規コンポーネント `RulesSheet` を 1 つ作り、`App` が開閉状態を持つ。

```
App (showRules state)
├─ setup 画面   : [RULES] [ABOUT] ボタン行
├─ playing 画面 : ヘッダー右上の [?] ボタン
└─ RulesSheet ──> Sheet (既存の共通モーダル)
```

`AboutSheet` にタブを足す案は採らない。AboutSheet は WordNet ライセンスと CC BY-SA 3.0 の
**法的な表示義務**を負っており、ルール説明とは責務が異なる。タブ状態という新しい概念も増える。

ルール本文を Markdown 等の外部ファイルに切り出す案も採らない。1 画面ぶんの静的テキストのために
ローダとパーサが必要になる。

## コンポーネント

### `src/ui/RulesSheet.tsx`（新規）

```ts
export function RulesSheet({ onDismiss }: { onDismiss: () => void })
```

`<Sheet title="RULES" onDismiss={onDismiss}>` でラップし、本文は静的 JSX。

**`font-pixel` は付けない。** Press Start 2P は ASCII しか持たず、和文が別フォントに落ちて
字面が揃わない。`AboutSheet.tsx:25-27` が同じ理由で既に `font-pixel` を外している。
本文は `text-xs leading-relaxed text-stone-200 text-left space-y-3 max-w-sm`、
見出し (`h3`) は `text-stone-400 mb-1`。末尾に `閉じる` ボタン（`min-h-[44px]`）。

### 本文（5 節）

すべて実装で裏取り済み。カッコ内は根拠。

**■ 目的**

手札の 7 枚で英単語を作り、得点を競う。

**■ 手順**

1. タイルをタップ → 盤のマスをタップで置く（ドラッグでも置ける）
2. `PLAY` で確定。辞書に無い語は戻される
3. `RECALL` で置いたタイルを手札に戻す

**■ 置きかた**

- 1 手で置くタイルは同じ行か同じ列に一直線（`rules.ts:30-31`）
- 間に隙間を空けない（`rules.ts:55-60`）
- 初手は中央の ★ を通る（`rules.ts:62-64`）
- 2 手目以降は必ず既存タイルに隣接する（`rules.ts:66-73`）
- できた語は縦横どちらも辞書に載っている必要がある（`rules.ts:80-84`）

**■ 得点**

- タイルの点数の合計（`rules.ts:143-153`）
- DL / TL = その文字が 2 倍 / 3 倍（`rules.ts:147-148`）
- DW / TW = その単語が 2 倍 / 3 倍。中央の ★ は DW 扱い（`rules.ts:149-150`）
- プレミアムはそのターンに置いたタイルの分だけ有効。既に盤にあるタイルの下のマスは効かない（`rules.ts:145`）
- 手札 7 枚すべてを使い切ると +50（`rules.ts:87`）

**■ その他**

- `EXCHANGE`: 袋に 7 枚以上残っているときだけ手札を交換できる（`reducer.ts:250`）
- `PASS`: 手番を飛ばす。6 回連続でゲーム終了（`reducer.ts:54`）
- 空白タイルは 2 枚。任意の文字として使えるが 0 点。DL / TL を踏んでも 0 点のまま（`board.ts:34`, `bag.ts:23`, `rules.ts:96-98`）
- 終了時、手札に残ったタイルの点数は自分の得点から引かれる。先にタイルを使い切った側には、相手の残り点が加算される（`reducer.ts:56-70`）
- 履歴や「直前手」の単語をタップすると、発音記号・英英定義・和訳が出る

## App への配線（`src/App.tsx`）

1. `const [showRules, setShowRules] = useState(false);`
2. **`isSheetOpen`（114-115 行）に `showRules` を追加する。** 忘れると、ルール表示中も
   PC の Enter = PLAY / Escape = RECALL ALL が動いてしまう。
3. **setup 画面**: 現在 `ABOUT` が単独で中央にある（158-164 行）。これを `RULES` と `ABOUT` の
   横並びの行に変える。`RULES` を先（左）に置く — 初見の利用者が最初に押すべきものだから。
   スタイルは既存の ABOUT ボタンに合わせる。
4. **playing 画面**: `<h1>`（245 行）を `relative flex items-center justify-center` の行で包み、
   `?` ボタンを `absolute right-0` に置く。タイトルの中央揃えを保ったまま右上に配置できる。
   `min-h-[44px] min-w-[44px]`、`aria-label="ルールを見る"`。
5. 両画面に `{showRules && <RulesSheet onDismiss={() => setShowRules(false)} />}` を置く。
   setup と playing は別々の `return` なので 2 箇所に必要。

### `?` を ActionBar に入れない理由

ActionBar は COM の手番中、親 div ごと `pointer-events-none opacity-50` になる（`App.tsx:344`）。
ここに入れると COM 思考中にルールが読めない。ヘッダーはこの制約を受けない。

## テスト

### `tests/ui/RulesSheet.test.tsx`（新規）

- `dialog` が name `RULES` で開く
- 主要ルールの文言が出る: 一直線 / 中央の ★ / 隣接 / +50 / 6 連続パス / 終了時の精算
- `閉じる` で `onDismiss` が呼ばれる

### `tests/ui/App.rules.test.tsx`（新規）

`tests/ui/App.about.test.tsx` の型をなぞる（`useAiWorker` を mock、`fetch` と `matchMedia` を stub）。

- ホーム画面に `RULES` ボタンがある
- 起動直後はダイアログが開いていない
- `RULES` を押すとルールのダイアログが開く
- 閉じるとダイアログが消える
- ゲーム開始後、ヘッダーの `?` から開ける
- **COM の手番中でも `?` が押せる** — ActionBar の無効化に巻き込まれていないことの回帰ガード

### `tests/ui/App.keyboard.test.tsx`（既存に 1 件追加）

- ルール表示中は Enter を押しても PLAY が走らない

## 受け入れ条件

- ホーム画面と対戦中の両方からルールを開ける
- COM 思考中でもルールを開ける
- ルール表示中はキーボードショートカットが無効
- 320px 幅で本文が読める（横溢れしない）
- 和文が Press Start 2P に落ちて崩れていない
