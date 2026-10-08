// @ts-check
// anillo/abrir.js · Lo que comparten las tres superficies que salen de ENGRAMA hacia EVA o SET (docs/ESPEC_pantallas_anillo.md §4.6 y
// adenda 17.5): las tarjetas de Inicio y `#/vivo`/`#/nivel` del estudiante, y "Herramientas de clase" del profe.
//
//   1. QUÉ destinos ve cada rol (`destinosVisibles`): solo los que tienen una base válida en config.json (anillo/destinos.js). Sin base,
//      el enlace no se pinta. El estudiante nunca ve los del docente, ni al revés; el admin no ve ninguno.
//   2. CÓMO se sale (`crearSalida`): el pase (el token de acceso, que abre toda la API 1 hora) se pide AL TOCAR, nunca al pintar. Por eso
//      ningún `href`, `data-*` ni nodo de la pantalla lo contiene antes del toque. Después de armar el enlace con `armarEnlaceAnillo`
//      (el único lugar que escribe `pase=` y `tenant=`, V5) se navega en la MISMA pestaña con `location.assign` (C4, PROVISIONAL): un
//      `window.open` tras un `await` lo bloquean los navegadores móviles.
//
// Reglas de este archivo (U31, tramposos x_pase_en_href / x_pase_en_consola / x_pase_en_almacenamiento):
//   - el pase y el enlace NO se guardan en ningún almacenamiento, NO salen por la consola y NO viajan en ningún mensaje de error, tampoco
//     cuando algo falla;
//   - un segundo toque mientras se sale no navega otra vez: la salida queda cerrada hasta que la página vuelva de la caché de ida y vuelta
//     (`pageshow` con `persisted`, que `rearmar` atiende).
import { armarEnlaceAnillo } from './enlace.js';
import { leerBases } from './destinos.js';
import { accionUnica } from '../api/cliente.js';

/** Qué destinos ve cada rol (§4.6, "El estudiante nunca ve los enlaces del docente, ni al revés"). El admin no ve ninguno. */
export const DESTINOS_POR_ROL = {
  student: ['eva_celular', 'set_examen'],
  teacher: ['eva_tablero', 'eva_escamas', 'set_revisar'],
};

/** SET responde 400 si `tenant=` viene mal formado (adenda 17.5): una institución que no es un UUID no pinta enlaces a SET. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Los formatos que armarEnlaceAnillo acepta (anillo/enlace.js los exige también): la vista los revisa ANTES de pedir el pase, para no
// salir a otro origen con un código que ese destino no lee. tests/unit/anillo_abrir.test.mjs vigila que ambos estén de acuerdo.
const SALA_DE_EVA = /^[A-Za-z0-9]{1,8}$/;
const CODIGO_DE_EXAMEN = /^[A-Za-z0-9_-]{1,32}$/;
/** @param {unknown} v */ export const salaValida = (v) => typeof v === 'string' && SALA_DE_EVA.test(v);
/** @param {unknown} v */ export const codigoDeExamenValido = (v) => typeof v === 'string' && CODIGO_DE_EXAMEN.test(v);

/**
 * La institución ACTIVA de la sesión (la que manda `X-Tenant-ID`), o null.
 * @param {{colegioActivo?: string, sesion?: {colegio?: {id?: string}}}|null|undefined} ctx
 * @returns {string|null}
 */
export function tenantActivo(ctx) {
  const id = ctx?.colegioActivo ?? ctx?.sesion?.colegio?.id;
  return typeof id === 'string' && id !== '' ? id : null;
}

/**
 * Los destinos que ESTE rol puede abrir con ESTA configuración e institución: solo los que tienen una base válida (los de SET, además,
 * una institución activa con forma de UUID). Pura.
 * @param {string|undefined} rol 'student' | 'teacher' | 'admin'
 * @param {Record<string, unknown>|null|undefined} config el contenido de config.json
 * @param {string|null|undefined} tenantId la institución activa
 * @returns {{destino: string, base: string}[]}
 */
export function destinosVisibles(rol, config, tenantId) {
  const propios = /** @type {Record<string, string[]>} */ (DESTINOS_POR_ROL)[String(rol)] || [];
  const bases = leerBases(config, tenantId);
  const salida = [];
  for (const destino of propios) {
    const esSet = destino.startsWith('set_');
    const base = esSet ? bases.set : bases.eva;
    if (!base) continue;
    if (esSet && !(typeof tenantId === 'string' && UUID.test(tenantId))) continue;
    salida.push({ destino, base });
  }
  return salida;
}

/** @param {{config?: Record<string, unknown>, sesion?: {rol?: string}}} ctx @returns {{destino: string, base: string}[]} lo que el rol de esta sesión puede abrir */
export function destinosDeLaSesion(ctx) {
  return destinosVisibles(ctx?.sesion?.rol, ctx?.config, tenantActivo(ctx));
}

/**
 * Prepara la salida a UN destino. `abrir(valores)` pide el pase AHORA (al tocar), arma el enlace y navega; lanza si algo falla (la vista
 * muestra su propio texto: el error nunca lleva el pase). Una sola salida a la vez, y ninguna otra hasta `rearmar()`.
 * @param {{pedirPase?: () => Promise<string>, irA?: (url: string) => void, colegioActivo?: string, sesion?: {colegio?: {id?: string}}}} ctx
 * @param {string} destino uno de NOMBRES_DE_DESTINO
 * @param {string} base la base validada que dio `destinosVisibles`
 */
export function crearSalida(ctx, destino, base) {
  let salio = false;
  const abrirUnaVez = accionUnica(async (/** @type {{sala?: string, codigo?: string}} */ valores = {}) => {
    if (salio) return;
    if (typeof ctx.pedirPase !== 'function') throw new Error('anillo/abrir: la sesión no sabe pedir el pase');
    const pase = await ctx.pedirPase(); // AL TOCAR: nunca al pintar
    const enlace = armarEnlaceAnillo({ base, destino: /** @type {any} */ (destino), pase, tenant: tenantActivo(ctx) ?? undefined, ...valores });
    salio = true;
    (ctx.irA ?? ((url) => location.assign(url)))(enlace);
  });
  return {
    abrir: abrirUnaVez,
    /** ¿Ya se mandó a la persona a otro origen? (la vista deja el botón en "Abriendo…") */
    get salio() { return salio; },
    /** La página volvió de la caché de ida y vuelta: se puede salir otra vez. */
    rearmar() { salio = false; },
  };
}

/**
 * Llama a `alVolver` cuando la página regresa de la caché de ida y vuelta (el botón "atrás" desde EVA o SET): `pageshow` con `persisted`.
 * Devuelve cómo dejar de escuchar. Sin `window` (Node) no hace nada.
 * @param {() => void} alVolver
 * @returns {() => void}
 */
export function alVolverDeOtroOrigen(alVolver) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
  const oyente = (/** @type {any} */ ev) => { if (ev.persisted) alVolver(); };
  window.addEventListener('pageshow', oyente);
  return () => window.removeEventListener('pageshow', oyente);
}
