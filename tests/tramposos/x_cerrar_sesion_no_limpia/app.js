// @ts-check
// app.js · Arranca el shell: registra el service worker, monta el banner de red y el router.
import { crearBannerRed } from './ui/red.js';
import { instalarToque } from './ui/toque.js';
import { limpiarRespuestasEnCurso } from './vistas/estudiante/respuestas_locales.js';
import { reemplazarRaiz } from './ui/dom.js';
import { ruta, definirPorDefecto, iniciar, detener, reiniciarRutas, navegar } from './rutas.js';
import {
  accionUnica, configurarAlBloqueo, BLOQUEO_DEBE_CAMBIAR, BLOQUEO_SIN_PERFIL, fijarColegios, leerColegioActivo, cambiarColegioActivo,
} from './api/cliente.js';
import { renderEntrada } from './vistas/entrada.js';
import { renderInicio } from './vistas/estudiante/inicio.js';
import { renderPerfil } from './vistas/perfil.js';
import { renderCrearContrasena } from './vistas/crear_contrasena.js';
import { renderSinPerfil } from './vistas/sin_perfil.js';
import { renderErrorConfig } from './vistas/error_config.js';
import { cargarConfig, modoDeAuth } from './config.js';
import { renderConsentimiento, renderLeerAviso, renderErrorAviso } from './vistas/aviso_datos.js';
import { configurarAviso, leerAviso, debePedirConsentimiento } from './aviso.js';
import { textos } from './textos.js';
import { renderAsistencia } from './vistas/estudiante/asistencia.js';
import { renderRetos } from './vistas/estudiante/retos.js';
import { renderRetoFlujo } from './vistas/estudiante/reto_flujo.js';
import { renderGrupos } from './vistas/profe/grupos.js';
import { renderGrupo } from './vistas/profe/grupo.js';
import { renderSesionAsistencia } from './vistas/profe/sesion_asistencia.js';
import { renderLogro } from './vistas/profe/logro.js';
import { renderErrores } from './vistas/profe/errores.js';
import { renderRetosProfe } from './vistas/profe/retos.js';
import { renderCrearGrupo } from './vistas/admin/crear_grupo.js';
import { renderAsignarDocente } from './vistas/admin/asignar_docente.js';
import { renderImportarCsv } from './vistas/admin/importar_csv.js';

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // location.protocol === 'http:' con host distinto de localhost no registra SW (el navegador ya
  // lo exige); en desarrollo local y en producción con HTTPS sí corre (§7.3, bloqueo 4 del §12).
  navigator.serviceWorker.register('/sw.js').catch((e) => {
    console.error('app: no se pudo registrar sw.js', e); // nunca un catch mudo (REGLAS.md §4)
  });
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
// La Sesion vigente (cambia cuando se entra de nuevo tras crear la contraseña), el contenedor de las
// vistas (una pantalla obligatoria lo reemplaza por uno nuevo, ui/dom.js:reemplazarRaiz) y el bloqueo
// que está en pantalla, si hay uno.
let sesionActual = null;
let vistaRaiz = null;
let bloqueoActual = null;
const BLOQUEO_CONSENTIMIENTO = 'consentimiento'; // el aviso de datos (Ley 1581) sin aceptar, o de una versión vieja

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
  // accionUnica (§7.2 regla 5): un segundo toque de "Entrar" mientras el primero vuela no dispara
  // una segunda petición de login.
  const entrarUnaVez = accionUnica(async (metodoEntrada, datos) => {
    const nuevaSesion = await authActivo.entrar(metodoEntrada, datos);
    entrarConSesion(nuevaSesion);
  });
  renderEntrada(vistaRaiz, modo, entrarUnaVez);
}

// Segunda pasada de diseño: "Cerrar sesión" del profe/admin (ui/barra_rol.js). Recargar es más
// simple y más robusto que desenredar el estado del router: iniciarApp() vuelve a correr desde
// cero, ya sin sesión (authActivo.salir() la borró), y cae directo en renderEntrada().
async function cerrarSesion() {
  limpiarCacheDeApi(); // un equipo compartido no guarda lo del estudiante anterior (§7.3)
  try {
    await authActivo.salir();
  } catch (e) {
    console.error('app: no se pudo cerrar sesión', e); // nunca un catch mudo
  } finally {
    location.reload();
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
  });
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
    entrarConSesion(nueva, { desdeElPrincipio: true });
  } catch (e) {
    cambiarColegioActivo(previo ?? id);
    throw e;
  }
}

// Pide al service worker que olvide las respuestas de /api guardadas como respaldo sin red (sw.js).
function limpiarCacheDeApi() {
  navigator.serviceWorker?.controller?.postMessage('limpiar-api');
}

// Una pantalla obligatoria (api/cliente.js avisa de un 403 `must_change_password` o de una cuenta sin
// inscribir, o el /auth/me del login ya trae la bandera). Se apaga el router y la pantalla va en un contenedor NUEVO: lo que alguna petición
// en vuelo termine de pintar en el viejo ya no pisa nada, y no hay a dónde navegar mientras dure.
function bloquear(codigo) {
  if (bloqueoActual === codigo) return; // varias llamadas en vuelo dan el mismo 403: una sola pantalla
  bloqueoActual = codigo;
  detener();
  vistaRaiz = reemplazarRaiz(vistaRaiz);
  if (codigo === BLOQUEO_SIN_PERFIL) { renderSinPerfil(vistaRaiz, { salir: cerrarSesion }); return; }
  if (codigo === BLOQUEO_CONSENTIMIENTO) {
    renderConsentimiento(vistaRaiz, { aviso: leerAviso(), aceptar: aceptarAviso, salir: cerrarSesion });
    return;
  }
  renderCrearContrasena(vistaRaiz, {
    cambiarContrasena: authActivo.cambiarContrasena, alTerminar: terminarBloqueo, salir: cerrarSesion,
  });
}

// Después de crear la contraseña: se vuelve a pedir /auth/me y, solo si ya no hay bandera, se entra.
async function terminarBloqueo() {
  const sesion = await authActivo.recargarSesion();
  if (sesion.debeCambiarContrasena) throw new Error('app: el servidor sigue pidiendo cambiar la contraseña');
  bloqueoActual = null;
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
  bloqueoActual = null;
  entrarConSesion(sesion);
}

function arrancarConSesion(desdeElPrincipio = false) {
  reiniciarRutas();
  ruta('/inicio', conCtx((raiz, params, query, ctx) => renderInicio(raiz, ctx)));
  ruta('/perfil', conCtx((raiz, params, query, ctx) => renderPerfil(raiz, ctx)));
  ruta('/datos', conCtx((raiz) => (leerAviso().ok
    ? renderLeerAviso(raiz, { aviso: leerAviso(), alVolver: () => navegar('/perfil') })
    : renderErrorAviso(raiz, leerAviso().faltan))));
  ruta('/asistencia', conCtx((raiz, params, query, ctx) => renderAsistencia(raiz, query, ctx)));
  ruta('/retos', conCtx((raiz, params, query, ctx) => renderRetos(raiz, ctx)));
  ruta('/retos/:id', conCtx((raiz, params, query, ctx) => renderRetoFlujo(raiz, params, query, ctx)));
  ruta('/profe/grupos', conCtx((raiz, params, query, ctx) => renderGrupos(raiz, ctx)));
  ruta('/profe/grupo/:gid', conCtx((raiz, params, query, ctx) => renderGrupo(raiz, params, ctx)));
  ruta('/profe/grupo/:gid/sesion', conCtx((raiz, params, query, ctx) => renderSesionAsistencia(raiz, params, ctx)));
  ruta('/profe/grupo/:gid/logro', conCtx((raiz, params, query, ctx) => renderLogro(raiz, params, ctx)));
  ruta('/profe/grupo/:gid/errores', conCtx((raiz, params, query, ctx) => renderErrores(raiz, params, ctx)));
  ruta('/profe/retos', conCtx((raiz, params, query, ctx) => renderRetosProfe(raiz, ctx)));
  ruta('/admin', conCtx((raiz, params, query, ctx) => renderCrearGrupo(raiz, ctx)));
  ruta('/admin/asignar-docente/:gid', conCtx((raiz, params, query, ctx) => renderAsignarDocente(raiz, params, ctx)));
  ruta('/admin/importar-csv/:gid', conCtx((raiz, params, query, ctx) => renderImportarCsv(raiz, params, ctx)));
  definirPorDefecto(rutaPorDefectoSegunRol(sesionActual));
  iniciar(vistaRaiz, { desdeElPrincipio });
}

iniciarApp();
