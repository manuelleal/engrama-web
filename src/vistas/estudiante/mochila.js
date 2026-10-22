// @ts-check
// vistas/estudiante/mochila.js · `#/mochila`, "Tu mochila": lo que el estudiante compró y en qué va. DIFERIDO. Tres estados, siempre con ícono Y palabra:
//   por entregar (reloj, "Tu profe te lo entrega antes del …"), entregado (visto) y devuelto (moneda: si el profe no lo entregó a tiempo, las monedas vuelven).
// Nada se calcula: todo lo dice `GET /core/inventory`. Sin red: "Sin conexión." y "Reintentar".
import { h, montar } from '../../ui/dom.js';
import { crearCargando, crearVacio } from '../../ui/estados.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearCabecera } from '../../ui/cabecera.js';
import { crearIcono } from '../../ui/iconos.js';
import { crearMonedas, fechaCorta } from '../../ui/economia.js';
import { leerMochila } from '../../api/economia.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { textosEconomia as E } from '../../textos_economia.js';

const RUTA = '/mochila';
const T = E.mochila;

const marco = (ctx, ...contenido) => h('div', { class: 'juego', 'data-testid': 'vista-mochila' },
  crearCabecera({ patron: RUTA, sonido: true }), h('div', { class: 'eco-contenido' }, ...contenido), crearNavInferior(RUTA, ctx.sesion?.rol));

/** Cómo se dice cada estado: el texto, el ícono y el color de la píldora. Un estado que no conozco se dice "Por entregar" (nunca queda mudo). @param {string} estado */
export function estadoDeMochila(estado) {
  if (estado === 'entregado') return { clave: 'entregado', texto: T.entregado, icono: 'visto', clase: 'sx-pildora--ok' };
  if (estado === 'devuelto') return { clave: 'devuelto', texto: T.devuelto, icono: 'moneda', clase: '' };
  return { clave: 'por-entregar', texto: T.porEntregar, icono: 'reloj', clase: 'sx-pildora--marca' };
}

/** @param {any} f */
function fila(f) {
  const e = estadoDeMochila(f.estado);
  const detalle = e.clave === 'entregado' ? T.entregadoEl(fechaCorta(f.resuelto_en))
    : e.clave === 'devuelto' ? T.devueltoEl(fechaCorta(f.resuelto_en), Number.isInteger(f.precio_pagado) ? f.precio_pagado : null)
      : T.entrega(fechaCorta(f.entregar_antes_de));
  return h('li', { class: 'sx-tarjeta eco-mochila-fila', 'data-testid': 'mochila-fila', 'data-estado': e.clave },
    h('div', { class: 'eco-mochila-cabeza' },
      h('h2', { class: 'eco-mochila-nombre' }, f.nombre),
      h('span', { class: `sx-pildora ${e.clase}`.trim(), 'data-testid': 'mochila-estado' }, h('span', { 'aria-hidden': 'true' }, crearIcono(e.icono)), e.texto)),
    h('p', { class: 'eco-apoyo' }, detalle),
    h('p', { class: 'eco-apoyo' }, T.comprado(fechaCorta(f.comprado_en)), Number.isInteger(f.precio_pagado) ? ' · ' : null, Number.isInteger(f.precio_pagado) ? crearMonedas(f.precio_pagado, T.pagaste(f.precio_pagado)) : null));
}

function pintarFallo(raiz, ctx, e) {
  const sinRed = e instanceof ErrorApi && e.status === 0;
  const reintentar = h('button', { type: 'button', class: 'sx-btn sx-btn--ancho', 'data-testid': 'mochila-reintentar' }, E.comun.reintentar);
  reintentar.addEventListener('click', accionUnica(() => renderMochila(raiz, ctx)));
  montar(raiz, marco(ctx,
    sinRed ? h('p', { role: 'status', class: 'eco-apoyo', 'data-testid': 'mochila-sin-red' }, E.comun.sinRed) : h('p', { role: 'alert', 'data-testid': 'mochila-error' }, E.comun.error),
    reintentar));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {{token: string, tenantId?: string, sesion?: {rol?: string}}} ctx */
export async function renderMochila(raiz, ctx) {
  montar(raiz, marco(ctx, crearCargando(T.cargando)));
  try {
    const lista = await leerMochila(ctx);
    if (!Array.isArray(lista)) throw new ErrorApi(500, E.comun.error, null);
    const filas = lista.filter((f) => f && typeof f.id === 'string' && typeof f.nombre === 'string');
    const cuerpo = filas.length === 0
      ? [crearVacio({ titulo: T.vacioTitulo, texto: T.vacio, testid: 'mochila-vacia' }), h('a', { href: '#/tienda', class: 'sx-btn sx-btn--ancho', 'data-testid': 'ir-a-tienda' }, T.irTienda)]
      : [h('ul', { class: 'eco-mochila', 'data-testid': 'mochila' }, ...filas.map(fila))];
    montar(raiz, marco(ctx, ...cuerpo));
    document.body.dataset.listo = '1';
  } catch (e) {
    console.warn('vistas/estudiante/mochila: no se pudo cargar', e instanceof ErrorApi ? e.status : e);
    pintarFallo(raiz, ctx, e);
  }
}
