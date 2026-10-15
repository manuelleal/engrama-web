// @ts-check
// ui/retro.js · El resultado de una acción, SIEMPRE con ícono y texto — nunca solo con color
// (§5). El ícono es un SVG de ui/iconos.js (visto / equis), `aria-hidden` porque el texto dice lo
// mismo; `aria-live="polite"` para el lector de pantalla (§9.4). Lo usan Asistencia, retos y revisión.
import { h } from './dom.js';
import { crearIcono } from './iconos.js';

/**
 * Pura, sin DOM (la otra mitad la prueba el E2E). `icono` es el NOMBRE del ícono de ui/iconos.js.
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
    h('span', { 'aria-hidden': 'true' }, c.icono), // TRAMPOSO: el glifo de texto de antes, no el SVG
    ` ${c.texto}`,
  );
}
