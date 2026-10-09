// @ts-check
// rutas.js · Router por hash (§6.2: "Rutas | Hash (#/inicio, #/retos/:id, #/profe/grupo/:gid…)").
// Nada de History API: así el shell funciona sirviendo un solo index.html sin configurar el
// servidor para reescribir rutas (importa en producción, detrás de un proxy que no sabemos aún
// cómo queda configurado — §12, bloqueo 4).
import { vaciar } from './ui/dom.js';
import { cancelarCelebraciones } from './ui/celebraciones.js';
import { fijarPestana } from './ui/encabezado.js';
import { filaDe } from './navegacion.js';

/** @typedef {(raiz: HTMLElement, params: Record<string,string>, query: Record<string,string>) => void|Promise<void>} Render */

const rutas = []; // { texto: string (el patrón tal cual), patron: RegExp, nombres: string[], render: Render }
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
  rutas.push({ texto: patron, patron: new RegExp(`^/${fuente}/?$`), nombres, render });
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
      return { render: r.render, params, query, texto: r.texto };
    }
  }
  return rutaNoEncontrada ? { render: rutaNoEncontrada, params: {}, query, texto: null } : null;
}

async function renderizarActual() {
  if (!raizVista) return;
  hashRenderizado = location.hash;
  const resuelto = resolverHash();
  // Toda celebración (aviso de constancia, confeti, monedas en vuelo, la línea de tiempo del fin de reto) es de la pantalla donde
  // ocurrió: al cambiar de ruta se cancela, ANTES de pintar la nueva (ui/celebraciones.js).
  cancelarCelebraciones();
  vaciar(raizVista);
  // W71 (docs/ESPEC_navegacion.md §5.7): la pestaña del navegador dice "<título> · ENGRAMA" en cada ruta (el título es el de la tabla de
  // navegacion.js; la pantalla de un grupo lo completa con su código cuando lo sabe). Una ruta sin fila deja "ENGRAMA".
  fijarPestana(filaDe(resuelto?.texto ?? '')?.titulo(null) ?? null);
  if (!resuelto) return;
  await resuelto.render(raizVista, resuelto.params, resuelto.query);
}

/**
 * Arranca el router: renderiza la ruta actual y queda escuchando `hashchange`.
 * @param {HTMLElement} raiz
 * @param {{desdeElPrincipio?: boolean}} [opciones] `desdeElPrincipio`: empieza en la ruta por defecto, no
 *   en el hash que haya (al cambiar de institución el rol puede ser otro y esa ruta ya no servir)
 */
export function iniciar(raiz, { desdeElPrincipio = false } = {}) {
  raizVista = raiz;
  if (desdeElPrincipio || !location.hash) location.hash = `#${porDefecto}`;
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
  cancelarCelebraciones();
  fijarPestana(null); // una pantalla obligatoria no es una ruta: la pestaña vuelve a decir "ENGRAMA"
  window.removeEventListener('hashchange', alCambiarHash);
  raizVista = null;
  hashRenderizado = null;
}

/** Olvida todas las rutas registradas, para volver a registrarlas con una sesión nueva. */
export function reiniciarRutas() {
  rutas.length = 0;
}


/** @param {string} ruta ej. "/retos/42" */
export function navegar(ruta) {
  location.hash = `#${ruta}`;
}
