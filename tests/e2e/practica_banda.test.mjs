// @ts-check
// Tanda visual 3 · E40 (docs/ESPEC_visual_reto_tanda2.md, adenda 1; compuerta 21, hallazgo 4): en el navegador de verdad, contra el doble, la banda de resultado NO
// tapa lo que explica. Tras CADA "Comprobar" (lectura, gramática B1 y A2, vocabulario; a 375 × 667 y 1280 × 800) se mide la geometría con
// herramientas/humo/medir_banda.mjs, ya asentado el desplazamiento: el enunciado ENTERO, cada opción marcada ("Correcta" y, si falló, "Tu respuesta") ENTERA y el botón
// de la banda quedan dentro de la ventana y las opciones POR ENCIMA del borde de arriba de la banda. Además: "Siguiente" abre la pregunta nueva arriba (la app no la deja
// ya desplazada), con prefers-reduced-motion el desplazamiento es instantáneo (`behavior: 'auto'`, y la misma geometría), y una explicación tan larga que la banda llega
// a su tope (78 vh) deja relleno de sobra para subir el contenido y el enunciado a la vista.
// Cruces: x_banda_tapa_e40 (ui/despejar_banda.js no desplaza), x_banda_sin_reducido_e40 (siempre suave) y x_banda_sin_relleno_e40 (practica.css sin el relleno de la banda).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { ESCENARIOS, ESCENARIO_LARGO, recorrerEscenario } from '../../herramientas/humo/guion_banda.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const HOLGURA = 12; // la misma de ui/despejar_banda.js

/** Lo que debe cumplir CADA paso: nada de lo marcado ni el enunciado queda bajo la banda, y la banda y su botón se ven. */
function afirmarGeometria(/** @type {any} */ paso, /** @type {any} */ m) {
  const donde = `${paso.escenario} pregunta ${paso.indice + 1} a ${paso.ancho}×${paso.alto}`;
  const resumen = `banda ${m.banda?.arriba}-${m.banda?.abajo}, enunciado ${m.enunciado?.arriba}-${m.enunciado?.abajo}, opciones ${m.opciones.map((/** @type {any} */ o) => `${o.label}${o.marcada ? `(${o.marcada})` : ''} ${o.arriba}-${o.abajo}`).join(' | ')}, scrollY ${m.scrollY}/${m.scrollMax}`;
  assert.equal(m.hay, true, `la banda se ve: ${donde}`);
  assert.ok(m.marcadas.some((/** @type {string} */ x) => x.endsWith(':correcta')), `la correcta está marcada: ${donde}: ${resumen}`);
  assert.equal(m.enunciadoVisible, true, `el enunciado se ve entero, por encima de la banda: ${donde}: ${resumen}`);
  assert.equal(m.marcadasVisibles, true, `las opciones marcadas se ven enteras, por encima de la banda: ${donde}: ${resumen}`);
  assert.equal(m.bandaVisible, true, `la banda cabe en la ventana: ${donde}: ${resumen}`);
  assert.equal(m.botonVisible, true, `el botón que sigue se ve: ${donde}: ${resumen}`);
}

/** Recorre todos los escenarios en una ventana y afirma la geometría de cada paso (y que la pregunta nueva abre arriba). */
async function recorrerTodos(/** @type {{ancho: number, alto: number}} */ ventana, { reducido = false, escenarios = ESCENARIOS } = {}) {
  /** @type {any[]} */
  const pasos = [];
  for (const escenario of escenarios) {
    await recorrerEscenario(ventana, escenario, async (paso, m) => {
      afirmarGeometria(paso, m);
      if (paso.indice > 0) assert.equal(m.scrollAlEntrar, 0, `"Siguiente" abre la pregunta nueva arriba, no donde quedó la anterior: ${paso.escenario} pregunta ${paso.indice + 1} a ${paso.ancho}×${paso.alto}`);
      pasos.push({ paso, m });
    }, { reducido, conAppCompleta });
  }
  return pasos;
}

test('E40: a 375 × 667 la banda no tapa el enunciado ni las opciones marcadas (lectura, gramática B1 y A2, vocabulario)', { skip: OMITIR, timeout: 300_000 }, async () => {
  const pasos = await recorrerTodos({ ancho: 375, alto: 667 });
  assert.equal(pasos.length, 11, 'se midieron las 11 preguntas del guion');
  assert.ok(pasos.some(({ m }) => m.desplazos.some((/** @type {any} */ d) => d.args.includes('"smooth"'))), 'con movimiento pleno la app desplaza suave');
});

test('E40: a 1280 × 800 la banda no tapa el enunciado ni las opciones marcadas (lectura, gramática B1 y A2, vocabulario)', { skip: OMITIR, timeout: 300_000 }, async () => {
  const pasos = await recorrerTodos({ ancho: 1280, alto: 800 });
  assert.equal(pasos.length, 11, 'se midieron las 11 preguntas del guion');
});

test('E40: con prefers-reduced-motion el desplazamiento es instantáneo y la geometría la misma', { skip: OMITIR, timeout: 300_000 }, async () => {
  const pasos = await recorrerTodos({ ancho: 375, alto: 667 }, { reducido: true, escenarios: ESCENARIOS.filter((e) => e.nombre === 'lectura' || e.nombre === 'gramB1') });
  const pedidos = pasos.flatMap(({ m }) => m.desplazos).filter((/** @type {any} */ d) => d.nombre === 'scrollBy');
  assert.ok(pedidos.length > 0, 'la app sí desplazó (sin movimiento no es lo mismo que sin desplazamiento)');
  assert.deepEqual(pedidos.filter((/** @type {any} */ d) => !d.args.includes('"behavior":"auto"')), [], 'ningún desplazamiento suave con movimiento reducido');
});

test('E40: una explicación muy larga (la banda en su tope de 78 vh) deja relleno para subir el contenido y el enunciado a la vista', { skip: OMITIR, timeout: 300_000 }, async () => {
  for (const ventana of [{ ancho: 375, alto: 667 }, { ancho: 1280, alto: 800 }]) {
    await recorrerEscenario(ventana, ESCENARIO_LARGO, async (paso, m) => {
      const donde = `${ventana.ancho}×${ventana.alto}: banda ${m.banda?.arriba}-${m.banda?.abajo}, relleno ${m.rellenoAbajo}, scrollY ${m.scrollY}/${m.scrollMax}`;
      assert.equal(m.hay, true);
      assert.ok(m.bandaSobreLaVentana >= 70 && m.bandaSobreLaVentana <= 78.5, `la banda llega a su tope (78 vh): ${donde}`);
      assert.ok(m.rellenoAbajo >= m.banda.alto + HOLGURA, `el relleno de abajo alcanza para la banda más su aire: ${donde}`);
      assert.equal(m.enunciadoVisible, true, `si no cabe todo, el enunciado queda a la vista: ${donde}`);
      assert.ok(m.scrollY > 0, `la app subió el contenido: ${donde}`);
    }, { conAppCompleta });
  }
});
