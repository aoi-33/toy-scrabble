import { describe, it, expect } from 'vitest';
import { createDictionaryFromText, isValidWord, hasPrefix } from '../src/game/dictionary';

const SAMPLE = `AA
AAH
ABLE
CAT
CATS
QI
ZEBRA
`;

describe('createDictionaryFromText', () => {
  it('parses newline-separated words into a Set', () => {
    const dict = createDictionaryFromText(SAMPLE);
    expect(dict.words.size).toBe(7);
    expect(dict.words.has('CAT')).toBe(true);
  });

  it('uppercases and trims entries', () => {
    const dict = createDictionaryFromText('cat\n  dog  \n');
    expect(dict.words.has('CAT')).toBe(true);
    expect(dict.words.has('DOG')).toBe(true);
  });

  it('builds a prefix set including empty and each proper prefix', () => {
    const dict = createDictionaryFromText('CAT\n');
    expect(dict.prefixes.has('')).toBe(true);
    expect(dict.prefixes.has('C')).toBe(true);
    expect(dict.prefixes.has('CA')).toBe(true);
    expect(dict.prefixes.has('CAT')).toBe(true);
  });
});

describe('isValidWord', () => {
  it('returns true for known words (case-insensitive)', () => {
    const dict = createDictionaryFromText(SAMPLE);
    expect(isValidWord(dict, 'cat')).toBe(true);
    expect(isValidWord(dict, 'CAT')).toBe(true);
  });
  it('returns false for unknown words', () => {
    const dict = createDictionaryFromText(SAMPLE);
    expect(isValidWord(dict, 'xyz')).toBe(false);
  });
});

describe('hasPrefix', () => {
  it('returns true for known prefixes', () => {
    const dict = createDictionaryFromText('CAT\n');
    expect(hasPrefix(dict, 'CA')).toBe(true);
  });
  it('returns false for unknown prefixes', () => {
    const dict = createDictionaryFromText('CAT\n');
    expect(hasPrefix(dict, 'XY')).toBe(false);
  });
});
