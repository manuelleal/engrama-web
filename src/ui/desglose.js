// @ts-check
// ui/desglose.js · Lo que el SERVIDOR dice de una asistencia, sin que el cliente invente nada (docs/ESPEC_pantallas_anillo.md adenda 17.8; U37 y U38 de
// ESPEC_juego_oleada1.md). Desde W45b la respuesta del check-in se lee primero (`pagoDelCheckIn`: los cuatro campos, si vienen y cuadran). Si no alcanza
// (un backend anterior no los manda), queda el camino de respaldo: el asiento del libro (`GET /core/coins/history`, cuyo `metadata` es un diccionario sin tipar) y el historial de asistencia
// (`GET /core/attendance/history`). Por eso aquí todo se lee con desconfianza y, si no cuadra, se devuelve `null`/`false` y la pantalla dice solo lo que
// sabe. NUNCA se resta, se suma ni se adivina una parte.
import { textos } from '../textos.js';

const esEnteroNoNegativo = (/** @type {unknown} */ n) => Number.isInteger(n) && /** @type {number} */ (n) >= 0;

/**
 * El desglose de lo que pagó el check-in, SOLO si el asiento más nuevo del libro lo trae y cuadra: `action = "attendance"`, `amount` igual a `coinsAwarded`,
 * `base` y `puntualidad` enteros no negativos que SUMAN ese `amount`. En cualquier otro caso `null` (asiento viejo con `multiplier`, `base` como texto, una
 * parte negativa, un monto distinto, sin asiento, una respuesta rota). Pura.
 * @param {unknown} historial la respuesta de /core/coins/history ({entries}) o directamente su lista
 * @param {unknown} coinsAwarded lo que dijo el check-in
 * @returns {{base: number, puntualidad: number} | null}
 */
export function desgloseDeAsistencia(historial, coinsAwarded) {
  const entradas = Array.isArray(historial) ? historial : /** @type {any} */ (historial)?.entries;
  if (!Array.isArray(entradas) || !Number.isInteger(coinsAwarded) || /** @type {number} */ (coinsAwarded) <= 0) return null;
  const asiento = entradas.find((e) => e?.action === 'attendance'); // el servidor ordena del más nuevo al más viejo: solo vale el primero
  if (!asiento || asiento.amount !== coinsAwarded) return null;
  const { base, puntualidad } = asiento.metadata ?? {};
  if (!esEnteroNoNegativo(base) || !esEnteroNoNegativo(puntualidad) || base + puntualidad !== asiento.amount) return null;
  return { base, puntualidad };
}

/**
 * ¿Hay PRUEBA de que la paga de hoy ya estaba cobrada? Solo si el registro más nuevo es de 0 monedas (la marca que acaba de pasar) y hay OTRO registro del
 * mismo `attendance_date` que sí pagó. Sin esa prueba (o con la lista rota) es `false`: un 0 también puede ser una configuración. Pura.
 * @param {unknown} registros la respuesta de /core/attendance/history, del más nuevo al más viejo
 */
export function haySegundaMarcaDelDia(registros) {
  if (!Array.isArray(registros) || registros.length < 2) return false;
  const [ultimo, ...resto] = registros;
  if (ultimo?.coins_awarded !== 0 || typeof ultimo.attendance_date !== 'string') return false;
  return resto.some((r) => r?.attendance_date === ultimo.attendance_date && Number.isInteger(r.coins_awarded) && r.coins_awarded > 0);
}

/**
 * W45b (docs/ESPEC_juego_oleada1.md §17.1.6): lo que la RESPUESTA DEL CHECK-IN ya dice de la paga, sin pedir nada más. El backend manda desde `1696a37`
 * cuatro campos (`base`, `puntualidad`, `puntual`, `ya_cobrada_hoy`); uno anterior no manda las claves. **"Ausente" no es "0"**: una clave que no vino no
 * se toma por `0` ni por `false` (eso lo decide el camino de respaldo, con sus dos peticiones). La suma se COMPRUEBA, nunca se usa para deducir una parte.
 * `puntual` no se pinta ni decide nada (a quien no fue puntual no se le dice nada). Pura; nunca lanza.
 * @param {unknown} respuesta la respuesta de POST /core/attendance/check-in
 * @returns {{desglose: {base: number, puntualidad: number}} | {yaCobrada: boolean} | null} `null` = la respuesta no alcanza: va el camino de respaldo
 */
export function pagoDelCheckIn(respuesta) {
  if (!respuesta || typeof respuesta !== 'object') return null;
  const r = /** @type {Record<string, unknown>} */ (respuesta);
  const vino = (/** @type {string} */ clave) => Object.hasOwn(r, clave);
  const monedas = r.coins_awarded;
  if (!esEnteroNoNegativo(monedas)) return null;
  if (/** @type {number} */ (monedas) > 0) {
    if (!vino('base') || !vino('puntualidad') || !esEnteroNoNegativo(r.base) || !esEnteroNoNegativo(r.puntualidad)) return null;
    if (/** @type {number} */ (r.base) + /** @type {number} */ (r.puntualidad) !== monedas) return null; // no cuadra: no se usa
    if (r.ya_cobrada_hoy === true) return null; // se contradice: pagó y dice que ya estaba cobrada
    return { desglose: { base: /** @type {number} */ (r.base), puntualidad: /** @type {number} */ (r.puntualidad) } };
  }
  if (!vino('ya_cobrada_hoy') || typeof r.ya_cobrada_hoy !== 'boolean') return null; // backend anterior: no se sabe; lo dirá el historial
  if ((vino('base') && r.base !== 0) || (vino('puntualidad') && r.puntualidad !== 0)) return null; // 0 monedas con partes que no son 0: no cuadra
  return { yaCobrada: r.ya_cobrada_hoy };
}

/** "5 por asistir + 5 por llegar a tiempo"; con puntualidad 0, solo "5 por asistir" (nada sobre haber llegado tarde). Pura. @param {{base: number, puntualidad: number}} d */
export function textoDelDesglose(d) {
  return textos.asistencia.desglose(d.base, d.puntualidad);
}
