// @ts-check
// app.js · Arranca el shell: registra el service worker, monta el banner de red y el router.
import { crearBannerRed } from './ui/red.js';
import { instalarToque } from './ui/toque.js';
import { limpiarRespuestasEnCurso } from './vistas/estudiante/respuestas_locales.js';
import { reemplazarRaiz } from './ui/dom.js';
import { ruta, definirPorDefecto, iniciar, detener, reiniciarRutas, navegar } from './rutas.js';
import {
  accionUnica, configurarAlBloqueo, BLOQUEO_DEBE_CAMBIAR, fijarColegios, leerColegioActivo, cambiarColegioActivo,
} from './api/cliente.js';
import {
  BLOQUEO_CONSENTIMIENTO, BLOQUEO_YA_NO_ESTA, pintarBloqueo, resolverBloqueo, marcarEsperando, estabaEsperando,
} from './bloqueos.js';
import { renderEntrada } from './vistas/entrada.js';
import { renderRegistro } from './vistas/registro.js';
import { renderInicio } from './vistas/estudiante/inicio.js';
import { renderPerfil } from './vistas/perfil.js';
import { renderVivo } from './vistas/estudiante/vivo.js';
import { renderNivel } from './vistas/estudiante/nivel.js';
import { renderSolicitudesDatos } from './vistas/datos_solicitudes.js';
import { renderErrorConfig } from './vistas/error_config.js';
import { cargarConfig, modoDeAuth, registroConCodigo } from './config.js';
import { renderLeerAviso, renderErrorAviso } from './vistas/aviso_datos.js';
import { configurarAviso, leerAviso, debePedirConsentimiento } from './aviso.js';
import { textos } from './textos.js';
import { renderAsistencia } from './vistas/estudiante/asistencia.js';
import { renderRetos } from './vistas/estudiante/retos.js';
import { renderRetoFlujo } from './vistas/estudiante/reto_flujo.js';
import { renderGrupos } from './vistas/profe/grupos.js';
import { renderGrupo } from './vistas/profe/grupo.js';
import { renderSesionAsistencia, olvidarAsistencias } from './vistas/profe/sesion_asistencia.js';
import { renderInscripcion } from './vistas/profe/inscripcion.js';
import { renderLogro } from './vistas/profe/logro.js';
import { renderErrores } from './vistas/profe/errores.js';
import { renderRetosProfe } from './vistas/profe/retos.js';
import { renderCrearGrupo } from './vistas/admin/crear_grupo.js';
import { renderAsignarDocente } from './vistas/admin/asignar_docente.js';
import { renderImportarCsv } from './vistas/admin/importar_csv.js';

const HASH_REGISTRO = '#/registro';

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // location.protocol === 'http:' con host distinto de localhost no registra SW (el navegador ya
  // lo exige); en desarrollo local y en producción con HTTPS sí corre (§7.3, bloqueo 4 del §12).
  // Se registra cuando la página ya terminó de cargar (`load`), no al arrancar: la precarga de ~80 archivos compite por el ancho de banda con
  // la propia carga de la app, que es lo que importa en un celular. La app NO depende del service worker: sin él funciona igual.
  const registrar = () => navigator.serviceWorker.register('/sw.js').catch((e) => {
    console.error('app: no se pudo registrar sw.js', e); // nunca un catch mudo (REGLAS.md §4)
  });
  if (document.readyState === 'complete') registrar(); else window.addEventListener('load', registrar, { once: true });
}

function montarBanner() {
  const contenedor = document.getElementById('banner-red');
  if (!contenedor) return;
  const { nodo } = crearBannerRed();
  contenedor.replaceWith(nodo);
  nodo.id = 'banner-red';
}

// `config.json` lo sirve el servidor (nunca un secreto — ENGRAMA_AUTH=mock|perfil_actual|supabase,
// §7.4) y se pide SIEMPRE a la red (src/config.js). SIN valor por defecto (H-6): si falta, falla o no
// define un modo válido, la app muestra un error claro y NO cae al modo de prueba. `servidor_dev.mjs`
// sirve el `config.json` del propio repo (que pide mock EXPLÍCITAMENTE); el despliegue lo reemplaza a
// nivel de Caddy sin tocar este repo (`despliegue/Caddyfile`, `handle /config.json`).

function cargarAuth(modo) {
  if (modo === 'supabase') return import('./auth/supabase_rest.js');
  if (modo === 'perfil_actual') return import('./auth/perfil_actual.js');
  return import('./auth/mock.js');
}

// Se resuelve una sola vez, en iniciarApp(), según config.json — conCtx() y arrancarConSesion()
// lo usan después, así que no puede ser un import estático de un solo módulo (W22).
let authActivo = null;
let configActual = null; // el config.json ya leído: de ahí salen las bases de EVA y SET (anillo/destinos.js), nunca de la dirección ni de un campo
// La Sesion vigente (cambia cuando se entra de nuevo tras crear la contraseña), el contenedor de las
// vistas (una pantalla obligatoria lo reemplaza por uno nuevo, ui/dom.js:reemplazarRaiz) y el bloqueo
// que está en pantalla, si hay uno.
let sesionActual = null;
let vistaRaiz = null;
let bloqueoActual = null;
let controlDeBloqueo = null; // el control (`detener`) de la pantalla obligatoria que tenga temporizadores: la espera (bloqueos.js)

// W5: nada del router arranca sin sesión. Un actor sintético (hito 0) o, desde W22, un login real
// deja `document.body.dataset.listo = "1"` en la propia pantalla de entrada mientras tanto.
// W7: "#/inicio" ya es la Home real; necesita la Sesion (para el token y la constancia), así que
// se registra DESPUÉS de saber quién entró, no antes.
async function iniciarApp() {
  registrarServiceWorker();
  instalarToque(); // game feel: toque + vibración en cada botón principal del estudiante
  montarBanner();
  vistaRaiz = document.getElementById('vista');
  if (!vistaRaiz) return;
  configurarAlBloqueo(bloquear);
  let config;
  try {
    config = await cargarConfig();
  } catch (e) {
    console.error('app: no hay configuración válida; no arranco', e); // nunca mudo
    renderErrorConfig(vistaRaiz, /** @type {any} */ (e).causa || 'invalida');
    return;
  }
  configActual = config;
  const modo = /** @type {'mock'|'perfil_actual'|'supabase'} */ (modoDeAuth(config));
  authActivo = await cargarAuth(modo);
  configurarAviso(config);
  // Con cuentas reales no hay entrada sin aviso: sin responsable, contacto o versión en config.json, la app no continúa.
  if (typeof authActivo.registrarConsentimiento === 'function' && !leerAviso().ok) {
    renderErrorAviso(vistaRaiz, leerAviso().faltan);
    return;
  }
  const sesion = await authActivo.iniciar();
  if (bloqueoActual) return; // una pantalla obligatoria ya tomó la vista mientras se recuperaba la sesión
  if (sesion) { entrarConSesion(sesion); return; }
  arrancarSinSesion(modo);
}

// Sin sesión: la solicitud que ya no está, el registro con código de grupo (el hash literal `#/registro` es el enlace que el profe puede compartir; el CÓDIGO
// nunca va en la dirección) o la pantalla de entrada.
function arrancarSinSesion(modo) {
  // Estaba esperando a su profe y, al recargar, ya no hay sesión que recuperar (rechazar borra la cuenta): se lo decimos, sin culpa.
  if (estabaEsperando()) { bloquear(BLOQUEO_YA_NO_ESTA); return; }
  if (modo === 'supabase' && location.hash === HASH_REGISTRO) { abrirRegistro(); return; }
  // accionUnica (§7.2 regla 5): un segundo toque de "Entrar" mientras el primero vuela no dispara
  // una segunda petición de login.
  const entrarUnaVez = accionUnica(async (metodoEntrada, datos) => {
    const nuevaSesion = await authActivo.entrar(metodoEntrada, datos);
    entrarConSesion(nuevaSesion);
  });
  renderEntrada(vistaRaiz, modo, entrarUnaVez, modo === 'supabase' ? { crearCuenta: abrirRegistro } : {});
}

// W31 (§4.1): el registro con código de grupo. Con `REGISTRO_CON_CODIGO` distinto de `true` en config.json dice "Todavía no está abierto", sin formulario
// y sin petición. "Volver a entrar" recarga la página en la dirección limpia (sin `#/registro`): no queda nada del formulario en memoria.
function abrirRegistro() {
  controlDeBloqueo?.detener();
  controlDeBloqueo = null;
  bloqueoActual = null;
  vistaRaiz = reemplazarRaiz(vistaRaiz);
  renderRegistro(vistaRaiz, { abierto: registroConCodigo(configActual), aviso: leerAviso(), volver: () => location.replace(location.pathname + location.search) });
}

// Segunda pasada de diseño: "Cerrar sesión" del profe/admin (ui/barra_rol.js). Recargar es más
// simple y más robusto que desenredar el estado del router: iniciarApp() vuelve a correr desde
// cero, ya sin sesión (authActivo.salir() la borró), y cae directo en renderEntrada().
async function cerrarSesion() {
  controlDeBloqueo?.detener(); // la espera deja de revisar mientras se cierra la sesión
  marcarEsperando(false);
  await limpiarCacheDeApi(); // un equipo compartido no guarda lo del estudiante anterior (§7.3); se espera: luego se recarga la página
  limpiarRespuestasEnCurso(); // H-18: sus respuestas a medias tampoco se quedan para el siguiente
  olvidarAsistencias(); // W66: la asistencia que el profe tenía abierta en pantalla no la hereda quien entre después
  try {
    await authActivo.salir();
  } catch (e) {
    console.error('app: no se pudo cerrar sesión', e); // nunca un catch mudo
  } finally {
    // A la URL limpia (sin el `#/inicio` de quien salió): una recarga conservaba esa ruta en el historial, y
    // el botón "atrás" podía llevar a una pantalla con datos de esa persona. Sin `#`, es una carga nueva.
    location.replace(location.pathname + location.search);
  }
}

// Sin X-Tenant-ID: los actores sintéticos (hito 0-1) tienen un solo colegio, y su id de verdad
// lo genera mock_api.mjs en cada arranque — mandar el "demo" de mock.js chocaría con el real. El
// servidor usa la única membresía del actor cuando no se lo mandamos.
function conCtx(fn) {
  return async (raiz, params, query) => fn(raiz, params, query, {
    token: await authActivo.token(),
    sesion: sesionActual,
    // Login piloto (B): las instituciones del usuario y la activa (el selector solo aparece con más de una).
    colegios: sesionActual.colegios,
    colegioActivo: sesionActual.colegio?.id,
    avisoDatos: typeof authActivo.registrarConsentimiento === 'function', // cuentas reales: el aviso se puede leer siempre
    cambiarColegio: (sesionActual.colegios?.length ?? 0) > 1 && typeof authActivo.recargarSesion === 'function' ? cambiarColegio : undefined,
    // La traen supabase_rest.js y perfil_actual.js; mock.js no la soporta, y las vistas
    // (inicio.js, perfil.js) usan esto para no ofrecer un enlace muerto.
    cambiarContrasena: typeof authActivo.cambiarContrasena === 'function' ? authActivo.cambiarContrasena : undefined,
    salir: cerrarSesion,
    // W35 (§4.6): las bases de EVA y SET salen SOLO de config.json; el pase (el token) se pide al TOCAR un enlace, nunca al pintar (anillo/abrir.js).
    config: configActual,
    pedirPase: () => authActivo.token(),
    // W30: Inicio vuelve a pedir /auth/me en cada pintado (el nivel pudo cambiar en SET o EVA); solo con proveedores que lo soportan.
    recargarSesion: typeof authActivo.recargarSesion === 'function' ? recargarYGuardar : undefined,
  });
}

// La sesión fresca de /auth/me queda como la vigente para el resto de la app.
async function recargarYGuardar() {
  sesionActual = await authActivo.recargarSesion();
  return sesionActual;
}

// El estudiante entra por Home, el profe por sus grupos y el admin por su lista de grupos —
// nunca por una pantalla que no le sirve de nada (§4.2 y §4.3).
function rutaPorDefectoSegunRol(sesion) {
  if (sesion.rol === 'student') return '/inicio';
  if (sesion.rol === 'admin') return '/admin';
  return '/profe/grupos';
}

// Una sesión recién obtenida (login, sesión recuperada o vuelta de la pantalla obligatoria). Con la
// contraseña temporal NO arranca el router: el estudiante ve solo "Crea tu contraseña".
function entrarConSesion(sesion, { desdeElPrincipio = false } = {}) {
  sesionActual = sesion;
  fijarColegiosDeLaSesion(sesion);
  if (sesion.debeCambiarContrasena) { bloquear(BLOQUEO_DEBE_CAMBIAR); return; }
  // Después de crear la contraseña y antes de Inicio: el aviso de datos, hasta que el SERVIDOR diga que se aceptó.
  if (debePedirConsentimiento(sesion, leerAviso())) { bloquear(BLOQUEO_CONSENTIMIENTO); return; }
  arrancarConSesion(desdeElPrincipio);
}

// Login piloto (B): desde aquí TODA llamada manda `X-Tenant-ID` con el colegio activo de /auth/me, y
// nunca uno que no esté entre sus membresías (api/cliente.js). El modo mock no tiene membresías: sin encabezado.
function fijarColegiosDeLaSesion(sesion) {
  if (!sesion.colegios?.length) { fijarColegios({ activo: null, permitidos: null }); return; }
  fijarColegios({ activo: sesion.colegio.id, permitidos: sesion.colegios.map((c) => c.id) });
}

// El docente de dos instituciones elige otra: se manda su `X-Tenant-ID`, se vuelve a pedir /auth/me (el rol
// y el nombre pueden ser otros) y se repinta desde la ruta por defecto, con los datos de esa institución.
async function cambiarColegio(id) {
  const previo = leerColegioActivo();
  cambiarColegioActivo(id); // lanza si no es una de sus membresías: nunca sale una petición con un colegio ajeno
  try {
    const nueva = await authActivo.recargarSesion();
    limpiarCacheDeApi(); // lo guardado para el colegio anterior no se sirve como respaldo del nuevo
    limpiarRespuestasEnCurso(); // H-18: las respuestas a medias eran de la institución anterior
    olvidarAsistencias(); // W66: las asistencias recordadas eran de los grupos de la institución anterior
    entrarConSesion(nueva, { desdeElPrincipio: true });
  } catch (e) {
    cambiarColegioActivo(previo ?? id);
    throw e;
  }
}

// Pide al service worker que olvide las respuestas de /api guardadas como respaldo sin red (sw.js).
// La privacidad NO depende de que el service worker esté activo ni de que controle la página (en la primera visita puede tardar): además
// del mensaje, la propia página borra de la CacheStorage cualquier respuesta de /api (el SW actual ya no guarda ninguna; esto cubre
// cachés viejas y un controlador que aún no existe).
function limpiarCacheDeApi() {
  navigator.serviceWorker?.controller?.postMessage('limpiar-api');
  return borrarApiDeLasCaches().catch((e) => console.error('app: no pude limpiar las cachés de /api', e));
}

async function borrarApiDeLasCaches() {
  if (typeof caches === 'undefined') return;
  for (const nombre of await caches.keys()) {
    const cache = await caches.open(nombre);
    for (const peticion of await cache.keys()) if (new URL(peticion.url).pathname.startsWith('/api/')) await cache.delete(peticion);
  }
}

// Una pantalla obligatoria (api/cliente.js avisa de un 403 `must_change_password`, de una cuenta sin inscribir, pendiente o suspendida,
// o el /auth/me del login ya trae la bandera). Se apaga el router y la pantalla va en un contenedor NUEVO: lo que alguna petición
// en vuelo termine de pintar en el viejo ya no pisa nada, y no hay a dónde navegar mientras dure. Qué pantalla va con cada código, y la
// precedencia entre ellos, vive en bloqueos.js.
function bloquear(codigo) {
  const efectivo = resolverBloqueo(bloqueoActual, codigo, estabaEsperando());
  if (bloqueoActual === efectivo) return; // varias llamadas en vuelo dan el mismo 403: una sola pantalla
  controlDeBloqueo?.detener(); // la pantalla que se reemplaza no deja un temporizador vivo
  controlDeBloqueo = null;
  bloqueoActual = efectivo;
  detener();
  vistaRaiz = reemplazarRaiz(vistaRaiz);
  if (efectivo === BLOQUEO_YA_NO_ESTA) Promise.resolve(authActivo.salir()).catch((e) => console.error('app: no se pudo borrar la sesión local', e)); // la solicitud ya no está: no queda sesión que guardar
  controlDeBloqueo = pintarBloqueo(efectivo, vistaRaiz, {
    salir: cerrarSesion, aviso: leerAviso(), aceptarAviso, cambiarContrasena: authActivo.cambiarContrasena, alTerminar: terminarBloqueo,
    revisar: revisarDeNuevo, yaNoEsta: () => bloquear(BLOQUEO_YA_NO_ESTA), volverAEntrar: () => location.replace(location.pathname + location.search), crearCuenta: abrirRegistro,
    contextoDeApi: async () => ({ token: await authActivo.token() }), // W33: las solicitudes sobre mis datos desde el aviso obligatorio
  });
}

// Sale de la pantalla obligatoria hacia la app: ya no hay bloqueo, ni espera, ni marca de "estaba esperando".
function salirDelBloqueo() {
  controlDeBloqueo?.detener();
  controlDeBloqueo = null;
  bloqueoActual = null;
  marcarEsperando(false);
}

// "Revisar de nuevo" (y el sondeo de la espera): vuelve a pedir /auth/me. Si la cuenta ya está aprobada, entra; si no, esta función
// lanza el mismo 403 y la pantalla de espera lo explica (api/cliente.js ya avisó el bloqueo, que no cambia).
async function revisarDeNuevo() {
  const sesion = await authActivo.recargarSesion();
  salirDelBloqueo();
  entrarConSesion(sesion);
}

// Después de crear la contraseña: se vuelve a pedir /auth/me y, solo si ya no hay bandera, se entra.
async function terminarBloqueo() {
  const sesion = await authActivo.recargarSesion();
  if (sesion.debeCambiarContrasena) throw new Error('app: el servidor sigue pidiendo cambiar la contraseña');
  salirDelBloqueo();
  entrarConSesion(sesion);
}

// Registra la aceptación en el backend y vuelve a pedir /auth/me: se entra solo si el SERVIDOR ya la tiene
// (nunca por algo guardado aquí). Si no la guardó, se avisa y se queda en el aviso.
async function aceptarAviso() {
  await authActivo.registrarConsentimiento(leerAviso().version);
  const sesion = await authActivo.recargarSesion();
  if (debePedirConsentimiento(sesion, leerAviso())) {
    throw Object.assign(new Error(textos.aviso.errorGuardar), { mensaje: textos.aviso.errorGuardar });
  }
  salirDelBloqueo();
  entrarConSesion(sesion);
}

function arrancarConSesion(desdeElPrincipio = false) {
  reiniciarRutas();
  ruta('/inicio', conCtx((raiz, params, query, ctx) => renderInicio(raiz, ctx)));
  ruta('/perfil', conCtx((raiz, params, query, ctx) => renderPerfil(raiz, ctx)));
  ruta('/datos', conCtx((raiz) => (leerAviso().ok
    ? renderLeerAviso(raiz, { aviso: leerAviso(), solicitudes: '#/datos/solicitudes', rol: sesionActual.rol, alVolver: () => navegar(sesionActual.rol === 'student' ? '/perfil' : rutaPorDefectoSegunRol(sesionActual)) })
    : renderErrorAviso(raiz, leerAviso().faltan))));
  ruta('/datos/solicitudes', conCtx((raiz, params, query, ctx) => renderSolicitudesDatos(raiz, ctx))); // W33: todos los roles
  ruta('/vivo', conCtx((raiz, params, query, ctx) => renderVivo(raiz, query, ctx))); // W35: la sala de EVA
  ruta('/nivel', conCtx((raiz, params, query, ctx) => renderNivel(raiz, query, ctx))); // W35: el examen de SET
  ruta('/asistencia', conCtx((raiz, params, query, ctx) => renderAsistencia(raiz, query, ctx)));
  ruta('/retos', conCtx((raiz, params, query, ctx) => renderRetos(raiz, ctx)));
  ruta('/retos/:id', conCtx((raiz, params, query, ctx) => renderRetoFlujo(raiz, params, query, ctx)));
  ruta('/profe/grupos', conCtx((raiz, params, query, ctx) => renderGrupos(raiz, ctx)));
  ruta('/profe/grupo/:gid', conCtx((raiz, params, query, ctx) => renderGrupo(raiz, params, ctx)));
  ruta('/profe/grupo/:gid/sesion', conCtx((raiz, params, query, ctx) => renderSesionAsistencia(raiz, params, ctx)));
  ruta('/profe/grupo/:gid/inscripcion', conCtx((raiz, params, query, ctx) => renderInscripcion(raiz, params, ctx))); // W32: el código de grupo y quién espera aprobación
  ruta('/profe/grupo/:gid/logro', conCtx((raiz, params, query, ctx) => renderLogro(raiz, params, ctx)));
  ruta('/profe/grupo/:gid/errores', conCtx((raiz, params, query, ctx) => renderErrores(raiz, params, ctx)));
  ruta('/profe/retos', conCtx((raiz, params, query, ctx) => renderRetosProfe(raiz, ctx)));
  ruta('/admin', conCtx((raiz, params, query, ctx) => renderCrearGrupo(raiz, ctx)));
  ruta('/admin/asignar-docente/:gid', conCtx((raiz, params, query, ctx) => renderAsignarDocente(raiz, params, ctx)));
  ruta('/admin/importar-csv/:gid', conCtx((raiz, params, query, ctx) => renderImportarCsv(raiz, params, ctx)));
  definirPorDefecto(rutaPorDefectoSegunRol(sesionActual));
  // Con sesión, un `#/registro` heredado (el enlace del profe) no es una ruta de la app: se arranca desde la ruta por defecto.
  iniciar(vistaRaiz, { desdeElPrincipio: desdeElPrincipio || location.hash === HASH_REGISTRO });
}

iniciarApp();
