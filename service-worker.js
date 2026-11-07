/* ACADELY static shell cache. User data remains in browser LocalStorage and is
   never written to Cache Storage. Keep this worker and manifest under /unitrack/.
*/
const CACHE_NAME = 'acadely-shell-v3';
const BASE_URL = new URL('./', self.registration.scope);
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/grade-math.js',
  './js/app.js',
  './js/account-cloud.js',
  './js/supabase-config.js',
  './assets/branding/favicon.svg',
  './assets/branding/favicon-16.png',
  './assets/branding/favicon-32.png',
  './assets/branding/apple-touch-icon.png',
  './assets/branding/acadely-pwa-192.png',
  './assets/branding/acadely-pwa-512.png',
  './assets/branding/acadely-logo-white.svg',
  './assets/branding/acadely-icon-white.svg',
];
const SHELL_PATHS = new Set(SHELL_FILES.map((file) => new URL(file, BASE_URL).pathname));
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const SCRIPT_HOST = 'cdn.jsdelivr.net';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_FILES.map((file) => new Request(new URL(file, BASE_URL).href, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('acadely-shell-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'ACADELY_SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.hostname === SCRIPT_HOST && url.pathname === '/npm/@supabase/supabase-js@2') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const update = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
      return cached || update;
    })());
    return;
  }
  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const update = fetch(request).then((response) => {
        if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
        return response;
      });
      return cached || update;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  const isAppNavigation = request.mode === 'navigate' &&
    (url.pathname === BASE_URL.pathname || url.pathname === new URL('index.html', BASE_URL).pathname);
  if (isAppNavigation) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(new URL('index.html', BASE_URL), response.clone());
        return response;
      } catch {
        const client = event.clientId ? await self.clients.get(event.clientId) : null;
        client?.postMessage('ACADELY_OFFLINE_FALLBACK');
        const shell = await cache.match(new URL('index.html', BASE_URL).href, { ignoreSearch: true });
        if (shell) return shell;
        return new Response('Acadely is offline. Reconnect and reload to open the app.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  if (SHELL_PATHS.has(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      const update = fetch(request).then((response) => {
        if (response.ok) cache.put(new URL(url.pathname).href, response.clone());
        return response;
      });
      return cached || update;
    })());
  }
});
