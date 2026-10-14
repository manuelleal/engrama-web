// @ts-check
// R4 (docs/ESPEC_pantallas_anillo.md §9.2, METODO regla 4): regresión = identidad. Las vistas que los encargos W29-W35
// van a tocar se pintan con entradas fijas (fotos_de_las_vistas.mjs) y se comparan, línea por línea, con la foto que
// se tomó en 595fd98, ANTES de tocar nada (tests/snapshots/vistas_595fd98.json). Un commit posterior cambia SOLO el nodo
// que declara: la declaración vive aquí abajo, en DECLARADAS, con el encargo que la autoriza. La línea base no se regenera.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tomarFotos, sesionDeEstudiante } from './fotos_de_las_vistas.mjs';
import { sinSubarboles, conTextos, ES_LA_BARRA } from './foto_vistas.mjs';

const CRUDA = JSON.parse(readFileSync(fileURLToPath(new URL('../snapshots/vistas_595fd98.json', import.meta.url)), 'utf8'));

/**
 * Los TEXTOS que un encargo declaró como cambiados, por vista: [texto de la línea base, texto de hoy]. Solo cambia un nodo de texto que sea
 * exactamente el viejo (foto_vistas.conTextos); la estructura y todo lo demás siguen comparándose línea por línea.
 * @type {Record<string, Array<[string, string]>>}
 */
export const TEXTOS_DECLARADOS = {
  // W67 (docs/ESPEC_navegacion.md §5.5): "sesión" queda solo para la cuenta; en el grupo, la acción es "Abrir asistencia".
  profe_grupo: [['Abrir sesión de asistencia', 'Abrir asistencia']],
};

/** La línea base con los textos declarados puestos al día (el archivo de la foto no se regenera). */
const BASE = { ...CRUDA, vistas: Object.fromEntries(Object.entries(CRUDA.vistas).map(([nombre, lineas]) => [nombre, conTextos(/** @type {string[]} */ (lineas), TEXTOS_DECLARADOS[nombre] || [])])) };

test('R4: cada texto declarado como cambiado estaba en la línea base y es el que se ve hoy (ni uno de más)', async () => {
  const hoy = await tomarFotos();
  for (const [nombre, pares] of Object.entries(TEXTOS_DECLARADOS)) {
    for (const [viejo, nuevo] of pares) {
      assert.ok(CRUDA.vistas[nombre].some((l) => l.trim() === JSON.stringify(viejo)), `${nombre}: la línea base no decía "${viejo}"`);
      assert.ok(hoy[nombre].some((l) => l.trim() === JSON.stringify(nuevo)), `${nombre}: hoy no dice "${nuevo}"`);
      assert.ok(!hoy[nombre].some((l) => l.trim() === JSON.stringify(viejo)), `${nombre}: todavía dice "${viejo}"`);
    }
  }
  assert.deepEqual(conTextos(['  "Cerrar sesión"', '  a aria-label="Cerrar sesión"', '  "Cerrar sesión ya"'], [['Cerrar sesión', 'X']]), ['  "X"', '  a aria-label="Cerrar sesión"', '  "Cerrar sesión ya"'], 'conTextos cambia solo el nodo de texto exacto');
});

/**
 * Los subárboles (por `data-testid`) que un encargo posterior declaró como cambiados, por vista. Vacío = ninguna vista
 * cambia. Cada entrada nombra el encargo de §11 que la autoriza; si una foto cambia y no está aquí, R4 se pone rojo.
 * Desde W62 (docs/ESPEC_navegacion.md §9.2) un nodo sin `data-testid` se declara por etiqueta (y clase): `{etiqueta, clase?}`.
 * @type {Record<string, Array<string|{etiqueta: string, clase?: string}>>}
 */
const BARRA = { etiqueta: 'nav', clase: 'nav-inferior' };
const BARRA_DE_ARRIBA = { etiqueta: 'div', clase: 'barra-rol' };

export const DECLARADAS = {
  // W33: Perfil ganó UN enlace, "Mis solicitudes sobre mis datos" (las dos formas de pintar Perfil).
  // W69 (docs/ESPEC_navegacion.md §9.2): Perfil cambia ENTERO (pasa a ser "Tu perfil", mi cuenta, para los tres roles): se declara la vista
  // completa. Es la única exclusión que se traga una vista (VISTAS_ENTERAS, abajo); desde W69 la identidad de Perfil la vigila la huella exacta
  // de U67 (tests/unit/vista_perfil.test.mjs).
  perfil: ['vista-perfil'],
  perfil_sin_soporte: ['vista-perfil'],
  // W32: el grupo del profe gana UN enlace, "Inscripciones del grupo".
  // W63 (docs/ESPEC_navegacion.md §9.2): además gana el volver "‹ Mis grupos", arriba.
  // W70 (docs/ESPEC_navegacion.md §9.2): entra la barra de abajo del profe (sin testid: por etiqueta y clase).
  profe_grupo: ['ir-a-inscripcion', 'volver', BARRA],
  // W64 (docs/ESPEC_navegacion.md §9.2): el inicio del profe cambia la LISTA (una tarjeta por grupo con sus tres acciones) y mueve el enlace a
  // los retos al final. Ninguno de los dos nodos tenía `data-testid` en la línea base: se declaran por etiqueta. El resto es idéntico.
  // W70 (§9.2): sale la barra de arriba (`div.barra-rol`: el aviso y "Cerrar sesión" viven en Perfil) y entra la de abajo; el enlace a los
  // retos (un `nav`) sale porque Retos es una pestaña. `{etiqueta: 'nav'}` cubre los dos nav.
  profe_grupos: [{ etiqueta: 'ul' }, { etiqueta: 'nav' }, BARRA_DE_ARRIBA],
  // W65 (docs/ESPEC_navegacion.md §9.2): Inicio junta el reto de hoy, la clase y el examen en la sección "Ahora" (nodo nuevo), antes de
  // "Esta semana". La tarjeta del reto, que en la línea base colgaba de la vista, ahora cuelga de "Ahora": por eso se declaran los dos.
  // W68 (docs/ESPEC_navegacion.md §9.2): sale la fila de enlaces del final (un `nav` sin testid) y la barra de abajo gana "Perfil". Los dos son
  // `nav` sin `data-testid`: se declaran por etiqueta.
  // W47 (docs/ESPEC_juego_oleada1.md §17.1.4): Inicio gana UN enlace, "Ver mis movimientos" (`ir-a-monedas`), justo debajo de la barra del saldo.
  // W48 (docs/ESPEC_juego_oleada1.md §12): el nodo `constancia` cambia: la llama lleva su etapa (con constancia 3, la etapa 1, con su lengua lateral).
  // W51 (docs/ESPEC_juego_oleada1.md §17.1.4): `progreso-semana` cambia por dentro ("Esta semana" con dos contadores → "Tu semana" con sus 7 puntos);
  // conserva su `data-testid` y su sitio (después de "Ahora").
  // Tanda "sistema 1" (docs/ESPEC_visual_sistema1.md §1 y §5): el ícono del botón del sonido (`boton-sonido`) pasa de emoji a SVG de ui/iconos.js.
  // Tanda "sistema 1" (§3): la barra del saldo (`div.barra-superior`) pasa a ser la cabecera única (`header.barra-superior`, con las clases del sistema) y
  // recibe el interruptor del sonido, que sale de junto al saludo. Se declaran el nodo viejo y el nuevo; el saludo (`div.encabezado-reto`) no cambia.
  inicio: ['ahora', 'tarjeta-reto-hoy', { etiqueta: 'nav' }, 'ir-a-monedas', 'constancia', 'progreso-semana', 'boton-sonido', { etiqueta: 'div', clase: 'barra-superior' }, { etiqueta: 'header', clase: 'barra-superior' }],
};

test('R4: lo que W51 declara cambió de verdad: "Esta semana" pasa a "Tu semana" con sus 7 puntos de lunes a domingo, en el mismo sitio; lo demás no cambió', async () => {
  const hoy = (await tomarFotos()).inicio;
  const base = BASE.vistas.inicio;
  const linea = (lineas, testid) => lineas.findIndex((l) => l.includes(`data-testid="${testid}"`));
  assert.ok(base.some((l) => l.trim() === '"Esta semana"') && !hoy.some((l) => l.trim() === '"Esta semana"'), 'la línea base decía "Esta semana"; hoy ya no');
  assert.ok(hoy.some((l) => l.trim() === '"Tu semana"'), 'hoy dice "Tu semana"');
  assert.equal(hoy.filter((l) => l.includes('data-testid="progreso-semana"')).length, 1, 'el nodo conserva su data-testid, una sola vez');
  assert.ok(linea(hoy, 'ahora') < linea(hoy, 'progreso-semana'), 'sigue después de "Ahora"');
  assert.equal(hoy.filter((l) => /^li class="semana-dia/.test(l.trim())).length, 7, 'siete puntos');
  assert.equal(hoy.filter((l) => l.includes('semana-dia-lleno')).length, 0, 'en la foto (asistencias de 2020) ninguno está lleno: son neutros');
  assert.ok(!hoy.some((l) => /ausente|faltaste/i.test(l)), 'un día sin registro nunca dice "ausente"');
  assert.ok(!hoy.some((l) => l.includes('data-testid="semana-completa"')), 'sin semana completa no hay sello');
  assert.deepEqual(sinSubarboles(hoy, DECLARADAS.inicio), sinSubarboles(base, DECLARADAS.inicio), 'fuera de lo declarado, Inicio es idéntico');
});

test('R4: lo que W48 declara cambió de verdad: en Inicio la llama de la constancia lleva su etapa (3 → etapa 1) y el número sigue aparte, en texto; lo demás no cambió', async () => {
  const hoy = (await tomarFotos()).inicio;
  const base = BASE.vistas.inicio;
  const nodo = (lineas) => { const i = lineas.findIndex((l) => l.includes('data-testid="constancia"')); const s = lineas[i].length - lineas[i].trimStart().length; const fin = lineas.findIndex((l, n) => n > i && l.length - l.trimStart().length <= s); return lineas.slice(i, fin).map((l) => l.trim()); };
  assert.deepEqual(nodo(base), ['p class="constancia" data-testid="constancia"', 'span class="llama" aria-hidden="true"', 'span class="llama-cuerpo"', 'span class="llama-nucleo"', '"Constancia: 3"'], 'la línea base: una sola llama');
  assert.deepEqual(nodo(hoy), [
    'p class="constancia" data-testid="constancia"', 'span class="llama llama-etapa-1" aria-hidden="true" data-etapa="1"',
    'span class="llama-cuerpo"', 'span class="llama-nucleo"', 'span class="llama-lengua"', '"Constancia: 3"',
  ], 'hoy: la llama en su etapa, decorativa, y el número del servidor tal cual, en texto');
  assert.equal(hoy.filter((l) => l.includes('racha-de-nuevo') || l.includes('celebra-racha')).length, 0, 'en la primera visita no hay ni aviso ni línea neutra');
  assert.deepEqual(sinSubarboles(hoy, DECLARADAS.inicio), sinSubarboles(base, DECLARADAS.inicio), 'fuera de lo declarado, Inicio es idéntico');
});

test('R4: lo que W47 declara cambió de verdad: Inicio gana el enlace "Ver mis movimientos" justo debajo de la barra del saldo, y solo eso', async () => {
  const hoy = (await tomarFotos()).inicio;
  const base = BASE.vistas.inicio;
  const enlaces = hoy.filter((l) => l.includes('data-testid="ir-a-monedas"'));
  assert.equal(enlaces.length, 1, 'un solo enlace a Mis monedas');
  assert.ok(enlaces[0].trimStart().startsWith('a ') && enlaces[0].includes('href="#/monedas"'), 'es un enlace a #/monedas');
  assert.ok(!base.some((l) => l.includes('ir-a-monedas')), 'la línea base no lo traía');
  const i = hoy.indexOf(enlaces[0]);
  const sangria = (l) => l.length - l.trimStart().length;
  const anteriorHermano = hoy.slice(0, i).reverse().find((l) => sangria(l) === sangria(enlaces[0]));
  assert.ok(/^ *header class="barra-superior[ "]/.test(anteriorHermano ?? ''), 'va inmediatamente debajo de la barra del saldo (hoy, la cabecera), hijo directo de la vista');
  assert.equal(hoy.filter((l) => l.includes('href="#/monedas"')).length, 1, 'el único enlace de Inicio a ese destino');
  assert.equal(hoy[i + 1]?.trim(), '"Ver mis movimientos"');
  assert.deepEqual(sinSubarboles(hoy, ['ir-a-monedas']), sinSubarboles(hoy, []).filter((l, n) => n !== i && n !== i + 1), 'la exclusión quita el enlace y su texto, nada más');
  assert.deepEqual(sinSubarboles(hoy, DECLARADAS.inicio), sinSubarboles(base, DECLARADAS.inicio), 'fuera de lo declarado, Inicio es idéntico');
});

test('R4: lo que W68 declara cambió de verdad: Inicio ya no trae la fila de enlaces repetidos y su barra gana "Perfil"; lo demás no cambió', async () => {
  const hoy = (await tomarFotos()).inicio;
  const base = BASE.vistas.inicio;
  const navs = (lineas) => lineas.filter((l) => l.trimStart().split(' ')[0] === 'nav');
  assert.equal(navs(base).length, 2, 'la línea base traía DOS navegaciones (la fila de enlaces y la barra)');
  assert.equal(navs(hoy).length, 1, 'hoy, una sola');
  assert.ok(ES_LA_BARRA.test(navs(hoy)[0]), 'y es la barra de abajo');
  for (const testid of ['ir-a-asistencia', 'ir-a-retos', 'ir-a-perfil', 'boton-cerrar-sesion']) {
    assert.ok(base.some((l) => l.includes(`data-testid="${testid}"`)), `la línea base traía ${testid}`);
    assert.ok(!hoy.some((l) => l.includes(`data-testid="${testid}"`)), `hoy Inicio ya no trae ${testid}`);
  }
  const barra = hoy.slice(hoy.findIndex((l) => ES_LA_BARRA.test(l)));
  assert.deepEqual(barra.filter((l) => l.trimStart().startsWith('a ')).map((l) => /href="([^"]*)"/.exec(l)?.[1]), ['#/inicio', '#/retos', '#/asistencia', '#/perfil']);
  assert.ok(barra.some((l) => l.trim() === '"Perfil"'), 'la barra dice "Perfil"');
  assert.ok(!base.some((l) => l.trim() === '"Perfil"'), 'la línea base no lo decía');
  assert.deepEqual(sinSubarboles(hoy, DECLARADAS.inicio), sinSubarboles(base, DECLARADAS.inicio), 'fuera de lo declarado, Inicio es idéntico');
});

test('R4: lo que W65 declara cambió de verdad: Inicio trae "Ahora" con el reto de hoy ANTES de "Esta semana", y lo demás no cambió', async () => {
  const hoy = (await tomarFotos()).inicio;
  const linea = (testid) => hoy.findIndex((l) => l.includes(`data-testid="${testid}"`));
  assert.ok(linea('ahora') > 0 && linea('ahora') < linea('tarjeta-reto-hoy') && linea('tarjeta-reto-hoy') < linea('progreso-semana'), 'Ahora → reto de hoy → Esta semana');
  assert.ok(linea('escudo') < linea('ahora'), 'el escudo va antes de Ahora');
  const base = BASE.vistas.inicio;
  assert.ok(base.findIndex((l) => l.includes('progreso-semana')) > base.findIndex((l) => l.includes('tarjeta-reto-hoy')), 'en la línea base ya iba el reto antes');
  assert.ok(!base.some((l) => l.includes('data-testid="ahora"')), 'la línea base no tenía la sección');
  assert.deepEqual(sinSubarboles(hoy, DECLARADAS.inicio), sinSubarboles(base, DECLARADAS.inicio), 'fuera de lo declarado, Inicio es idéntico');
  assert.ok(hoy.some((l) => l.includes('data-testid="progreso-semana"')), 'el nodo `progreso-semana` existe y va después de "Ahora" (W51 declaró su interior: ya no se afirma "sin tocar")');
});

test('R4: lo que W64 declara cambió de verdad: profe/grupos trae una tarjeta por grupo con tres acciones, y lo demás (el título) no cambió', async () => {
  const hoy = (await tomarFotos()).profe_grupos;
  for (const gid of ['g1', 'g2']) {
    for (const [accion, destino] of [['asistencia', `#/profe/grupo/${gid}/sesion`], ['inscripciones', `#/profe/grupo/${gid}/inscripcion`], ['ver', `#/profe/grupo/${gid}`]]) {
      assert.ok(hoy.some((l) => l.includes(`data-testid="grupo-${gid}-${accion}"`) && l.includes(`href="${destino}"`)), `falta la acción ${accion} del grupo ${gid}`);
    }
  }
  assert.ok(!BASE.vistas.profe_grupos.some((l) => l.includes('-asistencia"')), 'la línea base no tenía la tarjeta');
  assert.deepEqual(sinSubarboles(hoy, DECLARADAS.profe_grupos), sinSubarboles(BASE.vistas.profe_grupos, DECLARADAS.profe_grupos));
  assert.ok(sinSubarboles(hoy, DECLARADAS.profe_grupos).some((l) => l.trim() === 'h1'), 'tras excluir lo declarado queda el título');
});

test('R4: lo que W70 declara cambió de verdad: del inicio del profe sale la barra de arriba y entra la de abajo (Mis grupos · Retos · Perfil); el grupo gana la misma barra', async () => {
  const hoy = await tomarFotos();
  const base = BASE.vistas;
  const entradas = (lineas) => { const i = lineas.findIndex((l) => ES_LA_BARRA.test(l)); return i < 0 ? [] : lineas.slice(i).filter((l) => l.trimStart().startsWith('a ')).map((l) => /href="([^"]*)"/.exec(l)?.[1]); };
  for (const nombre of ['profe_grupos', 'profe_grupo']) {
    assert.deepEqual(entradas(base[nombre]), [], `${nombre}: la línea base no traía barra de abajo`);
    assert.deepEqual(entradas(hoy[nombre]), ['#/profe/grupos', '#/profe/retos', '#/perfil'], `${nombre}: hoy trae la del profe`);
    assert.equal(hoy[nombre].filter((l) => l.includes('aria-current="page"')).length, 1, `${nombre}: una sola pestaña activa`);
    assert.ok(hoy[nombre].some((l) => l.includes('aria-current="page"') && l.includes('href="#/profe/grupos"')), `${nombre}: y es Mis grupos`);
  }
  for (const testid of ['barra-ver-aviso', 'boton-cerrar-sesion']) {
    assert.ok(base.profe_grupos.some((l) => l.includes(`data-testid="${testid}"`)), `la línea base traía ${testid} arriba`);
    assert.ok(!hoy.profe_grupos.some((l) => l.includes(`data-testid="${testid}"`)), `hoy ${testid} vive en Perfil`);
  }
  assert.ok(!hoy.profe_grupos.some((l) => l.includes('class="barra-rol"')), 'sin barra de arriba');
  assert.equal(sinSubarboles(hoy.profe_grupo, [BARRA]).length, base.profe_grupo.length + 4, 'el grupo: fuera de la barra, lo de W32 y W63 y nada más');
});

test('R4: la línea base trae las vistas que la espec nombra (entrada, Inicio, Perfil, aviso, sin_perfil, profe/grupos y profe/grupo)', () => {
  for (const nombre of ['entrada_supabase', 'inicio', 'perfil', 'aviso_consentimiento', 'sin_perfil', 'profe_grupos', 'profe_grupo']) {
    assert.ok(Array.isArray(BASE.vistas[nombre]) && BASE.vistas[nombre].length > 3, `falta la foto de ${nombre} en la línea base`);
  }
});

test('R4: las fotos de las vistas existentes son idénticas a las de 595fd98 (salvo el nodo que un encargo declara)', async () => {
  const hoy = await tomarFotos();
  assert.deepEqual(Object.keys(hoy).sort(), Object.keys(BASE.vistas).sort(), 'las vistas fotografiadas deben ser las de la línea base');
  for (const [nombre, base] of Object.entries(BASE.vistas)) {
    const declaradas = DECLARADAS[nombre] || [];
    assert.deepEqual(sinSubarboles(hoy[nombre], declaradas), sinSubarboles(base, declaradas), `cambió la foto de "${nombre}" fuera de lo declarado`);
  }
});

test('R4: con un nivel confirmado, Inicio cambia SOLO el nodo del escudo (lo declara W30) y el resto de las vistas no se entera', async () => {
  const nivelConfirmado = { cefr: 'B1', provisional: false, fuente: 'set', evaluadoEn: '2026-10-06T15:00:00Z' };
  const conNivel = await tomarFotos({ sesion: { ...sesionDeEstudiante(), nivelConfirmado } });
  const declaradas = ['escudo', 'escudo-nivel', ...DECLARADAS.inicio]; // W30: el escudo solo, o el escudo con su etiqueta, su fuente y su fecha (y lo que W65 declaró después)
  assert.deepEqual(sinSubarboles(conNivel.inicio, declaradas), sinSubarboles(BASE.vistas.inicio, declaradas), 'fuera del escudo, Inicio es idéntico');
  assert.notDeepEqual(conNivel.inicio, BASE.vistas.inicio, 'y el escudo sí cambió: ahora dice el nivel');
  assert.ok(conNivel.inicio.some((l) => l.includes('data-testid="escudo-nivel"')));
  for (const nombre of Object.keys(BASE.vistas).filter((n) => n !== 'inicio')) {
    const declaradas = DECLARADAS[nombre] || [];
    assert.deepEqual(sinSubarboles(conNivel[nombre], declaradas), sinSubarboles(BASE.vistas[nombre], declaradas), nombre);
  }
});

test('R4: lo que W32 declara cambió de verdad: profe/grupo trae el enlace a las inscripciones (y lo demás, no)', async () => {
  const hoy = await tomarFotos();
  assert.ok(hoy.profe_grupo.some((l) => l.includes('data-testid="ir-a-inscripcion"') && l.includes('href="#/profe/grupo/g1/inscripcion"')), 'falta el enlace declarado');
  assert.ok(!BASE.vistas.profe_grupo.some((l) => l.includes('ir-a-inscripcion')), 'la línea base no lo tenía');
  // W63 (docs/ESPEC_navegacion.md §9.2) declara un segundo nodo en esta vista: el volver "‹ Mis grupos", antes del título.
  assert.ok(hoy.profe_grupo.some((l) => l.includes('data-testid="volver"') && l.includes('href="#/profe/grupos"')), 'falta el volver que declara W63');
  assert.ok(!BASE.vistas.profe_grupo.some((l) => l.includes('volver')), 'la línea base no tenía volver');
  assert.equal(sinSubarboles(hoy.profe_grupo, [BARRA]).length, BASE.vistas.profe_grupo.length + 4, 'fuera de la barra de W70, dos nodos de más (cada enlace y su texto), nada más');
  assert.deepEqual(DECLARADAS.profe_grupo, ['ir-a-inscripcion', 'volver', BARRA]);
});

/** Las vistas cuya foto un encargo declaró ENTERA (la exclusión deja solo la raíz). Solo Perfil, por W69; cualquier otra pone rojo a R4. */
const VISTAS_ENTERAS = ['perfil', 'perfil_sin_soporte'];

test('R4: lo que W33 declaró sigue ahí: Perfil trae el enlace a las solicitudes', async () => {
  const hoy = await tomarFotos();
  for (const nombre of ['perfil', 'perfil_sin_soporte']) {
    assert.ok(hoy[nombre].some((l) => l.includes('data-testid="perfil-ver-solicitudes"') && l.includes('href="#/datos/solicitudes"')), `${nombre}: falta el enlace declarado`);
    assert.ok(!BASE.vistas[nombre].some((l) => l.includes('perfil-ver-solicitudes')), `${nombre}: la línea base no lo tenía`);
  }
});

test('R4: lo que W69 declara cambió de verdad: Perfil es otra pantalla ("Tu perfil", con barra y sin volver) y es la ÚNICA foto declarada entera', async () => {
  const hoy = await tomarFotos();
  const dice = (lineas, texto) => lineas.some((l) => l.trim() === JSON.stringify(texto));
  for (const nombre of VISTAS_ENTERAS) {
    assert.deepEqual(DECLARADAS[nombre], ['vista-perfil'], `${nombre}: se declara la vista entera`);
    assert.deepEqual(sinSubarboles(hoy[nombre], DECLARADAS[nombre]), ['main id="vista"'], `${nombre}: fuera de la vista no hay nada`);
    assert.ok(dice(hoy[nombre], 'Tu perfil'), `${nombre}: hoy se titula "Tu perfil"`);
    assert.ok(!dice(BASE.vistas[nombre], 'Tu perfil') || nombre === 'perfil_sin_soporte', `${nombre}: la línea base no se titulaba así`);
    assert.ok(BASE.vistas[nombre].some((l) => l.includes('data-testid="perfil-volver"')), `${nombre}: la línea base traía su propio volver`);
    assert.ok(!hoy[nombre].some((l) => l.includes('volver')), `${nombre}: hoy es una pestaña, sin volver`);
    assert.ok(hoy[nombre].some((l) => ES_LA_BARRA.test(l)), `${nombre}: hoy lleva la barra`);
    assert.ok(!BASE.vistas[nombre].some((l) => ES_LA_BARRA.test(l)), `${nombre}: la línea base no la llevaba`);
    assert.ok(hoy[nombre].some((l) => l.includes('data-testid="boton-cerrar-sesion"')), `${nombre}: "Cerrar sesión" sigue ahí`);
  }
  assert.ok(dice(BASE.vistas.perfil, 'Cambia tu contraseña') && !dice(hoy.perfil, 'Cambia tu contraseña'), 'el título viejo salió');
  assert.ok(dice(hoy.perfil, 'Cambiar tu contraseña'), 'y es una sección');
  assert.ok(!dice(hoy.perfil_sin_soporte, 'Cambiar tu contraseña'), 'que no sale si el modo no la soporta');
  const enteras = Object.entries(DECLARADAS).filter(([nombre, d]) => sinSubarboles(hoy[nombre], d).length < 4).map(([nombre]) => nombre);
  assert.deepEqual(enteras.sort(), [...VISTAS_ENTERAS].sort(), 'ninguna otra vista se declara entera');
});

// W35 (adenda 17.5): con las claves del anillo en config.json cambia SOLO un bloque por vista; sin ellas, nada.
const CONFIG_ANILLO = { ENGRAMA_AUTH: 'supabase', EVA_URL: 'https://eva.ejemplo.edu.co', SET_URL: 'https://set.ejemplo.edu.co' };

test('R4: sin claves del anillo en config.json, Inicio y profe/grupos dan idéntico a la línea base (lo declara W35)', async () => {
  const hoy = await tomarFotos({ config: { ENGRAMA_AUTH: 'supabase' } });
  for (const nombre of ['inicio', 'profe_grupos']) assert.deepEqual(sinSubarboles(hoy[nombre], DECLARADAS[nombre] || []), sinSubarboles(BASE.vistas[nombre], DECLARADAS[nombre] || []), nombre);
});

test('R4: con las claves del anillo, Inicio cambia SOLO el bloque anillo-tarjetas y profe/grupos SOLO herramientas-clase; las demás vistas, nada', async () => {
  const hoy = await tomarFotos({ config: CONFIG_ANILLO });
  const bloques = { inicio: 'anillo-tarjetas', profe_grupos: 'herramientas-clase' };
  for (const [nombre, testid] of Object.entries(bloques)) {
    assert.deepEqual(sinSubarboles(hoy[nombre], [testid, ...(DECLARADAS[nombre] || [])]), sinSubarboles(BASE.vistas[nombre], DECLARADAS[nombre] || []), `${nombre}: fuera de ${testid} es idéntica`);
    assert.ok(hoy[nombre].some((l) => l.includes(`data-testid="${testid}"`)), `${nombre}: el bloque nuevo está`);
    assert.ok(!BASE.vistas[nombre].some((l) => l.includes(testid)), `${nombre}: la línea base no lo tenía`);
  }
  for (const nombre of Object.keys(BASE.vistas).filter((n) => !(n in bloques))) {
    assert.deepEqual(sinSubarboles(hoy[nombre], DECLARADAS[nombre] || []), sinSubarboles(BASE.vistas[nombre], DECLARADAS[nombre] || []), nombre);
  }
});

// W31 (adenda 17.7): la entrada gana UN botón, y solo si app.js se lo pasa (modo supabase). La foto de siempre no lo pasa, así que es idéntica.
test('R4: la entrada con "Crear cuenta con código de grupo" cambia SOLO el nodo del botón (lo declara W31) y las demás vistas no se enteran', async () => {
  const hoy = await tomarFotos({ crearCuenta: true });
  assert.deepEqual(sinSubarboles(hoy.entrada_supabase, ['entrada-crear-cuenta']), sinSubarboles(BASE.vistas.entrada_supabase, []), 'fuera del botón, la entrada es idéntica');
  const i = hoy.entrada_supabase.findIndex((l) => l.includes('data-testid="entrada-crear-cuenta"'));
  assert.ok(i >= 0 && hoy.entrada_supabase[i + 1].trim() === '"Crear cuenta con código de grupo"', 'el botón está, con su texto');
  assert.ok(!BASE.vistas.entrada_supabase.some((l) => l.includes('entrada-crear-cuenta')), 'la línea base no lo tenía');
  assert.equal(hoy.entrada_supabase.length, BASE.vistas.entrada_supabase.length + 2, 'un nodo de más (el botón y su texto), nada más');
  for (const nombre of Object.keys(BASE.vistas).filter((n) => n !== 'entrada_supabase')) {
    const declaradas = DECLARADAS[nombre] || [];
    assert.deepEqual(sinSubarboles(hoy[nombre], declaradas), sinSubarboles(BASE.vistas[nombre], declaradas), nombre);
  }
});

// W62 (docs/ESPEC_navegacion.md §9.2): la barra de abajo y el `nav` de enlaces no llevan `data-testid`; para declararlos se excluye por etiqueta y clase.
// Una exclusión que se tragara la vista entera dejaría R4 en verde con cualquier cambio: por eso se prueba aquí (tramposo x_foto_excluye_de_mas).
test('R4: sinSubarboles quita SOLO el subárbol declarado (por data-testid, o por etiqueta y clase) y nunca se traga la vista', async () => {
  const foto = [
    'main id="vista"',
    '  div class="juego" data-testid="vista-inicio"',
    '    h1',
    '      "Hola"',
    '    nav',
    '      a data-testid="ir-a-retos" href="#/retos"',
    '        "Retos"',
    '    nav aria-label="Navegación principal" class="nav-inferior"',
    '      a href="#/inicio"',
    '        "Inicio"',
    '    p class="nav-inferior-nota"',
  ];
  assert.deepEqual(sinSubarboles(foto, ['ir-a-retos']), [...foto.slice(0, 5), ...foto.slice(7)], 'por data-testid, como siempre');
  assert.deepEqual(sinSubarboles(foto, [{ etiqueta: 'nav', clase: 'nav-inferior' }]), [...foto.slice(0, 7), foto[10]], 'solo la barra: ni el otro nav, ni un nodo con una clase parecida');
  assert.deepEqual(sinSubarboles(foto, [{ etiqueta: 'nav' }]), [...foto.slice(0, 4), foto[10]], 'por etiqueta sola: los dos nav y nada más');
  assert.deepEqual(sinSubarboles(foto, [{ etiqueta: 'p', clase: 'nav-inferior' }]), foto, 'etiqueta y clase deben calzar LAS DOS');
  const hoy = await tomarFotos();
  for (const [nombre, lineas] of Object.entries(hoy)) {
    const quedan = sinSubarboles(lineas, [...(DECLARADAS[nombre] || []), { etiqueta: 'nav', clase: 'nav-inferior' }]);
    if (VISTAS_ENTERAS.includes(nombre)) continue; // W69: Perfil se declaró entero, a propósito (lo cubre U67); es la única excepción
    assert.ok(quedan.length >= 4 && quedan[0] === lineas[0] && quedan[1] === lineas[1], `${nombre}: tras excluir lo declarado y la barra, la vista sigue ahí`);
  }
});

// Tanda "sistema 1" (docs/ESPEC_visual_sistema1.md §1 y §5): la barra de abajo (ya declarada en Inicio, Perfil y las dos del profe) cambia por dentro.
test('R4: lo que la tanda "sistema 1" declara cambió de verdad: la barra es la del sistema (sx-barra) con el registro del rol y sin emoji; la línea base los traía', async () => {
  const hoy = await tomarFotos();
  const EMOJI = /\p{Emoji_Presentation}/u;
  const desdeLaBarra = (lineas) => { const i = lineas.findIndex((l) => ES_LA_BARRA.test(l)); return i < 0 ? [] : lineas.slice(i); };
  for (const [nombre, registro] of [['inicio', ''], ['perfil', ''], ['profe_grupos', ' sx-sereno'], ['profe_grupo', ' sx-sereno']]) {
    const b = desdeLaBarra(hoy[nombre]);
    assert.ok(b[0]?.includes(`class="nav-inferior sx-barra${registro}"`), `${nombre}: la barra del sistema${registro}`);
    assert.ok(!b.some((l) => EMOJI.test(l)), `${nombre}: ningún emoji en la barra`);
  }
  assert.ok(desdeLaBarra(BASE.vistas.inicio).some((l) => EMOJI.test(l)), 'la línea base de Inicio traía emoji en la barra');
});

test('R4: lo que la tanda "sistema 1" declara de la cabecera cambió de verdad: en Inicio la barra del saldo es la cabecera del sistema, con el saldo, la constancia y el sonido; el saludo ya no trae el sonido; y el profe no recibe cabecera', async () => {
  const hoy = await tomarFotos();
  const sangria = (l) => l.length - l.trimStart().length;
  const subarbol = (lineas, i) => { const fin = lineas.findIndex((l, n) => n > i && sangria(l) <= sangria(lineas[i])); return lineas.slice(i, fin < 0 ? undefined : fin); };
  const i = hoy.inicio.findIndex((l) => l.trim() === 'header class="barra-superior sx-cabecera sx-cabecera--marca"');
  assert.ok(i > 0, 'Inicio abre con la cabecera del sistema');
  assert.equal(hoy.inicio.filter((l) => l.trimStart().startsWith('header ')).length, 1, 'una sola');
  const cabecera = subarbol(hoy.inicio, i);
  for (const testid of ['saldo', 'constancia', 'boton-sonido']) assert.ok(cabecera.some((l) => l.includes(`data-testid="${testid}"`)), `la cabecera de Inicio trae ${testid}`);
  const saludo = subarbol(hoy.inicio, hoy.inicio.findIndex((l) => l.includes('class="encabezado-reto"')));
  assert.ok(saludo.some((l) => l.trim() === 'h1') && !saludo.some((l) => l.includes('boton-sonido')), 'el saludo conserva su título y ya no carga el sonido');
  assert.equal(hoy.inicio.filter((l) => l.includes('data-testid="boton-sonido"')).length, 1, 'un solo interruptor');
  const boton = hoy.inicio.find((l) => l.includes('data-testid="boton-sonido"'));
  assert.ok(boton.includes('aria-label="Silenciar el sonido y la vibración"') && boton.includes('aria-pressed="true"') && boton.includes('title="Con sonido"'), 'el interruptor dice su acción y su estado sin la palabra a la vista');
  assert.ok(BASE.vistas.inicio.some((l) => l.trim() === 'div class="barra-superior"'), 'en la línea base era un div con el saldo y la constancia');
  for (const nombre of ['profe_grupos', 'profe_grupo']) assert.ok(!hoy[nombre].some((l) => l.trimStart().startsWith('header ')), `${nombre}: sobrio, sin cabecera`);
});

test('R4: dos tomas seguidas dan lo mismo (la foto no depende del reloj ni del azar)', async () => {
  assert.deepEqual(await tomarFotos(), await tomarFotos());
});
