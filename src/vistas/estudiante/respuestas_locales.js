// @ts-check
// vistas/estudiante/respuestas_locales.js · Las respuestas EN CURSO de un reto (hito 1: se guardan en el
// dispositivo, por `attempt_id`, y se envían al terminar). Son del estudiante que las escribió: en un
// equipo compartido no deben sobrevivir a su sesión (H-18 de la auditoría de seguridad 02). Por eso
// `limpiarRespuestasEnCurso()` las borra todas, y app.js la llama al cerrar sesión y al cambiar de
// institución. Cada acceso a localStorage va en try/catch: sin almacenamiento la app sigue funcionando.

const PREFIJO = 'engrama_respuestas_';

/** @param {string} attemptId */
export function claveLocal(attemptId) {
  return `${PREFIJO}${attemptId}`;
}

/** @param {string} attemptId @returns {Record<string, string>} */
export function leerRespuestasGuardadas(attemptId) {
  try {
    const crudo = localStorage.getItem(claveLocal(attemptId));
    return crudo ? JSON.parse(crudo) : {};
  } catch (e) { console.error('respuestas_locales: no pude leer respuestas guardadas', e); return {}; }
}

/** @param {string} attemptId @param {Record<string, string>} respuestas */
export function guardarRespuestas(attemptId, respuestas) {
  try { localStorage.setItem(claveLocal(attemptId), JSON.stringify(respuestas)); }
  catch (e) { console.error('respuestas_locales: no pude guardar la respuesta', e); }
}

/** @param {string} attemptId */
export function borrarRespuestasGuardadas(attemptId) {
  try { localStorage.removeItem(claveLocal(attemptId)); }
  catch (e) { console.error('respuestas_locales: no pude borrar las respuestas guardadas', e); }
}

/** Borra las respuestas en curso de TODOS los intentos de este dispositivo. @returns {number} cuántas borró */
export function limpiarRespuestasEnCurso() {
  try {
    const claves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIJO)) claves.push(k);
    }
    for (const k of claves) localStorage.removeItem(k);
    return claves.length;
  } catch (e) {
    console.error('respuestas_locales: no pude limpiar las respuestas en curso', e);
    return 0;
  }
}
