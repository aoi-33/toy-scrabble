// WordNet 3.1 の index.* / data.* をパースする。ビルド時のみ使用する。
// 形式は docs/superpowers/specs/2026-09-09-plan-3-dictionary-design.md §2.1 を参照。

/**
 * index.{noun,verb,adj,adv} をパースし、見出し語（小文字）→ 主語義の synset offset の Map を返す。
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function parseIndex(text) {
  const result = new Map();
  for (const line of text.split('\n')) {
    // ライセンスヘッダは行頭が半角スペース 2 個
    if (!line || line.startsWith('  ')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 6) continue;
    const lemma = parts[0];
    // 複合語（_ 区切り）や 'hood / .22 は盤面に置けないので捨てる
    if (!/^[a-z]+$/.test(lemma)) continue;
    const synsetCnt = Number(parts[2]);
    if (!Number.isInteger(synsetCnt) || synsetCnt < 1) continue;
    if (parts.length < synsetCnt + 1) continue;
    // ptr_symbol の個数は行ごとに違うので、末尾から synset_cnt 個を offset とみなす
    const offsets = parts.slice(parts.length - synsetCnt);
    result.set(lemma, offsets[0]);
  }
  return result;
}

/**
 * data.{noun,verb,adj,adv} をパースし、synset offset → 定義文の Map を返す。
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function parseData(text) {
  const result = new Map();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('  ')) continue;
    const bar = line.indexOf(' | ');
    if (bar === -1) continue;
    const offset = line.slice(0, line.indexOf(' '));
    let gloss = line.slice(bar + 3).trim();
    // gloss は `定義; "用例"; "用例"`。定義自体が ; を含むので `; "` で切る
    const example = gloss.indexOf('; "');
    if (example !== -1) gloss = gloss.slice(0, example);
    result.set(offset, gloss.trim());
  }
  return result;
}
