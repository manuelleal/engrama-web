// @ts-check
// config.js · Qué hacer con el `config.json` que sirve el despliegue (H-6 de la auditoría de seguridad 02).
// Antes, si el archivo fallaba o faltaba, la app caía en silencio al modo `mock` (actores de prueba, sin
// contraseña): en un despliegue real eso era una puerta abierta. Ahora NO HAY valor por defecto: sin una
// configuración válida la app no arranca y lo dice. El `mock` solo corre cuando el servidor de
// desarrollo (herramientas/servidor_dev.mjs) sirve un config.json que lo pide EXPLÍCITAMENTE.

export const MODOS_AUTH_VALIDOS = ['mock', 'perfil_actual', 'supabase'];

/**
 * El modo de autenticación que pidió la configuración, o `null` si no pidió ninguno válido. Pura:
 * nunca devuelve "mock" por omisión.
 * @param {unknown} config
 * @returns {'mock'|'perfil_actual'|'supabase'|null}
 */
export function modoDeAuth(config) {
  const modo = config && typeof config === 'object' ? /** @type {any} */ (config).ENGRAMA_AUTH : undefined;
  return MODOS_AUTH_VALIDOS.includes(modo) ? modo : 'mock';
}

/**
 * ¿Está abierto el registro con código de grupo? (docs/ESPEC_pantallas_anillo.md §4.1 y la adenda 17.7). El backend no ofrece una ruta que diga si el
 * autorregistro está encendido (el 503 llega DESPUÉS de validar los 7 campos), así que lo dice el despliegue con `REGISTRO_CON_CODIGO`. Solo el
 * booleano `true` lo abre: ni la cadena "true", ni 1, ni la ausencia de la clave. Pura.
 * @param {unknown} config
 */
export function registroConCodigo(config) {
  return Boolean(config) && typeof config === 'object' && /** @type {any} */ (config).REGISTRO_CON_CODIGO === true;
}

/**
 * Pide /config.json SIEMPRE a la red (sin caché del navegador ni del service worker). Lanza si no hay
 * red, si responde mal o si no es un JSON con un modo válido: quien llama muestra el error, no inventa.
 * @returns {Promise<Record<string, unknown>>}
 */
export async function cargarConfig() {
  let resp;
  try {
    resp = await fetch('/config.json', { cache: 'no-store' });
  } catch (e) {
    throw Object.assign(new Error('config: sin red al pedir /config.json'), { causa: 'sin_red', original: e });
  }
  if (!resp.ok) throw Object.assign(new Error(`config: /config.json respondió ${resp.status}`), { causa: 'http' });
  let config;
  try { config = await resp.json(); } catch (e) { throw Object.assign(new Error('config: /config.json no es JSON'), { causa: 'invalida', original: e }); }
  if (!modoDeAuth(config)) throw Object.assign(new Error('config: /config.json no define un ENGRAMA_AUTH válido'), { causa: 'invalida' });
  return config;
}
