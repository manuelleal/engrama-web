// @ts-check
// api/camino.js · `GET /challenges/camino` (docs/ESPEC_camino_y_tu_palabra.md §3, W92; backend `juego/camino-progreso`). Módulo DIFERIDO. Todo por
// cliente.js (regla 1). La web no calcula estados: los lee. "Ausente" no es "0": una respuesta mal formada no se usa.
import { pedirJson, ErrorApi } from './cliente.js';

const esObjeto = (/** @type {unknown} */ v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const ESTADOS = new Set(['sin_empezar', 'en_curso', 'completada', 'dominada']);
const ACCESOS = new Set(['abierta', 'bloqueada', 'abierta_con_apoyo']);
const entero = (/** @type {unknown} */ v) => Number.isInteger(v);
const textoONulo = (/** @type {unknown} */ v) => v === null || v === undefined || typeof v === 'string';

/** ¿Una unidad trae lo que la pantalla usa, con su tipo? Pura. @param {any} u */
function unidadValida(u) {
  return esObjeto(u) && typeof u.topic === 'string' && entero(u.numero) && textoONulo(u.titulo) && ESTADOS.has(u.estado) && ACCESOS.has(u.acceso)
    && typeof u.recomendada === 'boolean' && typeof u.atascada === 'boolean' && entero(u.estaciones_total) && entero(u.estaciones_jugadas)
    && (u.porcentaje === null || u.porcentaje === undefined || entero(u.porcentaje)) && textoONulo(u.se_abre_el) && textoONulo(u.siguiente_reto)
    && Array.isArray(u.estaciones);
}

/** ¿La respuesta (CaminoOut) se puede pintar? Pura; nunca lanza. @param {any} c */
export function caminoValido(c) {
  return esObjeto(c) && typeof c.nivel === 'string' && typeof c.con_nivel_de_set === 'boolean' && typeof c.prestado === 'boolean'
    && entero(c.umbral_completada) && entero(c.dias_atasco) && textoONulo(c.recomendada) && Array.isArray(c.unidades) && c.unidades.every(unidadValida);
}

/**
 * Lo que dio la lectura: el camino, `sin_ruta` (un backend anterior: 404, 405, 422, o una respuesta mal formada) o `error` (sin red, 5xx, otro).
 * Nunca lanza. Solo hace GET: el camino no escribe ni paga.
 * @param {{token: string, tenantId?: string}} ctx @returns {Promise<{tipo: 'camino', camino: any}|{tipo: 'sin_ruta'|'error'}>}
 */
export async function leerCamino({ token, tenantId }) {
  try {
    const datos = await pedirJson('/challenges/camino', { token, tenantId });
    if (caminoValido(datos)) return { tipo: 'camino', camino: datos };
    console.warn('api/camino: el camino llegó mal formado', esObjeto(datos) ? Object.keys(datos) : typeof datos);
    return { tipo: 'sin_ruta' };
  } catch (e) {
    if (e instanceof ErrorApi && [404, 405, 422].includes(e.status)) return { tipo: 'sin_ruta' };
    console.warn('api/camino: no se pudo leer el camino', e instanceof ErrorApi ? e.status : e);
    return { tipo: 'error' };
  }
}
