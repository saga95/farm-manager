/*
 * Service worker (#104, SRS §30): makes the app installable and lets it open
 * with no signal. Deliberately simple - no offline data sync:
 * - built files (/_next/static, fonts, icons, locales): cache first; their
 *   names change on every release, so they never go stale;
 * - page navigations: network first, falling back to the cached copy of that
 *   page, or a small "you're offline" page for pages not visited yet;
 * - everything else (API calls, S3 photo URLs): straight to the network,
 *   never cached, so data is always current and private photos never stored.
 */
const VERSION = 'v1';
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const SHELL = ['/offline', '/manifest.json', '/icons/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(PAGES).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => ![STATIC, PAGES].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = url =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/locales/') ||
    url.pathname.startsWith('/fonts/') ||
    /\.(woff2?|css)$/.test(url.pathname));

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          if (res.ok) caches.open(PAGES).then(c => c.put(request, copy));
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/offline')) || Response.error())
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        hit =>
          hit ||
          fetch(request).then(res => {
            const copy = res.clone();
            if (res.ok) caches.open(STATIC).then(c => c.put(request, copy));
            return res;
          })
      )
    );
  }
  // Anything else: default network behaviour (API, photos, auth)
});
