#!/usr/bin/env node
// @ts-check
// sincronizar_diseno.mjs · Copia de solo lectura de diseno/ hacia publico/diseno/ (R1, ESPEC_mvp_uis.md §9.2).
//
// engrama-web NUNCA define sus propios colores: los toma de diseno/tokens.json (decisión 001).
// Como el cliente no tiene build, no puede "importar" diseno/dist/tokens.css desde fuera de su
// propia carpeta (el navegador solo sirve lo que está bajo engrama-web/publico/). Este script
// copia las salidas ya generadas de diseno/ (no las regenera: eso es trabajo de diseno/herramientas/).
//
// Uso:
//   node herramientas/sincronizar_diseno.mjs             copia diseno/ → publico/diseno/
//   node herramientas/sincronizar_diseno.mjs --verificar  no copia; sale 1 si algo está desincronizado
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ_PROYECTO = resolve(AQUI, '..');
// diseno/ vive dos niveles arriba de engrama-web/ (ENGRAMA/engrama-web → ENGRAMA → INGLES/diseno).
export const RAIZ_DISENO = resolve(RAIZ_PROYECTO, '..', '..', 'diseno');

const ESTADOS_DRAKO = ['presenta', 'piensa', 'explica', 'celebra', 'ups', 'espera', 'icono-32'];

/** @returns {{origen: string, destino: string}[]} los pares (origen en diseno/, destino en publico/diseno/) que R1 exige idénticos */
export function archivosASincronizar() {
  const pares = [
    { origen: join(RAIZ_DISENO, 'dist', 'tokens.css'), destino: join(RAIZ_PROYECTO, 'publico', 'diseno', 'tokens.css') },
  ];
  for (const estado of ESTADOS_DRAKO) {
    pares.push({
      origen: join(RAIZ_DISENO, 'personajes', 'drako', `${estado}.svg`),
      destino: join(RAIZ_PROYECTO, 'publico', 'diseno', 'drako', `${estado}.svg`),
    });
  }
  return pares;
}

/** @param {string} ruta */
function sha256DeArchivo(ruta) {
  if (!existsSync(ruta)) return null;
  return createHash('sha256').update(readFileSync(ruta)).digest('hex');
}

/**
 * Compara cada par sin copiar nada.
 * @returns {{origen: string, destino: string, motivo: string}[]} discrepancias (vacío si todo está sincronizado)
 */
export function verificarSincronizado() {
  const discrepancias = [];
  for (const { origen, destino } of archivosASincronizar()) {
    if (!existsSync(origen)) { discrepancias.push({ origen, destino, motivo: 'no existe el origen en diseno/' }); continue; }
    if (!existsSync(destino)) { discrepancias.push({ origen, destino, motivo: 'no existe el destino en publico/diseno/' }); continue; }
    if (sha256DeArchivo(origen) !== sha256DeArchivo(destino)) {
      discrepancias.push({ origen, destino, motivo: 'el sha256 no coincide' });
    }
  }
  return discrepancias;
}

/** Copia cada archivo de diseno/ a publico/diseno/, creando carpetas si hace falta. */
export function sincronizar() {
  const copiados = [];
  for (const { origen, destino } of archivosASincronizar()) {
    if (!existsSync(origen)) throw new Error(`no encontré ${origen} (diseno/ es de solo lectura; ¿se regeneró?)`);
    mkdirSync(dirname(destino), { recursive: true });
    copyFileSync(origen, destino);
    copiados.push(destino);
  }
  return copiados;
}

function main() {
  const verificarSolo = process.argv.includes('--verificar');
  if (verificarSolo) {
    const discrepancias = verificarSincronizado();
    if (discrepancias.length === 0) {
      console.log('sincronizar_diseno: publico/diseno/ está al día con diseno/ (R1).');
      process.exit(0);
    }
    console.error('sincronizar_diseno: desincronizado —');
    for (const d of discrepancias) console.error(`  ${d.destino}: ${d.motivo}`);
    process.exit(1);
  }
  const copiados = sincronizar();
  console.log(`sincronizar_diseno: copiados ${copiados.length} archivos a publico/diseno/.`);
  for (const c of copiados) console.log(`  ${c}`);
}

// Comparamos rutas ya resueltas (no las URL crudas) para que Windows y POSIX se comporten igual.
const esCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCLI) main();
