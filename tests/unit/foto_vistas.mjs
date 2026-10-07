// @ts-check
// foto_vistas.mjs · El arnés de las fotos (R4, docs/ESPEC_pantallas_anillo.md §9.2): pinta las vistas existentes con el
// DOM de mentira (dom_falso.mjs) y entradas FIJAS, y las pasa a líneas de texto estables que se comparan contra
// tests/snapshots/vistas_595fd98.json. No es un archivo de test (no termina en .test.mjs).
//
// Cuidado con lo que se fija: el Drako va como imagen estática (el entorno no ofrece `createElementNS`, así que
// `crearDrako` cae a `crearDrakoEstatico`): no se enciende el motor de anime.js en Node (a veces dejaba el proceso
// colgado) y la foto mide las VISTAS, no el rig del personaje (eso ya lo cubren los tests de drako).
import { instalarDomFalso } from './dom_falso.mjs';
import { configurarAviso } from '../../src/aviso.js';
import { configurarRaizApi, fijarColegios } from '../../src/api/cliente.js';

export const AVISO_FIJO = {
  AVISO_RESPONSABLE: 'Responsable de Prueba (UIS, demostración)',
  AVISO_CONTACTO: 'datos@piloto.test',
  AVISO_VERSION: '2026-10-v1',
};

/** Una Response de verdad (la misma que usa el navegador): cuerpo JSON, status y encabezados. */
function respuesta(status, cuerpo, cabeceras = {}) {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status, headers: cabeceras });
}

/**
 * Instala el entorno de las fotos y devuelve cómo deshacerlo. `rutas` mapea "MÉTODO /ruta" (sin el prefijo /api y
 * sin la consulta) al cuerpo que devuelve; una función se llama con `{metodo, ruta, init}`; una ruta no declarada
 * lanza (una foto no puede depender de algo que nadie fijó).
 * @param {Record<string, unknown>} [rutas]
 */
export function entornoDeFotos(rutas = {}) {
  const g = /** @type {any} */ (globalThis);
  const quitarDom = instalarDomFalso({ reducido: true }); // reducido: los conteos saltan directo al valor final
  const previo = {
    createElementNS: g.document.createElementNS, body: g.document.body, fetch: g.fetch,
    localStorage: g.localStorage, sessionStorage: g.sessionStorage,
  };
  g.document.createElementNS = undefined;
  g.document.body = { dataset: {} };
  const almacen = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null }; };
  g.localStorage = almacen();
  g.sessionStorage = almacen();
  /** @type {{metodo: string, ruta: string}[]} */
  const llamadas = [];
  g.fetch = async (url, init = {}) => {
    const ruta = String(url).replace(/^.*?\/api/, '').split('?')[0];
    const metodo = init.method || 'GET';
    llamadas.push({ metodo, ruta });
    const clave = `${metodo} ${ruta}`;
    if (!(clave in rutas)) throw new Error(`foto_vistas: nadie fijó la ruta ${clave}`);
    const valor = rutas[clave];
    const hecho = typeof valor === 'function' ? await valor({ metodo, ruta, init }) : valor;
    if (hecho instanceof Response) return hecho;
    return respuesta(200, hecho);
  };
  configurarRaizApi('');
  fijarColegios({ activo: null, permitidos: null });
  configurarAviso(AVISO_FIJO);
  return {
    llamadas,
    restaurar() {
      g.document.createElementNS = previo.createElementNS; g.document.body = previo.body;
      g.fetch = previo.fetch; g.localStorage = previo.localStorage; g.sessionStorage = previo.sessionStorage;
      quitarDom();
    },
  };
}

/** Un contenedor vacío donde pintar una vista (lo que en el navegador es `#vista`). */
export function crearRaiz() {
  const raiz = /** @type {any} */ (document.createElement('main'));
  raiz.setAttribute('id', 'vista');
  return raiz;
}

const PROPIEDADES = ['disabled', 'hidden', 'checked', 'value'];

/**
 * El nodo y todo lo que cuelga de él, como líneas de texto (una por nodo, con sangría): etiqueta, clase, atributos
 * ordenados, propiedades que las vistas fijan a mano y el texto. Pura. Los oyentes de eventos no se ven (el DOM de
 * mentira no los guarda): lo que se fotografía es lo que la persona VE y lo que el lector de pantalla LEE.
 * @param {any} nodo @param {number} [nivel] @param {string[]} [salida]
 * @returns {string[]}
 */
export function fotografiar(nodo, nivel = 0, salida = []) {
  const sangria = '  '.repeat(nivel);
  if (nodo.nodeType === 3) { salida.push(`${sangria}${JSON.stringify(nodo.data)}`); return salida; }
  const partes = [nodo.tagName];
  if (nodo.className) partes.push(`class=${JSON.stringify(nodo.className)}`);
  for (const [k, v] of [...nodo.attrs.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) partes.push(`${k}=${JSON.stringify(v)}`);
  for (const p of PROPIEDADES) if (nodo[p] !== undefined && nodo[p] !== false && nodo[p] !== '') partes.push(`.${p}=${JSON.stringify(nodo[p])}`);
  if (nodo.textContent) partes.push(`texto=${JSON.stringify(nodo.textContent)}`);
  salida.push(`${sangria}${partes.join(' ')}`);
  for (const hijo of nodo.children) fotografiar(hijo, nivel + 1, salida);
  return salida;
}

/**
 * La foto SIN los subárboles que el commit declara como cambiados: los que tienen uno de esos `data-testid`.
 * Sirve para comprobar "cambia solo el nodo declarado" (METODO regla 4): lo demás debe ser idéntico.
 * @param {string[]} lineas @param {string[]} testids
 */
export function sinSubarboles(lineas, testids) {
  const salida = [];
  let saltarHasta = -1; // la sangría del nodo que se está saltando
  for (const linea of lineas) {
    const sangria = linea.length - linea.trimStart().length;
    if (saltarHasta >= 0) { if (sangria > saltarHasta) continue; saltarHasta = -1; }
    if (testids.some((t) => linea.includes(`data-testid="${t}"`))) { saltarHasta = sangria; continue; }
    salida.push(linea);
  }
  return salida;
}
