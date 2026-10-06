// @ts-check
// sw.js · Service worker escrito a mano (§6.1: "un service worker escrito a mano, con su lista
// de precarga, es más corto y se puede auditar" que el plugin de Next.js). Reglas (§7.3):
//   - el shell abre sin red tras la primera visita → precache + estrategia caché-primero;
//   - NADA de /api se guarda NUNCA (H-4 de la auditoría de seguridad 02): en un equipo compartido, el
//     estudiante B veía el perfil, el saldo y los retos del estudiante A cuando fallaba la red, porque la
//     respuesta cacheada de A se servía a cualquiera. Sin red, la app muestra "Sin conexión" y no datos
//     viejos: se pierde el "último estado conocido" de la API, a propósito;
//   - el shell (HTML, JS, CSS, Drako) sí se precarga: abre sin red y lo explica.
//
// Súbelo un número cada vez que cambie la lista de precarga o la estrategia; la `activate`
// borra cualquier caché con otro nombre.
const VERSION = 'engrama-shell-v17';

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
  // H-6: '/config.json' YA NO se precarga ni se cachea: va siempre a la red (ver `fetch` más abajo). Una
  // configuración vieja servida desde caché podía dejar a la app en un modo equivocado; sin red, la app
  // dice "Sin conexión" en vez de arrancar con una configuración que ya no es la del despliegue.
  '/estilos/base.css',
  '/estilos/tipografia.css',
  '/estilos/componentes.css',
  '/estilos/formularios.css',
  '/estilos/juego.css', // game feel del estudiante
  '/publico/diseno/tokens.css',
  '/publico/diseno/drako/icono-32.svg',
  '/publico/diseno/drako/presenta.svg',
  '/publico/diseno/drako/celebra.svg',
  '/publico/diseno/drako/piensa.svg',
  '/publico/diseno/drako/ups.svg',
  '/publico/diseno/drako/espera.svg',
  '/src/app.js',
  '/src/config.js',
  '/src/vistas/estudiante/respuestas_locales.js',
  '/src/vistas/error_config.js',
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
  '/src/ui/progreso.js',
  '/src/ui/panel_resultado.js',
  '/src/ui/boton.js',
  '/src/ui/toque.js',
  '/src/ui/celebracion.js',
  '/src/ui/sello.js',
  '/src/ui/estados.js',
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
  // H-4: la API pasa derecho a la red, sin respondWith: este service worker no la ve, no la guarda y
  // no la sirve nunca de respaldo. (Las cachés viejas, que SÍ la guardaban, se borran en `activate`.)
  if (url.pathname.startsWith('/api/')) return;
  // H-6: la configuración del despliegue siempre de la red, nunca de este service worker.
  if (url.pathname === '/config.json') return;
  ev.respondWith(cachePrimeroConRed(request));
});

async function cachePrimeroConRed(request) {
  const enCache = await caches.match(request);
  if (enCache) return enCache;
  const resp = await fetch(request);
  if (resp.ok) (await caches.open(VERSION)).put(request, resp.clone());
  return resp;
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
