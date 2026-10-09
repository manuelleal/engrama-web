// @ts-check
// vistas/profe/retos.js · W12: `/challenges/all` con el aviso "todo el colegio" (BUG-10: la
// forma de hoy no trae `group_id` filtrable, y el endpoint no filtra por grupo — se lo decimos al
// profe en vez de fingir que la lista ya está filtrada), activar/desactivar (PATCH /status, SOLO
// `{status}`) y asignar a un grupo propio (T6; un grupo ajeno lo rechaza el servidor, X4).
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { tituloLegible } from '../../ui/titulo.js';
import { listarTodosLosRetos, cambiarEstadoReto } from '../../api/retos.js';
import { listarGrupos, asignarReto } from '../../api/profe.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { ligarEscrituraARed } from '../../ui/red.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';

/** W70 (docs/ESPEC_navegacion.md §5.6): los retos del profe son una PESTAÑA de su barra (Retos activa). Como toda pestaña, no llevan "volver"
 * (el "‹ Mis grupos" de W63 salió: a "Mis grupos" se va por la barra, a un toque), también mientras cargan y si fallan. */
const barra = (ctx) => crearNavInferior('/profe/retos', /** @type {any} */ (ctx)?.sesion?.rol);

/** Pura (U, sin DOM): el estado siguiente al activar/desactivar — nunca 'archived' desde aquí. */
export function siguienteEstado(estadoActual) {
  return estadoActual === 'active' ? 'inactive' : 'active';
}

function selectorDeGrupo(grupos) {
  return h(
    'select', { class: 'campo-fila', 'data-testid': 'select-grupo' },
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

/** @param {{hecho: boolean}} estadoAsignar terminal tras un éxito: W16 no debe reactivarlo al volver la red */
async function manejarAsignar(reto, select, boton, ctx, asignarUnaVez, estadoAsignar) {
  const gid = select.value;
  if (!gid) return;
  boton.disabled = true; select.disabled = true;
  boton.textContent = textos.profe.retos.asignando;
  try {
    await asignarUnaVez(gid, reto.id, ctx);
    boton.textContent = textos.profe.retos.asignado;
    estadoAsignar.hecho = true;
  } catch (e) {
    console.warn('vistas/profe/retos: no se pudo asignar', e);
    boton.textContent = e instanceof ErrorApi ? e.mensaje : textos.profe.retos.errorAsignar;
    boton.disabled = false; select.disabled = false;
  }
}

// W16 (§7.3, §9.5 E10): activar/desactivar y asignar escriben — sin red, cada botón de cada fila
// queda deshabilitado con el mismo aviso, arriba de la lista (una fila puede tener docenas de
// retos; repetir el aviso por fila no ayuda a nadie). "Asignado ✓" es terminal: al volver la red
// no debe reactivarse (por eso `estadoAsignar` viaja hasta `ligarEscrituraARed`, no solo hasta el
// manejador — `otraCondicionOk` es justo el gancho que la firma de `red.js` deja para esto).
/** @param {(cancelar: () => void) => void} registrarCancelable junta los "soltar suscripción" de la fila */
function filaDeReto(reto, grupos, ctx, avisoRed, registrarCancelable) {
  const botonEstado = h(
    'button', { class: 'boton-chico boton-secundario', 'data-testid': `reto-${reto.id}-estado` },
    reto.status === 'active' ? textos.profe.retos.desactivar : textos.profe.retos.activar,
  );
  const cambiarUnaVez = accionUnica(cambiarEstadoReto);
  botonEstado.addEventListener('click', () => manejarCambiarEstado(reto, botonEstado, ctx, cambiarUnaVez));
  registrarCancelable(ligarEscrituraARed(botonEstado, avisoRed, textos.red.sinConexionAccion(textos.profe.retos.accionEscribir)));

  const select = selectorDeGrupo(grupos);
  const botonAsignar = h('button', { class: 'boton-chico', 'data-testid': `reto-${reto.id}-asignar` }, textos.profe.retos.asignar);
  const asignarUnaVez = accionUnica(asignarReto);
  const estadoAsignar = { hecho: false };
  botonAsignar.addEventListener('click', () => manejarAsignar(reto, select, botonAsignar, ctx, asignarUnaVez, estadoAsignar));
  registrarCancelable(ligarEscrituraARed(botonAsignar, avisoRed, textos.red.sinConexionAccion(textos.profe.retos.accionEscribir), () => !estadoAsignar.hecho));

  return h(
    'li', { class: 'fila', 'data-testid': `reto-${reto.id}` },
    h('div', { class: 'fila-texto' },
      h('span', { class: 'fila-titulo' }, tituloLegible(reto.title)),
      h('span', { class: 'texto-apoyo' }, `${reto.status} · ${textos.profe.retos.grupoAsignado(reto.group_id)}`)),
    h('div', { class: 'fila-acciones' },
      botonEstado,
      h('label', { class: 'etiqueta-en-linea' }, textos.profe.retos.etiquetaGrupoDestino, select),
      botonAsignar),
  );
}

function pintarLista(raiz, retos, grupos, ctx) {
  const avisoRed = h('p', { role: 'status', 'data-testid': 'profe-retos-sin-red' });
  const cancelables = [];
  const registrar = (c) => cancelables.push(c);
  const cuerpo = retos.length === 0
    ? h('p', { role: 'status' }, textos.profe.retos.sinRetos)
    : h('ul', {}, ...retos.map((r) => filaDeReto(r, grupos, ctx, avisoRed, registrar)));
  const nodo = h(
    'div', { 'data-testid': 'vista-profe-retos' },
    h('h1', {}, textos.profe.retos.titulo),
    h('p', { role: 'status', 'data-testid': 'aviso-todo-el-colegio' }, textos.profe.retos.avisoTodoElColegio),
    avisoRed,
    cuerpo,
    barra(ctx),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
  window.addEventListener('hashchange', () => cancelables.forEach((c) => c()), { once: true });
}

function pintarError(raiz, mensaje, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-retos' }, h('h1', {}, textos.profe.retos.titulo), h('p', { role: 'alert' }, mensaje), barra(ctx)));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {{token: string, tenantId?: string}} ctx */
export async function renderRetosProfe(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-retos' }, h('h1', {}, textos.profe.retos.titulo), h('p', { role: 'status' }, textos.inicio.cargando), barra(ctx)));
  try {
    const [retos, grupos] = await Promise.all([listarTodosLosRetos(ctx), listarGrupos(ctx)]);
    pintarLista(raiz, retos, grupos, ctx);
  } catch (e) {
    console.warn('vistas/profe/retos: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.profe.retos.errorGeneral, ctx);
  }
}
