// @ts-check
// vistas/estudiante/inicio_economia.js · Lo que Lingo Coins le agrega a Inicio (decisión 017): la tarjeta "¡Hay una puja en vivo!" cuando la haya y la entrada a la tienda.
// DIFERIDO: Inicio lo pide con import() y, si no carga o la tienda no existe en el backend (404, sin red), devuelve null y Inicio queda como antes.
// La tienda manda: se pide `GET /core/shop` y de ahí sale "hay tienda"; la puja viva es un adorno que puede faltar sin romper nada.
import { h } from '../../ui/dom.js';
import { crearIcono } from '../../ui/iconos.js';
import { leerTienda, leerPujaActiva } from '../../api/economia.js';
import { ErrorApi } from '../../api/cliente.js';
import { grupoParaPuja } from './puja.js';
import { textosEconomia as E } from '../../textos_economia.js';

/** @param {any} p ¿Es una puja viva y bien formada? */
export const pujaViva = (p) => Boolean(p && typeof p.id === 'string' && p.estado === 'activa' && typeof p.titulo === 'string');

/** @param {any} p */
export function tarjetaDePuja(p) {
  return h('section', { class: 'sx-prota sx-prota--marca fila-ahora eco-inicio-puja', 'data-testid': 'tarjeta-puja', 'aria-label': E.puja.vivo },
    h('div', { class: 'eco-inicio-texto' },
      h('p', { class: 'eco-inicio-titulo' }, h('span', { class: 'eco-punto', 'aria-hidden': 'true' }), E.puja.vivo),
      h('span', { class: 'sx-t-apoyo' }, E.puja.vivoTexto(p.titulo))),
    h('a', { href: '#/puja', class: 'sx-btn sx-btn--claro', 'data-testid': 'ir-a-puja' }, h('span', { 'aria-hidden': 'true' }, crearIcono('puja')), E.puja.entrar));
}

export function tarjetaDeTienda() {
  return h('section', { class: 'sx-tarjeta eco-inicio-puja', 'data-testid': 'tarjeta-tienda', 'aria-label': E.inicio.tiendaTitulo },
    h('div', { class: 'eco-inicio-texto' },
      h('p', { class: 'eco-inicio-titulo' }, E.inicio.tiendaTitulo),
      h('span', { class: 'sx-t-apoyo' }, E.inicio.tiendaTexto)),
    h('a', { href: '#/tienda', class: 'sx-btn', 'data-testid': 'ir-a-tienda' }, h('span', { 'aria-hidden': 'true' }, crearIcono('tienda')), E.inicio.irTienda));
}

/**
 * @param {{token: string, tenantId?: string, sesion?: {grupo?: string|null, grupoId?: string|null}}} ctx
 * @returns {Promise<{puja: HTMLElement|null, tienda: HTMLElement}|null>}
 */
export async function cargar(ctx) {
  const grupo = grupoParaPuja(ctx.sesion);
  const [tienda, puja] = await Promise.allSettled([leerTienda(ctx), grupo ? leerPujaActiva(grupo, ctx) : Promise.resolve(null)]);
  if (tienda.status !== 'fulfilled') {
    console.warn('inicio: sin tienda', tienda.reason instanceof ErrorApi ? tienda.reason.status : 'error'); // respaldo: Inicio como antes
    return null;
  }
  if (puja.status === 'rejected') console.warn('inicio: sin puja', puja.reason instanceof ErrorApi ? puja.reason.status : 'error');
  const viva = puja.status === 'fulfilled' && pujaViva(puja.value) ? puja.value : null;
  return { puja: viva ? tarjetaDePuja(viva) : null, tienda: tarjetaDeTienda() };
}
