// @ts-check
// apoyo_nav.mjs · Lo que comparten las pruebas de navegación (docs/ESPEC_navegacion.md §9.3): pintar una vista con el DOM de mentira y un
// servidor fijo, y mirar su barra, su "volver" y su título. No es un archivo de test (no termina en .test.mjs).
import { entornoDeFotos, crearRaiz, elementos, textoDe } from './foto_vistas.mjs';
import { ponerNavegadorDeMentira, asentar } from './fotos_de_navegacion.mjs';
import { olvidarAsistencias } from '../../src/vistas/profe/sesion_asistencia.js';

export const error500 = () => new Response(JSON.stringify({ detail: 'falla sintética' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
/** Una respuesta que no llega nunca: deja la vista en su estado de CARGA. */
export const nuncaResponde = () => new Promise(() => {});

/**
 * Pinta una vista con un servidor fijo y entrega la raíz y lo que se pidió. `fn(raiz)` puede no terminar nunca (estado de carga): se le da un
 * turno para pintar y se sigue.
 * @param {Record<string, unknown>} rutas @param {(raiz: any) => unknown} fn
 * @returns {Promise<{raiz: any, llamadas: {metodo: string, ruta: string}[], cerrar: () => void}>}
 */
export async function pintar(rutas, fn) {
  const entorno = entornoDeFotos(rutas);
  const quitar = ponerNavegadorDeMentira();
  const raiz = crearRaiz();
  await Promise.race([Promise.resolve(fn(raiz)), asentar()]);
  await asentar();
  return { raiz, llamadas: entorno.llamadas, cerrar: () => { olvidarAsistencias(); quitar(); entorno.restaurar(); } }; // W66: ni asistencias recordadas ni sondeos vivos entre pruebas
}

/** Los elementos bajo `raiz`, en el orden del documento. @param {any} raiz @returns {any[]} */
export const enOrden = (raiz) => elementos(raiz);

/** Los enlaces de volver de la pantalla: el de ui/encabezado.js (`volver`) y, hasta W71, los que cada vista armaba (`…volver…`). @param {any} raiz */
export function volveres(raiz) {
  return enOrden(raiz).filter((e) => /volver/.test(e.getAttribute?.('data-testid') || ''));
}

/** El enlace de volver de ui/encabezado.js, con lo que dice y a dónde lleva; null si no hay. @param {any} raiz */
export function volverDelEncabezado(raiz) {
  const nodo = enOrden(raiz).find((e) => e.getAttribute?.('data-testid') === 'volver');
  return nodo ? { nodo, href: nodo.getAttribute('href'), texto: textoDe(nodo), nombre: nodo.getAttribute('aria-label'), etiqueta: nodo.tagName } : null;
}

/** ¿`a` va antes que `b` en el documento? @param {any} raiz @param {any} a @param {any} b */
export function vaAntes(raiz, a, b) {
  const todos = enOrden(raiz);
  return todos.indexOf(a) >= 0 && todos.indexOf(a) < todos.indexOf(b);
}

/** El primer elemento con esa etiqueta, o null. @param {any} raiz @param {string} etiqueta */
export const primero = (raiz, etiqueta) => enOrden(raiz).find((e) => e.tagName === etiqueta) ?? null;

/** La barra de abajo (no lleva data-testid), o null. @param {any} raiz */
export const barraDe = (raiz) => enOrden(raiz).find((e) => e.tagName === 'nav' && String(e.className).split(/\s+/).includes('nav-inferior')) ?? null;
