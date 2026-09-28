// @ts-check
// ui/retro.js · El resultado de una acción, SIEMPRE con ícono y texto — nunca solo con color
// (§5: "correcto e incorrecto con ícono y texto (✓ Correcta / ✗ Esta vez no), nunca solo con
// color"). `aria-live="polite"` para que un lector de pantalla lo anuncie (§9.4). Lo usa
// Asistencia (W8) y el flujo de retos (W9); el ícono va con `aria-hidden` porque el texto ya
// dice lo mismo con palabras.
import { h } from './dom.js';

/**
 * Pura, sin DOM (mitad de U7: la otra mitad, que el DOM de verdad tenga ambos nodos, la
 * prueba el E2E — bajo `node --test` no hay `document`, por regla del stack).
 * @param {{ok: boolean, texto: string}} datos
 */
export function contenidoDelResultado(datos) {
  return { icono: datos.ok ? '✓' : '✗', texto: datos.texto, clase: datos.ok ? 'resultado resultado-ok' : 'resultado resultado-mal' };
}

/**
 * @param {{ok: boolean, texto: string, testid?: string}} datos
 */
export function crearResultado(datos) {
  const c = contenidoDelResultado(datos);
  return h(
    'p',
    { role: 'status', 'aria-live': 'polite', 'data-testid': datos.testid || 'resultado', class: c.clase },
    h('span', { 'aria-hidden': 'true' }, c.icono),
    ` ${c.texto}`,
  );
}
