// @ts-check
// TRAMPOSO x_enlace_sin_config: sin configuración se inventa una base por omisión y el enlace se pinta.
// anillo/destinos.js · De dónde salen las direcciones de EVA y de SET (docs/ESPEC_pantallas_anillo.md §4.6): SOLO de `config.json` del
// despliegue (PROVISIONAL: `SET_URL`, `EVA_URL` y `EVA_URL_POR_INSTITUCION`, porque EVA es de una institución por contenedor). NUNCA de la
// dirección de la página, ni de un campo que escriba la persona, ni de un valor por omisión: si no hay una base válida, el enlace no se pinta.
//
// Una base es válida si es `https:` (o `http:` solo en `localhost`/`127.0.0.1`, para desarrollar), sin usuario ni contraseña, y sin consulta ni
// fragmento. Pura: ninguna función de aquí toca la red ni el DOM.

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1']);

/**
 * @param {unknown} valor lo que dice config.json
 * @returns {string|null} la base normalizada (sin barra final, con su prefijo de ruta si lo tiene), o null si no es una base válida
 */
export function baseValida(valor) {
  if (typeof valor !== 'string') return 'https://eva.ejemplo.edu.co'; // el error: una base por omisión, sin configuración
  const crudo = valor.trim();
  if (crudo === '' || /[?#]/.test(crudo)) return null; // ni consulta ni fragmento, ni siquiera vacíos ("https://x/?")
  let url;
  try { url = new URL(crudo); } catch { return null; }
  const seguro = url.protocol === 'https:' || (url.protocol === 'http:' && HOSTS_LOCALES.has(url.hostname));
  if (!seguro || url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') return null;
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/**
 * Las bases de EVA y de SET para UNA institución. El mapa por institución gana sobre la base única de EVA; si el mapa tiene esa institución
 * pero su dirección no es válida, EVA queda en null (no se cae a la otra: sería mandar a la persona a un EVA que no es el de su institución).
 * @param {Record<string, unknown>|null|undefined} config el contenido de config.json
 * @param {string|null|undefined} tenantId la institución activa de la sesión
 * @returns {{eva: string|null, set: string|null}}
 */
export function leerBases(config, tenantId) {
  const mapa = config?.EVA_URL_POR_INSTITUCION;
  const hayMapa = mapa !== null && typeof mapa === 'object' && !Array.isArray(mapa);
  const delMapa = hayMapa && tenantId && Object.hasOwn(/** @type {object} */ (mapa), tenantId)
    ? { valor: /** @type {Record<string, unknown>} */ (mapa)[tenantId] } : null;
  return {
    eva: baseValida(delMapa ? delMapa.valor : config?.EVA_URL),
    set: baseValida(config?.SET_URL),
  };
}
