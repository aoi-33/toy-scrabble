import { Sheet } from './Sheet';

// WordNet ライセンスは著作権表示と免責を全コピーに添付することを配布条件にしているため、
// 要約せず node_modules/wordnet-db/LICENSE の原文をそのまま載せる。
const WORDNET_NOTICE = `WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.

THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS" AND PRINCETON
UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR
IMPLIED. BY WAY OF EXAMPLE, BUT NOT LIMITATION, PRINCETON
UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES OF MERCHANT-
ABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE
OF THE LICENSED SOFTWARE, DATABASE OR DOCUMENTATION WILL NOT
INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS, TRADEMARKS OR
OTHER RIGHTS.

The name of Princeton University or Princeton may not be used in
advertising or publicity pertaining to distribution of the software
and/or database. Title to copyright in this software, database and
any associated documentation shall at all times remain with
Princeton University and LICENSEE agrees to preserve same.`;

export function AboutSheet({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Sheet title="ABOUT" onDismiss={onDismiss}>
      {/* 本文は日本語が主体。Press Start 2P は ASCII しか持たず和文が別フォントに
          落ちて字面が揃わないので、ここだけ font-pixel を外す */}
      <div className="text-xs leading-relaxed text-stone-200 text-left space-y-3 max-w-sm">
        <p>日本人英語学習者向けの Scrabble。ソースコードは MIT ライセンスです。</p>

        <section>
          <h3 className="text-stone-400 mb-1">単語リスト</h3>
          <p>
            274,137 語。npm word-list（元データは atebits/Words）を使用。
            パッケージは MIT、元データは CC0-1.0 です。
            公式トーナメント辞書の TWL06 / NWL は使っていません。
          </p>
        </section>

        <section>
          <h3 className="text-stone-400 mb-1">和訳</h3>
          <p>EJDict（kujirahand/EJDict、パブリックドメイン）より。</p>
        </section>

        <section>
          <h3 className="text-stone-400 mb-1">フォント</h3>
          <p>Press Start 2P（SIL Open Font License 1.1）。</p>
        </section>

        <section>
          <h3 className="text-stone-400 mb-1">英英定義: WordNet 3.1</h3>
          <pre className="whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-stone-300">
            {WORDNET_NOTICE}
          </pre>
          <p className="mt-1 text-stone-400">
            本アプリは Princeton University とは無関係であり、推奨・承認を受けたものではありません。
          </p>
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
