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
