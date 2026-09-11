# 発音記号（IPA）表示 — 設計仕様

作成日: 2026-09-12

## 1. 目的とスコープ

日本人英語学習者が、盤に出た単語の読み方をその場で確認できるようにする。

**やること**: 定義シート（`DefinitionSheet`）の見出しの下に、その語の IPA 発音記号を 1 行で表示する。UK（RP）と US（GA）のタグが付いた表記が両方あれば両方、無ければタグ無しの表記を 1 件表示する。屈折形に発音が無い場合は原形の発音で代用する。

**やらないこと**（YAGNI）:

- 音声再生（`sounds[].ogg_url` / `mp3_url` は使わない）
- カタカナ読みの併記
- 定義シート以外の場所（盤・手札・履歴チップ）への表示
- 発音記号の検索・絞り込み
- `[...]` 形式の狭い音声表記（異音まで書かれており学習者には細かすぎる）
- Wiktionary 独自の `enpr`（英語発音再綴り）

**非機能要件**: 発音が引けなくてもゲーム進行と既存の定義表示に一切影響しない。発音の有無が「遊べる語かどうか」の判定に影響してはならない。

## 2. データ源

既存の Wiktionary パイプラインをそのまま使う。新しい外部依存もダウンロードも増やさない。

kaikki.org の英語 Wiktionary 抽出 JSONL（1 行 = 1 つの「見出し語 × 品詞」）は、各行に `sounds[]` を持つ。

```json
{
  "word": "hello",
  "pos": "intj",
  "sounds": [
    { "ipa": "/həˈləʊ/", "tags": ["Received-Pronunciation"] },
    { "ipa": "/hɛˈloʊ/", "tags": ["General-American"] },
    { "ipa": "[hɛˈɫoʊ]" },
    { "ogg_url": "https://..." }
  ]
}
```

- `/.../` は音素表記、`[...]` は狭い音声表記。**採用するのは `/` で始まるものだけ。**
- `tags` に `Received-Pronunciation` が入れば UK、`General-American` が入れば US。
- タグの無い `/.../` も多い。むしろこちらが多数派。

### 2.1 実測した収録率

3.1 GB の `kaikki.org-dictionary-English.jsonl`（1,540,706 行）に対する計測結果。

| 区分 | 語数 | playable 259,278 語に対する割合 |
|---|---|---|
| UK（RP）タグ付き | 16,349 | 6.3% |
| US（GA）タグ付き | 16,343 | 6.3% |
| タグ無しを含めた直接ヒット | 54,211 | 20.9% |
| 原形フォールバック込み | 114,559 | **44.2%** |

語の長さ別（原形フォールバック込み）:

| 長さ | 収録率 |
|---|---|
| 2 文字 | 96.8% |
| 3 文字 | 87.2% |
| 4 文字 | 82.3% |
| 5 文字 | 75.9% |
| 6 文字 | 67.9% |
| 7 文字 | 59.6% |
| 8 文字 | 49.6% |

全体では 44% だが、実際に盤に並ぶ短い語ほど収録率が高い。**この機能は全語カバーを目指さない。** 引けない語では行ごと非表示にする。

### 2.2 サイズへの影響

| ファイル | 現在 | 追加後（見込み） |
|---|---|---|
| `data/wiktionary.json` | 15 MB | 約 17 MB |
| `public/dict/defs/{a..z}.json` 合計 | 17.9 MB | 約 19.2 MB（+1.28 MB / +7%） |

バケットは先頭文字ごとに遅延読み込みされるため、初期ロードには影響しない。

## 3. データ形状

### 3.1 型定義（`src/lookup/types.ts`）

```ts
/** 発音のアクセント。x はタグの無い単一表記 */
export type Accent = 'uk' | 'us' | 'x';

/** 発音 1 件。[アクセント, IPA] */
export type Pronunciation = [Accent, string];

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

`e: [Pos, string][]` と同じ「タプルの配列」に揃える。JSON のバイト数を抑えるためと、既存のバケット形式との一貫性のため。

`LookupResult` の `found` に `pronunciation` を追加する。

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

空配列を既定値にするので、呼び出し側が `undefined` を気にする必要はない。

### 3.2 バケット JSON の例

```json
{
  "HELLO": { "e": [["intj", "A greeting."]], "j": ["こんにちは"], "p": [["uk", "/həˈləʊ/"], ["us", "/hɛˈloʊ/"]] },
  "CATS":  { "b": "CAT", "p": [["x", "/kæts/"]] },
  "ARGAN": { "e": [["n", "A Moroccan tree..."]], "p": [["x", "/ˈɑː(ɹ)ɡən/"]] }
}
```

`CATS` は自身の発音を持つが定義は `CAT` 経由、という組み合わせが実在する。§5 の解決順序はこれを前提にする。

## 4. 抽出（`scripts/lib/wiktionary.mjs`）

`ipaOf(sounds)` を追加し、`extractEntry()` の戻り値に `ipa` を足す。

```js
/** 音素表記 /.../ だけ拾う。[...] は異音まで書いた狭い表記で学習者には細かすぎる */
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

`extractEntry()` の変更:

```js
const ipa = ipaOf(Array.isArray(obj.sounds) ? obj.sounds : []);

if (gloss === null && base === null && japanese.length === 0) return null;
return { word, raw: obj.word, pos, gloss, base, japanese, ipa };
```

**早期 return の条件は変えない。** `ipa.length > 0` を条件に加えると「意味は出ないが発音だけある語」が `data/wiktionary.json` に入り、`build-defs.mjs` が担保している「playable な語の定義収録率 100%」と噛み合わなくなる。発音はあくまで既存エントリへの付随情報とする。

### 4.1 集約（`scripts/build-wiktionary.mjs`）

`emptyRecord()` に `p: []` を足し、`absorb()` で先勝ちにする。

```js
function emptyRecord() {
  return { e: [], b: null, j: [], p: [] };
}

function absorb(record, entry) {
  // ...既存...
  // 同じ語の品詞違いで発音が割れることはほぼ無いので先勝ちで足りる
  if (record.p.length === 0 && entry.ipa.length > 0) record.p = entry.ipa;
}
```

出力の組み立てで空配列を落とす:

```js
if (record.p.length > 0) value.p = record.p;
```

`record` は `group.lower` / `group.upper` のどちらかが選ばれる（既存ロジック）。発音も選ばれた側のものを使う。和訳のような両者マージはしない — 略語見出しの発音が普通語に混ざるのを避けるため。

## 5. バケット生成と解決

### 5.1 `scripts/lib/buckets.mjs`

Wiktionary 由来のエントリを組み立てるところで `p` をそのまま転記する。

**`bodyOf()`（`e` / `j` の有無でエントリの「実体」を判定する関数）は変更しない。** `p` だけを持つ語を実体扱いすると、`playableWords()` がそれを遊べる語として残してしまい、意味の出ない語が盤に戻る。

### 5.2 `src/lookup/dictLoader.ts`

`resolveEntry()`（定義の解決）は変更しない。発音は別軸として `lookup()` の中で解く。

```ts
const pronunciation = entry.p ?? (entry.b ? (bucket[entry.b]?.p ?? []) : []);
```

解決順序:

1. 引いた語自身の `p` があればそれを使う（`CATS` → `/kæts/`）
2. 無ければ `b` が指す原形の `p`（`ABOLISHERS` は発音を持たず、`b` は `ABOLISH` を指すので `/əˈbɒl.ɪʃ/`）
3. どちらも無ければ空配列

**原形は 1 段だけ辿る。** `resolveEntry()` も同じく 1 段で、`b` の連鎖は `buckets.mjs` の `withBody()` がビルド時に潰している。実行時に多段解決を足すと、定義と発音で辿る段数が食い違って挙動が読みにくくなる。ビルド時に `b` が実体を指すよう正規化済みなので 1 段で足りる。

`kind: 'found'` の戻り値に `pronunciation` を含める。

### 5.3 `src/lookup/useDefinition.ts`

変更不要。`LookupResult` をそのまま流しているだけなので、新しいフィールドは自動的に届く。

## 6. 表示（`src/ui/DefinitionSheet.tsx`）

`state.base` の併記行の直下に、発音行を 1 行挿入する。

```
┌────────────────────────┐
│        HELLO           │  ← Sheet title（font-pixel）
│                        │
│  UK /həˈləʊ/  US /hɛˈloʊ/ │  ← 新規
│                        │
│  英英                   │
│  int. A greeting.      │
│                        │
│  和訳                   │
│  こんにちは              │
└────────────────────────┘
```

原形が異なる場合は既存の併記行が先に来る。

```
CATS
CATS ← CAT
/kæts/
```

仕様:

- `pronunciation.length === 0` のときは**要素ごと描画しない**。「発音記号は収録されていません」のような文言も出さない
- 2 件（UK+US）のときは各項目に `UK` / `US` のラベルを付ける
- 1 件のときはアクセントが `x` でも `uk` でも `us` でもラベルを付けず IPA だけ出す。単独表記にラベルを付けると「もう一方が存在する」と誤解させるため。**ラベルの有無は `pronunciation.length` だけで決め、アクセントの値では分岐しない**
- **`font-pixel`（Press Start 2P）を外す。** このフォントは ASCII しか持たず、`ə ʊ ɹ ː ˈ` が別フォントに落ちて字面が崩れる。`AboutSheet` が和文で同じ理由により `font-pixel` を外しているのと同じ扱い。この行は `font-mono` を使う
- 色は既存の原形併記行と同じ `text-stone-400` 系にして、定義本文より弱く見せる

ラベル対応表。2 件のときだけ引く（`x` は 2 件側に現れないが、`Record<Accent, string>` を満たすため空文字を置く）:

```ts
const ACCENT_LABEL: Record<Accent, string> = { uk: 'UK', us: 'US', x: '' };
```

## 7. テスト

| ファイル | 追加するケース |
|---|---|
| `tests/scripts/wiktionary.test.ts` | UK+US 両方タグ付き → 2 件 / タグ無しのみ → `[['x', ...]]` 1 件 / `[...]` のみ → 空配列 / `sounds` 無し → 空配列 / 発音だけあって gloss・base・和訳が無い行 → `null`（早期 return が効いている） |
| `tests/scripts/buildDefs.test.ts` | `p` がバケットに転記される / `p` だけを持つ語は `playableWords()` に残らない |
| `tests/lookup/dictLoader.test.ts` | 自語の `p` を返す / 自語に無ければ原形の `p` を返す / どちらも無ければ `[]` |
| `tests/ui/DefinitionSheet.test.tsx` | UK/US 両方にラベル付きで表示 / 1 件のときラベル無し / `[]` のとき行が存在しない |

テストは既存の慣習に合わせる。`@testing-library/user-event` は依存に無いので `fireEvent` を使う。

## 8. 再ビルド手順

`data/wiktionary.json` はリポジトリにコミットしている生成物なので、抽出ロジックを変えたら手元で 1 回回して再コミットする。

```bash
# 3.1 GB。既に /tmp にある場合は再ダウンロード不要
curl -O https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl
npm run build:wiktionary -- ./kaikki.org-dictionary-English.jsonl
```

CI（`.github/workflows/deploy.yml`）が走らせるのは `prebuild` の `build-defs.mjs` だけで、こちらは `data/wiktionary.json` を読むだけなのでワークフローの変更は不要。

**注意**: `build-wiktionary.mjs` は `public/dict/words.txt` を「欲しい語」のフィルタに使う。`build-defs.mjs` が words.txt を剪定済みなので、再ビルドすると剪定後の 259,278 語が基準になる。これは意図した動作で、既に除外された語が戻ることはない。

## 9. ドキュメント更新

- `README.md`: 変更履歴に 1 行、遊び方に発音記号の説明を 1 行、辞書ファイルサイズの記述を更新
- `docs/design.md`: 該当箇所のデータ形式にバケットの `p` キーを追記
- `src/ui/AboutSheet.tsx`: **Wiktionary のセクションの「加えた変更」に発音記号の扱いを追記。** CC BY-SA 3.0 は変更点の明示を配布条件にしており、`/.../` だけを採用し `[...]` を捨てている点、UK/US のタグで絞っている点は「変更」に当たる
- `README.md` の Wiktionary ライセンス節にも同じ追記をする

ライセンス表の行は増えない。発音記号は既存の Wiktionary（CC BY-SA 3.0）由来のデータで、新しいデータ源ではない。
