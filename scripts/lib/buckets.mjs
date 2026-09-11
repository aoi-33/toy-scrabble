// 見出し語リストと辞書データからバケット構造を組み立てる純関数。I/O は build-defs.mjs 側にある。

import { lemmatize } from './lemmatize.mjs';

/** WordNet が持つ品詞と、英英定義を並べる順。n=名詞 v=動詞 a=形容詞 r=副詞 */
const POS_ORDER = ['n', 'v', 'a', 'r'];

/**
 * @param {object} input
 * @param {string[]} input.words 見出し候補（大文字化前でよい）
 * @param {Record<string, Map<string, string>>} input.index 品詞 → (見出し語 → offset)
 * @param {Record<string, Map<string, string>>} input.data 品詞 → (offset → 定義文)
 * @param {Map<string, string[]>} input.japanese 大文字見出し → 和訳
 * @param {Map<string, string>} input.irregularVerbs 活用形 → 原形
 * @param {Set<string>} input.knownLemmas WordNet 見出し語（小文字）
 * @param {Map<string, {e?: [string, string][], b?: string, j?: string[]}>} [input.wiktionary]
 *        大文字見出し → Wiktionary 由来の定義。WordNet が持たない語を埋める
 * @returns {Map<string, Record<string, object>>} 先頭文字（小文字）→ バケット
 */
export function buildBuckets({
  words,
  index,
  data,
  japanese,
  irregularVerbs,
  knownLemmas,
  wiktionary = new Map(),
}) {
  const buckets = new Map();
  const bodyCache = new Map();

  // lemmatize は Set に載っている語しか原形と認めない。WordNet 見出しだけで検証すると
  // Wiktionary でしか引けない語（ARGAN / ABOLISHER）が屈折形からたどれず丸ごと落ちる。
  const lemmas = new Set(knownLemmas);
  for (const word of wiktionary.keys()) lemmas.add(word.toLowerCase());

  function bucketFor(letter) {
    let bucket = buckets.get(letter);
    if (!bucket) {
      bucket = {};
      buckets.set(letter, bucket);
    }
    return bucket;
  }

  /**
   * その語自身の定義本体。原形への参照は辿らない。
   * 英英は WordNet を優先し、無い語だけ Wiktionary で埋める（WordNet の語義の方が短い）。
   * 和訳は EJDict を優先し、無ければ Wiktionary の translations を使う。
   */
  function bodyOf(word) {
    if (bodyCache.has(word)) return bodyCache.get(word);
    const wordnet = [];
    for (const pos of POS_ORDER) {
      const offset = index[pos].get(word.toLowerCase());
      if (!offset) continue;
      const gloss = data[pos].get(offset);
      if (!gloss) continue;
      wordnet.push([pos, gloss]);
    }
    const fallback = wiktionary.get(word);
    const e = wordnet.length > 0 ? wordnet : (fallback?.e ?? []);
    const j = japanese.get(word) ?? fallback?.j ?? [];
    const body = e.length === 0 && j.length === 0 ? null : { e, j };
    bodyCache.set(word, body);
    return body;
  }

  /** 原形。語自身が原形なら null */
  function baseOf(word) {
    // 接尾辞剥がしで解けない不規則形は、Wiktionary が持つ「plural of ...」で補う。
    const lemma = lemmatize(word, lemmas, irregularVerbs);
    const direct = lemma && lemma !== word ? lemma : wiktionary.get(word)?.b;
    if (!direct || direct === word) return null;
    return withBody(direct, word);
  }

  /**
   * 定義の実体を持つ語まで参照を辿る。Wiktionary の原形がさらに別語への参照でしかないことがあり
   * （ABOLISHERS → ABOLISHER → ABOLISH）、そこで止めると屈折形が丸ごと落ちる。
   * 実体が見つからなければ最初の候補を返し、呼び出し側の判定に任せる。
   */
  function withBody(start, origin) {
    const seen = new Set([origin]);
    let current = start;
    while (current && !seen.has(current)) {
      if (bodyOf(current)) return current;
      seen.add(current);
      current = wiktionary.get(current)?.b;
    }
    return start;
  }

  /** 空の配列はファイルサイズを食うだけなので落とす */
  function compact(body, base) {
    const out = {};
    if (base) out.b = base;
    if (body.e.length > 0) out.e = body.e;
    if (body.j.length > 0) out.j = body.j;
    return out;
  }

  for (const raw of words) {
    const word = String(raw).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(word)) continue;

    const base = baseOf(word);
    // 自分自身の定義があるならそれを載せる。屈折形でもあるなら原形も併記する
    const own = bodyOf(word);
    if (own) {
      bucketFor(word[0].toLowerCase())[word] = compact(own, base);
      continue;
    }
    if (!base) continue;

    const body = bodyOf(base);
    if (!body) continue;
    // 載せるものが確定してからバケットを作る（空のバケットを残さない）
    const bucket = bucketFor(word[0].toLowerCase());
    if (base[0] === word[0]) {
      // 原形が word-list に無いと参照が宙に浮くので、実体を必ず同時に書く
      bucket[base] = compact(body);
      bucket[word] = { b: base };
    } else {
      // 別バケットの原形はローダが追加 fetch できないので実体をコピーする
      bucket[word] = compact(body, base);
    }
  }
  return buckets;
}

/**
 * 遊べる語（＝意味を出せる語）だけに絞り込む。
 * buildBuckets は原形を参照させるために単語リストに無い語も書き足すので、
 * バケットの鍵をそのまま使わず元のリストを基準に数える。
 *
 * @param {string[]} words buildBuckets に渡したのと同じ見出し候補
 * @param {Map<string, Record<string, object>>} buckets buildBuckets の戻り値
 * @returns {string[]} 大文字の見出し。入力の順序を保つ
 */
export function playableWords(words, buckets) {
  const out = [];
  for (const raw of words) {
    const word = String(raw).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(word)) continue;
    if (buckets.get(word[0].toLowerCase())?.[word]) out.push(word);
  }
  return out;
}
