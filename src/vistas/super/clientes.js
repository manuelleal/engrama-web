// @ts-check
// vistas/super/clientes.js · `#/super`, "Todo ENGRAMA" (docs/ESPEC_panel_super_admin.md §4): las cifras de todos los clientes, los registros por
// día, las monedas por semana, un selector para entrar a ver un cliente y la lista "Cliente NN" con su etiqueta PRIVADA (con candado: solo el
// super admin la ve). DIFERIDO y SOBRIO. La puerta es el backend: si no es super admin responde 403 y aquí se dice "solo del super admin", sin
// una sola cifra (nada se guarda de antes).
import { h, montar } from '../../ui/dom.js';
import { crearEncabezado } from '../../ui/encabezado.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearIcono } from '../../ui/iconos.js';
import { listarClientes } from '../../api/panel.js';
import { ErrorApi } from '../../api/cliente.js';
import { kpis, protaRegistros, tarjetaMonedas, tarjetaActivos, pintarFallo } from '../panel/bloques.js';
import { textosPanel as T } from '../../textos_panel.js';

const RUTA = '/super';
const SALIDA = { camino: '/admin/tablero', texto: T.irATablero };

/** La etiqueta privada, marcada: candado + "Etiqueta privada:" para quien no ve. @param {string} texto */
export function etiquetaPrivada(texto) {
  if (!texto) return null;
  return h('span', { class: 'etiqueta-privada', title: T.super.privada, 'data-testid': 'etiqueta-privada' },
    h('span', { 'aria-hidden': 'true' }, crearIcono('candado')), h('span', { class: 'oculto' }, `${T.super.privada}: `), texto);
}

/** El estado del cliente con ícono y palabra. @param {boolean} suspendido */
export function estadoCliente(suspendido) {
  return suspendido
    ? h('span', { class: 'sx-pildora sx-pildora--mal' }, h('span', { 'aria-hidden': 'true' }, crearIcono('pausa')), T.super.suspendido)
    : h('span', { class: 'sx-pildora sx-pildora--ok' }, h('span', { 'aria-hidden': 'true' }, crearIcono('visto')), T.super.activo);
}

/** @param {any} c */
function filaCliente(c) {
  return h('li', { 'data-testid': `cliente-${c.codigo.replace(/\s+/g, '-')}` },
    h('a', { class: 'sx-fila', href: `#/super/cliente/${encodeURIComponent(c.id)}` },
      h('span', { class: 'sx-fila__texto' },
        h('span', { class: 'sx-fila__titulo' }, c.codigo),
        etiquetaPrivada(c.etiqueta),
        h('span', { class: 'sx-fila__apoyo' }, T.super.fila(c.metricas.activos_7d, c.metricas.estudiantes, c.metricas.registros_30d))),
      h('span', { class: 'sx-fila__fin' }, c.suspendido ? estadoCliente(true) : null)));
}

/** El selector "Ver un cliente": elegir lleva a su detalle (un enlace por dirección, sin petición propia). @param {any[]} clientes */
export function selectorDeCliente(clientes) {
  const sel = h('select', { id: 'super-selector', class: 'sx-entrada', 'data-testid': 'selector-cliente' },
    h('option', { value: '' }, T.super.selectorVacio),
    ...clientes.map((c) => h('option', { value: c.id }, c.etiqueta ? `${c.codigo} · ${c.etiqueta}` : c.codigo)));
  sel.addEventListener('change', () => { if (/** @type {HTMLSelectElement} */ (sel).value) location.hash = `#/super/cliente/${encodeURIComponent(/** @type {HTMLSelectElement} */ (sel).value)}`; });
  return h('div', { class: 'selector-cliente' }, h('label', { for: 'super-selector', class: 'sx-rotulo' }, T.super.selector), sel);
}

/** @param {HTMLElement} cuerpo @param {HTMLElement} apoyo @param {any} ctx */
async function pintar(cuerpo, apoyo, ctx) {
  try {
    const d = await listarClientes({ token: ctx.token });
    apoyo.textContent = T.super.apoyo(d.clientes.length, d.clientes.filter((c) => c.suspendido).length);
    montar(cuerpo, h('div', { class: 'panel-cuerpo' },
      selectorDeCliente(d.clientes),
      kpis(d.totales),
      protaRegistros(d.totales, d, T.super.serie),
      h('div', { class: 'rejilla-2' }, tarjetaMonedas(d.totales, d), tarjetaActivos(d.totales)),
      h('section', { class: 'seccion', 'data-testid': 'super-clientes' },
        h('div', null, h('h2', { class: 'sx-t-tarjeta' }, T.super.clientes), h('p', { class: 'sx-t-apoyo' }, T.super.clientesApoyo)),
        d.clientes.length ? h('ul', { class: 'sx-lista' }, ...d.clientes.map(filaCliente)) : h('p', { role: 'status' }, T.super.vacio))));
  } catch (e) {
    console.warn('vistas/super/clientes: no se pudo cargar', e instanceof ErrorApi ? e.status : e);
    pintarFallo(cuerpo, e, () => { void pintar(cuerpo, apoyo, ctx); }, SALIDA);
  }
}

/** @param {HTMLElement} raiz @param {any} ctx */
export async function renderSuper(raiz, ctx) {
  const enc = crearEncabezado(RUTA);
  const apoyo = h('p', { class: 'sx-t-apoyo', 'data-testid': 'super-apoyo' });
  const cuerpo = h('div', { 'data-testid': 'super-cuerpo' }, h('p', { role: 'status' }, T.cargando));
  montar(raiz, h('div', { class: 'panel-pagina', 'data-testid': 'vista-super' },
    enc.volver, h('div', { class: 'panel-cab' }, h('div', null, enc.titulo, apoyo)), cuerpo, crearNavInferior(RUTA, ctx.sesion?.rol)));
  await pintar(cuerpo, apoyo, ctx);
  document.body.dataset.listo = '1';
}
