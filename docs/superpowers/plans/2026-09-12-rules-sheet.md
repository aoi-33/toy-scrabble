# アプリ内ルール表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ホーム画面とプレイ中の両方から、1 タップでゲームのルールを読めるようにする。

**Architecture:** 既存の `AboutSheet` が確立している「共通モーダル `Sheet` をラップ + 日本語の静的本文 + 閉じるボタン」の型をそのままなぞる新規コンポーネント `RulesSheet` を 1 つ作り、`App` が `showRules` の開閉状態を持つ。導線はホームの `RULES` ボタンと、プレイ中のヘッダー右上の `?` ボタンの 2 つ。

**Tech Stack:** React 18 / TypeScript strict / Tailwind 3.4 / Vitest 2 + @testing-library/react 16 + jsdom

---

## 前提知識（この節を先に読むこと）

このリポジトリで作業する上で知らないと事故る点。

**1. `@testing-library/user-event` は依存に入っていない。** テストのユーザー操作は必ず
`fireEvent` を使う。`userEvent` を import すると解決できずに落ちる。

**2. `tsconfig.app.json` の `include` は `["src", "tests"]`。** テストファイルも `tsc -b` の
型検査対象になる。Vitest は esbuild で型を無視するので、**テストが緑でも `npm run build` が
赤になりうる**。各タスクの最後に必ず `npx tsc -b` を走らせること。

**3. Lint はリポジトリ全体に `npx eslint .` で走らせる。** `npm run lint` は環境上使えない。
`eslint.config.js` は編集禁止。`eslint-disable` コメントを新規に足さないこと。

**4. Press Start 2P（`font-pixel`）は ASCII しか持たない。** 和文に当てると別フォントに落ちて
字面が揃わない。日本語主体の本文には `font-pixel` を付けない。`AboutSheet.tsx:25-27` に
同じ理由のコメントがある。

**5. タップ領域は最低 44px。** ボタンには `min-h-[44px]`（アイコンなら `min-w-[44px]` も）を付ける。

**6. コメントとユーザー向け文言は日本語、識別子は英語。** コメントは既定で書かない。
書くのは「なぜ」が自明でないときだけ。

**7. コミットメッセージは 1 行。** `Co-Authored-By` などのトレーラを付けない。

---

## ファイル構成

| ファイル | 区分 | 責務 |
|---|---|---|
| `src/ui/RulesSheet.tsx` | 新規 | ルール本文の表示のみ。状態を持たない |
| `tests/ui/RulesSheet.test.tsx` | 新規 | RulesSheet 単体のテスト |
| `src/App.tsx` | 変更 | `showRules` 状態、2 つの導線、シートの描画 |
| `tests/ui/App.rules.test.tsx` | 新規 | 導線の結合テスト |
| `tests/ui/App.keyboard.test.tsx` | 変更 | ルール表示中のショートカット抑止 |

`AboutSheet.tsx` と `Sheet.tsx` は触らない。

---

### Task 1: RulesSheet コンポーネント

**Files:**
- Create: `src/ui/RulesSheet.tsx`
- Test: `tests/ui/RulesSheet.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/RulesSheet.test.tsx` を新規作成する。

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RulesSheet } from '../../src/ui/RulesSheet';

describe('RulesSheet', () => {
  it('ダイアログとして開く', () => {
    render(<RulesSheet onDismiss={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'RULES' })).toBeInTheDocument();
  });

  // 配置エラーの文言だけ見ても理由が分からないので、制約は全部並べる
  it('配置の制約を挙げる', () => {
    render(<RulesSheet onDismiss={() => {}} />);
    expect(screen.getByText(/同じ行か同じ列に一直線/)).toBeInTheDocument();
    expect(screen.getByText(/初手は中央/)).toBeInTheDocument();
    expect(screen.getByText(/既存のタイルに隣接/)).toBeInTheDocument();
    expect(screen.getByText(/縦横どちらも辞書に載っている/)).toBeInTheDocument();
  });

  it('プレミアムマスと 7 枚ボーナスを挙げる', () => {
    render(<RulesSheet onDismiss={() => {}} />);
    expect(screen.getByText(/DL \/ TL はその文字が 2 倍 \/ 3 倍/)).toBeInTheDocument();
    expect(screen.getByText(/\+50 点/)).toBeInTheDocument();
  });

  it('交換とパスの条件を挙げる', () => {
    render(<RulesSheet onDismiss={() => {}} />);
    expect(screen.getByText(/袋に 7 枚以上/)).toBeInTheDocument();
    expect(screen.getByText(/6 回連続/)).toBeInTheDocument();
  });

  // 手札の残りが減点になることは得点に直結するのに、画面のどこにも出ていない
  it('終了時の精算を挙げる', () => {
    render(<RulesSheet onDismiss={() => {}} />);
    expect(screen.getByText(/自分の得点から引かれます/)).toBeInTheDocument();
  });

  it('閉じるボタンで onDismiss を呼ぶ', () => {
    const onDismiss = vi.fn();
    render(<RulesSheet onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認する**

実行: `npx vitest run tests/ui/RulesSheet.test.tsx`

期待: 6 件すべて FAIL。`src/ui/RulesSheet` が存在しないので import 解決エラーになる。

- [ ] **Step 3: コンポーネントを実装する**

`src/ui/RulesSheet.tsx` を新規作成する。本文の数値はすべて実装で裏取り済み
（`rules.ts` / `reducer.ts` / `board.ts`）。勝手に変えないこと。

```tsx
import { Sheet } from './Sheet';

export function RulesSheet({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Sheet title="RULES" onDismiss={onDismiss}>
      {/* 本文は日本語が主体。Press Start 2P は ASCII しか持たず和文が別フォントに
          落ちて字面が揃わないので、ここだけ font-pixel を外す */}
      <div className="text-xs leading-relaxed text-stone-200 text-left space-y-3 max-w-sm">
        <section>
          <h3 className="text-stone-400 mb-1">目的</h3>
          <p>手札の 7 枚で英単語を作り、得点を競います。</p>
        </section>

        <section>
          <h3 className="text-stone-400 mb-1">手順</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>タイルをタップしてから盤のマスをタップすると置けます（ドラッグでも置けます）</li>
            <li>PLAY で確定します。辞書に無い語は手札に戻ります</li>
            <li>RECALL で置いたタイルをまとめて手札に戻せます</li>
          </ol>
        </section>

        <section>
          <h3 className="text-stone-400 mb-1">置きかた</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>1 手で置くタイルは同じ行か同じ列に一直線に並べます</li>
            <li>間に隙間を空けられません</li>
            <li>初手は中央の ★ を通します</li>
            <li>2 手目以降は必ず既存のタイルに隣接させます</li>
            <li>できた語は縦横どちらも辞書に載っている必要があります</li>
          </ul>
        </section>

        <section>
          <h3 className="text-stone-400 mb-1">得点</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>置いたタイルの点数の合計です</li>
            <li>DL / TL はその文字が 2 倍 / 3 倍になります</li>
            <li>DW / TW はその単語が 2 倍 / 3 倍になります。中央の ★ は DW と同じ扱いです</li>
            <li>プレミアムマスはそのターンに置いたタイルの分だけ効きます。すでに盤にあるタイルの下では効きません</li>
            <li>手札 7 枚をすべて使い切ると +50 点です</li>
          </ul>
        </section>

        <section>
          <h3 className="text-stone-400 mb-1">その他</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>EXCHANGE は袋に 7 枚以上残っているときだけ使えます</li>
            <li>PASS は手番を飛ばします。6 回連続でゲーム終了です</li>
            <li>空白タイルは 2 枚あり、任意の文字として使えますが 0 点です。DL / TL を踏んでも 0 点のままです</li>
            <li>終了時、手札に残ったタイルの点数は自分の得点から引かれます。先に使い切った側には相手の残り点が加算されます</li>
            <li>「直前手」と「履歴」の単語をタップすると、発音記号・英英定義・和訳が出ます</li>
          </ul>
        </section>

        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[44px] w-full px-3 bg-stone-700 hover:bg-stone-600"
        >
          閉じる
        </button>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

実行: `npx vitest run tests/ui/RulesSheet.test.tsx`

期待: `Tests 6 passed (6)`

- [ ] **Step 5: 型検査と lint**

実行: `npx tsc -b && npx eslint .`

期待: どちらも出力なし（エラー 0 件）。

- [ ] **Step 6: コミット**

```bash
git add src/ui/RulesSheet.tsx tests/ui/RulesSheet.test.tsx
git commit -m "feat: ゲームのルールを表示する RulesSheet を追加する"
```

---

### Task 2: ホーム画面に RULES ボタンを足す

**Files:**
- Modify: `src/App.tsx`（import 追加、`showRules` state 追加、setup 画面 158-165 行）
- Test: `tests/ui/App.rules.test.tsx`（新規）

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/App.rules.test.tsx` を新規作成する。

`useAiWorker` の mock は `tests/ui/App.aiTurn.test.tsx` と同じ「状態を持つ」版を使う。
Task 3 で COM 思考中の挙動を試すのに必要で、`ready` 固定の mock では `thinking` を再現できない。

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState, useCallback } from 'react';
import type { Move } from '../../src/game/types';

const requestMove = vi.fn<(snapshot: unknown, difficulty: unknown) => Promise<Move>>();

// COM 思考中の表示を再現するため、実ワーカーと同じ状態遷移を持つ mock を使う
vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => {
    const [state, setState] = useState<'ready' | 'thinking'>('ready');
    const request = useCallback((snapshot: unknown, difficulty: unknown) => {
      setState('thinking');
      const promise = requestMove(snapshot, difficulty);
      promise.then(() => setState('ready'));
      return promise;
    }, []);
    return { state, requestMove: request };
  },
}));

import App from '../../src/App';

describe('App のルール表示', () => {
  beforeEach(() => {
    requestMove.mockReset();
    // 解決しない Promise を返して thinking のまま留める
    requestMove.mockImplementation(() => new Promise<Move>(() => {}));
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
  });

  it('モード選択画面に RULES ボタンがある', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: 'RULES' })).toBeInTheDocument();
  });

  it('起動直後はルールが開いていない', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'RULES' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('RULES を押すとルールのダイアログが開く', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'RULES' }));
    expect(screen.getByRole('dialog', { name: 'RULES' })).toBeInTheDocument();
    expect(screen.getByText(/同じ行か同じ列に一直線/)).toBeInTheDocument();
  });

  it('閉じるとダイアログが消える', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'RULES' }));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認する**

実行: `npx vitest run tests/ui/App.rules.test.tsx`

期待: 4 件すべて FAIL。`RULES` という名前のボタンが存在しない。

- [ ] **Step 3: import と state を足す**

`src/App.tsx` の 11 行目、`import { AboutSheet } from './ui/AboutSheet';` の直後に追加する。

```tsx
import { RulesSheet } from './ui/RulesSheet';
```

33 行目、`const [showAbout, setShowAbout] = useState(false);` の直後に追加する。

```tsx
  const [showRules, setShowRules] = useState(false);
```

- [ ] **Step 4: setup 画面のボタンを差し替える**

`src/App.tsx` の 158-165 行は現在こうなっている。

```tsx
        <button
          type="button"
          onClick={() => setShowAbout(true)}
          className="font-pixel text-[10px] text-stone-400 hover:text-stone-200 min-h-[44px] px-3"
        >
          ABOUT
        </button>
        {showAbout && <AboutSheet onDismiss={() => setShowAbout(false)} />}
```

これを次で置き換える。RULES を左に置くのは、初見の利用者が最初に押すべきものだから。

```tsx
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="font-pixel text-[10px] text-stone-400 hover:text-stone-200 min-h-[44px] px-3"
          >
            RULES
          </button>
          <button
            type="button"
            onClick={() => setShowAbout(true)}
            className="font-pixel text-[10px] text-stone-400 hover:text-stone-200 min-h-[44px] px-3"
          >
            ABOUT
          </button>
        </div>
        {showRules && <RulesSheet onDismiss={() => setShowRules(false)} />}
        {showAbout && <AboutSheet onDismiss={() => setShowAbout(false)} />}
```

- [ ] **Step 5: テストが通ることを確認する**

実行: `npx vitest run tests/ui/App.rules.test.tsx tests/ui/App.about.test.tsx`

期待: `Tests 8 passed (8)`。既存の About のテスト 4 件が壊れていないことも同時に見る。

- [ ] **Step 6: 型検査と lint**

実行: `npx tsc -b && npx eslint .`

期待: どちらも出力なし。

- [ ] **Step 7: コミット**

```bash
git add src/App.tsx tests/ui/App.rules.test.tsx
git commit -m "feat: ホーム画面に RULES ボタンを追加する"
```

---

### Task 3: プレイ中のヘッダーに ? ボタンを足す

**Files:**
- Modify: `src/App.tsx`（245 行のヘッダー、および 387 行付近のシート描画）
- Test: `tests/ui/App.rules.test.tsx`（Task 2 で作ったファイルに追記）

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/App.rules.test.tsx` の `'閉じるとダイアログが消える'` の直後、`describe` の
閉じ括弧の前に次の 2 件を追加する。ファイル冒頭の import 行に `waitFor` を足すこと
（`import { render, screen, fireEvent, waitFor } from '@testing-library/react';`）。

```tsx
  it('ゲーム開始後もヘッダーの ? からルールを開ける', async () => {
    render(<App />);
    const free = await screen.findByLabelText('mode-free');
    await waitFor(() => expect(free).not.toBeDisabled());
    fireEvent.click(free);
    await screen.findByLabelText('cell-7-7');

    fireEvent.click(screen.getByRole('button', { name: 'ルールを見る' }));
    expect(screen.getByRole('dialog', { name: 'RULES' })).toBeInTheDocument();
  });

  // ActionBar は COM の手番中に親ごと pointer-events-none になる。
  // ルールの導線をそこに置くと思考中に読めなくなるので、ヘッダーにあることを固定する
  it('COM の思考中でもルールを開ける', async () => {
    render(<App />);
    const easy = await screen.findByLabelText('mode-com-easy');
    await waitFor(() => expect(easy).not.toBeDisabled());
    fireEvent.click(easy);

    fireEvent.click(screen.getByText('PASS'));
    await screen.findByText('🤖 COM 思考中…');

    fireEvent.click(screen.getByRole('button', { name: 'ルールを見る' }));
    expect(screen.getByRole('dialog', { name: 'RULES' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: テストが落ちることを確認する**

実行: `npx vitest run tests/ui/App.rules.test.tsx`

期待: 新しい 2 件が FAIL（`ルールを見る` という名前のボタンが無い）。既存の 4 件は PASS。

- [ ] **Step 3: ヘッダーを差し替える**

`src/App.tsx` の 245 行は現在こうなっている。

```tsx
        <h1 className="font-pixel text-base md:text-xl">Toy Scrabble</h1>
```

これを次で置き換える。`relative` + `absolute right-0` にするのは、タイトルの中央揃えを
保ったままボタンを右端に出すため。`justify-between` だとタイトルが左にずれる。

```tsx
        <div className="w-full relative flex items-center justify-center">
          <h1 className="font-pixel text-base md:text-xl">Toy Scrabble</h1>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            aria-label="ルールを見る"
            className="absolute right-0 font-pixel text-xs text-stone-400 hover:text-stone-200 min-h-[44px] min-w-[44px]"
          >
            ?
          </button>
        </div>
```

- [ ] **Step 4: プレイ中の画面にシートを描画する**

`src/App.tsx` の 387-393 行にある `{selectedWord && (...)}` ブロックの直後、
`</DndContext>` の直前に追加する。

```tsx
      {showRules && <RulesSheet onDismiss={() => setShowRules(false)} />}
```

- [ ] **Step 5: テストが通ることを確認する**

実行: `npx vitest run tests/ui/App.rules.test.tsx`

期待: `Tests 6 passed (6)`

- [ ] **Step 6: レイアウトの回帰を確認する**

ヘッダーの DOM 構造を変えたので、盤面まわりのレイアウトテストを走らせる。

実行: `npx vitest run tests/ui/App.layout.test.tsx tests/ui/App.aiTurn.test.tsx`

期待: すべて PASS。落ちた場合はヘッダーの `w-full` が盤面の幅計算に影響していないか見る。

- [ ] **Step 7: 型検査と lint**

実行: `npx tsc -b && npx eslint .`

期待: どちらも出力なし。

- [ ] **Step 8: コミット**

```bash
git add src/App.tsx tests/ui/App.rules.test.tsx
git commit -m "feat: プレイ中のヘッダーからルールを開けるようにする"
```

---

### Task 4: ルール表示中はキーボードショートカットを止める

**Files:**
- Modify: `src/App.tsx:114-115`
- Test: `tests/ui/App.keyboard.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/App.keyboard.test.tsx` の最後のテスト
`'EXCHANGE シート表示中の Escape は仮配置を消さない'` の直後、`describe` の閉じ括弧の前に追加する。

「RECALL が有効なまま」を assert してはいけない。1 文字だけの仮配置で PLAY が走っても
`1 文字だけでは単語になりません`（`rules.ts:78`）で弾かれて pending が残るため、修正前でも
通ってしまう。PLAY が走ったかどうかは、エラー文言が出たかどうかで見る。この文言は
`reducer.ts:144` で `lastError` に入り、`App.tsx:323-325` が画面に出す。

```tsx
  it('ルール表示中の Enter は PLAY を起こさない', async () => {
    stubMatchMedia(true);
    await startAndPlaceOneTile();

    fireEvent.click(screen.getByRole('button', { name: 'ルールを見る' }));
    await screen.findByRole('dialog', { name: 'RULES' });

    fireEvent.keyDown(window, { key: 'Enter' });

    // PLAY が走っていれば 1 文字の仮配置が検証されてエラーが出る
    expect(screen.queryByText('1 文字だけでは単語になりません')).toBeNull();
  });
```

- [ ] **Step 2: テストが落ちることを確認する**

実行: `npx vitest run tests/ui/App.keyboard.test.tsx`

期待: 新しい 1 件が FAIL。`1 文字だけでは単語になりません` が画面に出ている。

これは `Sheet` が開くとパネルの `div`（`tabIndex={-1}`）にフォーカスを移すため、
`App.tsx:124-127` の「ボタンにフォーカスがあるなら無視」の分岐に入らず、
PLAY が実行されてしまうから。既存の 6 件は PASS のまま。

- [ ] **Step 3: isSheetOpen に showRules を足す**

`src/App.tsx` の 114-115 行は現在こうなっている。

```tsx
  const isSheetOpen =
    pendingBlank !== null || showExchange || selectedWord !== null || showAbout;
```

これを次で置き換える。

```tsx
  const isSheetOpen =
    pendingBlank !== null || showExchange || selectedWord !== null || showAbout || showRules;
```

- [ ] **Step 4: テストが通ることを確認する**

実行: `npx vitest run tests/ui/App.keyboard.test.tsx`

期待: `Tests 7 passed (7)`

- [ ] **Step 5: 全テストと型検査と lint**

実行: `npm run test`

期待: `Tests 264 passed` より多い数がすべて PASS（このプランで 13 件増えるので 277 件）。
FAIL が 0 件であることを確認する。

実行: `npx tsc -b && npx eslint .`

期待: どちらも出力なし。

- [ ] **Step 6: コミット**

```bash
git add src/App.tsx tests/ui/App.keyboard.test.tsx
git commit -m "fix: ルール表示中はキーボードショートカットを止める"
```

---

### Task 5: ブラウザでの目視確認とドキュメント更新

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 本番ビルドしてプレビューを起動する**

```bash
npm run build
npm run preview
```

期待: `http://localhost:4173/toy-scrabble/` が 200 を返す。

- [ ] **Step 2: ブラウザで確認する**

Playwright MCP が `Error: "chrome" executable not found` で落ちる場合は、同梱 chromium を
直接指定して起動する（MCP が chrome チャンネルを探しているだけで、ブラウザ自体はある）。

- 実行ファイル: `/home/setup/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`
- ライブラリ: `/home/setup/11_research/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs`
- `chromium.launch({ executablePath: ... })` で起動する

確認する項目:

- ホーム画面に `RULES` と `ABOUT` が横に並び、どちらも 44px 以上の高さがある
- `RULES` を押すとルールが開き、和文が Press Start 2P に落ちて崩れていない
- ゲームを開始し、ヘッダー右上の `?` を押すとルールが開く
- `?` を足してもタイトル `Toy Scrabble` が中央に来ている
- 幅 320px で本文が横に溢れない（`document.documentElement.scrollWidth === window.innerWidth`）
- 幅 320px でヘッダーの `?` がタイトルに重なっていない

- [ ] **Step 3: プレビューを止め、一時ファイルを消す**

確認に一時ファイルを作った場合は消し、`git status --short` に残っていないことを確認する。

- [ ] **Step 4: README を更新する**

`README.md` の「遊び方（Plan 1 時点）」の直前に、次の 1 行を独立した段落として追加する。

```markdown
ルールはアプリ内の `RULES` ボタン（ホーム画面）とプレイ中のヘッダーの `?` からも読めます。
```

`## 変更履歴` の直下、既存の先頭項目 `- **2026-09-12** 英単語の発音記号（IPA）…` の**上**に
次の 1 行を追加する。

```markdown
- **2026-09-12** ゲームのルールをアプリ内で読めるようにした。ホーム画面の `RULES` ボタンと、プレイ中のヘッダーの `?` から開ける。配置の制約・得点計算・終了時の精算まで載せている。
```

- [ ] **Step 5: 最終確認**

実行: `npm run test && npx tsc -b && npx eslint .`

期待: テストは全件 PASS、型と lint はエラー 0 件。

- [ ] **Step 6: コミット**

```bash
git add README.md
git status --short
git commit -m "docs: アプリ内でルールを読めるようになったことを README に書く"
```

`git status --short` の出力に `public/dict/` 配下や一時ファイルが現れないこと。

---

## 完了条件

- ホーム画面と対戦中の両方からルールを開ける
- COM 思考中でもルールを開ける
- ルール表示中はキーボードショートカットが無効
- 320px 幅で本文が読める
- 和文が Press Start 2P に落ちて崩れていない
- `npm run test` / `npx tsc -b` / `npx eslint .` がすべて通る
