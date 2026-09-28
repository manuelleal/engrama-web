// @ts-check
// vistas/profe/logro.js · W11 (T5): logro por eje, con las palabras que fijó el pedagogo — "a
// reforzar", nunca "débil" (ESPEC_grupos_y_panel_docente.md §5, P1 y P4). La etiqueta la arma el
// servidor (`axis.label`); esta vista nunca inventa la suya. Regla dura (P1): "ninguna vista
// muestra `status` ni `label` de un eje sin su `cefr_levels` al lado" — por eso `textoEje` SIEMPRE
// junta los dos, incluso cuando `cefr_levels` está vacío. Sin ranking: los estudiantes se pintan
// en el orden que manda el servidor, nunca reordenados por desempeño (el saldo no es desempeño).
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { leerLogro } from '../../api/profe.js';
import { ErrorApi } from '../../api/cliente.js';

const EJES = ['Comprehension', 'Expression', 'Accuracy'];

/** Pura: "B1: 2, sin_nivel: 1" o el texto de "sin niveles" si el eje no tiene retos todavía. */
export function textoCefrLevels(cefrLevels) {
  const entradas = Object.entries(cefrLevels || {});
  if (entradas.length === 0) return textos.profe.logro.sinNivelesCefr;
  return entradas.map(([nivel, n]) => `${nivel}: ${n}`).join(', ');
}

/** Pura (U, sin DOM): el estado Y el cefr_levels SIEMPRE juntos, nunca uno sin el otro (P1). */
export function textoEje(axisOut) {
  return `${axisOut.label} · ${textoCefrLevels(axisOut.cefr_levels)}`;
}

function celdaDeEje(estudiante, eje) {
  const axisOut = estudiante.axes.find((a) => a.axis === eje);
  return h('td', { 'data-testid': `logro-${estudiante.profile_id}-${eje}` }, axisOut ? textoEje(axisOut) : textos.profe.logro.sinNivelesCefr);
}

function filaDeEstudiante(estudiante) {
  return h(
    'tr', { 'data-testid': `logro-fila-${estudiante.profile_id}` },
    h('td', {}, estudiante.full_name),
    ...EJES.map((eje) => celdaDeEje(estudiante, eje)),
  );
}

function tablaLogro(students) {
  if (students.length === 0) return h('p', { role: 'status' }, textos.profe.logro.sinEstudiantes);
  return h(
    'table', { 'data-testid': 'tabla-logro' },
    h('thead', {}, h('tr', {}, h('th', {}, textos.profe.logro.columnaEstudiante), ...EJES.map((e) => h('th', {}, e)))),
    h('tbody', {}, ...students.map(filaDeEstudiante)),
  );
}

function pintarLogro(raiz, gid, achievementOut) {
  const nodo = h(
    'div', { 'data-testid': 'vista-profe-logro' },
    h('h1', {}, textos.profe.logro.titulo),
    h('a', { href: `#/profe/grupo/${gid}`, 'data-testid': 'volver-al-grupo' }, textos.profe.logro.volverAlGrupo),
    tablaLogro(achievementOut.students),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}

function pintarError(raiz, mensaje) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-logro' }, h('h1', {}, textos.profe.logro.titulo), h('p', { role: 'alert' }, mensaje)));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {Record<string,string>} params ({gid}) @param {{token: string, tenantId?: string}} ctx */
export async function renderLogro(raiz, params, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-logro' }, h('p', { role: 'status' }, textos.inicio.cargando)));
  try {
    const achievementOut = await leerLogro(params.gid, ctx);
    pintarLogro(raiz, params.gid, achievementOut);
  } catch (e) {
    console.warn('vistas/profe/logro: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.profe.logro.errorGeneral);
  }
}
