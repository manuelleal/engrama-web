// @ts-check
// ui/economia.js · Lo que comparten las pantallas de Lingo Coins (tienda, mochila, puja, Dar, recarga): una moneda con su número, un cuadro modal,
// la fecha corta, el mensaje de un rechazo del backend y un campo numérico con "menos" y "más". DIFERIDO. Sin estilos propios: usa las clases del sistema (`sx-`)
// y `estilos/economia.css`. Nada se anima aquí; lo que se mueve (monedas que salen, cuenta regresiva) lo decide cada pantalla y se registra en ui/celebraciones.js.
import { h } from './dom.js';
import { crearIcono } from './iconos.js';
import { registrarCelebracion } from './celebraciones.js';
import { ErrorApi } from '../api/cliente.js';
import { textosEconomia as T } from '../textos_economia.js';

/** El oro es SOLO de las monedas: una píldora de oro con la moneda dibujada y el número. @param {number} n @param {string} [etiquetaAccesible] */
export function crearMonedas(n, etiquetaAccesible) {
  return h('span', { class: 'sx-pildora sx-pildora--oro eco-monedas', 'aria-label': etiquetaAccesible ?? T.monedas(n) },
    h('span', { class: 'sx-moneda', 'aria-hidden': 'true' }), h('span', { 'aria-hidden': 'true' }, String(n)));
}

/** "12 oct" (día y mes, en español). Vacío si la fecha no es válida. @param {string|null|undefined} iso */
export function fechaCorta(iso) {
  const ms = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
}

/**
 * El texto de un rechazo: sin red, "Sin conexión."; si el backend mandó su mensaje en español (`{"detail": "..."}`, en 402, 409 y 422), ese mismo; con un 404
 * ("lo ajeno o inexistente") o sin mensaje, el genérico de la pantalla. La web no traduce ni inventa el motivo.
 * @param {unknown} e @param {{generico: string}} tabla
 */
export function mensajeDeRechazo(e, tabla) {
  if (!(e instanceof ErrorApi)) return tabla.generico;
  if (e.status === 0) return T.comun.sinRed;
  const d = e.cuerpo?.detail;
  return typeof d === 'string' && d.trim() && e.status !== 404 ? d.trim() : tabla.generico;
}

/** @param {string} texto */
export const aviso = (texto) => h('p', { class: 'eco-aviso', role: 'alert', 'data-testid': 'eco-aviso' }, texto);

/**
 * Un cuadro modal (`sx-velo` + `sx-modal`) sobre la pantalla. Se cierra con "Ahora no", Escape o tocando fuera, y SIEMPRE al cambiar de ruta.
 * @param {{titulo: string, cuerpo: Array<Node|null>, acciones: Array<Node|null>, testid?: string}} o
 * @returns {{nodo: HTMLElement, cerrar: () => void}}
 */
export function abrirModal({ titulo, cuerpo, acciones, testid = 'eco-modal' }) {
  const previo = typeof document !== 'undefined' ? document.activeElement : null;
  const modal = h('div', { class: 'sx-modal eco-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'eco-modal-titulo', 'data-testid': testid },
    h('h2', { id: 'eco-modal-titulo', class: 'sx-t-sub' }, titulo), ...cuerpo, h('div', { class: 'sx-modal__acciones' }, ...acciones));
  const velo = h('div', { class: 'sx-velo eco-velo' }, modal);
  const tecla = (/** @type {KeyboardEvent} */ ev) => { if (ev.key === 'Escape') cerrar(); };
  let abierto = true;
  const terminar = registrarCelebracion(() => cerrar());
  function cerrar() {
    if (!abierto) return;
    abierto = false;
    document.removeEventListener?.('keydown', tecla);
    velo.remove();
    terminar();
    if (previo && typeof /** @type {any} */ (previo).focus === 'function') /** @type {any} */ (previo).focus();
  }
  velo.addEventListener('click', (ev) => { if (ev.target === velo) cerrar(); });
  document.addEventListener?.('keydown', tecla);
  document.body.appendChild(velo);
  const primero = modal.querySelector?.('input, select, textarea, button');
  if (primero && typeof /** @type {any} */ (primero).focus === 'function') /** @type {any} */ (primero).focus();
  return { nodo: velo, cerrar };
}

/**
 * Un campo numérico con "menos" y "más" de 44 px (en el celular se toca, no se teclea). `valor()` es siempre un entero dentro de [min, max].
 * @param {{id: string, rotulo: string, ayuda?: string, min: number, max: number, inicial: number, alCambiar?: (n: number) => void, testid?: string}} o
 */
export function crearCampoNumero({ id, rotulo, ayuda, min, max, inicial, alCambiar, testid = 'eco-monto' }) {
  let n = Math.min(max, Math.max(min, inicial));
  const entrada = h('input', { id, type: 'number', inputmode: 'numeric', min, max, value: n, class: 'sx-entrada eco-numero', 'data-testid': testid });
  const poner = (/** @type {number} */ v) => {
    n = Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : min)));
    /** @type {any} */ (entrada).value = String(n);
    alCambiar?.(n);
  };
  const boton = (/** @type {string} */ texto, /** @type {string} */ icono, /** @type {number} */ paso, /** @type {string} */ sufijo) => {
    const b = h('button', { type: 'button', class: 'sx-btn-icono eco-paso', 'aria-label': texto, 'data-testid': `${testid}-${sufijo}` }, crearIcono(icono));
    b.addEventListener('click', () => poner(n + paso));
    return b;
  };
  entrada.addEventListener('input', () => { const v = Number(/** @type {any} */ (entrada).value); n = Number.isFinite(v) ? v : n; alCambiar?.(n); });
  entrada.addEventListener('change', () => poner(Number(/** @type {any} */ (entrada).value)));
  const nodo = h('div', { class: 'sx-campo eco-campo-numero' },
    h('label', { class: 'sx-campo__rotulo', for: id }, rotulo),
    h('div', { class: 'eco-numero-fila' }, boton(T.dar.menos, 'guion', -1, 'menos'), entrada, boton(T.dar.mas, 'mas', 1, 'mas')),
    ayuda ? h('span', { class: 'sx-campo__ayuda' }, ayuda) : null);
  return { nodo, valor: () => Math.min(max, Math.max(min, Math.round(Number(/** @type {any} */ (entrada).value ?? n) || min))), poner };
}
