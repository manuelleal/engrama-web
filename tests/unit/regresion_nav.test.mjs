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

// W71 (§5.7): el título de la asistencia además dice de qué grupo es.
const ASISTENCIA_W67 = /** @type {Array<[string, string]>} */ ([['Sesión de asistencia', 'Asistencia · SINT-B1-01'], ['Duración (minutos)', '¿Cuántos minutos queda abierta?'], ['Abrir sesión', 'Abrir asistencia'], ['Cerrar sesión', 'Cerrar la asistencia'], ['Código', 'Código de asistencia']]);
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
  // W71 (§5.7): el título dice de qué grupo es ("<título> · <código>"). Donde el código no llega (grupo sin datos, error), el título no cambia y
  // no se declara; las inscripciones además dejan de repetir "del grupo".
  profe_inscripcion: [['Inscripciones del grupo SINT-B1-01', 'Inscripciones · SINT-B1-01']],
  profe_inscripcion_vacio: [['Inscripciones del grupo', 'Inscripciones']],
  profe_logro: [['Logro por eje', 'Logro por eje · SINT-B1-01']],
  profe_errores: [['Errores por ítem', 'Errores por ítem · SINT-B1-01']],
  admin_asignar_docente: [['Asignar docente', 'Asignar docente · SINT-B1-01']],
  admin_importar_csv: [['Importar estudiantes (CSV)', 'Importar estudiantes (CSV) · SINT-B1-01']],
};

/** La línea base con los textos declarados puestos al día (el archivo de la foto no se regenera). */
const BASE = { ...CRUDA, vistas: Object.fromEntries(Object.entries(CRUDA.vistas).map(([nombre, lineas]) => [nombre, conTextos(/** @type {string[]} */ (lineas), TEXTOS_DECLARADOS_NAV[nombre] || [])])) };

test('R9: lo que W67 declara cambió de verdad: cada texto nuevo se ve hoy, y ningún "Cerrar sesión" queda en las pantallas del profe ni del admin (W70: vive en Perfil)', async () => {
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
  assert.ok(dice(CRUDA.vistas.admin_grupos, 'Cerrar sesión'), 'la línea base traía el botón de la cuenta en el inicio del admin');
  assert.ok(!dice(hoy.admin_grupos, 'Cerrar sesión'), 'W70: salió con la barra de arriba; el de la cuenta vive en Perfil (U67)');
  assert.ok(!dice(hoy.profe_asistencia_abierta, 'Cerrar sesión'), 'en la asistencia abierta ya no hay un "Cerrar sesión"');
});

const BARRA = { etiqueta: 'nav', clase: 'nav-inferior' };
const BARRA_DE_ARRIBA = { etiqueta: 'div', clase: 'barra-rol' };
const ESCENAS_CON_BARRA_W70 = ['profe_asistencia_formulario', 'profe_inscripcion', 'profe_inscripcion_vacio', 'profe_inscripcion_error', 'profe_logro', 'profe_logro_vacio', 'profe_logro_error', 'profe_errores', 'profe_errores_vacio', 'profe_errores_error', 'admin_asignar_docente', 'admin_importar_csv'];
const ESCENAS_CON_BARRA_W68 = ['retos', 'retos_vacio', 'retos_error', 'asistencia', 'revision', 'vivo', 'vivo_no_disponible', 'nivel', 'nivel_no_disponible', 'aviso_leer', 'solicitudes', 'solicitudes_vacio', 'solicitudes_error'];

/**
 * Los subárboles que un encargo declaró como cambiados, por escena: un `data-testid` (cadena) o `{etiqueta, clase}` para un nodo sin testid
 * (la barra de abajo). Vacío = ninguna escena cambia. Si una foto cambia y no está aquí, R9 se pone rojo.
 * @type {Record<string, Array<string|{etiqueta: string, clase?: string}>>}
 */
const HASTA_W70 = {
  // W63 (cambio 1): la asistencia abierta conserva la vuelta al grupo; los retos del profe ganan "‹ Mis grupos" (contenido, vacío y error).
  // W70 (cambio 6c): entra la barra de abajo en TODAS las escenas del profe y del admin (por eso cada una lleva BARRA); de los inicios del admin
  // sale la barra de arriba (`div.barra-rol`); y los retos del profe, que ahora son una pestaña, pierden el "‹ Mis grupos" que W63 les dio
  // (el `volver` sigue declarado: en la línea base no existía y hoy tampoco).
  profe_asistencia_abierta: ['volver-al-grupo', BARRA],
  profe_retos: ['volver', BARRA],
  profe_retos_vacio: ['volver', BARRA],
  profe_retos_error: ['volver', BARRA],
  ...Object.fromEntries(ESCENAS_CON_BARRA_W70.map((nombre) => [nombre, [BARRA]])),
  admin_grupos: [BARRA, BARRA_DE_ARRIBA],
  admin_grupos_vacio: [BARRA, BARRA_DE_ARRIBA],
  admin_grupos_error: [BARRA, BARRA_DE_ARRIBA],
  // W68 (cambio 6a): la barra del estudiante gana "Perfil" donde ya estaba (retos, asistencia, revisión) y ENTRA en la clase en vivo, el examen
  // de nivel, el aviso y las solicitudes; también en los estados de error (retos_error no la traía). Corrección a la tabla de §11, que solo
  // nombraba clase, examen, aviso y solicitudes. La barra no lleva testid: se declara por etiqueta y clase.
  ...Object.fromEntries(ESCENAS_CON_BARRA_W68.map((nombre) => [nombre, [BARRA]])),
};

// W71 (cambio 7): un solo encabezado. Toda escena que NO es pestaña gana el volver de ui/encabezado.js (`volver`), arriba, y pierde el suyo
// (`salida-volver`, `aviso-volver`, `volver-al-grupo`, `volver-a-admin`, y el `nav` con el de las inscripciones). La nota de salida a EVA y SET
// (`salida-sales`) pasa a ser una frase que se lee, con "↗". Los títulos con el grupo se declaran como textos (arriba).
const UN_NAV = { etiqueta: 'nav' }; // el `nav` del volver viejo de las inscripciones y la barra
const VOLVER_W71 = {
  vivo: ['volver', 'salida-volver', 'salida-sales'], nivel: ['volver', 'salida-volver', 'salida-sales'],
  vivo_no_disponible: ['volver', 'salida-volver'], nivel_no_disponible: ['volver', 'salida-volver'],
  aviso_leer: ['volver', 'aviso-volver'],
  solicitudes: ['volver'], solicitudes_vacio: ['volver'], solicitudes_error: ['volver'],
  profe_asistencia_formulario: ['volver', 'volver-al-grupo'], profe_asistencia_abierta: ['volver', 'volver-al-grupo'],
  profe_inscripcion: ['volver', UN_NAV], profe_inscripcion_vacio: ['volver', UN_NAV], profe_inscripcion_error: ['volver', { etiqueta: 'h1' }], // el error no tenía título: ahora dice "Inscripciones"
  profe_logro: ['volver', 'volver-al-grupo'], profe_logro_vacio: ['volver', 'volver-al-grupo'], profe_logro_error: ['volver'],
  profe_errores: ['volver', 'volver-al-grupo'], profe_errores_vacio: ['volver', 'volver-al-grupo'], profe_errores_error: ['volver'],
  admin_asignar_docente: ['volver', 'volver-a-admin'], admin_importar_csv: ['volver', 'volver-a-admin'],
};

// W73 (cambio 9): el reto en curso gana su salida, "✕ Salir" (un nodo y su texto), en la pregunta y en su pantalla de error. Nada más.
const SALIR_W73 = { reto_en_curso: ['reto-salir'], reto_en_curso_error: ['reto-salir'] };

const CAPAS = [HASTA_W70, VOLVER_W71, SALIR_W73];
/** @type {Record<string, Array<string|{etiqueta: string, clase?: string}>>} */
export const DECLARADAS_NAV = Object.fromEntries([...new Set(CAPAS.flatMap((c) => Object.keys(c)))].map((nombre) => [nombre, [...new Set(CAPAS.flatMap((c) => c[nombre] || []))]]));

test('R9: lo que W73 declara cambió de verdad: el reto en curso y su error ganan "✕ Salir" hacia Retos (un nodo y su texto), siguen sin barra, y nada más cambió', async () => {
  const hoy = await tomarFotosNav({ solo: ['reto_en_curso', 'reto_en_curso_error'] });
  for (const nombre of ['reto_en_curso', 'reto_en_curso_error']) {
    const i = hoy[nombre].findIndex((l) => l.includes('data-testid="reto-salir"'));
    assert.ok(i > 0 && hoy[nombre][i].trimStart().startsWith('a ') && hoy[nombre][i].includes('href="#/retos"') && hoy[nombre][i].includes('aria-label="Salir del reto"'), `${nombre}: falta la salida`);
    assert.equal(hoy[nombre][i + 1].trim(), '"✕ Salir"', `${nombre}: dice "✕ Salir"`);
    assert.ok(!CRUDA.vistas[nombre].some((l) => l.includes('reto-salir') || l.includes('Salir')), `${nombre}: la línea base no tenía salida (H10)`);
    assert.equal(hoy[nombre].length, CRUDA.vistas[nombre].length + 2, `${nombre}: un nodo de más y su texto`);
    assert.ok(!hoy[nombre].some((l) => l.includes('nav-inferior')), `${nombre}: sigue sin barra`);
    assert.deepEqual(sinSubarboles(hoy[nombre], SALIR_W73[nombre]), CRUDA.vistas[nombre], `${nombre}: fuera de la salida, idéntica a la línea base`);
  }
});

/** A dónde vuelve cada escena que no es pestaña y qué dice su volver (§5.7). */
const VUELTA_W71 = {
  vivo: ['#/inicio', '‹ Inicio'], vivo_no_disponible: ['#/inicio', '‹ Inicio'], nivel: ['#/inicio', '‹ Inicio'], nivel_no_disponible: ['#/inicio', '‹ Inicio'],
  aviso_leer: ['#/perfil', '‹ Perfil'], solicitudes: ['#/perfil', '‹ Perfil'], solicitudes_vacio: ['#/perfil', '‹ Perfil'], solicitudes_error: ['#/perfil', '‹ Perfil'],
  profe_asistencia_formulario: ['#/profe/grupo/g1', '‹ Grupo SINT-B1-01'], profe_asistencia_abierta: ['#/profe/grupo/g1', '‹ Grupo SINT-B1-01'],
  profe_inscripcion: ['#/profe/grupo/g1', '‹ Grupo SINT-B1-01'], profe_inscripcion_vacio: ['#/profe/grupo/g1', '‹ Grupo'], profe_inscripcion_error: ['#/profe/grupo/g1', '‹ Grupo'],
  profe_logro: ['#/profe/grupo/g1', '‹ Grupo SINT-B1-01'], profe_logro_vacio: ['#/profe/grupo/g1', '‹ Grupo'], profe_logro_error: ['#/profe/grupo/g1', '‹ Grupo'],
  profe_errores: ['#/profe/grupo/g1', '‹ Grupo SINT-B1-01'], profe_errores_vacio: ['#/profe/grupo/g1', '‹ Grupo'], profe_errores_error: ['#/profe/grupo/g1', '‹ Grupo'],
  admin_asignar_docente: ['#/admin', '‹ Grupos'], admin_importar_csv: ['#/admin', '‹ Grupos'],
};

test('R9: lo que W71 declara cambió de verdad: cada escena que no es pestaña trae UN volver (el de ui/encabezado.js), antes del título, a donde dice §5.7; las pestañas, ninguno; y los volver viejos salieron', async () => {
  const hoy = await tomarFotosNav();
  assert.deepEqual(Object.keys(VUELTA_W71).sort(), Object.keys(VOLVER_W71).sort(), 'las mismas escenas en las dos tablas');
  for (const [nombre, [href, texto]] of Object.entries(VUELTA_W71)) {
    const lineas = hoy[nombre];
    const volveres = lineas.filter((l) => /data-testid="[^"]*volver[^"]*"/.test(l));
    assert.equal(volveres.length, 1, `${nombre}: exactamente un volver (hay ${volveres.length})`);
    assert.ok(volveres[0].trimStart().startsWith('a ') && volveres[0].includes('data-testid="volver"') && volveres[0].includes(`href="${href}"`), `${nombre}: es el enlace del encabezado, a ${href}`);
    assert.ok(volveres[0].includes(`aria-label="Volver a ${texto.slice(2)}"`), `${nombre}: su nombre accesible lo dice entero`);
    const i = lineas.indexOf(volveres[0]);
    assert.equal(lineas[i + 1].trim(), JSON.stringify(texto), `${nombre}: dice "${texto}"`);
    const h1 = lineas.findIndex((l) => l.trim() === 'h1');
    if (h1 >= 0) assert.ok(i < h1, `${nombre}: el volver va antes del título`);
    assert.ok(!lineas.some((l) => l.trim().startsWith(String.fromCharCode(34) + "Volver")), `${nombre}: ningún "Volver…" suelto`);
  }
  const pestanas = Object.keys(hoy).filter((n) => !(n in VUELTA_W71) && !n.startsWith('reto_en_curso'));
  assert.deepEqual(pestanas.sort(), ['admin_grupos', 'admin_grupos_error', 'admin_grupos_vacio', 'asistencia', 'profe_retos', 'profe_retos_error', 'profe_retos_vacio', 'retos', 'retos_error', 'retos_vacio', 'revision'], 'las demás escenas son pestañas (o la revisión, que cuelga de la pestaña Retos)');
  for (const nombre of pestanas.filter((n) => n !== 'revision')) assert.ok(!hoy[nombre].some((l) => l.includes('volver')), `${nombre}: una pestaña no lleva volver`);
  for (const nombre of ['vivo', 'nivel']) {
    const i = hoy[nombre].findIndex((l) => l.includes('data-testid="salida-sales"'));
    assert.ok(hoy[nombre][i].includes('class="nota-salida"') && !hoy[nombre][i].includes('texto-apoyo'), `${nombre}: la nota de salida ya no va en mayúsculas grises`);
    assert.ok(hoy[nombre][i + 1].includes('aria-hidden="true"') && hoy[nombre][i + 2].trim() === '"↗ "', `${nombre}: con "↗" delante, que no se lee`);
    assert.equal(hoy[nombre][i + 3].trim(), JSON.stringify('Vas a salir de ENGRAMA con tu cuenta; se abre en esta misma pestaña. Para volver, usa el botón atrás del navegador.'));
  }
});

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

test('R9: lo que W63 declaró sigue ahí: la asistencia abierta trae la vuelta al grupo (un nodo y su texto); los retos del profe ya no son un callejón por la barra (W70)', async () => {
  const hoy = await tomarFotosNav({ solo: ['profe_asistencia_abierta', 'profe_retos', 'profe_retos_vacio', 'profe_retos_error'] });
  assert.ok(hoy.profe_asistencia_abierta.some((l) => l.includes('data-testid="volver"') && l.includes('href="#/profe/grupo/g1"')), 'W71: es el volver del encabezado');
  assert.ok(!BASE.vistas.profe_asistencia_abierta.some((l) => l.includes('volver')), 'la línea base era un callejón');
  assert.equal(sinSubarboles(hoy.profe_asistencia_abierta, [BARRA]).length, BASE.vistas.profe_asistencia_abierta.length + 2, 'fuera de la barra, un nodo de más y su texto');
  for (const nombre of ['profe_retos', 'profe_retos_vacio', 'profe_retos_error']) {
    assert.ok(!BASE.vistas[nombre].some((l) => l.includes('volver') || l.includes('nav-inferior')), `${nombre}: la línea base era un callejón (ni volver ni barra)`);
    assert.ok(!hoy[nombre].some((l) => l.includes('data-testid="volver"')), `${nombre}: W70 la hizo pestaña, sin volver`);
    assert.ok(hoy[nombre].some((l) => l.trimStart().startsWith('a ') && l.includes('href="#/profe/grupos"')), `${nombre}: a Mis grupos se va por la barra`);
    assert.equal(sinSubarboles(hoy[nombre], [BARRA]).length, BASE.vistas[nombre].length, `${nombre}: fuera de la barra, los mismos nodos que la línea base`);
  }
});

test('R9: lo que W70 declara cambió de verdad: cada escena del profe y del admin trae UNA barra con las entradas de su rol; del inicio del admin salió la barra de arriba; fuera de eso, nada', async () => {
  const hoy = await tomarFotosNav();
  const barras = (lineas) => lineas.filter((l) => l.trimStart().startsWith('nav ') && l.includes('class="nav-inferior"'));
  const entradas = (lineas) => { const i = lineas.findIndex((l) => l.includes('class="nav-inferior"')); return lineas.slice(i).filter((l) => l.trimStart().startsWith('a ')).map((l) => /href="([^"]*)"/.exec(l)?.[1]); };
  const escenas = Object.keys(BASE.vistas).filter((n) => n.startsWith('profe_') || n.startsWith('admin_'));
  assert.equal(escenas.length, 19, 'las 14 escenas del profe y las 5 del admin');
  for (const nombre of escenas) {
    assert.equal(barras(CRUDA.vistas[nombre]).length, 0, `${nombre}: la línea base no traía barra`);
    assert.equal(barras(hoy[nombre]).length, 1, `${nombre}: hoy trae una`);
    assert.ok((DECLARADAS_NAV[nombre] || []).includes(BARRA), `${nombre}: la barra está declarada`);
    assert.deepEqual(entradas(hoy[nombre]), nombre.startsWith('profe_') ? ['#/profe/grupos', '#/profe/retos', '#/perfil'] : ['#/admin', '#/perfil'], `${nombre}: las entradas de su rol`);
    assert.ok(!hoy[nombre].some((l) => l.includes('class="barra-rol"') || l.includes('boton-cerrar-sesion"') && !nombre.startsWith('profe_asistencia')), `${nombre}: sin barra de arriba ni "Cerrar sesión" de la cuenta`);
  }
  for (const nombre of ['admin_grupos', 'admin_grupos_vacio', 'admin_grupos_error']) assert.ok(CRUDA.vistas[nombre].some((l) => l.includes('class="barra-rol"')), `${nombre}: la línea base traía la barra de arriba`);
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
