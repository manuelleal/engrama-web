#!/usr/bin/env node
// @ts-check
// capturas_rotulos.mjs · Adenda 3 de docs/ESPEC_practica_del_dia.md (§6d): la banda de explicación de una lectura (V/F/ND, B1 en inglés), de un reto de
// vocabulario (A2 en español) y, de control, de gramática, a 375 × 812 contra el doble, para MIRAR los rótulos. Escribe las capturas y `rotulos.json`
// con el texto de cada parte de la banda. Nada toca el piloto ni un puerto fijo.
// Uso: node herramientas/capturas_rotulos.mjs [carpeta]   (por defecto: salida/web_rotulos/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';
import { abrirSesion } from './cdp.mjs';
import { sembrarRetosPractica, sembrarRetoLectura } from './humo/entradas_practica.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const esperar = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
const PARTES = ['oracion', 'regla', 'porQue', 'ejemplo'];

/** Toca un testid en cuanto aparece (hasta 4 s). */
const tocar = (/** @type {any} */ sesion, /** @type {string} */ testid) => sesion.evaluar(`(async () => {
  for (let i = 0; i < 80 && !document.querySelector('[data-testid="${testid}"]'); i++) await new Promise((r) => setTimeout(r, 50));
  document.querySelector('[data-testid="${testid}"]').click();
})()`);

/** El texto de cada parte de la banda, tal como se ve. */
const LEER_BANDA = `(() => Object.fromEntries(${JSON.stringify(PARTES)}.map((p) => [p, document.querySelector('[data-testid="explicacion-' + p + '"]')?.textContent ?? null])))()`;

async function main() {
  const carpeta = resolve(process.argv[2] || join(RAIZ, 'salida', 'web_rotulos'));
  mkdirSync(carpeta, { recursive: true });
  /** @type {Record<string, any>} */
  const bandas = {};
  await conAppCompleta(async (url, estado) => {
    const grupo = [...estado.groups.values()][0].id;
    const retos = sembrarRetosPractica(estado, grupo);
    const lectura = sembrarRetoLectura(estado, grupo);
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    /** Abre el reto, responde la primera pregunta con `label` y deja la banda a la vista. */
    const caso = async (/** @type {string} */ nombre, /** @type {string} */ retoId, /** @type {string} */ label) => {
      await sesion.navegar(`${url}#/retos/${retoId}`);
      await sesion.recargar();
      await esperar(1500);
      await tocar(sesion, `opcion-${label}`); await esperar(400);
      await tocar(sesion, 'boton-comprobar'); await esperar(1000);
      bandas[nombre] = await sesion.evaluar(LEER_BANDA);
      writeFileSync(join(carpeta, `${nombre}-375.png`), await sesion.capturar());
    };
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await caso('lectura-banda', lectura.id, 'V'); // la clave es F: falla, y se ve también "Why not yours"
      await caso('vocabulario-banda', retos.find((r) => r.title === 'Rutina diaria · Vocabulario 1').id, 'B');
      await caso('gramatica-banda', retos.find((r) => r.title === 'Rutina diaria · Gramática 1').id, 'A');
      bandas.errores = sesion.errores;
    } finally { await sesion.cerrar(); }
  });
  writeFileSync(join(carpeta, 'rotulos.json'), `${JSON.stringify(bandas, null, 2)}\n`);
  console.log(`capturas_rotulos: capturas y rotulos.json en ${carpeta}`);
  console.log(JSON.stringify(bandas, null, 2));
}

main().catch((e) => { console.error('capturas_rotulos: falló', e); process.exit(1); });
