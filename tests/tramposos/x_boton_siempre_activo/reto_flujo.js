// @ts-check
// vistas/estudiante/reto_flujo.js · W9: una pregunta por pantalla. Con L1 en el backend, pregunta por pregunta (reto_l1.js, W78); si no,
// las respuestas se guardan en el equipo por `attempt_id` y se revisan al final. Las opciones se guardan por su LABEL ("A", "B"…), nunca por su
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
import { crearCabecera } from '../../ui/cabecera.js';
import { marcarCargando } from '../../ui/boton.js';
import { crearCargando } from '../../ui/estados.js';
import { senal } from '../../ui/sonido.js';
import { leerRespuestasGuardadas, guardarRespuestas, borrarRespuestasGuardadas } from './respuestas_locales.js';

/**
 * W73 (docs/ESPEC_navegacion.md §5.9, H10): "✕ Salir" lleva a Retos. Es un ENLACE interno (un hash): tocarlo no envía el intento ni hace ninguna
 * petición, y las respuestas ya guardadas en el equipo no se borran. El reto sigue sin barra de abajo (una tarea por pantalla): esta es su
 * única salida. No aparece mientras se revisa el envío.
 */
export function crearSalir() {
  return h('a', { href: '#/retos', class: 'salir-reto', 'data-testid': 'reto-salir', 'aria-label': textos.salirDelReto.nombre }, textos.salirDelReto.texto);
}

/**
 * ¿Alguna vez se ganó este reto? (para el "Repaso" cuando no llega por la URL, p. ej. F5). W50: devuelve además el historial que leyó, ANTES de
 * jugar, para saber al final si hay un mérito que celebrar ("primer reto perfecto", "reto superado"). Es la MISMA petición de siempre: ni una más.
 */
async function yaGanado(challengeId, ctx) {
  const historial = await historialDeIntentos(ctx);
  return { ganado: historial.some((h) => h.challenge_id === challengeId && h.is_correct), historial };
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
export function nodoOpciones(pregunta, respuestas, onElegir, recienElegida) {
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

// La barra de acción de abajo: el botón nace PLANO y despierta cuando hay una respuesta; sobre él sube un panel NEUTRO que confirma
// lo elegido. Sin veredicto: aquí la clave no sale antes de enviar (el veredicto por pregunta es de reto_l1.js).
function nodoBarraAccion(estado, callbacks, efecto) {
  const { challenge, indice, respuestas } = estado;
  const pregunta = challenge.questions[indice];
  const elegida = respuestas[pregunta.id];
  const ultima = indice === challenge.questions.length - 1;
  const boton = h('button', {
    'data-testid': ultima ? 'boton-terminar' : 'boton-siguiente',
    class: `boton-principal${efecto.elegida ? ' despierta' : ''}`,
    disabled: false,
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
  estado.salir = crearSalir();
  const nodo = h(
    'div', { 'data-testid': 'vista-reto-flujo', class: `juego juego-${entrada}` },
    estado.encabezado = crearCabecera({ piezas: [estado.salir, h('h1', { class: 'titulo-reto' }, tituloLegible(challenge.title))], sonido: true }),
    barra,
    esRepaso ? h('p', { role: 'status', class: 'aviso-corto', 'data-testid': 'banner-repaso' }, textos.retoFlujo.bannerRepaso) : null,
    // Drako presenta la pregunta (fuera de la franja navy, donde no se vería); chico y se repinta con cada opción: imagen.
    h('div', { class: 'presenta-pregunta' },
      crearDrako('presenta', textos.retoFlujo.drakoPresenta),
      h('p', { class: 'texto-apoyo', 'data-testid': 'contador-pregunta' }, textos.retoFlujo.pregunta(indice + 1, challenge.questions.length))),
    h('p', { class: 'enunciado', 'data-testid': 'enunciado' }, pregunta.question_text),
    nodoOpciones(pregunta, respuestas, onElegir, efecto.elegida),
    nodoBarraAccion(estado, callbacks, efecto),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}

export function pintarErrorFlujo(raiz, mensaje) {
  // También si el reto no carga o no se pudo enviar: la salida a Retos, arriba (antes esta pantalla era un callejón).
  montar(raiz, h('div', { 'data-testid': 'vista-reto-flujo' }, crearSalir(), h('p', { role: 'alert' }, mensaje)));
  document.body.dataset.listo = '1';
}

// Mientras el servidor revisa: Drako PIENSA (presenta, no califica) en vez de un botón mudo.
export function nodoRevisando() {
  return h('div', { class: 'revisando', role: 'status', 'data-testid': 'revisando' },
    crearDrako('piensa', textos.retoFlujo.drakoPiensa), h('p', {}, textos.retoFlujo.revisando));
}

async function manejarTerminar(raiz, estado, enviarUnaVez) {
  estado.salir?.remove(); // mientras se revisa el envío no se ofrece salir: el intento ya va camino al servidor
  const boton = raiz.querySelector('[data-testid="boton-terminar"]');
  if (boton) { boton.disabled = true; marcarCargando(boton, true); boton.textContent = textos.retoFlujo.terminando; raiz.querySelector('.barra-accion')?.before(nodoRevisando()); }
  try {
    const resultado = await enviarUnaVez();
    borrarRespuestasGuardadas(estado.attemptId);
    renderRevision(raiz, { challenge: estado.challenge, resultado, respuestasDadas: estado.respuestas, rol: estado.rol, esRepaso: estado.esRepaso, historialPrevio: estado.historialPrevio });
  } catch (e) {
    // 409 = "Attempt already completed or abandoned": un doble toque real ya lo manejó
    // accionUnica (una sola petición); si aun así llega, es que el servidor ya lo cerró por otra
    // vía — no hay nada que mostrar como error nuevo, y NUNCA se reintenta ni se cobra dos veces.
    if (e instanceof ErrorApi && e.cuerpo?.detail === 'intento_con_respuestas' && estado.reabrir) { estado.reabrir(); return; } // W78: va por pregunta
    if (e instanceof ErrorApi && e.status === 409) { if (estado.salir) estado.encabezado?.prepend(estado.salir); return; } // sin pantalla nueva, pero con la salida de vuelta
    console.warn('reto_flujo: no se pudo enviar el intento', e);
    pintarErrorFlujo(raiz, e instanceof ErrorApi ? e.mensaje : 'No se pudo enviar tu reto.');
  }
}

// W78: con L1 en el backend, el reto va pregunta por pregunta (módulo diferido); si no, como siempre.
async function porPregunta(raiz, datos) {
  try { return await (await import('./reto_l1.js')).intentarL1(raiz, datos); } catch (e) { console.warn('reto_flujo: sin L1', e); return false; }
}

/**
 * @param {HTMLElement} raiz
 * @param {Record<string,string>} params ({id})
 * @param {Record<string,string>} query (puede traer repaso=1)
 * @param {{token: string, tenantId?: string}} ctx
 */
export async function renderRetoFlujo(raiz, params, query, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-reto-flujo', class: 'juego' }, crearSalir(), crearCargando(textos.inicio.cargando)));
  const challengeId = params.id;
  try {
    // Con `?repaso=1` no se pide el historial (como siempre): es un repaso y un repaso nunca lleva sello.
    const previo = query.repaso === '1' ? { ganado: true, historial: null } : await yaGanado(challengeId, ctx);
    const esRepaso = previo.ganado;
    const { attempt_id: attemptId, challenge } = await arrancarIntento(challengeId, ctx);
    if (await porPregunta(raiz, { attemptId, challenge, esRepaso, historialPrevio: previo.historial, ctx })) return;
    const respuestas = leerRespuestasGuardadas(attemptId);
    const estado = { attemptId, challenge, respuestas, esRepaso, historialPrevio: previo.historial, rol: /** @type {any} */ (ctx).sesion?.rol, indice: primeraSinResponder(challenge.questions, respuestas) };
    if (!query.reabierto) estado.reabrir = () => renderRetoFlujo(raiz, params, { ...query, reabierto: '1' }, ctx);
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
