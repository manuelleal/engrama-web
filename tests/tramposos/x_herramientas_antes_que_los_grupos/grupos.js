// @ts-check
// vistas/profe/grupos.js · W10 (T1): la lista de grupos del profe, con el conteo de estudiantes.
// El servidor ya filtra por `visible_groups` — el cliente solo pinta lo que llega (§7.2).
//
// W64 (docs/ESPEC_navegacion.md §5.3): el inicio del profe pone PRIMERO los grupos, cada uno en una tarjeta con lo que se hace en cada clase a
// un toque ("Abrir asistencia", "Inscripciones", "Ver el grupo"), y debajo las herramientas que sacan de la app. Si alguien espera aprobación,
// la tarjeta lo dice con ícono y texto ("⏳ 2 esperan aprobación"): solo el NÚMERO, nunca un nombre en el inicio.
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { listarGrupos, listarSolicitudesInscripcion } from '../../api/profe.js';
import { ErrorApi } from '../../api/cliente.js';
import { crearBarraRol } from '../../ui/barra_rol.js';
import { crearHerramientasDeClase } from './herramientas_clase.js';

/** Cuántos grupos piden su conteo de "esperan aprobación" al pintar (una lectura por grupo, sin sondeo). PROVISIONAL (pregunta C9 de la espec). */
export const TOPE_DE_CONTEOS = 12;

const T = textos.tarjetaGrupo;

/** La tarjeta de un grupo: quién es, cuántos son y sus tres acciones, la de cada clase primero. `esperan` se llena después, si hay a quién esperar. */
function tarjetaDeGrupo(grupo) {
  const base = `#/profe/grupo/${grupo.id}`;
  const esperan = h('p', { class: 'grupo-esperan', role: 'status', 'data-testid': `grupo-${grupo.id}-esperan` }); // vacío no ocupa lugar (`:empty` en componentes.css)
  const nodo = h(
    'li', { class: 'fila tarjeta-grupo', 'data-testid': `grupo-${grupo.id}` },
    h('span', { class: 'fila-texto' },
      h('span', { class: 'fila-titulo' }, grupo.group_code),
      h('span', { class: 'texto-apoyo' }, textos.profe.grupos.estudiantes(grupo.student_count))),
    esperan,
    h('div', { class: 'fila-acciones' },
      h('a', { href: `${base}/sesion`, class: 'accion-principal', 'data-testid': `grupo-${grupo.id}-asistencia` }, T.asistencia),
      h('a', { href: `${base}/inscripcion`, 'data-testid': `grupo-${grupo.id}-inscripciones` }, T.inscripciones),
      h('a', { href: base, 'data-testid': `grupo-${grupo.id}-ver` }, T.ver)),
  );
  return { nodo, esperan };
}

/** Escribe "⏳ N esperan aprobación" en la tarjeta, solo si N es mayor que 0 (ícono y texto, nunca solo color). */
function mostrarEsperan(esperan, n) {
  if (!(n > 0)) return;
  esperan.appendChild(h('span', { class: 'etiqueta-icono', 'aria-hidden': 'true' }, '⏳'));
  esperan.appendChild(document.createTextNode(` ${T.esperan(n)}`));
}

/**
 * Lee cuántos esperan aprobación en cada uno de los primeros grupos y lo anota en su tarjeta. UNA lectura por grupo, al pintar, sin sondeo.
 * Si una lectura falla, esa tarjeta se queda sin conteo y la página sigue completa: el conteo es una ayuda, no una condición.
 */
async function leerConteos(tarjetas, ctx) {
  await Promise.all(tarjetas.slice(0, TOPE_DE_CONTEOS).map(async ({ grupo, esperan }) => {
    try {
      mostrarEsperan(esperan, (await listarSolicitudesInscripcion(grupo.id, ctx)).length);
    } catch (e) {
      console.warn('vistas/profe/grupos: no se pudo leer cuántos esperan aprobación', e instanceof ErrorApi ? e.status : 'error'); // nunca un catch mudo
    }
  }));
}

function pintarLista(raiz, grupos, ctx) {
  const tarjetas = grupos.map((grupo) => ({ grupo, ...tarjetaDeGrupo(grupo) }));
  const cuerpo = grupos.length === 0
    ? h('p', { role: 'status' }, textos.profe.grupos.sinGrupos)
    : h('ul', { 'data-testid': 'lista-grupos' }, ...tarjetas.map((t) => t.nodo));
  montar(raiz, h(
    'div', { 'data-testid': 'vista-profe-grupos' },
    crearBarraRol(ctx),
    h('h1', {}, textos.profe.grupos.titulo),
    crearHerramientasDeClase(ctx),
    cuerpo, // W35: solo si hay EVA o SET configurados para esta institución (§4.6); null no pinta nada
    // Los retos de la institución: hasta que el profe tenga su barra de abajo (W70), este enlace es su único camino.
    h('nav', {}, h('a', { href: '#/profe/retos', 'data-testid': 'ir-a-retos-profe' }, textos.profe.grupo.verRetos)),
  ));
  document.body.dataset.listo = '1';
  return leerConteos(tarjetas, ctx);
}

function pintarError(raiz, mensaje, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-grupos' }, crearBarraRol(ctx), h('h1', {}, textos.profe.grupos.titulo), h('p', { role: 'alert' }, mensaje)));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {{token: string, tenantId?: string, salir?: () => Promise<void>}} ctx */
export async function renderGrupos(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-grupos' }, h('p', { role: 'status' }, textos.inicio.cargando)));
  let grupos;
  try {
    grupos = await listarGrupos(ctx);
  } catch (e) {
    console.warn('vistas/profe/grupos: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.profe.grupos.errorGeneral, ctx);
    return;
  }
  await pintarLista(raiz, grupos, ctx);
}
