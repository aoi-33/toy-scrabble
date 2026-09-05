# Toy Scrabble

日本人英語学習者向けの Scrabble（英単語クロスワードボードゲーム）静的サイト。
現時点でフリープレイ + COM 対戦 (Easy/Medium/Hard) に対応しています。
英英・英和辞書表示（Plan 3）、モバイル対応と GitHub Pages デプロイ（Plan 4）は後続計画で実装します。

## 遊び方（Plan 1 時点）

1. ホーム画面で `FREE PLAY` / `COM EASY` / `COM MEDIUM` / `COM HARD` から選択してゲーム開始
2. COM 対戦時、相手の手番中は "🤖 COM 思考中…" が表示され、Rack と ActionBar がロックされます
3. 手札のタイルをクリック → 空マスをクリック、または手札をドラッグしてマスに置く
4. すべてのタイルを置いたら `PLAY` を押す（辞書 = TWL06 サンプルで検証）
5. `RECALL` で全ての pending タイルを手札に戻す
6. `EXCHANGE` で手札の一部を袋のタイルと入れ替える（袋残 7 枚以上のとき）
7. `PASS` でターンをスキップ（6 連続で終了）
8. どちらかがタイルを使い切って袋が空、または 6 連続 Pass でゲーム終了

## ローカル起動

Node.js のバージョンは [mise](https://mise.jdx.dev/) で管理しています。

```bash
mise install       # node 22 をインストール
npm install        # 依存インストール
npm run dev        # http://localhost:5173/toy-scrabble/
```

## テスト

```bash
npm run test       # unit + component (Vitest)
```

## Plan 1 の制限事項

- 辞書は `public/dict/twl06.sample.txt`（サンプル数十語）のみ。フル TWL06（18 万語）は Plan 3 で導入
- 単語の意味表示（英英・英和辞書）は未実装 → Plan 3 で導入予定
- モバイル最適化・GitHub Pages 自動デプロイは未実装

## 変更履歴

- **2026-09-06** Plan 2 完了: COM 対戦 (Easy / Medium / Hard) を追加。AI は Web Worker で動作、思考時間 ≤ 1s。
- **2026-09-05** Plan 1 完了: フリープレイでの基本ゲームプレイを実装。

## リポジトリ

- GitHub: `aoi-33/toy-scrabble`
- デプロイ URL（Plan 4 完了後）: `https://aoi-33.github.io/toy-scrabble/`

## ライセンス

MIT
