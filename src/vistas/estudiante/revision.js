// @ts-check
// vistas/estudiante/revision.js · W9: revisión al final, con la correcta de cada pregunta
// (hito 1 — la explicación por pregunta es L1/W18, hito 2, todavía no existe). Drako presenta
// arriba de todo; NUNCA dentro del bloque de resultado de una pregunta (010, X11: "Drako
// presenta y nunca califica" — un Drako ahí adentro sería la mascota calificando al estudiante).
import { h, montar } from '../../ui/dom.js';
import { crearResultado } from '../../ui/retro.js';
import { crearBotonSonido } from '../../ui/boton_sonido.js';
import { nivelDeCelebracion, crearHeroResultado, celebrarFinDeReto } from '../../ui/celebracion.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { textos } from '../../textos.js';

/** Texto legible de una opción por su label ("A" -> su `value`); si no hay opciones, la label tal cual. */
export function textoDeOpcion(pregunta, label) {
  const opcion = (pregunta.options_json || []).find((o) => o.label === label);
  return opcion ? opcion.value : label;
}

/** ¿La pregunta `pregunta.id` se respondió bien? Pura: compara lo dado contra `correct_answers`. */
export function acertoPregunta(preguntaId, respuestasDadas, correctAnswers) {
  const correcta = correctAnswers.find((c) => c.question_id === preguntaId)?.correct_answer;
  return respuestasDadas[preguntaId] === correcta;
}

function filaDeRevision(pregunta, respuestasDadas, correctAnswers, i) {
  const acerto = acertoPregunta(pregunta.id, respuestasDadas, correctAnswers);
  const correcta = correctAnswers.find((c) => c.question_id === pregunta.id)?.correct_answer;
  // Las filas entran una tras otra; la correcta rebota y la que no, tiembla apenas (corto, suave,
  // siempre con ícono y texto — juego.css). El orden y el retraso son de lectura, no de tiempo del estudiante.
  const fila = h(
    'li', { class: `tarjeta fila-revision ${acerto ? 'revision-ok' : 'revision-mal'}`, 'data-testid': `revision-${pregunta.id}` },
    h('p', { class: 'fila-titulo' }, pregunta.question_text),
    crearResultado({ ok: acerto, texto: acerto ? textos.revision.correcta : textos.revision.incorrecta, testid: `revision-${pregunta.id}-resultado` }),
    h('p', { 'data-testid': `revision-${pregunta.id}-correcta` }, textos.revision.laCorrectaEra(textoDeOpcion(pregunta, correcta))),
  );
  fila.style.setProperty('--i', String(i));
  return fila;
}

/**
 * @param {HTMLElement} raiz
 * @param {{challenge: object, resultado: object, respuestasDadas: Record<string,string>}} datos
 */
export function renderRevision(raiz, datos) {
  const { challenge, resultado, respuestasDadas } = datos;
  const filas = challenge.questions.map((q, i) => filaDeRevision(q, respuestasDadas, resultado.correct_answers, i));
  const aciertos = challenge.questions.filter((q) => acertoPregunta(q.id, respuestasDadas, resultado.correct_answers)).length;
  const total = challenge.questions.length;
  const monedas = resultado.coins_earned;
  const nivel = nivelDeCelebracion(aciertos, total);
  const hero = crearHeroResultado({ nivel, aciertos, total, monedas });
  // El texto de las monedas es el del servidor, tal cual (un repaso NUNCA muestra "+N"). Con monedas, la
  // medalla animada del hero es lo que se ve; este aviso queda para lectores de pantalla.
  const banner = h(
    'p', { role: 'status', class: monedas > 0 ? 'solo-lectores' : 'aviso-corto', 'data-testid': 'revision-monedas' },
    monedas > 0 ? textos.revision.gananciaMonedas(monedas) : textos.revision.sinGanancia,
  );
  const volver = h('a', { href: '#/retos', 'data-testid': 'revision-volver' }, textos.revision.volver);
  const nodo = h(
    'div', { 'data-testid': 'vista-revision', class: 'juego' },
    h('div', { class: 'barra-rol' }, crearBotonSonido()),
    hero.nodo,
    banner,
    h('h2', { class: 'subtitulo-revision' }, textos.revision.titulo),
    h('ul', {}, ...filas),
    volver,
    crearNavInferior('retos'),
  );
  montar(raiz, nodo);
  // La línea de tiempo del fin de reto revela las filas y el botón en su momento (ui/linea_fin_reto.js).
  celebrarFinDeReto({ nivel, aciertos, total, monedas, hero, filas, boton: volver });
  document.body.dataset.listo = '1';
}
