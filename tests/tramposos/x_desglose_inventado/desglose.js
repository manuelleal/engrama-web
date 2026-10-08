// @ts-check
// ui/desglose.js · Lo que el SERVIDOR dice de una asistencia, sin que el cliente invente nada (docs/ESPEC_pantallas_anillo.md adenda 17.8; U37 y U38 de
// ESPEC_juego_oleada1.md). La respuesta del check-in (`CheckInResult`) NO trae el desglose ni dice si la paga de hoy ya estaba cobrada; lo único que el
// servidor da es el asiento del libro (`GET /core/coins/history`, cuyo `metadata` es un diccionario sin tipar) y el historial de asistencia
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
  const base = asiento.metadata?.base; const puntualidad = asiento.metadata?.puntualidad ?? asiento.amount - base;
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

/** "5 por asistir + 5 por llegar a tiempo"; con puntualidad 0, solo "5 por asistir" (nada sobre haber llegado tarde). Pura. @param {{base: number, puntualidad: number}} d */
export function textoDelDesglose(d) {
  return textos.asistencia.desglose(d.base, d.puntualidad);
}
