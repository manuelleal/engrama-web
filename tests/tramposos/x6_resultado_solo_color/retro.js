// TRAMPOSO X6 — versión rota a propósito: el resultado queda solo con la clase de color, sin
// ícono ni texto. Debe quedar en rojo en U7.
// @ts-check
import { h } from './dom.js';

export function contenidoDelResultado(datos) {
  return { icono: '', texto: '', clase: datos.ok ? 'resultado resultado-ok' : 'resultado resultado-mal' }; // <- el error
}

export function crearResultado(datos) {
  const c = contenidoDelResultado(datos);
  return h(
    'p',
    { role: 'status', 'aria-live': 'polite', 'data-testid': datos.testid || 'resultado', class: c.clase },
    h('span', { 'aria-hidden': 'true' }, c.icono),
    ` ${c.texto}`,
  );
}
