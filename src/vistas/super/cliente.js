// @ts-check
// vistas/super/cliente.js · `#/super/cliente/:tid`, el detalle de un cliente para el super admin (docs/ESPEC_panel_super_admin.md §4): su código
// como título, su etiqueta PRIVADA (con candado), su estado con ícono y palabra, y las mismas cifras y gráficas del tablero. DIFERIDO y SOBRIO.
// 403 → "solo del super admin"; 404 → "ese cliente no existe". El id sale de la dirección y solo viaja al backend, que es quien decide.
import { h, montar } from '../../ui/dom.js';
import { crearEncabezado } from '../../ui/encabezado.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { detalleCliente } from '../../api/panel.js';
import { ErrorApi } from '../../api/cliente.js';
import { kpis, protaRegistros, tarjetaMonedas, tarjetaActivos, pintarFallo } from '../panel/bloques.js';
import { etiquetaPrivada, estadoCliente } from './clientes.js';
import { textosPanel as T } from '../../textos_panel.js';

const RUTA = '/super/cliente/:tid';

/** A dónde lleva el aviso de un fallo: a la lista si el cliente no existe; a su tablero si no es super admin. @param {unknown} e */
const salidaDe = (e) => (e instanceof ErrorApi && e.status === 404 ? { camino: '/super', texto: T.verClientes } : { camino: '/admin/tablero', texto: T.irATablero });

/** @param {HTMLElement} cuerpo @param {HTMLElement} apoyo @param {(c: string|null) => void} ponerCodigo @param {string} tid @param {any} ctx */
async function pintar(cuerpo, apoyo, ponerCodigo, tid, ctx) {
  try {
    const c = await detalleCliente(tid, { token: ctx.token });
    ponerCodigo(c.codigo);
    montar(apoyo, h('span', { class: 'cliente-cab' }, estadoCliente(c.suspendido), etiquetaPrivada(c.etiqueta),
      c.creado ? h('span', { class: 'sx-t-apoyo' }, T.super.desde(c.creado)) : null));
    montar(cuerpo, h('div', { class: 'panel-cuerpo' },
      kpis(c.metricas),
      protaRegistros(c.metricas, c, T.super.detalleSerie(c.codigo)),
      h('div', { class: 'rejilla-2' }, tarjetaMonedas(c.metricas, c), tarjetaActivos(c.metricas))));
  } catch (e) {
    console.warn('vistas/super/cliente: no se pudo cargar', e instanceof ErrorApi ? e.status : e);
    pintarFallo(cuerpo, e, () => { void pintar(cuerpo, apoyo, ponerCodigo, tid, ctx); }, salidaDe(e));
  }
}

/** @param {HTMLElement} raiz @param {Record<string, string>} params @param {any} ctx */
export async function renderCliente(raiz, params, ctx) {
  const enc = crearEncabezado(RUTA, params);
  const apoyo = h('div', { 'data-testid': 'cliente-apoyo' });
  const cuerpo = h('div', { 'data-testid': 'cliente-cuerpo' }, h('p', { role: 'status' }, T.cargando));
  montar(raiz, h('div', { class: 'panel-pagina', 'data-testid': 'vista-super-cliente' },
    enc.volver, h('div', { class: 'panel-cab' }, h('div', null, enc.titulo, apoyo)), cuerpo, crearNavInferior(RUTA, ctx.sesion?.rol)));
  await pintar(cuerpo, apoyo, enc.ponerCodigo, params.tid, ctx);
  document.body.dataset.listo = '1';
}
