// 見出し語リストと辞書データからバケット構造を組み立てる純関数。I/O は build-defs.mjs 側にある。

import { lemmatize } from './lemmatize.mjs';

/** 英英定義を並べる品詞順。n=名詞 v=動詞 a=形容詞 r=副詞 */
const POS_ORDER = ['n', 'v', 'a', 'r'];

/**
 * @param {object} input
 * @param {string[]} input.words 見出し候補（大文字化前でよい）
 * @param {Record<string, Map<string, string>>} input.index 品詞 → (見出し語 → offset)
 * @param {Record<string, Map<string, string>>} input.data 品詞 → (offset → 定義文)
 * @param {Map<string, string[]>} input.japanese 大文字見出し → 和訳
 * @param {Map<string, string>} input.irregularVerbs 活用形 → 原形
 * @param {Set<string>} input.knownLemmas WordNet 見出し語（小文字）
 * @returns {Map<string, Record<string, object>>} 先頭文字（小文字）→ バケット
 */
export function buildBuckets({ words, index, data, japanese, irregularVerbs, knownLemmas }) {
  const buckets = new Map();
  const entryCache = new Map();

  function bucketFor(letter) {
    let bucket = buckets.get(letter);
    if (!bucket) {
      bucket = {};
      buckets.set(letter, bucket);
    }
    return bucket;
  }

  /** 原形の定義本体。英英も和訳も無ければ null */
  function definitionOf(lemma) {
    if (entryCache.has(lemma)) return entryCache.get(lemma);
    const english = [];
    for (const pos of POS_ORDER) {
      const offset = index[pos].get(lemma.toLowerCase());
      if (!offset) continue;
      const gloss = data[pos].get(offset);
      if (!gloss) continue;
      english.push([pos, gloss]);
    }
    const japaneseSenses = japanese.get(lemma) ?? [];
    const entry =
      english.length === 0 && japaneseSenses.length === 0
        ? null
        : { e: english, j: japaneseSenses };
    entryCache.set(lemma, entry);
    return entry;
  }

  /** 空の配列はファイルサイズを食うだけなので落とす */
  function compact(entry, base) {
    const out = {};
    if (base) out.b = base;
    if (entry.e.length > 0) out.e = entry.e;
    if (entry.j.length > 0) out.j = entry.j;
    return out;
  }

  for (const raw of words) {
    const word = String(raw).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(word)) continue;
    const lemma = lemmatize(word, knownLemmas, irregularVerbs);
    if (!lemma) continue;
    const entry = definitionOf(lemma);
    if (!entry) continue;

    const bucket = bucketFor(word[0].toLowerCase());
    if (lemma === word) {
      bucket[word] = compact(entry);
    } else if (lemma[0] === word[0]) {
      // 原形が word-list に無いと参照が宙に浮くので、実体を必ず同時に書く
      bucket[lemma] = compact(entry);
      bucket[word] = { b: lemma };
    } else {
      // 別バケットの原形はローダが追加 fetch できないので実体をコピーする
      bucket[word] = compact(entry, lemma);
    }
  }
  return buckets;
}
