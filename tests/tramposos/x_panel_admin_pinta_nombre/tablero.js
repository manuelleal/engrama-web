// @ts-check
// vistas/admin/tablero.js · `#/admin/tablero`, "Tu institución" (docs/ESPEC_panel_super_admin.md §4): las cifras de la institución ACTIVA del admin
// (GET /admin/metricas). DIFERIDO y SOBRIO. La respuesta no trae nombre ni id del cliente, y la vista tampoco los pinta aunque llegaran
// (api/panel.js copia solo las cifras). Si la sesión es de un super admin, un enlace a "Todos los clientes" (la puerta es el backend).
import { h, montar } from '../../ui/dom.js';
import { crearEncabezado } from '../../ui/encabezado.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { crearIcono } from '../../ui/iconos.js';
import { metricasAdmin } from '../../api/panel.js';
import { ErrorApi } from '../../api/cliente.js';
import { kpis, protaRegistros, tarjetaMonedas, tarjetaActivos, pintarFallo } from '../panel/bloques.js';
import { textosPanel as T } from '../../textos_panel.js';

const RUTA = '/admin/tablero';

/** El enlace al panel de todo ENGRAMA, solo para el super admin. @param {any} sesion */
export function enlaceSuper(sesion) {
  if (sesion?.superAdmin !== true) return null;
  return h('a', { class: 'sx-btn sx-btn--sec', href: '#/super', 'data-testid': 'ir-a-super' }, h('span', { 'aria-hidden': 'true' }, crearIcono('grupos')), T.tablero.todosLosClientes);
}

/** @param {HTMLElement} cuerpo @param {HTMLElement} apoyo @param {any} ctx */
async function pintar(cuerpo, apoyo, ctx) {
  try {
    const d = await metricasAdmin({ token: ctx.token });
    apoyo.textContent = `${/** @type {any} */ (d).etiqueta ?? ''} · ${T.tablero.apoyo(d.metricas.profes, d.metricas.grupos)}`; // TRAMPOSO: el nombre del cliente al admin
    montar(cuerpo, h('div', { class: 'panel-cuerpo' },
      kpis(d.metricas),
      protaRegistros(d.metricas, d, T.tablero.serie),
      h('div', { class: 'rejilla-2' }, tarjetaMonedas(d.metricas, d), tarjetaActivos(d.metricas))));
  } catch (e) {
    console.warn('vistas/admin/tablero: no se pudo cargar', e instanceof ErrorApi ? e.status : e);
    pintarFallo(cuerpo, e, () => { void pintar(cuerpo, apoyo, ctx); });
  }
}

/** @param {HTMLElement} raiz @param {any} ctx */
export async function renderTablero(raiz, ctx) {
  const enc = crearEncabezado(RUTA);
  const apoyo = h('p', { class: 'sx-t-apoyo', 'data-testid': 'tablero-apoyo' });
  const cuerpo = h('div', { 'data-testid': 'tablero-cuerpo' }, h('p', { role: 'status' }, T.cargando));
  montar(raiz, h('div', { class: 'panel-pagina', 'data-testid': 'vista-admin-tablero' },
    h('div', { class: 'panel-cab' }, h('div', null, enc.titulo, apoyo), enlaceSuper(ctx.sesion)),
    cuerpo, crearNavInferior(RUTA, ctx.sesion?.rol)));
  await pintar(cuerpo, apoyo, ctx);
  document.body.dataset.listo = '1';
}
