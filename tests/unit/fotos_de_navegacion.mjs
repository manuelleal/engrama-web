// @ts-check
// fotos_de_navegacion.mjs · R9 (docs/ESPEC_navegacion.md §9.1): las vistas que R4 no cubre y la espec de navegación edita, pintadas con
// entradas FIJAS, en sus estados de contenido, vacío y error. `tomarFotosNav()` devuelve { nombre: líneas }. Lo usa regresion_nav.test.mjs
// contra tests/snapshots/vistas_nav_2cba0b8.json. No es un archivo de test (no termina en .test.mjs).
//
// La línea base se escribió UNA vez, sobre 2cba0b8 (antes de tocar `src/`), y no se regenera para que un cambio pase la prueba:
//   R9_ESCRIBIR=tests/snapshots/vistas_nav_2cba0b8.json node tests/unit/fotos_de_navegacion.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { entornoDeFotos, crearRaiz, fotografiar, buscar } from './foto_vistas.mjs';
import { leerAviso } from '../../src/aviso.js';
import { cancelarCelebraciones } from '../../src/ui/celebraciones.js';
import { renderRetos } from '../../src/vistas/estudiante/retos.js';
import { renderAsistencia } from '../../src/vistas/estudiante/asistencia.js';
import { renderRevision } from '../../src/vistas/estudiante/revision.js';
import { renderRetoFlujo } from '../../src/vistas/estudiante/reto_flujo.js';
import { renderVivo } from '../../src/vistas/estudiante/vivo.js';
import { renderNivel } from '../../src/vistas/estudiante/nivel.js';
import { renderLeerAviso } from '../../src/vistas/aviso_datos.js';
import { renderSolicitudesDatos } from '../../src/vistas/datos_solicitudes.js';
import { renderSesionAsistencia, olvidarAsistencias } from '../../src/vistas/profe/sesion_asistencia.js';
import { renderInscripcion } from '../../src/vistas/profe/inscripcion.js';
import { renderLogro } from '../../src/vistas/profe/logro.js';
import { renderErrores } from '../../src/vistas/profe/errores.js';
import { renderRetosProfe } from '../../src/vistas/profe/retos.js';
import { renderCrearGrupo } from '../../src/vistas/admin/crear_grupo.js';
import { renderAsignarDocente } from '../../src/vistas/admin/asignar_docente.js';
import { renderImportarCsv } from '../../src/vistas/admin/importar_csv.js';

export const TENANT = '11111111-1111-4111-8111-111111111111';
export const GID = 'g1';
const CONFIG = { ENGRAMA_AUTH: 'supabase', EVA_URL: 'https://eva.ejemplo.edu.co', SET_URL: 'https://set.ejemplo.edu.co', REGISTRO_CON_CODIGO: true };
const error500 = () => new Response(JSON.stringify({ detail: 'falla sintética' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
const sinHacer = async () => {};

const RETO = {
  id: 'reto-1', title: 'at_the_airport',
  questions: [
    { id: 'q1', question_text: 'Where is the ___?', options_json: [{ label: 'A', value: 'gates' }, { label: 'B', value: 'gate' }] },
    { id: 'q2', question_text: 'Your ___ is ready.', options_json: [{ label: 'A', value: 'ticket' }, { label: 'B', value: 'tickets' }] },
  ],
};
const GRUPOS = [{ id: GID, group_code: 'SINT-B1-01', student_count: 2 }, { id: 'g2', group_code: 'SINT-B1-02', student_count: 0 }];
const ESTUDIANTES = [
  { profile_id: 'p1', full_name: 'Ana Sintética', consistency: { current_streak: 3 }, last_attendance_date: '2020-01-01' },
  { profile_id: 'p2', full_name: 'Beto Sintético', consistency: { current_streak: 0 }, last_attendance_date: null },
];
const SESION_ABIERTA = { id: 's1', session_code: '123456', starts_at: '2020-01-01T10:00:00Z', expires_at: '2099-01-01T10:15:00Z', status: 'active' };
const eje = (axis, status) => ({ axis, status, label: status, cefr_levels: { B1: 2 } });

/** Lo que el servidor devuelve en el estado de CONTENIDO de cada vista: todo fijo, sin fechas de hoy ni azar. */
export const RUTAS_NAV = {
  'GET /challenges/': [{ id: 'reto-1', title: 'at_the_airport', status: 'published' }, { id: 'reto-0', title: 'daily_routines', status: 'published' }],
  'GET /challenges/attempts/history': [{ challenge_id: 'reto-0', status: 'completed', is_correct: true, completed_at: '2020-01-01T00:00:00Z' }],
  'POST /challenges/reto-1/attempt': { attempt_id: 'int-1', challenge: RETO },
  'GET /auth/solicitudes-datos': [{ id: 7, tipo: 'conocer', estado: 'abierta', mensaje: 'Quiero saber qué datos míos guardan.', creada_en: '2020-01-01T00:00:00Z', respuesta: null, respondida_en: null }],
  'GET /teachers/groups': GRUPOS,
  [`GET /teachers/groups/${GID}/students`]: ESTUDIANTES,
  [`POST /teachers/groups/${GID}/attendance-sessions`]: SESION_ABIERTA,
  [`GET /teachers/groups/${GID}/codigo-inscripcion`]: { activo: false, vence: null, cupo: null, usos: null },
  [`GET /teachers/groups/${GID}/solicitudes`]: [{ id: 1, nombre: 'Ana Pérez', codigo_estudiantil: 'uis_220121', creada_en: '2020-01-01T00:00:00Z' }],
  [`GET /teachers/groups/${GID}/achievement`]: { method: {}, students: [{ profile_id: 'p1', full_name: 'Ana Sintética', axes: [eje('Comprehension', 'logrado'), eje('Expression', 'en_desarrollo'), eje('Accuracy', 'a_reforzar')] }] },
  [`GET /teachers/groups/${GID}/item-errors`]: { method: {}, suppressed_items: 1, items: [{ question_id: 'q1', title: 'at_the_airport', question_text: 'Where is the ___?', respondents: 5, errors: 3, blank_answers: 1, top_distractor: { value: 'gates', count: 2 } }] },
  'GET /challenges/all': [{ id: 'reto-1', title: 'at_the_airport', status: 'active', group_id: GID }, { id: 'reto-2', title: 'job_interview', status: 'inactive', group_id: null }],
};

/** Las mismas rutas, vacías (lo que ve una cuenta o un grupo nuevos). */
const VACIAS = {
  'GET /challenges/': [], 'GET /challenges/attempts/history': [], 'GET /auth/solicitudes-datos': [], 'GET /teachers/groups': [],
  [`GET /teachers/groups/${GID}/students`]: [], [`GET /teachers/groups/${GID}/solicitudes`]: [],
  [`GET /teachers/groups/${GID}/achievement`]: { method: {}, students: [] }, [`GET /teachers/groups/${GID}/item-errors`]: { method: {}, suppressed_items: 0, items: [] },
  'GET /challenges/all': [],
};

/** window, navigator y location de mentira; los temporizadores largos (el sondeo de 10 s o de 20 s) NO se programan: una foto no deja nada vivo. Devuelve cómo quitarlos. */
function ponerNavegadorDeMentira() {
  const g = /** @type {any} */ (globalThis);
  const previo = { window: g.window, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), location: g.location, setTimeout: g.setTimeout, setInterval: g.setInterval, warn: console.warn, error: console.error };
  g.window = { addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  g.location = { hash: '', search: '', href: 'http://localhost/', origin: 'http://localhost', pathname: '/' };
  g.setTimeout = (fn, ms, ...resto) => (Number(ms) >= 5000 ? 0 : previo.setTimeout(fn, ms, ...resto));
  g.setInterval = () => 0;
  console.warn = () => {}; console.error = () => {}; // los estados de error avisan por consola a propósito: aquí solo se mira la pantalla
  return () => {
    cancelarCelebraciones();
    g.setTimeout = previo.setTimeout; g.setInterval = previo.setInterval; console.warn = previo.warn; console.error = previo.error;
    if (previo.window === undefined) delete g.window; else g.window = previo.window;
    if (previo.location === undefined) delete g.location; else g.location = previo.location;
    if (previo.navigator) Object.defineProperty(globalThis, 'navigator', previo.navigator); else delete g.navigator;
  };
}

/** Deja correr las promesas pendientes (las vistas que pintan tras un `await` que nadie espera). */
const asentar = () => new Promise((r) => setImmediate(r));

const ctxEstudiante = (extra = {}) => ({
  token: 'token-fijo', sesion: { profileId: 'prof-est-1', nombre: 'Ana Sintética', rol: 'student', colegio: { id: TENANT, nombre: 'UIS (demo)' }, constancia: 3 },
  colegios: [{ id: TENANT, nombre: 'UIS (demo)' }], colegioActivo: TENANT, avisoDatos: true, salir: sinHacer, pedirPase: async () => 'pase-de-fotos', ...extra,
});
const ctxProfe = (extra = {}) => ({
  token: 'token-fijo', sesion: { profileId: 'prof-doc-1', nombre: 'Docente Sintético', rol: 'teacher', colegio: { id: TENANT, nombre: 'UIS (demo)' } },
  colegios: [{ id: TENANT, nombre: 'UIS (demo)' }], colegioActivo: TENANT, avisoDatos: true, salir: sinHacer, config: CONFIG, ...extra,
});
const ctxAdmin = () => ({ ...ctxProfe(), sesion: { profileId: 'prof-adm-1', nombre: 'Admin Sintético', rol: 'admin', colegio: { id: TENANT, nombre: 'UIS (demo)' } } });

/**
 * Las vistas y sus estados. Cada entrada: [nombre, rutas del servidor, cómo pintarla en `raiz`].
 * @returns {Array<[string, Record<string, unknown>, (raiz: any) => unknown]>}
 */
function escenas() {
  const todoFalla = Object.fromEntries(Object.keys(RUTAS_NAV).map((k) => [k, error500]));
  const vacio = { ...RUTAS_NAV, ...VACIAS };
  /** @type {Array<[string, Record<string, unknown>, (raiz: any) => unknown]>} */
  const lista = [];
  const tres = (nombre, pintar) => { lista.push([nombre, RUTAS_NAV, pintar], [`${nombre}_vacio`, vacio, pintar], [`${nombre}_error`, todoFalla, pintar]); };
  tres('retos', (r) => renderRetos(r, ctxEstudiante()));
  lista.push(['asistencia', RUTAS_NAV, (r) => renderAsistencia(r, {}, ctxEstudiante())]);
  lista.push(['reto_en_curso', RUTAS_NAV, (r) => renderRetoFlujo(r, { id: 'reto-1' }, {}, ctxEstudiante())]);
  lista.push(['reto_en_curso_error', todoFalla, (r) => renderRetoFlujo(r, { id: 'reto-1' }, {}, ctxEstudiante())]);
  lista.push(['revision', RUTAS_NAV, (r) => renderRevision(r, {
    challenge: RETO, respuestasDadas: { q1: 'B', q2: 'B' },
    resultado: { coins_earned: 15, correct_answers: [{ question_id: 'q1', correct_answer: 'B' }, { question_id: 'q2', correct_answer: 'A' }] },
  })]);
  lista.push(['vivo', RUTAS_NAV, (r) => renderVivo(r, {}, ctxEstudiante({ config: CONFIG }))]);
  lista.push(['vivo_no_disponible', RUTAS_NAV, (r) => renderVivo(r, {}, ctxEstudiante({ config: { ENGRAMA_AUTH: 'supabase' } }))]);
  lista.push(['nivel', RUTAS_NAV, (r) => renderNivel(r, {}, ctxEstudiante({ config: CONFIG }))]);
  lista.push(['nivel_no_disponible', RUTAS_NAV, (r) => renderNivel(r, {}, ctxEstudiante({ config: { ENGRAMA_AUTH: 'supabase' } }))]);
  lista.push(['aviso_leer', RUTAS_NAV, (r) => renderLeerAviso(r, { aviso: leerAviso(), solicitudes: '#/datos/solicitudes', alVolver: () => {}, rol: 'student' })]); // W68: con sesión, app.js le pasa el rol (para la barra)
  tres('solicitudes', (r) => renderSolicitudesDatos(r, ctxEstudiante()));
  lista.push(['profe_asistencia_formulario', RUTAS_NAV, (r) => renderSesionAsistencia(r, { gid: GID }, ctxProfe())]);
  lista.push(['profe_asistencia_abierta', RUTAS_NAV, async (r) => {
    await renderSesionAsistencia(r, { gid: GID }, ctxProfe());
    await Promise.all(buscar(r, 'form-abrir-sesion').disparar('submit'));
    await asentar();
  }]);
  tres('profe_inscripcion', (r) => renderInscripcion(r, { gid: GID }, ctxProfe()));
  tres('profe_logro', (r) => renderLogro(r, { gid: GID }, ctxProfe()));
  tres('profe_errores', (r) => renderErrores(r, { gid: GID }, ctxProfe()));
  tres('profe_retos', (r) => renderRetosProfe(r, ctxProfe()));
  tres('admin_grupos', (r) => renderCrearGrupo(r, ctxAdmin()));
  lista.push(['admin_asignar_docente', RUTAS_NAV, (r) => renderAsignarDocente(r, { gid: GID }, ctxAdmin())]);
  lista.push(['admin_importar_csv', RUTAS_NAV, (r) => renderImportarCsv(r, { gid: GID }, ctxAdmin())]);
  return lista;
}

/**
 * Pinta cada escena en una raíz nueva y devuelve sus fotos.
 * @param {{solo?: string[]}} [o] `solo`: nombres de las escenas que se quieren (por omisión, todas)
 * @returns {Promise<Record<string, string[]>>}
 */
export async function tomarFotosNav(o = {}) {
  /** @type {Record<string, string[]>} */
  const fotos = {};
  for (const [nombre, rutas, pintar] of escenas()) {
    if (o.solo && !o.solo.includes(nombre)) continue;
    const entorno = entornoDeFotos(rutas);
    const quitar = ponerNavegadorDeMentira();
    try {
      const raiz = crearRaiz();
      await pintar(raiz);
      await asentar();
      fotos[nombre] = fotografiar(raiz);
    } finally {
      olvidarAsistencias(); // W66: la asistencia que una escena abrió no la hereda la siguiente (y su sondeo se apaga)
      quitar();
      entorno.restaurar();
    }
  }
  return fotos;
}

export { ctxEstudiante, ctxProfe, ctxAdmin, ponerNavegadorDeMentira, asentar, CONFIG as CONFIG_NAV };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.env.R9_ESCRIBIR) {
  const fotos = await tomarFotosNav();
  writeFileSync(process.env.R9_ESCRIBIR, `${JSON.stringify({ base: '2cba0b8', vistas: fotos }, null, 2)}\n`);
  console.log(`fotos escritas en ${process.env.R9_ESCRIBIR}: ${Object.keys(fotos).join(', ')}`);
}
