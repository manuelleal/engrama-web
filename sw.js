// @ts-check
// sw.js · Service worker escrito a mano (§6.1: "un service worker escrito a mano, con su lista
// de precarga, es más corto y se puede auditar" que el plugin de Next.js). Reglas (§7.3):
//   - el shell abre sin red tras la primera visita → precache + estrategia caché-primero;
//   - GET de la API: red primero, con caché de respaldo, SOLO para datos propios del estudiante;
//   - nunca se cachea un POST ni una respuesta de /teachers o /admin;
//   - cerrar sesión borra todo (lo hace auth/, llamando a `limpiarTodoElCache` de aquí).
//
// Súbelo un número cada vez que cambie la lista de precarga o la estrategia; la `activate`
// borra cualquier caché con otro nombre.
const VERSION = 'engrama-shell-v4';

// Cada encargo agrega los suyos en su propio commit (W7: Inicio + api/cliente,core,retos + los
// SVG de Drako que usa el estudiante). El shell debe abrir sin red con lo de aquí, nada más.
const PRECARGA = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/estilos/base.css',
  '/publico/diseno/tokens.css',
  '/publico/diseno/drako/icono-32.svg',
  '/publico/diseno/drako/presenta.svg',
  '/src/app.js',
  '/src/rutas.js',
  '/src/textos.js',
  '/src/ui/dom.js',
  '/src/ui/red.js',
  '/src/ui/escudo.js',
  '/src/ui/drako.js',
  '/src/ui/sonido.js',
  '/src/auth/mock.js',
  '/src/vistas/entrada.js',
  '/src/vistas/estudiante/inicio.js',
  '/src/vistas/estudiante/asistencia.js',
  '/src/ui/retro.js',
  '/src/api/cliente.js',
  '/src/api/core.js',
  '/src/api/retos.js',
];

// Nunca se cachea nada bajo estas rutas, ni de lectura: son del profe/admin, no "datos propios
// del estudiante en un dispositivo compartido" (§7.3, último punto).
const NUNCA_CACHEAR = ['/api/teachers', '/api/admin'];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECARGA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  const { request } = ev;
  if (request.method !== 'GET') return; // nunca se cachea un POST: se deja pasar tal cual.
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // nada cruza de origen (decisión 005).
  if (url.pathname.startsWith('/api/')) { ev.respondWith(redPrimeroConRespaldo(request, url)); return; }
  ev.respondWith(cachePrimeroConRed(request));
});

async function cachePrimeroConRed(request) {
  const enCache = await caches.match(request);
  if (enCache) return enCache;
  const resp = await fetch(request);
  if (resp.ok) (await caches.open(VERSION)).put(request, resp.clone());
  return resp;
}

async function redPrimeroConRespaldo(request, url) {
  if (NUNCA_CACHEAR.some((p) => url.pathname.startsWith(p))) return fetch(request);
  try {
    const resp = await fetch(request);
    if (resp.ok) (await caches.open(VERSION)).put(request, resp.clone());
    return resp;
  } catch (e) {
    const enCache = await caches.match(request);
    if (enCache) return enCache;
    throw e; // sin red y sin caché: que el cliente muestre su propio mensaje (§7.3).
  }
}

// auth/ (hito 3) llama a esto al cerrar sesión, vía postMessage al controller. Por ahora nadie lo
// dispara todavía (no hay auth real); queda listo aquí porque es responsabilidad del propio sw.js.
self.addEventListener('message', (ev) => {
  if (ev.data === 'limpiar-todo') {
    ev.waitUntil(caches.keys().then((n) => Promise.all(n.map((k) => caches.delete(k)))));
  }
});
