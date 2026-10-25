/**
 * Service worker for Highwater (brief P1a: works with weak or no signal).
 *
 * A service worker is a small script the browser keeps running for this site.
 * It sits between the app and the network, so it can answer from a saved copy
 * when the network is down.
 *
 * What it does:
 *   - On install, saves ("precaches") the app's own files: the page, code, styles,
 *     main fonts, guidance, and built data (gauges, boundaries, Census numbers).
 *   - Our own files: answer from the saved copy first (fast and works offline),
 *     and fetch anything not saved yet, saving it for next time.
 *   - The page itself: try the network first so updates show up, and fall back
 *     to the saved copy when offline.
 *   - Live data from government APIs is NEVER answered from this cache.
 *     The app keeps its own clearly labeled "last loaded" copy instead,
 *     so old data is never passed off as live.
 *
 * Built by vite.config.ts, which fills in the version and the file list at build time.
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `sc5ready-${VERSION}`;
// Match saved files by address only. Servers label files with 'Vary' headers, and a
// browser's request for a code module can differ slightly from the request that saved it.
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

// Delete caches from older versions of the app.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sc5ready-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Only our own site. Government APIs and map tiles go straight to the network.
  if (url.origin !== self.location.origin) return;

  // The page: network first, saved copy when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./', MATCH).then((r) => r || caches.match('./index.html', MATCH))),
    );
    return;
  }

  // Everything else from our site: saved copy first, then network (and save it).
  event.respondWith(
    caches.match(request, MATCH).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
