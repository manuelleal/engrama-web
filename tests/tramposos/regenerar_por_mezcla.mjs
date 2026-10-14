#!/usr/bin/env node
// @ts-check
// regenerar_por_mezcla.mjs · Rehace las copias rotas de UN archivo bueno que acaba de cambiar: copia rota = el archivo bueno de ahora + SU defecto.
// Para cada tramposo cuyo manifiesto reemplaza ese archivo:
//   1. busca en la historia la versión del archivo de la que salió la copia (la que menos líneas difiere de ella: "una copia vieja se regenera
//      desde la versión de la historia de la que salió, no desde el último commit", CLAUDE.md);
//   2. mezcla a tres bandas con `git merge-file`: lo bueno de ahora + (la copia − esa versión) = el mismo defecto sobre el archivo nuevo;
//   3. si la mezcla choca, NO escribe nada y lo dice (esa copia se rehace a mano).
// Después hay que confirmar, por nombre y uno a la vez, que cada tramposo sigue rojo en su prueba (`node tests/correr_tramposos.mjs <nombre>`).
// Uso: node tests/tramposos/regenerar_por_mezcla.mjs src/vistas/estudiante/inicio.js [--seco]
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const AQUI = fileURLToPath(new URL('.', import.meta.url));
const lf = (/** @type {string} */ t) => t.replace(/\r\n/g, '\n');

function git(args, entrada) {
  const r = spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8', input: entrada, maxBuffer: 64 * 1024 * 1024 });
  return { codigo: r.status ?? 1, salida: r.stdout, error: r.stderr };
}

/** Cuántas líneas difieren dos textos (agregadas + quitadas), con `git diff --no-index`. */
function distancia(dir, a, b) {
  writeFileSync(join(dir, 'a'), a); writeFileSync(join(dir, 'b'), b);
  const r = git(['diff', '--no-index', '--numstat', join(dir, 'a'), join(dir, 'b')]);
  const [mas, menos] = r.salida.trim().split(/\s+/).map(Number);
  return (mas || 0) + (menos || 0);
}

/**
 * Si la mezcla choca (el defecto toca una línea vecina de lo que cambió), cada bloque del defecto se aplica como reemplazo de texto: el bloque
 * quitado debe aparecer UNA vez en el archivo de ahora. Un bloque que solo agrega (sin nada quitado) no tiene dónde anclarse: null (a mano).
 */
function porReemplazo(dir, ahora, base, rota) {
  writeFileSync(join(dir, 'a'), base); writeFileSync(join(dir, 'b'), rota);
  const diff = git(['diff', '--no-index', '-U0', join(dir, 'a'), join(dir, 'b')]).salida.split('\n');
  let texto = ahora;
  for (let i = 0; i < diff.length; i++) {
    if (!diff[i].startsWith('@@')) continue;
    const antes = []; const despues = [];
    for (i++; i < diff.length && !diff[i].startsWith('@@'); i++) {
      const l = diff[i];
      if (l.startsWith('\\')) continue;
      if (l.startsWith(' ')) { antes.push(l.slice(1)); despues.push(l.slice(1)); } else if (l.startsWith('-')) antes.push(l.slice(1)); else if (l.startsWith('+')) despues.push(l.slice(1));
    }
    i--;
    const de = `${antes.join('\n')}\n`; const a = `${despues.join('\n')}\n`;
    if (texto.split(de).length !== 2) return null;
    texto = texto.replace(de, () => a);
  }
  return texto;
}

/** Los tramposos (carpeta y archivo de la copia) que reemplazan `ruta`. */
function copiasDe(ruta) {
  return readdirSync(AQUI, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => {
    const m = join(AQUI, d.name, 'manifiesto.json');
    if (!existsSync(m)) return [];
    const archivo = JSON.parse(readFileSync(m, 'utf8')).archivos?.[ruta];
    return archivo ? [{ nombre: d.name, copia: join(AQUI, d.name, archivo) }] : [];
  });
}

function main() {
  const ruta = process.argv[2];
  const seco = process.argv.includes('--seco');
  if (!ruta) { console.error('uso: node tests/tramposos/regenerar_por_mezcla.mjs <ruta> [--seco]'); process.exit(2); }
  const ahora = lf(readFileSync(join(RAIZ, ruta), 'utf8'));
  const versiones = git(['log', '--format=%H', '--', ruta]).salida.trim().split('\n').filter(Boolean)
    .map((c) => ({ commit: c.slice(0, 7), texto: lf(git(['show', `${c}:${ruta}`]).salida) }));
  const dir = mkdtempSync(join(tmpdir(), 'mezcla-'));
  let fallas = 0;
  try {
    for (const { nombre, copia } of copiasDe(ruta)) {
      const rota = lf(readFileSync(copia, 'utf8'));
      const base = versiones.map((v) => ({ ...v, d: distancia(dir, v.texto, rota) })).sort((a, b) => a.d - b.d)[0];
      writeFileSync(join(dir, 'ahora'), ahora); writeFileSync(join(dir, 'base'), base.texto); writeFileSync(join(dir, 'rota'), rota);
      const m = git(['merge-file', '-p', join(dir, 'ahora'), join(dir, 'base'), join(dir, 'rota')]);
      if (m.codigo !== 0) m.salida = porReemplazo(dir, ahora, base.texto, rota) ?? '';
      if (!m.salida) { fallas++; console.log(`CHOCA  ${nombre} (base ${base.commit}, ${base.d} líneas): se rehace a mano`); continue; }
      if (m.salida === ahora) { fallas++; console.log(`VACÍA  ${nombre}: la mezcla quedó igual al archivo bueno (el defecto se perdió)`); continue; }
      if (!seco) writeFileSync(copia, m.salida);
      console.log(`${seco ? 'seco ' : 'hecha '} ${nombre} (base ${base.commit}, defecto de ${base.d} líneas)`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  process.exit(fallas ? 1 : 0);
}

main();
