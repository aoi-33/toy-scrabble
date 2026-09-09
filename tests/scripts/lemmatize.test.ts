import { describe, it, expect } from 'vitest';

// TS7016 回避: モジュール指定子を変数に入れた動的 import
const LEMMATIZE_PATH = '../../scripts/lib/lemmatize.mjs';

async function loadLemmatize(): Promise<{
  lemmatize: (
    word: string,
    knownLemmas: Set<string>,
    irregularVerbs?: Map<string, string>,
  ) => string | null;
}> {
  return await import(LEMMATIZE_PATH);
}

const KNOWN = new Set([
  'cat', 'city', 'hope', 'walk', 'go', 'run', 'mouse', 'bear',
  'bus', 'gas', 'box', 'church', 'dish', 'waltz', 'tall', 'large', 'child',
]);

const IRREGULAR_VERBS = new Map([
  ['WENT', 'GO'],
  ['RAN', 'RUN'],
  ['BORN', 'BEAR'],
  ['BORNE', 'BEAR'],
]);

describe('lemmatize', () => {
  it('原形そのものはそのまま返す', async () => {
    const { lemmatize } = await loadLemmatize();
    expect(lemmatize('CAT', KNOWN, IRREGULAR_VERBS)).toBe('CAT');
    expect(lemmatize('BUS', KNOWN, IRREGULAR_VERBS)).toBe('BUS');
  });

  it('不規則動詞を原形に戻す', async () => {
    const { lemmatize } = await loadLemmatize();
    expect(lemmatize('WENT', KNOWN, IRREGULAR_VERBS)).toBe('GO');
    expect(lemmatize('RAN', KNOWN, IRREGULAR_VERBS)).toBe('RUN');
    expect(lemmatize('BORN', KNOWN, IRREGULAR_VERBS)).toBe('BEAR');
    expect(lemmatize('BORNE', KNOWN, IRREGULAR_VERBS)).toBe('BEAR');
  });

  it('手書き表の不規則名詞を原形に戻す', async () => {
    const { lemmatize } = await loadLemmatize();
    expect(lemmatize('MICE', KNOWN, IRREGULAR_VERBS)).toBe('MOUSE');
    expect(lemmatize('CHILDREN', KNOWN, IRREGULAR_VERBS)).toBe('CHILD');
  });

  it('接尾辞規則で規則形を剥がす', async () => {
    const { lemmatize } = await loadLemmatize();
    expect(lemmatize('CATS', KNOWN, IRREGULAR_VERBS)).toBe('CAT');
    expect(lemmatize('CITIES', KNOWN, IRREGULAR_VERBS)).toBe('CITY');
    expect(lemmatize('HOPING', KNOWN, IRREGULAR_VERBS)).toBe('HOPE');
    expect(lemmatize('HOPED', KNOWN, IRREGULAR_VERBS)).toBe('HOPE');
    expect(lemmatize('WALKING', KNOWN, IRREGULAR_VERBS)).toBe('WALK');
    expect(lemmatize('WALKED', KNOWN, IRREGULAR_VERBS)).toBe('WALK');
    expect(lemmatize('GASES', KNOWN, IRREGULAR_VERBS)).toBe('GAS');
    expect(lemmatize('BOXES', KNOWN, IRREGULAR_VERBS)).toBe('BOX');
    expect(lemmatize('WALTZES', KNOWN, IRREGULAR_VERBS)).toBe('WALTZ');
    expect(lemmatize('CHURCHES', KNOWN, IRREGULAR_VERBS)).toBe('CHURCH');
    expect(lemmatize('DISHES', KNOWN, IRREGULAR_VERBS)).toBe('DISH');
    expect(lemmatize('TALLER', KNOWN, IRREGULAR_VERBS)).toBe('TALL');
    expect(lemmatize('TALLEST', KNOWN, IRREGULAR_VERBS)).toBe('TALL');
    expect(lemmatize('LARGER', KNOWN, IRREGULAR_VERBS)).toBe('LARGE');
    expect(lemmatize('LARGEST', KNOWN, IRREGULAR_VERBS)).toBe('LARGE');
  });

  it('Set に無い候補は採らない', async () => {
    const { lemmatize } = await loadLemmatize();
    // THIS → THI は Set に無いので棄却され、他に候補も無いので null
    expect(lemmatize('THIS', KNOWN, IRREGULAR_VERBS)).toBeNull();
    // 原形が Set に無ければ不規則表に載っていても採らない
    expect(lemmatize('MICE', new Set(['cat']), IRREGULAR_VERBS)).toBeNull();
  });

  it('英字以外を含む語は null', async () => {
    const { lemmatize } = await loadLemmatize();
    expect(lemmatize('CAT-DOG', KNOWN, IRREGULAR_VERBS)).toBeNull();
    expect(lemmatize('', KNOWN, IRREGULAR_VERBS)).toBeNull();
  });
});
