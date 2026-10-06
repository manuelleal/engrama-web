// @ts-check
// rutas.js · Router por hash (§6.2: "Rutas | Hash (#/inicio, #/retos/:id, #/profe/grupo/:gid…)").
// Nada de History API: así el shell funciona sirviendo un solo index.html sin configurar el
// servidor para reescribir rutas (importa en producción, detrás de un proxy que no sabemos aún
// cómo queda configurado — §12, bloqueo 4).
import { vaciar } from './ui/dom.js';

/** @typedef {(raiz: HTMLElement, params: Record<string,string>, query: Record<string,string>) => void|Promise<void>} Render */

const rutas = []; // { patron: RegExp, nombres: string[], render: Render }
let porDefecto = '/inicio';
let raizVista = null;
let rutaNoEncontrada = null;
let hashRenderizado = null; // el hash que se pintó por última vez: un `hashchange` repetido no vuelve a pintar

/**
 * Registra una ruta. `patron` usa `:nombre` para params, p. ej. "/retos/:id".
 * @param {string} patron
 * @param {Render} render
 */
export function ruta(patron, render) {
  const nombres = [];
  const fuente = patron
    .split('/')
    .filter(Boolean)
    .map((parte) => {
      if (parte.startsWith(':')) { nombres.push(parte.slice(1)); return '([^/]+)'; }
      return parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  rutas.push({ patron: new RegExp(`^/${fuente}/?$`), nombres, render });
}

/** Ruta que se usa cuando el hash no calza con ninguna registrada. */
export function alNoEncontrar(render) {
  rutaNoEncontrada = render;
}

/** @param {string} ruta ej. "/inicio" (se usa si el hash llega vacío) */
export function definirPorDefecto(ruta) {
  porDefecto = ruta;
}

function resolverHash() {
  const crudo = location.hash.replace(/^#/, '') || porDefecto;
  const [camino, cadenaQuery] = crudo.split('?');
  const query = Object.fromEntries(new URLSearchParams(cadenaQuery || ''));
  for (const r of rutas) {
    const m = r.patron.exec(camino);
    if (m) {
      const params = {};
      r.nombres.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
      return { render: r.render, params, query };
    }
  }
  return rutaNoEncontrada ? { render: rutaNoEncontrada, params: {}, query } : null;
}

async function renderizarActual() {
  if (!raizVista) return;
  hashRenderizado = location.hash;
  const resuelto = resolverHash();
  vaciar(raizVista);
  if (!resuelto) return;
  await resuelto.render(raizVista, resuelto.params, resuelto.query);
}

/**
 * Arranca el router: renderiza la ruta actual y queda escuchando `hashchange`.
 * @param {HTMLElement} raiz
 */
export function iniciar(raiz) {
  raizVista = raiz;
  if (!location.hash) location.hash = `#${porDefecto}`;
  window.removeEventListener('hashchange', alCambiarHash); // iniciar() puede repetirse (tras el cambio de contraseña o de colegio)
  window.addEventListener('hashchange', alCambiarHash);
  renderizarActual();
}

function alCambiarHash() {
  if (location.hash === hashRenderizado) return; // ya está pintado (p. ej. el hash por defecto recién puesto)
  renderizarActual();
}

/**
 * Deja de escuchar el hash y suelta la raíz: ninguna vista se pinta más hasta el próximo
 * `iniciar()`. Es lo que hace una pantalla obligatoria (contraseña temporal, cuenta sin inscribir):
 * mientras dure, no se puede navegar a otra vista.
 */
export function detener() {
  window.removeEventListener('hashchange', alCambiarHash);
  raizVista = null;
  hashRenderizado = null;
}

/** Olvida todas las rutas registradas, para volver a registrarlas con una sesión nueva. */
export function reiniciarRutas() {
  rutas.length = 0;
}

/** Vuelve a la ruta por defecto (la del rol) y la pinta de nuevo, aunque el hash ya sea ese. */
export function recargarEnRutaPorDefecto() {
  location.hash = `#${porDefecto}`;
  hashRenderizado = null;
  renderizarActual();
}

/** @param {string} ruta ej. "/retos/42" */
export function navegar(ruta) {
  location.hash = `#${ruta}`;
}
