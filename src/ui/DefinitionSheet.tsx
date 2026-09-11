import { Sheet } from './Sheet';
import { useDefinition } from '../lookup/useDefinition';
import type { DictLoader } from '../lookup/dictLoader';
import type { Accent, Pos } from '../lookup/types';

/** アクセントの表示ラベル。2 件並ぶときだけ引く（x は 2 件側に現れない） */
const ACCENT_LABEL: Record<Accent, string> = { uk: 'UK', us: 'US', x: '' };

/** 品詞コードの表示ラベル。辞書の慣習に合わせた英語の略記 */
const POS_LABEL: Record<Pos, string> = {
  n: 'n.',
  v: 'v.',
  a: 'adj.',
  r: 'adv.',
  prep: 'prep.',
  conj: 'conj.',
  pron: 'pron.',
  det: 'det.',
  intj: 'int.',
  num: 'num.',
  pre: 'pref.',
  suf: 'suf.',
  x: '—',
};

export function DefinitionSheet({
  loader,
  word,
  onDismiss,
}: {
  loader: DictLoader;
  word: string;
  onDismiss: () => void;
}) {
  const { state, retry } = useDefinition(loader, word);

  return (
    <Sheet title={word} onDismiss={onDismiss}>
      <div className="font-pixel text-[10px] sm:text-xs text-stone-200 text-left space-y-3 max-w-xs">
        {state.kind === 'loading' && (
          <div data-testid="definition-loading" aria-busy="true" className="space-y-2">
            <div className="h-3 w-40 bg-stone-700 animate-pulse" />
            <div className="h-3 w-32 bg-stone-700 animate-pulse" />
          </div>
        )}

        {state.kind === 'not-found' && <p>この単語の意味は収録されていません</p>}

        {state.kind === 'error' && (
          <div className="space-y-2">
            <p>読み込みに失敗しました</p>
            <button
              type="button"
              onClick={retry}
              className="min-h-[44px] px-3 bg-stone-700 hover:bg-stone-600"
            >
              再試行
            </button>
          </div>
        )}

        {state.kind === 'found' && (
          <>
            {state.base && (
              <p className="text-stone-400">
                {state.word} ← {state.base}
              </p>
            )}
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
            {state.english.length > 0 && (
              <section>
                <h3 className="text-stone-400 mb-1">英英</h3>
                <ul className="space-y-1">
                  {state.english.map(([pos, gloss]) => (
                    <li key={pos}>
                      <span className="text-amber-300">{POS_LABEL[pos]}</span> {gloss}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {state.japanese.length > 0 && (
              <section>
                <h3 className="text-stone-400 mb-1">和訳</h3>
                <ul className="space-y-1">
                  {state.japanese.map(sense => (
                    <li key={sense}>{sense}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
