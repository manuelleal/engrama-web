// @ts-check
// TRAMPOSO x_provisional_solo_color: el provisional no lleva ícono ni texto de estado: se distingue solo por su borde punteado.
// ui/escudo.js · El escudo (010): nivel MCER confirmado, o "Por confirmar" (§4.1 de la espec:
// "Se reemplaza por el escudo (010): nivel MCER confirmado o 'Por confirmar'. El nivel de XP no
// se muestra"). NUNCA lee `level`, `xp` ni monedas — leerlos es justo el error de X7 (el juego
// no infla el perfil de competencia, ENGRAMA/CLAUDE.md #7). El escudo es privado: nunca se
// ordena ni se proyecta (§5), así que esta vista no acepta ningún dato de otro estudiante.
//
// W30 (docs/ESPEC_pantallas_anillo.md §4.3 y su adenda §17.2): el nivel viene de `confirmed_level` del servidor
// (`{cefr, provisional, fuente, evaluadoEn}`) y se muestra con SU FUENTE Y SU FECHA, siempre (dictamen 03, G4). Un provisional lo
// dice con ícono + texto ("⏳ Provisional") y con la ayuda de G1; un definitivo, con "✓ Confirmado". El nivel no lleva oro nuevo
// (G6: es una medida, no un premio; el escudo conserva su estilo) y no se celebra como logro de juego (G2).
import { h } from './dom.js';
import { NIVELES_MCER, nivelValido, valorDeNivel } from '../auth/interfaz.js';
import { crearEtiquetaEstado } from './estado_etiqueta.js';
import { textos } from '../textos.js';

export { NIVELES_MCER, nivelValido, valorDeNivel };

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * "2026-10-06T15:00:00Z" → "6 oct 2026", en la hora de Colombia (la app es de allá; así el día no depende del reloj del equipo). Pura.
 * @param {unknown} iso @returns {string|null} null si no es una fecha
 */
export function fechaCorta(iso) {
  const t = typeof iso === 'string' ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', day: 'numeric', month: 'numeric', year: 'numeric' })
    .formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  return `${Number(partes.day)} ${MESES[Number(partes.month) - 1]} ${partes.year}`;
}

/**
 * Pura, sin DOM (así la prueba U8 no necesita un navegador): decide el texto del escudo.
 * SOLO lee `nivelConfirmado` — nunca `level`/`xp`/monedas, por diseño de la firma misma. Acepta el objeto de la Sesion
 * (`{cefr, ...}`) o, como siempre, el nivel suelto ("B1"); algo que no es un nivel del MCER es "Por confirmar".
 * @param {{nivelConfirmado?: {cefr?: string}|string|null}} [datos]
 */
export function textoDelEscudo(datos) {
  const nivel = datos?.nivelConfirmado;
  const cefr = typeof nivel === 'string' ? nivel : nivel?.cefr;
  return nivelValido(cefr) ? /** @type {string} */ (cefr) : textos.escudo.porConfirmar;
}

/**
 * Lo que se dice DEBAJO del escudo (U15). Pura. `null` si no hay nivel confirmado ("Por confirmar" no dice nada más).
 * @param {{cefr: string, provisional: boolean, fuente?: string|null, evaluadoEn?: string|null}|null|undefined} nivel
 * @returns {{estado: 'nivel_confirmado'|'nivel_provisional', linea: string, ayuda: string|null, aria: string}|null}
 */
export function detalleDelNivel(nivel) {
  if (!nivel || !nivelValido(nivel.cefr)) return null;
  const fuente = (nivel.fuente && /** @type {Record<string, string>} */ (textos.escudo.fuente)[nivel.fuente]) || null;
  const fecha = fechaCorta(nivel.evaluadoEn);
  const linea = fecha ? textos.escudo.fuenteYFecha(fuente, fecha) : (fuente || '');
  const ayuda = nivel.provisional ? textos.escudo.provisionalAyuda : null;
  return {
    estado: nivel.provisional ? 'nivel_provisional' : 'nivel_confirmado', linea, ayuda,
    aria: textos.escudo.aria(nivel.cefr, nivel.provisional, ayuda ?? linea),
  };
}

/**
 * @param {{nivelConfirmado?: {cefr: string, provisional: boolean, fuente?: string|null, evaluadoEn?: string|null}|string|null, animar?: boolean}} [datos]
 *   `animar`: la animación sobria de "llegó tu nivel" (decide inicio.js con ui/ultimo_visto.js; nunca con un provisional ni si el nivel bajó)
 */
export function crearEscudo(datos) {
  const texto = textoDelEscudo(datos);
  const nivel = typeof datos?.nivelConfirmado === 'object' ? datos?.nivelConfirmado : null;
  const detalle = detalleDelNivel(nivel);
  // `escudo-brillo`: un destello que cruza al aparecer (juego.css).
  if (!nivel || !detalle) {
    return h('div', { class: 'escudo escudo-brillo', 'data-testid': 'escudo', role: 'img', 'aria-label': textos.escudo.ariaPorConfirmar }, texto);
  }
  const clases = ['escudo', 'escudo-brillo', nivel.provisional ? 'escudo-provisional' : null, datos?.animar ? 'escudo-sube' : null].filter(Boolean).join(' ');
  return h(
    'div', { class: 'escudo-nivel', 'data-testid': 'escudo-nivel' },
    h('div', { class: clases, 'data-testid': 'escudo', role: 'img', 'aria-label': detalle.aria }, texto),
    nivel.provisional ? null : h('p', { class: 'escudo-etiqueta', 'data-testid': 'escudo-etiqueta' }, crearEtiquetaEstado(detalle.estado)), // el error: el provisional se distingue solo por su borde
    detalle.linea ? h('p', { class: 'texto-apoyo', 'data-testid': 'escudo-fuente' }, detalle.linea) : null,
    detalle.ayuda ? h('p', { 'data-testid': 'escudo-ayuda' }, detalle.ayuda) : null,
  );
}
