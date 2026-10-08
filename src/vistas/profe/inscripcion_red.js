// @ts-check
// vistas/profe/inscripcion_red.js · El estado de la red del panel de inscripciones (docs/ESPEC_pantallas_anillo.md §4.5, E18, adenda 17.7). Sin red, todo botón que
// ESCRIBE (generar, apagar, aprobar, rechazar) queda deshabilitado con su texto y el sondeo no sale. A diferencia de `ligarEscrituraARed`, aquí los botones se
// vuelven a pintar a cada rato (la lista cambia, el código se genera): se registran por sección y se "olvidan" antes de repintar, y hay UNA sola suscripción
// a la red, que se da de baja al salir de la ruta (`registrarCelebracion`).
import { suscribirRed } from '../../ui/red.js';
import { registrarCelebracion } from '../../ui/celebraciones.js';

/** @returns {{registrar: (seccion: string, boton: HTMLButtonElement, ocupado?: () => boolean) => void, olvidar: (seccion: string) => void, enLinea: () => boolean,
 *   iniciar: (avisoNodo: HTMLElement, texto: string) => void}} */
export function crearControlDeRed() {
  /** @type {Map<string, Array<{boton: HTMLButtonElement, ocupado: () => boolean}>>} */
  const secciones = new Map();
  let enLinea = typeof navigator === 'undefined' || navigator.onLine !== false;
  const aplicar = () => { for (const lista of secciones.values()) for (const { boton, ocupado } of lista) boton.disabled = !enLinea || ocupado(); };
  return {
    /** Anota un botón que escribe: queda deshabilitado sin red o mientras `ocupado()` sea verdadero. */
    registrar(seccion, boton, ocupado = () => false) {
      if (!secciones.has(seccion)) secciones.set(seccion, []);
      secciones.get(seccion)?.push({ boton, ocupado });
      boton.disabled = !enLinea || ocupado();
    },
    /** Los botones de esa sección van a repintarse: los viejos ya no cuentan. */
    olvidar(seccion) { secciones.delete(seccion); },
    enLinea: () => enLinea,
    /** Escucha la red; `avisoNodo` dice `texto` mientras no haya. Se da de baja al salir de la ruta. */
    iniciar(avisoNodo, texto) {
      const cancelar = suscribirRed((v) => { enLinea = v; avisoNodo.textContent = v ? '' : texto; aplicar(); });
      registrarCelebracion(cancelar);
    },
  };
}
