import { useCallback, useEffect, useState } from 'react';
import type { DictLoader } from './dictLoader';
import type { LookupResult } from './types';

/** spec §7.3 の 4 状態。LookupResult に loading を足しただけ */
export type DefinitionState = { kind: 'loading' } | LookupResult;

/**
 * 語の定義を引く。loader.lookup は例外を投げない契約なので catch は要らない。
 */
export function useDefinition(
  loader: DictLoader,
  word: string,
): { state: DefinitionState; retry: () => void } {
  const [state, setState] = useState<DefinitionState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // 語を切り替えた直後に前の結果が届いても捨てる
    let cancelled = false;
    setState({ kind: 'loading' });
    loader.lookup(word).then(result => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [loader, word, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return { state, retry };
}
