# Toy Scrabble

日本人英語学習者向けの Scrabble（英単語クロスワードボードゲーム）静的サイト。
現時点（Plan 1）ではローカル 2 人フリープレイのみに対応します。
COM 対戦（Plan 2）、英英・英和辞書表示（Plan 3）、モバイル対応と GitHub Pages デプロイ（Plan 4）は後続計画で実装します。

## 遊び方（Plan 1 時点）

1. `NEW GAME` を押すとゲームが始まります（フリープレイ = P1 と COM の枠を人間 2 人で交互に操作）
2. 手札のタイルをクリック → 空マスをクリック、または手札をドラッグしてマスに置く
3. すべてのタイルを置いたら `PLAY` を押す（辞書 = TWL06 サンプルで検証）
4. `RECALL` で全ての pending タイルを手札に戻す
5. `EXCHANGE` で手札の一部を袋のタイルと入れ替える（袋残 7 枚以上のとき）
6. `PASS` でターンをスキップ（6 連続で終了）
7. どちらかがタイルを使い切って袋が空、または 6 連続 Pass でゲーム終了

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
- COM AI は未実装。両プレイヤーとも人間が操作
- 単語の意味表示は未実装
- モバイル最適化・GitHub Pages 自動デプロイは未実装

## リポジトリ

- GitHub: `aoi-33/toy-scrabble`
- デプロイ URL（Plan 4 完了後）: `https://aoi-33.github.io/toy-scrabble/`

## ライセンス

MIT
