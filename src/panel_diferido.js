// @ts-check
// panel_diferido.js · Las pantallas del profe y del admin se cargan APARTE del shell (docs/ESPEC_margen_precarga.md).
//
// Por qué: la precarga del service worker tiene un techo de 830.000 bytes (U59) y estaba a 40 bytes de él. El estudiante, que es quien más
// abre la app, nunca pinta una pantalla del profe ni del admin (la guardia de rutas lo saca antes), así que no tiene por qué descargarlas.
// Las 10 pantallas del panel viven ahora detrás de UN `import()` (vistas/panel_docente.js) y van en la lista DIFERIDOS de sw.js.
//
// Para que el profe y el admin no noten nada:
//   - app.js pide el panel en cuanto sabe que quien entró no es estudiante (`cargar()`), así las pantallas quedan en memoria como antes y
//     moverse sin red dentro de la sesión sigue funcionando;
//   - si el panel ya está cargado, la pantalla se pinta en el mismo turno, sin un `await` de más (igual que cuando era un import estático);
//   - si se cambió de dirección mientras cargaba, NO se pinta: la pantalla vieja no cae encima de la nueva;
//   - si no carga (sin red y sin haberlo guardado), la ruta lo dice con la barra de su rol, nunca en blanco; el siguiente intento lo vuelve a pedir.
import { h, montar } from './ui/dom.js';
import { crearNavInferior } from './ui/nav_inferior.js';
import { textos } from './textos.js';

/**
 * @typedef {(modulo: any, raiz: HTMLElement, params: Record<string,string>, query: Record<string,string>, ctx: any) => void|Promise<void>} PintarPanel
 */

/**
 * @param {() => Promise<any>} importar el `import()` del panel; lo escribe app.js para que la ruta quede relativa a él (y U59 la vea)
 * @param {{leerDireccion?: () => string}} [o] cómo leer la dirección actual (en las pruebas, una de mentira)
 */
export function crearPanelDiferido(importar, { leerDireccion = () => location.hash } = {}) {
  let modulo = null; // el panel, una vez cargado: desde ahí todo es sincrónico
  let enVuelo = /** @type {Promise<any>|null} */ (null); // una sola petición aunque varias rutas (o la carga por rol) lo pidan a la vez

  /** Carga el panel una vez. Si falla, olvida el intento: el próximo lo vuelve a pedir (la red pudo volver). */
  function cargar() {
    if (modulo) return Promise.resolve(modulo);
    if (!enVuelo) enVuelo = importar().then((m) => { modulo = m; return m; }, (e) => { enVuelo = null; throw e; });
    return enVuelo;
  }

  /**
   * El render de una ruta del panel: `pintar(modulo, raiz, params, query, ctx)` cuando el panel esté.
   * @param {string} patron la ruta de navegacion.js (para la barra del respaldo)
   * @param {PintarPanel} pintar
   */
  function vista(patron, pintar) {
    return async (/** @type {HTMLElement} */ raiz, /** @type {Record<string,string>} */ params, /** @type {Record<string,string>} */ query, /** @type {any} */ ctx) => {
      if (modulo) return pintar(modulo, raiz, params, query, ctx); // ya cargado: como un import estático
      const direccion = leerDireccion();
      let m;
      try {
        m = await cargar();
      } catch (e) {
        console.error('panel_diferido: no se pudo cargar el panel del profe y del admin', e); // nunca un catch mudo
        if (leerDireccion() === direccion) pintarSinPanel(raiz, patron, ctx?.sesion?.rol);
        return;
      }
      if (leerDireccion() !== direccion) return; // se fue a otra pantalla mientras cargaba: esa ya se pintó (o se está pintando)
      return pintar(m, raiz, params, query, ctx);
    };
  }

  return { cargar, vista, cargado: () => modulo };
}

/** El respaldo: "Sin conexión." y la barra del rol para salir de ahí. Sobrio, como el panel (sin Drako ni `.juego`). */
function pintarSinPanel(raiz, patron, rol) {
  montar(raiz, h('div', { 'data-testid': 'panel-sin-red' }, h('p', { role: 'status' }, textos.auth.sinConexion), crearNavInferior(patron, rol)));
  document.body.dataset.listo = '1';
}
