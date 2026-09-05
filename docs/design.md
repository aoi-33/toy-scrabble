# Toy Scrabble — デザイン仕様書

作成日: 2026-09-05

## 概要

日本人英語学習者向けの、Scrabble（英単語クロスワードボードゲーム）静的サイト。フリープレイと COM 対戦（Easy / Medium / Hard の 3 難易度）に対応し、作成された英単語には英英・英和の両方の意味を表示する。

- **ローカルディレクトリ**: `scrabble/`
- **GitHub リポジトリ**: `aoi-33/toy-scrabble`
- **デプロイ URL**: `https://aoi-33.github.io/toy-scrabble/`

## 要件サマリ

| 項目 | 内容 |
|---|---|
| プレイモード | フリープレイ + COM 対戦（Easy / Medium / Hard） |
| ルール | 公式フル Scrabble（15×15、プレミアムマス、ブランクタイル、交換、Bingo 50点） |
| 単語検証 | TWL06（約 18 万語、~1.5MB、同梱） |
| 英英辞書 | WordNet 3.1（アルファベット別 JSON、lazy load） |
| 英和辞書 | ejdict-hand（アルファベット別 JSON、lazy load） |
| 入力 | ドラッグ&ドロップ + クリック（PC / touch 両対応） |
| デプロイ | GitHub Pages |
| ビジュアル | レトロ・ピクセルアート風 |
| ターゲット | PC + モバイル（レスポンシブ、375 / 768 / 1280px） |
| 技術スタック | Vite + React + TypeScript |
| 状態管理 | `useReducer` + Context |
| AI 実行環境 | Web Worker |

---

## § 1. 全体構成 / ディレクトリ

```
scrabble/
├── .mise.toml                    # node = 22
├── package.json                  # Vite + React + TypeScript + Tailwind + @dnd-kit + Vitest + Playwright
├── vite.config.ts                # base: '/toy-scrabble/'
├── tsconfig.json
├── tailwind.config.js
├── index.html
├── public/
│   └── dict/                     # 静的辞書アセット（.gitignore 対象、npm run build:dict で生成）
│       ├── twl06.txt
│       ├── en-en/
│       │   ├── manifest.json
│       │   ├── a.json
│       │   └── ...z.json
│       └── en-ja/
│           ├── manifest.json
│           ├── a.json
│           └── ...z.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── game/                     # Pure logic（React 非依存）
│   │   ├── types.ts
│   │   ├── board.ts              # 盤面操作・プレミアムマス定義
│   │   ├── bag.ts                # タイル袋（100 枚、シャッフル）
│   │   ├── rules.ts              # 配置合法性・単語抽出・スコア計算
│   │   ├── dictionary.ts         # TWL06 ロード & 検証
│   │   └── reducer.ts            # ゲーム state machine
│   ├── ai/                       # COM
│   │   ├── worker.ts             # Web Worker エントリ
│   │   ├── search.ts             # 合法手生成・評価（アンカー方式）
│   │   └── difficulty.ts         # Easy/Medium/Hard 選択戦略
│   ├── lookup/                   # 意味表示
│   │   └── dictLoader.ts         # bucket lazy load + inflight dedup
│   ├── ui/
│   │   ├── Board.tsx
│   │   ├── Tile.tsx
│   │   ├── Rack.tsx
│   │   ├── ScorePanel.tsx
│   │   ├── ActionBar.tsx
│   │   ├── ModeSelect.tsx
│   │   ├── BlankLetterModal.tsx
│   │   ├── WordDefinition.tsx
│   │   └── styles/
│   ├── state/
│   │   └── GameContext.tsx
│   └── utils/
│       └── dnd.ts                # @dnd-kit ラッパ
├── tests/                        # Vitest
│   ├── rules.test.ts
│   ├── reducer.test.ts
│   ├── ai.test.ts
│   └── dictLoader.test.ts
├── e2e/                          # Playwright
│   ├── gameplay.spec.ts
│   └── responsive.spec.ts
├── scripts/
│   ├── build-dict.mjs            # 生辞書 → bucket JSON 化
│   └── dict-sources/README.md    # 生辞書取得元とライセンス
├── .github/
│   └── workflows/
│       └── deploy.yml
└── README.md
```

---

## § 2. コアデータ型とゲーム状態

```typescript
// タイル
type Letter = 'A' | 'B' | ... | 'Z';
type Tile =
  | { kind: 'letter'; letter: Letter; points: number }
  | { kind: 'blank'; assigned: Letter | null; points: 0 };

// マス
type Coord = { r: number; c: number };  // 0..14
type Direction = 'H' | 'V';
type PremiumSquare = 'DL' | 'TL' | 'DW' | 'TW' | 'STAR' | null;
const PREMIUM_BOARD: PremiumSquare[][];  // 15x15 定数

// 盤面
type PlacedTile = { tile: Tile; placedTurn: number };
type Board = (PlacedTile | null)[][];

// 手札 / 配置
type Rack = Tile[];  // 最大 7
type PendingPlacement = { coord: Coord; tile: Tile; rackIndex: number };

// 手
type Move =
  | { kind: 'place'; placements: PendingPlacement[] }
  | { kind: 'exchange'; tileIndices: number[] }
  | { kind: 'pass' };

// プレイヤー
type Player = { id: 'P1' | 'COM'; name: string; score: number; rack: Rack };

// ゲーム状態
type GameStatus = 'setup' | 'playing' | 'ended';
type GameMode = 'free' | 'com-easy' | 'com-medium' | 'com-hard';

type GameState = {
  mode: GameMode;
  status: GameStatus;
  board: Board;
  bag: Tile[];
  players: [Player, Player];
  currentPlayerIndex: 0 | 1;
  turn: number;
  pending: PendingPlacement[];
  history: MoveRecord[];
  lastFormedWords: FormedWord[];
  consecutivePasses: number;
};

type MoveRecord = {
  player: 'P1' | 'COM';
  move: Move;
  wordsFormed: string[];
  score: number;
};

// Reducer アクション
type Action =
  | { type: 'START_GAME'; mode: GameMode }
  | { type: 'PLACE_PENDING'; placement: PendingPlacement }
  | { type: 'RECALL_PENDING'; coord: Coord }
  | { type: 'RECALL_ALL' }
  | { type: 'COMMIT_PLAY' }
  | { type: 'EXCHANGE'; indices: number[] }
  | { type: 'PASS' }
  | { type: 'SHUFFLE_RACK' }
  | { type: 'AI_MOVE_RESULT'; move: Move };
```

**設計原則:**
- Pure functions（`src/game/`）は React・DOM 非依存
- Reducer は毎回新しい state を返す（不変性）
- ブランクタイルは `kind: 'blank'` + `assigned` で選択文字を保持、得点は常に 0
- `pending` はコミット前の配置。「Recall」で手札に戻す、「Play」で検証 → 成功なら `board` に確定

---

## § 3. 合法性検証とスコア計算

### 3.1 配置合法性ルール

1. 少なくとも 1 枚配置している
2. すべての配置は一直線（同じ行 or 同じ列）
3. 一直線内に隙間がない（既存タイルで埋まっていれば可）
4. 初手はセンター (7,7) を通る
5. 2 手目以降は既存タイルに 1 枚以上隣接
6. 形成される全単語が TWL06 に存在（ブランクは `assigned` の文字として扱う）

### 3.2 スコア計算

```typescript
function scoreMove(board: Board, placements: PendingPlacement[]): number {
  const formedWords = extractAllFormedWords(board, placements);
  let total = 0;

  for (const w of formedWords) {
    let wordScore = 0;
    let wordMultiplier = 1;

    for (const { coord, tile, fromPending } of w.tiles) {
      let letterScore = tile.points;  // ブランクは 0
      if (fromPending) {
        const premium = PREMIUM_BOARD[coord.r][coord.c];
        if (premium === 'DL') letterScore *= 2;
        else if (premium === 'TL') letterScore *= 3;
        else if (premium === 'DW' || premium === 'STAR') wordMultiplier *= 2;
        else if (premium === 'TW') wordMultiplier *= 3;
      }
      wordScore += letterScore;
    }
    total += wordScore * wordMultiplier;
  }

  if (placements.length === 7) total += 50;  // Bingo
  return total;
}
```

### 3.3 単語抽出

- 主単語（配置方向）+ 各配置タイルから直交方向に伸びる副単語を全て抽出
- 1 文字だけの副単語は単語としてカウントしない

### 3.4 ゲーム終了条件

- どちらかが全タイル使い切り、袋も空 → 勝利側 +残タイル合計、敗北側 -残タイル合計
- 6 連続 Pass → 残タイル分だけ減点

---

## § 4. COM AI（Web Worker）

### 4.1 アーキテクチャ

- メインスレッド → `postMessage(REQUEST_MOVE, { snapshot, difficulty })` → Worker
- Worker → 合法手生成・評価 → `postMessage(MOVE_RESULT, { move })` → メインスレッド
- Worker は独立して辞書 (TWL06) をロード

```typescript
type WorkerRequest =
  | { type: 'INIT'; dictUrl: string }
  | { type: 'REQUEST_MOVE'; snapshot: AISnapshot; difficulty: 'easy' | 'medium' | 'hard' };

type WorkerResponse =
  | { type: 'READY' }
  | { type: 'MOVE_RESULT'; move: Move }
  | { type: 'ERROR'; message: string };

type AISnapshot = {
  board: (string | null)[][];  // 各マスの文字 or null（blank は小文字）
  rack: (Letter | 'BLANK')[];
  bagRemaining: number;
  isFirstMove: boolean;
};
```

### 4.2 合法手生成（アンカー方式）

1. アンカーマス列挙: 既存タイル隣接の空マス（初手ならセンター）
2. 各アンカー × 水平・垂直の 2 方向を試す
3. アンカーからプレフィックス（左/上）→ サフィックス（右/下）で候補生成
4. 辞書に含まれる単語のみ採用、副単語も検証

**最適化:**
- 辞書は `Set<string>` + プレフィックス Set（`"CA" in prefixes` で早期枝刈り）
- 手札のブランクは 26 文字全てを試す
- 有望なアンカー（センター寄り、高得点タイル近傍、プレミアム近傍）から順に処理

### 4.3 タイミング設計（合計 ≤ 1s）

| フェーズ | 時間 |
|---|---|
| Worker 呼び出し + snapshot 転送 | ~20ms |
| AI 探索（deadline） | Easy/Medium: 300ms、Hard: 700ms |
| state 反映 | ~30ms |
| 配置ハイライト演出 | 250ms |

- deadline を過ぎたら現時点でのベスト候補集合で選択
- 合法手 0 なら 交換 or Pass にフォールバック

### 4.4 難易度別選択戦略

- **Easy**: スコア下位 50% からランダム
- **Medium**: スコア上位 30% からランダム
- **Hard**: 最高得点（同点は手札リーフの母音バランスで tie-break）

### 4.5 手番外 UX

- COM 手番中は Rack と ActionBar を disabled
- "COM 思考中..." インジケータ
- COM が置いたタイルを 250ms ハイライト → スコア加算

---

## § 5. UI コンポーネントとインタラクション

### 5.1 レイアウト戦略（Mobile-First）

**ブレークポイント:**
- `sm`: 〜 480px（スマホ縦）
- `md`: 481 〜 768px（スマホ横 / 小型タブレット）
- `lg`: 769px 〜（PC）

**Mobile (〜768px):**
- Header（アプリ名 + アイコンメニュー）
- ScorePanel（コンパクト表示）
- Board（viewport 幅の 92%、cell = viewport/15、min 20px）
- Rack（sticky bottom）
- ActionBar（Play / Recall と、余ったボタンは `⋯` メニュー）
- WordDefinition は bottom sheet として下から展開

**PC (769px 〜):**
- 横並びレイアウト、WordDefinition は下部固定パネル

### 5.2 主要コンポーネント

| コンポーネント | 責務 |
|---|---|
| `Board` | 15×15 グリッド、プレミアムマス表示、ドロップ受け入れ |
| `Tile` | 32×32px（PC）/ viewport 依存（モバイル）、木目調ピクセルアート、4 バリアント |
| `Rack` | 手札 7 枚表示、並び替え、Shuffle |
| `ScorePanel` | 両プレイヤーの得点、袋残数 |
| `ActionBar` | Play / Recall / Exchange / Shuffle / Pass |
| `ModeSelect` | New Game ドロップダウン（Free / COM Easy/Medium/Hard） |
| `BlankLetterModal` | ブランクタイルの文字選択（26 グリッド） |
| `WordDefinition` | 直近手で作られた単語チップ、クリックで英英/英和展開 |

### 5.3 入力: Pointer Events 統一（@dnd-kit）

- HTML5 DnD は touch 未対応のため、**@dnd-kit/core**（~10KB gzipped）を採用
- クリック配置モードも維持: 手札タイルクリック → 選択 → 空マスクリック
- モバイル: ロングプレス（500ms）で選択メニュー、ダブルタップで盤面ズームリセット
- ブランクタイル配置直後に `BlankLetterModal` 表示

### 5.4 モバイル特有の考慮

- 盤面ピンチズーム（最大 2x）、2 本指パン
- Play ボタン押下時に「作られた単語: CAT, BATE」確認 bottom sheet
- モーダルは PC = 中央、モバイル = full-screen or bottom sheet
- タッチターゲット最小 44×44px（WCAG 2.5.5）

### 5.5 スタイル方針

- **Tailwind CSS**（レスポンシブユーティリティ）
- タイトル・得点表示: `Press Start 2P`（ピクセルフォント、Google Fonts）
- 本文: system-ui
- カラーパレット（8 色以内）:
  - 盤面背景: 深緑 `#2a5934`
  - 通常マス: 淡ベージュ `#d9c9a3`
  - DL/TL/DW/TW: 水色/青/ピンク/赤
  - タイル木目: `#e8c07d` + 2px ドロップシャドウ
- カラーコントラスト WCAG AA 準拠

### 5.6 キーボードショートカット（PC のみ）

- `Enter`: Play
- `Esc`: Recall All
- `Space`: Shuffle
- `1`〜`7`: 手札 N 番目選択

### 5.7 エラー表示

Play ボタン押下で違反時、盤面下に赤バナーで理由を 3 秒表示:
- "初手はセンターを通ってください"
- "配置は一直線に並べてください"
- "'XYZ' は辞書にありません"

### 5.8 実装時に活用するスキル

| スキル | 用途 |
|---|---|
| `ecc:frontend-design-direction` | レトロ・ピクセルアート方向性の具体化 |
| `ecc:accessibility` | WCAG 2.2、キーボードナビ、色コントラスト、SR 対応 |
| `ecc:frontend-patterns` | React + Vite の一般パターン、エラー境界 |
| `ecc:make-interfaces-feel-better` | タイル配置アニメーション、フィードバック |
| `ecc:tdd-workflow` | `game/`, `ai/` 配下の Pure function TDD |
| `ecc:e2e-testing` / `ecc:browser-qa` | Playwright で 375 / 768 / 1280px 検証 |

---

## § 6. 辞書ローダ・ビルドスクリプト・テスト戦略

### 6.1 辞書アセット生成（`scripts/build-dict.mjs`）

生辞書はリポジトリに含めず、`npm run build:dict` で `public/dict/` を生成（`.gitignore` 対象）。

**入力:**
- `scripts/dict-sources/twl06.txt`（scrabblewords リポジトリ等）
- `scripts/dict-sources/wordnet-3.1/`（Princeton WordNet）
- `scripts/dict-sources/ejdict-hand.sqlite`（kujirahand/EJDict）

**出力:**
- `public/dict/twl06.txt`（そのままコピー）
- `public/dict/en-en/{a..z}.json` + `manifest.json`
- `public/dict/en-ja/{a..z}.json` + `manifest.json`

**生成ロジック:**
- WordNet の `data.*` をパースし頭文字別 bucket 化
- ejdict-hand SQLite から `word` / `mean` を抽出、頭文字別 bucket 化
- **TWL06 に存在する単語のみ保存**（サイズ削減）
- 各 bucket ~500KB（uncompressed）、全体 ~8MB / ~2-3MB gzip

### 6.2 辞書ローダ（`src/lookup/dictLoader.ts`）

```typescript
class DictLoader {
  private cache = new Map<string, Bucket>();
  private inflight = new Map<string, Promise<Bucket>>();

  async lookup(kind: 'en-en' | 'en-ja', word: string): Promise<Definition | null> {
    const bucket = word[0].toLowerCase();
    const key = `${kind}:${bucket}`;
    let data = this.cache.get(key);
    if (!data) {
      let promise = this.inflight.get(key);
      if (!promise) {
        promise = fetch(`${import.meta.env.BASE_URL}dict/${kind}/${bucket}.json`)
          .then(r => r.json())
          .then((d: Bucket) => { this.cache.set(key, d); this.inflight.delete(key); return d; });
        this.inflight.set(key, promise);
      }
      data = await promise;
    }
    return data[word.toUpperCase()] ?? null;
  }
}
```

- 並行リクエストは inflight dedup
- LRU なし（bucket 数上限 52、全部キャッシュしても数 MB）
- TWL06 ロードは別関数（起動時にメイン + Worker それぞれで Set 化）

### 6.3 テスト戦略

| レイヤー | ツール | 対象 | 目標時間 |
|---|---|---|---|
| Unit | Vitest | `src/game/*`, `src/ai/*` | < 5s |
| Component | Vitest + RTL | `src/ui/*` | < 15s |
| E2E | Playwright | シナリオ + レスポンシブ | < 60s |

**Unit テスト（TDD で書く）:**
- `rules.test.ts`: 配置合法性ルール個別 fail、スコア計算（プレミアム / ブランク / Bingo）、副単語抽出
- `reducer.test.ts`: 各アクションの state 遷移、成功/失敗時の不変性、6 連続 Pass 終了
- `ai.test.ts`: 合法手生成、ブランク使用、deadline 打ち切りで部分結果、Easy/Medium/Hard の分布
- `dictLoader.test.ts`: MSW モック、lazy load、dedup、キャッシュ

**Component テスト:**
- `<Board>` ドロップ、`<Tile>` 4 バリアント、`<BlankLetterModal>`、`<WordDefinition>` 展開

**E2E:**
- `gameplay.spec.ts`: New Game → タイル配置 → Play → COM 手番 → Recall / Exchange / Definition
- `responsive.spec.ts`: 375 / 768 / 1280px でスクリーンショット比較、モバイル touch 配置、bottom sheet

### 6.4 CI / デプロイ

`.github/workflows/deploy.yml`:

```yaml
on: { push: { branches: [main] } }
jobs:
  build-and-deploy:
    steps:
      - checkout
      - setup mise (node 22)
      - npm ci
      - npm run build:dict
      - npm run test         # unit + component
      - npm run build        # vite build (base: /toy-scrabble/)
      - actions/deploy-pages
```

E2E は PR 時に別ジョブで実行（デプロイをブロックしない）。

### 6.5 パフォーマンス目標

- 初回ロード（TWL06 + JS bundle）: ≤ 500KB gzip
- 初画面表示 (LCP): ≤ 1.5s（3G 想定）
- COM 手番の総ラグ: ≤ 1s
- 辞書 bucket lazy load: 初回 ≤ 300ms

---

## 外部データソースとライセンス

| 資産 | ソース | ライセンス |
|---|---|---|
| TWL06 word list | `scrabblewords/wordlists` (GitHub) | 公開リスト（アプリ配布可、詳細は README で明示） |
| WordNet 3.1 | Princeton University | WordNet License（表示要件あり） |
| ejdict-hand | `kujirahand/EJDict` | パブリックドメイン |
| Press Start 2P フォント | Google Fonts | SIL Open Font License |
| `@dnd-kit/core` | npm | MIT |

各ライセンス表示は `README.md` および画面内 About モーダルに明記。

---

## 依存パッケージ一覧（想定）

**dependencies:**
- `react`, `react-dom`
- `@dnd-kit/core`, `@dnd-kit/utilities`

**devDependencies:**
- `vite`, `@vitejs/plugin-react`
- `typescript`, `@types/react`, `@types/react-dom`
- `tailwindcss`, `postcss`, `autoprefixer`
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `msw`
- `@playwright/test`
- `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`
