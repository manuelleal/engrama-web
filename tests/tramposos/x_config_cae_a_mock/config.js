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
 * ¿Ofrece la entrada "¿Olvidaste tu contraseña?"? (despliegue/docs/ESPEC_correo_recuperacion.md §5). Solo si el despliegue lo dice con
 * `RECUPERAR_CLAVE: true` (el booleano; ni "true", ni 1): sin SMTP configurado en GoTrue no llega ningún correo, así que el piloto sin
 * correo no lo ofrece. Pura.
 * @param {unknown} config
 */
export function recuperarClave(config) {
  return Boolean(config) && typeof config === 'object' && /** @type {any} */ (config).RECUPERAR_CLAVE === true;
}

/** Las metas de "Tu semana" cuando el despliegue no dice otra cosa (C2 de la espec del juego, PROVISIONAL). */
const META_DE_SEMANA = 2;

/**
 * Las metas de la semana completa (docs/ESPEC_juego_oleada1.md §4.6 y adenda §17.1.4, W51): cuántas clases (días distintos con asistencia) y cuántos
 * retos distintos ganados. Las pone el despliegue con `SEMANA_META_CLASES` y `SEMANA_META_RETOS`: enteros de 0 a 7. Una clave ausente o mal formada
 * (un texto, un decimal, un número fuera de rango) vale 2; un 0 en cualquiera APAGA la semana completa (lo decide quien lee las metas). Pura.
 * @param {unknown} config
 * @returns {{clases: number, retos: number}}
 */
export function metasDeSemana(config) {
  const c = config && typeof config === 'object' ? /** @type {Record<string, unknown>} */ (config) : {};
  const meta = (/** @type {unknown} */ v) => (Number.isInteger(v) && /** @type {number} */ (v) >= 0 && /** @type {number} */ (v) <= 7 ? /** @type {number} */ (v) : META_DE_SEMANA);
  return { clases: meta(c.SEMANA_META_CLASES), retos: meta(c.SEMANA_META_RETOS) };
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
