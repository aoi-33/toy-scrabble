import type { Bucket, Definition, FetchLike, LookupResult } from './types';

export type DictLoader = {
  lookup: (word: string) => Promise<LookupResult>;
};

/** e か j を実体で持つエントリを返す。b だけのエントリは同じバケット内で辿る（spec §6.1） */
function resolveEntry(bucket: Bucket, entry: Definition): Definition | null {
  if (entry.e?.length || entry.j?.length) return entry;
  if (!entry.b) return null;
  const base = bucket[entry.b];
  if (!base) return null;
  if (base.e?.length || base.j?.length) return base;
  return null;
}

export function createDictLoader(
  fetchImpl: FetchLike = url => fetch(url),
): DictLoader {
  const cache = new Map<string, Bucket>();
  const inflight = new Map<string, Promise<Bucket>>();

  function loadBucket(letter: string): Promise<Bucket> {
    const cached = cache.get(letter);
    if (cached) return Promise.resolve(cached);
    const running = inflight.get(letter);
    if (running) return running;

    const request = (async () => {
      const res = await fetchImpl(`${import.meta.env.BASE_URL}dict/defs/${letter}.json`);
      if (!res.ok) throw new Error(`defs fetch failed: ${res.status}`);
      const bucket = (await res.json()) as Bucket;
      cache.set(letter, bucket);
      return bucket;
    })();

    // 失敗したバケットはキャッシュにも inflight にも残さない（spec §8）
    const tracked = request.finally(() => {
      inflight.delete(letter);
    });
    inflight.set(letter, tracked);
    return tracked;
  }

  async function lookup(word: string): Promise<LookupResult> {
    const target = word.trim().toUpperCase();
    if (!/^[A-Z]+$/.test(target)) return { kind: 'not-found' };

    let bucket: Bucket;
    try {
      bucket = await loadBucket(target[0].toLowerCase());
    } catch {
      // 辞書の失敗はゲームに伝播させない（spec §8）
      return { kind: 'error' };
    }

    const entry = bucket[target];
    if (!entry) return { kind: 'not-found' };
    const resolved = resolveEntry(bucket, entry);
    if (!resolved) return { kind: 'not-found' };

    return {
      kind: 'found',
      word: target,
      base: entry.b && entry.b !== target ? entry.b : null,
      english: resolved.e ?? [],
      japanese: resolved.j ?? [],
    };
  }

  return { lookup };
}
