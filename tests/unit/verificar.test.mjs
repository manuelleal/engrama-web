// @ts-check
// Prueba herramientas/verificar.mjs (V1-V4 y tamaños) contra proyectos de mentira en una carpeta
// temporal, para no depender del estado real de engrama-web/ (que va a crecer con cada encargo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verificar } from '../../herramientas/verificar.mjs';

/** Crea un proyecto de mentira: { 'src/api/core.js': '...' } → escribe cada archivo bajo un raíz temporal. */
function proyectoDePrueba(archivos) {
  const raiz = mkdtempSync(join(tmpdir(), 'engrama-web-verificar-'));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = join(raiz, ruta);
    mkdirSync(join(destino, '..'), { recursive: true });
    writeFileSync(destino, contenido);
  }
  return raiz;
}

function violacionesDe(resultado, check) {
  return resultado.violaciones.filter((v) => v.check === check);
}

test('V1: un fetch a /rest/v1 se marca; una llamada a /api/... no', () => {
  const raiz = proyectoDePrueba({
    'src/api/core.js': "export async function feo() { await fetch(supaUrl + '/rest/v1/profiles'); }",
    'src/api/cliente.js': "export async function sano() { await fetch('/api/core/coins/balance'); }",
  });
  try {
    const r = verificar(raiz);
    assert.equal(violacionesDe(r, 'V1').length, 1);
    assert.match(violacionesDe(r, 'V1')[0].archivo, /core\.js$/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('V2: una clave en publico/ se marca; la copia de diseno/ (R1) no se revisa', () => {
  const raiz = proyectoDePrueba({
    'publico/catalogo.json': '{"pregunta":"...", "correct_answer":"A"}',
    'publico/diseno/drako/nota.json': '{"clave":"esto no debería importar, es de diseno/"}',
  });
  try {
    const r = verificar(raiz);
    const v2 = violacionesDe(r, 'V2');
    assert.equal(v2.length, 1);
    assert.match(v2[0].archivo, /catalogo\.json$/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('V3 (CSS): un hex crudo se marca; var(--token) y color-mix() con white no', () => {
  const raiz = proyectoDePrueba({
    'estilos/componentes.css': [
      '.mal { color: #3b82f6; }',
      '.bien { color: var(--primario); }',
      '.bien2 { background: color-mix(in srgb, var(--primario) 80%, white 20%); }',
    ].join('\n'),
  });
  try {
    const r = verificar(raiz);
    const v3 = violacionesDe(r, 'V3');
    assert.equal(v3.length, 1);
    assert.match(v3[0].detalle, /#3b82f6/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('V3 (SVG): fill="red" fuera de publico/diseno se marca; dentro de publico/diseno no', () => {
  const raiz = proyectoDePrueba({
    'publico/iconos/prueba.svg': '<svg><path fill="red"/></svg>',
    'publico/diseno/drako/presenta.svg': '<svg><path fill="#003366"/></svg>',
  });
  try {
    const r = verificar(raiz);
    const v3 = violacionesDe(r, 'V3');
    assert.equal(v3.length, 1);
    assert.match(v3[0].archivo, /prueba\.svg$/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('V4: innerHTML se marca; textContent no', () => {
  const raiz = proyectoDePrueba({
    'src/ui/dom.js': [
      "export function feo(el) { el.innerHTML = '<b>hola</b>'; }",
      "export function sano(el) { el.textContent = 'hola'; }",
    ].join('\n'),
  });
  try {
    const r = verificar(raiz);
    const v4 = violacionesDe(r, 'V4');
    assert.equal(v4.length, 1);
    assert.match(v4[0].detalle, /innerHTML/);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('tamaños: un archivo de 401 líneas se marca; uno de 40 no', () => {
  const grande = 'export const x = 1;\n'.repeat(401);
  const chico = 'export const x = 1;\n'.repeat(40);
  const raiz = proyectoDePrueba({ 'src/grande.js': grande, 'src/chico.js': chico });
  try {
    const r = verificar(raiz);
    const archivos = violacionesDe(r, 'TAMANO_ARCHIVO').map((v) => v.archivo);
    assert.ok(archivos.some((a) => a.endsWith('grande.js')));
    assert.ok(!archivos.some((a) => a.endsWith('chico.js')));
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('tamaños: una función simple de 41 líneas da 1 violación (no 2 por el `for` de adentro)', () => {
  // Antes, un bloque `if`/`for`/`while` que termina en `) {` se contaba como "función" aparte:
  // esta función de sobra tenía un `for` largo adentro y salían 2 violaciones (una por la
  // función real, otra espuria por el `for`) en vez de 1. Es la regresión de ese bug.
  const cuerpo = 'x++;\n'.repeat(41);
  const codigo = [
    'export function largoControl(n) {',
    '  for (let i = 0; i < n; i++) {',
    cuerpo,
    '  }',
    '}',
    'export function sano(n) {',
    '  if (n > 0) {',
    '    x++;',
    '  }',
    '}',
  ].join('\n');
  const raiz = proyectoDePrueba({ 'src/tamanos.js': codigo });
  try {
    const r = verificar(raiz);
    const funciones = violacionesDe(r, 'TAMANO_FUNCION');
    assert.equal(funciones.length, 1, 'una sola violación: la función, no también el `for` de adentro');
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('un proyecto limpio no tiene violaciones', () => {
  const raiz = proyectoDePrueba({
    'src/api/cliente.js': "export async function pedir(ruta) { return fetch('/api' + ruta); }",
    'estilos/base.css': '.tarjeta { color: var(--texto); border-radius: var(--radio-md); }',
  });
  try {
    const r = verificar(raiz);
    assert.deepEqual(r.violaciones, []);
    assert.equal(r.ok, true);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});
