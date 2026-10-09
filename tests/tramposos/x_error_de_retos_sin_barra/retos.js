// @ts-check
// vistas/estudiante/retos.js · W9: la lista de retos. Uno ya ganado (según GET
// /challenges/attempts/history, is_correct=true) nunca ofrece "Jugar" para cobrar otra vez —
// solo "Repasar" (X3b prueba justo esto).
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { tituloLegible } from '../../ui/titulo.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearCargando, crearVacio } from '../../ui/estados.js';
import { crearBotonSonido } from '../../ui/boton_sonido.js';
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

function filaDeReto(reto, ganado) {
  const datos = enlaceParaReto(reto.id, ganado);
  const enlace = h('a', { href: datos.href, class: 'boton-chico', 'data-testid': datos.testid }, datos.texto);
  return h(
    'li', { class: 'fila', 'data-testid': `reto-${reto.id}` },
    h('div', { class: 'fila-texto' },
      h('span', { class: 'fila-titulo' }, tituloLegible(reto.title)),
      ganado ? h('span', { class: 'insignia', 'data-testid': `reto-${reto.id}-estado` }, textos.retos.completado) : null),
    enlace,
  );
}

function pintarLista(raiz, ctx, retos, ganados) {
  const cuerpo = retos.length === 0
    ? crearVacio({ titulo: textos.estados.retosVacioTitulo, texto: textos.estados.retosVacio, testid: 'retos-vacio' })
    : h('ul', {}, ...retos.map((r) => filaDeReto(r, ganados.has(r.id))));
  montar(raiz, h('div', { 'data-testid': 'vista-retos', class: 'juego' },
    h('div', { class: 'encabezado-reto' }, h('h1', {}, textos.retos.titulo), crearBotonSonido()), cuerpo, crearNavInferior('/retos', ctx.sesion?.rol)));
  document.body.dataset.listo = '1';
}

function pintarError(raiz, ctx, mensaje) {
  montar(raiz, h('div', { 'data-testid': 'vista-retos' }, h('h1', {}, textos.retos.titulo), h('p', { role: 'alert' }, mensaje))); // TRAMPOSO: el error de Retos sin barra (un callejon)
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
