// @ts-check
// W34 · V5 (docs/ESPEC_pantallas_anillo.md §9.3): en src/, `pase=` y `tenant=` aparecen SOLO en src/anillo/enlace.js, y `?pase` en ninguno.
// Se prueba contra proyectos de mentira (como verificar.test.mjs) y contra el src/ real. Tramposo: x_pase_fuera_de_enlace.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verificar } from '../../herramientas/verificar.mjs';

function proyectoDePrueba(archivos) {
  const raiz = mkdtempSync(join(tmpdir(), 'engrama-web-v5-'));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = join(raiz, ruta);
    mkdirSync(join(destino, '..'), { recursive: true });
    writeFileSync(destino, contenido);
  }
  return raiz;
}
const v5 = (resultado) => resultado.violaciones.filter((v) => v.check === 'V5');

test('V5: pase= o tenant= fuera de src/anillo/enlace.js se marcan; dentro de enlace.js no', () => {
  const raiz = proyectoDePrueba({
    'src/anillo/enlace.js': "export const f = (p, t) => `#pase=${p}&tenant=${t}`;",
    'src/vistas/profe/grupos.js': "export const g = (p) => '#pase=' + p;",
    'src/vistas/estudiante/vivo.js': "export const h = (t) => `x&tenant=${t}`;",
    'src/api/cliente.js': "// el pase=... en un comentario no cuenta\nexport const ok = 1;",
  });
  try {
    const r = v5(verificar(raiz));
    assert.deepEqual(r.map((v) => v.archivo.replaceAll('\\', '/')).sort(), ['src/vistas/estudiante/vivo.js', 'src/vistas/profe/grupos.js']);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('V5: el pase en la consulta (?pase) se marca en CUALQUIER archivo, también en enlace.js', () => {
  const raiz = proyectoDePrueba({
    'src/anillo/enlace.js': "export const f = (b, p) => b + '?pase=' + p;",
    'src/vistas/otra.js': "export const g = (b) => `${b}?pase`;",
    'src/vistas/limpia.js': "export const ok = (c) => (c ? pase : null);",
  });
  try {
    const r = v5(verificar(raiz));
    const archivos = r.map((v) => v.archivo.replaceAll('\\', '/'));
    assert.ok(archivos.includes('src/anillo/enlace.js') && archivos.includes('src/vistas/otra.js'));
    assert.ok(!archivos.includes('src/vistas/limpia.js'), 'un ternario con una variable llamada pase no es una consulta');
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('V5: en el src/ real, pase= y tenant= aparecen solo en src/anillo/enlace.js, y ?pase en ninguno', () => {
  const r = v5(verificar());
  assert.deepEqual(r, [], r.map((v) => `${v.archivo}:${v.linea} ${v.detalle}`).join('\n'));
});
