// TRAMPOSO X11 — versión rota a propósito: Drako queda DENTRO del bloque de resultado de cada
// pregunta (calificando). Debe quedar en rojo (U10, el E2E de reto_flujo).
// @ts-check
import { h, montar } from '../../ui/dom.js';
import { crearResultado } from '../../ui/retro.js';
import { crearDrako } from '../../ui/drako.js';
import { textos } from '../../textos.js';

export function textoDeOpcion(pregunta, label) {
  const opcion = (pregunta.options_json || []).find((o) => o.label === label);
  return opcion ? opcion.value : label;
}

export function acertoPregunta(preguntaId, respuestasDadas, correctAnswers) {
  const correcta = correctAnswers.find((c) => c.question_id === preguntaId)?.correct_answer;
  return respuestasDadas[preguntaId] === correcta;
}

function filaDeRevision(pregunta, respuestasDadas, correctAnswers) {
  const acerto = acertoPregunta(pregunta.id, respuestasDadas, correctAnswers);
  const correcta = correctAnswers.find((c) => c.question_id === pregunta.id)?.correct_answer;
  return h(
    'li', { 'data-testid': `revision-${pregunta.id}` },
    h('p', {}, pregunta.question_text),
    crearResultado({ ok: acerto, texto: acerto ? textos.revision.correcta : textos.revision.incorrecta, testid: `revision-${pregunta.id}-resultado` }),
    crearDrako('celebra', 'Drako calificando'), // <- el error: Drako dentro del bloque de resultado
    h('p', { 'data-testid': `revision-${pregunta.id}-correcta` }, textos.revision.laCorrectaEra(textoDeOpcion(pregunta, correcta))),
  );
}

export function renderRevision(raiz, datos) {
  const { challenge, resultado, respuestasDadas } = datos;
  const filas = challenge.questions.map((q) => filaDeRevision(q, respuestasDadas, resultado.correct_answers));
  const banner = h(
    'p', { role: 'status', 'data-testid': 'revision-monedas' },
    resultado.coins_earned > 0 ? textos.revision.gananciaMonedas(resultado.coins_earned) : textos.revision.sinGanancia,
  );
  const nodo = h(
    'div', { 'data-testid': 'vista-revision' },
    h('h1', {}, textos.revision.titulo),
    banner,
    h('ul', {}, ...filas),
    h('a', { href: '#/retos', 'data-testid': 'revision-volver' }, textos.revision.volver),
  );
  montar(raiz, nodo);
  document.body.dataset.listo = '1';
}
