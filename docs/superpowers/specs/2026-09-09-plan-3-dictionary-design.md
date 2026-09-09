# Plan 3: 英英・英和辞書表示 — 設計仕様

作成日: 2026-09-09

## 1. 目的とスコープ

日本人英語学習者が、対局中に作られた単語の意味をその場で確認できるようにする。

**やること**: 履歴パネル内の各手に含まれる単語（自分・COM 両方）をタップすると、品詞ごとに先頭 1 件の英英定義と先頭数件の和訳をシートで表示する。屈折形は原形に解決して引き、原形が異なる場合は原形を併記する。

**やらないこと**（YAGNI）:
- 任意単語の検索ボックス
- 盤面タイルからの逆引き（盤面のタップは仮配置操作に使われており、衝突するため）
- 発音記号・音声
- 語義の全件表示
- 学習履歴の保存・復習機能

**非機能要件**: 辞書が引けなくてもゲーム進行に一切影響しない。表示専用で、`GameState` を変更しない。

## 2. データ源

いずれも npm パッケージとして取得する。既存の `word-list` → `scripts/build-dict.mjs` と同じパターンで、生辞書をリポジトリに含めない。

| パッケージ | バージョン | ライセンス | 中身 |
|---|---|---|---|
| `wordnet-db` | 3.1.14 | MIT | `dict/data.{noun,verb,adj,adv}`、`dict/index.{noun,verb,adj,adv,sense}` |
| `ejdict` | 1.4.2 | MIT | `lib/data/dictionary/{a..z}.json`（計 4.4MB）、`lib/data/irregular_verbs.json` |

両方 devDependencies に追加する。`wordnet-db` は展開 35MB あり `npm ci` が重くなるが、許容する。

### 2.1 実測した形式

**ejdict の各バケット** — キーは元データの大小混在、値はスラッシュ区切りの訳文で先頭に空白が入る:

```json
{"A":" 〈C〉英語アルファベットの第1字 / 〈U〉(音階の)イ音,イ調", "a.":" about / acre[s] / adjective"}
```

読み込み時にキーを大文字化し、値は ` / ` で分割して各要素を trim する。`a.` のようにピリオドを含むキーや、英字以外で始まるキーが存在するので、`^[A-Z]+$` に一致しないキーは捨てる。

**ejdict の `irregular_verbs.json`** — 値が原形、キーが活用形:

```json
{"awoke": "awake", "born, borne": "bear", "beat": "beat"}
```

**キーがカンマ区切りの複合になっている行が存在する**（`"born, borne"`）。`,` で分割し各要素を trim して個別のエントリとして扱う。これを見落とすと `BORN` も `BORNE` も引けなくなる。

**wordnet-db に `noun.exc` などの例外リストは同梱されていない。** 同梱は `data.*` と `index.*` のみ。したがって WordNet 標準の morphy 例外リストは利用できず、§4 の代替手段を使う。

**WordNet の `index.*` 形式** — 先頭に `  ` で始まるライセンスヘッダ行があり、それ以降が `lemma pos synset_cnt ...` の空白区切り。lemma はスペースの代わりに `_` を使う複合語を含む。1 語のみ（`_` を含まない）かつ `^[a-z]+$` のものだけを採用する。

**WordNet の `data.*` 形式** — `synset_offset lex_filenum ss_type w_cnt ...` に続き ` | ` の後ろが gloss。gloss は `定義; "例文"` の形なので、最初の `;` より前を定義として採用し、trim する。

## 3. ファイル構成

```
scripts/
  build-dict.mjs          # 既存。twl06.txt 生成。変更しない
  build-defs.mjs          # 新規。public/dict/defs/{a..z}.json を生成
  lib/
    lemmatize.mjs         # 新規。原形解決。ビルド時のみ使用
    wordnet.mjs           # 新規。WordNet の index/data パース
    ejdict.mjs            # 新規。ejdict バケットと不規則動詞表の読み込み
src/lookup/
  types.ts                # 新規。DefinitionEntry 等の型
  dictLoader.ts           # 新規。bucket lazy load + inflight dedup
  useDefinition.ts        # 新規。React フック
src/ui/
  WordChip.tsx            # 新規。履歴内のタップ可能な単語チップ
  DefinitionSheet.tsx     # 新規。既存 Sheet.tsx を使った表示
tests/
  scripts/lemmatize.test.ts
  scripts/wordnet.test.ts
  scripts/ejdict.test.ts
  scripts/buildDefs.test.ts
  lookup/dictLoader.test.ts
  ui/WordChip.test.tsx
  ui/DefinitionSheet.test.tsx
```

テストは既存の Vitest（`npm run test`）で走らせる。

**`scripts/lib/*.mjs` を `.ts` テストから読む方法に制約がある。** `tsconfig.app.json` は `tests` を include する一方 `allowJs` を持たないため、型定義のない `.mjs` を**静的 import すると TS7016 で `npm run build` が落ちる**。既存の `tests/ui/generatedCss.test.ts:6-15` が同じ問題に当たっており、そこで確立した回避策を踏襲する — **モジュール指定子を変数に入れた動的 import** を使うと、TypeScript がモジュール解決を試みないため型エラーにならない:

```typescript
const LEMMATIZE_PATH = '../../scripts/lib/lemmatize.mjs';

async function loadLemmatize(): Promise<{ lemmatize: (w: string, known: Set<string>) => string | null }> {
  const mod = await import(LEMMATIZE_PATH);
  return mod;
}
```

静的 import に書き換えるとテストは通るのに `npm run build` だけが落ちるので、この形を崩さないこと。

`scripts/lib/*.mjs` を分けるのは、原形解決ロジックが本仕様で最も複雑かつ最もテストが要る部分であり、`build-defs.mjs` の I/O から切り離して単体テストしたいため。

## 4. 原形解決

`wordnet-db` の `index.{noun,verb,adj,adv}` から全見出し語の `Set<string>`（小文字）を作り、「原形として妥当か」の判定に使う。

語 W（大文字）について以下を順に試し、**最初に Set に当たった候補**を原形とする。候補は必ず Set で検証してから採用するため、`BUS → BU` のような誤剥がしは自動的に棄却される。

1. W 自身
2. `irregular_verbs.json` 由来の表（カンマ複合キーを分割済み）
3. 手書きの不規則名詞・形容詞表（§4.1）
4. 規則ベースの接尾辞剥がし（§4.2）

どれにも当たらなければ、その語はバケットに載せない。

### 4.1 手書きの不規則表

WordNet の例外リストが使えないため、頻出する不規則形を明示的に持つ。最低限これらを含める:

| 活用形 | 原形 |
|---|---|
| CHILDREN | CHILD |
| MEN | MAN |
| WOMEN | WOMAN |
| MICE | MOUSE |
| GEESE | GOOSE |
| FEET | FOOT |
| TEETH | TOOTH |
| OXEN | OX |
| PEOPLE | PERSON |
| BETTER, BEST | GOOD |
| WORSE, WORST | BAD |
| FARTHER, FARTHEST, FURTHER, FURTHEST | FAR |
| MORE, MOST | MUCH |
| LESS, LEAST | LITTLE |

### 4.2 規則ベースの接尾辞剥がし

morphy 相当。適用順は上から:

| 接尾辞 | 置換 | 例 |
|---|---|---|
| `ses` | `s` | BUSSES → BUS |
| `xes` | `x` | BOXES → BOX |
| `zes` | `z` | QUIZZES → QUIZ |
| `ches` | `ch` | CHURCHES → CHURCH |
| `shes` | `sh` | DISHES → DISH |
| `ies` | `y` | CITIES → CITY |
| `s` | (削除) | CATS → CAT |
| `ed` | `e` | HOPED → HOPE |
| `ed` | (削除) | WALKED → WALK |
| `ing` | `e` | HOPING → HOPE |
| `ing` | (削除) | WALKING → WALK |
| `er` | (削除) | TALLER → TALL |
| `er` | `e` | LARGER → LARGE |
| `est` | (削除) | TALLEST → TALL |
| `est` | `e` | LARGEST → LARGE |

同じ綴りが複数の候補を生む場合（例: `ed` → `e` と `ed` → 削除）は、表の順に試して最初に Set に当たったものを採る。

## 5. 生成物の形式

`public/dict/defs/{a..z}.json`。ファイル名は語の**先頭文字**（小文字）。キーは大文字のゲーム上の語。

```json
{
  "CAT":  { "e": [["n", "feline mammal usually having thick soft fur"]], "j": ["猫", "ネコ"] },
  "CATS": { "b": "CAT" },
  "WENT": { "b": "GO", "e": [["v", "change location"]], "j": ["行く"] }
}
```

| フィールド | 型 | 意味 |
|---|---|---|
| `e` | `[string, string][]` | 英英定義。`[品詞, 定義文]` の配列。品詞は `n` / `v` / `a` / `r` |
| `j` | `string[]` | 和訳。先頭 3 件まで |
| `b` | `string` | 原形。語自身が原形の場合は付けない |

**サイズ最適化の規則:**

- 語自身が原形なら `b` を持たず、`e` と `j` を実体で持つ
- 屈折形で**原形が同じバケット内にある**場合（先頭文字が同じ）は `b` のみを持ち、定義本体は持たない
- 屈折形で**原形が別バケットにある**場合（`WENT → GO`、`MICE → MOUSE`、`BETTER → GOOD`）は、`b` に加えて `e` と `j` を**実体でコピーする**

最後の規則が本仕様で最も間違えやすい点である。不規則形は先頭文字が変わるため、参照だけにするとローダが別バケットを引く羽目になり、`WENT` を押しても何も出ないバグになる。

見出しは `word-list` の全語（現状 274,137 語）のうち、§4 で原形解決でき、かつ WordNet か ejdict のいずれかに定義が存在するものに限定する。`e` と `j` の両方が空になる語は載せない。

## 6. 実行時ローダ

`src/lookup/dictLoader.ts`。design.md §6.2 の方針を踏襲する。

```typescript
export type Definition = { e: [string, string][]; j: string[]; b?: string };
export type Bucket = Record<string, Definition>;

export function createDictLoader(fetchImpl = fetch) {
  const cache = new Map<string, Bucket>();
  const inflight = new Map<string, Promise<Bucket>>();

  async function loadBucket(letter: string): Promise<Bucket> { /* cache → inflight → fetch */ }

  async function lookup(word: string): Promise<Definition | null> { /* §6.1 */ }

  return { lookup };
}
```

- `fetchImpl` を引数で受けるのはテストでモックを差し込むため。既定は global の `fetch`
- キャッシュは `Map` のみ。バケットは最大 26 個で数 MB なので LRU は不要
- 同じバケットへの並行リクエストは `inflight` で 1 本にまとめる
- fetch 先は `${import.meta.env.BASE_URL}dict/defs/${letter}.json`

### 6.1 lookup の解決順

1. `word` を大文字化し、先頭文字からバケットを決めて読み込む
2. バケットに `word` が無ければ `null`
3. エントリに `e` か `j` があればそれを返す
4. `e` も `j` も無く `b` だけがある場合は、**同じバケット内**の `b` のエントリを引いて返す（§5 の規則により、別バケットの原形を参照する必要は生じない）
5. `b` の参照先も無ければ `null`

追加の fetch は発生しない。

## 7. UI

### 7.1 WordChip

履歴パネル（`src/App.tsx` の `<details>` 内）と「直前手」表示の単語を、`<button>` のチップに置き換える。`MoveRecord.wordsFormed: string[]`（`src/game/types.ts:42`）をそのまま使う。

- タッチターゲットは既存方針どおり最小 44×44px
- `move.kind` が `place` 以外（`pass` / `exchange`）の手には単語が無いのでチップを出さない
- `aria-label` は `{word} の意味を見る`

### 7.2 DefinitionSheet

既存の `src/ui/Sheet.tsx`（`{ title, onDismiss, children }`）をそのまま使う。モバイルではボトムシート、PC では中央モーダルになる。design.md §5.1 は PC を「下部固定パネル」としているが、既存コンポーネントの再利用を優先してこの点は仕様を変更する。

表示内容:

- タイトルは単語そのもの
- 原形が異なる場合は `CATS ← CAT` のように原形を併記する
- 英英セクション: 品詞ラベル（`n.` / `v.` / `adj.` / `adv.`）と定義文
- 英和セクション: 和訳を最大 3 件

### 7.3 状態

`src/lookup/useDefinition.ts` が返すのは次の 4 状態のみ:

| 状態 | 表示 |
|---|---|
| `loading` | スケルトン |
| `found` | §7.2 の内容 |
| `not-found` | 「この単語の意味は収録されていません」 |
| `error` | 「読み込みに失敗しました」+ 再試行ボタン |

シートを閉じてから開き直した場合、バケットはキャッシュ済みなので `loading` はほぼ一瞬で終わる。

## 8. エラー処理

- fetch が失敗（ネットワーク断、404、JSON パース失敗）した場合は `error` 状態にし、**例外を上位に投げない**
- 失敗したバケットは `inflight` から削除し、キャッシュにも入れない。再試行ボタンで再度 fetch できる
- 辞書の失敗は `GameState.lastError` に**書かない**。ゲームのエラー表示とは独立させる

## 9. テスト戦略

生成物（`public/dict/defs/`）は `.gitignore` 対象で `prebuild` でしか作られないため、**テストは生成物に依存させずフィクスチャで完結させる**。これは既存の `twl06.txt` と同じ扱い。

| 対象 | 種類 | 検証内容 |
|---|---|---|
| `scripts/lib/lemmatize.mjs` | 単体 | 規則形（CATS→CAT, CITIES→CITY, HOPING→HOPE）、不規則形（WENT→GO, MICE→MOUSE, BORN→BEAR, BORNE→BEAR）、誤剥がしの棄却（BUS が BU にならない）、原形そのもの（CAT→CAT） |
| `scripts/lib/ejdict.mjs` | 単体 | カンマ複合キー `"born, borne"` が 2 エントリに分割される。`^[A-Z]+$` でないキーが捨てられる。値が ` / ` で分割され trim される |
| `src/lookup/dictLoader.ts` | 単体 | モック `fetch` で、同バケットへの並行 2 回が fetch 1 回で済む（inflight dedup）。`b` のみのエントリが同バケット内で解決される。未知語で `null`。fetch 失敗時に例外を投げずキャッシュを汚さない |
| `src/ui/WordChip.tsx` | コンポーネント | `place` の手にチップが出る。`pass` / `exchange` には出ない。クリックでコールバックが単語つきで呼ばれる |
| `src/ui/DefinitionSheet.tsx` | コンポーネント | `loading` / `found` / `not-found` / `error` の 4 状態がそれぞれ描画される。原形併記が出る。再試行ボタンが再取得を呼ぶ |
| `scripts/build-defs.mjs` | スモーク | 小さなフィクスチャ入力から生成し、`CATS` が `CAT` を参照するだけであること、`WENT` が定義を実体で持つこと（バケット跨ぎ）を検証 |

## 10. 既存コードへの影響

| ファイル | 変更 |
|---|---|
| `package.json` | devDependencies に `wordnet-db` / `ejdict` 追加。`build:defs` スクリプト追加。`predev` / `prebuild` / `prepreview` から `build-defs.mjs` も呼ぶ |
| `.gitignore` | `public/dict/defs/` を追加 |
| `src/App.tsx` | 履歴と「直前手」の単語表示を `WordChip` に置き換え、`DefinitionSheet` の開閉状態を持つ |
| `src/game/*` | **変更なし**。辞書表示はゲームロジックに影響しない |
| `.github/workflows/deploy.yml` | **変更なし**。`prebuild` 経由で生成されるため |
| `README.md` | Plan 3 完了を反映 |

`src/App.tsx` は既にやや大きいが、本仕様で足すのはシートの開閉状態（`useState<string | null>`）と `WordChip` への差し替えのみで、表示ロジックは `DefinitionSheet` 側に閉じる。

## 11. 完了条件

- `npm run test` が全て PASS
- `npm run lint` がエラー 0 かつ警告 0
- `npm run build` が成功し、`dist/dict/defs/{a..z}.json` が生成される
- 対局中に単語チップをタップすると、英英定義と和訳が表示される
- `CATS` をタップすると `CAT` の定義が原形併記つきで表示される
- `WENT` をタップすると `GO` の定義が表示される（バケット跨ぎ）
- 辞書ファイルを 404 にしても、エラー表示が出るだけでゲームは継続できる
