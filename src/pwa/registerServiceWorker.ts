/**
 * navigator.serviceWorker の最小インターフェース。テストで差し替えるために型を自前で持つ
 * （DOM のグローバル型に依存すると eslint の no-undef を踏む）
 */
export type ServiceWorkerRegistrar = {
  register: (url: string) => Promise<unknown>;
};

/**
 * Service Worker を登録する。Android Chrome は fetch ハンドラを持つ Service Worker が
 * 無いとホーム画面追加を「アプリのインストール」として扱わないため必要。
 *
 * @returns 登録できたかどうか
 */
export async function registerServiceWorker(
  registrar: ServiceWorkerRegistrar | undefined,
  url: string,
): Promise<boolean> {
  if (!registrar) return false;
  try {
    await registrar.register(url);
    return true;
  } catch (error) {
    // 登録に失敗してもゲームは遊べるので投げない。ただし気付けるよう警告は残す
    console.warn('Service Worker の登録に失敗しました:', error);
    return false;
  }
}
