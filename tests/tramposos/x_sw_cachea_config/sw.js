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
// salida/web (E6) sube a v81: une la fluidez (v80) y el panel del super admin (v80); la v79 la toma cuentas/invitar-profe.
const VERSION = 'engrama-shell-v81';

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
  '/estilos/cara.css', // tanda visual 1: la cara de las pantallas (va de ultima)
  '/publico/diseno/tokens.css',
  '/publico/diseno/drako/icono-32.svg',
  '/publico/diseno/drako/presenta.svg',
  '/publico/diseno/drako/celebra.svg',
  '/publico/diseno/drako/piensa.svg',
  '/publico/diseno/drako/ups.svg',
  '/publico/diseno/drako/espera.svg',
  '/config.json',
  '/src/app.js',
  '/src/config.js',
  '/src/vistas/estudiante/respuestas_locales.js',
  '/src/vistas/error_config.js',
  '/src/rutas.js',
  '/src/textos.js',
  '/src/textos_anillo.js', // las cadenas de las pantallas del anillo (textos.js las esparce)
  '/src/textos_nav.js', // las cadenas de la navegación (textos.js las esparce)
  '/src/textos_juego.js', // las cadenas de la capa de juego (textos.js las esparce)
  '/src/navegacion.js', // la tabla de la navegación (docs/ESPEC_navegacion.md): la barra y el "volver" salen de ahí
  '/src/panel_diferido.js', // carga aparte las pantallas del profe y del admin (docs/ESPEC_margen_precarga.md): ellas van en DIFERIDOS
  '/src/ui/encabezado.js',
  '/src/ui/cabecera.js', // la cabecera única del estudiante
  '/src/bloqueos.js', // las pantallas obligatorias salen de app.js (espera, suspendida, ya no está...)
  '/src/ui/dom.js',
  '/src/ui/iconos.js', // los íconos de la casa, en SVG por código (barra, sonido, Mis monedas)
  '/src/ui/red.js',
  '/src/ui/escudo.js',
  '/src/ui/drako.js',
  '/src/ui/drako_rig.js', // Drako por partes (generado desde diseno/personajes/rig/)
  '/src/ui/drako_pose.js',
  '/src/ui/drako_animado.js',
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
  '/src/ui/linea_fin_reto.js', // la línea de tiempo del fin de reto (anime.js)
  '/src/ui/celebraciones.js', // el gancho único de limpieza de toda celebración
  '/src/ui/sello.js',
  '/src/ui/desglose.js', // adenda 17.8: el desglose de la asistencia, solo si el servidor lo trae y cuadra
  '/src/ui/movimientos.js', // W47: las filas de "Mis monedas" (puro)
  '/src/ui/semana.js', // W51: "Tu semana" (los 7 puntos y la semana completa)
  '/src/ui/merito.js', // W50: los sellos de mérito del fin de reto
  '/src/vistas/estudiante/monedas.js', // W47: `#/monedas`
  '/src/ui/estados.js',
  '/src/ui/titulo.js',
  '/src/ui/nav_inferior.js',
  '/src/ui/nota_salida.js',
  // Segunda pasada de diseño (2026-09-28): confeti (inicio/asistencia/revisión) y la barra con
  // "Cerrar sesión" del profe/admin (grupos, crear_grupo) — nuevos módulos que app.js ya importa
  // de forma transitiva para cualquier rol, así que van aquí como todos los demás (arriba).
  '/src/ui/confeti.js',
  '/src/ui/barra_rol.js',
  '/src/ui/boton_salir.js',
  // Animación (vendor/PROCEDENCIA.md, autorizada por Christiam el 2026-10-06): anime.js mueve a Drako por partes y la
  // línea de tiempo del fin de reto; canvas-confetti dibuja el confeti. Mismo origen, sin tocar la CSP.
  '/vendor/animejs@4.5.0/anime.esm.min.js',
  '/vendor/canvas-confetti@1.9.4/confetti.module.mjs',
  '/src/auth/mock.js',
  '/src/auth/interfaz.js', // W30: el contrato de la Sesion y los niveles del MCER (lo importan escudo.js, ultimo_visto.js y perfil_actual.js)
  '/src/vistas/entrada.js',
  '/src/vistas/perfil.js', // W22: import estático de app.js
  // Login piloto: la pantalla obligatoria "Crea tu contraseña" (import estático de app.js), el
  // formulario que comparte con el perfil y las reglas de la contraseña nueva.
  '/src/vistas/crear_contrasena.js',
  '/src/vistas/formulario_contrasena.js',
  '/src/aviso.js', // aviso de datos (Ley 1581): app.js y entrada.js lo importan
  '/src/vistas/aviso_datos.js',
  '/src/vistas/sin_perfil.js', // cuenta sin inscribir (import estático de app.js)
  '/src/vistas/esperando.js', // W29: esperando a tu profe / tu solicitud ya no está
  '/src/vistas/suspendida.js', // W29: cuenta suspendida
  '/src/vistas/datos_solicitudes.js', // W33: mis solicitudes sobre mis datos
  '/src/vistas/registro.js', // W31: crear cuenta con código de grupo
  '/src/vistas/registro_campos.js', // W31: sus campos
  '/src/api/registro.js', // W31: POST /auth/registro
  '/src/anillo/enlace.js', // W35: el único lugar que arma el fragmento con el pase (decisión 013)
  '/src/anillo/destinos.js', // W35: las bases de EVA y SET, solo de config.json
  '/src/anillo/abrir.js', // W35: qué destinos ve cada rol y la salida al tocar
  '/src/vistas/estudiante/vivo.js', // W35: #/vivo (clase en vivo de EVA)
  '/src/vistas/estudiante/nivel.js', // W35: #/nivel (examen de SET)
  '/src/vistas/estudiante/salida_codigo.js', // W35: el formulario que comparten
  '/src/api/datos.js', // W33
  '/src/ui/estado_etiqueta.js', // W29: ícono + texto de cada estado
  '/src/ui/contacto.js', // W29: el contacto del aviso como texto seleccionable
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
];

// Las fuentes de marca (publico/fuentes/PROCEDENCIA.md) NO van en PRECARGA: son 64.264 bytes y con ellas el shell pasaría su techo de 830.000
// (docs/ESPEC_juego_oleada1.md §17.1.7). La app abre y se lee sin ellas (`font-display: swap` cae a la fuente del sistema). Se guardan aparte,
// sin frenar la instalación ni la toma de control: al activar, en segundo plano y sin `waitUntil`; y si eso no alcanzó, al primer uso (el `fetch`
// de abajo guarda todo lo que sirve de este origen). Sin red y sin haberlas guardado, la app se ve con la fuente del sistema.
const FUENTES = [
  '/publico/fuentes/baloo-2-latin-wght-normal.woff2',
  '/publico/fuentes/nunito-sans-latin-wght-normal.woff2',
];

// El sistema visual único (publico/diseno/sistema.css, copia byte a byte de diseno/sistema/; docs/ESPEC_visual_sistema1.md §0) tampoco va en
// PRECARGA: pesa 46.357 bytes. Se guarda con las fuentes, al activar y sin frenar nada. Sin red y sin haberlo guardado, la app abre y se lee
// (las hojas de `estilos/` sí están en el shell); se ve sin el cromo del sistema.
const APARTE = [
  '/publico/diseno/sistema.css',
];

// La práctica del día (docs/ESPEC_practica_del_dia.md §0): la explicación tras cada respuesta, la tanda, el repaso y la racha semanal. Son módulos
// DIFERIDOS: la app los carga con `import()` solo cuando el backend los ofrece, y si no cargan (sin red y sin haberlos guardado) funciona como antes.
// No van en PRECARGA (el shell tiene techo de 830.000 bytes; U59 lo vigila): se guardan al activar, como las fuentes y el sistema.
// U59 exige además que todo lo que un diferido importa de forma estática esté aquí o en PRECARGA.
const DIFERIDOS = [
  // Lingo Coins dentro de ENGRAMA (decisión 017): la tienda, la mochila, la Puja, Dar y Corregir, el presupuesto y la recarga. Todo diferido: el shell no crece.
  '/estilos/economia.css',
  '/src/textos_economia.js',
  '/src/api/economia.js',
  '/src/ui/economia.js',
  '/src/vistas/estudiante/tienda.js',
  '/src/vistas/estudiante/mochila.js',
  '/src/vistas/estudiante/puja.js',
  '/src/vistas/estudiante/inicio_economia.js',
  '/src/vistas/profe/economia_grupo.js',
  '/src/vistas/profe/tienda_grupo.js',
  '/src/vistas/profe/puja_profe.js',
  '/src/vistas/admin/profesores.js',
  '/estilos/practica.css',
  '/estilos/magia.css', // sprint de la magia (docs/ESPEC_avatar_fluidez.md): avatar, insignias y la franja del reto
  '/src/textos_magia.js',
  '/src/ui/avatar.js',
  '/src/ui/insignias.js',
  '/src/ui/fluidez.js',
  '/src/ui/magia_inicio.js',
  '/src/vistas/estudiante/avatar.js',
  '/src/vistas/estudiante/insignias.js',
  '/src/textos_practica.js',
  '/src/api/practica.js',
  '/src/ui/explicacion.js',
  '/src/vistas/estudiante/reto_l1.js',
  '/src/ui/practica.js',
  '/src/vistas/estudiante/inicio_practica.js',
  '/src/vistas/estudiante/repaso.js',
  '/src/ui/racha_semanal.js',
  '/src/ui/despejar_banda.js', // adenda 1 de ESPEC_visual_reto_tanda2: la banda de resultado no tapa lo que explica
  '/src/ui/lectura.js', // W84: el texto de un reto de Lectura (docs/ESPEC_lectura_texto.md)
  '/src/ui/respuesta_escrita.js', // W91: el campo de la pregunta escrita (docs/ESPEC_camino_y_tu_palabra.md §2)
  '/src/vistas/estudiante/camino.js', // W92: `#/camino`, el camino de nivel (docs/ESPEC_camino_y_tu_palabra.md §3)
  '/src/ui/camino.js',
  '/src/api/camino.js',
  '/src/textos_camino.js',
  // El panel del profe y del admin (docs/ESPEC_margen_precarga.md): 91.513 bytes que el estudiante descargaba en el shell sin pintarlos nunca.
  // app.js lo pide con UN import() (src/panel_diferido.js) en cuanto entra alguien que no es estudiante, así que sus pantallas quedan en memoria
  // como antes. Sin red, recargar no llega a ninguna pantalla con rol (config.json va siempre a la red, H-6): lo de aquí se guarda para abrir rápido.
  '/src/vistas/panel_docente.js',
  '/src/vistas/profe/grupos.js',
  '/src/vistas/profe/grupo.js',
  '/src/vistas/profe/sesion_asistencia.js',
  '/src/vistas/profe/inscripcion.js', // W32: el panel de inscripciones del grupo
  '/src/vistas/profe/inscripcion_codigo.js', // W32: su sección del código
  '/src/vistas/profe/inscripcion_pendientes.js', // W32: su lista de pendientes
  '/src/vistas/profe/inscripcion_red.js', // W32: la red de sus botones
  '/src/vistas/profe/logro.js',
  '/src/vistas/profe/errores.js',
  '/src/vistas/profe/retos.js',
  '/src/vistas/profe/herramientas_clase.js', // W35: tablero, Escamas y calificar escritura
  '/src/vistas/admin/crear_grupo.js',
  '/src/vistas/admin/asignar_docente.js',
  '/src/vistas/admin/importar_csv.js',
  '/src/api/profe.js',
  '/src/api/admin.js',
  '/estilos/entrada.css', // la entrada con marca (docs/ESPEC_visual_entrada.md): sin ella, la entrada se ve como antes
  // "¿Olvidaste tu contraseña?" (despliegue/docs/ESPEC_correo_recuperacion.md): app.js la carga con import() solo si config.json trae RECUPERAR_CLAVE.
  '/src/vistas/recuperar.js',
  '/src/textos_recuperar.js',
  '/src/auth/cambio_contrasena.js', // lo importa recuperar.js (POST /api/auth/contrasena con la sesión del enlace)
  // El panel del super admin y el tablero del admin (docs/ESPEC_panel_super_admin.md §4): app.js los carga con import() solo al abrir sus rutas.
  '/estilos/panel.css',
  '/src/textos_panel.js',
  '/src/api/panel.js',
  '/src/ui/graficas.js',
  '/src/vistas/panel/bloques.js',
  '/src/vistas/admin/tablero.js',
  '/src/vistas/super/clientes.js',
  '/src/vistas/super/cliente.js',
];

// Cuánto se espera a CADA recurso de la precarga. Antes era `cache.addAll(PRECARGA)`: todo o nada, sin límite de tiempo. Un solo recurso
// lento (que la primera pantalla ni siquiera necesita) tenía a la página SIN controlar hasta que llegara, y uno que fallara dejaba
// el service worker sin instalar (medido con herramientas/medir_sw.mjs: un SVG de 40 s → la página, lista a los 2,5 s, quedó controlada a
// los 42 s; en el redespliegue real, >30 s en 2 de 4 corridas). Ahora el tiempo de instalación tiene techo, el que no llegó se avisa en la
// consola del service worker y se guarda al primer uso (el `fetch` de abajo ya guarda lo que no estaba).
const ESPERA_POR_RECURSO_MS = 10000;

async function precargarUno(cache, ruta, fallidos) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_POR_RECURSO_MS);
  try {
    const resp = await fetch(ruta, { signal: control.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    await cache.put(ruta, resp);
  } catch (e) {
    fallidos.push(ruta);
    console.warn('sw: no precargué', ruta, e && e.message);
  } finally {
    clearTimeout(reloj);
  }
}

async function precargar() {
  const cache = await caches.open(VERSION);
  const fallidos = [];
  await Promise.all(PRECARGA.map((ruta) => precargarUno(cache, ruta, fallidos)));
  if (fallidos.length) console.warn(`sw: ${fallidos.length} de ${PRECARGA.length} sin precargar (se guardan al primer uso): ${fallidos.join(', ')}`);
}

self.addEventListener('install', (ev) => {
  ev.waitUntil(precargar().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
  guardarFuentes(); // en segundo plano, a propósito fuera de `waitUntil`: nada espera por las fuentes ni por el sistema visual
});

async function guardarFuentes() {
  try {
    const cache = await caches.open(VERSION);
    const fallidos = [];
    const guardar = async (ruta) => { if (!(await cache.match(ruta))) await precargarUno(cache, ruta, fallidos); };
    await Promise.all([...FUENTES, ...APARTE].map(guardar).concat(DIFERIDOS.map(guardar)));
  } catch (e) {
    console.warn('sw: no guardé las fuentes, el sistema visual ni los diferidos (se guardan al primer uso)', e && e.message);
  }
}

self.addEventListener('fetch', (ev) => {
  const { request } = ev;
  if (request.method !== 'GET') return; // nunca se cachea un POST: se deja pasar tal cual.
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // nada cruza de origen (decisión 005).
  // H-4: la API pasa derecho a la red, sin respondWith: este service worker no la ve, no la guarda y
  // no la sirve nunca de respaldo. (Las cachés viejas, que SÍ la guardaban, se borran en `activate`.)
  if (url.pathname.startsWith('/api/')) return;
  // H-6: la configuración del despliegue siempre de la red, nunca de este service worker.
  // El prototipo de respaldo de la magia (`/magia/*`, lo sirve Caddy tal cual): ni se precarga ni se intercepta; este service worker no lo ve.
  if (url.pathname === '/magia' || url.pathname.startsWith('/magia/')) return;
  ev.respondWith(cachePrimeroConRed(request));
});

// El reintento del panel del profe y del admin (src/panel_diferido.js; adenda 1 de docs/ESPEC_margen_precarga.md) pide el MISMO módulo con
// `?intento=N`: si un import() falla, el navegador guarda el fallo por dirección y no la vuelve a pedir. Pero aquí todo se guarda y se busca por
// dirección CON su consulta: sin quitar ese parámetro, el reintento no casaría con el panel ya guardado en DIFERIDOS (sin red, no abriría) y, con
// red, se guardaría otra vez con su consulta (una entrada por reintento). Se quita SOLO `intento` antes de buscar, de pedir a la red y de guardar;
// cualquier otra consulta queda como estaba.
const PARAMETRO_REINTENTO = 'intento';

/** La dirección con la que se busca, se pide y se guarda: la del pedido, sin el parámetro del reintento (el pedido tal cual si no lo trae). */
function sinReintento(request) {
  const url = new URL(request.url);
  if (!url.searchParams.has(PARAMETRO_REINTENTO)) return request;
  url.searchParams.delete(PARAMETRO_REINTENTO);
  return url.href;
}

async function cachePrimeroConRed(request) {
  const clave = sinReintento(request);
  const enCache = await caches.match(clave);
  if (enCache) return enCache;
  const resp = await fetch(clave);
  if (resp.ok) (await caches.open(VERSION)).put(clave, resp.clone());
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
