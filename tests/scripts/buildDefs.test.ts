import { describe, it, expect } from 'vitest';

const BUCKETS_PATH = '../../scripts/lib/buckets.mjs';

type Definition = { b?: string; e?: [string, string][]; j?: string[] };

async function loadBuckets(): Promise<{
  buildBuckets: (input: {
    words: string[];
    index: Record<string, Map<string, string>>;
    data: Record<string, Map<string, string>>;
    japanese: Map<string, string[]>;
    irregularVerbs: Map<string, string>;
    knownLemmas: Set<string>;
  }) => Map<string, Record<string, Definition>>;
}> {
  return await import(BUCKETS_PATH);
}

function fixture() {
  return {
    words: ['CAT', 'CATS', 'GO', 'WENT', 'ZZZZ', 'HOPE', 'IF', 'ABACI'],
    index: {
      n: new Map([['cat', 'n1']]),
      v: new Map([['go', 'v1']]),
      a: new Map<string, string>(),
      r: new Map<string, string>(),
    },
    data: {
      n: new Map([['n1', 'feline mammal']]),
      v: new Map([['v1', 'change location']]),
      a: new Map<string, string>(),
      r: new Map<string, string>(),
    },
    japanese: new Map([
      ['CAT', ['猫']],
      ['GO', ['行く']],
      ['HOPE', ['希望']],
      // WordNet は名詞・動詞・形容詞・副詞しか持たないので前置詞・接続詞は knownLemmas に無い
      ['IF', ['もし…ならば']],
      ['ABACI', ['abacusの複数形']],
    ]),
    irregularVerbs: new Map([['WENT', 'GO']]),
    knownLemmas: new Set(['cat', 'go', 'hope']),
  };
}

describe('buildBuckets', () => {
  it('原形の語は定義を実体で持つ', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets(fixture());
    expect(buckets.get('c')!.CAT).toEqual({ e: [['n', 'feline mammal']], j: ['猫'] });
  });

  it('同じバケット内の屈折形は原形への参照だけを持つ', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets(fixture());
    expect(buckets.get('c')!.CATS).toEqual({ b: 'CAT' });
  });

  it('バケットを跨ぐ屈折形は定義を実体でコピーする', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets(fixture());
    expect(buckets.get('w')!.WENT).toEqual({
      b: 'GO',
      e: [['v', 'change location']],
      j: ['行く'],
    });
  });

  it('原形が word-list に無くても参照先の実体を書き込む', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    // CAT を見出しから外しても、CATS の参照先が残ること
    input.words = ['CATS'];
    const buckets = buildBuckets(input);
    expect(buckets.get('c')!.CATS).toEqual({ b: 'CAT' });
    expect(buckets.get('c')!.CAT).toEqual({ e: [['n', 'feline mammal']], j: ['猫'] });
  });

  it('英英も和訳も無い語は載せない', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets(fixture());
    expect(buckets.get('z')).toBeUndefined();
  });

  it('和訳しか無い語も載せる', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets(fixture());
    expect(buckets.get('h')!.HOPE).toEqual({ j: ['希望'] });
  });

  // WordNet に無い前置詞・接続詞・不規則複数は lemmatize が null を返す。
  // それでも和訳があるなら表示できるので落としてはいけない。
  it('WordNet に無くても和訳があれば載せる', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets(fixture());
    expect(buckets.get('i')!.IF).toEqual({ j: ['もし…ならば'] });
    expect(buckets.get('a')!.ABACI).toEqual({ j: ['abacusの複数形'] });
  });
});
