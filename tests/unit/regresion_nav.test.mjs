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
import { sinSubarboles, conTextos } from './foto_vistas.mjs';

const CRUDA = JSON.parse(readFileSync(fileURLToPath(new URL('../snapshots/vistas_nav_2cba0b8.json', import.meta.url)), 'utf8'));

const ASISTENCIA_W67 = /** @type {Array<[string, string]>} */ ([['Sesión de asistencia', 'Asistencia'], ['Duración (minutos)', '¿Cuántos minutos queda abierta?'], ['Abrir sesión', 'Abrir asistencia'], ['Cerrar sesión', 'Cerrar la asistencia'], ['Código', 'Código de asistencia']]);
const RETOS_W67 = /** @type {Array<[string, string]>} */ ([
  ['Estos son los retos de todo el colegio, no solo de tus grupos (el servidor todavía no los filtra por grupo).', 'Estos son los retos de toda la institución, no solo de tus grupos.'],
  ['Este colegio no tiene retos todavía.', 'Esta institución no tiene retos todavía.'],
]);

/**
 * Los TEXTOS que un encargo declaró como cambiados, por escena: [texto de la línea base, texto de hoy] (foto_vistas.conTextos: solo el nodo de
 * texto exacto). W67 (§5.5, "una palabra, una cosa"): la asistencia deja de llamarse "sesión", cada código lleva apellido, "institución" y no
 * "colegio", y el campo del admin es el "Nombre del grupo". En las escenas del profe "Cerrar sesión" era el botón de la asistencia; el de la
 * cuenta (admin_grupos) NO se declara y sigue igual.
 * @type {Record<string, Array<[string, string]>>}
 */
export const TEXTOS_DECLARADOS_NAV = {
  asistencia: [['Código de la sesión', 'Código de asistencia']],
  profe_asistencia_formulario: ASISTENCIA_W67,
  profe_asistencia_abierta: ASISTENCIA_W67,
  profe_retos: RETOS_W67,
  profe_retos_vacio: RETOS_W67,
  admin_grupos: [['Código del grupo', 'Nombre del grupo']],
  admin_grupos_vacio: [['Código del grupo', 'Nombre del grupo']],
};

/** La línea base con los textos declarados puestos al día (el archivo de la foto no se regenera). */
const BASE = { ...CRUDA, vistas: Object.fromEntries(Object.entries(CRUDA.vistas).map(([nombre, lineas]) => [nombre, conTextos(/** @type {string[]} */ (lineas), TEXTOS_DECLARADOS_NAV[nombre] || [])])) };

test('R9: lo que W67 declara cambió de verdad: cada texto nuevo se ve hoy, y el "Cerrar sesión" de la CUENTA sigue en el inicio del admin', async () => {
  const hoy = await tomarFotosNav();
  const dice = (lineas, texto) => lineas.some((l) => l.trim() === JSON.stringify(texto));
  for (const [nombre, pares] of Object.entries(TEXTOS_DECLARADOS_NAV)) {
    const usados = pares.filter(([viejo]) => dice(CRUDA.vistas[nombre], viejo));
    assert.ok(usados.length > 0, `${nombre}: ningún texto declarado estaba en la línea base`);
    for (const [viejo, nuevo] of usados) {
      assert.ok(dice(hoy[nombre], nuevo), `${nombre}: hoy no dice "${nuevo}"`);
      if (!pares.some(([, n]) => n === viejo)) assert.ok(!dice(hoy[nombre], viejo), `${nombre}: todavía dice "${viejo}"`);
    }
  }
  assert.ok(dice(hoy.admin_grupos, 'Cerrar sesión'), 'el botón de la cuenta no cambió');
  assert.ok(!dice(hoy.profe_asistencia_abierta, 'Cerrar sesión'), 'en la asistencia abierta ya no hay un "Cerrar sesión"');
});

const BARRA = { etiqueta: 'nav', clase: 'nav-inferior' };
const ESCENAS_CON_BARRA_W68 = ['retos', 'retos_vacio', 'retos_error', 'asistencia', 'revision', 'vivo', 'vivo_no_disponible', 'nivel', 'nivel_no_disponible', 'aviso_leer', 'solicitudes', 'solicitudes_vacio', 'solicitudes_error'];

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
  // W68 (cambio 6a): la barra del estudiante gana "Perfil" donde ya estaba (retos, asistencia, revisión) y ENTRA en la clase en vivo, el examen
  // de nivel, el aviso y las solicitudes; también en los estados de error (retos_error no la traía). Corrección a la tabla de §11, que solo
  // nombraba clase, examen, aviso y solicitudes. La barra no lleva testid: se declara por etiqueta y clase.
  ...Object.fromEntries(ESCENAS_CON_BARRA_W68.map((nombre) => [nombre, [BARRA]])),
};

test('R9: lo que W68 declara cambió de verdad: cada escena del estudiante trae UNA barra con "Perfil"; el reto en curso, ninguna; y fuera de la barra nada cambió', async () => {
  const hoy = await tomarFotosNav();
  const barras = (lineas) => lineas.filter((l) => l.trimStart().startsWith('nav ') && l.includes('class="nav-inferior"'));
  for (const nombre of ESCENAS_CON_BARRA_W68) {
    assert.equal(barras(hoy[nombre]).length, 1, `${nombre}: una barra`);
    assert.ok(hoy[nombre].some((l) => l.trim() === '"Perfil"'), `${nombre}: la barra dice "Perfil"`);
    assert.ok(!CRUDA.vistas[nombre].some((l) => l.trim() === '"Perfil"'), `${nombre}: la línea base no lo decía`);
    assert.deepEqual(sinSubarboles(hoy[nombre], [BARRA, ...(DECLARADAS_NAV[nombre] || [])]), sinSubarboles(BASE.vistas[nombre], [BARRA, ...(DECLARADAS_NAV[nombre] || [])]), `${nombre}: fuera de la barra, idéntica`);
  }
  for (const nombre of ['retos', 'retos_vacio', 'asistencia', 'revision']) assert.equal(barras(CRUDA.vistas[nombre]).length, 1, `${nombre}: la línea base ya traía barra (de 3 entradas)`);
  for (const nombre of ['retos_error', 'vivo', 'vivo_no_disponible', 'nivel', 'nivel_no_disponible', 'aviso_leer', 'solicitudes', 'solicitudes_vacio', 'solicitudes_error']) assert.equal(barras(CRUDA.vistas[nombre]).length, 0, `${nombre}: la línea base no traía barra`);
  for (const nombre of ['reto_en_curso', 'reto_en_curso_error']) assert.equal(barras(hoy[nombre]).length, 0, `${nombre}: una tarea por pantalla, sin barra`);
});

test('R9: lo que W63 declara cambió de verdad: la asistencia abierta trae la vuelta al grupo y los retos del profe, "‹ Mis grupos" (un nodo y su texto, nada más)', async () => {
  const hoy = await tomarFotosNav({ solo: ['profe_asistencia_abierta', 'profe_retos', 'profe_retos_vacio', 'profe_retos_error'] });
  assert.ok(hoy.profe_asistencia_abierta.some((l) => l.includes('data-testid="volver-al-grupo"') && l.includes('href="#/profe/grupo/g1"')));
  assert.ok(!BASE.vistas.profe_asistencia_abierta.some((l) => l.includes('volver')), 'la línea base era un callejón');
  for (const nombre of ['profe_retos', 'profe_retos_vacio', 'profe_retos_error']) {
    assert.ok(hoy[nombre].some((l) => l.includes('data-testid="volver"') && l.includes('href="#/profe/grupos"')), `${nombre}: falta el volver`);
    assert.ok(!BASE.vistas[nombre].some((l) => l.includes('volver')), `${nombre}: la línea base no lo tenía`);
  }
  for (const nombre of Object.keys(hoy)) assert.equal(hoy[nombre].length, BASE.vistas[nombre].length + 2, `${nombre}: un nodo de más y su texto`);
  void CRUDA;
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
