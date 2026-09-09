import { describe, it, expect } from 'vitest';

// TS7016 回避: モジュール指定子を変数に入れた動的 import
const WORDNET_PATH = '../../scripts/lib/wordnet.mjs';

async function loadWordnet(): Promise<{
  parseIndex: (text: string) => Map<string, string>;
  parseData: (text: string) => Map<string, string>;
}> {
  return await import(WORDNET_PATH);
}

const INDEX_FIXTURE = [
  '  1 This software and database is being provided to you, the LICENSEE, by  ',
  "'hood n 1 2 @ ; 1 0 08659519  ",
  'cat n 8 5 @ ~ #m + ; 8 1 02124272 10172934 09919605 03614083 02989061 02986962 02130460 00903174  ',
  'ice_cream n 1 1 @ 1 0 07615671  ',
  'dog n 7 3 @ ~ + 7 1 02086723 10114209 09886220 03901548 02710044 01325095 07676602  ',
].join('\n');

const DATA_FIXTURE = [
  '  1 This software and database is being provided to you, the LICENSEE, by  ',
  '00001740 29 v 04 breathe 0 take_a_breath 0 respire 0 suspire 3 021 * 00005041 v 0000 | draw air into, and expel out of, the lungs; "I can breathe better when the air is clean"; "The patient is respiring"  ',
  '02124272 05 n 02 cat 0 true_cat 0 003 @ 02123242 n 0000 | feline mammal usually having thick soft fur and no ability to roar  ',
].join('\n');

describe('parseIndex', () => {
  it('ライセンスヘッダ行を無視する', async () => {
    const { parseIndex } = await loadWordnet();
    expect(parseIndex(INDEX_FIXTURE).has('1')).toBe(false);
  });

  it('末尾 synset_cnt 個の先頭を主語義 offset として拾う', async () => {
    const { parseIndex } = await loadWordnet();
    const index = parseIndex(INDEX_FIXTURE);
    expect(index.get('cat')).toBe('02124272');
    expect(index.get('dog')).toBe('02086723');
  });

  it('英小文字のみでない見出し語を捨てる', async () => {
    const { parseIndex } = await loadWordnet();
    const index = parseIndex(INDEX_FIXTURE);
    expect(index.has("'hood")).toBe(false);
    expect(index.has('ice_cream')).toBe(false);
  });
});

describe('parseData', () => {
  it('gloss から用例を落として定義だけを返す', async () => {
    const { parseData } = await loadWordnet();
    const data = parseData(DATA_FIXTURE);
    expect(data.get('02124272')).toBe(
      'feline mammal usually having thick soft fur and no ability to roar',
    );
  });

  it('定義に含まれるセミコロンで切らない', async () => {
    const { parseData } = await loadWordnet();
    const data = parseData(DATA_FIXTURE);
    expect(data.get('00001740')).toBe('draw air into, and expel out of, the lungs');
  });
});
