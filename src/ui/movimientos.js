// @ts-check
// ui/movimientos.js · Las filas de "Mis monedas" (docs/ESPEC_juego_oleada1.md §4.3 y adenda §17.1.4, W47), PURO: recibe lo que mandó el servidor
// (`GET /core/coins/history` y, para los títulos, `GET /challenges/`) y devuelve lo que se pinta. Reglas:
//   - el ORDEN es el del servidor (del más nuevo al más viejo): aquí no se reordena;
//   - el signo sale de la billetera (`to_wallet_id` = la propia → entra) y va escrito, no depende del color;
//   - del `metadata` (un diccionario sin contrato) solo se leen `base`, `puntualidad` y `challenge_id`; NUNCA se pinta crudo;
//   - una acción que la app no conoce es "Movimiento": no revienta ni muestra el nombre técnico;
//   - el desglose de una asistencia se dice solo si el asiento cuadra (`desgloseDeAsiento`): nunca se resta para sacar una parte.
import { textos } from '../textos.js';
import { desgloseDeAsiento, textoDelDesglose } from './desglose.js';
import { tituloLegible } from './titulo.js';
import { duracionEfectiva, reducirMovimiento } from './movimiento.js';

/** @typedef {{tipo: 'asistencia'|'reto'|'vivo'|'otro', icono: string, etiqueta: string, detalle: string|null, fecha: string, monto: string, montoAccesible: string, entra: boolean}} FilaDeMovimiento */

const ICONOS = { asistencia: '📍', reto: '🎯', vivo: '📡', otro: '🪙' };
const TIPO_DE_ACCION = { attendance: 'asistencia', challenge: 'reto', live: 'vivo' };

/** "20 oct" (día y mes del equipo); una fecha ilegible es ''. Pura. @param {unknown} iso */
export function fechaCorta(iso) {
  const t = typeof iso === 'string' ? new Date(iso) : null;
  if (!t || Number.isNaN(t.getTime())) return '';
  return textos.monedas.fecha(t.getDate(), t.getMonth());
}

/** El título del reto de ese asiento, si la lista de retos lo trae; si no, null (queda "Reto"). */
function tituloDelReto(asiento, titulos) {
  const id = asiento.metadata?.challenge_id;
  const titulo = typeof id === 'string' ? titulos.get(id) : null;
  return typeof titulo === 'string' && titulo.trim() !== '' ? tituloLegible(titulo) : null;
}

/** La etiqueta y el detalle de un asiento, según su acción. */
function nombrar(asiento, tipo, titulos) {
  if (tipo === 'asistencia') {
    const desglose = desgloseDeAsiento(asiento);
    return { etiqueta: textos.monedas.filaAsistencia, detalle: desglose ? textoDelDesglose(desglose) : null };
  }
  if (tipo === 'reto') {
    const titulo = tituloDelReto(asiento, titulos);
    return { etiqueta: titulo ? textos.monedas.filaReto(titulo) : textos.monedas.filaRetoSinTitulo, detalle: null };
  }
  return { etiqueta: tipo === 'vivo' ? textos.monedas.filaVivo : textos.monedas.filaOtro, detalle: null };
}

/**
 * Las filas de los movimientos, en el orden del servidor. Un asiento ilegible (sin monto entero) se salta; nunca lanza.
 * @param {unknown} historial la respuesta de /core/coins/history: `{wallet, entries}`
 * @param {unknown} [retos] la lista de /challenges/ (solo para los títulos); si falta o viene rota, las filas dicen "Reto"
 * @returns {FilaDeMovimiento[]}
 */
export function filasDeMovimientos(historial, retos = []) {
  const h = /** @type {any} */ (historial);
  const entradas = Array.isArray(h?.entries) ? h.entries : [];
  const billetera = typeof h?.wallet?.id === 'string' ? h.wallet.id : null;
  const titulos = new Map((Array.isArray(retos) ? retos : []).filter((r) => r && typeof r.id === 'string').map((r) => [r.id, r.title]));
  /** @type {FilaDeMovimiento[]} */
  const filas = [];
  for (const asiento of entradas) {
    if (!asiento || typeof asiento !== 'object' || !Number.isInteger(asiento.amount)) continue;
    const tipo = TIPO_DE_ACCION[asiento.action] || 'otro';
    // Entra si llega a la billetera propia; si el servidor no dijo cuál es, solo "sale" lo que sale de una billetera hacia otra parte sin destino.
    const entra = billetera ? asiento.to_wallet_id === billetera : asiento.to_wallet_id != null;
    const cantidad = Math.abs(asiento.amount);
    filas.push({
      tipo, icono: ICONOS[tipo], ...nombrar(asiento, tipo, titulos), fecha: fechaCorta(asiento.created_at),
      monto: textos.monedas.monto(cantidad, entra), montoAccesible: textos.monedas.montoAccesible(cantidad, entra), entra,
    });
  }
  return filas;
}

/**
 * Cómo entran las filas (A6): escalonadas, solo las 12 primeras. Con "reducir movimiento" no entra ninguna animada. Pura.
 * @param {number} filas cuántas hay @param {boolean} [reducido]
 */
export function planDeMovimientos(filas, reducido = reducirMovimiento()) {
  const animadas = reducido ? 0 : Math.min(12, Math.max(0, filas));
  return { animadas, duracionMs: duracionEfectiva(320, reducido), escalonMs: reducido ? 0 : 40, fichas: 0, confeti: 0 };
}
