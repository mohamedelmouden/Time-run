const CACHE = 'flame-rebuild-v1';
const APP_ROOT = new URL('./', self.registration.scope).href;
const SAME_ORIGIN = (url) => new URL(url, APP_ROOT).origin === self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(APP_ROOT, { cache: 'reload' });
    if (!response.ok) throw new Error('Could not cache the app entry.');
    await cache.put(APP_ROOT, response.clone());
    const html = await response.text();
    const assetRefs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]);
    const assets = assetRefs.filter((ref) => /\.(?:js|css|svg|webmanifest)(?:[?#].*)?$/i.test(ref) && SAME_ORIGIN(ref)).map((ref) => new URL(ref, APP_ROOT).href);
    await Promise.allSettled(assets.map((url) => cache.add(url)));
    const stylesheets = assets.filter((url) => url.endsWith('.css'));
    const fontRefs = [];
    for (const url of stylesheets) {
      try {
        const css = await (await fetch(url)).text();
        for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          if (SAME_ORIGIN(match[1])) fontRefs.push(new URL(match[1], url).href);
        }
      } catch { /* app remains usable if an optional font is unavailable */ }
    }
    await Promise.allSettled([...new Set(fontRefs)].map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('flame-rebuild-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
        const cache = await caches.open(CACHE);
        await cache.put(APP_ROOT, response.clone());
        return response;
      }
      return (await caches.match(request)) || (await caches.match(APP_ROOT)) || response;
    }).catch(async () => (await caches.match(request)) || (await caches.match(APP_ROOT)) || Response.error()));
    return;
  }
  event.respondWith(fetch(request).then(async (response) => {
    if (response.ok) { const cache = await caches.open(CACHE); await cache.put(request, response.clone()); return response; }
    return (await caches.match(request)) || response;
  }).catch(async () => (await caches.match(request)) || Response.error()));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = windows.find((client) => SAME_ORIGIN(client.url));
    if (app) return app.focus();
    return self.clients.openWindow(APP_ROOT);
  })());
});
