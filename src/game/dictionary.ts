export type Dictionary = {
  words: Set<string>;
  prefixes: Set<string>;
};

export function createDictionaryFromText(text: string): Dictionary {
  const words = new Set<string>();
  const prefixes = new Set<string>(['']);
  for (const raw of text.split(/\r?\n/)) {
    const w = raw.trim().toUpperCase();
    if (!w) continue;
    words.add(w);
    for (let i = 1; i <= w.length; i++) {
      prefixes.add(w.slice(0, i));
    }
  }
  return { words, prefixes };
}

export function isValidWord(dict: Dictionary, word: string): boolean {
  return dict.words.has(word.toUpperCase());
}

export function hasPrefix(dict: Dictionary, prefix: string): boolean {
  return dict.prefixes.has(prefix.toUpperCase());
}

export async function loadDictionaryFromUrl(url: string): Promise<Dictionary> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`dictionary fetch failed: ${res.status}`);
  const text = await res.text();
  return createDictionaryFromText(text);
}
