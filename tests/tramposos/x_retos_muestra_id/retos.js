// @ts-check
// vistas/estudiante/retos.js · W9: la lista de retos. Uno ya ganado (según GET
// /challenges/attempts/history, is_correct=true) nunca ofrece "Jugar" para cobrar otra vez —
// solo "Repasar" (X3b prueba justo esto).
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { agruparPorUnidad } from '../../ui/titulo.js';
import { crearIcono } from '../../ui/iconos.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearCargando, crearVacio } from '../../ui/estados.js';
import { crearCabecera } from '../../ui/cabecera.js';
import { listarRetos, historialDeIntentos } from '../../api/retos.js';
import { ErrorApi } from '../../api/cliente.js';

async function cargar(ctx) {
  const [retos, historial] = await Promise.all([listarRetos(ctx), historialDeIntentos(ctx)]);
  const ganados = new Set(historial.filter((h) => h.is_correct).map((h) => h.challenge_id));
  return { retos, ganados };
}

/**
 * Qué enlace ofrecer para un reto: pura, sin DOM (U6; X3b la rompe devolviendo siempre "Jugar",
 * incluso ya ganado — el estudiante volvería a cobrar el mismo reto).
 * @param {string} retoId @param {boolean} ganado
 */
export function enlaceParaReto(retoId, ganado) {
  return ganado
    ? { href: `#/retos/${retoId}?repaso=1`, texto: textos.retos.repasar, testid: `reto-${retoId}-repasar` }
    : { href: `#/retos/${retoId}`, texto: textos.retos.jugar, testid: `reto-${retoId}-jugar` };
}

/**
 * W52 (docs/ESPEC_juego_oleada1.md §4.5, efecto 26): "Hasta N monedas", el premio a la vista antes de jugar. N es `coins_reward` DEL SERVIDOR: solo
 * si llega como entero mayor que 0 y el reto todavía no está ganado (un repaso no suma monedas). Sin el dato no se dice nada: nunca un número
 * puesto por la app. Pura.
 * @param {{coins_reward?: unknown}|null|undefined} reto @param {boolean} ganado
 * @returns {string|null}
 */
export function premioDelReto(reto, ganado) {
  const n = reto?.coins_reward;
  return !ganado && Number.isInteger(n) && /** @type {number} */ (n) > 0 ? textos.premioDelReto.hasta(/** @type {number} */ (n)) : null;
}

/** @param {{id: string}} reto @param {boolean} ganado @param {string} rotulo lo que dice la fila: el bloque ("Lectura 2") bajo el encabezado de su unidad, o el título de siempre */
function filaDeReto(reto, ganado, rotulo) {
  const datos = enlaceParaReto(reto.id, ganado);
  const premio = premioDelReto(reto, ganado);
  const enlace = h('a', { href: datos.href, class: 'boton-chico', 'data-testid': datos.testid }, datos.texto);
  return h(
    'li', { class: 'fila', 'data-testid': `reto-${reto.id}` },
    h('div', { class: 'fila-texto' },
      h('span', { class: 'fila-titulo' }, rotulo),
      premio ? h('span', { class: 'texto-apoyo', 'data-testid': `reto-${reto.id}-premio` }, premio) : null, // discreto: sin oro ni animación
      ganado ? h('span', { class: 'insignia', 'data-testid': `reto-${reto.id}-estado` }, h('span', { 'aria-hidden': 'true' }, crearIcono('visto')), textos.retos.completado) : null),
    enlace,
  );
}

/**
 * La lista (docs/ESPEC_titulos_unidad.md): sin ningún título con unidad (los retos que crea el profe a mano) es la lista de siempre, un `ul` sin encabezados. Si
 * alguno trae unidad, una sección por unidad (h2 con su nombre, nunca el id ni "[BORRADOR]") y debajo sus filas ("Lectura 2"); los que no la traen, juntos en
 * "Otros retos". El `data-testid` y el `id` de cada sección salen de su posición: el id interno de la unidad no llega al DOM.
 */
function cuerpoDeLaLista(retos, ganados) {
  const grupos = agruparPorUnidad(retos);
  const filas = (g) => g.filas.map((f) => filaDeReto(f.reto, ganados.has(f.reto.id), f.rotulo));
  if (!grupos.some((g) => g.unidad)) return h('ul', {}, ...grupos.flatMap(filas));
  return h('div', { class: 'retos-por-unidad', 'data-testid': 'retos-por-unidad' }, ...grupos.map((g, i) => h(
    'section', { class: 'unidad-retos', 'data-testid': `unidad-retos-${i}`, 'aria-labelledby': `unidad-retos-titulo-${i}` },
    h('h2', { id: `unidad-retos-titulo-${i}` }, g.clave ? `${g.clave} · ${g.unidad}` : textos.retos.otros),
    h('ul', {}, ...filas(g)))));
}

function pintarLista(raiz, ctx, retos, ganados) {
  const cuerpo = retos.length === 0
    ? crearVacio({ titulo: textos.estados.retosVacioTitulo, texto: textos.estados.retosVacio, testid: 'retos-vacio' })
    : cuerpoDeLaLista(retos, ganados);
  montar(raiz, h('div', { 'data-testid': 'vista-retos', class: 'juego' },
    crearCabecera({ patron: '/retos', sonido: true }), cuerpo, crearNavInferior('/retos', ctx.sesion?.rol)));
  document.body.dataset.listo = '1';
}

function pintarError(raiz, ctx, mensaje) {
  montar(raiz, h('div', { 'data-testid': 'vista-retos' }, h('h1', {}, textos.retos.titulo), h('p', { role: 'alert' }, mensaje), crearNavInferior('/retos', ctx.sesion?.rol)));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {{token: string, tenantId?: string, sesion?: {rol?: string}}} ctx */
export async function renderRetos(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-retos', class: 'juego' }, crearCargando(textos.inicio.cargando), crearNavInferior('/retos', ctx.sesion?.rol)));
  try {
    const { retos, ganados } = await cargar(ctx);
    pintarLista(raiz, ctx, retos, ganados);
  } catch (e) {
    console.warn('vistas/estudiante/retos: no se pudo cargar', e);
    pintarError(raiz, ctx, e instanceof ErrorApi ? e.mensaje : textos.retos.errorGeneral);
  }
}
