// @ts-check
// vistas/estudiante/reto_l1.js · W78 (docs/ESPEC_practica_del_dia.md §W78): el reto pregunta por pregunta, con la correcta y la explicación tras CADA
// respuesta (L1, backend `f7f7aeb`; dictamen 04 §1.5). Módulo DIFERIDO: lo carga reto_flujo.js con `import()` solo cuando el backend responde
// `GET …/answers`; si no carga o el backend es viejo, el reto se juega como siempre (con /submit). Reglas:
//   - se pintan SIEMPRE las preguntas que trajo `/attempt` (en un reintento pueden ser otras: la forma gemela); nunca el detalle del reto;
//   - elegir no revela nada (panel neutro "Elegiste B", como siempre); "Comprobar" manda la LABEL (regla 4), una vez por toque (regla 5);
//   - lo de una pregunta (la oración, la explicación, cuál era la correcta) aparece SOLO después de que el servidor la califica (regla 3);
//   - gana la primera respuesta: lo que se muestra es lo que el servidor guardó (`answer`);
//   - retomar: lo ya respondido llega en `GET …/answers`; se abre en la primera sin responder;
//   - "Ver resultado" cierra con `/finish` (una vez) y muestra la revisión de siempre.
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { textosPractica } from '../../textos_practica.js';
import { crearDrako } from '../../ui/drako.js';
import { tituloLegible } from '../../ui/titulo.js';
import { crearCabecera } from '../../ui/cabecera.js';
import { crearBarraProgreso, senalDeSeleccion } from '../../ui/progreso.js';
import { crearPanelResultado } from '../../ui/panel_resultado.js';
import { marcarCargando } from '../../ui/boton.js';
import { senal } from '../../ui/sonido.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { retomarIntento, responderPregunta, terminarIntento } from '../../api/practica.js';
import { planDeExplicacion, crearBanda } from '../../ui/explicacion.js';
import { renderRevision, textoDeOpcion } from './revision.js';
import { crearSalir, nodoOpciones, pintarErrorFlujo, nodoRevisando } from './reto_flujo.js';

const T = textosPractica.l1;

/**
 * Dónde se abre el reto — pura: la primera pregunta sin responder; si ya están todas, la última (con su banda y "Ver resultado").
 * @param {Array<{id: string}>} preguntas @param {Map<string, unknown>} respondidas
 */
export function indiceInicial(preguntas, respondidas) {
  const i = preguntas.findIndex((q) => !respondidas.has(q.id));
  return i === -1 ? Math.max(0, preguntas.length - 1) : i;
}

/**
 * Intenta jugar el reto pregunta por pregunta. Devuelve false (sin pintar nada) si este backend no responde `GET …/answers`: el reto se juega como antes.
 * @param {HTMLElement} raiz
 * @param {{attemptId: string, challenge: any, esRepaso: boolean, historialPrevio: unknown, ctx: any}} datos
 */
export async function intentarL1(raiz, datos) {
  const retomado = await retomarIntento(datos.attemptId, datos.ctx);
  if (!retomado) return false;
  const preguntas = datos.challenge.questions;
  const ids = new Set(preguntas.map((/** @type {any} */ q) => q.id));
  // Solo lo de ESTE intento: una respuesta de una pregunta que no está en lo que trajo /attempt no se usa.
  const respondidas = new Map(retomado.respondidas.filter((r) => ids.has(r.question_id)).map((r) => [r.question_id, r]));
  const estado = { ...datos, rol: datos.ctx.sesion?.rol, respondidas, elegidas: /** @type {Record<string, string>} */ ({}), indice: indiceInicial(preguntas, respondidas), avanceMostrado: 0 };
  estado.comprobar = accionUnica((qid, label) => responderPregunta(datos.attemptId, qid, label, datos.ctx));
  estado.terminar = accionUnica(() => terminarIntento(datos.attemptId, datos.ctx));
  pintar(raiz, estado);
  return true;
}

/** Las opciones de la pregunta; ya respondida, quietas (la que quedó guardada, marcada). */
function opcionesDe(raiz, estado, pregunta, respuesta) {
  const elegida = respuesta ? respuesta.answer : estado.elegidas[pregunta.id];
  const alElegir = (/** @type {string} */ label) => {
    if (respuesta) return;
    estado.elegidas[pregunta.id] = label;
    senal(senalDeSeleccion()); // neutra: elegir no dice nada de la clave
    pintar(raiz, estado, 'quieta', label);
  };
  const lista = nodoOpciones(pregunta, { [pregunta.id]: elegida }, alElegir, null);
  if (respuesta) for (const li of lista.children) { const b = /** @type {any} */ (li).children?.[0]; if (b) b.disabled = true; }
  return lista;
}

/** Antes de comprobar: el panel neutro de siempre ("Elegiste B: …") y el botón Comprobar, que despierta al elegir. */
function barraComprobar(raiz, estado, pregunta, recien) {
  const elegida = estado.elegidas[pregunta.id];
  const boton = h('button', {
    'data-testid': 'boton-comprobar', class: `boton-principal${recien ? ' despierta' : ''}`, disabled: !elegida,
    onClick: () => comprobar(raiz, estado, pregunta, boton),
  }, T.comprobar);
  const panel = crearPanelResultado({
    tipo: 'neutro', visible: Boolean(elegida), sube: Boolean(recien), testid: 'panel-respuesta',
    texto: elegida ? textos.retoFlujo.elegiste(elegida, textoDeOpcion(pregunta, elegida)) : '',
    detalle: estado.error ?? T.antesDeComprobar,
  });
  return h('div', { class: 'barra-accion' }, panel, boton);
}

/** Ya respondida: la banda con el veredicto y la explicación, y el botón que sigue dentro de ella. */
function barraRespondida(raiz, estado, pregunta, respuesta) {
  const ultima = estado.indice === estado.challenge.questions.length - 1;
  const boton = h('button', {
    'data-testid': ultima ? 'boton-terminar' : 'boton-siguiente', class: 'boton-principal',
    onClick: () => (ultima ? terminar(raiz, estado, boton) : siguiente(raiz, estado)),
  }, ultima ? T.verResultado : T.siguiente);
  const elegida = estado.elegidas[pregunta.id];
  const nota = elegida && elegida !== respuesta.answer ? T.quedoGuardada(respuesta.answer, textoDeOpcion(pregunta, respuesta.answer)) : null;
  return h('div', { class: 'barra-accion con-banda' }, crearBanda(planDeExplicacion(respuesta), { accion: boton, nota }));
}

function pintar(raiz, estado, entrada = 'desliza', recien = null) {
  const { challenge, indice } = estado;
  const pregunta = challenge.questions[indice];
  const respuesta = estado.respondidas.get(pregunta.id) ?? null;
  const total = challenge.questions.length;
  const avance = { respondidas: estado.respondidas.size, total, fraccion: total === 0 ? 0 : Math.min(1, estado.respondidas.size / total) };
  const barra = crearBarraProgreso(avance, estado.avanceMostrado);
  estado.avanceMostrado = avance.fraccion;
  estado.salir = crearSalir();
  const nodo = h(
    'div', { 'data-testid': 'vista-reto-flujo', 'data-modo': 'por-pregunta', class: `juego juego-${entrada}${respuesta ? ' con-banda' : ''}` },
    estado.encabezado = crearCabecera({ piezas: [estado.salir, h('h1', { class: 'titulo-reto' }, tituloLegible(challenge.title))], sonido: true }),
    barra,
    estado.esRepaso ? h('p', { role: 'status', class: 'aviso-corto', 'data-testid': 'banner-repaso' }, textos.retoFlujo.bannerRepaso) : null,
    h('div', { class: 'presenta-pregunta' },
      crearDrako('presenta', textos.retoFlujo.drakoPresenta, { estatico: true }),
      h('p', { class: 'texto-apoyo', 'data-testid': 'contador-pregunta' }, textos.retoFlujo.pregunta(indice + 1, total))),
    h('p', { class: 'enunciado', 'data-testid': 'enunciado' }, pregunta.question_text),
    opcionesDe(raiz, estado, pregunta, respuesta),
    respuesta ? barraRespondida(raiz, estado, pregunta, respuesta) : barraComprobar(raiz, estado, pregunta, recien),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}

/** Un toque de Comprobar = una petición (un segundo toque recibe la misma); la banda sale con lo que el servidor guardó. */
async function comprobar(raiz, estado, pregunta, boton) {
  const label = estado.elegidas[pregunta.id];
  if (!label) return;
  boton.disabled = true; marcarCargando(boton, true); boton.textContent = T.comprobando;
  try {
    const r = await estado.comprobar(pregunta.id, textoDeOpcion(pregunta, label)); // la label que guardó nodoOpciones (valorAlGuardar), nunca el texto
    estado.error = null;
    estado.respondidas.set(pregunta.id, r);
    senal(r.is_correct ? 'acierto' : 'fallo');
    pintar(raiz, estado, 'quieta');
  } catch (e) {
    console.warn('reto_l1: no se pudo comprobar', e);
    if (e instanceof ErrorApi && [404, 409].includes(e.status)) { pintarErrorFlujo(raiz, e.mensaje); return; }
    estado.error = T.noSePudo; // sin red o un 500: se puede volver a tocar Comprobar
    pintar(raiz, estado, 'quieta');
  }
}

function siguiente(raiz, estado) {
  estado.indice = Math.min(estado.indice + 1, estado.challenge.questions.length - 1);
  pintar(raiz, estado);
}

/** "Ver resultado": `/finish` una vez y la revisión de siempre, con lo que el servidor guardó. */
async function terminar(raiz, estado, boton) {
  estado.salir?.remove(); // mientras se cierra el intento no se ofrece salir
  boton.disabled = true; marcarCargando(boton, true); boton.textContent = T.enviando;
  raiz.querySelector('.barra-accion')?.before(nodoRevisando());
  try {
    const resultado = await estado.terminar();
    const respuestasDadas = Object.fromEntries([...estado.respondidas].map(([qid, r]) => [qid, r.answer]));
    renderRevision(raiz, { challenge: estado.challenge, resultado, respuestasDadas, rol: estado.rol, esRepaso: estado.esRepaso, historialPrevio: estado.historialPrevio });
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 409) { if (estado.salir) estado.encabezado?.prepend(estado.salir); return; } // ya estaba cerrado: nunca se cobra dos veces
    console.warn('reto_l1: no se pudo cerrar el intento', e);
    pintarErrorFlujo(raiz, e instanceof ErrorApi ? e.mensaje : 'No se pudo enviar tu reto.');
  }
}
