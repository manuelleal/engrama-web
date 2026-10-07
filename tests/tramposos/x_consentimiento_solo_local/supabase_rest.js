// TRAMPOSO (login piloto, G) — versión rota a propósito: el consentimiento se guarda SOLO en localStorage y nunca se llama al backend.
// El servidor no se entera: no hay constancia de la aceptación. Debe quedar en rojo en el test del registro y en el E2E del aviso.
// @ts-check
// auth/supabase_rest.js · ProveedorAuth del hito 3 (§7.4), encargo A (W22 acotado): GoTrue por
// REST con correo y contraseña, detrás de Caddy en el MISMO origen (`/auth/v1/*` — ver
// `despliegue/Caddyfile`, `uri strip_prefix /auth/v1` hacia `gotrue:9999`). Enlace mágico, Google
// y Microsoft (el resto de §7.4) quedan para un encargo aparte; este archivo solo implementa lo
// que pidió el encargo: entrar, renovar, salir y cambiar contraseña (por el backend, no por GoTrue).
//
// GUARDADO DE TOKENS (decisión de este encargo, documentada aquí porque acota §7.4 completo):
//   - El ACCESS token vive SOLO EN MEMORIA (nunca en ningún storage). Es el que abre puertas
//     (Authorization: Bearer en cada petición a /api); dejarlo en disco en un equipo compartido
//     sería la misma falla que ya tenía coins-mvp con la clave en el cliente.
//   - El REFRESH token va en `sessionStorage`, NUNCA `localStorage` (tramposo
//     x_password_en_localstorage prueba lo primero; verificar.mjs/V1 y este archivo nunca deben
//     tocar `localStorage`). sessionStorage sobrevive una recarga de LA MISMA pestaña (F5 no bota
//     al estudiante a mitad de un reto) pero desaparece al cerrarla — que es, en la práctica más
//     común, lo que pide §7.3 ("en dispositivos compartidos... cerrar sesión borra todo"): quien
//     cierra la pestaña o el navegador ya cerró la sesión, sin tener que acordarse de un botón.
//     Guardar el refresh token además en IndexedDB (la forma completa de §7.4, para sobrevivir el
//     cierre del navegador) queda fuera de este encargo — lo anterior es la elección explícita
//     que pidió el encargo A ("en memoria o en sessionStorage").
//   - La CONTRASEÑA en sí nunca se guarda en ningún storage: solo viaja en el cuerpo JSON de la
//     petición de login, una vez, por HTTPS (o HTTP en desarrollo local).
import { textos } from '../textos.js';
import { pedirJson, ErrorApi, BLOQUEO_PENDIENTE, BLOQUEO_SUSPENDIDA } from '../api/cliente.js';
import { perfilAJson } from './perfil_actual.js';
import { cambiarContrasenaConToken } from './cambio_contrasena.js';
import { registrarConsentimientoConToken } from './consentimiento.js';

const CLAVE_REFRESH = 'engrama_refresh_token';
// GOTRUE_JWT_EXP por defecto es 3600s (docker-compose.yml del despliegue); renovar 60s antes de
// que venza deja margen de sobra para la latencia de la petición de renovación misma.
const SEGUNDOS_MARGEN_RENOVACION = 60;

let raizAuth = ''; // '' = mismo origen (navegador real); los tests apuntan a un servidor de mentira.

/** Solo para pruebas: apunta el cliente de auth a otra raíz (un servidor node:http de mentira). */
export function configurarRaizAuth(url) {
  raizAuth = url;
}

export class ErrorAuth extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
    this.mensaje = mensaje;
  }
}

// Estado en memoria únicamente (nunca en un storage): el access token, cuándo vence, y el
// temporizador que renueva antes de que eso pase. Un módulo ES ya es un singleton por pestaña,
// así que esto es "sesión de la pestaña actual" sin necesitar una clase ni un store aparte.
let accessTokenEnMemoria = null;
let expiraEnMs = null;
let temporizadorRenovacion = null;

function leerRefreshToken() {
  try { return sessionStorage.getItem(CLAVE_REFRESH); } catch (e) { console.error('auth/supabase_rest: no pude leer sessionStorage', e); return null; }
}
function guardarRefreshToken(rt) {
  try { sessionStorage.setItem(CLAVE_REFRESH, rt); } catch (e) { console.error('auth/supabase_rest: no pude guardar en sessionStorage', e); }
}
function borrarRefreshToken() {
  try { sessionStorage.removeItem(CLAVE_REFRESH); } catch (e) { console.error('auth/supabase_rest: no pude borrar sessionStorage', e); }
}

/**
 * Ruta relativa a GoTrue, SIEMPRE dentro de `/auth/v1/` y en el MISMO origen (nunca un host
 * externo — tramposo x_token_origen_externo prueba justo lo contrario de esto). Pura y testeable
 * aparte de la red: es el único lugar que arma una URL, así que un cliente roto que quisiera
 * mandar el token a otro origen tendría que evitar esta función a propósito.
 * @param {string} ruta empieza con "/auth/v1/"
 */
export function construirUrlAuth(ruta) {
  if (!ruta.startsWith('/auth/v1/')) throw new Error(`auth/supabase_rest: ruta inválida "${ruta}" (debe empezar con /auth/v1/)`);
  return `${raizAuth}${ruta}`;
}

/** Traduce el status HTTP de GoTrue a un mensaje en español claro (encargo A: credenciales
 * inválidas, sin red, sesión vencida — nunca el texto crudo del servidor). */
function mensajeDeErrorAuth(status, contexto) {
  if (status === 429) return textos.auth.demasiadosIntentos;
  if (contexto === 'login') return textos.auth.credencialesInvalidas;
  if (contexto === 'refresh') return textos.auth.sesionVencida;
  return textos.auth.errorCambiarContrasena;
}

/**
 * @param {string} ruta empieza con "/auth/v1/"
 * @param {{metodo?: string, token?: string, cuerpo?: unknown, contexto: 'login'|'refresh'|'logout'}} opciones
 */
async function peticionAuth(ruta, opciones) {
  const { metodo = 'POST', token, cuerpo, contexto } = opciones;
  const cabeceras = { 'Content-Type': 'application/json' };
  if (token) cabeceras['Authorization'] = `Bearer ${token}`;
  let resp;
  try {
    resp = await fetch(construirUrlAuth(ruta), {
      method: metodo, headers: cabeceras, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch (e) {
    console.error('auth/supabase_rest: la red falló', ruta, e); // nunca un catch mudo (REGLAS.md §4)
    throw new ErrorAuth(0, textos.auth.sinConexion);
  }
  const texto = await resp.text();
  const json = texto ? JSON.parse(texto) : null;
  if (!resp.ok) throw new ErrorAuth(resp.status, mensajeDeErrorAuth(resp.status, contexto));
  return json;
}

/** Cuántos ms esperar antes de renovar, dado `expires_in` (segundos) de GoTrue — pura y
 * testeable sin depender de temporizadores reales. */
export function calcularRetrasoRenovacionMs(expiresInSegundos) {
  return Math.max(0, (expiresInSegundos - SEGUNDOS_MARGEN_RENOVACION) * 1000);
}

function cancelarRenovacion() {
  if (temporizadorRenovacion) { clearTimeout(temporizadorRenovacion); temporizadorRenovacion = null; }
}

function programarRenovacion(expiresInSegundos) {
  cancelarRenovacion();
  temporizadorRenovacion = setTimeout(() => {
    renovar().catch((e) => console.error('auth/supabase_rest: la renovación programada falló', e));
  }, calcularRetrasoRenovacionMs(expiresInSegundos));
  // En Node (tests) un temporizador vivo no debe bloquear la salida del proceso; en el navegador
  // `unref` no existe y esto es un no-op.
  if (typeof temporizadorRenovacion?.unref === 'function') temporizadorRenovacion.unref();
}

/** Guarda la respuesta de /auth/v1/token (login o refresh) y programa la próxima renovación. */
function aplicarToken({ access_token, refresh_token, expires_in }) {
  accessTokenEnMemoria = access_token;
  expiraEnMs = Date.now() + (expires_in ?? 3600) * 1000;
  guardarRefreshToken(refresh_token);
  programarRenovacion(expires_in ?? 3600);
}

async function renovar() {
  const rt = leerRefreshToken();
  if (!rt) throw new ErrorAuth(401, textos.auth.sesionVencida);
  const datos = await peticionAuth('/auth/v1/token?grant_type=refresh_token', { cuerpo: { refresh_token: rt }, contexto: 'refresh' });
  aplicarToken(datos);
  return datos;
}

/** Adapta el `/auth/me` del backend (mismo ProfileOut que perfil_actual.js, W4) a Sesion —
 * reutiliza `perfilAJson`, que ya sabe resolver el nombre por la membresía activa (BUG-11) y
 * trae la bandera `must_change_password`. */
async function sesionDesdeMe() {
  const profileOut = await pedirJson('/auth/me', { token: await token() });
  return perfilAJson(profileOut);
}

/** Vuelve a pedir /auth/me con el token (y el colegio activo de api/cliente.js) — después de cambiar
 * la contraseña o de elegir otra institución. */
export async function recargarSesion() {
  if (!accessTokenEnMemoria) throw new Error(textos.auth.sinSesion);
  return sesionDesdeMe();
}

/**
 * Al arrancar la app: si queda un refresh token de la pestaña (sessionStorage), intenta recuperar
 * la sesión sin pedir correo y contraseña de nuevo. Si el refresh falla (token robado, revocado,
 * o el servidor no responde), NUNCA revienta — limpia y deja que la pantalla de entrada pida
 * login de nuevo (`iniciar()` siempre puede devolver null, por contrato de interfaz.js).
 * @returns {Promise<import('./interfaz.js').Sesion|null>}
 */
export async function iniciar() {
  if (!leerRefreshToken()) return null;
  try {
    await renovar();
    return await sesionDesdeMe();
  } catch (e) {
    // W29: una cuenta PENDIENTE (su profe aún no la aprueba) o SUSPENDIDA existe y su sesión es buena: api/cliente.js ya abrió su pantalla
    // obligatoria, y "Revisar de nuevo" necesita el pase. Borrarlo aquí (como se hace con cualquier otro fallo) la dejaría sin salida tras recargar.
    if (e instanceof ErrorApi && (e.codigo === BLOQUEO_PENDIENTE || e.codigo === BLOQUEO_SUSPENDIDA)) return null;
    console.error('auth/supabase_rest: no se pudo recuperar la sesión con el refresh token guardado', e);
    accessTokenEnMemoria = null;
    expiraEnMs = null;
    borrarRefreshToken();
    return null;
  }
}

/** @param {'password'} metodo @param {{correo: string, contrasena: string}} datos */
export async function entrar(metodo, datos) {
  if (metodo !== 'password') throw new Error(`auth/supabase_rest: método desconocido "${metodo}"`);
  const tokenResp = await peticionAuth('/auth/v1/token?grant_type=password', {
    cuerpo: { email: datos.correo, password: datos.contrasena }, contexto: 'login',
  });
  aplicarToken(tokenResp);
  return sesionDesdeMe();
}

/** El token que usa `api/cliente.js` en cada petición. Si el temporizador programado se atrasó
 * (el equipo durmió, la pestaña quedó en segundo plano), renueva aquí antes de entregarlo: nunca
 * entrega a sabiendas un token ya vencido o a punto de vencer. */
export async function token() {
  if (!accessTokenEnMemoria) throw new Error(textos.auth.sinSesion);
  const vencePronto = expiraEnMs !== null && Date.now() >= expiraEnMs - SEGUNDOS_MARGEN_RENOVACION * 1000;
  if (vencePronto) {
    try { await renovar(); } catch (e) { console.error('auth/supabase_rest: la renovación de respaldo en token() falló', e); }
  }
  return accessTokenEnMemoria;
}

/** Registra en el backend que aceptó el aviso de datos (auth/consentimiento.js). @param {string} version */
export async function registrarConsentimiento(version) {
  if (!accessTokenEnMemoria) throw new Error(textos.auth.sinSesion);
  localStorage.setItem('engrama_consentimiento', version); // <- el error: solo en el navegador, el backend no se entera
}

/** Cambia la contraseña por el BACKEND (`POST /api/auth/contrasena`, que llama a GoTrue por dentro y
 * baja la bandera de contraseña temporal): ya NO se usa `PUT /auth/v1/user` directo, porque así la
 * bandera se quedaría en true. Ver auth/cambio_contrasena.js. */
export async function cambiarContrasena(nuevaContrasena) {
  if (!accessTokenEnMemoria) throw new Error(textos.auth.sinSesion);
  await cambiarContrasenaConToken(await token(), nuevaContrasena);
}

/** Borra la sesión local PRIMERO (lo que importa en un equipo compartido) y solo después avisa al
 * servidor; si el logout remoto falla, la sesión local ya quedó cerrada de todos modos. */
export async function salir() {
  cancelarRenovacion();
  const t = accessTokenEnMemoria;
  accessTokenEnMemoria = null;
  expiraEnMs = null;
  borrarRefreshToken();
  if (!t) return;
  try {
    await peticionAuth('/auth/v1/logout', { token: t, contexto: 'logout' });
  } catch (e) {
    console.error('auth/supabase_rest: logout en el servidor falló (la sesión local ya se borró)', e); // nunca mudo
  }
}
