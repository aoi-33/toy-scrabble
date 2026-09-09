# Toy Scrabble

日本人英語学習者向けの Scrabble（英単語クロスワードボードゲーム）静的サイト。
現時点でフリープレイ + COM 対戦 (Easy/Medium/Hard) に対応しています。
英英・英和辞書表示（Plan 3）、モバイル対応と GitHub Pages デプロイ（Plan 4）も実装済みです。

## 遊び方（Plan 1 時点）

1. ホーム画面で `FREE PLAY` / `COM EASY` / `COM MEDIUM` / `COM HARD` から選択してゲーム開始
2. COM 対戦時、相手の手番中は "🤖 COM 思考中…" が表示され、Rack と ActionBar がロックされます
3. 手札のタイルをクリック → 空マスをクリック、または手札をドラッグしてマスに置く
4. すべてのタイルを置いたら `PLAY` を押す（辞書 = TWL06 サンプルで検証）
5. `RECALL` で全ての pending タイルを手札に戻す
6. `EXCHANGE` で手札の一部を袋のタイルと入れ替える（袋残 7 枚以上のとき）
7. `PASS` でターンをスキップ（6 連続で終了）
8. どちらかがタイルを使い切って袋が空、または 6 連続 Pass でゲーム終了
9. 「直前手」と「履歴」に出る単語をタップすると、英英定義（品詞ごとに 1 件）と和訳（最大 3 件）が表示されます

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

## 変更履歴

- **2026-09-09** Plan 3 完了: 履歴の単語から英英・英和辞書を引けるようにした。定義は WordNet 3.1 と ejdict からビルド時に生成し（120,435 語 / 計 9.8 MB）、先頭文字ごとの JSON を遅延読み込みする。
- **2026-09-07** Plan 4 完了: モバイル対応（レスポンシブ盤面・タッチドラッグ・ボトムシート）と GitHub Pages 自動デプロイを追加。
- **2026-09-06** Plan 2 完了: COM 対戦 (Easy / Medium / Hard) を追加。AI は Web Worker で動作、思考時間 ≤ 1s。
- **2026-09-05** Plan 1 完了: フリープレイでの基本ゲームプレイを実装。

## リポジトリ

- GitHub: `aoi-33/toy-scrabble`

## デプロイ

`main` へ push すると GitHub Actions（`.github/workflows/deploy.yml`）が lint → test → build を実行し、`dist/` を GitHub Pages へ publish します。

公開 URL: `https://aoi-33.github.io/toy-scrabble/`

初回のみリポジトリ側で以下の設定が必要です。

1. GitHub 上に `aoi-33/toy-scrabble` リポジトリを作成する
2. `git remote add origin git@github.com:aoi-33/toy-scrabble.git && git push -u origin main`
3. Settings → Pages → Build and deployment → Source を **GitHub Actions** に変更する

**3 は初回 push より前に済ませてください。** 未設定のまま push すると deploy ジョブが `Get Pages site failed` で失敗します。

辞書ファイル `public/dict/twl06.txt` は `.gitignore` 済みですが、`prebuild` が npm の `word-list` パッケージから毎回生成するため CI でも同じものが作られます。

定義ファイル `public/dict/defs/{a..z}.json` も `.gitignore` 済みですが、同じく `prebuild` が `wordnet-db` と `ejdict` から毎回生成します。

## 対応環境

- スマートフォン（幅 320px 〜）: 手札と操作ボタンは画面下部に固定。タイルは長押しでドラッグ、タップでも配置できます
- PC（幅 769px 〜）: Enter で PLAY、Escape で仮配置を全て戻す

## ライセンス

MIT
