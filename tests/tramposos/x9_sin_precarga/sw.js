// TRAMPOSO X9 — versión rota a propósito: no precarga nada. Sin red, el shell no abre; se
// pierde en silencio (fricción de la auditoría UX, §5). Debe quedar en rojo en E7.
const VERSION = 'engrama-shell-tramposo';
const PRECARGA = []; // <- el error: nada queda en caché para cuando se caiga la red.

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECARGA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (ev) => { ev.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (ev) => {
  ev.respondWith((async () => {
    const enCache = await caches.match(ev.request);
    return enCache || fetch(ev.request);
  })());
});
