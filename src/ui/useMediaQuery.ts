import { useEffect, useState } from 'react';

/** メディアクエリの一致状態を購読する。SSR は無いので初期値も matchMedia から取る。 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);

  useEffect(() => {
    const mql = matchMedia(query);
    const onChange = (e: { matches: boolean }) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
