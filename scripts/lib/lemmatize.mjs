// 屈折形を原形に解決する。ビルド時のみ使用する。
// wordnet-db は例外リスト（*.exc）を同梱していないため、
// 不規則動詞は ejdict の表、不規則名詞・形容詞は下の手書き表で補う。

/** 手書きの不規則名詞・形容詞表（spec §4.1） */
export const IRREGULAR_NOUNS = new Map([
  ['CHILDREN', 'CHILD'],
  ['MEN', 'MAN'],
  ['WOMEN', 'WOMAN'],
  ['MICE', 'MOUSE'],
  ['GEESE', 'GOOSE'],
  ['FEET', 'FOOT'],
  ['TEETH', 'TOOTH'],
  ['OXEN', 'OX'],
  ['PEOPLE', 'PERSON'],
  ['BETTER', 'GOOD'],
  ['BEST', 'GOOD'],
  ['WORSE', 'BAD'],
  ['WORST', 'BAD'],
  ['FARTHER', 'FAR'],
  ['FARTHEST', 'FAR'],
  ['FURTHER', 'FAR'],
  ['FURTHEST', 'FAR'],
  ['MORE', 'MUCH'],
  ['MOST', 'MUCH'],
  ['LESS', 'LITTLE'],
  ['LEAST', 'LITTLE'],
]);

/** 接尾辞剥がしの規則（spec §4.2）。上から順に試し、最初に Set に当たった候補を採る */
export const SUFFIX_RULES = [
  ['SES', 'S'],
  ['XES', 'X'],
  ['ZES', 'Z'],
  ['CHES', 'CH'],
  ['SHES', 'SH'],
  ['IES', 'Y'],
  ['S', ''],
  ['ED', 'E'],
  ['ED', ''],
  ['ING', 'E'],
  ['ING', ''],
  ['ER', ''],
  ['ER', 'E'],
  ['EST', ''],
  ['EST', 'E'],
];

/**
 * 語を原形に解決する。候補は必ず knownLemmas で検証するので誤剥がしは棄却される。
 * @param {string} word 大文字・小文字どちらでもよい
 * @param {Set<string>} knownLemmas WordNet の見出し語（小文字）
 * @param {Map<string, string>} [irregularVerbs] 活用形 → 原形（ともに大文字）
 * @returns {string | null} 大文字の原形。解決できなければ null
 */
export function lemmatize(word, knownLemmas, irregularVerbs) {
  const w = String(word).toUpperCase();
  if (!/^[A-Z]+$/.test(w)) return null;
  if (knownLemmas.has(w.toLowerCase())) return w;

  const fromVerb = irregularVerbs ? irregularVerbs.get(w) : undefined;
  if (fromVerb && knownLemmas.has(fromVerb.toLowerCase())) return fromVerb;

  const fromNoun = IRREGULAR_NOUNS.get(w);
  if (fromNoun && knownLemmas.has(fromNoun.toLowerCase())) return fromNoun;

  for (const [suffix, replacement] of SUFFIX_RULES) {
    if (!w.endsWith(suffix)) continue;
    const candidate = w.slice(0, w.length - suffix.length) + replacement;
    if (candidate.length < 2) continue;
    if (knownLemmas.has(candidate.toLowerCase())) return candidate;
  }
  return null;
}
