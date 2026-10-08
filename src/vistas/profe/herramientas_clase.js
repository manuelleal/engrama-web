// @ts-check
// vistas/profe/herramientas_clase.js · El bloque "Herramientas de clase" de `#/profe/grupos` (docs/ESPEC_pantallas_anillo.md §4.6): hasta tres botones que
// llevan al docente a EVA (el tablero de la clase y Escamas) y a SET (calificar escritura) con su pase (decisión 013).
//
// Sobrio, como todo el panel del profe: sin `.juego`, sin Drako, sin confeti. Un botón por destino que TENGA una base válida en config.json para
// la institución activa; si ninguno la tiene, no se pinta el bloque (la vista queda idéntica a la de antes, R4). El pase se pide al tocar
// (anillo/abrir.js): ningún nodo de aquí lo contiene antes. El docente nunca ve los enlaces del estudiante, ni al revés.
import { h } from '../../ui/dom.js';
import { ligarEscrituraARed } from '../../ui/red.js';
import { registrarCelebracion } from '../../ui/celebraciones.js';
import { textos } from '../../textos.js';
import { destinosDeLaSesion, crearSalida, alVolverDeOtroOrigen } from '../../anillo/abrir.js';

const T = textos.anillo;
const ETIQUETA = { eva_tablero: T.tablero, eva_escamas: T.escamas, set_revisar: T.revisar };

/**
 * @param {any} ctx el contexto de la ruta (app.js): sesion, config, pedirPase, colegioActivo
 * @returns {HTMLElement|null} null si el rol no tiene herramientas configuradas (nada que pintar)
 */
export function crearHerramientasDeClase(ctx) {
  const destinos = destinosDeLaSesion(ctx).filter((d) => d.destino in ETIQUETA);
  if (destinos.length === 0) return null;
  const error = h('p', { role: 'alert', 'data-testid': 'herramientas-error' });
  const avisoRed = h('p', { role: 'status', 'data-testid': 'herramientas-sin-red' });
  const salidas = destinos.map(({ destino, base }) => ({ destino, salida: crearSalida(ctx, destino, base) }));
  const botones = salidas.map(({ destino, salida }) => {
    const boton = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', 'data-testid': `herramienta-${destino}`, 'data-destino': destino }, /** @type {Record<string, string>} */ (ETIQUETA)[destino]));
    boton.addEventListener('click', async () => {
      if (salidas.some((s) => s.salida.salio)) return; // ya se está saliendo: un segundo toque no navega otra vez
      error.textContent = '';
      for (const b of botones) b.disabled = true;
      try {
        await salida.abrir();
      } catch {
        // Nunca el error ni el enlace: el pase viaja en ellos (REGLAS.md §4: ningún catch mudo; una línea fija).
        console.warn('vistas/profe/herramientas_clase: no se pudo salir al destino');
        error.textContent = T.errorAbrir;
        for (const b of botones) b.disabled = false;
      }
    });
    return boton;
  });
  const sinRed = ligarEscrituraARed(botones, avisoRed, textos.red.sinConexionAccion(T.herramientaAccion), () => !salidas.some((s) => s.salida.salio));
  const dejarDeEscuchar = alVolverDeOtroOrigen(() => { // "atrás" desde EVA o SET
    for (const s of salidas) s.salida.rearmar();
    for (const b of botones) b.disabled = typeof navigator !== 'undefined' && navigator.onLine === false;
  });
  registrarCelebracion(() => { sinRed(); dejarDeEscuchar(); });
  return h(
    'section', { 'data-testid': 'herramientas-clase', 'aria-labelledby': 'herramientas-titulo' },
    h('h2', { id: 'herramientas-titulo' }, T.herramientas),
    h('div', { class: 'fila-acciones' }, ...botones),
    h('p', { class: 'texto-apoyo', role: 'note', 'data-testid': 'herramientas-sales' }, T.sales),
    error,
    avisoRed,
  );
}
