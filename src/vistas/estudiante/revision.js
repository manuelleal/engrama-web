// @ts-check
// vistas/estudiante/revision.js · W9: revisión al final, con la correcta de cada pregunta
// (hito 1 — la explicación por pregunta es L1/W18, hito 2, todavía no existe). Drako presenta
// arriba de todo; NUNCA dentro del bloque de resultado de una pregunta (010, X11: "Drako
// presenta y nunca califica" — un Drako ahí adentro sería la mascota calificando al estudiante).
import { h, montar } from '../../ui/dom.js';
import { crearResultado } from '../../ui/retro.js';
import { crearDrako } from '../../ui/drako.js';
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

function filaDeRevision(pregunta, respuestasDadas, correctAnswers) {
  const acerto = acertoPregunta(pregunta.id, respuestasDadas, correctAnswers);
  const correcta = correctAnswers.find((c) => c.question_id === pregunta.id)?.correct_answer;
  return h(
    'li', { class: 'tarjeta', 'data-testid': `revision-${pregunta.id}` },
    h('p', { class: 'fila-titulo' }, pregunta.question_text),
    crearResultado({ ok: acerto, texto: acerto ? textos.revision.correcta : textos.revision.incorrecta, testid: `revision-${pregunta.id}-resultado` }),
    h('p', { 'data-testid': `revision-${pregunta.id}-correcta` }, textos.revision.laCorrectaEra(textoDeOpcion(pregunta, correcta))),
  );
}

/**
 * @param {HTMLElement} raiz
 * @param {{challenge: object, resultado: object, respuestasDadas: Record<string,string>}} datos
 */
export function renderRevision(raiz, datos) {
  const { challenge, resultado, respuestasDadas } = datos;
  const filas = challenge.questions.map((q) => filaDeRevision(q, respuestasDadas, resultado.correct_answers));
  const banner = h(
    'p', { role: 'status', class: 'aviso-corto', 'data-testid': 'revision-monedas' },
    resultado.coins_earned > 0 ? textos.revision.gananciaMonedas(resultado.coins_earned) : textos.revision.sinGanancia,
  );
  const nodo = h(
    'div', { 'data-testid': 'vista-revision' },
    h('div', { class: 'encabezado-reto' },
      crearDrako('celebra', textos.revision.drakoCelebra),
      h('h1', {}, textos.revision.titulo)),
    banner,
    h('ul', {}, ...filas),
    h('a', { href: '#/retos', 'data-testid': 'revision-volver' }, textos.revision.volver),
    crearNavInferior('retos'),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}
