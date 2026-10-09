// @ts-check
// W72 · U69 (docs/ESPEC_navegacion.md §5.8, §9.3): cada rol en sus rutas, y nunca una pantalla en blanco.
//   - `redireccionPara(rol, patron)` (navegacion.js, pura): la ruta de otro rol o desconocida manda al inicio del rol; las suyas y las de todos, no;
//     el admin conserva las del profe por la dirección;
//   - la guardia de rutas.js corre ANTES de pintar: 0 peticiones de la pantalla ajena, la dirección se REEMPLAZA (el historial no crece) y, si el
//     inicio ya estaba pintado, la pantalla no se toca (nunca en blanco);
//   - `#/registro` con sesión se comporta como hoy (arranca desde la ruta por defecto).
// app.js ejecuta `iniciarApp()` al importarse: lo suyo (que instale la guardia con el rol de la sesión) lo mide E32 en el navegador.
// Tramposos: x_guardia_ignora_el_rol y x_desconocida_no_redirige (navegacion.js); x_redirige_con_historial, x_corrige_vaciando y
// x_registro_con_sesion_reemplaza (rutas.js); contra E32,
// x_profe_ve_inicio_de_estudiante y x_ruta_desconocida_en_blanco (app.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { instalarDomFalso } from './dom_falso.mjs';
import { crearRaiz } from './foto_vistas.mjs';
import { RUTAS, INICIO_POR_ROL, redireccionPara, puedeAbrir } from '../../src/navegacion.js';
import { ruta, iniciar, detener, reiniciarRutas, definirPorDefecto, definirGuardia } from '../../src/rutas.js';

const ROLES = /** @type {const} */ (['student', 'teacher', 'admin']);
const DE_TODOS = ['/perfil', '/datos', '/datos/solicitudes'];
const DEL_ESTUDIANTE = ['/inicio', '/vivo', '/nivel', '/asistencia', '/retos', '/retos/:id'];
const DEL_PROFE = ['/profe/grupos', '/profe/grupo/:gid', '/profe/grupo/:gid/sesion', '/profe/grupo/:gid/inscripcion', '/profe/grupo/:gid/logro', '/profe/grupo/:gid/errores', '/profe/retos'];
const DEL_ADMIN = ['/admin', '/admin/asignar-docente/:gid', '/admin/importar-csv/:gid'];

test('U69: de quién es cada ruta (§5.8): Inicio, Retos, el reto, Asistencia, la clase y el examen son del estudiante; /profe/…, del profe; /admin…, del admin; Perfil, el aviso y las solicitudes, de todos', () => {
  assert.deepEqual([...DE_TODOS, ...DEL_ESTUDIANTE, ...DEL_PROFE, ...DEL_ADMIN].sort(), RUTAS.map((r) => r.patron).sort(), 'esta prueba nombra TODAS las rutas de la tabla');
  const suyas = { student: [...DEL_ESTUDIANTE, ...DE_TODOS], teacher: [...DEL_PROFE, ...DE_TODOS], admin: [...DEL_ADMIN, ...DE_TODOS, ...DEL_PROFE] };
  for (const rol of ROLES) {
    for (const r of RUTAS) {
      const puede = suyas[rol].includes(r.patron);
      assert.equal(puedeAbrir(rol, r.patron), puede, `${rol} en ${r.patron}`);
      assert.equal(redireccionPara(rol, r.patron), puede ? null : INICIO_POR_ROL[rol], `${rol} en ${r.patron}: ${puede ? 'se queda' : 'va a su inicio'}`);
    }
    assert.equal(redireccionPara(rol, INICIO_POR_ROL[rol]), null, `${rol}: su inicio es suyo (no hay bucle)`);
  }
});

test('U69: el profe en /inicio va a Mis grupos; el estudiante en /profe/grupos, a Inicio; una dirección que no existe, al inicio del rol; el admin conserva las del profe por la dirección', () => {
  assert.equal(redireccionPara('teacher', '/inicio'), '/profe/grupos');
  assert.equal(redireccionPara('student', '/profe/grupos'), '/inicio');
  assert.equal(redireccionPara('student', '/admin'), '/inicio');
  assert.equal(redireccionPara('teacher', '/admin'), '/profe/grupos');
  assert.equal(redireccionPara('admin', '/inicio'), '/admin');
  for (const rol of ROLES) assert.equal(redireccionPara(rol, null), INICIO_POR_ROL[rol], `${rol}: una dirección sin pantalla`);
  for (const patron of DEL_PROFE) assert.equal(redireccionPara('admin', patron), null, `el admin puede abrir ${patron} por la dirección (PROVISIONAL, C6)`);
  for (const patron of DEL_ADMIN) assert.equal(redireccionPara('teacher', patron), '/profe/grupos', `el profe NO puede abrir ${patron}`);
  assert.equal(redireccionPara('rol-desconocido', '/inicio'), null, 'un rol que la tabla no conoce no se redirige a ninguna parte');
});

/** Un navegador de mentira para rutas.js: la dirección, el historial (entradas) y el oyente de `hashchange`, que se dispara como en el de verdad. */
function navegadorDeRutas(hashInicial) {
  const g = /** @type {any} */ (globalThis);
  const quitarDom = instalarDomFalso();
  const previo = { location: g.location, window: g.window };
  const historial = [hashInicial];
  let oyente = null;
  const avisar = () => queueMicrotask(() => oyente?.());
  g.window = { addEventListener: (tipo, fn) => { if (tipo === 'hashchange') oyente = fn; }, removeEventListener: (tipo, fn) => { if (tipo === 'hashchange' && oyente === fn) oyente = null; } };
  g.location = {
    get hash() { return historial[historial.length - 1]; },
    set hash(v) { if (v !== historial[historial.length - 1]) { historial.push(v); avisar(); } }, // escribir la dirección SUMA una entrada
    replace(v) { const cambio = v !== historial[historial.length - 1]; historial[historial.length - 1] = v; if (cambio) avisar(); }, // reemplazar, no
  };
  return {
    historial,
    asentar: () => new Promise((r) => setImmediate(r)),
    quitar() {
      detener(); reiniciarRutas();
      if (previo.location === undefined) delete g.location; else g.location = previo.location;
      if (previo.window === undefined) delete g.window; else g.window = previo.window;
      quitarDom();
    },
  };
}

/** Registra todas las rutas de la tabla con un pintor que anota qué pantalla "pidió datos". */
function registrarTodas(rol) {
  const pintadas = [];
  reiniciarRutas();
  for (const r of RUTAS) ruta(r.patron, (raiz) => { pintadas.push(r.patron); raiz.appendChild(document.createElement('div')); });
  definirPorDefecto(INICIO_POR_ROL[rol]);
  definirGuardia((patron) => redireccionPara(rol, patron));
  return pintadas;
}

test('U69: una ruta de otro rol NO se pinta (0 peticiones de la pantalla ajena), la dirección queda en el inicio del rol y el historial no crece', async () => {
  for (const [rol, ajena] of /** @type {const} */ ([['teacher', '#/inicio'], ['student', '#/profe/grupos'], ['student', '#/admin'], ['admin', '#/retos']])) {
    const nav = navegadorDeRutas(ajena);
    try {
      const pintadas = registrarTodas(rol);
      iniciar(crearRaiz());
      await nav.asentar();
      const donde = `${rol} abre ${ajena}`;
      assert.deepEqual(pintadas, [INICIO_POR_ROL[rol]], `${donde}: solo se pinta su inicio (la ajena, nunca)`);
      assert.equal(location.hash, `#${INICIO_POR_ROL[rol]}`, `${donde}: la dirección queda en su inicio`);
      assert.deepEqual(nav.historial, [`#${INICIO_POR_ROL[rol]}`], `${donde}: la entrada se REEMPLAZÓ; el historial sigue con una sola`);
    } finally { nav.quitar(); }
  }
});

test('U69: estando en su inicio, escribir una dirección ajena o que no existe no deja la pantalla en blanco ni la repinta, y "atrás" no rebota', async () => {
  for (const [rol, escrita] of /** @type {const} */ ([['teacher', '#/inicio'], ['student', '#/no-existe'], ['teacher', '#/no-existe'], ['admin', '#/tampoco/existe']])) {
    const inicio = `#${INICIO_POR_ROL[rol]}`;
    const nav = navegadorDeRutas(inicio);
    try {
      const pintadas = registrarTodas(rol);
      const raiz = crearRaiz();
      iniciar(raiz);
      await nav.asentar();
      assert.deepEqual(pintadas, [INICIO_POR_ROL[rol]]);
      location.hash = escrita; // como quien la escribe en la barra del navegador: suma una entrada
      await nav.asentar();
      const donde = `${rol} escribe ${escrita}`;
      assert.equal(location.hash, inicio, `${donde}: queda en su inicio`);
      assert.deepEqual(nav.historial, [inicio, inicio], `${donde}: la entrada escrita se reemplazó (el redireccionamiento no sumó otra)`);
      assert.deepEqual(pintadas, [INICIO_POR_ROL[rol]], `${donde}: no se pintó nada más (ni la ajena, ni el inicio otra vez)`);
      assert.equal(raiz.children.length, 1, `${donde}: la pantalla sigue ahí, nunca en blanco`);
      nav.historial.pop(); // "atrás"
      await nav.asentar();
      assert.equal(location.hash, inicio, `${donde}: tras "atrás" sigue en su inicio; no rebota contra la dirección corregida`);
    } finally { nav.quitar(); }
  }
});

test('U69: una ruta propia se pinta normal, sin tocar la dirección; y `/registro` con sesión arranca desde la ruta por defecto, como hoy', async () => {
  const nav = navegadorDeRutas('#/profe/grupo/g1/logro');
  try {
    const pintadas = registrarTodas('teacher');
    iniciar(crearRaiz());
    await nav.asentar();
    assert.deepEqual(pintadas, ['/profe/grupo/:gid/logro']);
    assert.deepEqual(nav.historial, ['#/profe/grupo/g1/logro']);
  } finally { nav.quitar(); }
  const registro = navegadorDeRutas('#/registro');
  try {
    const pintadas = registrarTodas('student');
    iniciar(crearRaiz(), { desdeElPrincipio: true }); // lo que hace app.js con un `#/registro` heredado
    await registro.asentar();
    assert.deepEqual(pintadas, ['/inicio']);
    assert.deepEqual(registro.historial, ['#/registro', '#/inicio'], 'como hoy: se navega a la ruta por defecto (no es una corrección de la guardia)');
  } finally { registro.quitar(); }
});
