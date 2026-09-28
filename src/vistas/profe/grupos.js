// @ts-check
// vistas/profe/grupos.js · W10 (T1): la lista de grupos del profe, con el conteo de estudiantes.
// El servidor ya filtra por `visible_groups` — el cliente solo pinta lo que llega (§7.2).
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { listarGrupos } from '../../api/profe.js';
import { ErrorApi } from '../../api/cliente.js';
import { crearBarraRol } from '../../ui/barra_rol.js';

function filaDeGrupo(grupo) {
  return h(
    'li', { class: 'fila', 'data-testid': `grupo-${grupo.id}` },
    h('span', { class: 'fila-texto' },
      h('span', { class: 'fila-titulo' }, grupo.group_code),
      h('span', { class: 'texto-apoyo' }, textos.profe.grupos.estudiantes(grupo.student_count))),
    h('a', { href: `#/profe/grupo/${grupo.id}`, class: 'boton-chico', 'data-testid': `grupo-${grupo.id}-abrir` }, textos.profe.grupos.abrirGrupo),
  );
}

function pintarLista(raiz, grupos, ctx) {
  const cuerpo = grupos.length === 0
    ? h('p', { role: 'status' }, textos.profe.grupos.sinGrupos)
    : h('ul', {}, ...grupos.map(filaDeGrupo));
  montar(raiz, h(
    'div', { 'data-testid': 'vista-profe-grupos' },
    crearBarraRol(ctx),
    h('h1', {}, textos.profe.grupos.titulo),
    h('nav', {}, h('a', { href: '#/profe/retos', 'data-testid': 'ir-a-retos-profe' }, textos.profe.grupo.verRetos)),
    cuerpo,
  ));
  document.body.dataset.listo = '1';
}

function pintarError(raiz, mensaje, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-grupos' }, crearBarraRol(ctx), h('h1', {}, textos.profe.grupos.titulo), h('p', { role: 'alert' }, mensaje)));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {{token: string, tenantId?: string, salir?: () => Promise<void>}} ctx */
export async function renderGrupos(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-grupos' }, h('p', { role: 'status' }, textos.inicio.cargando)));
  try {
    const grupos = await listarGrupos(ctx);
    pintarLista(raiz, grupos, ctx);
  } catch (e) {
    console.warn('vistas/profe/grupos: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.profe.grupos.errorGeneral, ctx);
  }
}
