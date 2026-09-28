// @ts-check
// ui/retro.js · El resultado de una acción, SIEMPRE con ícono y texto — nunca solo con color
// (§5: "correcto e incorrecto con ícono y texto (✓ Correcta / ✗ Esta vez no), nunca solo con
// color"). `aria-live="polite"` para que un lector de pantalla lo anuncie (§9.4). Lo usa
// Asistencia (W8) y el flujo de retos (W9); el ícono va con `aria-hidden` porque el texto ya
// dice lo mismo con palabras.
import { h } from './dom.js';

/**
 * @param {{ok: boolean, texto: string, testid?: string}} datos
 */
export function crearResultado(datos) {
  return h(
    'p',
    {
      role: 'status', 'aria-live': 'polite', 'data-testid': datos.testid || 'resultado',
      class: datos.ok ? 'resultado resultado-ok' : 'resultado resultado-mal',
    },
    h('span', { 'aria-hidden': 'true' }, datos.ok ? '✓' : '✗'),
    ` ${datos.texto}`,
  );
}
