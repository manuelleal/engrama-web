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
import { h, montar, texto as nodoDeTexto } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { textosPractica } from '../../textos_practica.js';
import { crearDrako } from '../../ui/drako.js';
import { tituloLegible } from '../../ui/titulo.js';
import { crearCabecera } from '../../ui/cabecera.js';
import { crearBarraProgreso, senalDeSeleccion } from '../../ui/progreso.js';
import { crearPanelResultado } from '../../ui/panel_resultado.js';
import { crearIcono } from '../../ui/iconos.js';
import { marcarCargando } from '../../ui/boton.js';
import { senal } from '../../ui/sonido.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { retomarIntento, responderPregunta, terminarIntento, ErrorTransitorio } from '../../api/practica.js';
import { planDeExplicacion, crearBanda } from '../../ui/explicacion.js';
import { preguntaContestable } from '../../ui/practica.js';
import { crearLectura } from '../../ui/lectura.js';
import { despejarBanda } from '../../ui/despejar_banda.js';
import { renderRevision, textoDeOpcion } from './revision.js';
import { retitularFranja, aciertosDe, crearChipAciertos, celebrarAcierto } from '../../ui/fluidez.js';
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
 * Intenta jugar el reto pregunta por pregunta. Devuelve false (sin pintar nada) si este backend no tiene `GET …/answers` (404, 405, 422) o lo manda
 * mal formado: el reto se juega como antes. H-1: si la red o el servidor fallan (ya con un reintento), NO es "backend viejo": pinta el error con
 * "Reintentar" y "✕ Salir" y devuelve true (lo respondido sigue en el servidor; nunca se juega con /submit por un corte).
 * @param {HTMLElement} raiz
 * @param {{attemptId: string, challenge: any, esRepaso: boolean, historialPrevio: unknown, ctx: any, lectura?: Function}} datos
 */
export async function intentarL1(raiz, datos) {
  // W84: el texto de un reto de Lectura también en el flujo de siempre (backend sin L1): reto_flujo.js lo pinta con esto, sin cargar nada más.
  datos.lectura = crearLectura;
  let retomado;
  try {
    retomado = await retomarIntento(datos.attemptId, datos.ctx);
  } catch (e) {
    if (!(e instanceof ErrorTransitorio)) throw e;
    console.warn('reto_l1: no se pudo leer el intento', e);
    pintarSinConexion(raiz, datos);
    return true;
  }
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

/**
 * H-1: el intento no se pudo leer (sin red o el servidor falló dos veces). "Reintentar" (un toque = un intento) lo vuelve a leer y, si responde, sigue
 * pregunta por pregunta donde iba; si el backend dijera que no tiene la ruta, un error con su salida (no hay flujo viejo desde aquí).
 */
function pintarSinConexion(raiz, datos) {
  const reintentar = h('button', {
    type: 'button', class: 'sx-btn sx-btn--ancho', 'data-testid': 'reto-reintentar',
    onClick: () => {
      reintentar.disabled = true; marcarCargando(reintentar, true);
      intentarL1(raiz, datos).then((ok) => { if (!ok) pintarErrorFlujo(raiz, T.noSePudoAbrir); }).catch((e) => {
        console.warn('reto_l1: el reintento falló', e);
        pintarErrorFlujo(raiz, T.noSePudoAbrir);
      });
    },
  }, T.reintentar);
  montar(raiz, h('div', { 'data-testid': 'vista-reto-flujo', class: 'juego' },
    crearSalir(), h('p', { role: 'alert', 'data-testid': 'reto-sin-conexion' }, T.sinConexion), reintentar));
  document.body.dataset.listo = '1';
}

/** Deja quietas las opciones de una lista (ya respondida, o con "Comprobar" en vuelo). @param {any} lista */
function quietas(lista) {
  for (const li of lista?.children ?? []) { const b = /** @type {any} */ (li).children?.[0]; if (b) b.disabled = true; }
}

/**
 * Tanda visual 2 (compuerta 18, hallazgo 3): ya comprobada, las opciones dicen el resultado con ícono y palabra (nunca solo color): la correcta,
 * "Correcta"; la tuya, si falló, "Tu respuesta". Todo sale de lo que el servidor ya devolvió al comprobar (`is_correct`, `answer`, `correct_answer`):
 * la web no califica. Sin `correct_answer`, solo se marca la tuya. @param {any} lista @param {any} r
 */
function marcarResultado(lista, r) {
  const correcta = r.is_correct ? r.answer : r.correct_answer;
  for (const li of lista?.children ?? []) {
    const b = li.children?.[0];
    const label = String(b?.getAttribute?.('data-testid') ?? '').slice('opcion-'.length);
    const ok = label === correcta;
    if (!b || !(ok || label === r.answer)) continue;
    b.className = `${b.className || ''} ${ok ? 'es-correcta' : 'es-incorrecta'}`.trim();
    b.appendChild(h('span', { class: 'opcion-estado' }, crearIcono(ok ? 'visto' : 'equis'), ok ? textos.revision.correcta : T.tuRespuesta));
  }
}

/** Las opciones de la pregunta; ya respondida, quietas (la que quedó guardada, marcada con el resultado). */
function opcionesDe(raiz, estado, pregunta, respuesta) {
  const elegida = respuesta ? respuesta.answer : estado.elegidas[pregunta.id];
  const alElegir = (/** @type {string} */ label) => {
    if (respuesta || estado.enVuelo) return; // H-6: con "Comprobar" en vuelo no se reelige (ni repinta ni suena)
    estado.elegidas[pregunta.id] = label;
    senal(senalDeSeleccion()); // neutra: elegir no dice nada de la clave
    pintar(raiz, estado, 'quieta', label);
  };
  const lista = nodoOpciones(pregunta, { [pregunta.id]: elegida }, alElegir, null);
  if (respuesta) { quietas(lista); marcarResultado(lista, respuesta); }
  estado.opciones = lista;
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

/** El botón que sigue: "Siguiente" o, en la última, "Ver resultado". */
function botonQueSigue(raiz, estado) {
  const ultima = estado.indice === estado.challenge.questions.length - 1;
  const boton = h('button', {
    'data-testid': ultima ? 'boton-terminar' : 'boton-siguiente', class: 'boton-principal',
    onClick: () => (ultima ? terminar(raiz, estado, boton) : siguiente(raiz, estado)),
  }, ultima ? T.verResultado : T.siguiente);
  return boton;
}

/**
 * H-3: una pregunta que la web todavía no sabe contestar (no es de opción múltiple, o llegó sin opciones): lo dice, sin un "Comprobar" muerto, y deja
 * seguir. Al cerrar, lo no respondido el servidor lo cuenta como no acertado (como siempre con /finish). La salida ("✕ Salir") sigue arriba.
 */
function barraNoContestable(raiz, estado) {
  return h('div', { class: 'barra-accion' },
    h('section', { class: 'sx-vacio', role: 'status', 'data-testid': 'pregunta-no-contestable' },
      h('p', { class: 'sx-t-tarjeta' }, T.noContestable), h('p', { class: 'sx-t-apoyo' }, T.noContestableApoyo)),
    botonQueSigue(raiz, estado));
}

/** Ya respondida: la banda con el veredicto y la explicación, y el botón que sigue dentro de ella. */
function barraRespondida(raiz, estado, pregunta, respuesta) {
  const boton = botonQueSigue(raiz, estado);
  const elegida = estado.elegidas[pregunta.id];
  const nota = elegida && elegida !== respuesta.answer ? T.quedoGuardada(respuesta.answer, textoDeOpcion(pregunta, respuesta.answer)) : null;
  return h('div', { class: 'barra-accion con-banda' }, crearBanda(planDeExplicacion(respuesta, { opciones: pregunta.options_json, skill: estado.challenge.skill }), { accion: boton, nota }));
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
    h('div', { class: 'fila-avance' }, barra, crearChipAciertos(aciertosDe(estado.respondidas))), // la barra y el chip de aciertos
    estado.esRepaso ? h('p', { role: 'status', class: 'aviso-corto', 'data-testid': 'banner-repaso' }, textos.retoFlujo.bannerRepaso) : null,
    crearLectura(challenge), // W84: el texto de un reto de Lectura, arriba de la afirmación (null si no es de Lectura)
    h('div', { class: 'presenta-pregunta' },
      crearDrako('presenta', textos.retoFlujo.drakoPresenta, { estatico: true }),
      h('p', { class: 'texto-apoyo', 'data-testid': 'contador-pregunta' }, textos.retoFlujo.pregunta(indice + 1, total))),
    h('p', { class: 'enunciado', 'data-testid': 'enunciado' }, pregunta.question_text),
    ...(respuesta || preguntaContestable(pregunta) ? [opcionesDe(raiz, estado, pregunta, respuesta),
      respuesta ? barraRespondida(raiz, estado, pregunta, respuesta) : barraComprobar(raiz, estado, pregunta, recien)] : [barraNoContestable(raiz, estado)]),
  );
  montar(raiz, nodo);
  // Sprint de la magia (docs/ESPEC_avatar_fluidez.md §1): la franja dice "¡Bien hecho!" o "La correcta: …", con el mismo ícono de siempre.
  if (respuesta) retitularFranja(nodo, respuesta, respuesta.correct_answer ? textoDeOpcion(pregunta, respuesta.correct_answer) : null);
  document.body.dataset.listo = '1';
  // Adenda 1 de ESPEC_visual_reto_tanda2: con la banda puesta, la app deja ver juntos el enunciado, lo marcado y la banda (un cuadro después: ya con su alto).
  if (respuesta) globalThis.requestAnimationFrame?.(() => despejarBanda(nodo));
}

/** Un toque de Comprobar = una petición (un segundo toque recibe la misma); la banda sale con lo que el servidor guardó. */
async function comprobar(raiz, estado, pregunta, boton) {
  const label = estado.elegidas[pregunta.id];
  if (!label) return;
  boton.disabled = true; marcarCargando(boton, true); boton.textContent = T.comprobando;
  estado.enVuelo = true; quietas(estado.opciones); // H-6: mientras vuela, la que se ve elegida es la que se envía
  try {
    const r = await estado.comprobar(pregunta.id, textoDeOpcion(pregunta, label)); // la label que guardó nodoOpciones (valorAlGuardar), nunca el texto
    estado.enVuelo = false;
    estado.error = null;
    estado.respondidas.set(pregunta.id, r);
    senal(r.is_correct ? 'acierto' : 'fallo');
    pintar(raiz, estado, 'quieta');
    if (r.is_correct) celebrarAcierto(raiz, { esRepaso: estado.esRepaso }); // solo recién comprobada: al retomar no se celebra de nuevo
  } catch (e) {
    estado.enVuelo = false;
    console.warn('reto_l1: no se pudo comprobar', e);
    if (e instanceof ErrorApi && e.status === 409) { avisoDeCierre(raiz, estado); return; } // H-2: el intento ya no admite respuestas
    if (e instanceof ErrorApi && e.status === 404) { avisoDeCierre(raiz, estado, T.noDisponible); return; }
    estado.error = T.noSePudo; // sin red o un 500: se puede volver a tocar Comprobar
    pintar(raiz, estado, 'quieta');
  }
}

/**
 * H-2 (docs/ESPEC_correcciones_practica.md): el servidor ya no admite nada en este intento (409; o 404 en una pregunta). Se repinta la pantalla al
 * instante (fuera "Enviando…" y Drako pensando), se relee el intento para decir lo justo y queda un aviso neutro con "Volver a Retos" (la acción del
 * aviso, como el botón final de la revisión) además de "✕ Salir". Nunca el texto del servidor: viene en inglés ("Attempt already completed…").
 * @param {string|null} [fijo] el texto, si no hace falta releer
 */
function avisoDeCierre(raiz, estado, fijo = null) {
  const parrafo = h('p', { class: 'sx-t-tarjeta', 'data-testid': 'reto-aviso-texto' }, fijo ?? T.noSeCerro);
  montar(raiz, h('div', { 'data-testid': 'vista-reto-flujo', class: 'juego' }, crearSalir(),
    h('section', { class: 'sx-vacio', role: 'status', 'data-testid': 'reto-aviso' }, parrafo,
      h('a', { href: '#/retos', class: 'sx-btn sx-btn--ancho', 'data-testid': 'reto-aviso-a-retos' }, T.aRetos))));
  document.body.dataset.listo = '1';
  if (fijo) return;
  retomarIntento(estado.attemptId, estado.ctx).then((leido) => { if (leido && leido.status !== 'in_progress') montar(parrafo, nodoDeTexto(T.yaCerrado)); })
    .catch((e) => console.warn('reto_l1: no se pudo releer el intento', e)); // queda "no se pudo cerrar ahora": lo respondido sigue guardado
}

function siguiente(raiz, estado) {
  estado.indice = Math.min(estado.indice + 1, estado.challenge.questions.length - 1);
  pintar(raiz, estado);
  globalThis.scrollTo?.(0, 0); // la pregunta nueva abre arriba, no donde la app dejó la anterior para ver su banda
}

/** "Ver resultado": `/finish` una vez y la revisión de siempre, con lo que el servidor guardó. */
async function terminar(raiz, estado, boton) {
  estado.salir?.remove(); // mientras se cierra el intento no se ofrece salir
  boton.disabled = true; marcarCargando(boton, true); boton.textContent = T.enviando;
  raiz.querySelector('.barra-accion')?.before(nodoRevisando());
  try {
    const resultado = await estado.terminar();
    const respuestasDadas = Object.fromEntries([...estado.respondidas].map(([qid, r]) => [qid, r.answer]));
    renderRevision(raiz, { challenge: estado.challenge, resultado, respuestasDadas, rol: estado.rol, esRepaso: estado.esRepaso, historialPrevio: estado.historialPrevio,
      lectura: crearLectura(estado.challenge, true) });
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 409) { avisoDeCierre(raiz, estado); return; } // H-2: ya estaba cerrado (nunca se cobra dos veces)
    console.warn('reto_l1: no se pudo cerrar el intento', e);
    pintarErrorFlujo(raiz, e instanceof ErrorApi ? e.mensaje : T.noSeEnvio);
  }
}
