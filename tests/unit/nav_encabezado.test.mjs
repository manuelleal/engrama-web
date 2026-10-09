// @ts-check
// W71 (docs/ESPEC_navegacion.md §5.7, §9.3): un solo encabezado.
//   U62 (completo)  cada pantalla con sesión, pintada en contenido, vacío, error y carga: trae la barra (salvo el reto) y, si la tabla de
//                   navegacion.js dice que vuelve, EXACTAMENTE UN volver, el de ui/encabezado.js, antes del título, con su destino, su texto y su
//                   nombre accesible; las pestañas, cero. Ningún "Volver…" suelto.
//   U68             los títulos de las pantallas de un grupo llevan su código; sin código, el título genérico y nunca el identificador; y tras
//                   cada ruta la pestaña del navegador dice "<título> · ENGRAMA".
// Tramposos: x_error_sin_salida y x_titulo_sin_grupo (profe/logro.js), x_solicitudes_sin_salida (vistas/datos_solicitudes.js),
// x_clase_con_su_volver (estudiante/salida_codigo.js), x_pestana_siempre_igual (src/rutas.js). (x_grupo_sin_volver y x_dos_volver ya existían.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { textoDe, crearRaiz } from './foto_vistas.mjs';
import { instalarDomFalso } from './dom_falso.mjs';
import { RUTAS_NAV, GID, ctxEstudiante, ctxProfe, ctxAdmin, CONFIG_NAV, asentar } from './fotos_de_navegacion.mjs';
import { pintar, enOrden, volveres, vaAntes, primero, barraDe, error500, nuncaResponde } from './apoyo_nav.mjs';
import { RUTAS, tituloDe, vueltaDe } from '../../src/navegacion.js';
import { leerAviso } from '../../src/aviso.js';
import { ruta, iniciar, detener, reiniciarRutas } from '../../src/rutas.js';
import { renderInicio } from '../../src/vistas/estudiante/inicio.js';
import { renderPerfil } from '../../src/vistas/perfil.js';
import { renderLeerAviso } from '../../src/vistas/aviso_datos.js';
import { renderSolicitudesDatos } from '../../src/vistas/datos_solicitudes.js';
import { renderVivo } from '../../src/vistas/estudiante/vivo.js';
import { renderNivel } from '../../src/vistas/estudiante/nivel.js';
import { renderAsistencia } from '../../src/vistas/estudiante/asistencia.js';
import { renderRetos } from '../../src/vistas/estudiante/retos.js';
import { renderGrupos } from '../../src/vistas/profe/grupos.js';
import { renderGrupo } from '../../src/vistas/profe/grupo.js';
import { renderSesionAsistencia } from '../../src/vistas/profe/sesion_asistencia.js';
import { renderInscripcion } from '../../src/vistas/profe/inscripcion.js';
import { renderLogro } from '../../src/vistas/profe/logro.js';
import { renderErrores } from '../../src/vistas/profe/errores.js';
import { renderRetosProfe } from '../../src/vistas/profe/retos.js';
import { renderCrearGrupo } from '../../src/vistas/admin/crear_grupo.js';
import { renderAsignarDocente } from '../../src/vistas/admin/asignar_docente.js';
import { renderImportarCsv } from '../../src/vistas/admin/importar_csv.js';

const CODIGO = 'SINT-B1-01';
const P = { gid: GID };
const SERVIDOR = { ...RUTAS_NAV, 'GET /core/coins/balance': { balance: 120, currency: 'COIN' }, 'GET /core/attendance/history': [], 'GET /teachers/groups/g2/solicitudes': [] };
const todas = (valor) => Object.fromEntries(Object.keys(SERVIDOR).map((k) => [k, valor]));
const ESTADOS = {
  contenido: SERVIDOR,
  vacio: { ...SERVIDOR, 'GET /challenges/': [], 'GET /challenges/attempts/history': [], 'GET /auth/solicitudes-datos': [], [`GET /teachers/groups/${GID}/students`]: [], 'GET /challenges/all': [] },
  error: todas(error500),
  carga: todas(nuncaResponde),
};
const est = () => ctxEstudiante({ config: CONFIG_NAV });

/** Cómo se pinta la pantalla de cada ruta de la tabla (con el rol dueño). El reto en curso va aparte (W73: no lleva barra ni volver, lleva "Salir"). */
const PANTALLAS = /** @type {Record<string, (r: any) => unknown>} */ ({
  '/inicio': (r) => renderInicio(r, est()),
  '/perfil': (r) => renderPerfil(r, est()),
  '/datos': (r) => renderLeerAviso(r, { aviso: leerAviso(), solicitudes: '#/datos/solicitudes', rol: 'student' }),
  '/datos/solicitudes': (r) => renderSolicitudesDatos(r, est()),
  '/vivo': (r) => renderVivo(r, {}, est()),
  '/nivel': (r) => renderNivel(r, {}, est()),
  '/asistencia': (r) => renderAsistencia(r, {}, est()),
  '/retos': (r) => renderRetos(r, est()),
  '/profe/grupos': (r) => renderGrupos(r, ctxProfe()),
  '/profe/grupo/:gid': (r) => renderGrupo(r, P, ctxProfe()),
  '/profe/grupo/:gid/sesion': (r) => renderSesionAsistencia(r, P, ctxProfe()),
  '/profe/grupo/:gid/inscripcion': (r) => renderInscripcion(r, P, ctxProfe()),
  '/profe/grupo/:gid/logro': (r) => renderLogro(r, P, ctxProfe()),
  '/profe/grupo/:gid/errores': (r) => renderErrores(r, P, ctxProfe()),
  '/profe/retos': (r) => renderRetosProfe(r, ctxProfe()),
  '/admin': (r) => renderCrearGrupo(r, ctxAdmin()),
  '/admin/asignar-docente/:gid': (r) => renderAsignarDocente(r, P, ctxAdmin()),
  '/admin/importar-csv/:gid': (r) => renderImportarCsv(r, P, ctxAdmin()),
});

test('U62: esta prueba pinta TODAS las rutas de la tabla (menos el reto en curso, que no lleva barra ni volver)', () => {
  assert.deepEqual(Object.keys(PANTALLAS).sort(), RUTAS.map((r) => r.patron).filter((p) => p !== '/retos/:id').sort());
});

test('U62: cada pantalla trae la barra y, si la tabla dice que vuelve, EXACTAMENTE UN volver (el de ui/encabezado.js) antes del título, con su destino, su texto y su nombre accesible; las pestañas, cero (contenido, vacío, error y carga)', async () => {
  for (const [patron, fn] of Object.entries(PANTALLAS)) {
    for (const [estado, rutas] of Object.entries(ESTADOS)) {
      const { raiz, cerrar } = await pintar(rutas, fn);
      try {
        const donde = `${patron} (${estado})`;
        assert.ok(barraDe(raiz), `${donde}: lleva la barra`);
        const todos = volveres(raiz);
        const sueltos = enOrden(raiz).filter((e) => (e.tagName === 'a' || e.tagName === 'button') && /^Volver/.test(textoDe(e).trim()));
        assert.deepEqual(sueltos.map((e) => textoDe(e)), [], `${donde}: ningún "Volver…" suelto`);
        const generica = vueltaDe(patron, P, null);
        if (!generica) { assert.deepEqual(todos.map((e) => e.getAttribute('data-testid')), [], `${donde}: es una pestaña, no lleva volver`); continue; }
        assert.equal(todos.length, 1, `${donde}: exactamente un volver (hay ${todos.length}: ${todos.map((e) => e.getAttribute('data-testid')).join(', ')})`);
        const v = todos[0];
        assert.equal(v.getAttribute('data-testid'), 'volver', `${donde}: es el de ui/encabezado.js`);
        assert.equal(v.tagName, 'a', `${donde}: es un enlace`);
        assert.equal(v.getAttribute('href'), `#${generica.camino}`, `${donde}: a dónde vuelve`);
        const nombres = [generica.nombre, vueltaDe(patron, P, CODIGO)?.nombre];
        const nombre = nombres.find((n) => textoDe(v) === `‹ ${n}`);
        assert.ok(nombre, `${donde}: dice "‹ ${nombres.join('" o "‹ ')}" (dice "${textoDe(v)}")`);
        assert.equal(v.getAttribute('aria-label'), `Volver a ${nombre}`, `${donde}: su nombre accesible lo dice entero`);
        const h1 = primero(raiz, 'h1');
        if (h1) assert.ok(vaAntes(raiz, v, h1), `${donde}: el volver va antes del título`);
        if (estado !== 'carga') assert.ok(h1, `${donde}: tiene título`);
      } finally { cerrar(); }
    }
  }
});

const DE_UN_GRUPO = ['/profe/grupo/:gid', '/profe/grupo/:gid/sesion', '/profe/grupo/:gid/inscripcion', '/profe/grupo/:gid/logro', '/profe/grupo/:gid/errores', '/admin/asignar-docente/:gid', '/admin/importar-csv/:gid'];
const TITULOS = {
  '/profe/grupo/:gid': ['Grupo SINT-B1-01', 'Grupo'],
  '/profe/grupo/:gid/sesion': ['Asistencia · SINT-B1-01', 'Asistencia'],
  '/profe/grupo/:gid/inscripcion': ['Inscripciones · SINT-B1-01', 'Inscripciones'],
  '/profe/grupo/:gid/logro': ['Logro por eje · SINT-B1-01', 'Logro por eje'],
  '/profe/grupo/:gid/errores': ['Errores por ítem · SINT-B1-01', 'Errores por ítem'],
  '/admin/asignar-docente/:gid': ['Asignar docente · SINT-B1-01', 'Asignar docente'],
  '/admin/importar-csv/:gid': ['Importar estudiantes (CSV) · SINT-B1-01', 'Importar estudiantes (CSV)'],
};

test('U68: el título de cada pantalla de un grupo dice de qué grupo es ("<título> · <código>"), su volver también, y la pestaña del navegador dice "<título> · ENGRAMA"', async () => {
  assert.deepEqual(RUTAS.filter((r) => r.patron.includes(':gid')).map((r) => r.patron).sort(), [...DE_UN_GRUPO].sort(), 'todas las rutas de un grupo');
  for (const patron of DE_UN_GRUPO) {
    const { raiz, cerrar } = await pintar(SERVIDOR, PANTALLAS[patron]);
    try {
      const [conCodigo] = TITULOS[patron];
      assert.equal(tituloDe(patron, CODIGO), conCodigo, `${patron}: la tabla`);
      assert.deepEqual(enOrden(raiz).filter((e) => e.tagName === 'h1').map(textoDe), [conCodigo], `${patron}: un solo título, con el grupo`);
      assert.equal(document.title, `${conCodigo} · ENGRAMA`, `${patron}: la pestaña del navegador`);
      if (patron.startsWith('/profe/grupo/:gid/')) assert.equal(textoDe(volveres(raiz)[0]), '‹ Grupo SINT-B1-01', `${patron}: vuelve a SU grupo, por su nombre`);
    } finally { cerrar(); }
  }
});

test('U68: si el código del grupo no llega (el grupo no aparece en la lista, o la lectura falla), el título queda genérico y NUNCA sale el identificador interno', async () => {
  const sinCodigo = { ...SERVIDOR, 'GET /teachers/groups': [{ id: 'otro', group_code: 'OTRO-01', student_count: 1 }] };
  const listaFalla = { ...SERVIDOR, 'GET /teachers/groups': error500 };
  for (const patron of DE_UN_GRUPO) {
    for (const [caso, rutas] of /** @type {Array<[string, Record<string, unknown>]>} */ ([['el grupo no está en la lista', sinCodigo], ['la lista falla', listaFalla]])) {
      const { raiz, cerrar } = await pintar(rutas, PANTALLAS[patron]);
      try {
        const donde = `${patron} (${caso})`;
        const [, generico] = TITULOS[patron];
        const h1 = enOrden(raiz).filter((e) => e.tagName === 'h1').map(textoDe);
        // Con la lista caída, el Grupo y las inscripciones (que la piden junto con sus datos) muestran su error, sin título: tampoco ahí sale el id.
        if (h1.length) assert.deepEqual(h1, [generico], `${donde}: el título genérico`);
        for (const e of [...enOrden(raiz).filter((x) => x.tagName === 'h1'), ...volveres(raiz)]) {
          assert.ok(!new RegExp(`\\b${GID}\\b`).test(`${textoDe(e)} ${e.getAttribute('aria-label') || ''}`), `${donde}: el identificador interno en "${textoDe(e)}"`);
          assert.ok(!textoDe(e).includes('OTRO-01'), `${donde}: ni el código de OTRO grupo`);
        }
        assert.ok(volveres(raiz).length === 1, `${donde}: y sigue teniendo su volver`);
      } finally { cerrar(); }
    }
  }
});

test('U68: tras cada ruta, la pestaña del navegador dice "<título> · ENGRAMA"; una dirección sin pantalla y una pantalla obligatoria, "ENGRAMA"', async () => {
  const g = /** @type {any} */ (globalThis);
  const quitarDom = instalarDomFalso();
  const previo = { location: g.location, window: g.window };
  g.window = { addEventListener() {}, removeEventListener() {} };
  g.location = { hash: '' };
  try {
    reiniciarRutas();
    const pintadas = [];
    for (const r of RUTAS) ruta(r.patron, (_raiz, params) => { pintadas.push(r.patron); void params; });
    const raiz = crearRaiz();
    const visitar = async (hash) => { g.location.hash = hash; iniciar(raiz); await asentar(); return document.title; };
    assert.equal(await visitar('#/inicio'), 'Inicio · ENGRAMA');
    assert.equal(await visitar('#/retos'), 'Retos · ENGRAMA');
    assert.equal(await visitar('#/perfil'), 'Tu perfil · ENGRAMA');
    assert.equal(await visitar('#/profe/grupos'), 'Mis grupos · ENGRAMA');
    assert.equal(await visitar('#/profe/grupo/g1/logro'), 'Logro por eje · ENGRAMA', 'sin el código todavía: la vista lo completa cuando lo sabe');
    assert.equal(await visitar('#/admin/importar-csv/g1'), 'Importar estudiantes (CSV) · ENGRAMA');
    assert.equal(await visitar('#/asistencia?codigo=123456'), 'Asistencia · ENGRAMA', 'la consulta no cambia el título');
    for (const r of RUTAS) {
      const titulo = await visitar(`#${r.patron.replace(':gid', 'g1').replace(':id', 'reto-1')}`);
      assert.equal(titulo, `${r.titulo(null)} · ENGRAMA`, `${r.patron}: el título de la tabla`);
      assert.notEqual(titulo, 'ENGRAMA', `${r.patron}: nunca "ENGRAMA" a secas en una pantalla con ruta`);
    }
    assert.equal(pintadas.length, 7 + RUTAS.length, 'cada visita pintó su pantalla');
    assert.equal(await visitar('#/no-existe'), 'ENGRAMA', 'una dirección sin pantalla no hereda el título anterior');
    await visitar('#/retos');
    detener();
    assert.equal(document.title, 'ENGRAMA', 'al apagarse el router (pantalla obligatoria), la pestaña vuelve a decir ENGRAMA');
  } finally {
    detener(); reiniciarRutas();
    if (previo.location === undefined) delete g.location; else g.location = previo.location;
    if (previo.window === undefined) delete g.window; else g.window = previo.window;
    quitarDom();
  }
});
