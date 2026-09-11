import { describe, it, expect } from 'vitest';

const WIKTIONARY_PATH = '../../scripts/lib/wiktionary.mjs';

type Extracted = {
  word: string;
  raw: string;
  pos: string;
  gloss: string | null;
  base: string | null;
  japanese: string[];
  ipa: [string, string][];
};

async function loadWiktionary(): Promise<{
  extractEntry: (obj: unknown) => Extracted | null;
  MAX_GLOSS: number;
}> {
  return await import(WIKTIONARY_PATH);
}

describe('extractEntry', () => {
  it('名詞の語義を取り出して見出しを大文字化する', async () => {
    const { extractEntry } = await loadWiktionary();
    expect(
      extractEntry({
        word: 'cat',
        pos: 'noun',
        lang_code: 'en',
        senses: [{ glosses: ['A domesticated feline animal.'] }],
      }),
    ).toEqual({
      word: 'CAT',
      raw: 'cat',
      pos: 'n',
      gloss: 'A domesticated feline animal.',
      base: null,
      japanese: [],
      ipa: [],
    });
  });

  it('英語以外のエントリは捨てる', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'chat',
      pos: 'noun',
      lang_code: 'fr',
      senses: [{ glosses: ['cat'] }],
    });
    expect(entry).toBeNull();
  });

  // 盤に置けるのは A-Z だけ。複合語・アポストロフィ・数字は盤上に現れない
  it('A-Z 以外を含む見出しは捨てる', async () => {
    const { extractEntry } = await loadWiktionary();
    for (const word of ['ice cream', "don't", '1080', 'café']) {
      expect(extractEntry({ word, pos: 'noun', lang_code: 'en', senses: [{ glosses: ['x'] }] })).toBeNull();
    }
  });

  // WordNet に無い機能語こそ今回の目的。prep / conj / pron / det / intj を落とさない
  it('機能語の品詞も残す', async () => {
    const { extractEntry } = await loadWiktionary();
    const cases: [string, string][] = [
      ['prep', 'prep'],
      ['conj', 'conj'],
      ['pron', 'pron'],
      ['det', 'det'],
      ['article', 'det'],
      ['intj', 'intj'],
      ['num', 'num'],
      ['prefix', 'pre'],
      ['suffix', 'suf'],
      ['name', 'n'],
    ];
    for (const [raw, code] of cases) {
      const entry = extractEntry({ word: 'if', pos: raw, lang_code: 'en', senses: [{ glosses: ['x'] }] });
      expect(entry?.pos).toBe(code);
    }
  });

  // 未知の品詞で捨てるとカバー率が下がるので、その他としてでも残す
  it('未知の品詞は x に丸める', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'qi',
      pos: 'particle',
      lang_code: 'en',
      senses: [{ glosses: ['x'] }],
    });
    expect(entry?.pos).toBe('x');
  });

  // 屈折形は原形への参照だけ持たせればファイルが小さく済む
  it('屈折形は原形を返し語義を持たない', async () => {
    const { extractEntry } = await loadWiktionary();
    expect(
      extractEntry({
        word: 'cats',
        pos: 'noun',
        lang_code: 'en',
        senses: [{ glosses: ['plural of cat'], form_of: [{ word: 'cat' }] }],
      }),
    ).toEqual({ word: 'CATS', raw: 'cats', pos: 'n', gloss: null, base: 'CAT', japanese: [], ipa: [] });
  });

  it('alt_of も原形として扱う', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'colour',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['alternative spelling of color'], alt_of: [{ word: 'color' }] }],
    });
    expect(entry?.base).toBe('COLOR');
  });

  // 屈折形の語義と独自の語義が同居する語がある。独自の語義があるならそちらを優先する
  it('屈折形の語義と独自の語義が並ぶときは独自の語義を使う', async () => {
    const { extractEntry } = await loadWiktionary();
    expect(
      extractEntry({
        word: 'founding',
        pos: 'noun',
        lang_code: 'en',
        senses: [
          { glosses: ['gerund of found'], form_of: [{ word: 'found' }] },
          { glosses: ['The act of establishing something.'] },
        ],
      }),
    ).toEqual({
      word: 'FOUNDING',
      raw: 'founding',
      pos: 'n',
      gloss: 'The act of establishing something.',
      base: 'FOUND',
      japanese: [],
      ipa: [],
    });
  });

  // READ の過去形は READ。自分自身への参照を書くとローダが無限に辿る
  it('原形が見出しと同じなら参照を張らない', async () => {
    const { extractEntry } = await loadWiktionary();
    const selfRef = {
      word: 'read',
      pos: 'verb',
      lang_code: 'en',
      senses: [{ glosses: ['simple past of read'], form_of: [{ word: 'read' }] }],
    };
    // 自己参照だけで語義が無いので、載せるものが何も残らない
    expect(extractEntry(selfRef)).toBeNull();
    expect(
      extractEntry({
        ...selfRef,
        senses: [...selfRef.senses, { glosses: ['To interpret written symbols.'] }],
      }),
    ).toEqual({
      word: 'READ',
      raw: 'read',
      pos: 'v',
      gloss: 'To interpret written symbols.',
      base: null,
      japanese: [],
      ipa: [],
    });
  });

  // CATS は「cat の複数形」と略語 CATS の 2 エントリに分かれている。
  // 大文字化するとぶつかるので、どちらの見出しから来たかを呼び出し側に渡す
  it('原文の見出しをそのまま返す', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'CATS',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['A credit under the CAT Scheme.'] }],
    });
    expect(entry?.word).toBe('CATS');
    expect(entry?.raw).toBe('CATS');
  });

  it('日本語訳があれば重複を除いて拾う', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'cat',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['feline'] }],
      translations: [
        { lang_code: 'ja', word: '猫' },
        { code: 'ja', word: 'ネコ' },
        { lang_code: 'ja', word: '猫' },
        { lang_code: 'fr', word: 'chat' },
        { lang_code: 'ja', roman: 'neko' },
      ],
    });
    expect(entry?.japanese).toEqual(['猫', 'ネコ']);
  });

  // 語義が長いとバケットが肥大してモバイルの遅延読み込みが重くなる
  it('長すぎる語義は切り詰める', async () => {
    const { extractEntry, MAX_GLOSS } = await loadWiktionary();
    const long = 'a'.repeat(MAX_GLOSS + 50);
    const entry = extractEntry({
      word: 'cat',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: [long] }],
    });
    expect(entry!.gloss!.length).toBe(MAX_GLOSS + 1);
    expect(entry!.gloss!.endsWith('…')).toBe(true);
  });

  it('語義も原形も和訳も無いエントリは捨てる', async () => {
    const { extractEntry } = await loadWiktionary();
    expect(extractEntry({ word: 'zzz', pos: 'noun', lang_code: 'en', senses: [] })).toBeNull();
    expect(
      extractEntry({ word: 'zzz', pos: 'noun', lang_code: 'en', senses: [{ tags: ['no-gloss'] }] }),
    ).toBeNull();
  });

  // 学習者に見せるのは音素表記 /.../。[...] は異音まで書いた狭い表記で細かすぎる
  it('UK と US のタグが両方あれば両方拾う', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'hello',
      pos: 'intj',
      lang_code: 'en',
      senses: [{ glosses: ['A greeting.'] }],
      sounds: [
        { ipa: '/həˈləʊ/', tags: ['Received-Pronunciation'] },
        { ipa: '/hɛˈloʊ/', tags: ['General-American'] },
        { ipa: '[hɛˈɫoʊ]' },
        { ogg_url: 'https://example.invalid/hello.ogg' },
      ],
    });
    expect(entry?.ipa).toEqual([
      ['uk', '/həˈləʊ/'],
      ['us', '/hɛˈloʊ/'],
    ]);
  });

  // タグ無しの /.../ が多数派。落とすと収録率が 20.9% から 6.3% まで下がる
  it('タグが無ければ x として 1 件だけ拾う', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'cats',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['plural of cat'], form_of: [{ word: 'cat' }] }],
      sounds: [{ ipa: '/kæts/' }, { ipa: '/kats/' }],
    });
    expect(entry?.ipa).toEqual([['x', '/kæts/']]);
  });

  it('片方のタグしか無ければその 1 件を返す', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'argan',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['A Moroccan tree.'] }],
      sounds: [{ ipa: '/ˈɑː(ɹ)ɡən/', tags: ['Received-Pronunciation'] }],
    });
    expect(entry?.ipa).toEqual([['uk', '/ˈɑː(ɹ)ɡən/']]);
  });

  it('狭い音声表記 [...] しか無ければ空にする', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'cat',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['feline'] }],
      sounds: [{ ipa: '[kʰæt]' }, { enpr: 'kăt' }],
    });
    expect(entry?.ipa).toEqual([]);
  });

  it('sounds が無ければ空にする', async () => {
    const { extractEntry } = await loadWiktionary();
    const entry = extractEntry({
      word: 'cat',
      pos: 'noun',
      lang_code: 'en',
      senses: [{ glosses: ['feline'] }],
    });
    expect(entry?.ipa).toEqual([]);
  });

  // 発音だけの語を通すと「意味は出ないが発音はある語」が混ざり、
  // build-defs.mjs が担保している「遊べる語の定義収録率 100%」と噛み合わなくなる
  it('発音しか無いエントリは捨てる', async () => {
    const { extractEntry } = await loadWiktionary();
    expect(
      extractEntry({
        word: 'zyme',
        pos: 'noun',
        lang_code: 'en',
        senses: [],
        sounds: [{ ipa: '/zaɪm/' }],
      }),
    ).toBeNull();
  });
});
