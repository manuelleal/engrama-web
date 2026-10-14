#!/usr/bin/env node
// @ts-check
// capturas_practica.mjs · Las pantallas de la práctica del día (docs/ESPEC_practica_del_dia.md) contra el mock, a 375 × 812 y a 1280 × 800, para
// MIRARLAS: el reto con su explicación (fallo y acierto; A2 en español y B1 en inglés). Cada ancho arranca con su mock recién sembrado
// (herramientas/humo/entradas_practica.mjs, en el grupo de `est-1`). Nada toca el piloto ni un puerto fijo.
// Uso: node herramientas/capturas_practica.mjs [carpeta]   (por defecto: salida/practica/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';
import { abrirSesion } from './cdp.mjs';
import { sembrarRetosPractica } from './humo/entradas_practica.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const VENTANAS = [{ ancho: 375, alto: 812 }, { ancho: 1280, alto: 800 }];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Toca un testid en cuanto aparece (hasta 4 s). */
const tocar = (sesion, testid) => sesion.evaluar(`(async () => {
  for (let i = 0; i < 80 && !document.querySelector('[data-testid="${testid}"]'); i++) await new Promise((r) => setTimeout(r, 50));
  document.querySelector('[data-testid="${testid}"]').click();
})()`);

/** Elige y comprueba; la captura queda con la banda arriba de todo (su botón incluido). */
async function responder(sesion, label) {
  await tocar(sesion, `opcion-${label}`);
  await esperar(150);
  await tocar(sesion, 'boton-comprobar');
  await esperar(900);
}

/** El reto A2 (fallo y acierto, en español) y el B1 (fallo, en inglés). @param {any} c */
async function faseExplicacion({ sesion, url, retos, foto }) {
  const g1 = retos.find((r) => r.title === 'Rutina diaria · Gramática 1');
  const b1 = retos.find((r) => r.title === 'Trabajo · Gramática 1');
  await sesion.navegar(`${url}#/retos/${g1.id}`);
  await sesion.recargar();
  await esperar(1200);
  await tocar(sesion, 'opcion-A'); await esperar(500);
  await foto('l1-01-a2-elegida');
  await tocar(sesion, 'boton-comprobar'); await esperar(900);
  await foto('l1-02-a2-fallo-espanol');
  await tocar(sesion, 'boton-siguiente'); await esperar(600);
  await responder(sesion, 'B');
  await foto('l1-03-a2-acierto-espanol');
  await sesion.navegar(`${url}#/retos/${b1.id}`);
  await esperar(1200);
  await responder(sesion, 'A');
  await foto('l1-04-b1-fallo-ingles');
  await tocar(sesion, 'boton-siguiente'); await esperar(600);
  await responder(sesion, 'A');
  await foto('l1-05-b1-acierto-ingles');
}

/** @param {{ancho: number, alto: number}} ventana @param {string} carpeta @param {string[]} hechas */
async function serie(ventana, carpeta, hechas) {
  await conAppCompleta(async (url, estado) => {
    const retos = sembrarRetosPractica(estado, [...estado.groups.values()][0].id);
    const sesion = await abrirSesion(ventana);
    const foto = async (/** @type {string} */ nombre) => {
      const archivo = `${nombre}-${ventana.ancho}.png`;
      writeFileSync(join(carpeta, archivo), await sesion.capturar());
      hechas.push(archivo);
    };
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await faseExplicacion({ sesion, url, retos, foto, estado });
    } finally { await sesion.cerrar(); }
  });
}

async function main() {
  const carpeta = resolve(process.argv[2] || join(RAIZ, 'salida', 'practica'));
  mkdirSync(carpeta, { recursive: true });
  /** @type {string[]} */
  const hechas = [];
  for (const ventana of VENTANAS) await serie(ventana, carpeta, hechas);
  writeFileSync(join(carpeta, 'indice.json'), `${JSON.stringify(hechas, null, 2)}\n`);
  console.log(`capturas_practica: ${hechas.length} capturas en ${carpeta}`);
}

main().catch((e) => { console.error('capturas_practica: falló', e); process.exit(1); });
