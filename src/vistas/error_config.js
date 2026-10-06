// @ts-check
// vistas/error_config.js · "No se pudo abrir ENGRAMA": la configuración del despliegue no llegó o no sirve
// (H-6). Es un callejón con salida: un mensaje claro y "Reintentar". Nunca cae al modo de prueba.
import { h, montar } from '../ui/dom.js';
import { crearDrako } from '../ui/drako.js';
import { textos } from '../textos.js';

/** @param {'sin_red'|'http'|'invalida'|string} causa */
export function mensajeDeErrorConfig(causa) {
  return causa === 'sin_red' ? textos.errorConfig.sinRed : textos.errorConfig.general;
}

/** @param {HTMLElement} raiz @param {string} causa */
export function renderErrorConfig(raiz, causa) {
  montar(raiz, h(
    'div', { 'data-testid': 'error-config' },
    crearDrako('ups', textos.errorConfig.drako),
    h('h1', {}, textos.app.titulo),
    h('p', { role: 'alert', 'data-testid': 'error-config-mensaje' }, mensajeDeErrorConfig(causa)),
    h('button', { type: 'button', 'data-testid': 'error-config-reintentar', onClick: () => location.reload() }, textos.errorConfig.reintentar),
  ));
  document.body.dataset.listo = '1';
}
