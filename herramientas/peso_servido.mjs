#!/usr/bin/env node
// @ts-check
// peso_servido.mjs · H-5 (docs/ESPEC_correcciones_practica.md): el peso de la precarga del shell COMO SE SIRVE. Exporta un commit con `git archive`
// tal como lo hace el despliegue en esta máquina (por defecto con core.autocrlf=true, el peor caso), lee el tar y suma los archivos de `PRECARGA`
// de sw.js (`/` es index.html). Con `text eol=lf` en .gitattributes el número debe ser el mismo que mide U59 (tests/unit/sw_peso.test.mjs) sobre la
// copia de trabajo. Escribe salida/peso_servido.json. No toca nada: solo lee la historia de git.
// Uso: node herramientas/peso_servido.mjs [commit] [--autocrlf true|false]   (por defecto: HEAD y true)
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const TECHO = 830_000;

/** Los archivos de un tar (ustar, con las cabeceras pax de git para nombres largos): nombre → bytes. @param {Buffer} tar */
export function leerTar(tar) {
  const archivos = new Map();
  let i = 0;
  let nombreLargo = null;
  while (i + 512 <= tar.length) {
    const cabecera = tar.subarray(i, i + 512);
    if (cabecera.every((b) => b === 0)) break;
    const texto = (/** @type {number} */ a, /** @type {number} */ b) => cabecera.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    const tamano = parseInt(texto(124, 136).trim() || '0', 8);
    const tipo = texto(156, 157);
    const cuerpo = tar.subarray(i + 512, i + 512 + tamano);
    if (tipo === 'x') nombreLargo = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(cuerpo.toString('utf8'))?.[1] ?? null;
    else if (tipo === '0' || tipo === '') {
      const prefijo = texto(345, 500);
      archivos.set(nombreLargo ?? (prefijo ? `${prefijo}/${texto(0, 100)}` : texto(0, 100)), tamano);
      nombreLargo = null;
    }
    i += 512 + Math.ceil(tamano / 512) * 512;
  }
  return archivos;
}

/** Las rutas de `PRECARGA` en el sw.js de ese commit. @param {string} sw */
function precargaDe(sw) {
  const bloque = /const PRECARGA = \[([\s\S]*?)\n\];/.exec(sw)?.[1] || '';
  return [...bloque.matchAll(/^\s*'([^']+)'/gm)].map((m) => (m[1] === '/' ? 'index.html' : m[1].slice(1)));
}

function git(/** @type {string[]} */ args) {
  const r = spawnSync('git', args, { cwd: RAIZ, maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

function main() {
  const args = process.argv.slice(2);
  const iCrlf = args.indexOf('--autocrlf');
  const autocrlf = iCrlf >= 0 ? args[iCrlf + 1] : 'true';
  const commit = args.find((a, i) => !a.startsWith('--') && (iCrlf < 0 || i !== iCrlf + 1)) || 'HEAD';
  const sha = git(['rev-parse', '--short', commit]).toString().trim();
  const tar = leerTar(git(['-c', `core.autocrlf=${autocrlf}`, 'archive', '--format=tar', commit]));
  const precarga = precargaDe(git(['show', `${commit}:sw.js`]).toString('utf8'));
  const faltan = precarga.filter((a) => !tar.has(a));
  const bytes = precarga.reduce((s, a) => s + (tar.get(a) ?? 0), 0);
  const version = /const VERSION = '([^']+)'/.exec(git(['show', `${commit}:sw.js`]).toString('utf8'))?.[1] ?? null;
  const salida = { commit: sha, autocrlf, version_shell: version, precarga: precarga.length, bytes_servidos: bytes, techo: TECHO, margen: TECHO - bytes, faltan };
  mkdirSync(join(RAIZ, 'salida'), { recursive: true });
  writeFileSync(join(RAIZ, 'salida', 'peso_servido.json'), `${JSON.stringify(salida, null, 2)}\n`);
  console.log(`peso_servido: ${sha} (autocrlf=${autocrlf}, ${version}): PRECARGA ${precarga.length} entradas, ${bytes} bytes servidos; margen ${TECHO - bytes}${faltan.length ? `; FALTAN ${faltan.join(', ')}` : ''}`);
  process.exit(faltan.length || bytes > TECHO ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
