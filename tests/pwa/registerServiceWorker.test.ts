import { describe, it, expect, vi, afterEach } from 'vitest';
import { registerServiceWorker } from '../../src/pwa/registerServiceWorker';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('registerServiceWorker', () => {
  it('登録に成功したら true を返す', async () => {
    const register = vi.fn(async () => ({}));
    await expect(registerServiceWorker({ register }, '/toy-scrabble/sw.js')).resolves.toBe(true);
    expect(register).toHaveBeenCalledWith('/toy-scrabble/sw.js');
  });

  // Service Worker 非対応のブラウザでもゲームは動かないといけない
  it('serviceWorker が無い環境では何もせず false を返す', async () => {
    await expect(registerServiceWorker(undefined, '/toy-scrabble/sw.js')).resolves.toBe(false);
  });

  // 登録の失敗でゲームを落とさない。ただし黙って握り潰さず警告は残す
  it('登録に失敗しても投げずに警告を出す', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const register = vi.fn(async () => {
      throw new Error('insecure context');
    });
    await expect(registerServiceWorker({ register }, '/toy-scrabble/sw.js')).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
  });
});
