// @ts-check
// U33 y U34 (docs/ESPEC_juego_oleada1.md §9.3 y adenda §17.1.4, W42): el doble de la asistencia es espejo de la economía decidida.
// 5 por asistir + 5 por puntualidad (5:00 inclusivo), sin multiplicar por la racha; el día es el LOCAL de la institución; UN pago por estudiante,
// grupo y día; y la respuesta del check-in trae SIEMPRE `base`, `puntualidad`, `puntual` y `ya_cobrada_hoy` (base + puntualidad == coins_awarded).
// Los "efectos de fuera" se hacen tocando `estado.reloj` y `estado.economia`, nunca con una ruta de prueba.
// Tramposos (herramientas/mock/rutas_core.mjs): x_mock_multiplica_por_racha, x_mock_puntualidad_siempre, x_mock_dia_utc,
// x_mock_segunda_reinicia_racha, x_mock_segunda_da_409, x_mock_ya_cobrada_siempre_falsa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEstado, ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';
import { crearGrupo, asignarDocente, importarCsv } from '../../herramientas/mock/rutas_admin.mjs';
import { abrirSesion } from '../../herramientas/mock/rutas_teachers.mjs';
import { checkIn, leerHistorialMonedas, historialAsistenciaPropio } from '../../herramientas/mock/rutas_core.mjs';
import { cargarOpenapi, validarContraEsquema } from '../contrato/validador_openapi.mjs';
import { fileURLToPath } from 'node:url';

const req = (token) => ({ headers: { authorization: `Bearer ${token}` } });
/** Un instante a hora de Bogotá (UTC−5), en milisegundos. */
const bogota = (fecha, hora) => Date.parse(`${fecha}T${hora}:00-05:00`);

/** Un mock con un grupo y `n` estudiantes, y el reloj en `ahora` (ms). */
function mundo(ahora, n = 2) {
  const estado = crearEstado();
  let t = ahora;
  estado.reloj.ahora = () => t;
  const { cuerpo: grupo } = crearGrupo(estado, req(ADMIN_BOOTSTRAP_TOKEN), { group_code: 'U33-G1' });
  asignarDocente(estado, req(ADMIN_BOOTSTRAP_TOKEN), grupo.id, { documento_id: 'DOCENTE-DEMO' });
  const filas = Array.from({ length: n }, (_, i) => `u33-est-${i + 1},Estudiante ${i + 1}`).join('\n');
  importarCsv(estado, req(ADMIN_BOOTSTRAP_TOKEN), grupo.id, `documento_id,nombre_completo\n${filas}\n`);
  return {
    estado, grupo,
    poner: (ms) => { t = ms; },
    correr: (ms) => { t += ms; },
    abrir: () => abrirSesion(estado, req(DOCENTE_BOOTSTRAP_TOKEN), grupo.id, { duration_minutes: 120 }).cuerpo,
    marcar: (sesion, quien = 'u33-est-1') => checkIn(estado, req(quien), { session_code: sesion.session_code }).cuerpo,
    perfil: (quien = 'u33-est-1') => estado.profiles.get(estado.tokens.get(quien)),
    libro: (quien = 'u33-est-1') => leerHistorialMonedas(estado, req(quien), 50).cuerpo.entries,
    asistencias: (quien = 'u33-est-1') => historialAsistenciaPropio(estado, req(quien), 50).cuerpo,
  };
}
const SEG = 1000; const MIN = 60 * SEG;
const cuatro = (r) => ({ base: r.base, puntualidad: r.puntualidad, puntual: r.puntual, ya_cobrada_hoy: r.ya_cobrada_hoy });

test('U33: 5 por asistir + 5 por puntualidad: a los 0 s paga 10, a los 5:00 paga 10 (inclusivo), a los 5:01 paga 5 y antes de abrir paga 10', () => {
  for (const [nombre, despuesMs, monedas, puntual] of /** @type {[string, number, number, boolean][]} */ ([
    ['0 s', 0, 10, true], ['5:00', 5 * MIN, 10, true], ['5:01', 5 * MIN + SEG, 5, false], ['antes de abrir', -30 * SEG, 10, true],
  ])) {
    const m = mundo(bogota('2026-10-13', '18:00'));
    const sesion = m.abrir();
    m.correr(despuesMs);
    const r = m.marcar(sesion);
    assert.equal(r.coins_awarded, monedas, nombre);
    assert.deepEqual(cuatro(r), { base: 5, puntualidad: puntual ? 5 : 0, puntual, ya_cobrada_hoy: false }, `${nombre}: los cuatro campos`);
    assert.equal(r.base + r.puntualidad, r.coins_awarded, `${nombre}: base + puntualidad == coins_awarded`);
    assert.equal(r.message, `Check-in exitoso! +${monedas} coins`, 'el mensaje conserva su formato');
  }
});

test('U33: la economía es configuración del estado: con base 4, puntualidad 3 y 10 minutos paga 7 al minuto 8 y 4 al minuto 11', () => {
  for (const [minuto, monedas] of [[8, 7], [11, 4]]) {
    const m = mundo(bogota('2026-10-13', '18:00'));
    Object.assign(m.estado.economia, { asistenciaBase: 4, asistenciaPuntualidad: 3, minutosDePuntualidad: 10 });
    const sesion = m.abrir();
    m.correr(minuto * MIN);
    const r = m.marcar(sesion);
    assert.equal(r.coins_awarded, monedas, `minuto ${minuto}`);
    assert.equal(r.base + r.puntualidad, r.coins_awarded);
  }
});

test('U33: la racha no multiplica nada: con racha 6 que pasa a 7 y 13 que pasa a 14 se paga lo mismo (10)', () => {
  for (const previa of [6, 13]) {
    const m = mundo(bogota('2026-10-13', '18:00'));
    Object.assign(m.perfil(), { current_streak: previa, longest_streak: previa, last_attendance_date: '2026-10-12' });
    const r = m.marcar(m.abrir());
    assert.equal(r.streak, previa + 1, 'la racha sube por día de calendario');
    assert.equal(r.coins_awarded, 10, `con racha ${previa + 1} se paga 10, sin multiplicador`);
  }
});

test('U33: el asiento del libro trae base, puntualidad, puntual y dia (el local), y no trae multiplier', () => {
  const m = mundo(bogota('2026-10-22', '19:30')); // 00:30 del viernes 23 en UTC
  const sesion = m.abrir();
  m.correr(6 * MIN);
  m.marcar(sesion);
  const [asiento] = m.libro();
  assert.equal(asiento.action, 'attendance');
  assert.equal(asiento.amount, 5);
  assert.deepEqual(
    { base: asiento.metadata.base, puntualidad: asiento.metadata.puntualidad, puntual: asiento.metadata.puntual, dia: asiento.metadata.dia },
    { base: 5, puntualidad: 0, puntual: false, dia: '2026-10-22' },
  );
  assert.deepEqual(Object.keys(asiento.metadata).sort(), ['base', 'dia', 'geo_status', 'puntual', 'puntualidad', 'session_id', 'streak']);
  assert.ok(!('multiplier' in asiento.metadata));
});

test('U33: la respuesta del check-in valida contra CheckInResult del contrato exportado en 03c9c0a, que declara los cuatro campos', () => {
  const openapi = cargarOpenapi(fileURLToPath(new URL('../../contratos/openapi_03c9c0a.json', import.meta.url)));
  const propiedades = openapi.components.schemas.CheckInResult.properties;
  assert.deepEqual(
    { base: propiedades.base?.type, puntualidad: propiedades.puntualidad?.type, puntual: propiedades.puntual?.type, ya_cobrada_hoy: propiedades.ya_cobrada_hoy?.type },
    { base: 'integer', puntualidad: 'integer', puntual: 'boolean', ya_cobrada_hoy: 'boolean' },
  );
  const m = mundo(bogota('2026-10-13', '18:00'));
  const primera = m.marcar(m.abrir());
  const segunda = m.marcar(m.abrir());
  for (const r of [primera, segunda]) {
    assert.deepEqual(validarContraEsquema(openapi, 'CheckInResult', r), { ok: true, errores: [] });
    assert.deepEqual(Object.keys(r).sort(), Object.keys(propiedades).sort(), 'ni una clave de más ni de menos (additionalProperties: false)');
  }
});

test('U34: la segunda sesión del mismo día local responde 200 con 0 monedas, ya_cobrada_hoy y la racha igual: 2 registros y 1 asiento', () => {
  const m = mundo(bogota('2026-10-22', '18:00'));
  // Viene con racha 4 (ayer asistió): con racha 1 no se vería si la segunda marca la reinicia.
  Object.assign(m.perfil(), { current_streak: 4, longest_streak: 4, last_attendance_date: '2026-10-21' });
  const primera = m.marcar(m.abrir());
  assert.equal(primera.streak, 5);
  assert.deepEqual({ monedas: primera.coins_awarded, ...cuatro(primera) }, { monedas: 10, base: 5, puntualidad: 5, puntual: true, ya_cobrada_hoy: false });
  m.poner(bogota('2026-10-22', '19:30')); // ya es viernes en UTC: sigue siendo jueves para la institución
  const segunda = m.marcar(m.abrir());
  assert.deepEqual(
    { monedas: segunda.coins_awarded, racha: segunda.streak, ...cuatro(segunda) },
    { monedas: 0, racha: primera.streak, base: 0, puntualidad: 0, puntual: false, ya_cobrada_hoy: true },
  );
  assert.equal(m.asistencias().length, 2, 'la asistencia SÍ quedó registrada');
  assert.deepEqual(m.asistencias().map((a) => [a.attendance_date, a.coins_awarded]), [['2026-10-22', 0], ['2026-10-22', 10]], 'del más nuevo al más viejo');
  assert.equal(m.libro().length, 1, 'un solo asiento: un pago por día');
  assert.equal(m.perfil().current_streak, primera.streak);
});

test('U34: 00:10 del día siguiente (hora local) sí paga, y la racha sube', () => {
  const m = mundo(bogota('2026-10-22', '18:00'));
  const primera = m.marcar(m.abrir());
  m.poner(bogota('2026-10-23', '00:10'));
  const otra = m.marcar(m.abrir());
  assert.equal(otra.coins_awarded, 10);
  assert.equal(otra.ya_cobrada_hoy, false);
  assert.equal(otra.streak, primera.streak + 1);
  assert.equal(m.libro().length, 2);
});

test('U34: manda la primera marca del día aunque la segunda sea puntual y la primera no; y otro estudiante cobra lo suyo', () => {
  const m = mundo(bogota('2026-10-20', '18:00'));
  const s1 = m.abrir();
  m.correr(9 * MIN);
  const tarde = m.marcar(s1);
  assert.equal(tarde.coins_awarded, 5);
  m.poner(bogota('2026-10-20', '19:30'));
  const s2 = m.abrir();
  const puntual = m.marcar(s2);
  assert.deepEqual({ monedas: puntual.coins_awarded, ...cuatro(puntual) }, { monedas: 0, base: 0, puntualidad: 0, puntual: false, ya_cobrada_hoy: true });
  const otro = m.marcar(s2, 'u33-est-2');
  assert.deepEqual({ monedas: otro.coins_awarded, ya: otro.ya_cobrada_hoy }, { monedas: 10, ya: false }, 'la llave es por estudiante');
  assert.equal(m.estado.balances.get(m.estado.tokens.get('u33-est-1')), 5);
});

test('U34: marcar dos veces la MISMA sesión sigue siendo 409 (no cambia)', () => {
  const m = mundo(bogota('2026-10-20', '18:00'));
  const sesion = m.abrir();
  m.marcar(sesion);
  assert.throws(() => m.marcar(sesion), (e) => /** @type {any} */ (e).status === 409);
});
