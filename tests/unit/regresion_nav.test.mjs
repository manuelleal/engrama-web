// @ts-check
// R9 (docs/ESPEC_navegacion.md §9.1, METODO regla 4): regresión = identidad para las vistas que R4 no cubre y la espec de navegación edita.
// Se pintan con entradas fijas (fotos_de_navegacion.mjs), en contenido, vacío y error, y se comparan línea por línea con la foto tomada en
// 2cba0b8, ANTES de tocar `src/` (tests/snapshots/vistas_nav_2cba0b8.json). Un commit posterior cambia SOLO el nodo que declara: la declaración
// vive aquí abajo, en DECLARADAS_NAV, con el encargo de §11 que la autoriza. La línea base no se regenera.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tomarFotosNav } from './fotos_de_navegacion.mjs';
import { sinSubarboles } from './foto_vistas.mjs';

const BASE = JSON.parse(readFileSync(fileURLToPath(new URL('../snapshots/vistas_nav_2cba0b8.json', import.meta.url)), 'utf8'));

/**
 * Los subárboles que un encargo declaró como cambiados, por escena: un `data-testid` (cadena) o `{etiqueta, clase}` para un nodo sin testid
 * (la barra de abajo). Vacío = ninguna escena cambia. Si una foto cambia y no está aquí, R9 se pone rojo.
 * @type {Record<string, Array<string|{etiqueta: string, clase?: string}>>}
 */
export const DECLARADAS_NAV = {
  // W63 (cambio 1): la asistencia abierta conserva la vuelta al grupo; los retos del profe ganan "‹ Mis grupos" (contenido, vacío y error).
  profe_asistencia_abierta: ['volver-al-grupo'],
  profe_retos: ['volver'],
  profe_retos_vacio: ['volver'],
  profe_retos_error: ['volver'],
};

test('R9: lo que W63 declara cambió de verdad: la asistencia abierta trae la vuelta al grupo y los retos del profe, "‹ Mis grupos" (un nodo y su texto, nada más)', async () => {
  const hoy = await tomarFotosNav({ solo: ['profe_asistencia_abierta', 'profe_retos', 'profe_retos_vacio', 'profe_retos_error'] });
  assert.ok(hoy.profe_asistencia_abierta.some((l) => l.includes('data-testid="volver-al-grupo"') && l.includes('href="#/profe/grupo/g1"')));
  assert.ok(!BASE.vistas.profe_asistencia_abierta.some((l) => l.includes('volver')), 'la línea base era un callejón');
  for (const nombre of ['profe_retos', 'profe_retos_vacio', 'profe_retos_error']) {
    assert.ok(hoy[nombre].some((l) => l.includes('data-testid="volver"') && l.includes('href="#/profe/grupos"')), `${nombre}: falta el volver`);
    assert.ok(!BASE.vistas[nombre].some((l) => l.includes('volver')), `${nombre}: la línea base no lo tenía`);
  }
  for (const nombre of Object.keys(hoy)) assert.equal(hoy[nombre].length, BASE.vistas[nombre].length + 2, `${nombre}: un nodo de más y su texto`);
});

/** Las escenas que la espec nombra (§9.1), cada una con los estados que tiene. */
const ESCENAS = [
  'retos', 'retos_vacio', 'retos_error', 'asistencia', 'reto_en_curso', 'reto_en_curso_error', 'revision', 'vivo', 'vivo_no_disponible', 'nivel',
  'nivel_no_disponible', 'aviso_leer', 'solicitudes', 'solicitudes_vacio', 'solicitudes_error', 'profe_asistencia_formulario', 'profe_asistencia_abierta',
  'profe_inscripcion', 'profe_inscripcion_vacio', 'profe_inscripcion_error', 'profe_logro', 'profe_logro_vacio', 'profe_logro_error', 'profe_errores',
  'profe_errores_vacio', 'profe_errores_error', 'profe_retos', 'profe_retos_vacio', 'profe_retos_error', 'admin_grupos', 'admin_grupos_vacio',
  'admin_grupos_error', 'admin_asignar_docente', 'admin_importar_csv',
];

test('R9: la línea base trae las escenas que la espec nombra, en contenido, vacío y error', () => {
  assert.deepEqual(Object.keys(BASE.vistas).sort(), [...ESCENAS].sort());
  for (const nombre of ESCENAS) assert.ok(Array.isArray(BASE.vistas[nombre]) && BASE.vistas[nombre].length > 3, `la foto de ${nombre} está vacía en la línea base`);
});

test('R9: las fotos de navegación son idénticas a las de 2cba0b8 (salvo el nodo que un encargo declara)', async () => {
  const hoy = await tomarFotosNav();
  assert.deepEqual(Object.keys(hoy).sort(), Object.keys(BASE.vistas).sort(), 'las escenas fotografiadas deben ser las de la línea base');
  for (const [nombre, base] of Object.entries(BASE.vistas)) {
    const declaradas = DECLARADAS_NAV[nombre] || [];
    const quedan = sinSubarboles(hoy[nombre], declaradas);
    assert.ok(quedan.length > 2 && quedan[0] === hoy[nombre][0], `${nombre}: la exclusión declarada no puede tragarse la vista`);
    assert.deepEqual(quedan, sinSubarboles(base, declaradas), `cambió la foto de "${nombre}" fuera de lo declarado`);
  }
});

test('R9: dos tomas seguidas dan lo mismo (la foto no depende del reloj ni del azar)', async () => {
  assert.deepEqual(await tomarFotosNav(), await tomarFotosNav());
});
