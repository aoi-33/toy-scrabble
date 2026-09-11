// kaikki.org の英語 Wiktionary 抽出（JSONL、1 行が 1 つの「見出し語 × 品詞」）を
// このアプリのバケット形式に落とす純関数。ストリーム読み込みは呼び出し側にある。

/** 語義の最大文字数。バケットは 1 文字ずつ遅延読み込みするので短く保つ */
export const MAX_GLOSS = 120;

/**
 * Wiktionary の品詞 → このアプリの品詞コード。
 * WordNet は名詞・動詞・形容詞・副詞しか持たず、IF / OF / AND のような機能語が
 * まるごと欠けていた。Wiktionary はそこを埋められるので機能語の品詞も残す。
 */
const POS_MAP = {
  noun: 'n',
  name: 'n',
  verb: 'v',
  adj: 'a',
  adv: 'r',
  prep: 'prep',
  conj: 'conj',
  pron: 'pron',
  det: 'det',
  article: 'det',
  intj: 'intj',
  num: 'num',
  prefix: 'pre',
  suffix: 'suf',
};

/** 原形への参照。plural of / alternative spelling of などが入る */
function baseOf(senses) {
  for (const sense of senses) {
    const ref = sense.form_of?.[0]?.word ?? sense.alt_of?.[0]?.word;
    if (typeof ref === 'string' && /^[A-Za-z]+$/.test(ref)) return ref.toUpperCase();
  }
  return null;
}

/** 屈折形の語義（「plural of cat」）は参照で足りるので、独自の語義だけを探す */
function glossOf(senses) {
  for (const sense of senses) {
    if (sense.form_of || sense.alt_of) continue;
    const gloss = sense.glosses?.[0];
    if (typeof gloss !== 'string') continue;
    const trimmed = gloss.trim();
    if (trimmed === '') continue;
    return trimmed.length > MAX_GLOSS ? `${trimmed.slice(0, MAX_GLOSS)}…` : trimmed;
  }
  return null;
}

/** translations は品詞ごとに付く。日本語だけ重複を除いて拾う */
function japaneseOf(translations) {
  const out = [];
  for (const t of translations) {
    if ((t.lang_code ?? t.code) !== 'ja') continue;
    if (typeof t.word !== 'string' || t.word === '') continue;
    if (!out.includes(t.word)) out.push(t.word);
  }
  return out;
}

/**
 * 発音記号。音素表記 /.../ だけ拾う。[...] は異音まで書いた狭い表記で学習者には細かすぎる。
 * タグ付きの UK/US が両方あれば両方、片方だけならその 1 件、
 * どちらも無ければタグ無しの先頭 1 件を x として返す。
 */
function ipaOf(sounds) {
  let uk = null;
  let us = null;
  let any = null;
  for (const s of sounds) {
    if (typeof s.ipa !== 'string' || !s.ipa.startsWith('/')) continue;
    const tags = s.tags ?? [];
    if (!uk && tags.includes('Received-Pronunciation')) uk = s.ipa;
    else if (!us && tags.includes('General-American')) us = s.ipa;
    else if (!any) any = s.ipa;
  }
  if (uk && us) return [['uk', uk], ['us', us]];
  if (uk) return [['uk', uk]];
  if (us) return [['us', us]];
  return any ? [['x', any]] : [];
}

/**
 * @param {any} obj kaikki.org の 1 行を JSON.parse したもの
 * @returns {{word: string, raw: string, pos: string, gloss: string|null, base: string|null, japanese: string[], ipa: [string, string][]}|null}
 */
export function extractEntry(obj) {
  if (!obj || obj.lang_code !== 'en') return null;
  // 盤に置けるのは A-Z だけ。複合語・アポストロフィ・数字・アクセント付きは要らない
  if (typeof obj.word !== 'string' || !/^[A-Za-z]+$/.test(obj.word)) return null;

  const word = obj.word.toUpperCase();
  // 未知の品詞で捨てるとカバー率が落ちるので、その他（x）として残す
  const pos = POS_MAP[obj.pos] ?? 'x';
  const senses = Array.isArray(obj.senses) ? obj.senses : [];
  const rawBase = baseOf(senses);
  const base = rawBase === word ? null : rawBase;
  const gloss = glossOf(senses);
  const japanese = japaneseOf(Array.isArray(obj.translations) ? obj.translations : []);
  const ipa = ipaOf(Array.isArray(obj.sounds) ? obj.sounds : []);

  // 発音だけの語は通さない。意味を出せない語を辞書に残さないため（ipa は条件に入れない）
  if (gloss === null && base === null && japanese.length === 0) return null;
  return { word, raw: obj.word, pos, gloss, base, japanese, ipa };
}
