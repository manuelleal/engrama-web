// @ts-check
// ui/estados.js · Estados de carga y vacíos CON personalidad (Lingo: spinner de Bootstrap y un
// `store-empty-state` con emoji, student.html:2403, 1587): aquí, esqueletos con un brillo que pasa y
// Drako en "espera". Siempre con texto (nunca solo el esqueleto) y como región `role=status`.
import { h } from './dom.js';
import { crearDrako } from './drako.js';
import { textos } from '../textos.js';

/**
 * @param {string} texto lo que se está cargando ("Cargando tu perfil…")
 * @param {number} [filas] cuántas barras de esqueleto
 */
export function crearCargando(texto, filas = 3) {
  const barras = Array.from({ length: filas }, (_, i) => h('div', { class: `esqueleto esqueleto-${i % 3}` }));
  return h(
    'div', { class: 'estado-carga', role: 'status', 'data-testid': 'cargando' },
    h('div', { class: 'estado-cabecera' }, crearDrako('espera', textos.estados.drakoEspera), h('p', { class: 'estado-texto' }, texto)),
    h('div', { class: 'esqueletos', 'aria-hidden': 'true' }, ...barras),
  );
}

/**
 * @param {{texto: string, titulo?: string, testid?: string}} d
 */
export function crearVacio(d) {
  return h(
    'div', { class: 'estado-vacio', role: 'status', 'data-testid': d.testid || 'vacio' },
    crearDrako('espera', textos.estados.drakoEspera),
    d.titulo ? h('p', { class: 'estado-titulo' }, d.titulo) : null,
    h('p', { class: 'estado-texto' }, d.texto),
  );
}
