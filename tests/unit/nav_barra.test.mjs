// @ts-check
// W68 (docs/ESPEC_navegacion.md §5.6, §9.3 U62 "la barra"): toda pantalla del estudiante trae UNA barra de abajo, con la pestaña activa de §5.6,
// en contenido, vacío, error y carga; el reto en curso no la lleva; y donde no hay sesión o el router está apagado, tampoco.
// Tramposos: x_clase_sin_barra (estudiante/salida_codigo.js) y x_aviso_sin_sesion_con_barra (vistas/aviso_datos.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { textoDe } from './foto_vistas.mjs';
import { RUTAS_NAV, ctxEstudiante, CONFIG_NAV } from './fotos_de_navegacion.mjs';
import { pintar, enOrden, error500, nuncaResponde } from './apoyo_nav.mjs';
import { leerAviso } from '../../src/aviso.js';
import { renderInicio } from '../../src/vistas/estudiante/inicio.js';
import { renderRetos } from '../../src/vistas/estudiante/retos.js';
import { renderAsistencia } from '../../src/vistas/estudiante/asistencia.js';
import { renderRevision } from '../../src/vistas/estudiante/revision.js';
import { renderRetoFlujo } from '../../src/vistas/estudiante/reto_flujo.js';
import { renderVivo } from '../../src/vistas/estudiante/vivo.js';
import { renderNivel } from '../../src/vistas/estudiante/nivel.js';
import { renderLeerAviso } from '../../src/vistas/aviso_datos.js';
import { renderSolicitudesDatos } from '../../src/vistas/datos_solicitudes.js';

const SERVIDOR = { ...RUTAS_NAV, 'GET /core/coins/balance': { balance: 120, currency: 'COIN' }, 'GET /core/attendance/history': [] };
const todas = (valor) => Object.fromEntries(Object.keys(SERVIDOR).map((k) => [k, valor]));
const ESTADOS = {
  contenido: SERVIDOR,
  vacio: { ...SERVIDOR, 'GET /challenges/': [], 'GET /challenges/attempts/history': [], 'GET /auth/solicitudes-datos': [] },
  error: todas(error500),
  carga: todas(nuncaResponde),
};
const ENTRADAS = ['Inicio', 'Retos', 'Asistencia', 'Perfil'];

/** Las barras de abajo que hay en la pantalla (debe haber una o ninguna). @param {any} raiz */
const barras = (raiz) => enOrden(raiz).filter((e) => e.tagName === 'nav' && String(e.className).split(/\s+/).includes('nav-inferior'));
/** Lo que dice una barra: los textos de sus entradas y cuáles están activas. @param {any} barra */
function leerBarra(barra) {
  const enlaces = enOrden(barra).filter((e) => e.tagName === 'a');
  // El ícono va en un span con aria-hidden: el texto de la entrada es el nodo de texto directo del enlace.
  const texto = (a) => a.children.filter((n) => n.nodeType === 3).map((n) => n.data).join('');
  return { textos: enlaces.map(texto), activas: enlaces.filter((a) => a.getAttribute('aria-current') === 'page').map(texto), enlaces };
}

/** La pantalla trae exactamente UNA barra, con las 4 entradas del estudiante y esa pestaña activa (y solo esa). */
function exigirBarra(raiz, activa, donde) {
  const todasLasBarras = barras(raiz);
  assert.equal(todasLasBarras.length, 1, `${donde}: exactamente una barra (hay ${todasLasBarras.length})`);
  const b = leerBarra(todasLasBarras[0]);
  assert.deepEqual(b.textos, ENTRADAS, `${donde}: las entradas del estudiante`);
  assert.deepEqual(b.activas, [activa], `${donde}: la pestaña activa (una sola, con aria-current="page")`);
  assert.equal(todasLasBarras[0].getAttribute('aria-label'), 'Navegación principal', `${donde}: la barra tiene nombre accesible`);
  for (const a of b.enlaces) assert.match(a.getAttribute('href'), /^#\//, `${donde}: cada entrada es un enlace interno`);
}

const REVISION = {
  challenge: { id: 'reto-1', title: 'at_the_airport', questions: [{ id: 'q1', question_text: 'Where is the ___?', options_json: [{ label: 'A', value: 'gates' }, { label: 'B', value: 'gate' }] }] },
  respuestasDadas: { q1: 'B' }, resultado: { coins_earned: 0, correct_answers: [{ question_id: 'q1', correct_answer: 'B' }] }, rol: 'student',
};
const conAnillo = () => ctxEstudiante({ config: CONFIG_NAV });
const sinAnillo = () => ctxEstudiante({ config: { ENGRAMA_AUTH: 'supabase' } });

test('U62 (la barra): Inicio, Retos, Asistencia y la revisión traen UNA barra con su pestaña activa, en contenido, vacío, error y carga', async () => {
  /** @type {Array<[string, string, (r: any) => unknown]>} */
  const vistas = [
    ['inicio', 'Inicio', (r) => renderInicio(r, conAnillo())],
    ['retos', 'Retos', (r) => renderRetos(r, ctxEstudiante())],
    ['asistencia', 'Asistencia', (r) => renderAsistencia(r, {}, ctxEstudiante())],
    ['revisión', 'Retos', (r) => renderRevision(r, REVISION)],
  ];
  for (const [nombre, activa, fn] of vistas) {
    for (const [estado, rutas] of Object.entries(ESTADOS)) {
      const { raiz, cerrar } = await pintar(rutas, fn);
      try { exigirBarra(raiz, activa, `${nombre} (${estado})`); } finally { cerrar(); }
    }
  }
});

test('U62 (la barra): la clase en vivo y el examen de nivel traen la barra con Inicio activa, con destino configurado y sin él', async () => {
  for (const [nombre, render] of /** @type {Array<[string, Function]>} */ ([['clase en vivo', renderVivo], ['examen de nivel', renderNivel]])) {
    for (const [caso, ctx] of /** @type {Array<[string, () => any]>} */ ([['con destino', conAnillo], ['no disponible', sinAnillo]])) {
      const { raiz, cerrar } = await pintar(SERVIDOR, (r) => render(r, {}, ctx()));
      try { exigirBarra(raiz, 'Inicio', `${nombre} (${caso})`); } finally { cerrar(); }
    }
  }
});

test('U62 (la barra): el aviso y las solicitudes, por la ruta, traen la barra con Perfil activa (contenido, vacío, error y carga)', async () => {
  for (const [estado, rutas] of Object.entries(ESTADOS)) {
    const { raiz, cerrar } = await pintar(rutas, (r) => renderSolicitudesDatos(r, ctxEstudiante()));
    try { exigirBarra(raiz, 'Perfil', `solicitudes (${estado})`); } finally { cerrar(); }
  }
  const { raiz, cerrar } = await pintar(SERVIDOR, (r) => renderLeerAviso(r, { aviso: leerAviso(), solicitudes: '#/datos/solicitudes', alVolver: () => {}, rol: 'student' }));
  try { exigirBarra(raiz, 'Perfil', 'aviso (con sesión)'); } finally { cerrar(); }
});

test('U62 (la barra): sin sesión no hay barra: el aviso abierto desde la entrada no la lleva, ni las solicitudes pintadas dentro del aviso obligatorio', async () => {
  const aviso = await pintar(SERVIDOR, (r) => renderLeerAviso(r, { aviso: leerAviso(), alVolver: () => {} }));
  try {
    assert.equal(barras(aviso.raiz).length, 0, 'el aviso desde la entrada: sin barra (no hay a dónde ir)');
    assert.ok(textoDe(aviso.raiz).includes('Tratamiento de tus datos'), 'y el aviso se sigue viendo');
  } finally { aviso.cerrar(); }
  const sol = await pintar(SERVIDOR, (r) => renderSolicitudesDatos(r, { token: 'token-fijo', alVolver: () => {} }));
  try { assert.equal(barras(sol.raiz).length, 0, 'las solicitudes dentro del aviso obligatorio: sin barra (el router está apagado)'); } finally { sol.cerrar(); }
});

test('U60: el reto en curso NO lleva barra (una tarea por pantalla), ni en la pregunta ni si falla', async () => {
  for (const [estado, rutas] of Object.entries({ contenido: SERVIDOR, error: todas(error500) })) {
    const { raiz, cerrar } = await pintar(rutas, (r) => renderRetoFlujo(r, { id: 'reto-1' }, {}, ctxEstudiante()));
    try { assert.equal(barras(raiz).length, 0, `reto en curso (${estado})`); } finally { cerrar(); }
  }
});

// ---------- W70 (§5.6): la barra del profe y del admin, sobria; sale la barra de arriba de sus inicios; el selector, en su renglón ----------
// Tramposos: x_inscripcion_sin_barra (profe/inscripcion.js), x_inicio_del_profe_con_barra_de_arriba (profe/grupos.js) y, de W68, x_error_de_retos_sin_barra
// (estudiante/retos.js), x_solicitudes_sin_barra (vistas/datos_solicitudes.js) y x_reto_con_barra (navegacion.js).
const { ctxProfe, ctxAdmin, GID } = await import('./fotos_de_navegacion.mjs');
const { renderGrupos } = await import('../../src/vistas/profe/grupos.js');
const { renderGrupo } = await import('../../src/vistas/profe/grupo.js');
const { renderSesionAsistencia } = await import('../../src/vistas/profe/sesion_asistencia.js');
const { renderInscripcion } = await import('../../src/vistas/profe/inscripcion.js');
const { renderLogro } = await import('../../src/vistas/profe/logro.js');
const { renderErrores } = await import('../../src/vistas/profe/errores.js');
const { renderRetosProfe } = await import('../../src/vistas/profe/retos.js');
const { renderCrearGrupo } = await import('../../src/vistas/admin/crear_grupo.js');
const { renderAsignarDocente } = await import('../../src/vistas/admin/asignar_docente.js');
const { renderImportarCsv } = await import('../../src/vistas/admin/importar_csv.js');
const { renderPerfil } = await import('../../src/vistas/perfil.js');

const SERVIDOR_PROFE = { ...SERVIDOR, 'GET /teachers/groups/g2/solicitudes': [] };
const ESTADOS_PROFE = {
  contenido: SERVIDOR_PROFE,
  vacio: { ...SERVIDOR_PROFE, 'GET /teachers/groups': [], [`GET /teachers/groups/${GID}/students`]: [], 'GET /challenges/all': [] },
  error: Object.fromEntries(Object.keys(SERVIDOR_PROFE).map((k) => [k, error500])),
  carga: Object.fromEntries(Object.keys(SERVIDOR_PROFE).map((k) => [k, nuncaResponde])),
};

/** La pantalla trae exactamente UNA barra, con esas entradas y esa activa (o ninguna). */
function exigirBarraDe(raiz, entradas, activa, donde) {
  const todasLasBarras = barras(raiz);
  assert.equal(todasLasBarras.length, 1, `${donde}: exactamente una barra (hay ${todasLasBarras.length})`);
  const b = leerBarra(todasLasBarras[0]);
  assert.deepEqual(b.textos, entradas, `${donde}: las entradas de su rol`);
  assert.deepEqual(b.activas, activa ? [activa] : [], `${donde}: la pestaña activa`);
}

test('U62 (la barra): cada pantalla del profe trae UNA barra (Mis grupos · Retos · Perfil) con su pestaña activa, en contenido, vacío, error y carga', async () => {
  const p = { gid: GID };
  /** @type {Array<[string, string, (r: any) => unknown]>} */
  const vistas = [
    ['mis grupos', 'Mis grupos', (r) => renderGrupos(r, ctxProfe())],
    ['grupo', 'Mis grupos', (r) => renderGrupo(r, p, ctxProfe())],
    ['asistencia', 'Mis grupos', (r) => renderSesionAsistencia(r, p, ctxProfe())],
    ['inscripciones', 'Mis grupos', (r) => renderInscripcion(r, p, ctxProfe())],
    ['logro', 'Mis grupos', (r) => renderLogro(r, p, ctxProfe())],
    ['errores', 'Mis grupos', (r) => renderErrores(r, p, ctxProfe())],
    ['retos del profe', 'Retos', (r) => renderRetosProfe(r, ctxProfe())],
    ['perfil del profe', 'Perfil', (r) => renderPerfil(r, ctxProfe())],
  ];
  for (const [nombre, activa, fn] of vistas) {
    for (const [estado, rutas] of Object.entries(ESTADOS_PROFE)) {
      const { raiz, cerrar } = await pintar(rutas, fn);
      try { exigirBarraDe(raiz, ['Mis grupos', 'Retos', 'Perfil'], activa, `${nombre} (${estado})`); } finally { cerrar(); }
    }
  }
});

test('U62 (la barra): cada pantalla del admin trae UNA barra (Grupos · Perfil) con Grupos activa; en una pantalla del profe abierta por la dirección, su barra sin pestaña activa', async () => {
  const p = { gid: GID };
  /** @type {Array<[string, string|null, (r: any) => unknown]>} */
  const vistas = [
    ['grupos del admin', 'Grupos', (r) => renderCrearGrupo(r, ctxAdmin())],
    ['asignar docente', 'Grupos', (r) => renderAsignarDocente(r, p, ctxAdmin())],
    ['importar estudiantes', 'Grupos', (r) => renderImportarCsv(r, p, ctxAdmin())],
    ['perfil del admin', 'Perfil', (r) => renderPerfil(r, ctxAdmin())],
    ['grupo del profe, visto por el admin', null, (r) => renderGrupo(r, p, ctxAdmin())],
    ['retos del profe, vistos por el admin', null, (r) => renderRetosProfe(r, ctxAdmin())],
  ];
  for (const [nombre, activa, fn] of vistas) {
    for (const [estado, rutas] of Object.entries(ESTADOS_PROFE)) {
      const { raiz, cerrar } = await pintar(rutas, fn);
      try { exigirBarraDe(raiz, ['Grupos', 'Perfil'], activa, `${nombre} (${estado})`); } finally { cerrar(); }
    }
  }
});

test('W70: los inicios del profe y del admin ya no traen la barra de arriba (ni "Cerrar sesión" ni el aviso: viven en Perfil), y con dos instituciones el selector va en su renglón, bajo el título', async () => {
  const dos = [{ id: '11111111-1111-4111-8111-111111111111', nombre: 'UIS (demo)' }, { id: '22222222-2222-4222-8222-222222222222', nombre: 'SENA (demo)' }];
  /** @type {Array<[string, string, (r: any, extra: object) => unknown]>} */
  const inicios = [
    ['mis grupos', 'vista-profe-grupos', (r, extra) => renderGrupos(r, { ...ctxProfe(), ...extra })],
    ['grupos del admin', 'vista-admin-crear-grupo', (r, extra) => renderCrearGrupo(r, { ...ctxAdmin(), ...extra })],
  ];
  for (const [nombre, vista, fn] of inicios) {
    for (const [estado, rutas] of Object.entries({ contenido: ESTADOS_PROFE.contenido, error: ESTADOS_PROFE.error })) {
      const { raiz, cerrar } = await pintar(rutas, (r) => fn(r, { colegios: dos, cambiarColegio: async () => {} }));
      try {
        const donde = `${nombre} (${estado})`;
        assert.equal(enOrden(raiz).filter((e) => String(e.className).split(/\s+/).includes('barra-rol')).length, 0, `${donde}: sin barra de arriba`);
        for (const testid of ['boton-cerrar-sesion', 'barra-ver-aviso', 'ir-a-retos-profe']) assert.equal(enOrden(raiz).find((e) => e.getAttribute?.('data-testid') === testid) ?? null, null, `${donde}: ${testid} ya no está aquí`);
        assert.ok(!textoDe(raiz).includes('Cerrar sesión'), `${donde}: "Cerrar sesión" vive en Perfil`);
        const raizVista = enOrden(raiz).find((e) => e.getAttribute?.('data-testid') === vista);
        const hijos = raizVista.children.filter((n) => n.nodeType !== 3);
        const selector = hijos.find((e) => e.getAttribute('data-testid') === 'selector-colegio-bloque');
        assert.ok(selector, `${donde}: el selector de institución es un renglón propio (hijo directo de la vista)`);
        assert.equal(hijos.indexOf(selector), hijos.findIndex((e) => e.tagName === 'h1') + 1, `${donde}: justo debajo del título`);
      } finally { cerrar(); }
    }
    const una = await pintar(ESTADOS_PROFE.contenido, (r) => fn(r, {}));
    try { assert.equal(enOrden(una.raiz).find((e) => e.getAttribute?.('data-testid') === 'selector-colegio-bloque') ?? null, null, `${nombre}: con una sola institución no hay selector`); } finally { una.cerrar(); }
  }
});
