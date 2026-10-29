const VERSION = 'dev';
/* übergabe. Service Worker: cached die Shell, index.html zuerst aus dem Netz, offline aus dem Cache. */
const CACHE = 'uebergabe-' + VERSION;
const SHELL = ['./', './index.html', './logik.js', './pdf.js', './manifest.webmanifest', './icon.svg'];
const OPTIONAL = ['./icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(SHELL);
    await Promise.all(OPTIONAL.map((u) => c.add(u).catch(() => null)));
  }));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.filter((n) => n.startsWith('uebergabe-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const istSeite = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (istSeite) {
    e.respondWith((async () => {
      try {
        const antwort = await fetch(req);
        if (antwort.ok) {
          const c = await caches.open(CACHE);
          c.put('./index.html', antwort.clone());
        }
        return antwort;
      } catch (_) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const treffer = await caches.match(req);
    if (treffer) return treffer;
    const antwort = await fetch(req);
    if (antwort.ok) (await caches.open(CACHE)).put(req, antwort.clone());
    return antwort;
  })());
});
