#!/usr/bin/env node
// kaikki.org の英語 Wiktionary 抽出（3 GB 超の JSONL）を data/wiktionary.json に絞り込む。
//
// 実行: node scripts/build-wiktionary.mjs [kaikki.jsonl のパス]
// 元データ: https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl
//
// 3 GB を CI で落とすのは現実的でないので、これは手元で実行して出力をリポジトリに
// 入れる。CI で走るのは build-defs.mjs だけ。

import { createReadStream, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extractEntry } from './lib/wiktionary.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const srcPath = process.argv[2] ?? '/tmp/kaikki-en.jsonl';
const outDir = resolve(rootDir, 'data');
const outPath = resolve(outDir, 'wiktionary.json');

/** 語義を並べる品詞順。知っている品詞を先に、その他を後ろに回す */
const POS_ORDER = ['n', 'v', 'a', 'r', 'prep', 'conj', 'pron', 'det', 'intj', 'num', 'pre', 'suf', 'x'];
const posRank = new Map(POS_ORDER.map((pos, i) => [pos, i]));

const wanted = new Set(
  readFileSync(resolve(rootDir, 'public/dict/words.txt'), 'utf8')
    .split(/\r?\n/)
    .map((w) => w.trim().toUpperCase())
    .filter((w) => w !== ''),
);

function emptyRecord() {
  return { e: [], b: null, j: [], p: [] };
}

function absorb(record, entry) {
  // 同じ品詞が複数行に分かれることがある。最初の語義だけ残す
  if (entry.gloss !== null && !record.e.some(([pos]) => pos === entry.pos)) {
    record.e.push([entry.pos, entry.gloss]);
  }
  if (record.b === null && entry.base !== null) record.b = entry.base;
  for (const ja of entry.japanese) if (!record.j.includes(ja)) record.j.push(ja);
  // 同じ語の品詞違いで発音が割れることはほぼ無いので先勝ちで足りる
  if (record.p.length === 0 && entry.ipa.length > 0) record.p = entry.ipa;
}

// CATS は「cat の複数形」と略語 CATS の 2 エントリに分かれていて、大文字化するとぶつかる。
// 盤に並ぶのは普通の単語なので、小文字見出し由来のものを優先して略語を押しのける。
/** @type {Map<string, {lower: object, upper: object}>} */
const merged = new Map();
let lines = 0;
let kept = 0;

const rl = createInterface({ input: createReadStream(srcPath), crlfDelay: Infinity });
for await (const line of rl) {
  lines++;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue; // 途中で切れた行は捨てる
  }
  const entry = extractEntry(obj);
  if (!entry || !wanted.has(entry.word)) continue;
  kept++;

  let group = merged.get(entry.word);
  if (!group) {
    group = { lower: emptyRecord(), upper: emptyRecord() };
    merged.set(entry.word, group);
  }
  absorb(entry.raw === entry.raw.toLowerCase() ? group.lower : group.upper, entry);
}

/** 空の配列はファイルサイズを食うだけなので落とす */
const out = {};
for (const [word, group] of merged) {
  const record = group.lower.e.length > 0 || group.lower.b !== null ? group.lower : group.upper;
  record.e.sort((a, b) => (posRank.get(a[0]) ?? 99) - (posRank.get(b[0]) ?? 99));
  const value = {};
  if (record.e.length > 0) value.e = record.e;
  if (record.b !== null) value.b = record.b;
  if (record.p.length > 0) value.p = record.p;
  // 和訳はどちらの見出しから来ても使える
  const japanese = [...new Set([...group.lower.j, ...group.upper.j])];
  if (japanese.length > 0) value.j = japanese;
  if (Object.keys(value).length > 0) out[word] = value;
}

mkdirSync(outDir, { recursive: true });
const json = JSON.stringify(out);
writeFileSync(outPath, json, 'utf8');

const withJa = Object.values(out).filter((v) => v.j).length;
console.log(`  読んだ行: ${lines.toLocaleString()} / 採用: ${kept.toLocaleString()}`);
console.log(
  `✓ ${Object.keys(out).length.toLocaleString()} 語 (${(Buffer.byteLength(json) / 1e6).toFixed(1)} MB) を ${outPath} に書き出し`,
);
console.log(`  word-list ${wanted.size.toLocaleString()} 語に対するカバー率: ${((100 * Object.keys(out).length) / wanted.size).toFixed(1)}%`);
console.log(`  うち和訳あり: ${withJa.toLocaleString()}`);
