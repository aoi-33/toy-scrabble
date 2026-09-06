# Plan 4: モバイル対応と GitHub Pages デプロイ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマートフォン（375px 幅）から PC まで一つの画面で快適に遊べるようにし、`https://aoi-33.github.io/toy-scrabble/` へ自動デプロイする。

**Architecture:** 盤面・タイルのサイズを `w-8 h-8 sm:w-9 sm:h-9` のハードコードから CSS カスタムプロパティ `--cell-size` に置き換え、ビューポート幅に追従させる。ブレークポイントは `docs/design.md` §5.1 に合わせて Tailwind 側で再定義する。タッチ操作は @dnd-kit の `TouchSensor` を追加して有効化し、タップ配置と競合しないよう長押ししきい値を設ける。モーダルはモバイルでボトムシート、PC で中央モーダルになる共通ラッパ `Sheet` に集約する。デプロイは GitHub Actions（`actions/deploy-pages`）で `dist/` を publish する。

**Tech Stack:** Vite 5 / React 18 / TypeScript strict / Tailwind CSS 3.4 / @dnd-kit/core 6.3.1（`package.json` の記載は `^6.1.0` だが実際にインストールされているのは 6.3.1）/ Vitest 2 + @testing-library/react 16 (jsdom) / GitHub Actions

**テスト方針（重要）:** jsdom は CSS を評価しないため、`className` の文字列一致だけでは「クラス名を書いたこと」しか検証できず回帰を検出できない。そこで本計画では **実際の `tailwind.config.js` と `src/index.css` を postcss + tailwindcss に通して生成 CSS を作り、その内容を検証する** テストを軸に据える。Tailwind の `content` は `./index.html` と `./src/**/*.{ts,tsx}` を走査するので、生成 CSS はコンポーネントが実際に使っているクラスを反映する。つまり `Tile.tsx` を `w-8` に戻すと生成 CSS に `.w-8` が復活し、テストが落ちる。これが本物の回帰検出になる。

---

## スコープ

### 実装する（`docs/design.md` §5.1〜§5.6 に対応）

| 項目 | 対応タスク |
|---|---|
| eslint の `no-undef` を TS ファイルで無効化（DOM 型を扱う前提を整える） | Task 0 |
| ブレークポイント sm 〜480 / md 481〜768 / lg 769〜 | Task 1 |
| Board = viewport 幅の 92%、cell = viewport/15、min 20px | Task 2, 3, 4 |
| タッチでのドラッグ＆ドロップ | Task 5, 6 |
| タッチターゲット最小 44×44px（WCAG 2.5.5） | Task 5, 7 |
| Rack を画面下部に固定 | Task 9 |
| モーダルのボトムシート化 | Task 8 |
| セーフエリア（ノッチ・ホームバー）回避 | Task 2, 9 |
| キーボードショートカットは PC のみ | Task 10 |
| GitHub Pages デプロイ | Task 11 |

### 実装しない（Plan 4 の対象外）

- **盤面のピンチズーム / 2 本指パン / ダブルタップでズーム解除**（design.md §5.3, §5.4）。`--cell-size` の下限 20px と横スクロールで最小幅 320px でも盤面全体が収まるため、ズームは無くても操作できる。実機で文字が読めないという声が出てから着手する（YAGNI）。
- **タイル長押しでの選択メニュー**（design.md §5.3）。長押しは Task 6 でドラッグ開始に割り当てる。タップ配置とドラッグ配置の 2 経路が既にあり、3 つ目の操作系を足すと長押しの意味が衝突する。
- **Play 確定前の確認ボトムシート**（design.md §5.4）。既存の `PLAY` ボタン + エラートーストで確定・差し戻しができており、追加の確認ステップは操作数を増やすだけになる。
- **Playwright による E2E**（design.md テスト節）。ブラウザバイナリを取得できない環境があり、依存も重い。代わりに **生成 CSS の検証**（Task 1〜4）と DOM 構造・イベント挙動のテストを各タスクに置き、レイアウトの実寸検証は Task 11 の手動チェックリストで担保する。

---

## File Structure

### 新規作成

| ファイル | 責務 |
|---|---|
| `src/ui/dndSensors.ts` | @dnd-kit のセンサー構成（Pointer / Touch）と発火しきい値の定数 |
| `src/ui/Sheet.tsx` | モバイル=ボトムシート / PC=中央モーダルの共通ラッパ |
| `src/ui/useMediaQuery.ts` | `matchMedia` を購読する Hook（PC 判定に使う） |
| `.github/workflows/deploy.yml` | lint → test → build → GitHub Pages へ publish |
| `tests/ui/generatedCss.test.ts` | 実際の Tailwind ビルド結果（生成 CSS）と `index.html` を検証 |
| `tests/ui/dndSensors.test.tsx` | センサーしきい値と本数の検証 |
| `tests/ui/Sheet.test.tsx` | ボトムシート/モーダルの構造とレスポンシブ class |
| `tests/ui/useMediaQuery.test.ts` | matchMedia 変化への追従 |
| `tests/ui/ActionBar.test.tsx` | 操作ボタンのタッチターゲットと基本動作 |
| `tests/ui/App.layout.test.tsx` | 盤面スクロールラッパと sticky フッターの構造 |
| `tests/ui/App.keyboard.test.tsx` | PC のみキーボードショートカットが効くこと |

### 変更

| ファイル | 変更内容 |
|---|---|
| `eslint.config.js` | TS ファイルで `no-undef` を off にする（Task 0） |
| `tailwind.config.js` | `screens` を design.md のブレークポイントで上書き |
| `src/index.css` | `--cell-size` / `--rack-tile-size` の定義と PC 用メディアクエリ |
| `index.html` | `viewport-fit=cover`、`theme-color` |
| `src/ui/Tile.tsx` | 固定サイズ → `var(--cell-size)` |
| `src/ui/Board.tsx` | セルを `var(--cell-size)` 化 |
| `src/ui/Rack.tsx` | 44px タッチターゲット、`touch-action: none`、ラック専用タイルサイズ |
| `src/ui/ActionBar.tsx` | 44px タッチターゲット、モバイルで折り返し |
| `src/ui/ModeSelect.tsx` | 44px タッチターゲット |
| `src/ui/BlankLetterModal.tsx` | `Sheet` 化、44px タッチターゲット |
| `src/ui/ExchangeModal.tsx` | `Sheet` 化、ラック専用タイルサイズ |
| `src/ui/ScorePanel.tsx` | 幅いっぱい＋モバイルで詰める |
| `src/App.tsx` | センサー適用、盤面の横スクロールラッパ、sticky フッター、`dvh`、エラートーストのフッター内移動、キーボードショートカット |
| `tests/ui/App.aiTurn.test.tsx` | `matchMedia` スタブの追加（Task 10） |
| `README.md` | デプロイ手順と Plan 4 完了状況 |

---

## Task 0: eslint の `no-undef` を TypeScript ファイルで無効化する

> **保留（2026-09-07）。実行環境の制約により着手できない。**
> `ecc` プラグインの `config-protection` フックが `eslint.config.js` への Edit / Write を無条件でブロックする（保護対象は eslint / prettier / biome / ruff などの linter 設定ファイル。`tailwind.config.js` は対象外なので Task 1 以降は影響なし）。フックの無効化スイッチ `ECC_DISABLED_HOOKS=pre:config-protection` は環境変数のためエージェント側からは設定できず、`.claude/settings.local.json` 経由の設定も保護パスとしてブロックされる。
>
> **Task 1 以降への影響:** `no-undef` は有効なままなので、新しく書く `window` / `matchMedia` / `KeyboardEvent` / `HTMLElement` などの DOM 識別子には、既存コードと同じく `// eslint-disable-next-line no-undef` を付ける必要がある。**型注釈の位置（`function f(e: KeyboardEvent)` など）でも発火する**ことに注意。以降のタスクのコード例には disable コメントを記載していないので、実装時に補うこと。
>
> 将来フックを一時無効化できる状況になったら、下記の手順をそのまま実行できる。

**Files:**
- Modify: `eslint.config.js`
- Modify: `src/App.tsx`, `src/main.tsx`, `src/ai/useAiWorker.ts`, `src/ai/worker.ts`, `src/ai/search.ts`, `src/game/dictionary.ts`, `src/state/GameContext.tsx`, `tests/ai/search.test.ts`, `tests/ui/App.aiTurn.test.tsx`

このリポジトリの `eslint.config.js` は `js.configs.recommended` を展開しているが、`no-undef` を無効化する typescript-eslint の推奨オーバーライドを取り込んでいない。かつ `languageOptions.globals` も未設定なので、**`window` / `setTimeout` / `HTMLElement` / `KeyboardEvent` などの DOM 識別子がすべて `no-undef` エラーになる**。そのため既存コードには `// eslint-disable-next-line no-undef` が 26 箇所も散らばっている。

Plan 4 では `window.addEventListener` / `matchMedia` / `KeyboardEvent` / `HTMLElement` を新たに何箇所も書くため、このまま進めると disable コメントがさらに増える。先に設定を直す。

TypeScript コンパイラが未定義識別子を既に検出するので、TS ファイルで `no-undef` を有効にしておく意味はない（typescript-eslint 公式もそう推奨している）。

> **注意:** 「型注釈で使うだけなら `no-undef` は効かない」というのは**誤り**である。`function onKeyDown(e: KeyboardEvent)` のような型の位置でも `no-undef` は発火する。実際に確認済み。

- [ ] **Step 1: 現状のエラーを確認する**

Run: `npx eslint . --rule '{"no-undef":"off"}' 2>&1 | tail -5`
Expected: `✖ 26 problems (0 errors, 26 warnings)` のように **エラー 0・警告 26 件**（警告はすべて「使われていない eslint-disable ディレクティブ」）。この 26 件が Step 3 で消す対象になる。

- [ ] **Step 2: `eslint.config.js` を直す**

`files: ['**/*.{ts,tsx}']` のブロックの `rules` に 1 行足す:

```js
    rules: {
      ...tseslint.configs.recommended.rules,
      // TypeScript が未定義識別子を検出するため、TS ファイルでは no-undef を切る。
      // 有効なままだと window / KeyboardEvent など DOM のグローバルが全て誤検出になる。
      'no-undef': 'off',
    },
```

- [ ] **Step 3: 不要になった disable ディレクティブを削除する**

`// eslint-disable-next-line no-undef` の行を、以下のファイルから**行ごと**削除する:

| ファイル | 件数 |
|---|---|
| `src/App.tsx` | 7 |
| `src/ai/useAiWorker.ts` | 4 |
| `src/ai/worker.ts` | 4 |
| `src/ai/search.ts` | 3 |
| `tests/ai/search.test.ts` | 2 |
| `tests/ui/App.aiTurn.test.tsx` | 2 |
| `src/game/dictionary.ts` | 1 |
| `src/main.tsx` | 1 |
| `src/state/GameContext.tsx` | 1 |

**`scripts/build-dict.mjs` の 1 件は残すこと。** `.mjs` は `files: ['**/*.{ts,tsx}']` のブロックに含まれないため、`no-undef` が有効なままである。

該当行の一覧は次で取れる:

```bash
grep -rn "eslint-disable-next-line no-undef" src tests scripts
```

- [ ] **Step 4: lint と test が通ることを確認する**

Run: `npm run lint && npm run test`
Expected: lint は **エラー 0・警告 0**（何も出力せず終了）。テストは既存 101 件が全て PASS。

- [ ] **Step 5: コミット**

```bash
git add eslint.config.js src tests
git commit -m "chore: TS ファイルで no-undef を無効化し disable コメントを削除する"
```

---

## Task 1: ブレークポイントを design.md に合わせる

**Files:**
- Modify: `tailwind.config.js`
- Test: `tests/ui/generatedCss.test.ts`（新規）

design.md §5.1 のブレークポイントは sm 〜480px / md 481〜768px / lg 769px〜。Tailwind のデフォルト（sm=640px）と一致しないため上書きする。Tailwind の `screens` は min-width なので、`sm: 481px`（＝480px 超）、`md: 769px`（＝768px 超 = PC）、`lg: 1025px` とする。以降のタスクで「PC のみ」を表すのは `md:` プレフィックスになる。

テストは `tailwind.config.js` を直接 import しない。`tsconfig.app.json` は `include` に `tests` を含み `allowJs` が無いため、JS モジュールを import すると `npm run build` が **TS7016: Could not find a declaration file for module '../../tailwind.config.js'** で落ちる（確認済み）。代わりに **実際に Tailwind を走らせて生成された CSS** を検証する。こちらの方が「設定を書いた」ではなく「意図した CSS が出る」を検証できる。

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/generatedCss.test.ts` を新規作成:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

// 実際の tailwind.config.js と src/index.css を通して CSS を生成する。
// content 走査は index.html と src/**/*.{ts,tsx} を対象にするので、
// 生成 CSS はコンポーネントが実際に使っているクラスを反映する。
async function buildCss(): Promise<string> {
  // vitest の cwd はプロジェクトルート。import.meta.url からの new URL() は
  // jsdom 環境では "The URL must be of scheme file" で落ちるので使わない。
  const src = readFileSync('src/index.css', 'utf8');
  const result = await postcss([tailwindcss('./tailwind.config.js')]).process(src, {
    from: undefined,
  });
  return result.css;
}

let css = '';
beforeAll(async () => {
  css = await buildCss();
}, 60_000);

describe('Tailwind ブレークポイント', () => {
  it('sm: が design.md の 481px で出力される', () => {
    expect(css).toContain('@media (min-width: 481px)');
  });

  it('Tailwind デフォルトの 640px ブレークポイントを使わない', () => {
    expect(css).not.toContain('@media (min-width: 640px)');
  });
});
```

> `md:`（769px）の検証は Task 2 で入れる。この時点ではコードベースに `md:` を使ったクラスがまだ 1 つも無く、Tailwind は使われていないブレークポイントの `@media` を出力しないため、ここで assert すると恒久的に落ちる。`sm:` は `Tile.tsx` の `sm:w-9` や `ScorePanel.tsx` の `sm:gap-4` が既に使っているので Task 1 時点で検証できる。

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -- tests/ui/generatedCss.test.ts`
Expected: FAIL — 2 件とも落ちる。現状の生成 CSS には `sm:` 由来の `@media (min-width: 640px)` が含まれ、`481px` は含まれないため。

- [ ] **Step 3: 実装する**

`tailwind.config.js` の `theme.extend` に `screens` を追加する（`colors` の直前に置く）:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // docs/design.md §5.1: sm 〜480px / md 481〜768px / lg 769px〜（min-width で表現）
      screens: {
        sm: '481px',
        md: '769px',
        lg: '1025px',
      },
      colors: {
        'board-bg': '#2a5934',
        'cell-bg': '#d9c9a3',
        'tile-wood': '#e8c07d',
        'premium-dl': '#7ec8e3',
        'premium-tl': '#3b82f6',
        'premium-dw': '#f9a8b8',
        'premium-tw': '#e63946',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run test -- tests/ui/generatedCss.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 既存テストと型チェックを壊していないことを確認する**

Run: `npm run test && npx tsc -b`
Expected: 全テスト PASS、型エラーなし

- [ ] **Step 6: コミット**

```bash
git add tailwind.config.js tests/ui/generatedCss.test.ts
git commit -m "feat: ブレークポイントを design.md の定義に合わせる"
```

---

## Task 2: セルサイズを CSS 変数化し、ビューポートメタを整える

**Files:**
- Modify: `src/index.css`
- Modify: `index.html`
- Test: `tests/ui/generatedCss.test.ts`

盤面は `p-1`（左右 4px）と `gap-px`（1px × 14）を含むので、外形幅 = `15 × cell + 22px`。これを 92vw に収めるため `cell = (92vw - 22px) / 15`、下限は design.md の指定どおり 20px。PC（769px〜）では固定 36px（現行の `sm:w-9` と同値）にする。

手札タイルは盤面セルと同じ `Tile` を使うが、タッチターゲット 44×44px を満たす必要がある。`--rack-tile-size` を別に定義し、Rack 側で `--cell-size` をローカルに上書きして継承させる。

セーフエリア（ノッチ・ホームバー）の `env()` を効かせるには `viewport-fit=cover` が必須なので同時に入れる。

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/generatedCss.test.ts` の末尾に追記する。`css` は Task 1 で定義した `beforeAll` の生成 CSS をそのまま使う（`src/index.css` の内容も postcss を通って出力に含まれる）:

```ts
describe('セルサイズの CSS 変数', () => {
  it('モバイルでは 92vw を 15 分割し、下限 20px を保証する', () => {
    expect(css).toMatch(/--cell-size:\s*max\(20px,\s*calc\(\(92vw - 22px\)\s*\/\s*15\)\)/);
  });

  it('手札タイルは 44px を下回らない', () => {
    expect(css).toMatch(/--rack-tile-size:\s*max\(44px,\s*var\(--cell-size\)\)/);
  });

  it('PC(769px〜) では --cell-size を固定値に切り替える', () => {
    expect(css).toContain('@media (min-width: 769px)');
    // 769px ブロック内で --cell-size が 36px に上書きされていること
    const pcBlock = css.slice(css.indexOf('@media (min-width: 769px)'));
    expect(pcBlock).toMatch(/--cell-size:\s*36px/);
  });
});

describe('viewport メタ', () => {
  // new URL(..., import.meta.url) は jsdom 環境で "The URL must be of scheme file"
  // になるため使わない。vitest の cwd はプロジェクトルートなので相対パスで読む。
  const html = readFileSync('index.html', 'utf8');

  it('セーフエリアを使うため viewport-fit=cover を指定する', () => {
    expect(html).toMatch(/viewport-fit=cover/);
  });

  it('ブラウザ UI の色をアプリの背景に合わせる', () => {
    expect(html).toMatch(/<meta name="theme-color" content="#1a3d24"/);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -- tests/ui/generatedCss.test.ts`
Expected: FAIL — 追記した 5 件が `expected '...' to match /--cell-size.../` などで落ちる（Task 1 の 2 件は PASS のまま）

- [ ] **Step 3: 実装する**

`src/index.css` を以下の内容にする:

```css
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* 盤面の外形幅 = 15*cell + gap(1px*14) + padding(4px*2) = 15*cell + 22px。
     これを viewport 幅の 92% に収める。極小画面でも 20px は確保する（design.md §5.1）。 */
  --cell-size: max(20px, calc((92vw - 22px) / 15));
  /* 手札タイルはタッチターゲット 44×44px を満たす必要がある（WCAG 2.5.5） */
  --rack-tile-size: max(44px, var(--cell-size));
}

@media (min-width: 769px) {
  :root {
    --cell-size: 36px;
  }
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #1a3d24;
  color: #f5e9ce;
}
```

`index.html` の viewport メタ行を差し替え、`theme-color` を追加する:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#1a3d24" />
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run test -- tests/ui/generatedCss.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: コミット**

```bash
git add src/index.css index.html tests/ui/generatedCss.test.ts
git commit -m "feat: 盤面セルサイズを CSS 変数でビューポート追従にする"
```

---

## Task 3: Tile を可変サイズにする

**Files:**
- Modify: `src/ui/Tile.tsx`
- Test: `tests/ui/Tile.test.tsx`
- Test: `tests/ui/generatedCss.test.ts`

`w-8 h-8 sm:w-9 sm:h-9` と `text-lg` / `text-[8px]` の固定値をすべて `--cell-size` からの計算に置き換える。文字サイズはセルの 0.5 倍、点数は 0.22 倍（36px 時にそれぞれ 18px / 7.9px となり現行の見た目を保つ）。

Tailwind 3.4 の任意値では **`calc()` の中のスペースを `_`（アンダースコア）に置き換える必要はない**が、クラス名にスペースを含められないため `calc(var(--cell-size)*0.5)` のように**演算子の前後にスペースを入れない**形で書く。乗除算はスペース無しでも CSS として妥当なのでこれで動く（加減算はスペースが必須なので `_` が要る点に注意。本計画では加減算は使わない）。

- [ ] **Step 1: 失敗するテストを書く**

まず `tests/ui/generatedCss.test.ts` の末尾に追記する。これが本命の回帰テスト —— `Tile.tsx` を `w-8` に戻すと生成 CSS に `.w-8` が復活して落ちる:

```ts
describe('タイルと盤面セルのサイズ', () => {
  it('--cell-size を width/height に使うユーティリティが生成される', () => {
    expect(css).toContain('width: var(--cell-size)');
    expect(css).toContain('height: var(--cell-size)');
  });

  it('文字サイズもセルサイズに追従する', () => {
    // Tailwind は calc 内の演算子まわりに空白を補って出力する
    expect(css).toContain('font-size: calc(var(--cell-size) * 0.5)');
  });
});
```

> **セレクタではなく宣言部を検証している**のは意図的。生成 CSS のセレクタは `[`・`]`・`(`・`)`・`*`・`,` がすべてバックスラッシュでエスケープされ（`.w-\[var\(--cell-size\)\]`、`.pb-\[max\(1rem\2c env\(...\)\)\]`）、正規表現が読めなくなるうえ Tailwind のバージョンで変わりうる。宣言部（`width: var(--cell-size)`）はエスケープされず安定している。実際の出力は `npx tailwindcss -i src/index.css -o /tmp/out.css` で確認できる。

> `w-8` が消えたことの検証は Task 4 で入れる。`Board.tsx` がまだ `w-8` を使っているので、この時点で assert すると落ちる。

> 生成 CSS ではセレクタ中の `[`・`]`・`(`・`)` がバックスラッシュでエスケープされる（`.w-\[var\(--cell-size\)\]`）。上の正規表現の `\\\[` はその 1 段目のエスケープを表している。実装後に落ちる場合は、まず `npx tailwindcss -i src/index.css -o /tmp/out.css` で実際の出力を見てからパターンを合わせること。

次に `tests/ui/Tile.test.tsx` の `describe('<Tile>')` 内の末尾に追記する（コンポーネント単体での確認用）:

```ts
  it('サイズを --cell-size から取るので固定幅クラスを持たない', () => {
    const { container } = render(<Tile tile={{ kind: 'letter', letter: 'A', points: 1 }} variant="in-rack" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('w-[var(--cell-size)]');
    expect(el.className).toContain('h-[var(--cell-size)]');
    expect(el.className).not.toMatch(/\bw-8\b|\bsm:w-9\b/);
  });
```

`container` を使うので、ファイル冒頭の import はそのままで良い（`render` は既に import 済み）。

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -- tests/ui/Tile.test.tsx tests/ui/generatedCss.test.ts`
Expected: FAIL — `expected 'relative w-8 h-8 sm:w-9 ...' to contain 'w-[var(--cell-size)]'` および生成 CSS 側の 2 件

- [ ] **Step 3: 実装する**

`src/ui/Tile.tsx` の `Tile` 関数を差し替える:

```tsx
export function Tile({ tile, variant }: { tile: TileType; variant: TileVariant }) {
  const displayLetter =
    tile.kind === 'letter' ? tile.letter : (tile.assigned ?? '?');
  const showPoints = tile.kind === 'letter';
  return (
    <div
      className={`relative w-[var(--cell-size)] h-[var(--cell-size)] text-[calc(var(--cell-size)*0.5)] flex items-center justify-center font-bold select-none ${VARIANT_CLASSES[variant]}`}
    >
      <span>{displayLetter}</span>
      {showPoints && (
        <span className="absolute bottom-0 right-0.5 text-[calc(var(--cell-size)*0.22)] font-normal">
          {tile.points}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run test -- tests/ui/Tile.test.tsx tests/ui/generatedCss.test.ts`
Expected: PASS (Tile 4 tests + generatedCss 8 tests)

- [ ] **Step 5: コミット**

```bash
git add src/ui/Tile.tsx tests/ui/Tile.test.tsx tests/ui/generatedCss.test.ts
git commit -m "feat: Tile のサイズを --cell-size 基準にする"
```

---

## Task 4: Board のセルを可変サイズにする

**Files:**
- Modify: `src/ui/Board.tsx`
- Test: `tests/ui/Board.test.tsx`
- Test: `tests/ui/generatedCss.test.ts`

`DroppableCell` の固定サイズを `--cell-size` に置き換える。プレミアムラベル（DL/TL/DW/TW/★）の文字サイズも追従させる。`shrink-0` を付けて、外側に横スクロールコンテナ（Task 9）を置いてもセルが潰れないようにする。

これで `w-8` / `h-8` / `sm:w-9` / `sm:h-9` の利用箇所がコードベースから消えるので、生成 CSS からも消えることを検証する。

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/generatedCss.test.ts` の `describe('タイルと盤面セルのサイズ')` 内に追記:

```ts
  it('固定サイズの w-8 / h-8 はもう使われていない', () => {
    // 使われていないクラスは Tailwind の content 走査で出力されない。
    // Tile.tsx や Board.tsx を w-8 に戻すとこのテストが落ちる。
    expect(css).not.toContain('.w-8 {');
    expect(css).not.toContain('.h-8 {');
  });
```

`tests/ui/Board.test.tsx` の `describe('<Board>')` 内の末尾に追記:

```ts
  it('セルのサイズを --cell-size から取る', () => {
    render(<Board board={createEmptyBoard()} pending={[]} onCellClick={() => {}} />);
    const cell = screen.getByLabelText('cell-0-0');
    expect(cell.className).toContain('w-[var(--cell-size)]');
    expect(cell.className).toContain('h-[var(--cell-size)]');
    expect(cell.className).not.toMatch(/\bw-8\b|\bsm:w-9\b/);
  });
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -- tests/ui/Board.test.tsx tests/ui/generatedCss.test.ts`
Expected: FAIL — `expected 'w-8 h-8 sm:w-9 ...' to contain 'w-[var(--cell-size)]'` および生成 CSS に `.w-8 {` が残っている

- [ ] **Step 3: 実装する**

`src/ui/Board.tsx` の `DroppableCell` の `<button>` の className を差し替える:

```tsx
    <button
      ref={setNodeRef}
      role="gridcell"
      aria-label={`cell-${r}-${c}`}
      className={`w-[var(--cell-size)] h-[var(--cell-size)] shrink-0 flex items-center justify-center text-[calc(var(--cell-size)*0.22)] font-pixel ${cellClassName} ${isOver ? 'ring-2 ring-yellow-400' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
```

`Board` 本体のグリッド `<div>` にも `shrink-0` を追加する（横スクロールコンテナ内で縮まないように）:

```tsx
    <div
      role="grid"
      className="inline-grid shrink-0 gap-px bg-board-bg p-1"
      style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}
    >
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run test -- tests/ui/Board.test.tsx tests/ui/generatedCss.test.ts`
Expected: PASS (Board 4 tests + generatedCss 9 tests)

- [ ] **Step 5: コミット**

```bash
git add src/ui/Board.tsx tests/ui/Board.test.tsx tests/ui/generatedCss.test.ts
git commit -m "feat: Board のセルを --cell-size 基準にする"
```

---

## Task 5: Rack のタッチターゲットと touch-action

**Files:**
- Modify: `src/ui/Rack.tsx`
- Test: `tests/ui/Rack.test.tsx`

4 点を直す:

1. `touch-action: none` が無いとタッチ操作がブラウザのスクロールに奪われ、@dnd-kit がドラッグを開始できない。
2. タップ領域が 44×44px 未満だと押しにくい（WCAG 2.5.5）。ボタン側に `min-w/min-h` を付ける。
3. 手札タイルは盤面セルより大きくしたいので、Rack 内で `--cell-size` を `--rack-tile-size` に上書きし、子の `Tile` に継承させる。
4. **手札 7 枚は最小幅の端末に収まらない。** 44px × 7 + gap 4px × 6 + padding 8px × 2 = **348px** で、320px 端末の内側幅（本体 `p-2` を引いて約 304px）を 44px 超過する。タッチターゲット 44px は WCAG 要件なので縮められない。ラック自体を横スクロール可能にして逃がす（`max-w-full overflow-x-auto`）。同時に各ボタンへ `shrink-0` を付け、flex が勝手に潰さないようにする。

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/Rack.test.tsx` の `describe('<Rack>')` 内の末尾に追記:

```ts
  it('タッチでドラッグできるよう touch-action を無効化する', () => {
    render(<Rack rack={rack} selectedIndex={null} onSelect={() => {}} />);
    const btn = screen.getAllByRole('button')[0];
    expect(btn.style.touchAction).toBe('none');
  });

  it('タッチターゲットを 44px 以上にする', () => {
    render(<Rack rack={rack} selectedIndex={null} onSelect={() => {}} />);
    const btn = screen.getAllByRole('button')[0];
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.className).toContain('min-h-[44px]');
  });

  it('手札タイルには専用サイズを継承させる', () => {
    const { container } = render(<Rack rack={rack} selectedIndex={null} onSelect={() => {}} />);
    const inner = container.querySelector('[data-testid="rack-tiles"]') as HTMLElement;
    expect(inner.style.getPropertyValue('--cell-size')).toBe('var(--rack-tile-size)');
  });

  it('7 枚が入り切らない幅でも横スクロールで全部触れる', () => {
    // 44px * 7 + gap 4px * 6 + padding 8px * 2 = 348px > 320px 端末の内側幅
    const { container } = render(<Rack rack={rack} selectedIndex={null} onSelect={() => {}} />);
    const inner = container.querySelector('[data-testid="rack-tiles"]') as HTMLElement;
    expect(inner.className).toContain('max-w-full');
    expect(inner.className).toContain('overflow-x-auto');
    // タイルは潰れない
    expect(screen.getAllByRole('button')[0].className).toContain('shrink-0');
  });
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -- tests/ui/Rack.test.tsx`
Expected: FAIL — `expected '' to be 'none'` ほか計 3 件

- [ ] **Step 3: 実装する**

`src/ui/Rack.tsx` を以下の内容にする:

```tsx
import type React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Tile as TileType } from '../game/types';
import { Tile } from './Tile';

function DraggableRackTile({
  tile,
  index,
  selected,
  onSelect,
}: {
  tile: TileType;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `rack-${index}`,
    data: { source: 'rack', index },
  });
  // touch-action: none が無いとタッチがスクロールに奪われ、ドラッグが始まらない
  const style: React.CSSProperties = {
    touchAction: 'none',
    ...(transform
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
      : {}),
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={`shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center ${
        selected ? 'ring-4 ring-yellow-300' : ''
      } ${isDragging ? 'opacity-50' : ''}`}
      aria-label={`rack-${index}`}
      type="button"
    >
      <Tile tile={tile} variant={selected ? 'in-rack-selected' : 'in-rack'} />
    </button>
  );
}

export function Rack({
  rack,
  selectedIndex,
  onSelect,
}: {
  rack: TileType[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div
      data-testid="rack-tiles"
      // 44px*7 + gap + padding = 348px。320px 端末には収まらないので横スクロールで逃がす
      className="flex gap-1 p-2 bg-stone-800 rounded max-w-full overflow-x-auto"
      // 手札タイルだけ盤面セルより大きくする
      style={{ '--cell-size': 'var(--rack-tile-size)' } as React.CSSProperties}
    >
      {rack.map((tile, i) => (
        <DraggableRackTile
          key={i}
          tile={tile}
          index={i}
          selected={i === selectedIndex}
          onSelect={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run test -- tests/ui/Rack.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: 型チェックを通す**

Run: `npx tsc -b`
Expected: エラーなしで終了（`{ '--cell-size': ... } as React.CSSProperties` のキャストが必要。外すと TS2353 になる）

- [ ] **Step 6: コミット**

```bash
git add src/ui/Rack.tsx tests/ui/Rack.test.tsx
git commit -m "feat: 手札タイルをタッチ操作対応にする"
```

---

## Task 6: @dnd-kit にタッチセンサーを追加する

**Files:**
- Create: `src/ui/dndSensors.ts`
- Create: `tests/ui/dndSensors.test.tsx`
- Modify: `src/App.tsx`

現状 `DndContext` にセンサー指定が無く、@dnd-kit のデフォルト（`PointerSensor` + `KeyboardSensor`、いずれも activation constraint 無し）が動く。しきい値が無いと「タップして配置」がドラッグ開始と誤認されて `onSelect` が発火しないことがある。

**センサーの組み合わせに注意（ここが一番間違えやすい）:**

- `PointerSensor` は Pointer Events を使い、**マウスとタッチの両方を拾う**。そこへ `TouchSensor`（Touch Events）を並べると、タッチ時に `pointerdown` と `touchstart` の両方が発火して 2 つのセンサーが競合する。@dnd-kit は「`PointerSensor` を単体で使う」か「`MouseSensor` + `TouchSensor` を組み合わせる」かのどちらかを取れという方針。
- タッチだけ長押し（`delay`）、マウスだけ移動距離（`distance`）という**別々のしきい値を与えたい**ので、後者の `MouseSensor` + `TouchSensor` を採る。
- `sensors` prop を明示するとデフォルトは**置き換わる**。何もしないと `KeyboardSensor` が失われてキーボードでのドラッグができなくなるため、明示的に足し直す。

```
useSensors(MouseSensor{distance:8}, TouchSensor{delay:150,tolerance:8}, KeyboardSensor)
```

`TouchSensor` の `delay: 150` により、150ms 未満で指を離したタッチはドラッグとして起動せず、ブラウザが通常どおり `click` を合成する → `onSelect`（タップ配置）が動く。150ms 以上押し続けるとドラッグが始まり、その場合 @dnd-kit が `click` を抑止する。`tolerance: 8` は「待機中に 8px 以上動いたら起動をキャンセルする」意味で、スクロール意図の指の動きを取りこぼさないためのもの。

> **実機で必ず確認すること（Task 11 のチェックリスト）:** この 2 系統の分離は jsdom では検証できない。150ms が短すぎて「素早いタップがドラッグになる」ようなら 200〜250ms に上げる。長すぎて「ドラッグが始まらない」と感じるなら下げる。定数を 1 箇所（`dndSensors.ts`）に集約してあるのは、この調整を 1 行で済ませるため。

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/dndSensors.test.tsx` を新規作成:

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { KeyboardSensor, MouseSensor, PointerSensor, TouchSensor } from '@dnd-kit/core';
import { MOUSE_ACTIVATION, TOUCH_ACTIVATION, useDndSensors } from '../../src/ui/dndSensors';

describe('dnd センサー設定', () => {
  it('マウスは移動距離でドラッグ開始する', () => {
    expect(MOUSE_ACTIVATION).toEqual({ distance: 8 });
  });

  it('タッチは長押しでドラッグ開始にする', () => {
    expect(TOUCH_ACTIVATION).toEqual({ delay: 150, tolerance: 8 });
  });

  it('Mouse / Touch / Keyboard の 3 センサーを使う', () => {
    const { result } = renderHook(() => useDndSensors());
    const sensors = result.current.map(d => d.sensor);
    expect(sensors).toContain(MouseSensor);
    expect(sensors).toContain(TouchSensor);
    // sensors prop を明示するとデフォルトが置き換わるので、失うと
    // キーボードでのドラッグができなくなる
    expect(sensors).toContain(KeyboardSensor);
  });

  it('PointerSensor は使わない（TouchSensor と二重発火するため）', () => {
    const { result } = renderHook(() => useDndSensors());
    expect(result.current.map(d => d.sensor)).not.toContain(PointerSensor);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -- tests/ui/dndSensors.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/ui/dndSensors"`

- [ ] **Step 3: 実装する**

`src/ui/dndSensors.ts` を新規作成:

```ts
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

/** マウスはこの距離だけ動いて初めてドラッグ開始。閾値が無いとクリック配置がドラッグに化ける */
export const MOUSE_ACTIVATION = { distance: 8 } as const;

/**
 * タッチは長押し 150ms でドラッグ開始。これ未満のタップはブラウザが click を合成するので
 * タップ配置（onSelect）として通る。tolerance は待機中に許容する指のブレ（px）。
 * 実機で調整する場合はこの 2 値だけを変えればよい。
 */
export const TOUCH_ACTIVATION = { delay: 150, tolerance: 8 } as const;

/**
 * PointerSensor はマウスとタッチの両方を拾うため TouchSensor と併用すると二重に発火する。
 * マウスとタッチで別々のしきい値を持たせたいので MouseSensor + TouchSensor を使う。
 * sensors を明示するとデフォルトが置き換わるため KeyboardSensor も自分で足す。
 */
export function useDndSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: MOUSE_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
    useSensor(KeyboardSensor),
  );
}
```

`src/App.tsx` に import を追加する（`useAiWorker` の import の下）:

```tsx
import { useDndSensors } from './ui/dndSensors';
```

`GameShell` の Hook 呼び出し部に追加する。**必ず `if (state.status === 'setup')` などの早期 return より前**に置くこと（Hook 呼び出し順が変わるとエラーになる）。`const [showExchange, setShowExchange] = useState(false);` の直後に:

```tsx
  const sensors = useDndSensors();
```

`DndContext` にセンサーを渡す:

```tsx
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run test -- tests/ui/dndSensors.test.tsx tests/ui/App.aiTurn.test.tsx`
Expected: PASS (5 tests) — 既存の COM 手番テストも壊れていないこと

> `result.current` は `useSensors` が返す `SensorDescriptor[]` で、各要素が `{ sensor, options }` の形をしている。もし @dnd-kit の内部表現が変わってこのテストが書けない場合は、`useDndSensors` から `[MouseSensor, TouchSensor, KeyboardSensor]` を別途 named export して比較する形に落とす。

- [ ] **Step 5: コミット**

```bash
git add src/ui/dndSensors.ts tests/ui/dndSensors.test.tsx src/App.tsx
git commit -m "feat: タッチでのドラッグ配置を有効にする"
```

---

## Task 7: ボタン類のタッチターゲットを 44px 以上にする

**Files:**
- Modify: `src/ui/ActionBar.tsx`
- Modify: `src/ui/ModeSelect.tsx`
- Modify: `src/ui/BlankLetterModal.tsx`
- Test: `tests/ui/ActionBar.test.tsx`（新規）
- Test: `tests/ui/ModeSelect.test.tsx`
- Test: `tests/ui/BlankLetterModal.test.tsx`

`ActionBar` の `px-3 py-2` は 12px フォントで高さ約 32px、`BlankLetterModal` の文字ボタンは `w-8 h-8` = 32px でどちらも 44px に届かない。`min-h-[44px]` / `min-w-[44px]` を付ける。`BlankLetterModal` は 6 列 × 44px + gap 4px×5 = 284px となり、320px 幅の端末にも収まる。

**取りこぼしやすい 2 箇所も同時に直す:**

- `BlankLetterModal` の「キャンセル」リンク（`text-xs` のテキストリンクで高さ約 16px）
- エラートーストの閉じるボタン `✕`（`ml-2 underline` のみで実質 10px 四方）

どちらも押し間違いが直接ゲーム進行を止める箇所なので、44px 未満のまま残さない。

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/ActionBar.test.tsx` を新規作成:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionBar } from '../../src/ui/ActionBar';

const noop = () => {};

function renderBar(overrides: Partial<Parameters<typeof ActionBar>[0]> = {}) {
  return render(
    <ActionBar
      canPlay
      canRecall
      onPlay={noop}
      onRecall={noop}
      onShuffle={noop}
      onPass={noop}
      onExchange={noop}
      {...overrides}
    />,
  );
}

describe('<ActionBar>', () => {
  it('すべてのボタンが 44px 以上のタッチターゲットを持つ', () => {
    renderBar();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
    for (const b of buttons) {
      expect(b.className).toContain('min-h-[44px]');
    }
  });

  it('PLAY は pending が無いとき無効になる', () => {
    renderBar({ canPlay: false });
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeDisabled();
  });

  it('PLAY クリックで onPlay を呼ぶ', () => {
    const onPlay = vi.fn();
    renderBar({ onPlay });
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(onPlay).toHaveBeenCalled();
  });
});
```

`tests/ui/ModeSelect.test.tsx` の `describe` 内の末尾に追記:

```ts
  it('モードボタンが 44px 以上のタッチターゲットを持つ', () => {
    render(<ModeSelect disabled={false} onSelect={() => {}} />);
    expect(screen.getByLabelText('mode-com-easy').className).toContain('min-h-[44px]');
  });
```

`tests/ui/BlankLetterModal.test.tsx` の `describe` 内の末尾に追記:

```ts
  it('文字ボタンが 44px 以上のタッチターゲットを持つ', () => {
    render(<BlankLetterModal onSelect={() => {}} onCancel={() => {}} />);
    const btn = screen.getByRole('button', { name: 'letter-A' });
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.className).toContain('min-h-[44px]');
  });

  it('キャンセルも 44px 以上のタッチターゲットを持つ', () => {
    render(<BlankLetterModal onSelect={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'キャンセル' }).className).toContain('min-h-[44px]');
  });
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -- tests/ui/ActionBar.test.tsx tests/ui/ModeSelect.test.tsx tests/ui/BlankLetterModal.test.tsx`
Expected: FAIL — `expected 'font-pixel text-xs bg-green-500 ...' to contain 'min-h-[44px]'` ほか

- [ ] **Step 3: 実装する**

`src/ui/ActionBar.tsx` の `return` を差し替える:

```tsx
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      <button
        onClick={onPlay}
        disabled={!canPlay}
        className="font-pixel text-xs bg-green-500 text-white px-3 min-h-[44px] disabled:opacity-40"
      >
        PLAY
      </button>
      <button
        onClick={onRecall}
        disabled={!canRecall}
        className="font-pixel text-xs bg-stone-500 text-white px-3 min-h-[44px] disabled:opacity-40"
      >
        RECALL
      </button>
      <button onClick={onExchange} className="font-pixel text-xs bg-stone-600 text-white px-3 min-h-[44px]">
        EXCHANGE
      </button>
      <button onClick={onShuffle} className="font-pixel text-xs bg-stone-600 text-white px-3 min-h-[44px]">
        SHUFFLE
      </button>
      <button onClick={onPass} className="font-pixel text-xs bg-red-500 text-white px-3 min-h-[44px]">
        PASS
      </button>
    </div>
  );
```

`src/ui/ModeSelect.tsx` の `<button>` の className を差し替える:

```tsx
            className={`relative font-pixel text-xs px-4 py-3 min-h-[44px] text-left transition ${
              opt.enabled
                ? 'bg-yellow-300 text-stone-900 hover:bg-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed'
                : 'bg-stone-700 text-stone-400 cursor-not-allowed'
            }`}
```

`src/ui/BlankLetterModal.tsx` の文字ボタンの className を差し替える:

```tsx
              className="min-w-[44px] min-h-[44px] bg-tile-wood text-stone-900 font-bold"
```

同ファイルのキャンセルボタンにも高さを与える:

```tsx
      <button onClick={onCancel} className="mt-3 px-3 min-h-[44px] text-xs text-stone-300 underline">
        キャンセル
      </button>
```

`src/App.tsx` のエラートーストの閉じるボタンも同様に広げる（`{state.lastError && (...)}` の中）:

```tsx
            <button
              className="ml-2 px-3 min-h-[44px] min-w-[44px] underline"
              aria-label="エラーを閉じる"
              onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
            >
              ✕
            </button>
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run test -- tests/ui/ActionBar.test.tsx tests/ui/ModeSelect.test.tsx tests/ui/BlankLetterModal.test.tsx`
Expected: PASS (合計 10 tests)

- [ ] **Step 5: コミット**

```bash
git add src/ui/ActionBar.tsx src/ui/ModeSelect.tsx src/ui/BlankLetterModal.tsx src/App.tsx tests/ui/ActionBar.test.tsx tests/ui/ModeSelect.test.tsx tests/ui/BlankLetterModal.test.tsx
git commit -m "feat: ボタンのタッチターゲットを 44px 以上にする"
```

---

## Task 8: モーダルをモバイルでボトムシートにする

**Files:**
- Create: `src/ui/Sheet.tsx`
- Create: `tests/ui/Sheet.test.tsx`
- Modify: `src/ui/BlankLetterModal.tsx`
- Modify: `src/ui/ExchangeModal.tsx`
- Test: `tests/ui/BlankLetterModal.test.tsx`、`tests/ui/ExchangeModal.test.tsx`

現在 2 つのモーダルが `fixed inset-0 bg-black/60 flex items-center justify-center z-50` を重複して持っている。共通ラッパ `Sheet` に集約し、モバイルでは `items-end` + 全幅（ボトムシート）、PC（`md:` = 769px〜）では中央モーダルにする。背景タップで閉じられるようにし、`role="dialog"` / `aria-modal` を付けてスクリーンリーダー対応も入れる。

**Escape での閉じる操作を `Sheet` 自身に持たせる。** Task 10 でアプリ全体の Escape に「RECALL ALL」を割り当てるため、シートが開いている間に Escape を押すと「シートを閉じずに仮配置だけ消える」という壊れた挙動になりうる。`Sheet` 側で `keydown` を捕まえて `stopPropagation` ではなく **`onDismiss` を呼んだうえで App 側のハンドラをガードする**（Task 10 でモーダル表示中はショートカットを無効化する）という二重の対策を取る。

**フォーカス管理も入れる。** シートを開いたときにパネルへフォーカスを移し、閉じたときに元の要素へ戻す。これがないとキーボード利用者がシートに到達できず、閉じた後にフォーカスが `<body>` へ飛ぶ。

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/Sheet.test.tsx` を新規作成:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet } from '../../src/ui/Sheet';

describe('<Sheet>', () => {
  it('タイトルと子要素を表示する', () => {
    render(
      <Sheet title="テスト" onDismiss={() => {}}>
        <p>本文</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'テスト' })).toBeInTheDocument();
    expect(screen.getByText('本文')).toBeInTheDocument();
  });

  it('モバイルは下寄せ、PC は中央寄せにする', () => {
    const { container } = render(
      <Sheet title="テスト" onDismiss={() => {}}>
        <p>本文</p>
      </Sheet>,
    );
    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay.className).toContain('items-end');
    expect(overlay.className).toContain('md:items-center');
  });

  it('背景タップで onDismiss を呼ぶ', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <Sheet title="テスト" onDismiss={onDismiss}>
        <p>本文</p>
      </Sheet>,
    );
    fireEvent.click(container.firstElementChild as HTMLElement);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('パネル内のクリックでは閉じない', () => {
    const onDismiss = vi.fn();
    render(
      <Sheet title="テスト" onDismiss={onDismiss}>
        <p>本文</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByText('本文'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('Escape で onDismiss を呼ぶ', () => {
    const onDismiss = vi.fn();
    render(
      <Sheet title="テスト" onDismiss={onDismiss}>
        <p>本文</p>
      </Sheet>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('開いたときパネルへフォーカスを移す', () => {
    render(
      <Sheet title="テスト" onDismiss={() => {}}>
        <p>本文</p>
      </Sheet>,
    );
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('閉じたとき元の要素へフォーカスを戻す', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(
      <Sheet title="テスト" onDismiss={() => {}}>
        <p>本文</p>
      </Sheet>,
    );
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
```

`tests/ui/ExchangeModal.test.tsx` の `describe` 内の末尾に追記:

```ts
  it('ボトムシートとして表示される', () => {
    render(<ExchangeModal rack={rack} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('dialog', { name: '交換するタイルを選択' })).toBeInTheDocument();
  });
```

`tests/ui/BlankLetterModal.test.tsx` の `describe` 内の末尾に追記:

```ts
  it('ボトムシートとして表示される', () => {
    render(<BlankLetterModal onSelect={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Blank タイルの文字を選択' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -- tests/ui/Sheet.test.tsx tests/ui/BlankLetterModal.test.tsx tests/ui/ExchangeModal.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/ui/Sheet"` および `Unable to find role="dialog"`

- [ ] **Step 3: 実装する**

`src/ui/Sheet.tsx` を新規作成:

```tsx
import type React from 'react';
import { useEffect, useRef } from 'react';

/**
 * モバイルはボトムシート（下寄せ・全幅）、PC(769px〜) は中央モーダルとして表示する共通ラッパ。
 * 背景タップと Escape で閉じる。開閉に合わせてフォーカスを移動する。
 */
export function Sheet({
  title,
  onDismiss,
  children,
}: {
  title: string;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape で閉じる。App 側の Escape ショートカット（RECALL ALL）は
  // シート表示中は無効化されるので、ここでの処理と競合しない。
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  // 開いたらパネルへフォーカスし、閉じたら開く前の要素へ戻す
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previous?.focus();
  }, []);

  return (
    <div
      role="presentation"
      onClick={onDismiss}
      className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="w-full md:w-auto max-h-[85vh] overflow-y-auto bg-stone-800 p-4 rounded-t-lg md:rounded-lg pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4 outline-none"
      >
        <h2 className="font-pixel text-sm mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}
```

`src/ui/BlankLetterModal.tsx` を以下の内容にする:

```tsx
import type { Letter } from '../game/types';
import { Sheet } from './Sheet';

const LETTERS: Letter[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as Letter[];

export function BlankLetterModal({
  onSelect,
  onCancel,
}: {
  onSelect: (letter: Letter) => void;
  onCancel: () => void;
}) {
  return (
    <Sheet title="Blank タイルの文字を選択" onDismiss={onCancel}>
      <div className="grid grid-cols-6 gap-1 justify-items-center">
        {LETTERS.map(l => (
          <button
            key={l}
            type="button"
            onClick={() => onSelect(l)}
            aria-label={`letter-${l}`}
            className="min-w-[44px] min-h-[44px] bg-tile-wood text-stone-900 font-bold"
          >
            {l}
          </button>
        ))}
      </div>
      <button onClick={onCancel} className="mt-3 px-3 min-h-[44px] text-xs text-stone-300 underline">
        キャンセル
      </button>
    </Sheet>
  );
}
```

`src/ui/ExchangeModal.tsx` を以下の内容にする:

```tsx
import type React from 'react';
import { useState } from 'react';
import type { Tile as TileType } from '../game/types';
import { Tile } from './Tile';
import { Sheet } from './Sheet';

export function ExchangeModal({
  rack,
  onConfirm,
  onCancel,
}: {
  rack: TileType[];
  onConfirm: (indices: number[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    const s = new Set(selected);
    if (s.has(i)) s.delete(i);
    else s.add(i);
    setSelected(s);
  }

  return (
    <Sheet title="交換するタイルを選択" onDismiss={onCancel}>
      <div
        className="flex gap-1 justify-center flex-wrap"
        // 手札と同じ大きさで見せる
        style={{ '--cell-size': 'var(--rack-tile-size)' } as React.CSSProperties}
      >
        {rack.map((tile, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center ${
              selected.has(i) ? 'ring-4 ring-red-400' : ''
            }`}
            aria-label={`exchange-tile-${i}`}
          >
            <Tile tile={tile} variant={selected.has(i) ? 'in-rack-selected' : 'in-rack'} />
          </button>
        ))}
      </div>
      <div className="flex gap-3 mt-3 justify-end items-center">
        <button onClick={onCancel} className="text-xs text-stone-300 underline min-h-[44px] px-2">
          キャンセル
        </button>
        <button
          onClick={() => onConfirm([...selected])}
          disabled={selected.size === 0}
          className="font-pixel text-xs bg-yellow-300 text-stone-900 px-3 min-h-[44px] disabled:opacity-40"
        >
          OK ({selected.size})
        </button>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run test -- tests/ui/Sheet.test.tsx tests/ui/BlankLetterModal.test.tsx tests/ui/ExchangeModal.test.tsx`
Expected: PASS (合計 16 tests)

- [ ] **Step 5: コミット**

```bash
git add src/ui/Sheet.tsx src/ui/BlankLetterModal.tsx src/ui/ExchangeModal.tsx tests/ui/Sheet.test.tsx tests/ui/BlankLetterModal.test.tsx tests/ui/ExchangeModal.test.tsx
git commit -m "feat: モーダルをモバイルでボトムシート表示にする"
```

---

## Task 9: アプリシェルのレイアウトをモバイル対応にする

**Files:**
- Modify: `src/ui/ScorePanel.tsx`
- Modify: `src/App.tsx`
- Test: `tests/ui/ScorePanel.test.tsx`
- Test: `tests/ui/App.layout.test.tsx`（新規）

4 点を直す:

1. `ScorePanel` が `justify-between` なのに幅指定が無く、内容の幅にしか広がらない。`w-full` にする。
2. 盤面は 92vw に収まるが、320px 幅の端末では下限 20px が効いて外形 322px になりわずかに溢れる。横スクロールできるラッパで包む。
3. Rack と ActionBar を画面下部に固定する（design.md §5.1）。ページ末尾に置いた `sticky bottom-0` + `mt-auto` のフッターにまとめ、セーフエリア分の余白を確保する。
4. `min-h-screen`（= `100vh`）ではなく **`min-h-[100dvh]`** を使う。モバイル Safari / Chrome の `100vh` はアドレスバーを含んだ高さなので、`sticky bottom-0` のフッターがアドレスバーの裏に隠れる。`dvh` は表示中の実際のビューポート高さに追従する。

**`sticky bottom-0` + `mt-auto` の併用について:** flex column の最後の子に `mt-auto` を置くとコンテンツが短いときに下端へ押し下げられ、`sticky bottom-0` はコンテンツが長いときにスクロール中も下端に貼り付ける。両者は排他ではなく補完関係で、併用して問題ない。ただし **`position: sticky` は祖先に `overflow: hidden` / `auto` があると効かなくなる**。盤面ラッパの `overflow-x-auto` はフッターの兄弟であって祖先ではないので影響しない。フッターを `board-scroller` の中に入れないこと。

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/ScorePanel.test.tsx` の `describe` 内の末尾に追記:

```ts
  it('横幅いっぱいに広がる', () => {
    const { container } = render(
      <ScorePanel p1Score={0} comScore={0} bagRemaining={100} currentPlayerId="P1" />,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('w-full');
  });
```

`tests/ui/App.layout.test.tsx` を新規作成:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => ({ state: 'ready' as const, requestMove: vi.fn() }),
}));

import App from '../../src/App';

describe('App のモバイルレイアウト', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => 'CAT\nDOG\n' }));
    // Task 10 で App が matchMedia を使うようになる。jsdom は未実装なので先に入れておく
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function startFreePlay() {
    render(<App />);
    const free = await screen.findByLabelText('mode-free');
    await waitFor(() => expect(free).not.toBeDisabled());
    fireEvent.click(free);
    await screen.findByLabelText('cell-7-7');
  }

  it('盤面を横スクロールできるコンテナで包む', async () => {
    await startFreePlay();
    const scroller = screen.getByTestId('board-scroller');
    expect(scroller.className).toContain('overflow-x-auto');
  });

  it('手札と操作ボタンを画面下部に固定する', async () => {
    await startFreePlay();
    const footer = screen.getByTestId('play-footer');
    expect(footer.className).toContain('sticky');
    expect(footer.className).toContain('bottom-0');
    // 手札と ActionBar が両方フッター内にある
    expect(footer.querySelector('[data-testid="rack-tiles"]')).not.toBeNull();
    expect(footer.textContent).toContain('PLAY');
  });

  it('sticky フッターが overflow を持つ要素の内側に入っていない', async () => {
    await startFreePlay();
    const footer = screen.getByTestId('play-footer');
    // position:sticky は overflow:auto/hidden の子孫では効かない。
    // 盤面の横スクロールラッパの中にフッターを入れてしまう事故を防ぐ。
    expect(screen.getByTestId('board-scroller').contains(footer)).toBe(false);
  });

  it('モバイルのアドレスバーを考慮して dvh を使う', async () => {
    await startFreePlay();
    const shell = screen.getByTestId('app-shell');
    // 100vh だとモバイルでアドレスバーの裏にフッターが隠れる
    expect(shell.className).toContain('min-h-[100dvh]');
    expect(shell.className).not.toContain('min-h-screen');
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -- tests/ui/ScorePanel.test.tsx tests/ui/App.layout.test.tsx`
Expected: FAIL — `expected 'flex justify-between ...' to contain 'w-full'` および `Unable to find an element by: [data-testid="board-scroller"]`

- [ ] **Step 3: 実装する**

`src/ui/ScorePanel.tsx` の `return` の `<div>` の className を差し替える:

```tsx
    <div className="w-full max-w-[92vw] flex justify-between items-center gap-2 sm:gap-4 font-pixel text-[10px] sm:text-xs p-2 bg-stone-800">
```

`src/App.tsx` の `playing` 時の `return` を差し替える。外側コンテナ、盤面ラッパ、フッターの 3 箇所が変わり、`Rack` と `ActionBar` は履歴表示のあとへ移動する:

```tsx
  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* min-h-screen(100vh) はモバイルでアドレスバー分ずれるので dvh を使う */}
      <div
        data-testid="app-shell"
        className="min-h-[100dvh] flex flex-col items-center gap-3 p-2 md:p-4"
      >
        <h1 className="font-pixel text-base md:text-xl">Toy Scrabble</h1>
        <ScorePanel
          p1Score={state.players[0].score}
          comScore={state.players[1].score}
          bagRemaining={state.bag.length}
          currentPlayerId={current.id}
        />
        {ai.state === 'thinking' && (
          <div className="font-pixel text-xs text-yellow-300 animate-pulse">
            🤖 COM 思考中…
          </div>
        )}
        {/* 320px 幅ではセル下限 20px により盤面が数 px 溢れるため横スクロールを許す */}
        <div data-testid="board-scroller" className="w-full overflow-x-auto flex justify-center">
          <Board
            board={state.board}
            pending={state.pending}
            onCellClick={handleCellClick}
            highlightCoords={state.lastAiPlacedCoords}
          />
        </div>
        {(() => {
          const last = state.history[state.history.length - 1];
          if (!last) return null;
          const playerLabel = last.player === 'COM' ? '🤖 COM' : '👤 P1';
          let content: string;
          if (last.move.kind === 'place') {
            content = `${last.wordsFormed.join(' + ')} +${last.score}`;
          } else if (last.move.kind === 'pass') {
            content = 'PASS';
          } else {
            content = `EXCHANGE (${last.move.tileIndices.length} 枚)`;
          }
          return (
            <div className="font-pixel text-[10px] sm:text-xs text-stone-300">
              直前手: {playerLabel}: {content}
            </div>
          );
        })()}

        {state.history.length > 0 && (
          <details className="font-pixel text-[10px] text-stone-400">
            <summary className="cursor-pointer min-h-[44px] flex items-center">
              履歴 ({state.history.length} 手)
            </summary>
            <ol className="mt-2 max-h-32 overflow-y-auto text-left px-2">
              {state.history.slice(-8).reverse().map((rec, i) => {
                const num = state.history.length - i;
                const playerLabel = rec.player === 'COM' ? '🤖' : '👤';
                let content: string;
                if (rec.move.kind === 'place') {
                  content = `${rec.wordsFormed.join(' + ')} +${rec.score}`;
                } else if (rec.move.kind === 'pass') {
                  content = 'PASS';
                } else {
                  content = `EXCHANGE (${rec.move.tileIndices.length})`;
                }
                return (
                  <li key={num}>
                    {num}. {playerLabel} {content}
                  </li>
                );
              })}
            </ol>
          </details>
        )}

        {/* 手札と操作は常に親指の届く画面下部に固定する（design.md §5.1）。
            mt-auto でコンテンツが短いときは下端へ、sticky bottom-0 で長いときも貼り付く。
            この要素を board-scroller（overflow-x-auto）の中に入れると sticky が効かなくなる。 */}
        <div
          data-testid="play-footer"
          className="sticky bottom-0 z-30 mt-auto w-full flex flex-col items-center gap-2 bg-stone-900/95 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {/* エラーはフッター内の通常フローに置く。fixed + 固定 bottom 値だと
              フッターの高さが変わったときに重なる。 */}
          {state.lastError && (
            <div className="flex items-center gap-2 bg-red-500 text-white px-4 rounded font-pixel text-xs">
              <span>{state.lastError}</span>
              <button
                className="px-3 min-h-[44px] min-w-[44px] underline"
                aria-label="エラーを閉じる"
                onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
              >
                ✕
              </button>
            </div>
          )}
          <div
            className={`w-full flex justify-center ${isCOMTurn ? 'pointer-events-none opacity-50' : ''}`}
          >
            <Rack
              rack={current.rack}
              selectedIndex={selectedIndex}
              onSelect={i => setSelectedIndex(i === selectedIndex ? null : i)}
            />
          </div>
          <div className={isCOMTurn ? 'pointer-events-none opacity-50' : ''}>
            <ActionBar
              canPlay={state.pending.length > 0}
              canRecall={state.pending.length > 0}
              onPlay={() => dispatch({ type: 'COMMIT_PLAY', dict })}
              onRecall={() => dispatch({ type: 'RECALL_ALL' })}
              onShuffle={() => dispatch({ type: 'SHUFFLE_RACK', rng: seededRng(Date.now()) })}
              onPass={() => {
                if (confirm('本当に PASS しますか？')) dispatch({ type: 'PASS' });
              }}
              onExchange={() => setShowExchange(true)}
            />
          </div>
        </div>

        {comToast && (
          <div className="fixed top-2 left-1/2 -translate-x-1/2 bg-yellow-300 text-stone-900 px-4 py-2 rounded shadow-lg font-pixel text-xs sm:text-sm z-40 animate-bounce">
            {comToast}
          </div>
        )}
      </div>
      {pendingBlank && (
        <BlankLetterModal
          onSelect={l => {
            dispatch({ type: 'ASSIGN_BLANK', r: pendingBlank.r, c: pendingBlank.c, letter: l });
            setPendingBlank(null);
          }}
          onCancel={() => {
            dispatch({ type: 'RECALL_PENDING', coord: pendingBlank });
            setPendingBlank(null);
          }}
        />
      )}
      {showExchange && (
        <ExchangeModal
          rack={current.rack}
          onConfirm={indices => {
            dispatch({ type: 'EXCHANGE', indices, rng: seededRng(Date.now()) });
            setShowExchange(false);
          }}
          onCancel={() => setShowExchange(false)}
        />
      )}
    </DndContext>
  );
```

`setup` / `ended` 画面のコンテナにもモバイル余白を入れる。両方の `className="p-6 text-center flex flex-col items-center gap-4"` を差し替える:

```tsx
      <div className="min-h-[100dvh] p-4 md:p-6 text-center flex flex-col items-center justify-center gap-4">
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run test -- tests/ui/ScorePanel.test.tsx tests/ui/App.layout.test.tsx tests/ui/App.aiTurn.test.tsx`
Expected: PASS (合計 9 tests)

既存の `tests/ui/App.errorToast.test.tsx` など、エラートーストの DOM 位置に依存するテストがあれば、フッター内へ移動したことに合わせて修正する。まず `grep -rn "lastError\|エラーを閉じる\|bottom-32" tests/` で影響範囲を確認すること。

- [ ] **Step 5: コミット**

```bash
git add src/ui/ScorePanel.tsx src/App.tsx tests/ui/ScorePanel.test.tsx tests/ui/App.layout.test.tsx
git commit -m "feat: 手札と操作を画面下部に固定しモバイル幅に収める"
```

---

## Task 10: PC 限定のキーボードショートカット

**Files:**
- Create: `src/ui/useMediaQuery.ts`
- Create: `tests/ui/useMediaQuery.test.ts`
- Create: `tests/ui/App.keyboard.test.tsx`
- Modify: `src/App.tsx`

design.md §5.6 の「キーボードショートカットは PC のみ」を実装する。Enter = PLAY、Escape = RECALL ALL。モバイルではソフトキーボードの Enter が誤爆しうるので `(min-width: 769px)` のときだけ有効にする。

**グローバルな `keydown` を張るときのガードを最初から入れる。** 後から足すと必ず抜ける:

| ガード | 理由 |
|---|---|
| `pendingBlank` / `showExchange` が真なら無効 | シート表示中の Escape は Task 8 でシートを閉じる操作。ここで RECALL ALL が同時に走ると仮配置が消える |
| フォーカスが `BUTTON` / `INPUT` / `TEXTAREA` / `SELECT` にあるとき Enter を無視 | ボタンにフォーカスした状態の Enter は本来そのボタンの起動。PLAY が二重に走る |
| `e.repeat` なら無視 | キーの押しっぱなしで COMMIT_PLAY が連射される |
| `Ctrl` / `Meta` / `Alt` の同時押しなら無視 | ブラウザのショートカット（Cmd+Enter など）を奪わない |

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/useMediaQuery.test.ts` を新規作成:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../../src/ui/useMediaQuery';

type Listener = (e: { matches: boolean }) => void;

function stubMatchMedia(initial: boolean) {
  const listeners: Listener[] = [];
  const mql = {
    matches: initial,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: (_: string, fn: Listener) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    emit(matches: boolean) {
      mql.matches = matches;
      for (const fn of [...listeners]) fn({ matches });
    },
    listenerCount: () => listeners.length,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('初期状態の matches を返す', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 769px)'));
    expect(result.current).toBe(true);
  });

  it('メディアクエリの変化に追従する', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 769px)'));
    expect(result.current).toBe(false);
    act(() => media.emit(true));
    expect(result.current).toBe(true);
  });

  it('アンマウント時にリスナーを外す', () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 769px)'));
    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});
```

`tests/ui/App.keyboard.test.tsx` を新規作成:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => ({ state: 'ready' as const, requestMove: vi.fn() }),
}));

import App from '../../src/App';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('キーボードショートカット', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => 'CAT\nDOG\n' }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function startAndPlaceOneTile() {
    render(<App />);
    const free = await screen.findByLabelText('mode-free');
    await waitFor(() => expect(free).not.toBeDisabled());
    fireEvent.click(free);
    await screen.findByLabelText('cell-7-7');
    // 手札は毎回ランダムなので、ブランク（"?" 表示）以外を選ぶ。
    // ブランクだと文字選択シートが開いて pending の確定が止まる。
    const tile = [0, 1, 2, 3, 4, 5, 6]
      .map(i => screen.getByLabelText(`rack-${i}`))
      .find(btn => !btn.textContent?.includes('?'));
    if (!tile) throw new Error('ブランク以外の手札が見つからない');
    fireEvent.click(tile);
    fireEvent.click(screen.getByLabelText('cell-7-7'));
  }

  it('PC では Escape で仮配置を戻す', async () => {
    stubMatchMedia(true);
    await startAndPlaceOneTile();
    await waitFor(() => expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled());
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'RECALL' })).toBeDisabled());
  });

  it('モバイルではキー操作を受け付けない', async () => {
    stubMatchMedia(false);
    await startAndPlaceOneTile();
    await waitFor(() => expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled();
  });

  it('キーの押しっぱなしでは発火しない', async () => {
    stubMatchMedia(true);
    await startAndPlaceOneTile();
    await waitFor(() => expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled());
    fireEvent.keyDown(window, { key: 'Escape', repeat: true });
    expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled();
  });

  it('修飾キーとの同時押しは無視する', async () => {
    stubMatchMedia(true);
    await startAndPlaceOneTile();
    await waitFor(() => expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled());
    fireEvent.keyDown(window, { key: 'Escape', metaKey: true });
    expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled();
  });

  it('ボタンにフォーカスがあるときの Enter は PLAY を起こさない', async () => {
    stubMatchMedia(true);
    await startAndPlaceOneTile();
    const shuffle = screen.getByRole('button', { name: 'SHUFFLE' });
    shuffle.focus();
    fireEvent.keyDown(window, { key: 'Enter' });
    // PLAY が走っていれば仮配置が確定 or エラーで pending が変化する。
    // ここでは走っていないので RECALL は有効なまま。
    expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled();
  });

  it('EXCHANGE シート表示中の Escape は仮配置を消さない', async () => {
    stubMatchMedia(true);
    await startAndPlaceOneTile();
    fireEvent.click(screen.getByRole('button', { name: 'EXCHANGE' }));
    await screen.findByRole('dialog', { name: '交換するタイルを選択' });
    fireEvent.keyDown(window, { key: 'Escape' });
    // Sheet が閉じる
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // 仮配置は残っている（RECALL が有効なまま）
    expect(screen.getByRole('button', { name: 'RECALL' })).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm run test -- tests/ui/useMediaQuery.test.ts tests/ui/App.keyboard.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/ui/useMediaQuery"`

- [ ] **Step 3: 実装する**

`src/ui/useMediaQuery.ts` を新規作成:

```ts
import { useEffect, useState } from 'react';

/** メディアクエリの一致状態を購読する。SSR は無いので初期値も matchMedia から取る。 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);

  useEffect(() => {
    const mql = matchMedia(query);
    const onChange = (e: { matches: boolean }) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
```

> `eslint-disable-next-line no-undef` は不要（Task 0 で TS ファイルの `no-undef` を切ってある）。

`src/App.tsx` に import を追加する（`useDndSensors` の import の下）:

```tsx
import { useMediaQuery } from './ui/useMediaQuery';
```

`GameShell` の `const sensors = useDndSensors();` の直後に追加する:

```tsx
  // キーボードショートカットは PC のみ（design.md §5.6）
  const isDesktop = useMediaQuery('(min-width: 769px)');
```

`aiRequestedKeyRef` の宣言より前、あるいは COM トーストの `useEffect` の直後に、次の `useEffect` を追加する。**早期 return より前に置くこと**:

```tsx
  // Enter = PLAY / Escape = RECALL ALL（PC のみ、design.md §5.6）
  const canPlay = state.status === 'playing' && state.pending.length > 0;
  const isHumanTurn =
    state.status === 'playing' &&
    (state.mode === 'free' || state.players[state.currentPlayerIndex].id !== 'COM');
  // シート表示中はショートカットを止める。Escape は Sheet 側が「閉じる」に使う
  const isSheetOpen = pendingBlank !== null || showExchange;

  useEffect(() => {
    if (!isDesktop || !isHumanTurn || isSheetOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      // 押しっぱなしの連射と、ブラウザ標準ショートカットの横取りを避ける
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        // ボタンや入力欄にフォーカスがある Enter は、その要素の操作が本来の意味
        const tag = document.activeElement?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (!canPlay || !dict) return;
        e.preventDefault();
        dispatch({ type: 'COMMIT_PLAY', dict });
      } else if (e.key === 'Escape') {
        if (!canPlay) return;
        e.preventDefault();
        dispatch({ type: 'RECALL_ALL' });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDesktop, isHumanTurn, isSheetOpen, canPlay, dict, dispatch]);
```

> `function onKeyDown(e: KeyboardEvent)` の `KeyboardEvent` は **型の位置でも `no-undef` に引っかかる**。Task 0 で `no-undef` を切ってあるので disable コメントは不要。Task 0 を飛ばした場合はここで lint が落ちる。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run test -- tests/ui/useMediaQuery.test.ts tests/ui/App.keyboard.test.tsx`
Expected: PASS (9 tests)

- [ ] **Step 5: 既存テストに matchMedia のスタブを入れる（必須）**

`App` が `matchMedia` を呼ぶようになるが **jsdom は `matchMedia` を実装していない**ため、`App` をレンダリングする既存テストは全て `matchMedia is not a function` で落ちる。「落ちたら直す」ではなく、この Step で確実に入れる。

対象は `tests/ui/App.aiTurn.test.tsx`（Task 9 で `tests/ui/App.layout.test.tsx` には追加済み）。`beforeEach` に追加する:

```ts
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
```

他に `App` をレンダリングするテストが無いか確認する:

```bash
grep -rln "from '../../src/App'" tests/
```

出てきたファイル全てに同じスタブを入れること。

- [ ] **Step 6: 全テストと lint / build を通す**

Run: `npm run test && npm run lint && npm run build`
Expected: 全テスト PASS、lint はエラー 0・警告 0、build 成功

- [ ] **Step 7: コミット**

```bash
git add src/ui/useMediaQuery.ts src/App.tsx tests/ui/useMediaQuery.test.ts tests/ui/App.keyboard.test.tsx tests/ui/App.aiTurn.test.tsx tests/ui/App.layout.test.tsx
git commit -m "feat: PC 限定のキーボードショートカットを追加する"
```

---

## Task 11: GitHub Pages への自動デプロイ

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

`vite.config.ts` の `base` は既に `'/toy-scrabble/'` になっているので変更不要。辞書 `public/dict/twl06.txt` は `.gitignore` されているが `prebuild` が `word-list` パッケージから毎回生成するので、CI では `npm ci && npm run build` だけで揃う。

`actions/deploy-pages` を使うため、GitHub 側で Settings → Pages → Source を **GitHub Actions** にしておく必要がある。**これは最初の push より前に済ませること。** 未設定のまま push すると deploy ジョブが `Get Pages site failed` で失敗し、原因が分かりにくい。

**actions のバージョンについて:** 下記は本計画作成時点で有効な組み合わせ。GitHub の actions はメジャーバージョンが上がると古い版が段階的に廃止されるので、**着手時に必ず各 action の README で最新のメジャー版を確認して合わせること**（`actions/checkout` は v6、`actions/upload-pages-artifact` は v4 が出ている）。バージョンが古いと `deprecated version of actions/upload-artifact` のような警告付き失敗になる。

**権限のスコープ:** `pages: write` と `id-token: write` は `deploy` ジョブでしか要らない。ワークフロー全体に付けると build ジョブ（`npm ci` で外部パッケージのスクリプトが走る）にも OIDC トークン発行権限が渡ってしまう。ジョブ単位で絞る。

- [ ] **Step 1: ワークフローを作成する**

`.github/workflows/deploy.yml` を新規作成:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

# デフォルトは読み取りのみ。書き込み権限は必要なジョブにだけ付ける
permissions:
  contents: read

# 同時デプロイを 1 本に絞る。実行中のデプロイは打ち切らない
# （打ち切ると Pages が中途半端な状態で残ることがある）
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      # prebuild が word-list から public/dict/twl06.txt を生成する
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    # Pages への書き込みと OIDC はこのジョブでしか要らない
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 1.5: リポジトリ側の Pages 設定を先に済ませる**

push する前に、GitHub 上で以下を実施する:

1. `aoi-33/toy-scrabble` リポジトリを作成する
2. Settings → Pages → Build and deployment → Source を **GitHub Actions** に変更する

この順番を守らないと初回の deploy ジョブが失敗する。

- [ ] **Step 2: ローカルで本番ビルドを検証する**

Run: `npm run build && npm run preview`
Expected: `Local: http://localhost:4173/toy-scrabble/` が表示され、ブラウザで開くとモード選択画面が出る。辞書ロード後にゲームが開始できること。確認できたら Ctrl+C で停止する。

- [ ] **Step 3: README を更新する**

`README.md` の 5 行目を差し替える:

```markdown
英英・英和辞書表示（Plan 3）は後続計画で実装します。モバイル対応と GitHub Pages デプロイ（Plan 4）は実装済みです。
```

`## ライセンス` の直前に次の節を追加する:

```markdown
## デプロイ

`main` へ push すると GitHub Actions（`.github/workflows/deploy.yml`）が lint → test → build を実行し、`dist/` を GitHub Pages へ publish します。

公開 URL: `https://aoi-33.github.io/toy-scrabble/`

初回のみリポジトリ側で以下の設定が必要です。

1. GitHub 上に `aoi-33/toy-scrabble` リポジトリを作成する
2. `git remote add origin git@github.com:aoi-33/toy-scrabble.git && git push -u origin main`
3. Settings → Pages → Build and deployment → Source を **GitHub Actions** に変更する

辞書ファイル `public/dict/twl06.txt` は `.gitignore` 済みですが、`prebuild` が npm の `word-list` パッケージから毎回生成するため CI でも同じものが作られます。

## 対応環境

- スマートフォン（幅 320px 〜）: 手札と操作ボタンは画面下部に固定。タイルは長押しでドラッグ、タップでも配置できます
- PC（幅 769px 〜）: Enter で PLAY、Escape で仮配置を全て戻す
```

- [ ] **Step 4: 実機・実画面での手動確認**

Run: `npm run dev`（`vite.config.ts` に `server.host: true` があるので同一 LAN のスマホから `http://<PC の IP>:5173/toy-scrabble/` で開ける）

以下を確認する:

| 幅 | 確認項目 | 期待 |
|---|---|---|
| 320px | DevTools を 320×568 にして開く | 盤面が全体表示される（横スクロールが出ても盤面が切れない） |
| 320px | 手札を見る | 7 枚すべてに触れる（横スクロールしてでも到達できる） |
| 320px | Blank タイルを置く | 文字ボタン 6 列が画面内に収まる |
| 375px | iPhone / Android 実機（または DevTools の 375×667）で開く | 盤面が横に溢れず全体が見える |
| 375px | 手札タイルをタップ → 空マスをタップ | タイルが配置される（**150ms のしきい値でタップが潰れていないこと**） |
| 375px | 手札タイルを長押ししてマスへドラッグ | タイルが配置される。ページがスクロールしない |
| 375px | 画面を下までスクロール | 手札と PLAY/RECALL 等が常に画面下部に見えている |
| 375px | ページを一番下までスクロールした状態でアドレスバーを出し入れする | 手札がアドレスバーの裏に隠れない（`dvh` の効果） |
| 375px | EXCHANGE を押す | 交換シートが画面下部から出る。背景タップで閉じる |
| 横向き | 端末を横にする（667×375 相当） | 盤面とフッターが両方見える。フッターが盤面を覆い隠さない |
| 1280px | DevTools を 1280px 幅にする | 盤面セルが 36px 固定、モーダルが画面中央に出る |
| 1280px | 仮配置後に Escape | 仮配置が手札に戻る |
| 1280px | SHUFFLE にフォーカスした状態で Enter | SHUFFLE が動き、PLAY は走らない |
| 1280px | EXCHANGE シートを開いて Escape | シートが閉じ、仮配置は残る |
| iOS | iPhone の Safari（ホームバーあり）で開く | 手札がホームバーに被らない |

**タップ / 長押しの分離がうまくいかない場合:** `src/ui/dndSensors.ts` の `TOUCH_ACTIVATION` の `delay` を調整する（タップがドラッグに化けるなら上げる、ドラッグが始まりにくいなら下げる）。この 1 箇所を直せば全体に効く。

- [ ] **Step 5: コミット**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "feat: GitHub Pages への自動デプロイを追加する"
```

- [ ] **Step 6: 最終確認**

Run: `npm run test && npm run lint && npm run build`
Expected: 全テスト PASS、lint エラー 0、build 成功

---

## 完了条件

### 自動チェック
- [ ] `npm run test` が全て PASS（既存 101 件 + 新規 約 45 件）
- [ ] `npm run lint` がエラー 0 **かつ警告 0**（Task 0 で不要な disable ディレクティブを一掃済み）
- [ ] `npm run build` が成功（`tsc -b` を含む）

### レイアウト（DevTools で確認）
- [ ] 320px 幅で盤面が切れず、手札 7 枚すべてに到達できる
- [ ] 375px 幅で盤面・手札・操作ボタンがすべて画面内に収まる
- [ ] 横向き（667×375）で盤面とフッターが両立する
- [ ] 1280px 幅で盤面セルが 36px、モーダルが中央表示になる

### 実機
- [ ] スマートフォン実機でタップ配置とドラッグ配置の**両方**が動く（片方が潰れていない）
- [ ] アドレスバーの出し入れで手札が隠れない
- [ ] ホームバーのある端末で手札がホームバーに被らない

### デプロイ
- [ ] Settings → Pages → Source が **GitHub Actions** になっている
- [ ] `main` への push で GitHub Actions が成功し、公開 URL が開ける
- [ ] **公開 URL 上で COM 戦を 1 局（最低 3 手）最後まで進められる** — 辞書 fetch のパス（`base: '/toy-scrabble/'`）と Web Worker のバンドルが本番ビルドで壊れていないことの確認を兼ねる
