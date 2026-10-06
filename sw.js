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
const VERSION = 'engrama-shell-v15';

// Cada encargo agrega los suyos en su propio commit (W7: Inicio + api/cliente,core,retos + los
// SVG de Drako que usa el estudiante; W10: profe/grupos,grupo,sesion_asistencia + api/profe). El
// shell debe abrir sin red con lo de aquí, nada más — TODO lo que `src/app.js` importe estática-
// mente, para cualquier rol, tiene que estar aquí (§7.3): la primera visita de verdad no pasa por
// el service worker (todavía no ha terminado de instalarse), así que si un módulo no está en esta
// lista, la segunda visita sin red lo pierde en silencio.
const PRECARGA = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  // W22: app.js lo pide SIEMPRE al arrancar (ENGRAMA_AUTH=mock|perfil_actual|supabase, §7.4) —
  // tiene que abrir sin red desde el primer reintento offline, no solo después de que una visita
  // en línea lo haya cacheado de oportunidad (cachePrimeroConRed no tiene reintento sin caché).
  '/config.json',
  '/estilos/base.css',
  '/estilos/tipografia.css',
  '/estilos/componentes.css',
  '/estilos/formularios.css',
  '/estilos/juego.css', // game feel del estudiante
  '/publico/diseno/tokens.css',
  '/publico/diseno/drako/icono-32.svg',
  '/publico/diseno/drako/presenta.svg',
  '/publico/diseno/drako/celebra.svg',
  '/src/app.js',
  '/src/rutas.js',
  '/src/textos.js',
  '/src/ui/dom.js',
  '/src/ui/red.js',
  '/src/ui/escudo.js',
  '/src/ui/drako.js',
  '/src/ui/sonido.js',
  '/src/ui/movimiento.js', // game feel: la duración de todo efecto (reduced-motion)
  '/src/ui/boton_sonido.js',
  '/src/ui/conteo.js',
  '/src/ui/monedas.js',
  '/src/ui/ultimo_visto.js',
  '/src/ui/racha.js',
  '/src/ui/titulo.js',
  '/src/ui/nav_inferior.js',
  // Segunda pasada de diseño (2026-09-28): confeti (inicio/asistencia/revisión) y la barra con
  // "Cerrar sesión" del profe/admin (grupos, crear_grupo) — nuevos módulos que app.js ya importa
  // de forma transitiva para cualquier rol, así que van aquí como todos los demás (arriba).
  '/src/ui/confeti.js',
  '/src/ui/barra_rol.js',
  '/src/auth/mock.js',
  '/src/vistas/entrada.js',
  '/src/vistas/perfil.js', // W22: import estático de app.js
  // Login piloto: la pantalla obligatoria "Crea tu contraseña" (import estático de app.js), el
  // formulario que comparte con el perfil y las reglas de la contraseña nueva.
  '/src/vistas/crear_contrasena.js',
  '/src/vistas/formulario_contrasena.js',
  '/src/aviso.js', // aviso de datos (Ley 1581): app.js y entrada.js lo importan
  '/src/vistas/aviso_datos.js',
  '/src/vistas/sin_perfil.js', // cuenta sin inscribir (import estático de app.js)
  '/src/auth/clave.js',
  '/src/ui/selector_colegio.js', // login piloto (B): barra_rol.js e inicio.js lo importan
  '/src/vistas/estudiante/inicio.js',
  '/src/vistas/estudiante/asistencia.js',
  '/src/vistas/estudiante/retos.js',
  '/src/vistas/estudiante/reto_flujo.js',
  '/src/vistas/estudiante/revision.js',
  '/src/ui/retro.js',
  '/src/api/cliente.js',
  '/src/api/core.js',
  '/src/api/retos.js',
  '/src/api/profe.js',
  '/src/vistas/profe/grupos.js',
  '/src/vistas/profe/grupo.js',
  '/src/vistas/profe/sesion_asistencia.js',
  '/src/vistas/profe/logro.js',
  '/src/vistas/profe/errores.js',
  '/src/vistas/profe/retos.js',
  '/src/api/admin.js',
  '/src/vistas/admin/crear_grupo.js',
  '/src/vistas/admin/asignar_docente.js',
  '/src/vistas/admin/importar_csv.js',
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
  // 'limpiar-api' (login piloto, B): solo las respuestas de /api guardadas como respaldo sin red; el shell
  // precargado se queda. Lo pide app.js al cambiar de institución y al cerrar sesión: ni lo de otro colegio
  // ni lo del estudiante anterior se sirve de respaldo.
  if (ev.data === 'limpiar-api') {
    ev.waitUntil(caches.open(VERSION).then(async (c) => {
      for (const req of await c.keys()) if (new URL(req.url).pathname.startsWith('/api/')) await c.delete(req);
    }));
  }
  if (ev.data === 'limpiar-todo') {
    ev.waitUntil(caches.keys().then((n) => Promise.all(n.map((k) => caches.delete(k)))));
  }
});
