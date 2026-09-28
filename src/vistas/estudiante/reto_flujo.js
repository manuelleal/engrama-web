// @ts-check
// vistas/estudiante/reto_flujo.js · W9: una pregunta por pantalla (hito 1 — las respuestas se
// guardan en el dispositivo, por `attempt_id`, y se revisan al final; la corrección pregunta a
// pregunta es L1/W18, hito 2). Las opciones se guardan por su LABEL ("A", "B"…), nunca por su
// `value` (§7.2 regla 4; X12 lo prueba). "Repaso: no suma monedas" se dice ANTES de empezar
// cuando el reto ya estaba ganado (matiz de F4, 2026-09-28); el cliente nunca inventa un "+N
// monedas": muestra lo que trae `coins_earned` en la respuesta, sea lo que sea.
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { crearDrako } from '../../ui/drako.js';
import { arrancarIntento, enviarIntento, historialDeIntentos } from '../../api/retos.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { renderRevision } from './revision.js';

function claveLocal(attemptId) {
  return `engrama_respuestas_${attemptId}`;
}

function leerRespuestasGuardadas(attemptId) {
  try {
    const crudo = localStorage.getItem(claveLocal(attemptId));
    return crudo ? JSON.parse(crudo) : {};
  } catch (e) { console.error('reto_flujo: no pude leer respuestas guardadas', e); return {}; }
}

function guardarRespuestas(attemptId, respuestas) {
  try { localStorage.setItem(claveLocal(attemptId), JSON.stringify(respuestas)); }
  catch (e) { console.error('reto_flujo: no pude guardar la respuesta', e); }
}

function borrarRespuestasGuardadas(attemptId) {
  try { localStorage.removeItem(claveLocal(attemptId)); }
  catch (e) { console.error('reto_flujo: no pude borrar las respuestas guardadas', e); }
}

/** ¿Alguna vez se ganó este reto? (para el "Repaso" cuando no llega por la URL, p. ej. F5). */
async function yaGanado(challengeId, ctx) {
  const historial = await historialDeIntentos(ctx);
  return historial.some((h) => h.challenge_id === challengeId && h.is_correct);
}

function primeraSinResponder(preguntas, respuestas) {
  const i = preguntas.findIndex((q) => !respuestas[q.id]);
  return i === -1 ? preguntas.length - 1 : i;
}

/**
 * Qué se guarda al elegir una opción: SIEMPRE su `label` ("A", "B"…), nunca su `value` — pura,
 * para poder probarla sin DOM (U11; X12 la rompe cambiándola por `opcion.value`).
 * @param {{label: string, value: string}} opcion
 */
export function valorAlGuardar(opcion) {
  return opcion.label;
}

function nodoOpciones(pregunta, respuestas, onElegir) {
  const opciones = (pregunta.options_json || []).map((op) => h('li', {},
    h('button', {
      'data-testid': `opcion-${op.label}`,
      'aria-pressed': String(respuestas[pregunta.id] === op.label),
      onClick: () => onElegir(valorAlGuardar(op)),
    }, `${op.label}. ${op.value}`),
  ));
  return h('ul', { 'data-testid': 'opciones' }, ...opciones);
}

function nodoBotonAvanzar(estado, callbacks) {
  const { challenge, indice, respuestas } = estado;
  const pregunta = challenge.questions[indice];
  const respondida = Boolean(respuestas[pregunta.id]);
  if (indice === challenge.questions.length - 1) {
    return h('button', { 'data-testid': 'boton-terminar', disabled: !respondida, onClick: callbacks.terminar }, textos.retoFlujo.terminar);
  }
  return h('button', { 'data-testid': 'boton-siguiente', disabled: !respondida, onClick: callbacks.siguiente }, textos.retoFlujo.siguiente);
}

function pintarPregunta(raiz, estado, callbacks) {
  const { challenge, indice, respuestas, esRepaso } = estado;
  const pregunta = challenge.questions[indice];
  const onElegir = (label) => { respuestas[pregunta.id] = label; guardarRespuestas(estado.attemptId, respuestas); pintarPregunta(raiz, estado, callbacks); };
  const nodo = h(
    'div', { 'data-testid': 'vista-reto-flujo' },
    crearDrako('presenta', textos.retoFlujo.drakoPresenta),
    esRepaso ? h('p', { role: 'status', 'data-testid': 'banner-repaso' }, textos.retoFlujo.bannerRepaso) : null,
    h('h1', {}, challenge.title),
    h('p', { 'data-testid': 'contador-pregunta' }, textos.retoFlujo.pregunta(indice + 1, challenge.questions.length)),
    h('p', { 'data-testid': 'enunciado' }, pregunta.question_text),
    nodoOpciones(pregunta, respuestas, onElegir),
    nodoBotonAvanzar(estado, callbacks),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}

function pintarErrorFlujo(raiz, mensaje) {
  montar(raiz, h('div', { 'data-testid': 'vista-reto-flujo' }, h('p', { role: 'alert' }, mensaje)));
  document.body.dataset.listo = '1';
}

async function manejarTerminar(raiz, estado, enviarUnaVez) {
  const boton = raiz.querySelector('[data-testid="boton-terminar"]');
  if (boton) { boton.disabled = true; boton.textContent = textos.retoFlujo.terminando; }
  try {
    const resultado = await enviarUnaVez();
    borrarRespuestasGuardadas(estado.attemptId);
    renderRevision(raiz, { challenge: estado.challenge, resultado, respuestasDadas: estado.respuestas });
  } catch (e) {
    // 409 = "Attempt already completed or abandoned": un doble toque real ya lo manejó
    // accionUnica (una sola petición); si aun así llega, es que el servidor ya lo cerró por otra
    // vía — no hay nada que mostrar como error nuevo, y NUNCA se reintenta ni se cobra dos veces.
    if (e instanceof ErrorApi && e.status === 409) return;
    console.warn('reto_flujo: no se pudo enviar el intento', e);
    pintarErrorFlujo(raiz, e instanceof ErrorApi ? e.mensaje : 'No se pudo enviar tu reto.');
  }
}

/**
 * @param {HTMLElement} raiz
 * @param {Record<string,string>} params ({id})
 * @param {Record<string,string>} query (puede traer repaso=1)
 * @param {{token: string, tenantId?: string}} ctx
 */
export async function renderRetoFlujo(raiz, params, query, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-reto-flujo' }, h('p', { role: 'status' }, textos.inicio.cargando)));
  const challengeId = params.id;
  try {
    const esRepaso = query.repaso === '1' || (await yaGanado(challengeId, ctx));
    const { attempt_id: attemptId, challenge } = await arrancarIntento(challengeId, ctx);
    const respuestas = leerRespuestasGuardadas(attemptId);
    const estado = { attemptId, challenge, respuestas, esRepaso, indice: primeraSinResponder(challenge.questions, respuestas) };
    const enviarUnaVez = accionUnica(() => enviarIntento(attemptId, respuestas, ctx));
    const callbacks = {
      siguiente: () => { estado.indice++; pintarPregunta(raiz, estado, callbacks); },
      terminar: () => manejarTerminar(raiz, estado, enviarUnaVez),
    };
    pintarPregunta(raiz, estado, callbacks);
  } catch (e) {
    console.warn('reto_flujo: no se pudo cargar el reto', e);
    pintarErrorFlujo(raiz, e instanceof ErrorApi ? e.mensaje : 'No se pudo cargar el reto.');
  }
}
