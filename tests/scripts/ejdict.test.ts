import { describe, it, expect } from 'vitest';

const EJDICT_PATH = '../../scripts/lib/ejdict.mjs';

async function loadEjdict(): Promise<{
  parseEjdictBucket: (obj: Record<string, string>) => Map<string, string[]>;
  parseIrregularVerbs: (obj: Record<string, string>) => Map<string, string>;
}> {
  return await import(EJDICT_PATH);
}

describe('parseEjdictBucket', () => {
  it('値を / で分割し trim して最大 3 件にする', async () => {
    const { parseEjdictBucket } = await loadEjdict();
    const map = parseEjdictBucket({
      go: ' 行く / 動く / 進む / 出発する / なる',
    });
    expect(map.get('GO')).toEqual(['行く', '動く', '進む']);
  });

  it('強調記号 『』 を落とす', async () => {
    const { parseEjdictBucket } = await loadEjdict();
    const map = parseEjdictBucket({
      cat: ' 『猫』;(ライオン,トラ,ヒョウなどの)ネコ科の動物',
    });
    expect(map.get('CAT')).toEqual(['猫;(ライオン,トラ,ヒョウなどの)ネコ科の動物']);
  });

  it('英大文字のみでないキーを捨てる', async () => {
    const { parseEjdictBucket } = await loadEjdict();
    const map = parseEjdictBucket({
      'a.': ' about / acre[s]',
      '.22': ' 22口径',
      a: ' 1つの',
    });
    expect(map.has('A.')).toBe(false);
    expect(map.has('.22')).toBe(false);
    expect(map.get('A')).toEqual(['1つの']);
  });

  it('大小違いの重複キーは先勝ちにする', async () => {
    const { parseEjdictBucket } = await loadEjdict();
    const map = parseEjdictBucket({ cat: ' 猫', Cat: ' 別の訳' });
    expect(map.get('CAT')).toEqual(['猫']);
  });
});

describe('parseIrregularVerbs', () => {
  it('活用形を大文字で原形に対応づける', async () => {
    const { parseIrregularVerbs } = await loadEjdict();
    const map = parseIrregularVerbs({ went: 'go', gone: 'go', ran: 'run' });
    expect(map.get('WENT')).toBe('GO');
    expect(map.get('GONE')).toBe('GO');
    expect(map.get('RAN')).toBe('RUN');
  });

  it('カンマ複合キーを 2 エントリに分割する', async () => {
    const { parseIrregularVerbs } = await loadEjdict();
    const map = parseIrregularVerbs({ 'born, borne': 'bear' });
    expect(map.get('BORN')).toBe('BEAR');
    expect(map.get('BORNE')).toBe('BEAR');
    expect(map.has('BORN, BORNE')).toBe(false);
  });
});
