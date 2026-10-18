#!/usr/bin/env node
// @ts-check
// capturas_banda.mjs · Tanda visual 3 (adenda de docs/ESPEC_visual_reto_tanda2.md, hallazgo 4 de la compuerta 21): el reto pregunta por pregunta contra el doble,
// tras CADA "Comprobar", a 375 × 667 y a 1280 × 800, en lectura y en gramática/vocabulario. Escribe una foto por paso y `banda.json` con la geometría de cada uno
// (herramientas/humo/medir_banda.mjs): sirve para el ANTES y el DESPUÉS. Cada escenario arranca con su doble recién sembrado. Nada toca el piloto.
// Uso: node herramientas/capturas_banda.mjs <carpeta> [--reducido]
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';
import { ESCENARIOS, VENTANAS, recorrerEscenario } from './humo/guion_banda.mjs';

async function main() {
  const reducido = process.argv.includes('--reducido');
  const carpeta = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || 'salida/web_banda');
  mkdirSync(carpeta, { recursive: true });
  /** @type {any[]} */
  const pasos = [];
  for (const ventana of VENTANAS) {
    for (const escenario of ESCENARIOS) {
      await recorrerEscenario(ventana, escenario, async (paso, medida, sesion) => {
        const archivo = `${paso.escenario}-p${paso.indice + 1}-${paso.ancho}.png`;
        writeFileSync(join(carpeta, archivo), await sesion.capturar());
        const { opciones, ...resto } = medida;
        pasos.push({ archivo, ...paso, ...resto, opciones: opciones.map((/** @type {any} */ o) => `${o.label}${o.marcada ? `(${o.marcada})` : ''} ${o.arriba}-${o.abajo}`) });
      }, { reducido, conAppCompleta });
    }
  }
  const texto = `${JSON.stringify({ reducido, pasos }, null, 2)}\n`;
  writeFileSync(join(carpeta, 'banda.json'), texto);
  const mal = pasos.filter((p) => !(p.enunciadoVisible && p.marcadasVisibles && p.bandaVisible));
  console.log(`capturas_banda: ${pasos.length} pasos en ${carpeta}; ${mal.length} con algo tapado o fuera: ${mal.map((p) => `${p.escenario}-p${p.indice + 1}-${p.ancho}`).join(', ') || 'ninguno'}; banda.json sha256 ${createHash('sha256').update(texto).digest('hex')}`);
}

main().catch((e) => { console.error('capturas_banda: falló', e); process.exit(1); });
