#!/usr/bin/env node
// @ts-check
// capturas_lectura.mjs · W84 (docs/ESPEC_lectura_texto.md §4): el reto de LECTURA contra el doble, a 375 × 667 y a 1280 × 800, para MIRARLO y
// MEDIRLO: la afirmación 1, la 1 tras Comprobar, la 2, el texto plegado tras elegir, la revisión (plegado) y la revisión con el texto abierto. Escribe
// las fotos y `lectura.json` (lo medido en cada paso con herramientas/humo/medir_lectura.mjs: si el texto que se ve es la `description`, su `lang`, el
// alto del bloque y dónde empieza la primera opción frente a la barra fija). Sirve también para el ANTES (sin el bloque: `hay: false`).
// Cada ancho arranca con su doble recién sembrado. Nada toca el piloto ni un puerto fijo.
// Uso: node herramientas/capturas_lectura.mjs [carpeta] [--replica]   (por defecto: salida/web_lectura/; --replica usa RETO_LECTURA_REPLICA)
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';
import { abrirSesion } from './cdp.mjs';
import { sembrarRetoLectura, RETO_LECTURA, RETO_LECTURA_REPLICA } from './humo/entradas_practica.mjs';
import { MEDIR_LECTURA } from './humo/medir_lectura.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const VENTANAS = [{ ancho: 375, alto: 667 }, { ancho: 1280, alto: 800 }];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Toca un testid en cuanto aparece (hasta 4 s); si no aparece, devuelve false. */
const tocar = (sesion, testid) => sesion.evaluar(`(async () => {
  for (let i = 0; i < 80 && !document.querySelector('[data-testid="${testid}"]'); i++) await new Promise((r) => setTimeout(r, 50));
  const n = document.querySelector('[data-testid="${testid}"]'); if (!n) return false; n.click(); return true;
})()`);
/** El rótulo del bloque (plegar o abrir); sin bloque, nada. */
const alternarTexto = (sesion) => sesion.evaluar("(() => { const s = document.querySelector('[data-testid=\"lectura-rotulo\"]'); if (s) s.click(); return Boolean(s); })()");

/** @param {{ancho: number, alto: number}} ventana @param {string} carpeta @param {any[]} reto @param {any[]} pasos */
async function serie(ventana, carpeta, reto, pasos) {
  await conAppCompleta(async (url, estado) => {
    const sembrado = sembrarRetoLectura(estado, [...estado.groups.values()][0].id, reto);
    const sesion = await abrirSesion(ventana);
    const paso = async (/** @type {string} */ nombre) => {
      const archivo = `${nombre}-${ventana.ancho}.png`;
      writeFileSync(join(carpeta, archivo), await sesion.capturar());
      const m = await sesion.evaluar(MEDIR_LECTURA);
      pasos.push({ ancho: ventana.ancho, paso: nombre, archivo, ...m, textoEsLaDescription: m.texto === null ? null : m.texto === sembrado.description });
    };
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await sesion.navegar(`${url}#/retos/${sembrado.id}`);
      await sesion.recargar();
      await esperar(1500);
      await paso('lectura-01-afirmacion-1');
      await tocar(sesion, 'opcion-V'); await esperar(400);
      await tocar(sesion, 'boton-comprobar'); await esperar(900);
      await paso('lectura-02-tras-comprobar');
      await tocar(sesion, 'boton-siguiente'); await esperar(700);
      await paso('lectura-03-afirmacion-2');
      await alternarTexto(sesion); await esperar(200);
      await tocar(sesion, 'opcion-V'); await esperar(400);
      await paso('lectura-04-plegado-tras-elegir');
      await alternarTexto(sesion); await esperar(200);
      for (let i = 1; i < sembrado.questions.length; i++) {
        await tocar(sesion, 'opcion-V'); await esperar(250);
        await tocar(sesion, 'boton-comprobar'); await esperar(700);
        if (i < sembrado.questions.length - 1) { await tocar(sesion, 'boton-siguiente'); await esperar(500); }
      }
      await tocar(sesion, 'boton-terminar'); await esperar(3500); // la línea de tiempo del fin de reto
      await paso('lectura-05-revision');
      await alternarTexto(sesion); await esperar(300);
      await sesion.evaluar("document.querySelector('[data-testid=\"lectura\"]')?.scrollIntoView({ block: 'start' })"); await esperar(300);
      await paso('lectura-06-revision-texto-abierto');
      pasos.push({ ancho: ventana.ancho, errores: sesion.errores });
    } finally { await sesion.cerrar(); }
  });
}

async function main() {
  const replica = process.argv.includes('--replica');
  const carpeta = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || join(RAIZ, 'salida', 'web_lectura'));
  mkdirSync(carpeta, { recursive: true });
  const reto = replica ? RETO_LECTURA_REPLICA : RETO_LECTURA;
  /** @type {any[]} */
  const pasos = [];
  for (const ventana of VENTANAS) await serie(ventana, carpeta, reto, pasos);
  const texto = `${JSON.stringify({ reto: reto[0], replica, pasos }, null, 2)}\n`;
  writeFileSync(join(carpeta, 'lectura.json'), texto);
  console.log(`capturas_lectura: ${pasos.filter((p) => p.archivo).length} capturas en ${carpeta}; lectura.json sha256 ${createHash('sha256').update(texto).digest('hex')}`);
}

main().catch((e) => { console.error('capturas_lectura: falló', e); process.exit(1); });
