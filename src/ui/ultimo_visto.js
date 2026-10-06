// @ts-check
// ui/ultimo_visto.js · "Lo último que vio este estudiante" (su saldo y su constancia), SOLO para
// saber si hay algo que celebrar al volver a Inicio (Lingo lo hace con `_lastCoinsValue`,
// student.html:1985-2040). Se compara el valor que mandó el servidor con el que se vio antes:
// nunca se calcula una racha ni un saldo aquí (decisión 010, X-racha). Si el almacenamiento
// no existe o falla, simplemente no hay celebración: el dato real sigue mostrándose.

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
