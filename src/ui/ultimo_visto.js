// @ts-check
// ui/ultimo_visto.js · "Lo último que vio este estudiante" (su saldo y su constancia), SOLO para
// saber si hay algo que celebrar al volver a Inicio (Lingo lo hace con `_lastCoinsValue`,
// student.html:1985-2040). Se compara el valor que mandó el servidor con el que se vio antes:
// nunca se calcula una racha ni un saldo aquí (decisión 010, X-racha). Si el almacenamiento
// no existe o falla, simplemente no hay celebración: el dato real sigue mostrándose.

import { valorDeNivel } from '../auth/interfaz.js';

const PREFIJO = 'engrama_ultimo_';

/**
 * Qué pasó entre lo último visto y lo que llega ahora. Pura.
 * - `primera`: no había nada guardado (primera visita en este equipo): se muestra, no se celebra.
 * - `sube`: llegó más que antes → hay premio que celebrar.
 * - `igual` / `baja`: nada que celebrar (la racha puede reiniciarse; eso no se festeja).
 * @param {number|null} previo @param {number} actual
 * @returns {'primera'|'sube'|'igual'|'baja'}
 */
export function compararConUltimo(previo, actual) {
  if (previo === null || !Number.isFinite(previo)) return 'primera';
  if (actual > previo) return 'sube';
  return actual === previo ? 'igual' : 'baja';
}

const clave = (que, quien) => `${PREFIJO}${que}_${quien}`;

/** @param {string} que 'saldo'|'constancia' @param {string} quien id de perfil @returns {number|null} */
export function leerUltimo(que, quien) {
  try {
    const crudo = localStorage.getItem(clave(que, quien));
    return crudo === null ? null : Number(crudo);
  } catch { return null; }
}

/** @param {string} que @param {string} quien @param {number} valor */
export function guardarUltimo(que, quien, valor) {
  try { localStorage.setItem(clave(que, quien), String(valor)); } catch (e) { console.error('ui/ultimo_visto: no pude guardar', e); }
}

/**
 * W30 (adenda §17.2, dictamen 03 G2): qué hacer con el nivel que llegó. El nivel NO se celebra como logro de juego. Pura.
 * - `animar` (la animación sobria `escudo-sube`): solo con un nivel DEFINITIVO que es el primero que se ve o que no es menor que
 *   el último mostrado, y que además es distinto de lo último visto (una sola vez); nunca con un provisional, nunca si baja,
 *   nunca con "reducir movimiento".
 * - `avisoBaja`: el definitivo es MENOR que un provisional ya mostrado → un aviso informativo único (el texto lo pone la vista).
 *   Si baja respecto de otro definitivo no hay aviso: el texto habla de un provisional.
 * @param {{valor: number, provisional: boolean}|null} previo lo último que vio esta persona en esta institución
 * @param {{cefr: string, provisional: boolean}} actual lo que dice el servidor ahora
 * @param {boolean} reducido el sistema pide menos movimiento
 */
export function decidirNivel(previo, actual, reducido) {
  const valor = valorDeNivel(actual.cefr);
  const definitivo = !actual.provisional;
  const cambio = previo === null || previo.valor !== valor || previo.provisional !== actual.provisional;
  const noBaja = previo === null || valor >= previo.valor;
  return {
    animar: definitivo && cambio && noBaja && !reducido,
    avisoBaja: definitivo && previo !== null && previo.provisional && valor < previo.valor,
  };
}

/** El nivel que esta persona vio por última vez en esta institución (`quien` = persona + institución), o null. @param {string} quien */
export function leerNivelVisto(quien) {
  const valor = leerUltimo('nivel', quien);
  if (valor === null || !Number.isFinite(valor) || valor < 1) return null;
  return { valor, provisional: leerUltimo('nivelprov', quien) === 1 };
}

/** @param {string} quien @param {{valor: number, provisional: boolean}} nivel */
export function guardarNivelVisto(quien, nivel) {
  guardarUltimo('nivel', quien, nivel.valor);
  guardarUltimo('nivelprov', quien, nivel.provisional ? 1 : 0);
}
