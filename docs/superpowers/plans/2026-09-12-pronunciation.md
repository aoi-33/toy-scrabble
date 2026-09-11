# 発音記号（IPA）表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 定義シートの見出し下に IPA 発音記号を 1 行表示する。UK/US のタグが両方あれば両方、無ければタグ無しの表記を 1 件。屈折形に発音が無ければ原形の発音で代用する。

**Architecture:** 既存の Wiktionary パイプライン（kaikki.org JSONL → `data/wiktionary.json` → `public/dict/defs/{a..z}.json`）に `p` キーを 1 本通す。新しいファイルもネットワーク往復も増やさない。バケット跨ぎの原形はローダが追加 fetch できないため、既存の `e`/`j` と同じくビルド時にコピーする。

**Tech Stack:** Node.js 22（mise 管理）/ Vite 5 / React 18 / TypeScript strict / Vitest 2 + @testing-library/react 16 / Tailwind 3.4

---

## 前提知識（この節を読まないと詰まる）

**コメント・ドキュメントは日本語で書く。** 変数名・関数名は英語。これはワークスペース全体のルール。

**コマンドの注意:**

- `npm run lint` はこの環境で拒否される。**`npx eslint .` を使う**（リポジトリ全体を対象にすること）
- `npm run test` は `vitest run` のエイリアス。単一ファイルは `npx vitest run tests/path/file.test.ts`
- コミットメッセージは**1 行のみ**。`Co-Authored-By` などのトレーラを付けない
- `git push` はしない。ローカルコミットまでで止める

**`tsconfig.app.json` の `include` は `["src", "tests"]`。テストファイルも `tsc -b` の型検査対象。**
`LookupResult` に必須フィールドを足すと、テスト内の `LookupResult` 型リテラルも同時に直さないと `npm run build` が壊れる。Vitest は esbuild で型を無視して走るため、**テストが緑でもビルドが赤になりうる**。Task 4 では必ず `npx tsc -b` を回す。

**`scripts/lib/buckets.mjs` にはバケットへの書き込み経路が 3 つある**（`buildBuckets` のループ末尾）:

1. 語が自分の定義本体を持つ → `bucketFor(...)[word] = compact(own, base)`
2. 原形が同じ頭文字 → `bucket[base] = compact(body)` と `bucket[word] = { b: base }` の 2 件を書く
3. 原形が別の頭文字 → `bucket[word] = compact(body, base)` で**定義本体をコピーする**

3 の理由は、ローダが `lookup` 中に別バケットを追加 fetch しない設計だから（`WENT` は `w.json` にあり `GO` は `g.json` にある）。発音も同じ制約を受けるので、同じ扱いをする。

**既存テストの多くが `toEqual` で完全一致を見ている。** 共有フィクスチャ `fixture()` に手を入れると 5 個以上の既存テストが巻き添えで落ちる。この計画では**共有フィクスチャを変更せず**、各テスト内で `fixture()` の戻り値をローカルに拡張する（既存テストが `input.words = [...input.words, 'ARGANS']` としているのと同じ流儀）。

---

## File Structure

| ファイル | 役割 | 変更内容 |
|---|---|---|
| `scripts/lib/wiktionary.mjs` | kaikki JSONL の 1 行 → 中間形式（純関数） | `ipaOf()` 追加、`extractEntry()` の戻り値に `ipa` |
| `scripts/build-wiktionary.mjs` | JSONL を流して `data/wiktionary.json` を書く | `emptyRecord`/`absorb`/出力組み立てに `p` |
| `scripts/lib/buckets.mjs` | 辞書 3 種 → バケット構造（純関数） | `ipaFor()` 追加、`compact()` に第 3 引数 |
| `src/lookup/types.ts` | 辞書まわりの型 | `Accent` / `Pronunciation` 追加、`Definition.p`、`LookupResult.pronunciation` |
| `src/lookup/dictLoader.ts` | バケット取得と語の解決 | `lookup()` が `pronunciation` を返す |
| `src/ui/DefinitionSheet.tsx` | 定義シートの描画 | 発音行を追加 |
| `README.md` / `docs/design.md` / `src/ui/AboutSheet.tsx` | ドキュメントとライセンス表示 | 変更点の追記 |

`src/lookup/useDefinition.ts` は**変更不要**。`LookupResult` をそのまま流しているだけなので新フィールドは自動的に届く。

---

## Task 1: kaikki JSONL から IPA を取り出す

**Files:**
- Modify: `scripts/lib/wiktionary.mjs`
- Test: `tests/scripts/wiktionary.test.ts`

- [ ] **Step 1: 既存テストの型と期待値を新しい戻り値に合わせる**

`extractEntry` の戻り値に `ipa` が増えるので、完全一致で見ている既存の 4 テストが落ちる。先にここを直す。

`tests/scripts/wiktionary.test.ts` の 5〜12 行目、`Extracted` 型に `ipa` を足す:

```ts
type Extracted = {
  word: string;
  raw: string;
  pos: string;
  gloss: string | null;
  base: string | null;
  japanese: string[];
  ipa: [string, string][];
};
```

続いて、`toEqual` で完全一致を見ている 4 箇所すべてに `ipa: []` を足す。

1 つ目（`'名詞の語義を取り出して見出しを大文字化する'`）:

```ts
    ).toEqual({
      word: 'CAT',
      raw: 'cat',
      pos: 'n',
      gloss: 'A domesticated feline animal.',
      base: null,
      japanese: [],
      ipa: [],
    });
```

2 つ目（`'屈折形は原形を返し語義を持たない'`）:

```ts
    ).toEqual({ word: 'CATS', raw: 'cats', pos: 'n', gloss: null, base: 'CAT', japanese: [], ipa: [] });
```

3 つ目（`'屈折形の語義と独自の語義が並ぶときは独自の語義を使う'`）:

```ts
    ).toEqual({
      word: 'FOUNDING',
      raw: 'founding',
      pos: 'n',
      gloss: 'The act of establishing something.',
      base: 'FOUND',
      japanese: [],
      ipa: [],
    });
```

4 つ目（`'原形が見出しと同じなら参照を張らない'` の後半）:

```ts
    ).toEqual({
      word: 'READ',
      raw: 'read',
      pos: 'v',
      gloss: 'To interpret written symbols.',
      base: null,
      japanese: [],
      ipa: [],
    });
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/scripts/wiktionary.test.ts` の `describe('extractEntry', ...)` の末尾、`'語義も原形も和訳も無いエントリは捨てる'` の後に追記する。

```ts
  // 学習者に見せるのは音素表記 /.../。[...] は異音まで書いた狭い表記で細かすぎる
  it('UK と US のタグが両方あれば両方拾う', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'hello',
      pos: 'intj',
      lang_code: 'en',
      senses: [{ glosses: ['A greeting.'] }],
      sounds: [
        { ipa: '/həˈləʊ/', tags: ['Received-Pronunciation'] },
        { ipa: '/hɛˈloʊ/', tags: ['General-American'] },
        { ipa: '[hɛˈɫoʊ]' },
        { ogg_url: 'https://example.invalid/hello.ogg' },
      ],
    });
    expect(entry?.ipa).toEqual([
      ['uk', '/həˈləʊ/'],
      ['us', '/hɛˈloʊ/'],
    ]);
  });

  // タグ無しの /.../ が多数派。落とすと収録率が 20.9% から 6.3% まで下がる
  it('タグが無ければ x として 1 件だけ拾う', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'cats',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['plural of cat'], form_of: [{ word: 'cat' }] }],
      sounds: [{ ipa: '/kæts/' }, { ipa: '/kats/' }],
    });
    expect(entry?.ipa).toEqual([['x', '/kæts/']]);
  });

  it('片方のタグしか無ければその 1 件を返す', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'argan',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['A Moroccan tree.'] }],
      sounds: [{ ipa: '/ˈɑː(ɹ)ɡən/', tags: ['Received-Pronunciation'] }],
    });
    expect(entry?.ipa).toEqual([['uk', '/ˈɑː(ɹ)ɡən/']]);
  });

  it('狭い音声表記 [...] しか無ければ空にする', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'cat',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['feline'] }],
      sounds: [{ ipa: '[kʰæt]' }, { enpr: 'kăt' }],
    });
    expect(entry?.ipa).toEqual([]);
  });

  it('sounds が無ければ空にする', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'cat',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['feline'] }],
    });
    expect(entry?.ipa).toEqual([]);
  });

  // 発音だけの語を通すと「意味は出ないが発音はある語」が混ざり、
  // build-defs.mjs が担保している「遊べる語の定義収録率 100%」と噛み合わなくなる
  it('発音しか無いエントリは捨てる', async () => {
    const { extractEntry } = await loadWiktionary();
    expect(
      extractEntry({
        word: 'zyme',
        pos: 'noun',
        lang_code: 'en',
        senses: [],
        sounds: [{ ipa: '/zaɪm/' }],
      }),
    ).toBeNull();
  });
```

- [ ] **Step 3: テストを走らせて失敗を確認する**

Run: `npx vitest run tests/scripts/wiktionary.test.ts`

Expected: FAIL。新しい 6 テストが `expected undefined to deeply equal [ ... ]` で落ちる（`entry.ipa` がまだ存在しない）。Step 1 で直した 4 テストも `ipa: []` が無いので落ちる。

- [ ] **Step 4: `ipaOf` を実装して `extractEntry` に組み込む**

`scripts/lib/wiktionary.mjs` の `japaneseOf` 関数（51〜60 行目）の直後、`extractEntry` の JSDoc の前に追加する。

```js
/**
 * 発音記号。音素表記 /.../ だけ拾う。[...] は異音まで書いた狭い表記で学習者には細かすぎる。
 * タグ付きの UK/US が両方あれば両方、片方だけならその 1 件、
 * どちらも無ければタグ無しの先頭 1 件を x として返す。
 */
function ipaOf(sounds) {
  let uk = null;
  let us = null;
  let any = null;
  for (const s of sounds) {
    if (typeof s.ipa !== 'string' || !s.ipa.startsWith('/')) continue;
    const tags = s.tags ?? [];
    if (!uk && tags.includes('Received-Pronunciation')) uk = s.ipa;
    else if (!us && tags.includes('General-American')) us = s.ipa;
    else if (!any) any = s.ipa;
  }
  if (uk && us) return [['uk', uk], ['us', us]];
  if (uk) return [['uk', uk]];
  if (us) return [['us', us]];
  return any ? [['x', any]] : [];
}
```

続いて `extractEntry` の JSDoc の `@returns` を差し替える。

```js
/**
 * @param {any} obj kaikki.org の 1 行を JSON.parse したもの
 * @returns {{word: string, raw: string, pos: string, gloss: string|null, base: string|null, japanese: string[], ipa: [string, string][]}|null}
 */
```

最後に `extractEntry` の本体末尾（77〜81 行目）を差し替える。**早期 return の条件は変えない。**

```js
  const gloss = glossOf(senses);
  const japanese = japaneseOf(Array.isArray(obj.translations) ? obj.translations : []);
  const ipa = ipaOf(Array.isArray(obj.sounds) ? obj.sounds : []);

  // 発音だけの語は通さない。意味を出せない語を辞書に残さないため（ipa は条件に入れない）
  if (gloss === null && base === null && japanese.length === 0) return null;
  return { word, raw: obj.word, pos, gloss, base, japanese, ipa };
```

- [ ] **Step 5: テストを走らせて通ることを確認する**

Run: `npx vitest run tests/scripts/wiktionary.test.ts`

Expected: PASS（19 tests。既存 13 + 新規 6）

- [ ] **Step 6: lint を通す**

Run: `npx eslint .`

Expected: 出力なし（`No issues found`）

- [ ] **Step 7: コミット**

```bash
git add scripts/lib/wiktionary.mjs tests/scripts/wiktionary.test.ts
git commit -m "feat: kaikki の sounds から IPA 発音記号を抽出する"
```

---

## Task 2: `data/wiktionary.json` に `p` を書き出す

**Files:**
- Modify: `scripts/build-wiktionary.mjs`
- Create（一時ファイル、コミットしない）: `/tmp/ipa-fixture.jsonl`

このスクリプトはトップレベル `await` を持つ実行スクリプトで、import すると全体が走ってしまうため単体テストできない。代わりに小さな JSONL を食わせるスモークテストで確かめる。

**`data/wiktionary.json`（15 MB、コミット済み）を一時的に上書きするので、先にバックアップを取ること。**

- [ ] **Step 1: 本物の `data/wiktionary.json` を退避する**

```bash
cp data/wiktionary.json /tmp/wiktionary.backup.json
ls -la /tmp/wiktionary.backup.json
```

Expected: 15,000,000 バイト前後のファイルが表示される

- [ ] **Step 2: スモークテスト用の JSONL を作る**

`/tmp/ipa-fixture.jsonl` を Write ツールで作成する（2 行、各行 1 JSON）。
`hello` と `cats` はどちらも `public/dict/words.txt` に入っているので `wanted` フィルタを通る。

```
{"word":"hello","pos":"intj","lang_code":"en","senses":[{"glosses":["A greeting."]}],"sounds":[{"ipa":"/həˈləʊ/","tags":["Received-Pronunciation"]},{"ipa":"/hɛˈloʊ/","tags":["General-American"]},{"ipa":"[hɛˈɫoʊ]"}]}
{"word":"cats","pos":"noun","lang_code":"en","senses":[{"glosses":["plural of cat"],"form_of":[{"word":"cat"}]}],"sounds":[{"ipa":"/kæts/"}]}
```

- [ ] **Step 3: 現状のスクリプトを走らせて `p` が出ないことを確認する**

Run: `npm run build:wiktionary -- /tmp/ipa-fixture.jsonl`

その後:

```bash
node -e "const o=require('./data/wiktionary.json');console.log(JSON.stringify(o))"
```

Expected: `{"HELLO":{"e":[["intj","A greeting."]]},"CATS":{"b":"CAT"}}` のように `p` が**含まれていない**

- [ ] **Step 4: `p` を通す**

`scripts/build-wiktionary.mjs` の `emptyRecord`（33〜35 行目）を差し替える。

```js
function emptyRecord() {
  return { e: [], b: null, j: [], p: [] };
}
```

`absorb`（37〜44 行目）の末尾に 1 行足す。

```js
function absorb(record, entry) {
  // 同じ品詞が複数行に分かれることがある。最初の語義だけ残す
  if (entry.gloss !== null && !record.e.some(([pos]) => pos === entry.pos)) {
    record.e.push([entry.pos, entry.gloss]);
  }
  if (record.b === null && entry.base !== null) record.b = entry.base;
  for (const ja of entry.japanese) if (!record.j.includes(ja)) record.j.push(ja);
  // 同じ語の品詞違いで発音が割れることはほぼ無いので先勝ちで足りる
  if (record.p.length === 0 && entry.ipa.length > 0) record.p = entry.ipa;
}
```

出力の組み立て（79〜85 行目）の `value.b` の行の直後に 1 行足す。

```js
  const value = {};
  if (record.e.length > 0) value.e = record.e;
  if (record.b !== null) value.b = record.b;
  if (record.p.length > 0) value.p = record.p;
  // 和訳はどちらの見出しから来ても使える
  const japanese = [...new Set([...group.lower.j, ...group.upper.j])];
  if (japanese.length > 0) value.j = japanese;
  if (Object.keys(value).length > 0) out[word] = value;
```

`record` を `group.lower` / `group.upper` から選ぶ既存ロジック（77 行目）は変えない。
発音は選ばれた側のものだけを使う。和訳のような両者マージはしない — 略語見出しの発音が普通語に混ざるのを避けるため。

- [ ] **Step 5: スモークテストを走らせて `p` が出ることを確認する**

Run: `npm run build:wiktionary -- /tmp/ipa-fixture.jsonl`

その後:

```bash
node -e "const o=require('./data/wiktionary.json');console.log(JSON.stringify(o))"
```

Expected: `{"HELLO":{"e":[["intj","A greeting."]],"p":[["uk","/həˈləʊ/"],["us","/hɛˈloʊ/"]]},"CATS":{"b":"CAT","p":[["x","/kæts/"]]}}`

`HELLO` に UK/US が両方、`CATS` に `x` が 1 件入っていること。`[hɛˈɫoʊ]` が捨てられていること。

- [ ] **Step 6: 本物の `data/wiktionary.json` を戻す**

```bash
cp /tmp/wiktionary.backup.json data/wiktionary.json
git status --short data/wiktionary.json
```

Expected: `git status` の出力が空（退避前と同一に戻っている）

Task 6 で 3.1 GB の本データから作り直すので、ここでは元に戻すだけでよい。

- [ ] **Step 7: lint を通す**

Run: `npx eslint .`

Expected: 出力なし

- [ ] **Step 8: コミット**

```bash
git add scripts/build-wiktionary.mjs
git commit -m "feat: data/wiktionary.json に発音記号を書き出す"
```

---

## Task 3: バケットに `p` を載せる

**Files:**
- Modify: `scripts/lib/buckets.mjs`
- Test: `tests/scripts/buildDefs.test.ts`

**共有フィクスチャ `fixture()` は変更しない。** 変更すると `toEqual` で完全一致を見ている既存テストが 5 個以上落ちる。各テスト内でローカルに拡張する。

- [ ] **Step 1: テストの `Definition` 型に `p` を足す**

`tests/scripts/buildDefs.test.ts` の 5 行目を差し替える。

```ts
type Definition = {
  b?: string;
  e?: [string, string][];
  j?: string[];
  p?: ['uk' | 'us' | 'x', string][];
};
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/scripts/buildDefs.test.ts` の `describe('buildBuckets', ...)` の末尾、`'Wiktionary を渡さなくても動く'` の後に追記する。

```ts
  it('語が自分の発音を持つならバケットに載せる', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    input.words = [...input.words, 'ARGAN'];
    input.wiktionary.set('ARGAN', {
      e: [['n', 'A Moroccan tree.']],
      p: [['x', '/ˈɑː(ɹ)ɡən/']],
    });
    const buckets = buildBuckets(input);
    expect(buckets.get('a')!.ARGAN).toEqual({
      e: [['n', 'A Moroccan tree.']],
      p: [['x', '/ˈɑː(ɹ)ɡən/']],
    });
  });

  // 屈折形は原形と発音が違う（ARGAN と ARGANS）。自分のものがあるなら原形で上書きしない
  it('同じバケット内の屈折形は自分の発音を持つ', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    input.words = [...input.words, 'ARGANS'];
    input.wiktionary.set('ARGAN', {
      e: [['n', 'A Moroccan tree.']],
      p: [['x', '/ˈɑː(ɹ)ɡən/']],
    });
    input.wiktionary.set('ARGANS', { b: 'ARGAN', p: [['x', '/ˈɑː(ɹ)ɡənz/']] });
    const buckets = buildBuckets(input);
    expect(buckets.get('a')!.ARGANS).toEqual({ b: 'ARGAN', p: [['x', '/ˈɑː(ɹ)ɡənz/']] });
    expect(buckets.get('a')!.ARGAN).toEqual({
      e: [['n', 'A Moroccan tree.']],
      p: [['x', '/ˈɑː(ɹ)ɡən/']],
    });
  });

  // 同じバケットならローダが実行時に原形をたどれるので、コピーして重複させない
  it('同じバケット内なら原形の発音をコピーしない', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    input.words = [...input.words, 'ARGANS'];
    input.wiktionary.set('ARGAN', {
      e: [['n', 'A Moroccan tree.']],
      p: [['x', '/ˈɑː(ɹ)ɡən/']],
    });
    const buckets = buildBuckets(input);
    expect(buckets.get('a')!.ARGANS).toEqual({ b: 'ARGAN' });
  });

  // ローダは lookup 中に別バケットを追加 fetch しない。WENT は w.json、GO は g.json
  it('バケットを跨ぐ屈折形には原形の発音をコピーする', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    input.wiktionary.set('GO', { p: [['x', '/ɡəʊ/']] });
    const buckets = buildBuckets(input);
    expect(buckets.get('w')!.WENT).toEqual({
      b: 'GO',
      e: [['v', 'change location']],
      j: ['行く'],
      p: [['x', '/ɡəʊ/']],
    });
  });

  // 発音だけの語を載せると playableWords が「意味の出ない語」を遊べる語として残してしまう
  it('発音しか無い語はバケットに載せない', async () => {
    const { buildBuckets, playableWords } = await loadBuckets();
    const input = fixture();
    input.words = [...input.words, 'ZYME'];
    input.wiktionary.set('ZYME', { p: [['x', '/zaɪm/']] });
    const buckets = buildBuckets(input);
    expect(buckets.get('z')).toBeUndefined();
    expect(playableWords(input.words, buckets)).not.toContain('ZYME');
  });
```

- [ ] **Step 3: テストを走らせて失敗を確認する**

Run: `npx vitest run tests/scripts/buildDefs.test.ts`

Expected: FAIL。新しい 5 テストのうち 4 つが落ちる（`p` がバケットに書かれていないため `toEqual` が不一致）。`'発音しか無い語はバケットに載せない'` は実装前でも通る（回帰防止のため残す）。

- [ ] **Step 4: `ipaFor` を実装して `compact` に通す**

`scripts/lib/buckets.mjs` の JSDoc（16〜17 行目）の `wiktionary` パラメータ型に `p` を足す。

```js
 * @param {Map<string, {e?: [string, string][], b?: string, j?: string[], p?: [string, string][]}>} [input.wiktionary]
 *        大文字見出し → Wiktionary 由来の定義。WordNet が持たない語を埋める
```

`withBody` 関数（83〜92 行目）の直後に `ipaFor` を追加する。

```js
  /**
   * バケットに書き込む発音。語自身のものを優先し、無ければ原形のものを使う。
   * 原形が同じバケットにあるならローダが実行時に辿れるのでコピーしない。
   * 別バケットだと追加 fetch できないので、ここでコピーしておく（e / j と同じ扱い）。
   */
  function ipaFor(word, base) {
    const own = wiktionary.get(word)?.p ?? [];
    if (own.length > 0) return own;
    if (!base || base[0] === word[0]) return [];
    return wiktionary.get(base)?.p ?? [];
  }
```

`compact`（94〜101 行目）を差し替える。

```js
  /** 空の配列はファイルサイズを食うだけなので落とす */
  function compact(body, base, ipa) {
    const out = {};
    if (base) out.b = base;
    if (body.e.length > 0) out.e = body.e;
    if (body.j.length > 0) out.j = body.j;
    if (ipa.length > 0) out.p = ipa;
    return out;
  }
```

書き込みループ（103〜128 行目）を差し替える。

```js
  for (const raw of words) {
    const word = String(raw).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(word)) continue;

    const base = baseOf(word);
    // 自分自身の定義があるならそれを載せる。屈折形でもあるなら原形も併記する
    const own = bodyOf(word);
    if (own) {
      bucketFor(word[0].toLowerCase())[word] = compact(own, base, ipaFor(word, base));
      continue;
    }
    if (!base) continue;

    const body = bodyOf(base);
    if (!body) continue;
    // 載せるものが確定してからバケットを作る（空のバケットを残さない）
    const bucket = bucketFor(word[0].toLowerCase());
    if (base[0] === word[0]) {
      // 原形が word-list に無いと参照が宙に浮くので、実体を必ず同時に書く
      bucket[base] = compact(body, null, ipaFor(base, null));
      const ipa = ipaFor(word, base);
      bucket[word] = ipa.length > 0 ? { b: base, p: ipa } : { b: base };
    } else {
      // 別バケットの原形はローダが追加 fetch できないので実体をコピーする
      bucket[word] = compact(body, base, ipaFor(word, base));
    }
  }
```

- [ ] **Step 5: テストを走らせて通ることを確認する**

Run: `npx vitest run tests/scripts/buildDefs.test.ts`

Expected: PASS（20 tests）。既存の 15 テストも全て緑のままであること。

- [ ] **Step 6: lint を通す**

Run: `npx eslint .`

Expected: 出力なし

- [ ] **Step 7: コミット**

```bash
git add scripts/lib/buckets.mjs tests/scripts/buildDefs.test.ts
git commit -m "feat: 辞書バケットに発音記号を載せる"
```

---

## Task 4: ローダが発音を返す

**Files:**
- Modify: `src/lookup/types.ts`
- Modify: `src/lookup/dictLoader.ts`
- Modify: `tests/ui/DefinitionSheet.test.tsx`（型を通すため）
- Test: `tests/lookup/dictLoader.test.ts`

`LookupResult` の `found` に**必須**フィールドを足すので、`LookupResult` 型のリテラルを書いている全箇所を同時に直さないと `tsc -b` が落ちる。該当は `tests/ui/DefinitionSheet.test.tsx` の 2 つのフィクスチャ（`CAT` と `IF`）。

- [ ] **Step 1: 既存の dictLoader テストの期待値に `pronunciation: []` を足す**

`tests/lookup/dictLoader.test.ts` で `toEqual` に `kind: 'found'` を書いている 3 箇所を直す。

`'原形の語の定義を返す'`:

```ts
    expect(result).toEqual({
      kind: 'found',
      word: 'CAT',
      base: null,
      english: [['n', 'feline mammal']],
      japanese: ['猫'],
      pronunciation: [],
    });
```

`'b だけのエントリを同じバケット内で解決し、原形を併記する'`:

```ts
    expect(result).toEqual({
      kind: 'found',
      word: 'CATS',
      base: 'CAT',
      english: [['n', 'feline mammal']],
      japanese: ['猫'],
      pronunciation: [],
    });
```

`'バケットを跨ぐ屈折形は追加 fetch なしで解決する'`:

```ts
    expect(result).toEqual({
      kind: 'found',
      word: 'WENT',
      base: 'GO',
      english: [['v', 'change location']],
      japanese: ['行く'],
      pronunciation: [],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/lookup/dictLoader.test.ts` の `W_BUCKET` 定義（11〜13 行目）の直後に、発音用のバケットを足す。

```ts
const P_BUCKET: Bucket = {
  PHONE: {
    e: [['n', 'a device']],
    p: [
      ['uk', '/fəʊn/'],
      ['us', '/foʊn/'],
    ],
  },
  // 自分の発音を持つが定義は原形経由。CATS が実データでこの形になる
  PHONES: { b: 'PHONE', p: [['x', '/fəʊnz/']] },
  // 自分の発音を持たない屈折形
  PHONED: { b: 'PHONE' },
};
```

`describe('createDictLoader', ...)` の末尾、`'英字以外を含む語は fetch せず not-found'` の後に追記する。

```ts
  it('自分の発音を持つ語はそれを返す', async () => {
    const loader = createDictLoader(okFetch({ p: P_BUCKET }));
    const result = await loader.lookup('PHONE');
    expect(result).toEqual({
      kind: 'found',
      word: 'PHONE',
      base: null,
      english: [['n', 'a device']],
      japanese: [],
      pronunciation: [
        ['uk', '/fəʊn/'],
        ['us', '/foʊn/'],
      ],
    });
  });

  // 発音は定義とは別軸。定義を原形から借りていても発音は自分のものを優先する
  it('定義が原形経由でも発音は自分のものを使う', async () => {
    const loader = createDictLoader(okFetch({ p: P_BUCKET }));
    const result = await loader.lookup('PHONES');
    expect(result).toEqual({
      kind: 'found',
      word: 'PHONES',
      base: 'PHONE',
      english: [['n', 'a device']],
      japanese: [],
      pronunciation: [['x', '/fəʊnz/']],
    });
  });

  it('自分の発音が無ければ原形の発音で代用する', async () => {
    const loader = createDictLoader(okFetch({ p: P_BUCKET }));
    const result = await loader.lookup('PHONED');
    expect(result).toEqual({
      kind: 'found',
      word: 'PHONED',
      base: 'PHONE',
      english: [['n', 'a device']],
      japanese: [],
      pronunciation: [
        ['uk', '/fəʊn/'],
        ['us', '/foʊn/'],
      ],
    });
  });
```

- [ ] **Step 3: テストを走らせて失敗を確認する**

Run: `npx vitest run tests/lookup/dictLoader.test.ts`

Expected: FAIL。既存 3 テストは `pronunciation` が返り値に無いため不一致、新規 3 テストも同様。

- [ ] **Step 4: 型を足す**

`src/lookup/types.ts` の `EnglishSense` の定義の直後に追加する。

```ts
/** 発音のアクセント。x はタグの無い単一表記 */
export type Accent = 'uk' | 'us' | 'x';

/** 発音 1 件。[アクセント, IPA] */
export type Pronunciation = [Accent, string];
```

`Definition` に `p` を足す。

```ts
/** バケット JSON の 1 エントリ（spec §5） */
export type Definition = {
  /** 原形。語自身が原形なら持たない */
  b?: string;
  /** 英英定義 */
  e?: EnglishSense[];
  /** 和訳。最大 3 件 */
  j?: string[];
  /** 発音記号。UK/US 両方あれば 2 件、無ければ 1 件 */
  p?: Pronunciation[];
};
```

`LookupResult` の `found` に `pronunciation` を足す。

```ts
export type LookupResult =
  | {
      kind: 'found';
      word: string;
      base: string | null;
      english: EnglishSense[];
      japanese: string[];
      pronunciation: Pronunciation[];
    }
  | { kind: 'not-found' }
  | { kind: 'error' };
```

- [ ] **Step 5: ローダで発音を解決する**

`src/lookup/dictLoader.ts` の `lookup` 末尾（59〜68 行目）を差し替える。**`resolveEntry` は変更しない。**

```js
    const resolved = resolveEntry(bucket, entry);
    if (!resolved) return { kind: 'not-found' };

    // 発音は定義とは別軸で解く。CATS のように自分の発音を持ちつつ定義は原形経由の語がある。
    // 原形は 1 段だけ辿れば足りる（b は buckets.mjs が実体を指すよう正規化済み）
    const pronunciation = entry.p ?? (entry.b ? (bucket[entry.b]?.p ?? []) : []);

    return {
      kind: 'found',
      word: target,
      base: entry.b && entry.b !== target ? entry.b : null,
      english: resolved.e ?? [],
      japanese: resolved.j ?? [],
      pronunciation,
    };
```

- [ ] **Step 6: DefinitionSheet テストのフィクスチャを型に合わせる**

`tests/ui/DefinitionSheet.test.tsx` の `CAT`（12〜21 行目）に `pronunciation: []` を足す。

```tsx
const CAT: LookupResult = {
  kind: 'found',
  word: 'CAT',
  base: null,
  english: [
    ['n', 'feline mammal'],
    ['v', 'to flog with a cat-o-nine-tails'],
  ],
  japanese: ['猫', 'ネコ科の動物'],
  pronunciation: [],
};
```

同ファイル `'機能語の品詞ラベルも出す'` の中の `IF`（45〜56 行目）にも足す。

```tsx
    const IF: LookupResult = {
      kind: 'found',
      word: 'IF',
      base: null,
      english: [
        ['conj', 'Supposing that, assuming that.'],
        ['prep', 'Expressing distance or motion.'],
        ['intj', 'An expression of surprise.'],
        ['x', 'A particle.'],
      ],
      japanese: [],
      pronunciation: [],
    };
```

- [ ] **Step 7: テストと型検査を走らせて通ることを確認する**

Run: `npx vitest run tests/lookup/dictLoader.test.ts`

Expected: PASS（13 tests）

Run: `npx tsc -b`

Expected: 出力なし（テストも `include` の対象なので、フィクスチャの漏れがあればここで落ちる）

- [ ] **Step 8: lint を通す**

Run: `npx eslint .`

Expected: 出力なし

- [ ] **Step 9: コミット**

```bash
git add src/lookup/types.ts src/lookup/dictLoader.ts tests/lookup/dictLoader.test.ts tests/ui/DefinitionSheet.test.tsx
git commit -m "feat: 辞書ローダが発音記号を返す"
```

---

## Task 5: 定義シートに発音記号を表示する

**Files:**
- Modify: `src/ui/DefinitionSheet.tsx`
- Test: `tests/ui/DefinitionSheet.test.tsx`

**`font-pixel`（Press Start 2P）は ASCII しか持たない。** `ə ʊ ɹ ː ˈ` が別フォントに落ちて字面が崩れるので、この行だけ `font-mono` にして外す。`src/ui/AboutSheet.tsx` が和文で同じ理由により `font-pixel` を外しているのと同じ扱い。

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/DefinitionSheet.test.tsx` の `CATS` 定義（23 行目）の直後に、発音用のフィクスチャを足す。

```tsx
const PHONE: LookupResult = {
  kind: 'found',
  word: 'PHONE',
  base: null,
  english: [['n', 'a device']],
  japanese: [],
  pronunciation: [
    ['uk', '/fəʊn/'],
    ['us', '/foʊn/'],
  ],
};

const ZA: LookupResult = {
  kind: 'found',
  word: 'ZA',
  base: null,
  english: [['n', 'pizza']],
  japanese: [],
  pronunciation: [['x', '/zɑː/']],
};
```

`describe('DefinitionSheet', ...)` の末尾、`'シートのタイトルは単語そのもの'` の後に追記する。

```tsx
  it('UK と US が両方あればラベル付きで並べる', async () => {
    render(<DefinitionSheet loader={loaderOf(PHONE)} word="PHONE" onDismiss={() => {}} />);
    const line = await screen.findByTestId('pronunciation');
    expect(line).toHaveTextContent('UK /fəʊn/');
    expect(line).toHaveTextContent('US /foʊn/');
  });

  // 単独表記にラベルを付けると「もう一方が存在する」と誤解させる
  it('1 件だけならラベルを付けない', async () => {
    render(<DefinitionSheet loader={loaderOf(ZA)} word="ZA" onDismiss={() => {}} />);
    const line = await screen.findByTestId('pronunciation');
    expect(line).toHaveTextContent('/zɑː/');
    expect(line.textContent).toBe('/zɑː/');
  });

  it('発音が無ければ行ごと出さない', async () => {
    render(<DefinitionSheet loader={loaderOf(CAT)} word="CAT" onDismiss={() => {}} />);
    await screen.findByText('feline mammal');
    expect(screen.queryByTestId('pronunciation')).not.toBeInTheDocument();
  });

  // Press Start 2P は ASCII しか持たず ə ʊ ɹ ː が別フォントに落ちて字面が崩れる
  it('発音行では font-pixel を使わない', async () => {
    render(<DefinitionSheet loader={loaderOf(PHONE)} word="PHONE" onDismiss={() => {}} />);
    const line = await screen.findByTestId('pronunciation');
    expect(line).toHaveClass('font-mono');
    expect(line).not.toHaveClass('font-pixel');
  });
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npx vitest run tests/ui/DefinitionSheet.test.tsx`

Expected: FAIL。新規 4 テストのうち 3 つが `Unable to find an element by: [data-testid="pronunciation"]` で落ちる（`'発音が無ければ行ごと出さない'` は実装前でも通る）。

- [ ] **Step 3: 発音行を描画する**

`src/ui/DefinitionSheet.tsx` の import に `Accent` を足す。

```tsx
import type { Accent, Pos } from '../lookup/types';
```

`POS_LABEL` の定義（7〜21 行目）の直後に追加する。

```tsx
/** アクセントの表示ラベル。2 件並ぶときだけ引く（x は 2 件側に現れない） */
const ACCENT_LABEL: Record<Accent, string> = { uk: 'UK', us: 'US', x: '' };
```

`state.kind === 'found'` のブロック内、原形併記の `<p>` の直後（65 行目と 66 行目の間）に挿入する。

```tsx
            {state.pronunciation.length > 0 && (
              // Press Start 2P は ASCII しか持たず ə ʊ ɹ ː が別フォントに落ちて字面が
              // 崩れるので、この行だけ font-pixel を外す（AboutSheet の和文と同じ理由）
              <p data-testid="pronunciation" className="font-mono text-stone-400">
                {state.pronunciation.map(([accent, ipa]) => (
                  <span key={accent} className="mr-3">
                    {state.pronunciation.length > 1 && (
                      <span className="text-stone-500">{ACCENT_LABEL[accent]} </span>
                    )}
                    <span>{ipa}</span>
                  </span>
                ))}
              </p>
            )}
```

- [ ] **Step 4: テストと型検査を走らせて通ることを確認する**

Run: `npx vitest run tests/ui/DefinitionSheet.test.tsx`

Expected: PASS（12 tests）

Run: `npx tsc -b`

Expected: 出力なし

- [ ] **Step 5: 全テストと lint を通す**

Run: `npm run test`

Expected: 全スイート PASS。Task 1〜4 で触ったファイル以外に回帰が無いこと。

Run: `npx eslint .`

Expected: 出力なし

- [ ] **Step 6: コミット**

```bash
git add src/ui/DefinitionSheet.tsx tests/ui/DefinitionSheet.test.tsx
git commit -m "feat: 定義シートの見出し下に発音記号を表示する"
```

---

## Task 6: 本データを作り直して収録率を実測する

**Files:**
- Modify: `data/wiktionary.json`（生成物だがコミット対象）
- Create（生成物、`.gitignore` 済みでコミットしない）: `public/dict/defs/{a..z}.json`

3.1 GB の `/tmp/kaikki-en.jsonl` を流すので数分かかる。

- [ ] **Step 1: 入力データがあることを確認する**

```bash
ls -la /tmp/kaikki-en.jsonl
```

Expected: 3.1 GB 前後のファイル。無ければ次で取得する（時間がかかる）。

```bash
curl -o /tmp/kaikki-en.jsonl https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl
```

- [ ] **Step 2: `data/wiktionary.json` を作り直す**

Run: `npm run build:wiktionary -- /tmp/kaikki-en.jsonl`

Expected: `✓ ... 語 (17.x MB) を .../data/wiktionary.json に書き出し` のような出力。
語数は 259,278 語の単語リストに対して 23 万語前後、カバー率 88% 前後。

**注意**: このスクリプトは `public/dict/words.txt` を「欲しい語」のフィルタに使う。
`build-defs.mjs` が剪定済みなので基準は 259,278 語。これは意図した動作で、
すでに除外された語が戻ることはない。

- [ ] **Step 3: 発音が入ったことを確認する**

```bash
node -e "const o=require('./data/wiktionary.json');const n=Object.values(o).filter(v=>v.p).length;console.log('発音あり:',n.toLocaleString());for(const w of ['HELLO','CAT','CATS','ARGAN','QI','ZA'])console.log(w,JSON.stringify(o[w]&&o[w].p))"
```

Expected: `発音あり:` が 5 万件前後。`HELLO` に UK/US の 2 件、`CATS` に `x` が 1 件、`ARGAN` に 1 件。

- [ ] **Step 4: バケットを作り直す**

Run: `npm run build:defs`

Expected: `✓ wrote ... entries (19.x MB) to .../public/dict/defs` と
`✓ pruned words.txt to 259,278 playable words (dropped 0)` の 2 行。

**`dropped 0` であること。** 0 でなければ発音の追加が剪定に影響しており、Task 3 の
`bodyOf` 不変条件が壊れている。その場合は `scripts/lib/buckets.mjs` の `ipaFor` が
`bodyOf` に副作用を与えていないか確認する。

- [ ] **Step 5: 収録率とサイズを実測する**

```bash
node -e "
const fs=require('fs');
const words=fs.readFileSync('public/dict/words.txt','utf8').split('\n').map(s=>s.trim()).filter(Boolean);
const b={};let bytes=0;
for(const c of 'abcdefghijklmnopqrstuvwxyz'){const p='public/dict/defs/'+c+'.json';b[c]=JSON.parse(fs.readFileSync(p,'utf8'));bytes+=fs.statSync(p).size;}
const has=w=>{const e=b[w[0].toLowerCase()][w];if(!e)return false;return !!(e.p||(e.b&&b[e.b[0].toLowerCase()]&&b[e.b[0].toLowerCase()][e.b]&&b[e.b[0].toLowerCase()][e.b].p));};
const hit=words.filter(has).length;
console.log('playable:',words.length.toLocaleString());
console.log('発音あり:',hit.toLocaleString(),(100*hit/words.length).toFixed(1)+'%');
console.log('defs 合計:',(bytes/1e6).toFixed(1),'MB');
for(const L of [2,3,4,5,6,7]){const a=words.filter(w=>w.length===L);console.log('  '+L+' 文字:',(100*a.filter(has).length/a.length).toFixed(1)+'%');}
"
```

Expected: 全体 44% 前後、2 文字語 96% 前後、`defs 合計` が 19 MB 前後。
**この出力の数値を Step 6 以降のドキュメントにそのまま書く。** 見込み値ではなく実測値を使うこと。

- [ ] **Step 6: `README.md` を更新する**

`## 変更履歴` の先頭（37 行目の `- **2026-09-11** 意味を出せない語…` の前）に 1 行足す。
`{全体}` `{2文字}` は Step 5 の実測値に置き換える。

```markdown
- **2026-09-12** 英単語の発音記号（IPA）を定義シートに表示するようにした。英語版 Wiktionary の `sounds` から音素表記を抽出し、UK（RP）と US（GA）のタグが両方あれば併記する。収録率は playable な語の {全体}%（2 文字語 {2文字}%）。
```

`## 遊び方（Plan 1 時点）` の 17 行目を差し替える。

```markdown
9. 「直前手」と「履歴」に出る単語をタップすると、発音記号（IPA）と英英定義（品詞ごとに 1 件）、和訳（最大 3 件）が表示されます
```

`定義ファイル public/dict/defs/{a..z}.json も .gitignore 済みですが…` の段落（66 行目）の後に 1 行足す。

```markdown
定義ファイルには発音記号も含まれます（合計 {実測}MB）。
```

`### Wiktionary (CC BY-SA 3.0)` 節の `**加えた変更**:` の箇条書き（129〜130 行目）を差し替える。

```markdown
- **加えた変更**: 語義は品詞ごとに先頭の 1 件だけを残し、120 文字を超える場合は末尾を省略しています。
  見出しは大文字に正規化し、A-Z 以外を含む見出しは除外しています。
  発音記号は音素表記（`/.../`）だけを採用し、狭い音声表記（`[...]`）は除外しています。
  UK（Received-Pronunciation）と US（General-American）のタグが付いたものを優先し、
  無ければタグの無い先頭 1 件だけを残しています。
```

- [ ] **Step 7: ライセンス表示の失敗するテストを書く**

CC BY-SA 3.0 は**変更点の明示を配布条件にしている**。発音記号の絞り込み（`/.../` だけ採用、
`[...]` を除外）は「変更」に当たるので、画面内表示から文言が消えたら落ちるようにする。
既存の `'WordNet の著作権表示を原文どおり出す'` が同じ理由で置かれているのと揃える。

`tests/ui/AboutSheet.test.tsx` の `'EJDict と Press Start 2P も挙げる'` の後に追記する。

```tsx
  // CC BY-SA 3.0 は変更点の明示を配布条件にしている。発音記号の絞り込みも変更に当たる
  it('Wiktionary への変更点として発音記号の絞り込みを挙げる', () => {
    render(<AboutSheet onDismiss={() => {}} />);
    expect(screen.getByText(/発音記号は音素表記/)).toBeInTheDocument();
  });
```

Run: `npx vitest run tests/ui/AboutSheet.test.tsx`

Expected: FAIL（`Unable to find an element with the text: /発音記号は音素表記/`）

**`docs/design.md` は更新しない。** 同ファイルは Plan 1〜4 当時の設計文書で、辞書アセットを
`public/dict/en-en/{a..z}.json` と `en-ja/{a..z}.json` に分ける旧構成のまま止まっており、
現行のバケット形式（`b`/`e`/`j`）を記述した箇所が存在しない。無理に追記すると旧構成の
記述と矛盾する。バケット形式の正典は `docs/superpowers/specs/2026-09-12-pronunciation-design.md` §3。
`docs/design.md` のライセンス表も、発音記号は既存の Wiktionary 由来で新しいデータ源ではないため行は増えない。

- [ ] **Step 8: `src/ui/AboutSheet.tsx` のライセンス表示を更新する**

CC BY-SA 3.0 は変更点の明示を配布条件にしている。発音記号の絞り込みは「変更」に当たる。
`英英定義: Wiktionary` セクション（66〜79 行目）の「変更点」の `<p>`（73〜75 行目）を差し替える。

```tsx
          <p className="mt-1 text-stone-400">
            変更点: 品詞ごとに語義を 1 件だけ残し、120 文字を超える場合は末尾を省略しています。
            発音記号は音素表記（/.../）のみを採用し、UK / US のタグが無い場合は先頭 1 件だけを残しています。
          </p>
```

セクション見出しも実態に合わせる（68 行目の `<h3>`）。

```tsx
          <h3 className="text-stone-400 mb-1">英英定義・発音記号: Wiktionary</h3>
```

- [ ] **Step 9: 全テストと型検査と lint を通す**

Run: `npx vitest run tests/ui/AboutSheet.test.tsx`

Expected: PASS（7 tests）。Step 7 で書いたテストが Step 8 の文言追加で緑になる。

Run: `npm run test`

Expected: 全スイート PASS。既存の AboutSheet テストは見出し文字列を assert していない
（`WordNet` / `CC0` / `TWL06` / `EJDict` / `Press Start 2P` の 5 語だけを見ている）ので、
`<h3>` の変更では落ちない。

Run: `npx tsc -b`

Expected: 出力なし

Run: `npx eslint .`

Expected: 出力なし

- [ ] **Step 10: ブラウザで実際に見て確認する**

```bash
npm run build && npm run preview
```

別シェルで `http://localhost:4173/toy-scrabble/` を開き、適当な手を打ってから履歴の単語をタップする。
確認項目:

- 見出しの下に発音記号が出る（`ə ʊ ɹ ː` が豆腐や別フォントになっていない）
- UK/US が両方ある語ではラベルが付き、1 件の語ではラベルが無い
- 発音が収録されていない語ではその行が丸ごと無い（空行や余白だけが残らない）
- 幅 320px でも行が折り返して崩れない

確認が済んだら preview を止める。

- [ ] **Step 11: コミット**

`public/dict/defs/` と `public/dict/words.txt` は `.gitignore` 済みなのでステージされない。

```bash
git add data/wiktionary.json README.md src/ui/AboutSheet.tsx tests/ui/AboutSheet.test.tsx
git status --short
git commit -m "feat: 発音記号を含むデータを再生成しライセンス表示を更新する"
```

`git status --short` の出力に `public/dict/` 配下が現れないこと（`.gitignore` 済み）。

---

## 完了後の状態

- `npm run test` / `npx tsc -b` / `npx eslint .` がすべて緑
- 定義シートの見出し下に発音記号が出る（収録率は playable な語の約 44%、2 文字語は約 97%）
- `data/wiktionary.json` が 17 MB 前後に増えてコミット済み
- ローカルコミットが 6 個増える。**`git push` はこの計画に含まない**（ユーザーが `! git push` で実行する）
