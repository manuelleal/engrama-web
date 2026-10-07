// @ts-check
// ui/celebraciones.js · UN solo gancho de limpieza para toda celebración (aviso "¡Constancia N!", confeti, monedas en
// vuelo, la línea de tiempo del fin de reto, los conteos). Una celebración es de la pantalla donde ocurrió: si el
// estudiante navega, tiene que desaparecer — antes el aviso tapaba "PREGUNTA N DE 3" y el confeti cubría el formulario
// del Perfil varios segundos después de haber cambiado de pantalla (observado en el redespliegue real).
//
// Cómo se usa: quien lanza algo que dura registra cómo se cancela y recibe una función para darlo por terminado.
//   const terminar = registrarCelebracion(() => lienzo.remove());
//   ...cuando acaba solo: terminar();
// El router (rutas.js) llama a `cancelarCelebraciones()` en CADA cambio de ruta, antes de pintar la vista nueva.

/** @type {Set<() => void>} */
const activas = new Set();

/**
 * Anota una celebración en curso. Devuelve la función que la da por terminada (la quita de la lista sin cancelarla).
 * @param {() => void} cancelar cómo se detiene y se quita de la pantalla (debe poder llamarse más de una vez)
 * @returns {() => void}
 */
export function registrarCelebracion(cancelar) {
  activas.add(cancelar);
  return () => { activas.delete(cancelar); };
}

/** Cuántas celebraciones siguen en curso (para pruebas e informes). */
export function celebracionesActivas() {
  return activas.size;
}

/**
 * Cancela TODA celebración en curso: se llama en cada cambio de ruta. Que una falle no impide cancelar las demás.
 * @returns {number} cuántas había
 */
export function cancelarCelebraciones() {
  const lista = [...activas];
  activas.clear();
  for (const cancelar of lista) {
    try { cancelar(); } catch (e) { console.error('ui/celebraciones: una celebración no se pudo cancelar', e); }
  }
  return lista.length;
}
