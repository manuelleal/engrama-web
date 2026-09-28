// @ts-check
// rutas.js · Router por hash (§6.2: "Rutas | Hash (#/inicio, #/retos/:id, #/profe/grupo/:gid…)").
// Nada de History API: así el shell funciona sirviendo un solo index.html sin configurar el
// servidor para reescribir rutas (importa en producción, detrás de un proxy que no sabemos aún
// cómo queda configurado — §12, bloqueo 4).
import { vaciar } from './ui/dom.js';

/** @typedef {(raiz: HTMLElement, params: Record<string,string>) => void|Promise<void>} Render */

const rutas = []; // { patron: RegExp, nombres: string[], render: Render }
let porDefecto = '/inicio';
let raizVista = null;
let rutaNoEncontrada = null;

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
  const [camino] = crudo.split('?');
  for (const r of rutas) {
    const m = r.patron.exec(camino);
    if (m) {
      const params = {};
      r.nombres.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
      return { render: r.render, params };
    }
  }
  return rutaNoEncontrada ? { render: rutaNoEncontrada, params: {} } : null;
}

async function renderizarActual() {
  if (!raizVista) return;
  const resuelto = resolverHash();
  vaciar(raizVista);
  if (!resuelto) return;
  await resuelto.render(raizVista, resuelto.params);
}

/**
 * Arranca el router: renderiza la ruta actual y queda escuchando `hashchange`.
 * @param {HTMLElement} raiz
 */
export function iniciar(raiz) {
  raizVista = raiz;
  if (!location.hash) location.hash = `#${porDefecto}`;
  window.addEventListener('hashchange', renderizarActual);
  renderizarActual();
}

/** @param {string} ruta ej. "/retos/42" */
export function navegar(ruta) {
  location.hash = `#${ruta}`;
}
