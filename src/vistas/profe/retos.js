// @ts-check
// vistas/profe/retos.js · W12: `/challenges/all` con el aviso "todo el colegio" (BUG-10: la
// forma de hoy no trae `group_id` filtrable, y el endpoint no filtra por grupo — se lo decimos al
// profe en vez de fingir que la lista ya está filtrada), activar/desactivar (PATCH /status, SOLO
// `{status}`) y asignar a un grupo propio (T6; un grupo ajeno lo rechaza el servidor, X4).
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { listarTodosLosRetos, cambiarEstadoReto } from '../../api/retos.js';
import { listarGrupos, asignarReto } from '../../api/profe.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';

/** Pura (U, sin DOM): el estado siguiente al activar/desactivar — nunca 'archived' desde aquí. */
export function siguienteEstado(estadoActual) {
  return estadoActual === 'active' ? 'inactive' : 'active';
}

function selectorDeGrupo(grupos) {
  return h(
    'select', { 'data-testid': 'select-grupo' },
    h('option', { value: '' }, textos.profe.retos.elegirGrupo),
    ...grupos.map((g) => h('option', { value: g.id }, g.group_code)),
  );
}

async function manejarCambiarEstado(reto, boton, ctx, cambiarUnaVez) {
  boton.disabled = true;
  const textoPrevio = boton.textContent;
  boton.textContent = textos.profe.retos.cambiando;
  try {
    const actualizado = await cambiarUnaVez(reto.id, siguienteEstado(reto.status), ctx);
    reto.status = actualizado.status;
    boton.textContent = reto.status === 'active' ? textos.profe.retos.desactivar : textos.profe.retos.activar;
    boton.disabled = false;
  } catch (e) {
    console.warn('vistas/profe/retos: no se pudo cambiar el estado', e);
    boton.textContent = textoPrevio;
    boton.disabled = false;
  }
}

async function manejarAsignar(reto, select, boton, ctx, asignarUnaVez) {
  const gid = select.value;
  if (!gid) return;
  boton.disabled = true; select.disabled = true;
  boton.textContent = textos.profe.retos.asignando;
  try {
    await asignarUnaVez(gid, reto.id, ctx);
    boton.textContent = textos.profe.retos.asignado;
  } catch (e) {
    console.warn('vistas/profe/retos: no se pudo asignar', e);
    boton.textContent = e instanceof ErrorApi ? e.mensaje : textos.profe.retos.errorAsignar;
    boton.disabled = false; select.disabled = false;
  }
}

function filaDeReto(reto, grupos, ctx) {
  const botonEstado = h(
    'button', { 'data-testid': `reto-${reto.id}-estado` },
    reto.status === 'active' ? textos.profe.retos.desactivar : textos.profe.retos.activar,
  );
  const cambiarUnaVez = accionUnica(cambiarEstadoReto);
  botonEstado.addEventListener('click', () => manejarCambiarEstado(reto, botonEstado, ctx, cambiarUnaVez));

  const select = selectorDeGrupo(grupos);
  const botonAsignar = h('button', { 'data-testid': `reto-${reto.id}-asignar` }, textos.profe.retos.asignar);
  const asignarUnaVez = accionUnica(asignarReto);
  botonAsignar.addEventListener('click', () => manejarAsignar(reto, select, botonAsignar, ctx, asignarUnaVez));

  return h(
    'li', { 'data-testid': `reto-${reto.id}` },
    h('span', {}, reto.title),
    ` · ${reto.status} · ${textos.profe.retos.grupoAsignado(reto.group_id)} · `,
    botonEstado,
    h('label', {}, textos.profe.retos.etiquetaGrupoDestino, select),
    botonAsignar,
  );
}

function pintarLista(raiz, retos, grupos, ctx) {
  const cuerpo = retos.length === 0
    ? h('p', { role: 'status' }, textos.profe.retos.sinRetos)
    : h('ul', {}, ...retos.map((r) => filaDeReto(r, grupos, ctx)));
  const nodo = h(
    'div', { 'data-testid': 'vista-profe-retos' },
    h('h1', {}, textos.profe.retos.titulo),
    h('p', { role: 'status', 'data-testid': 'aviso-todo-el-colegio' }, textos.profe.retos.avisoTodoElColegio),
    cuerpo,
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}

function pintarError(raiz, mensaje) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-retos' }, h('h1', {}, textos.profe.retos.titulo), h('p', { role: 'alert' }, mensaje)));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {{token: string, tenantId?: string}} ctx */
export async function renderRetosProfe(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-retos' }, h('p', { role: 'status' }, textos.inicio.cargando)));
  try {
    const [retos, grupos] = await Promise.all([listarTodosLosRetos(ctx), listarGrupos(ctx)]);
    pintarLista(raiz, retos, grupos, ctx);
  } catch (e) {
    console.warn('vistas/profe/retos: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.profe.retos.errorGeneral);
  }
}
