// @ts-check
// ui/panel_resultado.js · El panel que SUBE desde abajo junto al botón de acción: confirma lo que el
// estudiante hizo. Tres tipos:
//   - 'neutro'    (hoy, en la pregunta): "Elegiste B: …" — no dice si está bien, la clave no sale
//     antes de enviar (regla #3 del cliente) y la corrección pregunta a pregunta es L1/W18.
//   - 'correcto' / 'incorrecto' (listos para W18 y para la revisión): SIEMPRE ícono + texto, nunca
//     solo color ni solo sonido (regla de la casa). Drako no va aquí: presenta, no califica (010).
import { h } from './dom.js';
import { textos } from '../textos.js';

/**
 * Pura, sin DOM: qué se pinta para cada tipo. Un veredicto sin texto cae en la palabra por defecto:
 * nunca queda un panel de "correcto/incorrecto" sin ícono o sin palabras.
 * @param {{tipo: 'neutro'|'correcto'|'incorrecto', texto?: string}} datos
 */
export function contenidoDelPanel(datos) {
  const porDefecto = { correcto: textos.revision.correcta, incorrecto: textos.revision.incorrecta, neutro: '' };
  const icono = { correcto: '✓', incorrecto: '✗', neutro: '✓' }[datos.tipo];
  return { icono, texto: datos.texto || porDefecto[datos.tipo], clase: `panel-resultado panel-${datos.tipo}` };
}

/**
 * @param {{tipo: 'neutro'|'correcto'|'incorrecto', texto?: string, detalle?: string, visible?: boolean,
 *   sube?: boolean, testid?: string}} datos `sube`: se anima la subida (solo la primera vez que aparece)
 */
export function crearPanelResultado(datos) {
  const c = contenidoDelPanel(datos);
  const clases = [c.clase, datos.visible ? 'panel-visible' : 'panel-oculto', datos.visible && datos.sube ? 'panel-sube' : ''].filter(Boolean).join(' ');
  return h(
    'div', { class: clases, role: 'status', 'aria-live': 'polite', 'data-testid': datos.testid || 'panel-resultado' },
    h('span', { class: 'panel-icono', 'aria-hidden': 'true' }, c.icono),
    h('div', { class: 'panel-texto' },
      h('p', { class: 'panel-titulo' }, c.texto),
      datos.detalle ? h('p', { class: 'panel-detalle' }, datos.detalle) : null),
  );
}
