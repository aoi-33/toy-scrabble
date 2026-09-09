#!/usr/bin/env node
// wordnet-db と ejdict から public/dict/defs/{a..z}.json を生成する
// 実行: npm run build:defs（build-dict.mjs の後に走らせること）
// 出力ファイルは .gitignore の public/dict/* で除外（生成物のため）

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseIndex, parseData } from './lib/wordnet.mjs';
import { parseEjdictBucket, parseIrregularVerbs } from './lib/ejdict.mjs';
import { buildBuckets } from './lib/buckets.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const wordnetDir = resolve(rootDir, 'node_modules/wordnet-db/dict');
const ejdictDir = resolve(rootDir, 'node_modules/ejdict/lib/data');
const outDir = resolve(rootDir, 'public/dict/defs');

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
/** 品詞コード → WordNet のファイル名 */
const POS_FILES = { n: 'noun', v: 'verb', a: 'adj', r: 'adv' };

const index = {};
const data = {};
for (const [pos, name] of Object.entries(POS_FILES)) {
  index[pos] = parseIndex(readFileSync(resolve(wordnetDir, `index.${name}`), 'utf8'));
  data[pos] = parseData(readFileSync(resolve(wordnetDir, `data.${name}`), 'utf8'));
}

const knownLemmas = new Set();
for (const pos of Object.keys(POS_FILES)) {
  for (const lemma of index[pos].keys()) knownLemmas.add(lemma);
}

const japanese = new Map();
for (const letter of LETTERS) {
  const path = resolve(ejdictDir, `dictionary/${letter}.json`);
  if (!existsSync(path)) continue;
  for (const [word, senses] of parseEjdictBucket(JSON.parse(readFileSync(path, 'utf8')))) {
    if (!japanese.has(word)) japanese.set(word, senses);
  }
}

const irregularVerbs = parseIrregularVerbs(
  JSON.parse(readFileSync(resolve(ejdictDir, 'irregular_verbs.json'), 'utf8')),
);

const words = readFileSync(resolve(rootDir, 'public/dict/twl06.txt'), 'utf8').split(/\r?\n/);
const buckets = buildBuckets({ words, index, data, japanese, irregularVerbs, knownLemmas });

mkdirSync(outDir, { recursive: true });
let totalEntries = 0;
let totalBytes = 0;
for (const letter of LETTERS) {
  const bucket = buckets.get(letter) ?? {};
  const json = JSON.stringify(bucket);
  writeFileSync(resolve(outDir, `${letter}.json`), json, 'utf8');
  totalEntries += Object.keys(bucket).length;
  totalBytes += Buffer.byteLength(json);
}

console.log(
  `✓ wrote ${totalEntries.toLocaleString()} entries (${(totalBytes / 1e6).toFixed(1)} MB) to ${outDir}`,
);
