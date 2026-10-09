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
import { sinSubarboles } from './foto_vistas.mjs';

const BASE = JSON.parse(readFileSync(fileURLToPath(new URL('../snapshots/vistas_595fd98.json', import.meta.url)), 'utf8'));

/**
 * Los subárboles (por `data-testid`) que un encargo posterior declaró como cambiados, por vista. Vacío = ninguna vista
 * cambia. Cada entrada nombra el encargo de §11 que la autoriza; si una foto cambia y no está aquí, R4 se pone rojo.
 * Desde W62 (docs/ESPEC_navegacion.md §9.2) un nodo sin `data-testid` se declara por etiqueta (y clase): `{etiqueta, clase?}`.
 * @type {Record<string, Array<string|{etiqueta: string, clase?: string}>>}
 */
export const DECLARADAS = {
  // W33: Perfil gana UN enlace, "Mis solicitudes sobre mis datos" (las dos formas de pintar Perfil).
  perfil: ['perfil-ver-solicitudes'],
  perfil_sin_soporte: ['perfil-ver-solicitudes'],
  // W32: el grupo del profe gana UN enlace, "Inscripciones del grupo".
  // W63 (docs/ESPEC_navegacion.md §9.2): además gana el volver "‹ Mis grupos", arriba.
  profe_grupo: ['ir-a-inscripcion', 'volver'],
  // W64 (docs/ESPEC_navegacion.md §9.2): el inicio del profe cambia la LISTA (una tarjeta por grupo con sus tres acciones) y mueve el enlace a
  // los retos al final. Ninguno de los dos nodos tenía `data-testid` en la línea base: se declaran por etiqueta. El resto es idéntico.
  profe_grupos: [{ etiqueta: 'ul' }, { etiqueta: 'nav' }],
  // W65 (docs/ESPEC_navegacion.md §9.2): Inicio junta el reto de hoy, la clase y el examen en la sección "Ahora" (nodo nuevo), antes de
  // "Esta semana". La tarjeta del reto, que en la línea base colgaba de la vista, ahora cuelga de "Ahora": por eso se declaran los dos.
  inicio: ['ahora', 'tarjeta-reto-hoy'],
};

test('R4: lo que W65 declara cambió de verdad: Inicio trae "Ahora" con el reto de hoy ANTES de "Esta semana", y lo demás no cambió', async () => {
  const hoy = (await tomarFotos()).inicio;
  const linea = (testid) => hoy.findIndex((l) => l.includes(`data-testid="${testid}"`));
  assert.ok(linea('ahora') > 0 && linea('ahora') < linea('tarjeta-reto-hoy') && linea('tarjeta-reto-hoy') < linea('progreso-semana'), 'Ahora → reto de hoy → Esta semana');
  assert.ok(linea('escudo') < linea('ahora'), 'el escudo va antes de Ahora');
  const base = BASE.vistas.inicio;
  assert.ok(base.findIndex((l) => l.includes('progreso-semana')) > base.findIndex((l) => l.includes('tarjeta-reto-hoy')), 'en la línea base ya iba el reto antes');
  assert.ok(!base.some((l) => l.includes('data-testid="ahora"')), 'la línea base no tenía la sección');
  assert.deepEqual(sinSubarboles(hoy, DECLARADAS.inicio), sinSubarboles(base, DECLARADAS.inicio), 'fuera de lo declarado, Inicio es idéntico');
  assert.ok(sinSubarboles(hoy, DECLARADAS.inicio).some((l) => l.includes('data-testid="progreso-semana"')), '"Esta semana" sigue ahí, sin tocar');
});

test('R4: lo que W64 declara cambió de verdad: profe/grupos trae una tarjeta por grupo con tres acciones, y lo demás (barra y título) no cambió', async () => {
  const hoy = (await tomarFotos()).profe_grupos;
  for (const gid of ['g1', 'g2']) {
    for (const [accion, destino] of [['asistencia', `#/profe/grupo/${gid}/sesion`], ['inscripciones', `#/profe/grupo/${gid}/inscripcion`], ['ver', `#/profe/grupo/${gid}`]]) {
      assert.ok(hoy.some((l) => l.includes(`data-testid="grupo-${gid}-${accion}"`) && l.includes(`href="${destino}"`)), `falta la acción ${accion} del grupo ${gid}`);
    }
  }
  assert.ok(!BASE.vistas.profe_grupos.some((l) => l.includes('-asistencia"')), 'la línea base no tenía la tarjeta');
  assert.deepEqual(sinSubarboles(hoy, DECLARADAS.profe_grupos), sinSubarboles(BASE.vistas.profe_grupos, DECLARADAS.profe_grupos));
  assert.ok(sinSubarboles(hoy, DECLARADAS.profe_grupos).some((l) => l.trim() === 'h1'), 'tras excluir lo declarado quedan la barra y el título');
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
  assert.equal(hoy.profe_grupo.length, BASE.vistas.profe_grupo.length + 4, 'dos nodos de más (cada enlace y su texto), nada más');
  assert.deepEqual(DECLARADAS.profe_grupo, ['ir-a-inscripcion', 'volver']);
});

test('R4: lo que W33 declara cambió de verdad: Perfil trae el enlace a las solicitudes (y lo demás, no)', async () => {
  const hoy = await tomarFotos();
  for (const nombre of ['perfil', 'perfil_sin_soporte']) {
    assert.ok(hoy[nombre].some((l) => l.includes('data-testid="perfil-ver-solicitudes"') && l.includes('href="#/datos/solicitudes"')), `${nombre}: falta el enlace declarado`);
    assert.ok(!BASE.vistas[nombre].some((l) => l.includes('perfil-ver-solicitudes')), `${nombre}: la línea base no lo tenía`);
    assert.equal(hoy[nombre].length, BASE.vistas[nombre].length + 2, `${nombre}: un nodo de más (el enlace y su texto), nada más`);
  }
  assert.deepEqual(DECLARADAS.perfil, ['perfil-ver-solicitudes']);
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
    assert.ok(quedan.length >= 4 && quedan[0] === lineas[0] && quedan[1] === lineas[1], `${nombre}: tras excluir lo declarado y la barra, la vista sigue ahí`);
  }
});

test('R4: dos tomas seguidas dan lo mismo (la foto no depende del reloj ni del azar)', async () => {
  assert.deepEqual(await tomarFotos(), await tomarFotos());
});
