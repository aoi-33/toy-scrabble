import { Sheet } from './Sheet';

export function RulesSheet({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Sheet title="RULES" onDismiss={onDismiss}>
      {/* 本文は日本語が主体。Press Start 2P は ASCII しか持たず和文が別フォントに
          落ちて字面が揃わないので、ここだけ font-pixel を外す */}
      <div className="text-xs leading-relaxed text-stone-200 text-left space-y-3 max-w-sm">
        <section>
          <h3 className="text-stone-400 mb-1">目的</h3>
          <p>手札の 7 枚で英単語を作り、得点を競います。</p>
        </section>

        <section>
          <h3 className="text-stone-400 mb-1">手順</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>タイルをタップしてから盤のマスをタップすると置けます（ドラッグでも置けます）</li>
            <li>PLAY で確定します。条件を満たさないときはエラーが出て、タイルは盤に残ります</li>
            <li>RECALL で置いたタイルをまとめて手札に戻せます</li>
          </ol>
        </section>

        <section>
          <h3 className="text-stone-400 mb-1">置きかた</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>1 手で置くタイルは同じ行か同じ列に一直線に並べます</li>
            <li>間に隙間を空けられません</li>
            <li>初手は中央の ★ を通します</li>
            <li>2 手目以降は必ず既存のタイルに隣接させます</li>
            <li>できた語は縦横どちらも辞書に載っている必要があります</li>
          </ul>
        </section>

        <section>
          <h3 className="text-stone-400 mb-1">得点</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>置いたタイルの点数の合計です</li>
            <li>DL / TL はその文字が 2 倍 / 3 倍になります</li>
            <li>DW / TW はその単語が 2 倍 / 3 倍になります。中央の ★ は DW と同じ扱いです</li>
            <li>プレミアムマスはそのターンに置いたタイルの分だけ効きます。すでに盤にあるタイルの下では効きません</li>
            <li>手札 7 枚をすべて使い切ると +50 点です</li>
          </ul>
        </section>

        <section>
          <h3 className="text-stone-400 mb-1">その他</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>EXCHANGE は袋に 7 枚以上残っているときだけ使えます</li>
            <li>PASS は手番を飛ばします。6 回連続でゲーム終了です</li>
            <li>袋が空になり、どちらかが手札を使い切るとゲーム終了です</li>
            <li>空白タイルは 2 枚あり、任意の文字として使えますが 0 点です。DL / TL を踏んでも 0 点のままです</li>
            <li>終了時、手札に残ったタイルの点数は自分の得点から引かれます。先に使い切った側には相手の残り点が加算されます</li>
            <li>「直前手」と「履歴」の単語をタップすると、発音記号・英英定義・和訳が出ます</li>
          </ul>
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
