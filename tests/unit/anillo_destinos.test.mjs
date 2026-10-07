// @ts-check
// W34 · U30 (docs/ESPEC_pantallas_anillo.md §4.6 y §9.3): de dónde salen las direcciones de EVA y SET. SOLO de config.json; válida = https:, o http:
// solo en localhost/127.0.0.1; sin usuario, consulta ni fragmento. Sin base válida para esa institución, null (y la vista no pinta el enlace).
// El mapa por institución gana sobre la base única. Tramposos: x_enlace_sin_config, x_base_de_la_consulta, x_http_fuera_de_local.
import test from 'node:test';
import assert from 'node:assert/strict';
import { baseValida, leerBases } from '../../src/anillo/destinos.js';

const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';

test('U30: ausente o sin forma de dirección, la base es null (nunca un valor por omisión)', () => {
  for (const valor of [undefined, null, '', '   ', 42, {}, [], true, 'no es una url', 'eva.ejemplo.edu.co', '//eva.ejemplo.edu.co', 'javascript:alert(1)', 'ftp://eva.ejemplo.edu.co']) {
    assert.equal(baseValida(valor), null, String(valor));
  }
  assert.deepEqual(leerBases(undefined, T1), { eva: null, set: null });
  assert.deepEqual(leerBases({}, T1), { eva: null, set: null });
  assert.deepEqual(leerBases({ ENGRAMA_AUTH: 'supabase' }, T1), { eva: null, set: null });
});

test('U30: http: fuera de local, con usuario, con consulta o con fragmento → null', () => {
  for (const malo of [
    'http://eva.ejemplo.edu.co', 'http://192.168.1.20:8088', 'http://localhost.evil.com', 'http://127.0.0.1.evil.com',
    'https://usuario@eva.ejemplo.edu.co', 'https://usuario:clave@eva.ejemplo.edu.co', 'https://eva.ejemplo.edu.co/?a=1', 'https://eva.ejemplo.edu.co?a=1',
    'https://eva.ejemplo.edu.co/#x', 'https://eva.ejemplo.edu.co/eva#x', 'https://eva.ejemplo.edu.co/?', 'https://eva.ejemplo.edu.co/#',
  ]) assert.equal(baseValida(malo), null, malo);
});

test('U30: https: sí, y http: solo en localhost y 127.0.0.1; se normaliza sin barra final y con su prefijo de ruta', () => {
  assert.equal(baseValida('https://eva.ejemplo.edu.co'), 'https://eva.ejemplo.edu.co');
  assert.equal(baseValida('https://eva.ejemplo.edu.co/'), 'https://eva.ejemplo.edu.co');
  assert.equal(baseValida('https://ejemplo.edu.co/eva/'), 'https://ejemplo.edu.co/eva');
  assert.equal(baseValida('  https://ejemplo.edu.co:8443/eva  '), 'https://ejemplo.edu.co:8443/eva');
  assert.equal(baseValida('http://localhost:8088'), 'http://localhost:8088');
  assert.equal(baseValida('http://127.0.0.1:8090/eva'), 'http://127.0.0.1:8090/eva');
});

test('U30: el mapa por institución gana sobre la base única de EVA; sin entrada en el mapa, va la única; SET es una sola', () => {
  const config = { SET_URL: 'https://set.ejemplo.edu.co', EVA_URL: 'https://eva.ejemplo.edu.co', EVA_URL_POR_INSTITUCION: { [T1]: 'https://eva-uis.ejemplo.edu.co/' } };
  assert.deepEqual(leerBases(config, T1), { eva: 'https://eva-uis.ejemplo.edu.co', set: 'https://set.ejemplo.edu.co' });
  assert.deepEqual(leerBases(config, T2), { eva: 'https://eva.ejemplo.edu.co', set: 'https://set.ejemplo.edu.co' }, 'otra institución: la base única');
  assert.deepEqual(leerBases(config, null), { eva: 'https://eva.ejemplo.edu.co', set: 'https://set.ejemplo.edu.co' });
  assert.equal(leerBases({ EVA_URL_POR_INSTITUCION: { [T1]: 'https://eva-uis.ejemplo.edu.co' } }, T2).eva, null, 'sin base única ni entrada en el mapa: nada');
});

test('U30: si el mapa trae a la institución pero su dirección no es válida, EVA queda en null: no se cae a otro EVA', () => {
  const config = { EVA_URL: 'https://eva.ejemplo.edu.co', EVA_URL_POR_INSTITUCION: { [T1]: 'http://eva-uis.ejemplo.edu.co' } };
  assert.equal(leerBases(config, T1).eva, null);
  assert.equal(leerBases(config, T2).eva, 'https://eva.ejemplo.edu.co');
  assert.equal(leerBases({ EVA_URL: 'https://eva.ejemplo.edu.co', EVA_URL_POR_INSTITUCION: 'no es un mapa' }, T1).eva, 'https://eva.ejemplo.edu.co');
  assert.equal(leerBases({ EVA_URL: 'https://eva.ejemplo.edu.co', EVA_URL_POR_INSTITUCION: [T1] }, T1).eva, 'https://eva.ejemplo.edu.co');
  assert.equal(leerBases({ SET_URL: 'http://set.ejemplo.edu.co', EVA_URL: 'https://eva.ejemplo.edu.co' }, T1).set, null, 'SET con http fuera de local: no hay enlace a SET');
});

test('U30: un nombre de institución como __proto__ o constructor no se lee del prototipo del mapa', () => {
  const config = { EVA_URL: 'https://eva.ejemplo.edu.co', EVA_URL_POR_INSTITUCION: {} };
  for (const t of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) assert.equal(leerBases(config, t).eva, 'https://eva.ejemplo.edu.co', t);
});
