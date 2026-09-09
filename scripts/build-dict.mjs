#!/usr/bin/env node
// word-list npm パッケージから TWL06 相当の英単語リストを public/dict/twl06.txt に書き出す
// 実行: npm run build:dict
// 出力ファイルは .gitignore で除外（生成物のため）

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const srcPath = resolve(rootDir, 'node_modules/word-list/words.txt');
const outDir = resolve(rootDir, 'public/dict');
const outPath = resolve(outDir, 'twl06.txt');

const raw = readFileSync(srcPath, 'utf8');
const upper = raw
  .split(/\r?\n/)
  .map(w => w.trim().toUpperCase())
  .filter(w => w.length > 0)
  .join('\n');

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, upper + '\n', 'utf8');

const lineCount = upper.split('\n').length;
console.log(`✓ wrote ${lineCount.toLocaleString()} words to ${outPath}`);
