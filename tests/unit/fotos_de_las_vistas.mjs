// @ts-check
// fotos_de_las_vistas.mjs · Las vistas que la espec de pantallas del anillo va a tocar (docs/ESPEC_pantallas_anillo.md
// §9.2, R4), pintadas con entradas FIJAS. `tomarFotos()` devuelve { nombre: líneas }. Lo usa
// regresion_vistas.test.mjs contra tests/snapshots/vistas_595fd98.json.
//
// Para ESCRIBIR la línea base (solo se hizo UNA vez, sobre el commit 595fd98 de la app, y no se regenera para que
// un cambio pase la prueba): `R4_ESCRIBIR=ruta.json node tests/unit/fotos_de_las_vistas.mjs`.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { entornoDeFotos, crearRaiz, fotografiar } from './foto_vistas.mjs';
import { leerAviso } from '../../src/aviso.js';
import { renderEntrada } from '../../src/vistas/entrada.js';
import { renderInicio } from '../../src/vistas/estudiante/inicio.js';
import { renderPerfil } from '../../src/vistas/perfil.js';
import { renderConsentimiento, renderLeerAviso } from '../../src/vistas/aviso_datos.js';
import { renderSinPerfil } from '../../src/vistas/sin_perfil.js';
import { renderGrupos } from '../../src/vistas/profe/grupos.js';
import { renderGrupo } from '../../src/vistas/profe/grupo.js';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

/** Lo que el servidor devuelve a Inicio y al profe: todo fijo, sin fechas de hoy ni azar. */
const RUTAS = {
  'GET /core/coins/balance': { balance: 120, currency: 'COIN' },
  'GET /challenges/': [{ id: 'reto-1', title: 'at_the_airport', status: 'published' }],
  'GET /challenges/attempts/history': [{ challenge_id: 'reto-0', status: 'completed', is_correct: true, completed_at: '2020-01-01T00:00:00Z' }],
  'GET /core/attendance/history': [{ created_at: '2020-01-01T00:00:00Z' }],
  'GET /teachers/groups': [{ id: 'g1', group_code: 'SINT-B1-01', student_count: 2 }, { id: 'g2', group_code: 'SINT-B1-02', student_count: 0 }],
  'GET /teachers/groups/g1/students': [
    { profile_id: 'p1', full_name: 'Ana Sintética', consistency: { current_streak: 3 }, last_attendance_date: '2020-01-01' },
    { profile_id: 'p2', full_name: 'Beto Sintético', consistency: { current_streak: 0 }, last_attendance_date: null },
  ],
};

/** @param {Partial<{nivelConfirmado: unknown}>} [extra] lo que una sesión puede traer de más (W30 en adelante) */
function sesionDeEstudiante(extra = {}) {
  return {
    profileId: 'prof-est-1', nombre: 'Ana Sintética', rol: 'student', colegio: { id: TENANT_A, nombre: 'UIS (demo)', tipo: 'school' },
    grupo: 'SINT-B1-01', modulos: ['engrama'], constancia: 3,
    colegios: [{ id: TENANT_A, nombre: 'UIS (demo)', rol: 'student' }, { id: TENANT_B, nombre: 'SENA (demo)', rol: 'student' }],
    consentimiento: '2026-10-v1', debeCambiarContrasena: false, ...extra,
  };
}

const sinHacer = async () => {};

/**
 * Pinta cada vista en una raíz nueva y devuelve las fotos.
 * @param {{rutasExtra?: Record<string, unknown>, sesion?: object, config?: Record<string, unknown>}} [o] `rutasExtra`: lo que Inicio pide de más en commits posteriores;
 *   `config`: el config.json con las claves del anillo (W35): Inicio y profe/grupos pintan sus enlaces a EVA y SET; sin ella, son las de siempre
 * @returns {Promise<Record<string, string[]>>}
 */
export async function tomarFotos(o = {}) {
  const entorno = entornoDeFotos({ ...RUTAS, ...(o.rutasExtra || {}) });
  const quitarRed = o.config ? ponerRedDeMentira() : () => {};
  try {
    const fotos = {};
    const en = async (nombre, pintar) => { const raiz = crearRaiz(); await pintar(raiz); fotos[nombre] = fotografiar(raiz); };
    const ctxEstudiante = {
      sesion: o.sesion || sesionDeEstudiante(), token: 'token-fijo', colegios: sesionDeEstudiante().colegios, colegioActivo: TENANT_A,
      avisoDatos: true, cambiarContrasena: sinHacer, cambiarColegio: sinHacer, salir: sinHacer,
      ...(o.config ? { config: o.config } : {}),
    };
    await en('entrada_supabase', (raiz) => renderEntrada(raiz, 'supabase', sinHacer));
    await en('entrada_aviso_leer', (raiz) => renderLeerAviso(raiz, { aviso: leerAviso(), alVolver: () => {} }));
    await en('inicio', (raiz) => renderInicio(raiz, ctxEstudiante));
    await en('perfil', (raiz) => renderPerfil(raiz, ctxEstudiante));
    await en('perfil_sin_soporte', (raiz) => renderPerfil(raiz, { avisoDatos: true, salir: sinHacer }));
    await en('aviso_consentimiento', (raiz) => renderConsentimiento(raiz, { aviso: leerAviso(), aceptar: sinHacer, salir: sinHacer }));
    await en('sin_perfil', (raiz) => renderSinPerfil(raiz, { salir: sinHacer }));
    const ctxProfe = {
      token: 'token-fijo', colegios: [{ id: TENANT_A, nombre: 'UIS (demo)' }], colegioActivo: TENANT_A, avisoDatos: true, salir: sinHacer,
      ...(o.config ? { config: o.config, sesion: { rol: 'teacher', colegio: { id: TENANT_A } }, pedirPase: async () => 'pase-de-fotos' } : {}),
    };
    await en('profe_grupos', (raiz) => renderGrupos(raiz, ctxProfe));
    await en('profe_grupo', (raiz) => renderGrupo(raiz, { gid: 'g1' }, ctxProfe));
    return fotos;
  } finally {
    quitarRed();
    entorno.restaurar();
  }
}

/** window y navigator de mentira (el bloque del profe se ata a la red); devuelve cómo quitarlos. */
function ponerRedDeMentira() {
  const g = /** @type {any} */ (globalThis);
  const previo = { window: g.window, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  g.window = { addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  return () => {
    g.window = previo.window;
    if (previo.navigator) Object.defineProperty(globalThis, 'navigator', previo.navigator); else delete g.navigator;
  };
}

export { sesionDeEstudiante, TENANT_A, TENANT_B, RUTAS };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.env.R4_ESCRIBIR) {
  const fotos = await tomarFotos();
  writeFileSync(process.env.R4_ESCRIBIR, `${JSON.stringify({ base: '595fd98', vistas: fotos }, null, 2)}\n`);
  console.log(`fotos escritas en ${process.env.R4_ESCRIBIR}: ${Object.keys(fotos).join(', ')}`);
}
