// @ts-check
// ui/toque.js · Cada botón principal del estudiante responde AL INSTANTE: un toque de sonido y una
// vibración corta (con el interruptor de ui/sonido.js), en el `pointerdown`, no en el clic, para que
// se sienta pegado al dedo. Un solo oyente para toda la app; no toca el panel del profe (solo actúa
// dentro de `.juego`). Las opciones de respuesta y el botón de silencio ya dan su propia señal.
import { senal } from './sonido.js';

/**
 * ¿Este elemento debe dar el toque? Pura sobre un descriptor, para probarla sin DOM.
 * @param {{enJuego: boolean, esBoton: boolean, deshabilitado: boolean, esOpcion: boolean, esSilencio: boolean}} e
 */
export function debeDarToque(e) {
  return e.enJuego && e.esBoton && !e.deshabilitado && !e.esOpcion && !e.esSilencio;
}

export function instalarToque() {
  globalThis.document?.addEventListener('pointerdown', (ev) => {
    const el = /** @type {Element|null} */ (ev.target instanceof Element ? ev.target.closest('button') : null);
    if (!el) return;
    const testid = el.getAttribute('data-testid') || '';
    const dar = debeDarToque({
      enJuego: Boolean(el.closest('.juego')), esBoton: true, deshabilitado: /** @type {HTMLButtonElement} */ (el).disabled,
      esOpcion: testid.startsWith('opcion-'), esSilencio: testid === 'boton-sonido',
    });
    if (dar) senal('toque');
  }, true);
}
