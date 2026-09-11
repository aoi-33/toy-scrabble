// ホーム画面に「アプリとして」追加するための Service Worker。
// Android Chrome は fetch ハンドラを持つ Service Worker が無いと、ホーム画面追加を
// ただのブックマークとして扱う。あわせてオフラインでも遊べるようにする。
//
// キャッシュ方針:
//   /assets/ 配下だけ cache-first。Vite がファイル名にハッシュを付けるので中身が変わらない。
//   それ以外は network-first。とくに dict/defs/*.json と words.txt はハッシュが付かず、
//   cache-first にするとデプロイ後も古い辞書を配り続けてしまう。

// このファイルだけ Service Worker スコープで動くため、そこに居るグローバルを宣言しておく
/* global self, caches, fetch, URL */

const CACHE = 'toy-scrabble-v1';

self.addEventListener('install', () => {
  // 新しい Service Worker をすぐ有効にする（古いキャッシュを引きずらない）
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

async function putInCache(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await putInCache(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) await putInCache(request, response.clone());
    return response;
  } catch (error) {
    const hit = await caches.match(request);
    if (hit) return hit;
    // 画面遷移はキャッシュ済みのシェルで代替する（オフライン起動）
    if (request.mode === 'navigate') {
      const shell = await caches.match(new URL('./', self.registration.scope).href);
      if (shell) return shell;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(url.pathname.includes('/assets/') ? cacheFirst(request) : networkFirst(request));
});
