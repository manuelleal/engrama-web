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
import { tituloLegible } from '../../ui/titulo.js';
import { arrancarIntento, enviarIntento, historialDeIntentos } from '../../api/retos.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { renderRevision, textoDeOpcion } from './revision.js';
import { crearPanelResultado } from '../../ui/panel_resultado.js';
import { avanceDelReto, crearBarraProgreso, senalDeSeleccion } from '../../ui/progreso.js';
import { crearBotonSonido } from '../../ui/boton_sonido.js';
import { marcarCargando } from '../../ui/boton.js';
import { crearCargando } from '../../ui/estados.js';
import { senal } from '../../ui/sonido.js';
import { leerRespuestasGuardadas, guardarRespuestas, borrarRespuestasGuardadas } from './respuestas_locales.js';

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

// Ficha de opción: la letra en un escudo (referencia visual: investigacion/evagame,
// pantallas-modo-en-vivo.html .opt/.let) y el texto aparte. El escudo lleva aria-hidden porque el
// texto solo (op.value) ya basta para el lector de pantalla — mismo patrón que ui/retro.js con su
// ícono ✓/✗ aria-hidden y el texto real al lado.
function nodoOpciones(pregunta, respuestas, onElegir, recienElegida) {
  const opciones = (pregunta.options_json || []).map((op) => h('li', {},
    h('button', {
      'data-testid': `opcion-${op.label}`,
      class: recienElegida === op.label ? 'opcion-recien' : null,
      'aria-pressed': String(respuestas[pregunta.id] === op.label),
      onClick: () => onElegir(valorAlGuardar(op)),
    },
    h('span', { class: 'escudo-letra', 'aria-hidden': 'true' }, op.label),
    h('span', { class: 'texto-opcion' }, op.value)),
  ));
  return h('ul', { 'data-testid': 'opciones' }, ...opciones);
}

// La barra de acción de abajo (mecánica común de las apps de aprendizaje): el botón nace PLANO
// (deshabilitado) y despierta con un pop cuando hay una respuesta; sobre él sube un panel NEUTRO que
// confirma lo elegido. Todavía no hay veredicto aquí: la corrección pregunta a pregunta es L1/W18
// (hito 2) y la clave no sale antes de enviar. Cuando exista, usa este mismo panel (ui/panel_resultado.js).
function nodoBarraAccion(estado, callbacks, efecto) {
  const { challenge, indice, respuestas } = estado;
  const pregunta = challenge.questions[indice];
  const elegida = respuestas[pregunta.id];
  const ultima = indice === challenge.questions.length - 1;
  const boton = h('button', {
    'data-testid': ultima ? 'boton-terminar' : 'boton-siguiente',
    class: `boton-principal${efecto.elegida ? ' despierta' : ''}`,
    disabled: !elegida,
    onClick: ultima ? callbacks.terminar : callbacks.siguiente,
  }, ultima ? textos.retoFlujo.terminar : textos.retoFlujo.siguiente);
  const panel = crearPanelResultado({
    tipo: 'neutro', visible: Boolean(elegida), sube: efecto.primera,
    texto: elegida ? textos.retoFlujo.elegiste(elegida, textoDeOpcion(pregunta, elegida)) : '',
    detalle: textos.retoFlujo.correccionAlFinal, testid: 'panel-respuesta',
  });
  return h('div', { class: 'barra-accion' }, panel, boton);
}

// `entrada`: cómo llega esta pantalla. 'desliza' = pregunta nueva (entra desde la derecha con rebote);
// 'quieta' = el estudiante solo eligió una opción (se repinta, pero no se repite la entrada).
// `efecto`: {elegida: la label recién elegida, primera: ¿primera respuesta a esta pregunta?}.
function pintarPregunta(raiz, estado, callbacks, entrada = 'desliza', efecto = { elegida: null, primera: false }) {
  const { challenge, indice, respuestas, esRepaso } = estado;
  const pregunta = challenge.questions[indice];
  const onElegir = (label) => {
    const primera = !respuestas[pregunta.id];
    respuestas[pregunta.id] = label;
    guardarRespuestas(estado.attemptId, respuestas);
    senal(senalDeSeleccion()); // neutra: nunca "acierto"/"fallo" antes de enviar (la clave no sale)
    pintarPregunta(raiz, estado, callbacks, 'quieta', { elegida: label, primera });
  };
  const avance = avanceDelReto(challenge.questions, respuestas);
  const barra = crearBarraProgreso(avance, estado.avanceMostrado ?? 0);
  estado.avanceMostrado = avance.fraccion;
  const nodo = h(
    'div', { 'data-testid': 'vista-reto-flujo', class: `juego juego-${entrada}` },
    h('div', { class: 'encabezado-reto' },
      crearDrako('presenta', textos.retoFlujo.drakoPresenta),
      h('h1', { class: 'titulo-reto' }, tituloLegible(challenge.title)),
      crearBotonSonido()),
    barra,
    esRepaso ? h('p', { role: 'status', class: 'aviso-corto', 'data-testid': 'banner-repaso' }, textos.retoFlujo.bannerRepaso) : null,
    h('p', { class: 'texto-apoyo', 'data-testid': 'contador-pregunta' }, textos.retoFlujo.pregunta(indice + 1, challenge.questions.length)),
    h('p', { class: 'enunciado', 'data-testid': 'enunciado' }, pregunta.question_text),
    nodoOpciones(pregunta, respuestas, onElegir, efecto.elegida),
    nodoBarraAccion(estado, callbacks, efecto),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}

function pintarErrorFlujo(raiz, mensaje) {
  montar(raiz, h('div', { 'data-testid': 'vista-reto-flujo' }, h('p', { role: 'alert' }, mensaje)));
  document.body.dataset.listo = '1';
}

// Mientras el servidor revisa: Drako PIENSA (presenta, no califica) en vez de un botón mudo.
function nodoRevisando() {
  return h('div', { class: 'revisando', role: 'status', 'data-testid': 'revisando' },
    crearDrako('piensa', textos.retoFlujo.drakoPiensa), h('p', {}, textos.retoFlujo.revisando));
}

async function manejarTerminar(raiz, estado, enviarUnaVez) {
  const boton = raiz.querySelector('[data-testid="boton-terminar"]');
  if (boton) { boton.disabled = true; marcarCargando(boton, true); boton.textContent = textos.retoFlujo.terminando; raiz.querySelector('.barra-accion')?.before(nodoRevisando()); }
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
  montar(raiz, h('div', { 'data-testid': 'vista-reto-flujo', class: 'juego' }, crearCargando(textos.inicio.cargando)));
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
