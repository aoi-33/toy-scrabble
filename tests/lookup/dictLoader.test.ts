import { describe, it, expect, vi } from 'vitest';
import { createDictLoader } from '../../src/lookup/dictLoader';
import type { Bucket, FetchLike } from '../../src/lookup/types';

const C_BUCKET: Bucket = {
  CAT: { e: [['n', 'feline mammal']], j: ['猫'] },
  CATS: { b: 'CAT' },
  CROW: { b: 'CAWED' },
};

const W_BUCKET: Bucket = {
  WENT: { b: 'GO', e: [['v', 'change location']], j: ['行く'] },
};

function okFetch(buckets: Record<string, Bucket>): FetchLike {
  return vi.fn(async (url: string) => {
    const letter = url.slice(url.length - 6, url.length - 5);
    const bucket = buckets[letter];
    if (!bucket) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => bucket };
  });
}

describe('createDictLoader', () => {
  it('原形の語の定義を返す', async () => {
    const loader = createDictLoader(okFetch({ c: C_BUCKET }));
    const result = await loader.lookup('cat');
    expect(result).toEqual({
      kind: 'found',
      word: 'CAT',
      base: null,
      english: [['n', 'feline mammal']],
      japanese: ['猫'],
    });
  });

  it('b だけのエントリを同じバケット内で解決し、原形を併記する', async () => {
    const loader = createDictLoader(okFetch({ c: C_BUCKET }));
    const result = await loader.lookup('CATS');
    expect(result).toEqual({
      kind: 'found',
      word: 'CATS',
      base: 'CAT',
      english: [['n', 'feline mammal']],
      japanese: ['猫'],
    });
  });

  it('バケットを跨ぐ屈折形は追加 fetch なしで解決する', async () => {
    const fetchImpl = okFetch({ w: W_BUCKET });
    const loader = createDictLoader(fetchImpl);
    const result = await loader.lookup('WENT');
    expect(result).toEqual({
      kind: 'found',
      word: 'WENT',
      base: 'GO',
      english: [['v', 'change location']],
      japanese: ['行く'],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('バケットに無い語は not-found', async () => {
    const loader = createDictLoader(okFetch({ c: C_BUCKET }));
    expect(await loader.lookup('CZAR')).toEqual({ kind: 'not-found' });
  });

  it('参照先が欠けているエントリは not-found', async () => {
    const loader = createDictLoader(okFetch({ c: C_BUCKET }));
    expect(await loader.lookup('CROW')).toEqual({ kind: 'not-found' });
  });

  it('同じバケットへの並行 2 回を fetch 1 回にまとめる', async () => {
    const fetchImpl = okFetch({ c: C_BUCKET });
    const loader = createDictLoader(fetchImpl);
    const [a, b] = await Promise.all([loader.lookup('CAT'), loader.lookup('CATS')]);
    expect(a.kind).toBe('found');
    expect(b.kind).toBe('found');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('2 回目以降はキャッシュから返し fetch しない', async () => {
    const fetchImpl = okFetch({ c: C_BUCKET });
    const loader = createDictLoader(fetchImpl);
    await loader.lookup('CAT');
    await loader.lookup('CATS');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fetch 失敗時は例外を投げず error を返す', async () => {
    const loader = createDictLoader(okFetch({}));
    expect(await loader.lookup('CAT')).toEqual({ kind: 'error' });
  });

  it('失敗したバケットをキャッシュせず、再試行で成功できる', async () => {
    let succeed = false;
    const fetchImpl: FetchLike = vi.fn(async () => {
      if (!succeed) throw new Error('network down');
      return { ok: true, status: 200, json: async () => C_BUCKET };
    });
    const loader = createDictLoader(fetchImpl);
    expect(await loader.lookup('CAT')).toEqual({ kind: 'error' });
    succeed = true;
    const retried = await loader.lookup('CAT');
    expect(retried.kind).toBe('found');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('英字以外を含む語は fetch せず not-found', async () => {
    const fetchImpl = okFetch({ c: C_BUCKET });
    const loader = createDictLoader(fetchImpl);
    expect(await loader.lookup('')).toEqual({ kind: 'not-found' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
