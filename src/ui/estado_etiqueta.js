// @ts-check
// ui/estado_etiqueta.js · UNA sola tabla con los estados que esta espec muestra (docs/ESPEC_pantallas_anillo.md §5): cada uno con su
// ÍCONO y su TEXTO. Un estado nunca se indica solo con color (el color distingue, no informa): el ícono va con `aria-hidden` (lo que
// importa lo lee el texto, que es visible) y el texto nunca está vacío. Pura la tabla (`etiquetaDeEstado`), con DOM la etiqueta.
// Drako no aparece aquí: presenta, nunca califica (010).
import { h } from './dom.js';
import { textos } from '../textos.js';

/** El ícono de cada estado. Los glifos son de texto (sin imágenes que cargar). */
const ICONOS = {
  pendiente: '⏳',
  ya_no_esta: 'ℹ',
  suspendida: '⏸',
  inscripcion_aprobada: '✓',
  inscripcion_rechazada: '✗',
  nivel_confirmado: '✓',
  nivel_provisional: '⏳',
  solicitud_abierta: '✉',
  solicitud_en_tramite: '⏳',
  solicitud_resuelta: '✓',
  solicitud_rechazada: 'ℹ', // no `✗`: ese es el de una respuesta incorrecta (dictamen 03, G5)
};

/** Los estados que existen, en el orden de la tabla. */
export const ESTADOS_CON_ETIQUETA = Object.keys(ICONOS);

/**
 * @param {string} estado una de ESTADOS_CON_ETIQUETA
 * @returns {{icono: string, texto: string}} ambos no vacíos; lanza si el estado no existe (nunca una etiqueta vacía)
 */
export function etiquetaDeEstado(estado) {
  const icono = ICONOS[estado];
  const texto = textos.etiquetasEstado?.[estado];
  if (!icono || !texto) throw new Error(`ui/estado_etiqueta: el estado "${estado}" no tiene ícono y texto`);
  return { icono, texto };
}

/** @param {string} estado @param {{testid?: string}} [opciones] */
export function crearEtiquetaEstado(estado, opciones = {}) {
  const { icono, texto } = etiquetaDeEstado(estado);
  return h(
    'span', { class: 'etiqueta-estado', 'data-estado': estado, 'data-testid': opciones.testid || `estado-${estado}` },
    h('span', { class: 'etiqueta-icono', 'aria-hidden': 'true' }, icono),
    h('span', { class: 'etiqueta-texto' }, texto),
  );
}
