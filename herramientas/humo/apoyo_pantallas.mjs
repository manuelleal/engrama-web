// @ts-check
// humo/apoyo_pantallas.mjs · Lo que comparten los pasos del humo de las pantallas del anillo (flujo_pantallas.mjs y flujo_pantallas_replica.mjs):
// llamar al cliente real sin que un error HTTP corte el guion, entrar por el GoTrue falso, el texto del escudo, la normalización de los enlaces
// (el pase y la institución se anotan como `<pase>` y `<tenant>`) y el MEDIDOR de fugas (§9.1: lo que sale fuera de /api, y si el pase, una
// contraseña o el código de grupo aparecen en un almacenamiento o en la consola).
import { pedirJson, ErrorApi } from '../../src/api/cliente.js';
import { registrarse } from '../../src/api/registro.js';
import { perfilAJson } from '../../src/auth/perfil_actual.js';
import { textos } from '../../src/textos.js';
import { etiquetaDeEstado } from '../../src/ui/estado_etiqueta.js';

const SALTO = String.fromCharCode(10);
export const AVISO_VERSION = '2026-10-v1';
export const TOKEN_DOCENTE = 'docente-demo';
export const TOKEN_OTRO_DOCENTE = 'docente-otro';
export const TOKEN_ADMIN = 'admin-demo';

/**
 * Ejecuta `fn`; un error HTTP del cliente (ErrorApi) no corta el guion: se devuelve para contarlo. Cualquier otro error sí lo corta.
 * @template T @param {() => Promise<T>} fn
 * @returns {Promise<{ok: true, valor: T} | {ok: false, error: ErrorApi}>}
 */
export async function intentar(fn) {
  try { return { ok: true, valor: await fn() }; } catch (e) {
    if (e instanceof ErrorApi) return { ok: false, error: e };
    throw e;
  }
}

/** Entra por el GoTrue falso (`/auth/v1`, como lo hace la app). @returns {Promise<string|null>} el token de acceso, o null si las credenciales no sirven */
export async function iniciarSesion(urlShell, correo, clave) {
  const resp = await fetch(`${urlShell}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: correo, password: clave }),
  });
  if (!resp.ok) return null;
  return (await resp.json()).access_token;
}

/** GET /auth/me con el cliente real. @param {string} token @param {string} [tenantId] */
export const pedirYo = (token, tenantId) => intentar(() => pedirJson('/auth/me', { token, tenantId }));

/** El cuerpo de POST /auth/registro (las 7 claves exactas) para la persona `k`, con lo que haga falta cambiar. */
export function cuerpoDeRegistro(entrada, k, codigoTeclado, cambios = {}) {
  return {
    codigo: codigoTeclado, nombre: entrada.nombre(k), correo: entrada.correo(k), codigo_estudiantil: entrada.codigoEstudiantil(k),
    contrasena: entrada.clave(k), mayor_de_edad: true, aviso_version: AVISO_VERSION, ...cambios,
  };
}

/** POST /auth/registro con el cliente real (`api/registro.js`: las 7 claves, sin Authorization). No valida: la réplica manda a propósito un registro malo. */
export const registrar = (cuerpo) => intentar(() => registrarse(cuerpo));

/** El texto del escudo para esta respuesta de /auth/me: "Por confirmar" o "B1 · Provisional" / "B1 · Confirmado" (lo que la persona lee). */
export function textoDelEscudoDe(me) {
  const nivel = perfilAJson(me).nivelConfirmado;
  if (!nivel) return textos.escudo.porConfirmar;
  return `${nivel.cefr} · ${etiquetaDeEstado(nivel.provisional ? 'nivel_provisional' : 'nivel_confirmado').texto}`;
}

/**
 * Un enlace sin lo que cambia entre corridas: la base queda como `<EVA>` o `<SET>`, el pase como `<pase>` y la institución como `<tenant>`.
 * @param {string} url @param {{pase: string, tenant: string, eva: string, set: string}} dato
 */
export function normalizarEnlace(url, { pase, tenant, eva, set }) {
  const sinBase = (u, base, marca) => (u.startsWith(base.replace(/\/+$/, '')) ? marca + u.slice(base.replace(/\/+$/, '').length) : u);
  let salida = sinBase(sinBase(url, eva, '<EVA>'), set, '<SET>');
  salida = salida.split(encodeURIComponent(pase)).join('<pase>');
  return salida.split(tenant).join('<tenant>');
}

/**
 * El medidor de fugas. Se instala ANTES de que el cliente haga nada y se quita al terminar. Cuenta lo que sale a una dirección que no es /api ni
 * /auth/v1 y anota todo lo que se escribe en un almacenamiento o en la consola, para buscar ahí los secretos (pase, contraseñas, código de grupo).
 * @param {string} urlShell
 */
export function instalarMedidor(urlShell) {
  const g = /** @type {any} */ (globalThis);
  const previo = { fetch: g.fetch, local: g.localStorage, sesion: g.sessionStorage, consola: { ...console } };
  /** @type {string[]} */ const enAlmacen = []; /** @type {string[]} */ const enConsola = [];
  let fuera = 0;
  g.fetch = async (url, init) => {
    const destino = String(url);
    if (!destino.startsWith(`${urlShell}/api/`) && !destino.startsWith(`${urlShell}/auth/v1/`)) fuera += 1;
    return previo.fetch(url, init);
  };
  for (const nivel of ['log', 'info', 'warn', 'error', 'debug']) {
    console[nivel] = (...a) => { enConsola.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(' ')); previo.consola[nivel](...a); };
  }
  const almacen = { setItem: (k, v) => { enAlmacen.push(`${k}=${v}`); }, getItem: () => null, removeItem() {}, clear() {} };
  g.localStorage = almacen;
  g.sessionStorage = almacen;
  return {
    fuera: () => fuera,
    enAlmacenamiento: () => enAlmacen.join(SALTO),
    enConsola: () => enConsola.join(SALTO),
    restaurar() { g.fetch = previo.fetch; g.localStorage = previo.local; g.sessionStorage = previo.sesion; Object.assign(console, previo.consola); },
  };
}

/** Cuántos de `secretos` aparecen en `texto` (0 = ninguno se coló). @param {Iterable<string>} secretos @param {string} texto */
export const cuantosAparecen = (secretos, texto) => [...secretos].filter((s) => s && texto.includes(s)).length;
