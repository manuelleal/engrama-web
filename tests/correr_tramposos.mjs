#!/usr/bin/env node
// @ts-check
// correr_tramposos.mjs · El runner de los tramposos (METODO regla 4, ESPEC_mvp_uis.md §9.3).
//
// Un tramposo es una versión ROTA de un archivo a propósito: cuenta como prueba solo si, al
// ponerlo en su lugar, el comando indicado sale en rojo (código ≠ 0) y además el motivo del rojo
// es el predicho (los checks de herramientas/verificar.mjs, o los nombres de test de node:test
// que debían fallar). Si un tramposo queda verde, es una alarma: la regla que creíamos que
// protegía ese caso no protege nada.
//
// Cada tests/tramposos/<nombre>/ trae un manifiesto.json:
//   {
//     "descripcion": "texto libre",
//     "archivos": { "<ruta relativa al proyecto>": "<archivo dentro de esta carpeta>" },
//     "comando": ["node", "herramientas/verificar.mjs", "--json"],
//     "espera_codigo_no_cero": true,
//     "espera_contiene_checks": ["V1"],           // opcional: código de herramientas/verificar.mjs
//     "espera_fallan_tests": ["nombre del test"]  // opcional: nombres exactos de node:test en rojo
//   }
//
// El runner respalda cada archivo que va a reemplazar (o anota que no existía), corre el
// comando, evalúa la predicción, y SIEMPRE restaura el árbol de trabajo al final, pase lo que
// pase — un tramposo nunca debe quedar pegado en el repo.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = resolve(AQUI, '..');
const CARPETA_TRAMPOSOS = join(RAIZ, 'tests', 'tramposos');

function listarTramposos() {
  if (!existsSync(CARPETA_TRAMPOSOS)) return [];
  return readdirSync(CARPETA_TRAMPOSOS)
    .filter((n) => statSync(join(CARPETA_TRAMPOSOS, n)).isDirectory())
    // `node tests/correr_tramposos.mjs <texto>`: solo los tramposos cuyo nombre contiene <texto>.
    .filter((n) => !process.argv[2] || n.includes(process.argv[2]))
    .sort();
}

/** Respalda `destino` (o anota que no existía) y escribe `contenido`. */
function reemplazar(destino, contenido) {
  const existia = existsSync(destino);
  const original = existia ? readFileSync(destino) : null;
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, contenido);
  return { destino, existia, original };
}

function restaurar(respaldo) {
  if (respaldo.existia) writeFileSync(respaldo.destino, respaldo.original);
  else rmSync(respaldo.destino, { force: true });
}

function evaluar(manifiesto, codigo, stdout) {
  const motivos = [];
  const codigoOk = !manifiesto.espera_codigo_no_cero || codigo !== 0;
  if (!codigoOk) motivos.push(`esperaba código ≠ 0, salió ${codigo}`);
  let jsonSalida = null;
  try { jsonSalida = JSON.parse(stdout); } catch { /* el comando no habla JSON; no pasa nada */ }
  for (const check of manifiesto.espera_contiene_checks || []) {
    const checks = (jsonSalida?.violaciones || []).map((v) => v.check);
    if (!checks.includes(check)) motivos.push(`esperaba el check ${check} entre las violaciones, y no salió`);
  }
  // Formato TAP (`node --test --test-reporter=tap`): una línea "not ok N - <nombre>" por test
  // que falló. Exigimos esa línea exacta, no solo que el nombre aparezca en algún lado del
  // stdout (podría aparecer en un test que SÍ pasó, si dos nombres se parecen).
  for (const nombre of manifiesto.espera_fallan_tests || []) {
    const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`^not ok \\d+ - .*${escapado}`, 'm').test(stdout)) {
      motivos.push(`esperaba la línea TAP "not ok ... ${nombre}", y no salió`);
    }
  }
  return motivos;
}

function correrUno(nombre) {
  const carpeta = join(CARPETA_TRAMPOSOS, nombre);
  const manifiesto = JSON.parse(readFileSync(join(carpeta, 'manifiesto.json'), 'utf8'));
  const respaldos = [];
  try {
    for (const [rutaRelativa, archivoFuente] of Object.entries(manifiesto.archivos)) {
      const contenido = readFileSync(join(carpeta, archivoFuente));
      respaldos.push(reemplazar(join(RAIZ, rutaRelativa), contenido));
    }
    const [cmd, ...args] = manifiesto.comando;
    const resultado = spawnSync(cmd, args, { cwd: RAIZ, encoding: 'utf8' });
    const codigo = resultado.status ?? 1;
    const motivos = evaluar(manifiesto, codigo, resultado.stdout || '');
    return { nombre, descripcion: manifiesto.descripcion, ok: motivos.length === 0, motivos };
  } finally {
    for (const r of respaldos) restaurar(r);
  }
}

function main() {
  const nombres = listarTramposos();
  if (nombres.length === 0) {
    console.log('correr_tramposos: no hay tramposos en tests/tramposos/.');
    process.exit(0);
  }
  const resultados = nombres.map(correrUno);
  for (const r of resultados) {
    const marca = r.ok ? 'ROJO (correcto)' : 'NO SE PUSO ROJO COMO SE PREDIJO';
    console.log(`[${r.ok ? 'OK' : 'FALLA'}] ${r.nombre} — ${marca}`);
    if (!r.ok) for (const m of r.motivos) console.log(`    ${m}`);
  }
  const fallidos = resultados.filter((r) => !r.ok);
  console.log(`\ncorrer_tramposos: ${resultados.length - fallidos.length}/${resultados.length} tramposos se comportaron como se predijo.`);
  process.exit(fallidos.length === 0 ? 0 : 1);
}

main();
