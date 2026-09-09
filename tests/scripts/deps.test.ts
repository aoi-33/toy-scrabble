import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// vitest はリポジトリルートから実行される
// eslint-disable-next-line no-undef
const root = process.cwd();

describe('辞書データパッケージ', () => {
  it('wordnet-db の index/data が 4 品詞ぶん存在する', () => {
    for (const name of ['noun', 'verb', 'adj', 'adv']) {
      expect(existsSync(resolve(root, `node_modules/wordnet-db/dict/index.${name}`))).toBe(true);
      expect(existsSync(resolve(root, `node_modules/wordnet-db/dict/data.${name}`))).toBe(true);
    }
  });

  it('ejdict のバケット JSON と不規則動詞表が存在する', () => {
    expect(existsSync(resolve(root, 'node_modules/ejdict/lib/data/dictionary/a.json'))).toBe(true);
    expect(existsSync(resolve(root, 'node_modules/ejdict/lib/data/dictionary/z.json'))).toBe(true);
    expect(existsSync(resolve(root, 'node_modules/ejdict/lib/data/irregular_verbs.json'))).toBe(true);
  });
});
