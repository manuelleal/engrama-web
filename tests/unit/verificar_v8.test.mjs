// @ts-check
// W71 · V8 (docs/ESPEC_navegacion.md §5.7, §9.3): en `src/vistas/` ningún archivo arma su propio "volver". El único es el de `src/ui/encabezado.js`,
// y a dónde vuelve cada pantalla lo dice la tabla de `src/navegacion.js`. Se prueba contra proyectos de mentira (como verificar.test.mjs) y
// contra el `src/` real. Tramposo: x_volver_casero (profe/errores.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verificar, RAIZ } from '../../herramientas/verificar.mjs';
import { VISTAS_CON_VOLVER_PROPIO } from '../../herramientas/verificar_v8.mjs';

function proyectoDePrueba(archivos) {
  const raiz = mkdtempSync(join(tmpdir(), 'engrama-web-v8-'));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const destino = join(raiz, ruta);
    mkdirSync(join(destino, '..'), { recursive: true });
    writeFileSync(destino, contenido);
  }
  return raiz;
}
const v8 = (resultado) => resultado.violaciones.filter((v) => v.check === 'V8').map((v) => v.archivo.replaceAll('\\', '/'));

test('V8: un volver armado en una vista se marca (por su data-testid, por la palabra "Volver" o por un texto volver…); usar el encabezado, no', () => {
  const raiz = proyectoDePrueba({
    'src/vistas/profe/por_testid.js': "export const a = (h, gid) => h('a', { href: '#/profe/grupo/' + gid, 'data-testid': 'volver-al-grupo' }, 'Al grupo');",
    'src/vistas/profe/por_palabra.js': "export const b = (h) => h('a', { href: '#/profe/grupos' }, 'Volver a Mis grupos');",
    'src/vistas/estudiante/por_texto.js': "export const c = (h, T) => h('a', { href: '#/inicio' }, T.volverInicio);",
    'src/vistas/admin/por_textos.js': "export const d = (h, textos) => h('a', { href: '#/admin' }, textos.admin.importarCsv.volverAAdmin);",
    'src/vistas/profe/bien.js': "import { crearEncabezado } from '../../ui/encabezado.js';\n// Volver al grupo: en un comentario no cuenta\nexport const e = (h) => { const enc = crearEncabezado('/profe/grupo/:gid/logro', { gid: 'g1' }); return h('div', {}, enc.volver, enc.titulo); };\nexport const alVolverDeOtroOrigen = (ctx) => ctx.alVolver?.();",
    'src/ui/encabezado.js': "export const crearVolver = (h, camino, nombre) => h('a', { href: '#' + camino, 'data-testid': 'volver', 'aria-label': 'Volver a ' + nombre }, '‹ ' + nombre);",
    'src/textos.js': "export const textos = { revision: { volver: 'Volver a mis retos' } };",
  });
  try {
    assert.deepEqual(v8(verificar(raiz)).sort(), ['src/vistas/admin/por_textos.js', 'src/vistas/estudiante/por_texto.js', 'src/vistas/profe/por_palabra.js', 'src/vistas/profe/por_testid.js']);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('V8: la lista cerrada (pantallas sin router y el cierre de la celebración) puede tener su "volver"; el mismo código en otra vista se marca', () => {
  const propio = "export const f = (h, T) => h('button', { type: 'button', 'data-testid': 'aviso-volver' }, T.volver);";
  const raiz = proyectoDePrueba({
    'src/vistas/registro.js': propio, 'src/vistas/esperando.js': propio, 'src/vistas/aviso_datos.js': propio, 'src/vistas/datos_solicitudes.js': propio,
    'src/vistas/estudiante/revision.js': propio,
    'src/vistas/perfil.js': propio, 'src/vistas/profe/revision.js': propio,
  });
  try {
    assert.deepEqual([...new Set(v8(verificar(raiz)))].sort(), ['src/vistas/perfil.js', 'src/vistas/profe/revision.js']);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('V8: en el src/ real ninguna vista arma su propio volver, y cada archivo de la lista cerrada existe', () => {
  const r = verificar().violaciones.filter((v) => v.check === 'V8');
  assert.deepEqual(r, [], r.map((v) => `${v.archivo}:${v.linea} ${v.detalle}`).join('\n'));
  for (const archivo of VISTAS_CON_VOLVER_PROPIO) assert.ok(existsSync(join(RAIZ, 'src', 'vistas', archivo)), `${archivo}: está en la lista cerrada y ya no existe`);
  assert.deepEqual([...VISTAS_CON_VOLVER_PROPIO].map((a) => a.replaceAll('\\', '/')).sort(), ['aviso_datos.js', 'datos_solicitudes.js', 'esperando.js', 'estudiante/revision.js', 'registro.js'], 'la lista es CERRADA: agregar un archivo es una decisión, no un descuido');
});
