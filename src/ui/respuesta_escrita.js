// @ts-check
// ui/respuesta_escrita.js · W91 (docs/ESPEC_camino_y_tu_palabra.md §2): el campo para ESCRIBIR la respuesta de una pregunta `fill_blank` (los retos
// "Escríbela", `tu_palabra` del banco). Módulo DIFERIDO: lo importa reto_l1.js. Reglas:
//   - escribir NO repinta la pantalla (no se pierde el foco ni el teclado del teléfono): solo avisa a quien lo usa (`alCambiar`);
//   - Enter = Comprobar (`alEnviar`); el texto viaja tal cual: el servidor normaliza y califica, la web no;
//   - ya respondida: solo lectura, con lo que GUARDÓ el servidor y su marca con ícono y palabra (nunca solo color).
import { h } from './dom.js';
import { crearIcono } from './iconos.js';
import { textos } from '../textos.js';
import { textosPractica } from '../textos_practica.js';

/**
 * @param {{id: string, valor?: string, respuesta?: {answer: string, is_correct: boolean}|null, alCambiar?: (texto: string) => void,
 *   alEnviar?: () => void}} o
 */
export function crearCampoEscrito({ id, valor = '', respuesta = null, alCambiar, alEnviar }) {
  const T = textosPractica.l1;
  const idCampo = `escrito-${id}`;
  const entrada = /** @type {HTMLInputElement} */ (h('input', {
    id: idCampo, type: 'text', class: 'sx-entrada campo-escrito', 'data-testid': 'campo-escrito', autocomplete: 'off', autocapitalize: 'off',
    autocorrect: 'off', spellcheck: 'false', maxlength: 200, enterkeyhint: 'done', lang: 'en', placeholder: T.escribePlaceholder,
    readonly: Boolean(respuesta),
  }));
  entrada.value = respuesta ? respuesta.answer : valor;
  if (!respuesta) {
    entrada.addEventListener('input', () => alCambiar?.(entrada.value));
    entrada.addEventListener('keydown', (ev) => {
      if (/** @type {KeyboardEvent} */ (ev).key === 'Enter') { ev.preventDefault(); alEnviar?.(); }
    });
  }
  const marca = respuesta
    ? h('span', { class: 'opcion-estado', 'data-testid': 'campo-escrito-marca' }, crearIcono(respuesta.is_correct ? 'visto' : 'equis'),
      respuesta.is_correct ? textos.revision.correcta : T.tuRespuesta)
    : null;
  const clase = respuesta ? (respuesta.is_correct ? ' es-correcta' : ' es-incorrecta') : '';
  const nodo = h('div', { class: `sx-campo respuesta-escrita${clase}`, 'data-testid': 'respuesta-escrita' },
    h('label', { class: 'sx-campo__rotulo', for: idCampo }, T.campoRotulo),
    h('div', { class: 'respuesta-escrita__fila' }, entrada, marca));
  return { nodo, entrada };
}

/** ¿Hay algo escrito que no sea solo espacios? Pura. @param {unknown} texto */
export const hayTexto = (texto) => typeof texto === 'string' && texto.trim().length > 0;
