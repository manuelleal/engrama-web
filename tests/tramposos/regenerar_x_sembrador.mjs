#!/usr/bin/env node
// @ts-check
// regenerar_x_sembrador.mjs · Rehace las copias rotas del sembrador (docs/ESPEC_sembrador_refuerzo.md §2) desde los archivos BUENOS de hoy:
// copia rota = el archivo de ahora + SU defecto, escrito aquí como un reemplazo de texto que debe calzar UNA vez (si el archivo bueno ya no trae
// ese texto, el tramposo dejó de romper algo y esto se detiene). Escribe también el manifiesto de cada uno. Córrelo cada vez que cambie uno de
// esos archivos y después confirma, por nombre, que cada tramposo sigue rojo: `node tests/correr_tramposos.mjs x_sembrador`.
// Uso: node tests/tramposos/regenerar_x_sembrador.mjs [nombre]   (sin nombre: todos)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const AQUI = fileURLToPath(new URL('.', import.meta.url));

/** @param {string} texto @param {string} de @param {string} a */
function cambiar(texto, de, a) {
  const partes = texto.split(de);
  if (partes.length !== 2) throw new Error(`regenerar_x_sembrador: se esperaba una vez "${de.slice(0, 80)}" y está ${partes.length - 1}`);
  return partes.join(a);
}

const MAPEO = 'herramientas/sembrar/mapeo.mjs';
const IDENTIDAD = 'tests/unit/sembrar_identidad.test.mjs';
const tap = (prueba) => ['node', '--test', '--test-reporter=tap', prueba];

/**
 * nombre → {archivo, comando, tests (los que deben quedar rojos; vacío = basta el código ≠ 0), descripcion, cambios}.
 * @type {Record<string, {archivo: string, comando: string[], tests: string[], descripcion: string, cambios: Array<[string, string]>}>}
 */
export const TRAMPOSOS = {
  x_sembrador_cambia_topic: {
    archivo: MAPEO, comando: tap(IDENTIDAD), tests: ['SR5: los cuerpos de a1-u01-my-family sin los campos nuevos son la foto de antes del cambio'],
    descripcion: 'SR5: el sembrador manda como topic el título de la unidad y no su id (la tanda ordena por topic: PEDIDO_sembrador §2 dice no cambiarlo)',
    cambios: [['cefr_level: unidad.nivel, skill: destreza, topic: unidad.id,', 'cefr_level: unidad.nivel, skill: destreza, topic: unidad.titulo,']],
  },
};

function main() {
  const solo = process.argv[2];
  for (const [nombre, t] of Object.entries(TRAMPOSOS)) {
    if (solo && nombre !== solo) continue;
    mkdirSync(`${AQUI}${nombre}`, { recursive: true });
    let texto = readFileSync(`${RAIZ}${t.archivo}`, 'utf8').replace(/\r\n/g, '\n');
    for (const [de, a] of t.cambios) texto = cambiar(texto, de, a);
    writeFileSync(`${AQUI}${nombre}/${basename(t.archivo)}`, texto);
    const manifiesto = {
      descripcion: t.descripcion, archivos: { [t.archivo]: basename(t.archivo) },
      comando: t.comando, espera_codigo_no_cero: true, espera_fallan_tests: t.tests,
    };
    writeFileSync(`${AQUI}${nombre}/manifiesto.json`, `${JSON.stringify(manifiesto, null, 2)}\n`);
    console.log(`regenerar_x_sembrador: ${nombre}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
