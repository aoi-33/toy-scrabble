# Toy Scrabble

日本人英語学習者向けの Scrabble（英単語クロスワードボードゲーム）静的サイト。
現時点でフリープレイ + COM 対戦 (Easy/Medium/Hard) に対応しています。
英英・英和辞書表示（Plan 3）、モバイル対応と GitHub Pages デプロイ（Plan 4）も実装済みです。

## 遊び方（Plan 1 時点）

1. ホーム画面で `FREE PLAY` / `COM EASY` / `COM MEDIUM` / `COM HARD` から選択してゲーム開始
2. COM 対戦時、相手の手番中は "🤖 COM 思考中…" が表示され、Rack と ActionBar がロックされます
3. 手札のタイルをクリック → 空マスをクリック、または手札をドラッグしてマスに置く
4. すべてのタイルを置いたら `PLAY` を押す（259,416 語の英単語リストで検証）
5. `RECALL` で全ての pending タイルを手札に戻す
6. `EXCHANGE` で手札の一部を袋のタイルと入れ替える（袋残 7 枚以上のとき）
7. `PASS` でターンをスキップ（6 連続で終了）
8. どちらかがタイルを使い切って袋が空、または 6 連続 Pass でゲーム終了
9. 「直前手」と「履歴」に出る単語をタップすると、発音記号（IPA）と英英定義（品詞ごとに 1 件）、和訳（最大 3 件）が表示されます

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

## 変更履歴

- **2026-09-12** 英単語の発音記号（IPA）を定義シートに表示するようにした。英語版 Wiktionary の `sounds` から音素表記を抽出し、UK（RP）と US（GA）のタグが両方あれば併記する。収録率は playable な語の 43.8%（2 文字語 95.2% / 3 文字語 85.5%）。あわせて Wiktionary データを最新の kaikki.org ダンプから作り直したため、意味を引ける語が増えて playable 259,278 → 259,416 語になった。
- **2026-09-11** 意味を出せない語（`GIE` など Scots 由来や Collins 特有の語 14,859 語）を単語リストから除外し、playable な語の収録率を 100% にした。あわせて Wiktionary にしか無い語の屈折形（`ABOLISHERS` → `ABOLISH`）を原形にリンクできていなかったバグを修正。playable 274,137 → 259,278 語。
- **2026-09-11** favicon を追加し、スマートフォンのホーム画面にアプリとして追加できるようにした（Web App Manifest + Service Worker）。アイコンは Flaticon（作者: Icon.doit）。
- **2026-09-11** 単語の意味が出ないケースを解消。英英定義に Wiktionary を追加し、収録率を 43.9% → 88.9% に改善（2 文字語 100% / 3 文字語 96.8%）。WordNet が持たない機能語（`IF` / `OF` / `AND`）や専門語（`ARGAN`）も引けるようになりました。
- **2026-09-10** 外部データソースのライセンス表記を README と画面内 About モーダルに追加。あわせて辞書ファイルを実態に合わせ `twl06.txt` → `words.txt` に改名（中身は TWL06 ではなく CC0 の単語リスト）。
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

辞書ファイル `public/dict/words.txt` は `.gitignore` 済みですが、`prebuild` が npm の `word-list` パッケージから毎回生成するため CI でも同じものが作られます。

定義ファイル `public/dict/defs/{a..z}.json` も `.gitignore` 済みですが、同じく `prebuild` が `wordnet-db`・`ejdict`・`data/wiktionary.json` から毎回生成します。

定義ファイルには発音記号も含まれます（合計 20.0MB）。

`build-defs.mjs` は定義を書き出したあと、**意味を出せなかった語を `words.txt` から削ります**。
元の 274,137 語には `GIE`（Scots）や `ZEX` のように英語辞書に載っていない語が 14,721 語あり、
盤に置けても意味が出ないと学習用途で困るためです。結果として playable な語は 259,416 語、
そのすべてに英英か和訳が付きます（収録率 100%）。

`data/wiktionary.json` は生成物ですが**リポジトリにコミットしています**（17 MB）。元になる kaikki.org の
JSONL が 3.3 GB あり CI で毎回落とすのは現実的でないためです。更新したいときだけ手元で次を実行します。

```bash
curl -O https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl
npm run build:wiktionary -- ./kaikki.org-dictionary-English.jsonl
```

## 対応環境

- スマートフォン（幅 320px 〜）: 手札と操作ボタンは画面下部に固定。タイルは長押しでドラッグ、タップでも配置できます
- PC（幅 769px 〜）: Enter で PLAY、Escape で仮配置を全て戻す

### ホーム画面に追加する

公開 URL をブラウザで開き、ホーム画面に追加するとアドレスバー無しのアプリとして起動します。

- iOS Safari: 共有 → 「ホーム画面に追加」
- Android Chrome: メニュー → 「アプリをインストール」

Service Worker（`public/sw.js`）を登録しているのでオフラインでも遊べます。登録は本番ビルドのみで、
`npm run dev` では HMR と衝突しないよう無効です。キャッシュ方針は `/assets/`（ファイル名にハッシュが
付く）だけ cache-first、辞書ファイルなどそれ以外は network-first です。

## ライセンス

このリポジトリのソースコードは MIT ライセンスです。

配信物には以下の外部データが含まれます。画面内の `ABOUT` ボタンからも同じ内容を確認できます。

| 資産 | ソース | ライセンス |
|---|---|---|
| 英単語リスト (259,416 語) | npm [`word-list`](https://www.npmjs.com/package/word-list) → [atebits/Words](https://github.com/atebits/Words) | パッケージは MIT、元データは CC0-1.0 |
| 英英定義 (WordNet 3.1) | npm [`wordnet-db`](https://www.npmjs.com/package/wordnet-db)（Princeton University） | WordNet License（下記） |
| 英英定義（WordNet に無い語） | [kaikki.org](https://kaikki.org/dictionary/English/) 経由の英語版 [Wiktionary](https://en.wiktionary.org/) | CC BY-SA 3.0（下記） |
| 和訳 (EJDict) | npm [`ejdict`](https://www.npmjs.com/package/ejdict) → [kujirahand/EJDict](https://github.com/kujirahand/EJDict) | MIT（元データはパブリックドメイン） |
| Press Start 2P フォント | Google Fonts（CDN 参照） | SIL Open Font License 1.1 |
| アプリアイコン / favicon | [Flaticon](https://www.flaticon.com/free-icon/letter-a_5584532)（作者: Icon.doit） | Flaticon Free License（作者表示が必要） |
| `@dnd-kit/core`, `@dnd-kit/utilities` | npm | MIT |

**単語リストは TWL06 / NWL ではありません。** これらは NASPA の専有物でライセンス契約が必要なため使用していません。
本アプリの単語リストは CC0-1.0 の Letterpress Word List で、再配布に制約はありません。

### Wiktionary (CC BY-SA 3.0)

WordNet は名詞・動詞・形容詞・副詞しか収録しておらず、`IF` / `OF` / `AND` のような機能語や
`ARGAN` のような専門語の意味が出せませんでした。これを補うため、英語版 Wiktionary の
機械可読版（[kaikki.org](https://kaikki.org/dictionary/English/) が公開する JSONL）から
語義を抽出して `data/wiktionary.json` に入れています。

Wiktionary の本文は **CC BY-SA 3.0** です。他のデータと違い**継承（share-alike）条項がある**ため、
派生物である `data/wiktionary.json` と `public/dict/defs/{a..z}.json` の Wiktionary 由来部分も
同じく CC BY-SA 3.0 で提供されます。リポジトリのソースコード自体は MIT のままです。

- 原典: <https://en.wiktionary.org/>
- ライセンス全文: <https://creativecommons.org/licenses/by-sa/3.0/>
- **加えた変更**: 語義は品詞ごとに先頭の 1 件だけを残し、120 文字を超える場合は末尾を省略しています。
  見出しは大文字に正規化し、A-Z 以外を含む見出しは除外しています。
  発音記号は音素表記（`/.../`）だけを採用し、狭い音声表記（`[...]`）は除外しています。
  UK（Received-Pronunciation）と US（General-American）のタグが付いたものを優先し、
  無ければタグの無い先頭 1 件だけを残しています。

### WordNet License

WordNet ライセンスは、著作権表示と免責を**すべての複製に添付すること**を配布の条件としています。
以下は `node_modules/wordnet-db/LICENSE` からの原文です。

```
WordNet 3.0 Copyright 2006 by Princeton University.  All rights reserved.

THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS" AND PRINCETON
UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR
IMPLIED.  BY WAY OF EXAMPLE, BUT NOT LIMITATION, PRINCETON
UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES OF MERCHANT-
ABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE
OF THE LICENSED SOFTWARE, DATABASE OR DOCUMENTATION WILL NOT
INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS, TRADEMARKS OR
OTHER RIGHTS.

The name of Princeton University or Princeton may not be used in
advertising or publicity pertaining to distribution of the software
and/or database.  Title to copyright in this software, database and
any associated documentation shall at all times remain with
Princeton University and LICENSEE agrees to preserve same.
```

本アプリは Princeton University とは無関係であり、同大学から推奨・承認を受けたものではありません。
