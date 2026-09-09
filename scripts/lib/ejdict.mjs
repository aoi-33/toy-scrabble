// ejdict の辞書バケットと不規則動詞表を読みやすい形へ変換する。ビルド時のみ使用する。

/** 和訳の保持件数 */
const MAX_JAPANESE = 3;

/**
 * ejdict のバケット JSON から 大文字見出し → 和訳配列（最大 3 件）の Map を作る。
 * @param {Record<string, string>} obj
 * @returns {Map<string, string[]>}
 */
export function parseEjdictBucket(obj) {
  const result = new Map();
  for (const [rawKey, rawValue] of Object.entries(obj)) {
    const key = String(rawKey).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(key)) continue;
    // 大小違いの重複キー（cat / Cat）は先に出たものを採る
    if (result.has(key)) continue;
    const senses = String(rawValue)
      .split(' / ')
      // 『』 は原データの強調記号。表示には不要なので落とす
      .map(s => s.replace(/[『』]/g, '').trim())
      .filter(Boolean)
      .slice(0, MAX_JAPANESE);
    if (senses.length === 0) continue;
    result.set(key, senses);
  }
  return result;
}

/**
 * irregular_verbs.json から 活用形 → 原形（ともに大文字）の Map を作る。
 * キーは "born, borne" のようにカンマ複合のことがある。
 * @param {Record<string, string>} obj
 * @returns {Map<string, string>}
 */
export function parseIrregularVerbs(obj) {
  const result = new Map();
  for (const [rawKey, rawValue] of Object.entries(obj)) {
    const base = String(rawValue).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(base)) continue;
    for (const part of String(rawKey).split(',')) {
      const form = part.trim().toUpperCase();
      if (!/^[A-Z]+$/.test(form)) continue;
      if (!result.has(form)) result.set(form, base);
    }
  }
  return result;
}
