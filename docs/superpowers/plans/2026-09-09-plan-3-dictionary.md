# Plan 3: 英英・英和辞書表示 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 対局履歴に出た単語をタップすると、英英定義（品詞ごと先頭 1 件）と和訳（先頭 3 件）をシートで表示できるようにする。

**Architecture:** ビルド時に `wordnet-db` と `ejdict` から `public/dict/defs/{a..z}.json` を生成し、実行時は語の先頭文字のバケットだけを lazy fetch する。屈折形はビルド時に原形へ解決済みで、バケットを跨ぐ不規則形は定義を実体でコピーしてあるため、実行時に追加 fetch は発生しない。辞書は表示専用で `GameState` に一切触れない。

**Tech Stack:** Node ESM ビルドスクリプト（`scripts/*.mjs`）、React 18 + TypeScript strict、Tailwind、Vitest + @testing-library/react。

**実行時に判明した差分（実装は以下に従っている）:**

- Task 8・9 のテストコードは `@testing-library/user-event` を import しているが、このパッケージは本プロジェクトの依存に無い。依存を増やさない方針（CLAUDE.md）に従い、既存の `tests/ui/Sheet.test.tsx` と同じく `fireEvent.click` を使っている。
- Task 10 のテストの `calls.every(([url]: [string]) => …)` は vitest では通るが `tsc -b` で落ちる（`mock.calls` の要素は `any[]` でタプル `[string]` に代入できない）。`calls.every((call: unknown[]) => …)` に書き換えた。アサーションの内容は同じ。

**Spec:** `docs/superpowers/specs/2026-09-09-plan-3-dictionary-design.md`

---

## この計画で必ず守る環境制約

- **コメント・ドキュメントは日本語。** 変数名・関数名・ファイル名は英語。
- **`eslint.config.js` は編集禁止**（`config-protection` フックでブロックされる）。`globals.browser` が無いので、`window` / `document` / `fetch` / `KeyboardEvent` / `HTMLElement` / `console` / `process` / `Buffer` / `setTimeout` などを使う行の直前に `// eslint-disable-next-line no-undef` を必ず書く。**テストファイルも対象。**
- **lint はリポジトリ全体で確認する。** `npx eslint .` を使うこと。`npx eslint src/...` のようにパスを絞ると、テスト側の破損を見逃す（Plan 4 Task 8 で実際に起きた）。
- **`git commit` のメッセージは 1 行のみ。** ヒアドキュメント・複数行・`Co-Authored-By` 行はフックにブロックされる。
- Bash では `&&` によるコマンド連結、`$(...)`、`npm run lint`、`npx tsc -b` が拒否される。コマンドは 1 つずつ実行する。テストは `npx vitest run`、ビルドは `npm run build`、lint は `npx eslint .` を使う。
- `git push` / `git remote add` は**行わない**。`main` 上で作業し、タスクごとにコミットする。

## TS7016 の罠（必読）

`tsconfig.app.json` は `tests` を include する一方 `allowJs` を持たない。そのため型定義の無い `.mjs` を `.ts` テストから**静的 import すると、テストは通るのに `npm run build` だけが TS7016 で落ちる**。既存の `tests/ui/generatedCss.test.ts:6-15` で確立した回避策を必ず踏襲すること — **モジュール指定子を変数に入れた動的 import** を使うと TypeScript がモジュール解決を試みない。

```typescript
const WORDNET_PATH = '../../scripts/lib/wordnet.mjs';

async function loadWordnet(): Promise<{
  parseIndex: (text: string) => Map<string, string>;
  parseData: (text: string) => Map<string, string>;
}> {
  return await import(WORDNET_PATH);
}
```

静的 import に書き換えてはいけない。

## spec からの逸脱（3 点、いずれも意図的）

1. **`scripts/lib/buckets.mjs` を追加する。** spec §3 のファイル一覧には無いが、§9 が要求する「小さなフィクスチャからの build-defs スモークテスト」を I/O 抜きで書くには、バケット組み立てを純関数として切り出す必要がある。`build-defs.mjs` はファイル読み書きだけを担う。
2. **`lookup` の戻り値は `Definition | null` ではなく `LookupResult` 判別共用体にする。** spec §6 の擬似コードは `null` を返すが、§7.3 は `not-found` と `error` を別状態として区別することを要求しており、`null` ひとつでは表現できない。§8 の「例外を上位に投げない」も同時に満たす。
3. **`.gitignore` は変更しない。** spec §10 は `public/dict/defs/` の追加を指示しているが、既存の `public/dict/*` が既にこれを含んでいる。追加は不要。

## spec の修正（接尾辞規則の例）

spec §4.2 の例 2 件が規則と矛盾しているので、計画側の値を正とする。

| 接尾辞 | 置換 | spec の例（誤） | 正しい例 |
|---|---|---|---|
| `SES` | `S` | BUSSES → BUS | **GASES → GAS**（`BUSSES` は `BUSS` になる） |
| `ZES` | `Z` | QUIZZES → QUIZ | **WALTZES → WALTZ**（`QUIZZES` は `QUIZZ` になり解決しない） |

規則自体は変更しない。候補は必ず WordNet 見出し語 Set で検証するので、解決できない語はバケットに載らないだけである。

## ファイル構成

| ファイル | 責務 |
|---|---|
| `scripts/lib/wordnet.mjs` | 新規。`index.*` / `data.*` の行パースのみ。I/O なし |
| `scripts/lib/ejdict.mjs` | 新規。ejdict バケットと不規則動詞表のオブジェクト → Map 変換のみ。I/O なし |
| `scripts/lib/lemmatize.mjs` | 新規。原形解決。不規則表と接尾辞規則を持つ。I/O なし |
| `scripts/lib/buckets.mjs` | 新規。見出し語リスト + 辞書データ → バケット構造。I/O なし |
| `scripts/build-defs.mjs` | 新規。上記 4 つを繋ぎ、`public/dict/defs/{a..z}.json` を書く。I/O のみ |
| `src/lookup/types.ts` | 新規。`Pos` / `EnglishSense` / `Definition` / `Bucket` / `FetchLike` / `LookupResult` |
| `src/lookup/dictLoader.ts` | 新規。バケット lazy fetch + キャッシュ + inflight dedup + 解決 |
| `src/lookup/useDefinition.ts` | 新規。`loading` を足した状態と `retry` を返す React フック |
| `src/ui/DefinitionSheet.tsx` | 新規。既存 `Sheet` の中に 4 状態を描画 |
| `src/ui/WordChip.tsx` | 新規。`WordChip`（1 語）と `MoveWords`（1 手ぶん、`place` 以外は何も出さない） |
| `src/App.tsx` | 変更。`直前手` と `履歴` の単語をチップ化、シート開閉状態を持つ、Escape 抑止に追加 |
| `package.json` | 変更。devDependencies 2 つと `build:defs` スクリプト、`predev`/`prebuild`/`prepreview` の連結 |
| `README.md` | 変更。Plan 3 完了を反映 |

`src/game/*`、`.github/workflows/deploy.yml`、`.gitignore`、`eslint.config.js` は**変更しない**。

---

### Task 1: 辞書パッケージの追加と npm スクリプト

**Files:**
- Modify: `package.json`
- Test: `tests/scripts/deps.test.ts`（新規）

- [x] **Step 1: 失敗するテストを書く**

`tests/scripts/deps.test.ts` を新規作成:

```typescript
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// vitest はリポジトリルートから実行される
// eslint-disable-next-line no-undef
const root = process.cwd();

describe('辞書データパッケージ', () => {
  it('wordnet-db の index/data が 4 品詞ぶん存在する', () => {
    for (const name of ['noun', 'verb', 'adj', 'adv']) {
      expect(existsSync(resolve(root, `node_modules/wordnet-db/dict/index.${name}`))).toBe(true);
      expect(existsSync(resolve(root, `node_modules/wordnet-db/dict/data.${name}`))).toBe(true);
    }
  });

  it('ejdict のバケット JSON と不規則動詞表が存在する', () => {
    expect(existsSync(resolve(root, 'node_modules/ejdict/lib/data/dictionary/a.json'))).toBe(true);
    expect(existsSync(resolve(root, 'node_modules/ejdict/lib/data/dictionary/z.json'))).toBe(true);
    expect(existsSync(resolve(root, 'node_modules/ejdict/lib/data/irregular_verbs.json'))).toBe(true);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run tests/scripts/deps.test.ts`
Expected: FAIL（2 件とも `expected false to be true`）

- [x] **Step 3: 依存を入れる**

Run: `npm install --save-dev wordnet-db@3.1.14 ejdict@1.4.2`

`wordnet-db` は展開 35MB あるのでインストールに時間がかかる。これは spec §2 で許容済み。

- [x] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/scripts/deps.test.ts`
Expected: PASS（2 件）

- [x] **Step 5: npm スクリプトを足す**

`package.json` の `scripts` を編集する。`build:dict` の直後に `build:defs` を足し、`predev` / `prebuild` / `prepreview` の 3 つを、現在の `node scripts/build-dict.mjs` から次の値へ変える:

```
node scripts/build-dict.mjs && node scripts/build-defs.mjs
```

`build:defs` の値:

```
node scripts/build-defs.mjs
```

`build-defs.mjs` は `public/dict/twl06.txt` を入力に使うので、`build-dict.mjs` の**後**に走らせること。この時点では `scripts/build-defs.mjs` がまだ無いため `npm run build` は失敗するが、それは Task 5 で解消する。

- [x] **Step 6: lint を通す**

Run: `npx eslint .`
Expected: エラー 0、警告 0

- [x] **Step 7: コミット**

Run: `git add package.json package-lock.json tests/scripts/deps.test.ts`
Run: `git commit -m "chore: add wordnet-db and ejdict for Plan 3 dictionary definitions"`

---

### Task 2: WordNet のパーサ

**Files:**
- Create: `scripts/lib/wordnet.mjs`
- Test: `tests/scripts/wordnet.test.ts`（新規）

実測した形式（`node_modules/wordnet-db/dict/`）:

- `index.*` の先頭 29 行はライセンスヘッダで、**行頭が半角スペース 2 個**。
- データ行: `lemma pos synset_cnt p_cnt [ptr_symbol…] sense_cnt tagsense_cnt offset…`。`ptr_symbol` の個数は行ごとに違うので、**末尾から `synset_cnt` 個**を offset とみなすのが安全。先頭が主語義。
- `data.*` のデータ行: `offset lex_filenum ss_type w_cnt word lex_id … | gloss`。gloss は `定義; "用例"; "用例"` の形で、**定義自体がセミコロンを含む**（`draw air into, and expel out of, the lungs; "I can breathe better…"`）。最初の `;` ではなく最初の `; "` で切る。

- [x] **Step 1: 失敗するテストを書く**

`tests/scripts/wordnet.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest';

// TS7016 回避: モジュール指定子を変数に入れた動的 import（本計画冒頭を参照）
const WORDNET_PATH = '../../scripts/lib/wordnet.mjs';

async function loadWordnet(): Promise<{
  parseIndex: (text: string) => Map<string, string>;
  parseData: (text: string) => Map<string, string>;
}> {
  return await import(WORDNET_PATH);
}

const INDEX_FIXTURE = [
  '  1 This software and database is being provided to you, the LICENSEE, by  ',
  "'hood n 1 2 @ ; 1 0 08659519  ",
  'cat n 8 5 @ ~ #m + ; 8 1 02124272 10172934 09919605 03614083 02989061 02986962 02130460 00903174  ',
  'ice_cream n 1 1 @ 1 0 07615671  ',
  'dog n 7 3 @ ~ + 7 1 02086723 10114209 09886220 03901548 02710044 01325095 07676602  ',
].join('\n');

const DATA_FIXTURE = [
  '  1 This software and database is being provided to you, the LICENSEE, by  ',
  '00001740 29 v 04 breathe 0 take_a_breath 0 respire 0 suspire 3 021 * 00005041 v 0000 | draw air into, and expel out of, the lungs; "I can breathe better when the air is clean"; "The patient is respiring"  ',
  '02124272 05 n 02 cat 0 true_cat 0 003 @ 02123242 n 0000 | feline mammal usually having thick soft fur and no ability to roar  ',
].join('\n');

describe('parseIndex', () => {
  it('ライセンスヘッダ行を無視する', async () => {
    const { parseIndex } = await loadWordnet();
    expect(parseIndex(INDEX_FIXTURE).has('1')).toBe(false);
  });

  it('末尾 synset_cnt 個の先頭を主語義 offset として拾う', async () => {
    const { parseIndex } = await loadWordnet();
    const index = parseIndex(INDEX_FIXTURE);
    expect(index.get('cat')).toBe('02124272');
    expect(index.get('dog')).toBe('02086723');
  });

  it('英小文字のみでない見出し語を捨てる', async () => {
    const { parseIndex } = await loadWordnet();
    const index = parseIndex(INDEX_FIXTURE);
    expect(index.has("'hood")).toBe(false);
    expect(index.has('ice_cream')).toBe(false);
  });
});

describe('parseData', () => {
  it('gloss から用例を落として定義だけを返す', async () => {
    const { parseData } = await loadWordnet();
    const data = parseData(DATA_FIXTURE);
    expect(data.get('02124272')).toBe(
      'feline mammal usually having thick soft fur and no ability to roar',
    );
  });

  it('定義に含まれるセミコロンで切らない', async () => {
    const { parseData } = await loadWordnet();
    const data = parseData(DATA_FIXTURE);
    expect(data.get('00001740')).toBe('draw air into, and expel out of, the lungs');
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run tests/scripts/wordnet.test.ts`
Expected: FAIL（`Failed to resolve import` / モジュールが存在しない）

- [x] **Step 3: 実装する**

`scripts/lib/wordnet.mjs` を新規作成:

```javascript
// WordNet 3.1 の index.* / data.* をパースする。ビルド時のみ使用する。
// 形式は docs/superpowers/specs/2026-09-09-plan-3-dictionary-design.md §2.1 を参照。

/**
 * index.{noun,verb,adj,adv} をパースし、見出し語（小文字）→ 主語義の synset offset の Map を返す。
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function parseIndex(text) {
  const result = new Map();
  for (const line of text.split('\n')) {
    // ライセンスヘッダは行頭が半角スペース 2 個
    if (!line || line.startsWith('  ')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 6) continue;
    const lemma = parts[0];
    // 複合語（_ 区切り）や 'hood / .22 は盤面に置けないので捨てる
    if (!/^[a-z]+$/.test(lemma)) continue;
    const synsetCnt = Number(parts[2]);
    if (!Number.isInteger(synsetCnt) || synsetCnt < 1) continue;
    if (parts.length < synsetCnt + 1) continue;
    // ptr_symbol の個数は行ごとに違うので、末尾から synset_cnt 個を offset とみなす
    const offsets = parts.slice(parts.length - synsetCnt);
    result.set(lemma, offsets[0]);
  }
  return result;
}

/**
 * data.{noun,verb,adj,adv} をパースし、synset offset → 定義文の Map を返す。
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function parseData(text) {
  const result = new Map();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('  ')) continue;
    const bar = line.indexOf(' | ');
    if (bar === -1) continue;
    const offset = line.slice(0, line.indexOf(' '));
    let gloss = line.slice(bar + 3).trim();
    // gloss は `定義; "用例"; "用例"`。定義自体が ; を含むので `; "` で切る
    const example = gloss.indexOf('; "');
    if (example !== -1) gloss = gloss.slice(0, example);
    result.set(offset, gloss.trim());
  }
  return result;
}
```

- [x] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/scripts/wordnet.test.ts`
Expected: PASS（5 件）

- [x] **Step 5: lint とビルドを確認する**

Run: `npx eslint .`
Expected: エラー 0、警告 0

- [x] **Step 6: コミット**

Run: `git add scripts/lib/wordnet.mjs tests/scripts/wordnet.test.ts`
Run: `git commit -m "feat: add WordNet index and data parsers for definition build"`

---

### Task 3: ejdict のパーサ

**Files:**
- Create: `scripts/lib/ejdict.mjs`
- Test: `tests/scripts/ejdict.test.ts`（新規）

実測した形式:

- `lib/data/dictionary/{a..z}.json` はフラットな `{ "見出し": "訳文" }`。キーは大小混在（`"C"`, `"c."`, `"cat"`）。値は**先頭に半角スペースが 1 個入り**、複数語義は ` / ` 区切り。`『』` は強調記号。
- `lib/data/irregular_verbs.json` は 150 件の `{ "活用形": "原形" }`。`"born, borne": "bear"` のようにカンマ複合キーが 1 件だけある。`mice` は**含まれない**（不規則名詞は Task 4 の手書き表が担う）。

- [x] **Step 1: 失敗するテストを書く**

`tests/scripts/ejdict.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest';

const EJDICT_PATH = '../../scripts/lib/ejdict.mjs';

async function loadEjdict(): Promise<{
  parseEjdictBucket: (obj: Record<string, string>) => Map<string, string[]>;
  parseIrregularVerbs: (obj: Record<string, string>) => Map<string, string>;
}> {
  return await import(EJDICT_PATH);
}

describe('parseEjdictBucket', () => {
  it('値を / で分割し trim して最大 3 件にする', async () => {
    const { parseEjdictBucket } = await loadEjdict();
    const map = parseEjdictBucket({
      go: ' 行く / 動く / 進む / 出発する / なる',
    });
    expect(map.get('GO')).toEqual(['行く', '動く', '進む']);
  });

  it('強調記号 『』 を落とす', async () => {
    const { parseEjdictBucket } = await loadEjdict();
    const map = parseEjdictBucket({
      cat: ' 『猫』;(ライオン,トラ,ヒョウなどの)ネコ科の動物',
    });
    expect(map.get('CAT')).toEqual(['猫;(ライオン,トラ,ヒョウなどの)ネコ科の動物']);
  });

  it('英大文字のみでないキーを捨てる', async () => {
    const { parseEjdictBucket } = await loadEjdict();
    const map = parseEjdictBucket({
      'a.': ' about / acre[s]',
      '.22': ' 22口径',
      a: ' 1つの',
    });
    expect(map.has('A.')).toBe(false);
    expect(map.has('.22')).toBe(false);
    expect(map.get('A')).toEqual(['1つの']);
  });

  it('大小違いの重複キーは先勝ちにする', async () => {
    const { parseEjdictBucket } = await loadEjdict();
    const map = parseEjdictBucket({ cat: ' 猫', Cat: ' 別の訳' });
    expect(map.get('CAT')).toEqual(['猫']);
  });
});

describe('parseIrregularVerbs', () => {
  it('活用形を大文字で原形に対応づける', async () => {
    const { parseIrregularVerbs } = await loadEjdict();
    const map = parseIrregularVerbs({ went: 'go', gone: 'go', ran: 'run' });
    expect(map.get('WENT')).toBe('GO');
    expect(map.get('GONE')).toBe('GO');
    expect(map.get('RAN')).toBe('RUN');
  });

  it('カンマ複合キーを 2 エントリに分割する', async () => {
    const { parseIrregularVerbs } = await loadEjdict();
    const map = parseIrregularVerbs({ 'born, borne': 'bear' });
    expect(map.get('BORN')).toBe('BEAR');
    expect(map.get('BORNE')).toBe('BEAR');
    expect(map.has('BORN, BORNE')).toBe(false);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run tests/scripts/ejdict.test.ts`
Expected: FAIL（モジュールが存在しない）

- [x] **Step 3: 実装する**

`scripts/lib/ejdict.mjs` を新規作成:

```javascript
// ejdict の辞書バケットと不規則動詞表を読みやすい形へ変換する。ビルド時のみ使用する。

/** 和訳の保持件数（spec §5） */
const MAX_JAPANESE = 3;

/**
 * ejdict のバケット JSON から 大文字見出し → 和訳配列（最大 3 件）の Map を作る。
 * @param {Record<string, string>} obj
 * @returns {Map<string, string[]>}
 */
export function parseEjdictBucket(obj) {
  const result = new Map();
  for (const [rawKey, rawValue] of Object.entries(obj)) {
    const key = String(rawKey).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(key)) continue;
    // 大小違いの重複キー（cat / Cat）は先に出たものを採る
    if (result.has(key)) continue;
    const senses = String(rawValue)
      .split(' / ')
      // 『』 は原データの強調記号。表示には不要なので落とす
      .map(s => s.replace(/[『』]/g, '').trim())
      .filter(Boolean)
      .slice(0, MAX_JAPANESE);
    if (senses.length === 0) continue;
    result.set(key, senses);
  }
  return result;
}

/**
 * irregular_verbs.json から 活用形 → 原形（ともに大文字）の Map を作る。
 * キーは "born, borne" のようにカンマ複合のことがある。
 * @param {Record<string, string>} obj
 * @returns {Map<string, string>}
 */
export function parseIrregularVerbs(obj) {
  const result = new Map();
  for (const [rawKey, rawValue] of Object.entries(obj)) {
    const base = String(rawValue).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(base)) continue;
    for (const part of String(rawKey).split(',')) {
      const form = part.trim().toUpperCase();
      if (!/^[A-Z]+$/.test(form)) continue;
      if (!result.has(form)) result.set(form, base);
    }
  }
  return result;
}
```

- [x] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/scripts/ejdict.test.ts`
Expected: PASS（6 件）

- [x] **Step 5: lint を確認する**

Run: `npx eslint .`
Expected: エラー 0、警告 0

- [x] **Step 6: コミット**

Run: `git add scripts/lib/ejdict.mjs tests/scripts/ejdict.test.ts`
Run: `git commit -m "feat: add ejdict bucket and irregular verb parsers"`

---

### Task 4: 原形解決

**Files:**
- Create: `scripts/lib/lemmatize.mjs`
- Test: `tests/scripts/lemmatize.test.ts`（新規）

WordNet の例外リスト（`*.exc`）は `wordnet-db` に**同梱されていない**（`npm pack` で確認済み）。そのため不規則動詞は ejdict の表、不規則名詞・形容詞は手書き表で補い、残りは接尾辞規則で剥がす。候補は必ず WordNet 見出し語 Set で検証するので、誤剥がし（`THIS → THI`）は自動的に棄却される。

- [x] **Step 1: 失敗するテストを書く**

`tests/scripts/lemmatize.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest';

const LEMMATIZE_PATH = '../../scripts/lib/lemmatize.mjs';

async function loadLemmatize(): Promise<{
  lemmatize: (
    word: string,
    knownLemmas: Set<string>,
    irregularVerbs?: Map<string, string>,
  ) => string | null;
}> {
  return await import(LEMMATIZE_PATH);
}

const KNOWN = new Set([
  'cat', 'city', 'hope', 'walk', 'go', 'run', 'mouse', 'bear',
  'bus', 'gas', 'box', 'church', 'dish', 'waltz', 'tall', 'large', 'child',
]);

const IRREGULAR_VERBS = new Map([
  ['WENT', 'GO'],
  ['RAN', 'RUN'],
  ['BORN', 'BEAR'],
  ['BORNE', 'BEAR'],
]);

describe('lemmatize', () => {
  it('原形そのものはそのまま返す', async () => {
    const { lemmatize } = await loadLemmatize();
    expect(lemmatize('CAT', KNOWN, IRREGULAR_VERBS)).toBe('CAT');
    expect(lemmatize('BUS', KNOWN, IRREGULAR_VERBS)).toBe('BUS');
  });

  it('不規則動詞を原形に戻す', async () => {
    const { lemmatize } = await loadLemmatize();
    expect(lemmatize('WENT', KNOWN, IRREGULAR_VERBS)).toBe('GO');
    expect(lemmatize('RAN', KNOWN, IRREGULAR_VERBS)).toBe('RUN');
    expect(lemmatize('BORN', KNOWN, IRREGULAR_VERBS)).toBe('BEAR');
    expect(lemmatize('BORNE', KNOWN, IRREGULAR_VERBS)).toBe('BEAR');
  });

  it('手書き表の不規則名詞を原形に戻す', async () => {
    const { lemmatize } = await loadLemmatize();
    expect(lemmatize('MICE', KNOWN, IRREGULAR_VERBS)).toBe('MOUSE');
    expect(lemmatize('CHILDREN', KNOWN, IRREGULAR_VERBS)).toBe('CHILD');
  });

  it('接尾辞規則で規則形を剥がす', async () => {
    const { lemmatize } = await loadLemmatize();
    expect(lemmatize('CATS', KNOWN, IRREGULAR_VERBS)).toBe('CAT');
    expect(lemmatize('CITIES', KNOWN, IRREGULAR_VERBS)).toBe('CITY');
    expect(lemmatize('HOPING', KNOWN, IRREGULAR_VERBS)).toBe('HOPE');
    expect(lemmatize('HOPED', KNOWN, IRREGULAR_VERBS)).toBe('HOPE');
    expect(lemmatize('WALKING', KNOWN, IRREGULAR_VERBS)).toBe('WALK');
    expect(lemmatize('WALKED', KNOWN, IRREGULAR_VERBS)).toBe('WALK');
    expect(lemmatize('GASES', KNOWN, IRREGULAR_VERBS)).toBe('GAS');
    expect(lemmatize('BOXES', KNOWN, IRREGULAR_VERBS)).toBe('BOX');
    expect(lemmatize('WALTZES', KNOWN, IRREGULAR_VERBS)).toBe('WALTZ');
    expect(lemmatize('CHURCHES', KNOWN, IRREGULAR_VERBS)).toBe('CHURCH');
    expect(lemmatize('DISHES', KNOWN, IRREGULAR_VERBS)).toBe('DISH');
    expect(lemmatize('TALLER', KNOWN, IRREGULAR_VERBS)).toBe('TALL');
    expect(lemmatize('TALLEST', KNOWN, IRREGULAR_VERBS)).toBe('TALL');
    expect(lemmatize('LARGER', KNOWN, IRREGULAR_VERBS)).toBe('LARGE');
    expect(lemmatize('LARGEST', KNOWN, IRREGULAR_VERBS)).toBe('LARGE');
  });

  it('Set に無い候補は採らない', async () => {
    const { lemmatize } = await loadLemmatize();
    // THIS → THI は Set に無いので棄却され、他に候補も無いので null
    expect(lemmatize('THIS', KNOWN, IRREGULAR_VERBS)).toBeNull();
    // 原形が Set に無ければ不規則表に載っていても採らない
    expect(lemmatize('MICE', new Set(['cat']), IRREGULAR_VERBS)).toBeNull();
  });

  it('英字以外を含む語は null', async () => {
    const { lemmatize } = await loadLemmatize();
    expect(lemmatize('CAT-DOG', KNOWN, IRREGULAR_VERBS)).toBeNull();
    expect(lemmatize('', KNOWN, IRREGULAR_VERBS)).toBeNull();
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run tests/scripts/lemmatize.test.ts`
Expected: FAIL（モジュールが存在しない）

- [x] **Step 3: 実装する**

`scripts/lib/lemmatize.mjs` を新規作成:

```javascript
// 屈折形を原形に解決する。ビルド時のみ使用する。
// wordnet-db は例外リスト（*.exc）を同梱していないため、
// 不規則動詞は ejdict の表、不規則名詞・形容詞は下の手書き表で補う。

/** 手書きの不規則名詞・形容詞表（spec §4.1） */
export const IRREGULAR_NOUNS = new Map([
  ['CHILDREN', 'CHILD'],
  ['MEN', 'MAN'],
  ['WOMEN', 'WOMAN'],
  ['MICE', 'MOUSE'],
  ['GEESE', 'GOOSE'],
  ['FEET', 'FOOT'],
  ['TEETH', 'TOOTH'],
  ['OXEN', 'OX'],
  ['PEOPLE', 'PERSON'],
  ['BETTER', 'GOOD'],
  ['BEST', 'GOOD'],
  ['WORSE', 'BAD'],
  ['WORST', 'BAD'],
  ['FARTHER', 'FAR'],
  ['FARTHEST', 'FAR'],
  ['FURTHER', 'FAR'],
  ['FURTHEST', 'FAR'],
  ['MORE', 'MUCH'],
  ['MOST', 'MUCH'],
  ['LESS', 'LITTLE'],
  ['LEAST', 'LITTLE'],
]);

/** 接尾辞剥がしの規則（spec §4.2）。上から順に試し、最初に Set に当たった候補を採る */
export const SUFFIX_RULES = [
  ['SES', 'S'],
  ['XES', 'X'],
  ['ZES', 'Z'],
  ['CHES', 'CH'],
  ['SHES', 'SH'],
  ['IES', 'Y'],
  ['S', ''],
  ['ED', 'E'],
  ['ED', ''],
  ['ING', 'E'],
  ['ING', ''],
  ['ER', ''],
  ['ER', 'E'],
  ['EST', ''],
  ['EST', 'E'],
];

/**
 * 語を原形に解決する。候補は必ず knownLemmas で検証するので誤剥がしは棄却される。
 * @param {string} word 大文字・小文字どちらでもよい
 * @param {Set<string>} knownLemmas WordNet の見出し語（小文字）
 * @param {Map<string, string>} [irregularVerbs] 活用形 → 原形（ともに大文字）
 * @returns {string | null} 大文字の原形。解決できなければ null
 */
export function lemmatize(word, knownLemmas, irregularVerbs) {
  const w = String(word).toUpperCase();
  if (!/^[A-Z]+$/.test(w)) return null;
  if (knownLemmas.has(w.toLowerCase())) return w;

  const fromVerb = irregularVerbs ? irregularVerbs.get(w) : undefined;
  if (fromVerb && knownLemmas.has(fromVerb.toLowerCase())) return fromVerb;

  const fromNoun = IRREGULAR_NOUNS.get(w);
  if (fromNoun && knownLemmas.has(fromNoun.toLowerCase())) return fromNoun;

  for (const [suffix, replacement] of SUFFIX_RULES) {
    if (!w.endsWith(suffix)) continue;
    const candidate = w.slice(0, w.length - suffix.length) + replacement;
    if (candidate.length < 2) continue;
    if (knownLemmas.has(candidate.toLowerCase())) return candidate;
  }
  return null;
}
```

- [x] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/scripts/lemmatize.test.ts`
Expected: PASS（6 件）

- [x] **Step 5: lint を確認する**

Run: `npx eslint .`
Expected: エラー 0、警告 0

- [x] **Step 6: コミット**

Run: `git add scripts/lib/lemmatize.mjs tests/scripts/lemmatize.test.ts`
Run: `git commit -m "feat: add lemmatizer resolving inflected words to base forms"`

---

### Task 5: バケット組み立てと生成スクリプト

**Files:**
- Create: `scripts/lib/buckets.mjs`
- Create: `scripts/build-defs.mjs`
- Test: `tests/scripts/buildDefs.test.ts`（新規）

**このタスクが本計画で最も間違えやすい。** spec §5 のサイズ最適化規則には穴がある:

- 屈折形 W の原形 L が**同じバケット**（先頭文字が同じ）にあるとき、W は `{ b: L }` だけを持つ。しかし見出しは `word-list` 由来なので、**L 自身が `word-list` に無いとバケットに L が存在せず、参照が宙に浮く**。そのため `{ b: L }` を書くときは `bucket[L]` の実体を**必ず同時に書き込む**。
- 屈折形 W の原形 L が**別バケット**（`WENT → GO`、`MICE → MOUSE`、`BETTER → GOOD`）にあるときは、ローダが追加 fetch できないので `b` に加えて `e` / `j` を**実体でコピーする**。

上書き衝突は起きない。`lemmatize` の戻り値は必ず `knownLemmas` で検証されているので、`{ b: … }` で書かれる語が別の語の原形になることはなく、逆に原形として書かれた語が `{ b: … }` で上書きされることもない。

- [x] **Step 1: 失敗するテストを書く**

`tests/scripts/buildDefs.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest';

const BUCKETS_PATH = '../../scripts/lib/buckets.mjs';

type Definition = { b?: string; e?: [string, string][]; j?: string[] };

async function loadBuckets(): Promise<{
  buildBuckets: (input: {
    words: string[];
    index: Record<string, Map<string, string>>;
    data: Record<string, Map<string, string>>;
    japanese: Map<string, string[]>;
    irregularVerbs: Map<string, string>;
    knownLemmas: Set<string>;
  }) => Map<string, Record<string, Definition>>;
}> {
  return await import(BUCKETS_PATH);
}

function fixture() {
  return {
    words: ['CAT', 'CATS', 'GO', 'WENT', 'ZZZZ', 'HOPE'],
    index: {
      n: new Map([['cat', 'n1']]),
      v: new Map([['go', 'v1']]),
      a: new Map<string, string>(),
      r: new Map<string, string>(),
    },
    data: {
      n: new Map([['n1', 'feline mammal']]),
      v: new Map([['v1', 'change location']]),
      a: new Map<string, string>(),
      r: new Map<string, string>(),
    },
    japanese: new Map([
      ['CAT', ['猫']],
      ['GO', ['行く']],
      ['HOPE', ['希望']],
    ]),
    irregularVerbs: new Map([['WENT', 'GO']]),
    knownLemmas: new Set(['cat', 'go', 'hope']),
  };
}

describe('buildBuckets', () => {
  it('原形の語は定義を実体で持つ', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets(fixture());
    expect(buckets.get('c')!.CAT).toEqual({ e: [['n', 'feline mammal']], j: ['猫'] });
  });

  it('同じバケット内の屈折形は原形への参照だけを持つ', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets(fixture());
    expect(buckets.get('c')!.CATS).toEqual({ b: 'CAT' });
  });

  it('バケットを跨ぐ屈折形は定義を実体でコピーする', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets(fixture());
    expect(buckets.get('w')!.WENT).toEqual({
      b: 'GO',
      e: [['v', 'change location']],
      j: ['行く'],
    });
  });

  it('原形が word-list に無くても参照先の実体を書き込む', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    // CAT を見出しから外しても、CATS の参照先が残ること
    input.words = ['CATS'];
    const buckets = buildBuckets(input);
    expect(buckets.get('c')!.CATS).toEqual({ b: 'CAT' });
    expect(buckets.get('c')!.CAT).toEqual({ e: [['n', 'feline mammal']], j: ['猫'] });
  });

  it('英英も和訳も無い語は載せない', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets(fixture());
    expect(buckets.get('z')).toBeUndefined();
  });

  it('和訳しか無い語も載せる', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets(fixture());
    expect(buckets.get('h')!.HOPE).toEqual({ j: ['希望'] });
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run tests/scripts/buildDefs.test.ts`
Expected: FAIL（モジュールが存在しない）

- [x] **Step 3: バケット組み立てを実装する**

`scripts/lib/buckets.mjs` を新規作成:

```javascript
// 見出し語リストと辞書データからバケット構造を組み立てる純関数。I/O は build-defs.mjs 側にある。

import { lemmatize } from './lemmatize.mjs';

/** 英英定義を並べる品詞順。n=名詞 v=動詞 a=形容詞 r=副詞 */
const POS_ORDER = ['n', 'v', 'a', 'r'];

/**
 * @param {object} input
 * @param {string[]} input.words 見出し候補（大文字化前でよい）
 * @param {Record<string, Map<string, string>>} input.index 品詞 → (見出し語 → offset)
 * @param {Record<string, Map<string, string>>} input.data 品詞 → (offset → 定義文)
 * @param {Map<string, string[]>} input.japanese 大文字見出し → 和訳
 * @param {Map<string, string>} input.irregularVerbs 活用形 → 原形
 * @param {Set<string>} input.knownLemmas WordNet 見出し語（小文字）
 * @returns {Map<string, Record<string, object>>} 先頭文字（小文字）→ バケット
 */
export function buildBuckets({ words, index, data, japanese, irregularVerbs, knownLemmas }) {
  const buckets = new Map();
  const entryCache = new Map();

  function bucketFor(letter) {
    let bucket = buckets.get(letter);
    if (!bucket) {
      bucket = {};
      buckets.set(letter, bucket);
    }
    return bucket;
  }

  /** 原形の定義本体。英英も和訳も無ければ null */
  function definitionOf(lemma) {
    if (entryCache.has(lemma)) return entryCache.get(lemma);
    const english = [];
    for (const pos of POS_ORDER) {
      const offset = index[pos].get(lemma.toLowerCase());
      if (!offset) continue;
      const gloss = data[pos].get(offset);
      if (!gloss) continue;
      english.push([pos, gloss]);
    }
    const japaneseSenses = japanese.get(lemma) ?? [];
    const entry =
      english.length === 0 && japaneseSenses.length === 0
        ? null
        : { e: english, j: japaneseSenses };
    entryCache.set(lemma, entry);
    return entry;
  }

  /** 空の配列はファイルサイズを食うだけなので落とす */
  function compact(entry, base) {
    const out = {};
    if (base) out.b = base;
    if (entry.e.length > 0) out.e = entry.e;
    if (entry.j.length > 0) out.j = entry.j;
    return out;
  }

  for (const raw of words) {
    const word = String(raw).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(word)) continue;
    const lemma = lemmatize(word, knownLemmas, irregularVerbs);
    if (!lemma) continue;
    const entry = definitionOf(lemma);
    if (!entry) continue;

    const bucket = bucketFor(word[0].toLowerCase());
    if (lemma === word) {
      bucket[word] = compact(entry);
    } else if (lemma[0] === word[0]) {
      // 原形が word-list に無いと参照が宙に浮くので、実体を必ず同時に書く
      bucket[lemma] = compact(entry);
      bucket[word] = { b: lemma };
    } else {
      // 別バケットの原形はローダが追加 fetch できないので実体をコピーする
      bucket[word] = compact(entry, lemma);
    }
  }
  return buckets;
}
```

- [x] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/scripts/buildDefs.test.ts`
Expected: PASS（6 件）

- [x] **Step 5: 生成スクリプトを書く**

`scripts/build-defs.mjs` を新規作成:

```javascript
#!/usr/bin/env node
// wordnet-db と ejdict から public/dict/defs/{a..z}.json を生成する
// 実行: npm run build:defs（build-dict.mjs の後に走らせること）
// 出力ファイルは .gitignore の public/dict/* で除外（生成物のため）

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseIndex, parseData } from './lib/wordnet.mjs';
import { parseEjdictBucket, parseIrregularVerbs } from './lib/ejdict.mjs';
import { buildBuckets } from './lib/buckets.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const wordnetDir = resolve(rootDir, 'node_modules/wordnet-db/dict');
const ejdictDir = resolve(rootDir, 'node_modules/ejdict/lib/data');
const outDir = resolve(rootDir, 'public/dict/defs');

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
/** 品詞コード → WordNet のファイル名 */
const POS_FILES = { n: 'noun', v: 'verb', a: 'adj', r: 'adv' };

const index = {};
const data = {};
for (const [pos, name] of Object.entries(POS_FILES)) {
  index[pos] = parseIndex(readFileSync(resolve(wordnetDir, `index.${name}`), 'utf8'));
  data[pos] = parseData(readFileSync(resolve(wordnetDir, `data.${name}`), 'utf8'));
}

const knownLemmas = new Set();
for (const pos of Object.keys(POS_FILES)) {
  for (const lemma of index[pos].keys()) knownLemmas.add(lemma);
}

const japanese = new Map();
for (const letter of LETTERS) {
  const path = resolve(ejdictDir, `dictionary/${letter}.json`);
  if (!existsSync(path)) continue;
  for (const [word, senses] of parseEjdictBucket(JSON.parse(readFileSync(path, 'utf8')))) {
    if (!japanese.has(word)) japanese.set(word, senses);
  }
}

const irregularVerbs = parseIrregularVerbs(
  JSON.parse(readFileSync(resolve(ejdictDir, 'irregular_verbs.json'), 'utf8')),
);

const words = readFileSync(resolve(rootDir, 'public/dict/twl06.txt'), 'utf8').split(/\r?\n/);
const buckets = buildBuckets({ words, index, data, japanese, irregularVerbs, knownLemmas });

mkdirSync(outDir, { recursive: true });
let totalEntries = 0;
let totalBytes = 0;
for (const letter of LETTERS) {
  const bucket = buckets.get(letter) ?? {};
  const json = JSON.stringify(bucket);
  writeFileSync(resolve(outDir, `${letter}.json`), json, 'utf8');
  totalEntries += Object.keys(bucket).length;
  // eslint-disable-next-line no-undef
  totalBytes += Buffer.byteLength(json);
}

// eslint-disable-next-line no-undef
console.log(
  `✓ wrote ${totalEntries.toLocaleString()} entries (${(totalBytes / 1e6).toFixed(1)} MB) to ${outDir}`,
);
```

- [x] **Step 6: 実際に生成して結果を確認する**

Run: `npm run build:dict`
Expected: `✓ wrote 274,137 words to …/public/dict/twl06.txt`

Run: `npm run build:defs`
Expected: `✓ wrote <N> entries (<X> MB) to …/public/dict/defs`

Run: `node -e "const b=require('./public/dict/defs/c.json'); console.log(JSON.stringify(b.CAT), JSON.stringify(b.CATS))"`
Expected: `CAT` が `e` と `j` を持ち、`CATS` が `{"b":"CAT"}` であること

Run: `node -e "const b=require('./public/dict/defs/w.json'); console.log(JSON.stringify(b.WENT))"`
Expected: `{"b":"GO","e":[["v", …]], "j":[…]}` — バケットを跨ぐので定義が実体で入っていること

出力された合計サイズを控えて Task 11 の README 更新で使う。

- [x] **Step 7: 全テストと lint とビルドを確認する**

Run: `npx vitest run`
Expected: 全 PASS

Run: `npx eslint .`
Expected: エラー 0、警告 0

Run: `npm run build`
Expected: 成功。`dist/dict/defs/a.json` 〜 `z.json` が生成される

- [x] **Step 8: コミット**

Run: `git add scripts/lib/buckets.mjs scripts/build-defs.mjs tests/scripts/buildDefs.test.ts`
Run: `git commit -m "feat: generate per-letter definition buckets from WordNet and ejdict"`

---

### Task 6: 実行時ローダ

**Files:**
- Create: `src/lookup/types.ts`
- Create: `src/lookup/dictLoader.ts`
- Test: `tests/lookup/dictLoader.test.ts`（新規）

- [x] **Step 1: 失敗するテストを書く**

`tests/lookup/dictLoader.test.ts` を新規作成:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createDictLoader } from '../../src/lookup/dictLoader';
import type { Bucket, FetchLike } from '../../src/lookup/types';

const C_BUCKET: Bucket = {
  CAT: { e: [['n', 'feline mammal']], j: ['猫'] },
  CATS: { b: 'CAT' },
  CROW: { b: 'CAWED' },
};

const W_BUCKET: Bucket = {
  WENT: { b: 'GO', e: [['v', 'change location']], j: ['行く'] },
};

function okFetch(buckets: Record<string, Bucket>): FetchLike {
  return vi.fn(async (url: string) => {
    const letter = url.slice(url.length - 6, url.length - 5);
    const bucket = buckets[letter];
    if (!bucket) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => bucket };
  });
}

describe('createDictLoader', () => {
  it('原形の語の定義を返す', async () => {
    const loader = createDictLoader(okFetch({ c: C_BUCKET }));
    const result = await loader.lookup('cat');
    expect(result).toEqual({
      kind: 'found',
      word: 'CAT',
      base: null,
      english: [['n', 'feline mammal']],
      japanese: ['猫'],
    });
  });

  it('b だけのエントリを同じバケット内で解決し、原形を併記する', async () => {
    const loader = createDictLoader(okFetch({ c: C_BUCKET }));
    const result = await loader.lookup('CATS');
    expect(result).toEqual({
      kind: 'found',
      word: 'CATS',
      base: 'CAT',
      english: [['n', 'feline mammal']],
      japanese: ['猫'],
    });
  });

  it('バケットを跨ぐ屈折形は追加 fetch なしで解決する', async () => {
    const fetchImpl = okFetch({ w: W_BUCKET });
    const loader = createDictLoader(fetchImpl);
    const result = await loader.lookup('WENT');
    expect(result).toEqual({
      kind: 'found',
      word: 'WENT',
      base: 'GO',
      english: [['v', 'change location']],
      japanese: ['行く'],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('バケットに無い語は not-found', async () => {
    const loader = createDictLoader(okFetch({ c: C_BUCKET }));
    expect(await loader.lookup('CZAR')).toEqual({ kind: 'not-found' });
  });

  it('参照先が欠けているエントリは not-found', async () => {
    const loader = createDictLoader(okFetch({ c: C_BUCKET }));
    expect(await loader.lookup('CROW')).toEqual({ kind: 'not-found' });
  });

  it('同じバケットへの並行 2 回を fetch 1 回にまとめる', async () => {
    const fetchImpl = okFetch({ c: C_BUCKET });
    const loader = createDictLoader(fetchImpl);
    const [a, b] = await Promise.all([loader.lookup('CAT'), loader.lookup('CATS')]);
    expect(a.kind).toBe('found');
    expect(b.kind).toBe('found');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('2 回目以降はキャッシュから返し fetch しない', async () => {
    const fetchImpl = okFetch({ c: C_BUCKET });
    const loader = createDictLoader(fetchImpl);
    await loader.lookup('CAT');
    await loader.lookup('CATS');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fetch 失敗時は例外を投げず error を返す', async () => {
    const loader = createDictLoader(okFetch({}));
    expect(await loader.lookup('CAT')).toEqual({ kind: 'error' });
  });

  it('失敗したバケットをキャッシュせず、再試行で成功できる', async () => {
    let succeed = false;
    const fetchImpl: FetchLike = vi.fn(async () => {
      if (!succeed) throw new Error('network down');
      return { ok: true, status: 200, json: async () => C_BUCKET };
    });
    const loader = createDictLoader(fetchImpl);
    expect(await loader.lookup('CAT')).toEqual({ kind: 'error' });
    succeed = true;
    const retried = await loader.lookup('CAT');
    expect(retried.kind).toBe('found');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('英字以外を含む語は fetch せず not-found', async () => {
    const fetchImpl = okFetch({ c: C_BUCKET });
    const loader = createDictLoader(fetchImpl);
    expect(await loader.lookup('')).toEqual({ kind: 'not-found' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run tests/lookup/dictLoader.test.ts`
Expected: FAIL（`Failed to resolve import "../../src/lookup/dictLoader"`）

- [x] **Step 3: 型を実装する**

`src/lookup/types.ts` を新規作成:

```typescript
/** WordNet の品詞コード。n=名詞 v=動詞 a=形容詞 r=副詞 */
export type Pos = 'n' | 'v' | 'a' | 'r';

/** 英英定義 1 件。[品詞, 定義文] */
export type EnglishSense = [Pos, string];

/** バケット JSON の 1 エントリ（spec §5） */
export type Definition = {
  /** 原形。語自身が原形なら持たない */
  b?: string;
  /** 英英定義 */
  e?: EnglishSense[];
  /** 和訳。最大 3 件 */
  j?: string[];
};

/** 先頭文字ごとのバケット。キーは大文字の語 */
export type Bucket = Record<string, Definition>;

/**
 * fetch の最小インターフェース。テストでモックを差し込むために型を自前で持つ
 * （グローバルの Response 型に依存すると eslint の no-undef を踏む）
 */
export type FetchLike = (
  url: string,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * 引きの結果。spec §7.3 が not-found と error を別状態として扱うため、
 * spec §6 の擬似コードの `Definition | null` ではなく判別共用体にする。
 */
export type LookupResult =
  | {
      kind: 'found';
      word: string;
      /** 原形が語と異なる場合のみ入る */
      base: string | null;
      english: EnglishSense[];
      japanese: string[];
    }
  | { kind: 'not-found' }
  | { kind: 'error' };
```

- [x] **Step 4: ローダを実装する**

`src/lookup/dictLoader.ts` を新規作成:

```typescript
import type { Bucket, Definition, FetchLike, LookupResult } from './types';

export type DictLoader = {
  lookup: (word: string) => Promise<LookupResult>;
};

/** e か j を実体で持つエントリを返す。b だけのエントリは同じバケット内で辿る（spec §6.1） */
function resolveEntry(bucket: Bucket, entry: Definition): Definition | null {
  if (entry.e?.length || entry.j?.length) return entry;
  if (!entry.b) return null;
  const base = bucket[entry.b];
  if (!base) return null;
  if (base.e?.length || base.j?.length) return base;
  return null;
}

export function createDictLoader(
  // eslint-disable-next-line no-undef
  fetchImpl: FetchLike = url => fetch(url),
): DictLoader {
  const cache = new Map<string, Bucket>();
  const inflight = new Map<string, Promise<Bucket>>();

  function loadBucket(letter: string): Promise<Bucket> {
    const cached = cache.get(letter);
    if (cached) return Promise.resolve(cached);
    const running = inflight.get(letter);
    if (running) return running;

    const request = (async () => {
      const res = await fetchImpl(`${import.meta.env.BASE_URL}dict/defs/${letter}.json`);
      if (!res.ok) throw new Error(`defs fetch failed: ${res.status}`);
      const bucket = (await res.json()) as Bucket;
      cache.set(letter, bucket);
      return bucket;
    })();

    // 失敗したバケットはキャッシュにも inflight にも残さない（spec §8）
    const tracked = request.finally(() => {
      inflight.delete(letter);
    });
    inflight.set(letter, tracked);
    return tracked;
  }

  async function lookup(word: string): Promise<LookupResult> {
    const target = word.trim().toUpperCase();
    if (!/^[A-Z]+$/.test(target)) return { kind: 'not-found' };

    let bucket: Bucket;
    try {
      bucket = await loadBucket(target[0].toLowerCase());
    } catch {
      // 辞書の失敗はゲームに伝播させない（spec §8）
      return { kind: 'error' };
    }

    const entry = bucket[target];
    if (!entry) return { kind: 'not-found' };
    const resolved = resolveEntry(bucket, entry);
    if (!resolved) return { kind: 'not-found' };

    return {
      kind: 'found',
      word: target,
      base: entry.b && entry.b !== target ? entry.b : null,
      english: resolved.e ?? [],
      japanese: resolved.j ?? [],
    };
  }

  return { lookup };
}
```

- [x] **Step 5: テストが通ることを確認する**

Run: `npx vitest run tests/lookup/dictLoader.test.ts`
Expected: PASS（10 件）

- [x] **Step 6: lint とビルドを確認する**

Run: `npx eslint .`
Expected: エラー 0、警告 0

Run: `npm run build`
Expected: 成功

- [x] **Step 7: コミット**

Run: `git add src/lookup/types.ts src/lookup/dictLoader.ts tests/lookup/dictLoader.test.ts`
Run: `git commit -m "feat: add lazy per-letter definition loader with inflight dedup"`

---

### Task 7: React フック

**Files:**
- Create: `src/lookup/useDefinition.ts`
- Test: `tests/lookup/useDefinition.test.tsx`（新規）

- [x] **Step 1: 失敗するテストを書く**

`tests/lookup/useDefinition.test.tsx` を新規作成:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDefinition } from '../../src/lookup/useDefinition';
import type { DictLoader } from '../../src/lookup/dictLoader';
import type { LookupResult } from '../../src/lookup/types';

const FOUND: LookupResult = {
  kind: 'found',
  word: 'CAT',
  base: null,
  english: [['n', 'feline mammal']],
  japanese: ['猫'],
};

function loaderOf(...results: LookupResult[]): DictLoader & { lookup: ReturnType<typeof vi.fn> } {
  let call = 0;
  const lookup = vi.fn(async () => results[Math.min(call++, results.length - 1)]);
  return { lookup };
}

describe('useDefinition', () => {
  it('最初は loading で、解決後に結果を返す', async () => {
    const loader = loaderOf(FOUND);
    const { result } = renderHook(() => useDefinition(loader, 'CAT'));
    expect(result.current.state).toEqual({ kind: 'loading' });
    await waitFor(() => expect(result.current.state).toEqual(FOUND));
  });

  it('not-found をそのまま渡す', async () => {
    const loader = loaderOf({ kind: 'not-found' });
    const { result } = renderHook(() => useDefinition(loader, 'ZZZZ'));
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'not-found' }));
  });

  it('retry で引き直す', async () => {
    const loader = loaderOf({ kind: 'error' }, FOUND);
    const { result } = renderHook(() => useDefinition(loader, 'CAT'));
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'error' }));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state).toEqual(FOUND));
    expect(loader.lookup).toHaveBeenCalledTimes(2);
  });

  it('語が変わったら引き直す', async () => {
    const loader = loaderOf(FOUND);
    const { result, rerender } = renderHook(({ word }) => useDefinition(loader, word), {
      initialProps: { word: 'CAT' },
    });
    await waitFor(() => expect(result.current.state.kind).toBe('found'));
    rerender({ word: 'DOG' });
    await waitFor(() => expect(loader.lookup).toHaveBeenCalledTimes(2));
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run tests/lookup/useDefinition.test.tsx`
Expected: FAIL（`Failed to resolve import "../../src/lookup/useDefinition"`）

- [x] **Step 3: 実装する**

`src/lookup/useDefinition.ts` を新規作成:

```typescript
import { useCallback, useEffect, useState } from 'react';
import type { DictLoader } from './dictLoader';
import type { LookupResult } from './types';

/** spec §7.3 の 4 状態。LookupResult に loading を足しただけ */
export type DefinitionState = { kind: 'loading' } | LookupResult;

/**
 * 語の定義を引く。loader.lookup は例外を投げない契約なので catch は要らない。
 */
export function useDefinition(
  loader: DictLoader,
  word: string,
): { state: DefinitionState; retry: () => void } {
  const [state, setState] = useState<DefinitionState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // 語を切り替えた直後に前の結果が届いても捨てる
    let cancelled = false;
    setState({ kind: 'loading' });
    loader.lookup(word).then(result => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [loader, word, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return { state, retry };
}
```

- [x] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/lookup/useDefinition.test.tsx`
Expected: PASS（4 件）

- [x] **Step 5: lint とビルドを確認する**

Run: `npx eslint .`
Expected: エラー 0、警告 0

Run: `npm run build`
Expected: 成功

- [x] **Step 6: コミット**

Run: `git add src/lookup/useDefinition.ts tests/lookup/useDefinition.test.tsx`
Run: `git commit -m "feat: add useDefinition hook with loading state and retry"`

---

### Task 8: DefinitionSheet

**Files:**
- Create: `src/ui/DefinitionSheet.tsx`
- Test: `tests/ui/DefinitionSheet.test.tsx`（新規）

既存の `src/ui/Sheet.tsx` をそのまま使う。シグネチャは `{ title, onDismiss, children }` で、モバイルではボトムシート、PC（769px〜）では中央モーダルになる。`Sheet` が `window` / `document` を使うので、テスト側でも `no-undef` の disable が要る箇所に注意する。

- [x] **Step 1: 失敗するテストを書く**

`tests/ui/DefinitionSheet.test.tsx` を新規作成:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DefinitionSheet } from '../../src/ui/DefinitionSheet';
import type { DictLoader } from '../../src/lookup/dictLoader';
import type { LookupResult } from '../../src/lookup/types';

function loaderOf(...results: LookupResult[]): DictLoader {
  let call = 0;
  return { lookup: vi.fn(async () => results[Math.min(call++, results.length - 1)]) };
}

const CAT: LookupResult = {
  kind: 'found',
  word: 'CAT',
  base: null,
  english: [
    ['n', 'feline mammal'],
    ['v', 'to flog with a cat-o-nine-tails'],
  ],
  japanese: ['猫', 'ネコ科の動物'],
};

const CATS: LookupResult = { ...CAT, word: 'CATS', base: 'CAT' };

describe('DefinitionSheet', () => {
  it('取得中はスケルトンを出す', () => {
    // 解決しない Promise で loading に留める
    const loader: DictLoader = { lookup: () => new Promise(() => {}) };
    render(<DefinitionSheet loader={loader} word="CAT" onDismiss={() => {}} />);
    expect(screen.getByTestId('definition-loading')).toBeInTheDocument();
  });

  it('英英と和訳を品詞ラベルつきで出す', async () => {
    render(<DefinitionSheet loader={loaderOf(CAT)} word="CAT" onDismiss={() => {}} />);
    expect(await screen.findByText('feline mammal')).toBeInTheDocument();
    expect(screen.getByText('n.')).toBeInTheDocument();
    expect(screen.getByText('v.')).toBeInTheDocument();
    expect(screen.getByText('猫')).toBeInTheDocument();
    expect(screen.getByText('ネコ科の動物')).toBeInTheDocument();
  });

  it('原形が異なるときは併記する', async () => {
    render(<DefinitionSheet loader={loaderOf(CATS)} word="CATS" onDismiss={() => {}} />);
    expect(await screen.findByText('CATS ← CAT')).toBeInTheDocument();
  });

  it('原形が同じときは併記しない', async () => {
    render(<DefinitionSheet loader={loaderOf(CAT)} word="CAT" onDismiss={() => {}} />);
    await screen.findByText('feline mammal');
    expect(screen.queryByText(/←/)).not.toBeInTheDocument();
  });

  it('未収録語のメッセージを出す', async () => {
    render(
      <DefinitionSheet loader={loaderOf({ kind: 'not-found' })} word="ZZZZ" onDismiss={() => {}} />,
    );
    expect(await screen.findByText('この単語の意味は収録されていません')).toBeInTheDocument();
  });

  it('失敗時はメッセージと再試行ボタンを出し、押すと引き直す', async () => {
    const user = userEvent.setup();
    const loader = loaderOf({ kind: 'error' }, CAT);
    render(<DefinitionSheet loader={loader} word="CAT" onDismiss={() => {}} />);
    expect(await screen.findByText('読み込みに失敗しました')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '再試行' }));
    await waitFor(() => expect(screen.getByText('feline mammal')).toBeInTheDocument());
  });

  it('シートのタイトルは単語そのもの', async () => {
    render(<DefinitionSheet loader={loaderOf(CAT)} word="CAT" onDismiss={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'CAT' })).toBeInTheDocument();
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run tests/ui/DefinitionSheet.test.tsx`
Expected: FAIL（`Failed to resolve import "../../src/ui/DefinitionSheet"`）

- [x] **Step 3: 実装する**

`src/ui/DefinitionSheet.tsx` を新規作成:

```tsx
import { Sheet } from './Sheet';
import { useDefinition } from '../lookup/useDefinition';
import type { DictLoader } from '../lookup/dictLoader';
import type { Pos } from '../lookup/types';

/** WordNet の品詞コードの表示ラベル */
const POS_LABEL: Record<Pos, string> = { n: 'n.', v: 'v.', a: 'adj.', r: 'adv.' };

export function DefinitionSheet({
  loader,
  word,
  onDismiss,
}: {
  loader: DictLoader;
  word: string;
  onDismiss: () => void;
}) {
  const { state, retry } = useDefinition(loader, word);

  return (
    <Sheet title={word} onDismiss={onDismiss}>
      <div className="font-pixel text-[10px] sm:text-xs text-stone-200 text-left space-y-3 max-w-xs">
        {state.kind === 'loading' && (
          <div data-testid="definition-loading" aria-busy="true" className="space-y-2">
            <div className="h-3 w-40 bg-stone-700 animate-pulse" />
            <div className="h-3 w-32 bg-stone-700 animate-pulse" />
          </div>
        )}

        {state.kind === 'not-found' && <p>この単語の意味は収録されていません</p>}

        {state.kind === 'error' && (
          <div className="space-y-2">
            <p>読み込みに失敗しました</p>
            <button
              type="button"
              onClick={retry}
              className="min-h-[44px] px-3 bg-stone-700 hover:bg-stone-600"
            >
              再試行
            </button>
          </div>
        )}

        {state.kind === 'found' && (
          <>
            {state.base && (
              <p className="text-stone-400">
                {state.word} ← {state.base}
              </p>
            )}
            {state.english.length > 0 && (
              <section>
                <h3 className="text-stone-400 mb-1">英英</h3>
                <ul className="space-y-1">
                  {state.english.map(([pos, gloss]) => (
                    <li key={pos}>
                      <span className="text-amber-300">{POS_LABEL[pos]}</span> {gloss}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {state.japanese.length > 0 && (
              <section>
                <h3 className="text-stone-400 mb-1">和訳</h3>
                <ul className="space-y-1">
                  {state.japanese.map(sense => (
                    <li key={sense}>{sense}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
```

- [x] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/ui/DefinitionSheet.test.tsx`
Expected: PASS（7 件）

- [x] **Step 5: lint とビルドを確認する**

Run: `npx eslint .`
Expected: エラー 0、警告 0。ここで `tests/ui/DefinitionSheet.test.tsx` に `no-undef` が出た場合は、その行の直前に `// eslint-disable-next-line no-undef` を足す

Run: `npm run build`
Expected: 成功

- [x] **Step 6: コミット**

Run: `git add src/ui/DefinitionSheet.tsx tests/ui/DefinitionSheet.test.tsx`
Run: `git commit -m "feat: add DefinitionSheet rendering loading, found, not-found and error states"`

---

### Task 9: WordChip

**Files:**
- Create: `src/ui/WordChip.tsx`
- Test: `tests/ui/WordChip.test.tsx`（新規）

`MoveRecord` は `src/game/types.ts` にある（`HistoryRecord` ではない）。形は次の通り:

```typescript
export type MoveRecord = {
  player: PlayerId;
  move: Move;
  wordsFormed: string[];
  score: number;
};
export type Move =
  | { kind: 'place'; placements: PendingPlacement[] }
  | { kind: 'exchange'; tileIndices: number[] }
  | { kind: 'pass' };
```

- [x] **Step 1: 失敗するテストを書く**

`tests/ui/WordChip.test.tsx` を新規作成:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WordChip, MoveWords } from '../../src/ui/WordChip';
import type { MoveRecord } from '../../src/game/types';

const PLACE: MoveRecord = {
  player: 'P1',
  move: { kind: 'place', placements: [] },
  wordsFormed: ['CAT', 'AT'],
  score: 12,
};

const PASS: MoveRecord = {
  player: 'P1',
  move: { kind: 'pass' },
  wordsFormed: [],
  score: 0,
};

const EXCHANGE: MoveRecord = {
  player: 'COM',
  move: { kind: 'exchange', tileIndices: [0, 1] },
  wordsFormed: [],
  score: 0,
};

describe('WordChip', () => {
  it('単語を読み上げ可能なボタンとして出す', () => {
    render(<WordChip word="CAT" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'CAT の意味を見る' })).toBeInTheDocument();
  });

  it('押すと単語つきでコールバックを呼ぶ', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<WordChip word="CAT" onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'CAT の意味を見る' }));
    expect(onSelect).toHaveBeenCalledWith('CAT');
  });
});

describe('MoveWords', () => {
  it('place の手は作った単語ぶんチップを出す', () => {
    render(<MoveWords record={PLACE} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'CAT の意味を見る' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AT の意味を見る' })).toBeInTheDocument();
  });

  it('pass の手にはチップを出さない', () => {
    const { container } = render(<MoveWords record={PASS} onSelect={() => {}} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('exchange の手にはチップを出さない', () => {
    const { container } = render(<MoveWords record={EXCHANGE} onSelect={() => {}} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
```

- [x] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run tests/ui/WordChip.test.tsx`
Expected: FAIL（`Failed to resolve import "../../src/ui/WordChip"`）

- [x] **Step 3: 実装する**

`src/ui/WordChip.tsx` を新規作成:

```tsx
import type { MoveRecord } from '../game/types';

/** 履歴内のタップできる単語。タッチターゲットは既存方針どおり最小 44px */
export function WordChip({
  word,
  onSelect,
}: {
  word: string;
  onSelect: (word: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${word} の意味を見る`}
      onClick={() => onSelect(word)}
      className="inline-flex items-center min-h-[44px] px-1 underline decoration-dotted underline-offset-2 hover:text-amber-300"
    >
      {word}
    </button>
  );
}

/** 1 手ぶんの単語チップ列。pass / exchange には単語が無いので何も出さない */
export function MoveWords({
  record,
  onSelect,
}: {
  record: MoveRecord;
  onSelect: (word: string) => void;
}) {
  if (record.move.kind !== 'place') return null;
  return (
    <>
      {record.wordsFormed.map((word, i) => (
        <span key={word}>
          {i > 0 && ' + '}
          <WordChip word={word} onSelect={onSelect} />
        </span>
      ))}
    </>
  );
}
```

- [x] **Step 4: テストが通ることを確認する**

Run: `npx vitest run tests/ui/WordChip.test.tsx`
Expected: PASS（5 件）

- [x] **Step 5: lint とビルドを確認する**

Run: `npx eslint .`
Expected: エラー 0、警告 0

Run: `npm run build`
Expected: 成功

- [x] **Step 6: コミット**

Run: `git add src/ui/WordChip.tsx tests/ui/WordChip.test.tsx`
Run: `git commit -m "feat: add tappable word chips for played moves"`

---

### Task 10: App への組み込み

**Files:**
- Modify: `src/App.tsx`（import 行、`GameShell` 冒頭、`isSheetOpen`、直前手ブロック 259-276、履歴の `<li>` 295-299、シートの描画）
- Test: `tests/ui/App.definition.test.tsx`（新規）

`src/App.tsx` は既にやや大きいが、足すのはシート開閉状態（`useState<string | null>`）とチップへの差し替えだけで、表示ロジックは `DefinitionSheet` 側に閉じている。

- [x] **Step 1: 失敗するテストを書く**

`tests/ui/App.definition.test.tsx` を新規作成。セットアップは既存の `tests/ui/App.layout.test.tsx` と同じ形（`useAiWorker` をモックし、`fetch` と `matchMedia` を stub し、`mode-free` から開始する）にそろえる:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/ai/useAiWorker', () => ({
  useAiWorker: () => ({ state: 'ready' as const, requestMove: vi.fn() }),
}));

import App from '../../src/App';

describe('App の辞書表示', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => 'CAT\nDOG\n' }));
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

  it('起動直後は辞書シートが開いていない', async () => {
    await startFreePlay();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('履歴が無いうちは単語チップが出ない', async () => {
    await startFreePlay();
    expect(screen.queryByRole('button', { name: / の意味を見る/ })).not.toBeInTheDocument();
  });

  it('辞書バケットを取りに行かない（単語をタップするまで fetch しない）', async () => {
    await startFreePlay();
    // eslint-disable-next-line no-undef
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.every(([url]: [string]) => !String(url).includes('dict/defs/'))).toBe(true);
  });
});
```

チップのクリック→シート表示は Task 8・9 で単体検証済みなので、ここでは App 側の配線が壊れていないこと（回帰）と、辞書が遅延読み込みであることだけを見る。

- [x] **Step 2: テストが通ることを確認する**

Run: `npx vitest run tests/ui/App.definition.test.tsx`
Expected: PASS（3 件）。この 3 件は組み込み前でも通る回帰テストで、Step 3 以降の変更で壊れないことを守るためにある。ここで FAIL する場合は、先にセットアップを `tests/ui/App.layout.test.tsx` に合わせ直すこと。

- [x] **Step 3: import と状態を足す**

`src/App.tsx` の import 群（1-17 行）の末尾に足す:

```typescript
import { createDictLoader } from './lookup/dictLoader';
import { DefinitionSheet } from './ui/DefinitionSheet';
import { MoveWords } from './ui/WordChip';
```

1 行目の `import { useEffect, useRef, useState } from 'react';` を次に変える:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';
```

`GameShell` の中、`const [showExchange, setShowExchange] = useState(false);` の直後に足す:

```typescript
  // 辞書ローダはバケットのキャッシュを持つので 1 回だけ作る
  const dictLoader = useMemo(() => createDictLoader(), []);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
```

- [x] **Step 4: Escape の抑止対象にシートを足す**

`src/App.tsx` の次の行を探す:

```typescript
  const isSheetOpen = pendingBlank !== null || showExchange;
```

次に置き換える:

```typescript
  const isSheetOpen = pendingBlank !== null || showExchange || selectedWord !== null;
```

- [x] **Step 5: 直前手の単語をチップにする**

`src/App.tsx` の直前手ブロック（`const last = state.history[state.history.length - 1];` で始まる IIFE、現状 259-276 行）を次に置き換える:

```tsx
        {(() => {
          const last = state.history[state.history.length - 1];
          if (!last) return null;
          const playerLabel = last.player === 'COM' ? '🤖 COM' : '👤 P1';
          return (
            <div className="font-pixel text-[10px] sm:text-xs text-stone-300">
              直前手: {playerLabel}:{' '}
              {last.move.kind === 'place' ? (
                <>
                  <MoveWords record={last} onSelect={setSelectedWord} /> +{last.score}
                </>
              ) : last.move.kind === 'pass' ? (
                'PASS'
              ) : (
                `EXCHANGE (${last.move.tileIndices.length} 枚)`
              )}
            </div>
          );
        })()}
```

- [x] **Step 6: 履歴の単語をチップにする**

`src/App.tsx` の履歴 `<ol>` 内の `map` コールバック（現状 284-300 行）を次に置き換える:

```tsx
              {state.history.slice(-8).reverse().map((rec, i) => {
                const num = state.history.length - i;
                const playerLabel = rec.player === 'COM' ? '🤖' : '👤';
                return (
                  <li key={num}>
                    {num}. {playerLabel}{' '}
                    {rec.move.kind === 'place' ? (
                      <>
                        <MoveWords record={rec} onSelect={setSelectedWord} /> +{rec.score}
                      </>
                    ) : rec.move.kind === 'pass' ? (
                      'PASS'
                    ) : (
                      `EXCHANGE (${rec.move.tileIndices.length})`
                    )}
                  </li>
                );
              })}
```

- [x] **Step 7: シートを描画する**

既存の `BlankLetterModal` / `ExchangeModal` を描画している箇所の隣に足す:

```tsx
        {selectedWord && (
          <DefinitionSheet
            loader={dictLoader}
            word={selectedWord}
            onDismiss={() => setSelectedWord(null)}
          />
        )}
```

- [x] **Step 8: 全テストを通す**

Run: `npx vitest run`
Expected: 全 PASS。直前手や履歴の文字列を検査している既存テストがあると、チップ化でテキストノードが分割されて落ちる可能性がある。落ちた場合は、テスト側を `getByRole('button', { name: '<単語> の意味を見る' })` に直す。**アサーションの意図を弱めないこと**（例: 存在確認を削除して通すのは不可）。

- [x] **Step 9: lint とビルドを確認する**

Run: `npx eslint .`
Expected: エラー 0、警告 0

Run: `npm run build`
Expected: 成功

- [x] **Step 10: コミット**

Run: `git add src/App.tsx tests/ui/App.definition.test.tsx`
Run: `git commit -m "feat: open definition sheet from word chips in move history"`

---

### Task 11: README と最終検証

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-09-plan-3-dictionary.md`（チェックボックスを埋める）

- [x] **Step 1: README を更新する**

`README.md` の 5 行目:

```
英英・英和辞書表示（Plan 3）は後続計画で実装します。モバイル対応と GitHub Pages デプロイ（Plan 4）は実装済みです。
```

を次に置き換える:

```
英英・英和辞書表示（Plan 3）、モバイル対応と GitHub Pages デプロイ（Plan 4）も実装済みです。
```

`## Plan 1 の制限事項` の 2 つ目の項目:

```
- 単語の意味表示（英英・英和辞書）は未実装 → Plan 3 で導入予定
```

を削除する。

`## 遊び方（Plan 1 時点）` の手順 8 の後に足す:

```
9. 「直前手」と「履歴」に出る単語をタップすると、英英定義（品詞ごとに 1 件）と和訳（最大 3 件）が表示されます
```

`## 変更履歴` の先頭に足す（Task 5 Step 6 で控えた実測値を `<N>` と `<X>` に入れる）:

```
- **2026-09-09** Plan 3 完了: 履歴の単語から英英・英和辞書を引けるようにした。定義は WordNet 3.1 と ejdict からビルド時に生成し（<N> 語 / 計 <X> MB）、先頭文字ごとの JSON を遅延読み込みする。
```

`## デプロイ` 節の末尾（`辞書ファイル public/dict/twl06.txt は …` の段落の後）に足す:

```
定義ファイル `public/dict/defs/{a..z}.json` も `.gitignore` 済みですが、同じく `prebuild` が `wordnet-db` と `ejdict` から毎回生成します。
```

- [x] **Step 2: 完了条件を機械的に検証する**

Run: `npx vitest run`
Expected: 全 PASS

Run: `npx eslint .`
Expected: エラー 0、警告 0

Run: `npm run build`
Expected: 成功

Run: `node -e "const fs=require('fs');const n=fs.readdirSync('dist/dict/defs');console.log(n.length, n.slice(0,3).join(','))"`
Expected: `26 a.json,b.json,c.json`

- [x] **Step 3: 完了条件を手で検証する**

Run: `npm run dev`（バックグラウンド実行）

ブラウザで `http://localhost:5173/toy-scrabble/` を開き、次を確認する:

1. `FREE PLAY` で開始し、1 手置いて `PLAY` する
2. 「直前手」に出た単語をタップするとシートが開き、英英定義と和訳が出る
3. `CATS` のような屈折形を作れた場合、`CATS ← CAT` の併記が出る
4. シートを閉じてから開き直すと、`loading` がほぼ一瞬で終わる（バケットがキャッシュ済み）
5. DevTools の Network で `dict/defs/*.json` をブロックしてから単語をタップすると、「読み込みに失敗しました」と再試行ボタンが出るだけで、**盤面の操作は続けられる**
6. 幅 375px にして、チップがタップしやすく、シートが下から出ることを確認する

`npm run dev` を停止する。

- [x] **Step 4: 計画のチェックボックスを埋める**

`docs/superpowers/plans/2026-09-09-plan-3-dictionary.md` の `- [ ]` を全て `- [x]` にする。

- [x] **Step 5: コミット**

Run: `git add README.md docs/superpowers/plans/2026-09-09-plan-3-dictionary.md`
Run: `git commit -m "docs: record Plan 3 dictionary lookup completion in README"`

---

## 完了条件（spec §11）

- `npx vitest run` が全て PASS
- `npx eslint .` がエラー 0 かつ警告 0
- `npm run build` が成功し、`dist/dict/defs/{a..z}.json` が 26 個生成される
- 対局中に単語チップをタップすると、英英定義と和訳が表示される
- `CATS` をタップすると `CAT` の定義が原形併記つきで表示される
- `WENT` をタップすると `GO` の定義が表示される（バケット跨ぎ、追加 fetch なし）
- 辞書ファイルを 404 にしても、エラー表示が出るだけでゲームは継続できる
