// @ts-check
// U35 y U36 (docs/ESPEC_juego_oleada1.md §9.3, W43): reto individual = 10 en todo lo sintético.
// Mock: `coins_reward` por defecto 10; más de 20 al crear es 422 y no crea nada; un reto ya guardado por encima paga y muestra 20; `max_winners` omitido =
// max(estudiantes activos del grupo, 40); explícito se respeta; la bolsa nace en 200.000.
// Sembrador y herramientas: 10 por reto, sin `max_winners`, y ninguna siembra un reto que el servidor rechazaría (más de 20).
// Tramposos: x_mock_reto_sin_tope y x_mock_carrera_de_10 (herramientas/mock/rutas_challenges.mjs), x_sembrador_reto_de_5 (herramientas/sembrar/mapeo.mjs),
// x_demo_reto_de_30 (herramientas/demo.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crearEstado, crearTenant, ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';
import { crearGrupo, asignarDocente, importarCsv } from '../../herramientas/mock/rutas_admin.mjs';
import { crearChallenge, listarChallenges, verChallenge } from '../../herramientas/mock/rutas_challenges.mjs';
import { arrancarIntento, enviarIntento } from '../../herramientas/mock/rutas_intentos.mjs';
import { ErrorHTTP } from '../../herramientas/mock/errores.mjs';
import { sembrarDemo } from '../../herramientas/demo.mjs';
import { COINS_REWARD } from '../../herramientas/sembrar/mapeo.mjs';

const req = (token) => ({ headers: { authorization: `Bearer ${token}` } });
const pregunta = { question_text: '2 + 2?', correct_answer: 'A', options_json: [{ label: 'A', value: '4' }, { label: 'B', value: '5' }] };

function mundo(estudiantes = 3) {
  const estado = crearEstado();
  const { cuerpo: grupo } = crearGrupo(estado, req(ADMIN_BOOTSTRAP_TOKEN), { group_code: 'U35-G1' });
  asignarDocente(estado, req(ADMIN_BOOTSTRAP_TOKEN), grupo.id, { documento_id: 'DOCENTE-DEMO' });
  const filas = Array.from({ length: estudiantes }, (_, i) => `u35-est-${i + 1},Estudiante ${i + 1}`).join('\n');
  if (estudiantes > 0) importarCsv(estado, req(ADMIN_BOOTSTRAP_TOKEN), grupo.id, `documento_id,nombre_completo\n${filas}\n`);
  const crear = (extra = {}) => crearChallenge(estado, req(DOCENTE_BOOTSTRAP_TOKEN), { title: 'Reto', description: 'd', group_id: grupo.id, questions: [pregunta], ...extra });
  const ganar = (reto, quien) => {
    const { cuerpo: inicio } = arrancarIntento(estado, req(quien), reto.id);
    return enviarIntento(estado, req(quien), inicio.attempt_id, { answers: [{ question_id: inicio.challenge.questions[0].id, answer: 'A' }] }).cuerpo;
  };
  return { estado, grupo, crear, ganar };
}

test('U35: un reto creado sin coins_reward vale 10, y con 20 se crea (201)', () => {
  const m = mundo();
  assert.equal(m.crear().cuerpo.coins_reward, 10);
  const veinte = m.crear({ coins_reward: 20 });
  assert.equal(veinte.status, 201);
  assert.equal(veinte.cuerpo.coins_reward, 20);
});

test('U35: crear un reto de 21 monedas es 422 y no crea nada', () => {
  const m = mundo();
  assert.throws(() => m.crear({ coins_reward: 21 }), (e) => e instanceof ErrorHTTP && e.status === 422 && /coins_reward/.test(/** @type {any} */ (e).cuerpo.detail));
  assert.equal(m.estado.challenges.size, 0, '0 retos');
});

test('U35: un reto ya guardado con 50 (insertado a mano) muestra 20 y paga 20', () => {
  const m = mundo();
  const { cuerpo: reto } = m.crear();
  m.estado.challenges.get(reto.id).coins_reward = 50; // efecto de fuera: sembrado antes del tope
  assert.equal(verChallenge(m.estado, req('u35-est-1'), reto.id).cuerpo.coins_reward, 20, 'el detalle muestra el tope');
  assert.equal(listarChallenges(m.estado, req('u35-est-1')).cuerpo[0].coins_reward, 20, 'la lista también');
  const resultado = m.ganar(reto, 'u35-est-1');
  assert.equal(resultado.coins_earned, 20);
  assert.equal(m.estado.balances.get(m.estado.tokens.get('u35-est-1')), 20);
});

test('U35: sin max_winners el cupo es max(estudiantes activos del grupo, 40); explícito se respeta', () => {
  assert.equal(mundo(3).crear().cuerpo.max_winners, 40, '3 estudiantes: el piso');
  assert.equal(mundo(45).crear().cuerpo.max_winners, 45, '45 estudiantes: el tamaño del grupo');
  assert.equal(mundo(0).crear().cuerpo.max_winners, 40, 'un grupo vacío no deja el cupo en 0');
  assert.equal(mundo(3).crear({ max_winners: 3 }).cuerpo.max_winners, 3);
});

test('U35: en un grupo de 13 cobran los 13 (ya no es una carrera de 10)', () => {
  const m = mundo(13);
  const { cuerpo: reto } = m.crear();
  const pagos = Array.from({ length: 13 }, (_, i) => m.ganar(reto, `u35-est-${i + 1}`).coins_earned);
  assert.deepEqual(pagos, Array(13).fill(10));
});

test('U35: la bolsa de cada institución nace en 200.000', () => {
  const estado = crearEstado();
  assert.equal(estado.poolBalances.get(estado.tenantDemoId), 200_000);
  assert.equal(estado.poolBalances.get(crearTenant(estado, { name: 'Otra', slug: 'otra' })), 200_000);
});

test('U36: el sembrador usa 10 por reto, y la demo siembra sin un solo 422, con retos de 20 o menos', () => {
  assert.equal(COINS_REWARD, 10);
  const estado = crearEstado();
  sembrarDemo(estado); // un 422 lanzaría aquí
  const retos = [...estado.challenges.values()];
  assert.equal(retos.length, 3);
  for (const r of retos) assert.ok(r.coins_reward <= estado.economia.topeDelReto, `${r.title}: ${r.coins_reward} monedas`);
});

test('U36: ninguna herramienta siembra un reto de más de 20 monedas (el servidor lo rechazaría con 422)', () => {
  for (const archivo of ['demo.mjs', 'fluidez.mjs', 'largos_fin_reto.mjs', 'galeria_juego.mjs']) {
    const fuente = readFileSync(fileURLToPath(new URL(`../../herramientas/${archivo}`, import.meta.url)), 'utf8');
    const valores = [...fuente.matchAll(/coins_reward:\s*(\d+)/g)].map((m) => Number(m[1]));
    assert.ok(valores.length > 0, `${archivo}: siembra al menos un reto con su valor escrito`);
    for (const v of valores) assert.ok(v <= 20, `${archivo}: coins_reward ${v} pasa del tope de 20`);
  }
});
