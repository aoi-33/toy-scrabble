import { describe, it, expect } from 'vitest';

const BUCKETS_PATH = '../../scripts/lib/buckets.mjs';

type Definition = {
  b?: string;
  e?: [string, string][];
  j?: string[];
  p?: ['uk' | 'us' | 'x', string][];
};

async function loadBuckets(): Promise<{
  buildBuckets: (input: {
    words: string[];
    index: Record<string, Map<string, string>>;
    data: Record<string, Map<string, string>>;
    japanese: Map<string, string[]>;
    irregularVerbs: Map<string, string>;
    knownLemmas: Set<string>;
    wiktionary?: Map<string, Definition>;
  }) => Map<string, Record<string, Definition>>;
  playableWords: (
    words: string[],
    buckets: Map<string, Record<string, Definition>>,
  ) => string[];
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
    wiktionary: new Map<string, Definition>([
      // WordNet にも EJDict にも無い語
      ['ARGAN', { e: [['n', 'A Moroccan tree.']] }],
      // 不規則複数。ox が knownLemmas に無いので lemmatize では解決できない
      ['OXEN', { b: 'OX' }],
      ['OX', { e: [['n', 'A castrated bull.']] }],
      // WordNet と重なる語。語義が短い WordNet を優先したい
      ['CAT', { e: [['n', 'An animal of the family Felidae kept as a pet.']] }],
      // 実体を持たない中継点。ABOLISHERS → ABOLISHER → ABOLISH と二段になる
      ['ABOLISH', { e: [['v', 'To end something.']] }],
      ['ABOLISHER', { b: 'ABOLISH' }],
    ]),
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

  // ARGAN は WordNet にも EJDict にも無く、意味が出ないという報告の実例
  it('WordNet にも EJDict にも無い語は Wiktionary が埋める', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    input.words = [...input.words, 'ARGAN'];
    const buckets = buildBuckets(input);
    expect(buckets.get('a')!.ARGAN).toEqual({ e: [['n', 'A Moroccan tree.']] });
  });

  // lemmatize は候補を WordNet でしか検証しないので OXEN → OX を解決できない
  it('lemmatize が解けない屈折形を Wiktionary の原形参照で解決する', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    input.words = [...input.words, 'OXEN'];
    const buckets = buildBuckets(input);
    expect(buckets.get('o')!.OXEN).toEqual({ b: 'OX' });
    expect(buckets.get('o')!.OX).toEqual({ e: [['n', 'A castrated bull.']] });
  });

  // Wiktionary にしか無い語（ARGAN）の屈折形。Wiktionary 側に ARGANS の項目は無いので、
  // lemmatize が ARGAN を原形として認められないと丸ごと落ちてしまう
  it('Wiktionary にしか無い語の屈折形も原形にリンクする', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    input.words = [...input.words, 'ARGANS'];
    const buckets = buildBuckets(input);
    expect(buckets.get('a')!.ARGANS).toEqual({ b: 'ARGAN' });
    expect(buckets.get('a')!.ARGAN).toEqual({ e: [['n', 'A Moroccan tree.']] });
  });

  // 原形が「別語への参照」でしかないと、そこで行き止まりになって屈折形が落ちてしまう
  it('参照が二段になっていても実体を持つ語まで辿る', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    input.words = [...input.words, 'ABOLISHERS'];
    const buckets = buildBuckets(input);
    expect(buckets.get('a')!.ABOLISHERS).toEqual({ b: 'ABOLISH' });
    expect(buckets.get('a')!.ABOLISH).toEqual({ e: [['v', 'To end something.']] });
  });

  // Wiktionary の語義は長い。両方ある語では短い WordNet を使ってバケットを軽く保つ
  it('WordNet と Wiktionary の両方にある語は WordNet を使う', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets(fixture());
    expect(buckets.get('c')!.CAT).toEqual({ e: [['n', 'feline mammal']], j: ['猫'] });
  });

  it('Wiktionary を渡さなくても動く', async () => {
    const { buildBuckets } = await loadBuckets();
    const buckets = buildBuckets({ ...fixture(), wiktionary: undefined });
    expect(buckets.get('c')!.CAT).toEqual({ e: [['n', 'feline mammal']], j: ['猫'] });
    expect(buckets.get('a')!.ARGAN).toBeUndefined();
  });

  it('語が自分の発音を持つならバケットに載せる', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    input.words = [...input.words, 'ARGAN'];
    input.wiktionary.set('ARGAN', {
      e: [['n', 'A Moroccan tree.']],
      p: [['x', '/ˈɑː(ɹ)ɡən/']],
    });
    const buckets = buildBuckets(input);
    expect(buckets.get('a')!.ARGAN).toEqual({
      e: [['n', 'A Moroccan tree.']],
      p: [['x', '/ˈɑː(ɹ)ɡən/']],
    });
  });

  // 屈折形は原形と発音が違う（ARGAN と ARGANS）。自分のものがあるなら原形で上書きしない
  it('同じバケット内の屈折形は自分の発音を持つ', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    input.words = [...input.words, 'ARGANS'];
    input.wiktionary.set('ARGAN', {
      e: [['n', 'A Moroccan tree.']],
      p: [['x', '/ˈɑː(ɹ)ɡən/']],
    });
    input.wiktionary.set('ARGANS', { b: 'ARGAN', p: [['x', '/ˈɑː(ɹ)ɡənz/']] });
    const buckets = buildBuckets(input);
    expect(buckets.get('a')!.ARGANS).toEqual({ b: 'ARGAN', p: [['x', '/ˈɑː(ɹ)ɡənz/']] });
    expect(buckets.get('a')!.ARGAN).toEqual({
      e: [['n', 'A Moroccan tree.']],
      p: [['x', '/ˈɑː(ɹ)ɡən/']],
    });
  });

  // 同じバケットならローダが実行時に原形をたどれるので、コピーして重複させない
  it('同じバケット内なら原形の発音をコピーしない', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    input.words = [...input.words, 'ARGANS'];
    input.wiktionary.set('ARGAN', {
      e: [['n', 'A Moroccan tree.']],
      p: [['x', '/ˈɑː(ɹ)ɡən/']],
    });
    const buckets = buildBuckets(input);
    expect(buckets.get('a')!.ARGANS).toEqual({ b: 'ARGAN' });
  });

  // ローダは lookup 中に別バケットを追加 fetch しない。WENT は w.json、GO は g.json
  it('バケットを跨ぐ屈折形には原形の発音をコピーする', async () => {
    const { buildBuckets } = await loadBuckets();
    const input = fixture();
    input.wiktionary.set('GO', { p: [['x', '/ɡəʊ/']] });
    const buckets = buildBuckets(input);
    expect(buckets.get('w')!.WENT).toEqual({
      b: 'GO',
      e: [['v', 'change location']],
      j: ['行く'],
      p: [['x', '/ɡəʊ/']],
    });
  });

  // 発音だけの語を載せると playableWords が「意味の出ない語」を遊べる語として残してしまう
  it('発音しか無い語はバケットに載せない', async () => {
    const { buildBuckets, playableWords } = await loadBuckets();
    const input = fixture();
    input.words = [...input.words, 'ZYME'];
    input.wiktionary.set('ZYME', { p: [['x', '/zaɪm/']] });
    const buckets = buildBuckets(input);
    expect(buckets.get('z')).toBeUndefined();
    expect(playableWords(input.words, buckets)).not.toContain('ZYME');
  });
});

// 意味を出せない語は盤に置けないようにする。学習者向けなので「引けない語で得点できる」より
// 「置ける語は必ず意味が出る」を優先する方針
describe('playableWords', () => {
  it('定義が引けた語だけを残す', async () => {
    const { buildBuckets, playableWords } = await loadBuckets();
    const input = fixture();
    const buckets = buildBuckets(input);
    expect(playableWords(input.words, buckets)).toEqual([
      'CAT',
      'CATS',
      'GO',
      'WENT',
      'HOPE',
      'IF',
      'ABACI',
    ]);
  });

  // 参照先として書き込んだ原形は、元の単語リストに無いなら遊べる語ではない
  it('参照のために書き足した原形は増やさない', async () => {
    const { buildBuckets, playableWords } = await loadBuckets();
    const input = fixture();
    input.words = ['CATS'];
    const buckets = buildBuckets(input);
    expect(buckets.get('c')!.CAT).toBeDefined();
    expect(playableWords(input.words, buckets)).toEqual(['CATS']);
  });
});
