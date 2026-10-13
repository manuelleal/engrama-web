// @ts-check
// mock/economia.mjs · Las reglas PURAS de la economía que usa el doble (W42, docs/ESPEC_juego_oleada1.md §4.1 y §17.1.4). Es espejo de
// `engrama-backend/src/engrama_core/service/economia.py` (leído en `03c9c0a`): este archivo no lee el estado ni el reloj; recibe los números y
// devuelve números. Los valores por defecto viven en `estado.economia` (mock/estado.mjs) para que una prueba o la réplica los cambie.
//
// Regla de la casa: la racha NO multiplica nada. Para que algún día multiplique habría que cambiar una firma de aquí, y ese cambio se vería.

/** La economía decidida (ESPEC_economia_oleada0 §1.1 a §1.2), como configuración. */
export const ECONOMIA_POR_DEFECTO = Object.freeze({
  asistenciaBase: 5, // por asistir
  asistenciaPuntualidad: 5, // si llegó a tiempo
  minutosDePuntualidad: 5, // a cuántos minutos de abrir todavía es puntual (inclusivo)
  desfaseHoras: -5, // el día es el de la institución (Bogotá), no el UTC
});

/**
 * El día de la institución (AAAA-MM-DD) para un instante. Pura.
 * @param {number} ms instante en milisegundos @param {number} desfaseHoras
 */
export function diaLocal(ms, desfaseHoras) {
  return new Date(ms + desfaseHoras * 3_600_000).toISOString().slice(0, 10);
}

/**
 * ¿Llegó a `minutos` minutos o menos de que el profe abrió? El límite es INCLUSIVO (5:00 es puntual, 5:01 no); antes de abrir cuenta como puntual. Pura.
 * @param {number} llegadaMs @param {number} aperturaMs @param {number} minutos
 */
export function esPuntual(llegadaMs, aperturaMs, minutos) {
  return llegadaMs - aperturaMs <= minutos * 60_000;
}

/**
 * Lo que la regla paga por un check-in: base + bono si fue puntual. A propósito NO recibe la racha. Pura.
 * @param {number} llegadaMs @param {number} aperturaMs
 * @param {{asistenciaBase: number, asistenciaPuntualidad: number, minutosDePuntualidad: number}} economia
 */
export function desgloseAsistencia(llegadaMs, aperturaMs, economia) {
  const puntual = esPuntual(llegadaMs, aperturaMs, economia.minutosDePuntualidad);
  const base = economia.asistenciaBase;
  const puntualidad = puntual ? economia.asistenciaPuntualidad : 0;
  return { base, puntualidad, puntual, total: base + puntualidad };
}

/**
 * Lo que el check-in le DICE al cliente (los cuatro campos, siempre): si la paga del día ya estaba cobrada, esta marca pagó 0 y el desglose es 0, 0 y
 * falso; si no, el desglose tal cual. La bandera NO se deduce de `total === 0` (una configuración en 0 también da 0). Pura.
 * @param {{base: number, puntualidad: number, puntual: boolean}} pago @param {boolean} yaCobrada
 */
export function cobroDeAsistencia(pago, yaCobrada) {
  if (yaCobrada) return { base: 0, puntualidad: 0, puntual: false, ya_cobrada_hoy: true };
  return { base: pago.base, puntualidad: pago.puntualidad, puntual: pago.puntual, ya_cobrada_hoy: false };
}

/** La llave de idempotencia de la paga de asistencia: un pago por estudiante, grupo y día (el de la institución). Pura. */
export function llaveAsistencia(groupId, studentId, dia) {
  return `attendance:${groupId}:${studentId}:${dia}`;
}

/**
 * La racha tras marcar hoy, por días de calendario seguidos (regla del backend, `attendance.py`): el mismo día no la cambia (`null`), el día siguiente
 * suma 1 y cualquier hueco vuelve a 1. Pura.
 * @param {string|null} ultimaFecha AAAA-MM-DD de la última asistencia @param {string} hoy @param {number} rachaActual
 * @returns {number|null} la racha nueva, o null si es otra marca del mismo día (queda como estaba)
 */
export function siguienteRacha(ultimaFecha, hoy, rachaActual) {
  if (!ultimaFecha) return 1;
  const dias = Math.round((Date.parse(hoy) - Date.parse(ultimaFecha)) / 86_400_000);
  if (dias === 0) return null;
  return dias === 1 ? rachaActual + 1 : 1;
}
