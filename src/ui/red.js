// @ts-check
// ui/red.js · Estado de conectividad y el banner "Sin conexión" (§7.3, X9/E7-E8).
// `navigator.onLine` es una señal del sistema operativo, no de si la API responde: por eso el
// banner dice "sin conexión" (verdad sobre el enlace), y son las vistas las que deshabilitan sus
// botones con su propio mensaje cuando una petición concreta falla (§7.2, "una sola acción por
// toque" ya cubre el bloqueo; W16 conecta esto con cada pantalla).
import { h } from './dom.js';
import { textos } from '../textos.js';

/**
 * Se suscribe a los cambios de conectividad y llama `cb` de inmediato con el estado actual.
 * @param {(enLinea: boolean) => void} cb
 * @returns {() => void} para cancelar la suscripción
 */
export function suscribirRed(cb) {
  const alCambiar = () => cb(navigator.onLine);
  window.addEventListener('online', alCambiar);
  window.addEventListener('offline', alCambiar);
  cb(navigator.onLine);
  return () => {
    window.removeEventListener('online', alCambiar);
    window.removeEventListener('offline', alCambiar);
  };
}

/**
 * Crea el banner de "Sin conexión" y lo mantiene sincronizado con la red. `role="status"` +
 * `aria-live="polite"` para que un lector de pantalla lo anuncie sin interrumpir (§9.4).
 * @param {(fechaISO: string) => string} [formatearHora] para pruebas deterministas; por defecto usa la hora real.
 */
export function crearBannerRed(formatearHora = horaLocal) {
  const nodo = h('div', { role: 'status', 'aria-live': 'polite', 'data-testid': 'banner-red' });
  const actualizar = (enLinea) => {
    nodo.dataset.visible = enLinea ? '0' : '1';
    nodo.dataset.enLinea = enLinea ? '1' : '0';
    nodo.textContent = enLinea ? '' : `${textos.red.sinConexionPrefijo} ${formatearHora()}`;
  };
  const cancelar = suscribirRed(actualizar);
  return { nodo, cancelar };
}

function horaLocal() {
  return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

/**
 * W16 (§7.3, §9.5 E10): ata uno o más botones que ESCRIBEN a la red — sin conexión quedan
 * deshabilitados y `avisoNodo` muestra `texto`; con conexión, vuelven a su estado normal, salvo
 * que `otraCondicionOk` diga lo contrario (p. ej. importar_csv.js: sin archivo elegido, el botón
 * sigue deshabilitado aunque vuelva la red). No toca peticiones en vuelo: si un botón ya está
 * deshabilitado porque su propio `manejarX` lo puso así mientras vuela una petición, esta función
 * solo decide el estado de REPOSO (antes o después de esa petición) — la garantía de una sola
 * acción por toque (§7.2, `accionUnica`) sigue siendo quien manda mientras la petición está en
 * vuelo, esta función solo entra quieta en ese instante y el próximo cambio de red la retoma.
 * El estudiante ya tenía esta garantía (asistencia.js, W8); W16 la generaliza al profe y al admin,
 * cuyos datos nunca se guardan en disco (§7.3, último punto): lo único "conocido sin red" que
 * puede verse es lo que YA está pintado en el DOM de esta sesión, nunca releído de una caché.
 * @param {HTMLButtonElement | HTMLButtonElement[]} botones
 * @param {HTMLElement} avisoNodo
 * @param {string} texto
 * @param {() => boolean} [otraCondicionOk]
 * @returns {() => void} para cancelar la suscripción (mismo patrón que `crearBannerRed`)
 */
export function ligarEscrituraARed(botones, avisoNodo, texto, otraCondicionOk = () => true) {
  const lista = Array.isArray(botones) ? botones : [botones];
  return suscribirRed((enLinea) => {
    avisoNodo.textContent = enLinea ? '' : texto;
    for (const boton of lista) boton.disabled = !enLinea || !otraCondicionOk();
  });
}
