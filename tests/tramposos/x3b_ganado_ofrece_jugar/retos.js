// TRAMPOSO X3b — versión rota a propósito: siempre ofrece "Jugar", incluso para un reto ya
// ganado. Debe quedar en rojo en U6.
// @ts-check
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { listarRetos, historialDeIntentos } from '../../api/retos.js';
import { ErrorApi } from '../../api/cliente.js';

async function cargar(ctx) {
  const [retos, historial] = await Promise.all([listarRetos(ctx), historialDeIntentos(ctx)]);
  const ganados = new Set(historial.filter((h) => h.is_correct).map((h) => h.challenge_id));
  return { retos, ganados };
}

export function enlaceParaReto(retoId, ganado) {
  return { href: `#/retos/${retoId}`, texto: textos.retos.jugar, testid: `reto-${retoId}-jugar` }; // <- el error
}

function filaDeReto(reto, ganado) {
  const datos = enlaceParaReto(reto.id, ganado);
  const enlace = h('a', { href: datos.href, 'data-testid': datos.testid }, datos.texto);
  return h('li', { 'data-testid': `reto-${reto.id}` }, h('span', {}, reto.title), enlace);
}

function pintarLista(raiz, retos, ganados) {
  const cuerpo = retos.length === 0
    ? h('p', { role: 'status' }, textos.retos.sinRetos)
    : h('ul', {}, ...retos.map((r) => filaDeReto(r, ganados.has(r.id))));
  montar(raiz, h('div', { 'data-testid': 'vista-retos' }, h('h1', {}, textos.retos.titulo), cuerpo));
  document.body.dataset.listo = '1';
}

function pintarError(raiz, mensaje) {
  montar(raiz, h('div', { 'data-testid': 'vista-retos' }, h('h1', {}, textos.retos.titulo), h('p', { role: 'alert' }, mensaje)));
  document.body.dataset.listo = '1';
}

export async function renderRetos(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-retos' }, h('p', { role: 'status' }, textos.inicio.cargando)));
  try {
    const { retos, ganados } = await cargar(ctx);
    pintarLista(raiz, retos, ganados);
  } catch (e) {
    console.warn('vistas/estudiante/retos: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.retos.errorGeneral);
  }
}
