// @ts-check
// W84 · E39 (docs/ESPEC_lectura_texto.md §2): el texto de un reto de Lectura en el navegador de verdad, contra el doble, a 375 × 667 y a 1280 × 800.
// Lo que se ve es la `description` del reto, en inglés (lang="en"), arriba de la afirmación y con altura acotada (la primera opción empieza por encima
// de la barra de acción fija); sigue en la afirmación 2; plegado se recuerda al elegir; la revisión lo trae plegado y al abrirlo se lee. Un reto de
// gramática, sin bloque. Lo medido sale de herramientas/humo/medir_lectura.mjs (lo mismo que escriben las capturas). Cruce: x_e39_lectura_ciega.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { sembrarRetoLectura, sembrarRetosPractica } from '../../herramientas/humo/entradas_practica.mjs';
import { MEDIR_LECTURA } from '../../herramientas/humo/medir_lectura.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarTestid(sesion, testid, limiteMs = 9000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`)) return true; await esperar(80); }
  return false;
}
const clic = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]').click()`);
const medir = (sesion) => sesion.evaluar(MEDIR_LECTURA);

/** El recorrido completo del reto de lectura en una ventana. */
async function recorrer({ ancho, alto }, { conGramatica = false } = {}) {
  await conAppCompleta(async (url, estado) => {
    const grupo = [...estado.groups.values()][0].id;
    const reto = sembrarRetoLectura(estado, grupo);
    const gramatica = conGramatica ? sembrarRetosPractica(estado, grupo).find((r) => r.title === 'Rutina diaria · Gramática 1') : null;
    const sesion = await abrirSesion({ ancho, alto });
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await sesion.navegar(`${url}#/retos/${reto.id}`);
      await sesion.recargar();
      assert.ok(await esperarTestid(sesion, 'enunciado'));
      await esperar(700); // la entrada de la pregunta
      const uno = await medir(sesion);
      const donde = `${ancho}×${alto}: ${JSON.stringify(uno)}`;
      assert.equal(uno.hay, true, `el bloque del texto: ${donde}`);
      assert.equal(uno.texto, reto.description, 'lo que se ve es la description del reto, completa');
      assert.deepEqual(uno.lang, ['en'], 'el texto va con lang="en"');
      assert.equal(uno.abierta, true, 'abierto al empezar');
      assert.equal(uno.antesDelEnunciado, true, 'arriba de la afirmación');
      assert.equal(uno.textoSeVe, true, `el comienzo del texto se ve: ${donde}`);
      assert.ok(uno.bloque.alto <= alto * 0.4, `el bloque ocupa a lo sumo el 40 % del alto: ${uno.bloque.alto} de ${alto}`);
      assert.ok(uno.primeraOpcion.arriba < uno.barraArriba, `la primera opción empieza por encima de la barra fija: ${donde}`);
      assert.equal(uno.pistaVisible, uno.cuerpo.desborda, 'la pista "desliza" sale solo si el texto no cabe');

      await clic(sesion, 'opcion-V'); await esperar(150);
      await clic(sesion, 'boton-comprobar');
      assert.ok(await esperarTestid(sesion, 'explicacion'), 'la banda');
      await clic(sesion, 'boton-siguiente'); await esperar(700);
      const dos = await medir(sesion);
      assert.equal(dos.contador, 'Pregunta 2 de 4');
      assert.deepEqual([dos.hay, dos.texto, dos.abierta, dos.textoSeVe], [true, reto.description, true, true], `en la afirmación 2: ${JSON.stringify(dos)}`);

      await clic(sesion, 'lectura-rotulo'); await esperar(150);
      await clic(sesion, 'opcion-V'); await esperar(300);
      assert.equal((await medir(sesion)).abierta, false, 'plegado sigue plegado tras elegir (la pantalla se repinta)');
      await clic(sesion, 'lectura-rotulo'); await esperar(150);

      for (let i = 1; i < reto.questions.length; i++) {
        await clic(sesion, 'opcion-V'); await esperar(150);
        await clic(sesion, 'boton-comprobar');
        assert.ok(await esperarTestid(sesion, i < reto.questions.length - 1 ? 'boton-siguiente' : 'boton-terminar'));
        await esperar(300);
        if (i < reto.questions.length - 1) { await clic(sesion, 'boton-siguiente'); await esperar(500); }
      }
      await clic(sesion, 'boton-terminar');
      assert.ok(await esperarTestid(sesion, 'vista-revision'), 'la revisión');
      await esperar(600);
      const fin = await medir(sesion);
      assert.deepEqual([fin.hay, fin.abierta], [true, false], 'la revisión trae el texto plegado');
      await clic(sesion, 'lectura-rotulo'); await esperar(200);
      await sesion.evaluar("document.querySelector('[data-testid=\"lectura\"]').scrollIntoView({ block: 'start' })"); await esperar(200);
      const abierto = await medir(sesion);
      assert.deepEqual([abierto.abierta, abierto.texto, abierto.textoSeVe], [true, reto.description, true], `al abrirlo se lee: ${JSON.stringify(abierto)}`);

      if (gramatica) {
        await sesion.navegar(`${url}#/retos/${gramatica.id}`);
        assert.ok(await esperarTestid(sesion, 'enunciado'));
        assert.equal((await medir(sesion)).hay, false, 'un reto de gramática no trae el bloque');
      }
      assert.deepEqual(sesion.errores, []);
    } finally { await sesion.cerrar(); }
  });
}

test('E39: a 375 × 667 el reto de Lectura muestra su texto arriba, acotado, en cada afirmación y plegado en la revisión; uno de gramática, sin bloque', { skip: OMITIR, timeout: 150_000 }, async () => {
  await recorrer({ ancho: 375, alto: 667 }, { conGramatica: true });
});

test('E39: a 1280 × 800 el reto de Lectura muestra su texto arriba, acotado, en cada afirmación y plegado en la revisión', { skip: OMITIR, timeout: 150_000 }, async () => {
  await recorrer({ ancho: 1280, alto: 800 });
});
