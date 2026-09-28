// @ts-check
// vistas/profe/errores.js · W11 (T7): errores por ítem. "Errores con respuesta" = `errors -
// blank_answers` (P4 del pedagogo, ESPEC_grupos_y_panel_docente.md §5): un ítem en blanco no es
// un error de contenido, así que la interfaz nunca mezcla los dos. Los ítems bajo el mínimo de
// respondientes ya vienen suprimidos del servidor (privacidad); esta vista solo avisa cuántos.
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { tituloLegible } from '../../ui/titulo.js';
import { leerErroresDeItem } from '../../api/profe.js';
import { ErrorApi } from '../../api/cliente.js';

/** Pura (U, sin DOM): P4 — "errores con respuesta" descuenta las respuestas en blanco. */
export function erroresConRespuesta(item) {
  return item.errors - item.blank_answers;
}

function textoDistractor(item) {
  return item.top_distractor ? `${item.top_distractor.value} (${item.top_distractor.count})` : textos.profe.errores.sinDistractor;
}

function filaDeItem(item) {
  return h(
    'tr', { 'data-testid': `error-${item.question_id}` },
    h('td', {}, tituloLegible(item.title)),
    h('td', {}, item.question_text),
    h('td', {}, String(item.respondents)),
    h('td', { 'data-testid': `error-${item.question_id}-con-respuesta` }, String(erroresConRespuesta(item))),
    h('td', {}, String(item.blank_answers)),
    h('td', {}, textoDistractor(item)),
  );
}

function tablaErrores(items) {
  if (items.length === 0) return h('p', { role: 'status' }, textos.profe.errores.sinItems);
  return h(
    'table', { 'data-testid': 'tabla-errores' },
    h('thead', {}, h('tr', {},
      h('th', {}, textos.profe.errores.columnaReto),
      h('th', {}, textos.profe.errores.columnaPregunta),
      h('th', {}, textos.profe.errores.columnaRespondientes),
      h('th', {}, textos.profe.errores.columnaErroresConRespuesta),
      h('th', {}, textos.profe.errores.columnaEnBlanco),
      h('th', {}, textos.profe.errores.columnaDistractorTop),
    )),
    h('tbody', {}, ...items.map(filaDeItem)),
  );
}

function pintarErrores(raiz, gid, itemErrorsOut) {
  const avisoSuprimidos = textos.profe.errores.suprimidos(itemErrorsOut.suppressed_items);
  const nodo = h(
    'div', { 'data-testid': 'vista-profe-errores' },
    h('h1', {}, textos.profe.errores.titulo),
    h('a', { href: `#/profe/grupo/${gid}`, 'data-testid': 'volver-al-grupo' }, textos.profe.errores.volverAlGrupo),
    tablaErrores(itemErrorsOut.items),
    avisoSuprimidos ? h('p', { role: 'status', 'data-testid': 'errores-suprimidos' }, avisoSuprimidos) : null,
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}

function pintarError(raiz, mensaje) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-errores' }, h('h1', {}, textos.profe.errores.titulo), h('p', { role: 'alert' }, mensaje)));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {Record<string,string>} params ({gid}) @param {{token: string, tenantId?: string}} ctx */
export async function renderErrores(raiz, params, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-profe-errores' }, h('p', { role: 'status' }, textos.inicio.cargando)));
  try {
    const itemErrorsOut = await leerErroresDeItem(params.gid, ctx);
    pintarErrores(raiz, params.gid, itemErrorsOut);
  } catch (e) {
    console.warn('vistas/profe/errores: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.profe.errores.errorGeneral);
  }
}
