// @ts-check
// Adenda 17.8 (commit del mock): el mock responde el 422 de la REGLA DE LA CONTRASEÑA como el backend `539a06a`. Lo que se midió en el backend de verdad
// (TestClient, sin base de datos: la validación del cuerpo ocurre antes de tocarla): el 422 va envuelto en `{"detail": [...]}` y trae
// `{type: "value_error", loc: ["body","contrasena"], msg: "Value error, la contraseña debe tener al menos una letra y al menos un número o un símbolo (- _ . ! @ # $ % & * +)", ctx: {error: {}}}`.
// Los casos de composición son los de `CASOS_DE_COMPOSICION` de engrama-backend/tests/registro/test_unit.py (UR4). Tramposos: x_mock_clave_sin_composicion y
// x_mock_422_sin_detail, los dos sobre herramientas/mock/rutas_registro.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMockApi } from '../../herramientas/mock_api.mjs';
import { crearEstado } from '../../herramientas/mock/estado.mjs';
import { erroresDelRegistro } from '../../herramientas/mock/rutas_registro.mjs';
import { cargarOpenapi, validarContraEsquema } from './validador_openapi.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const openapi = cargarOpenapi(join(RAIZ, 'contratos', 'openapi_5aad55e.json'));
const MENSAJE_COMPOSICION = 'Value error, la contraseña debe tener al menos una letra y al menos un número o un símbolo (- _ . ! @ # $ % & * +)';
const MENSAJE_BYTES = 'Value error, la contraseña no puede pasar de 72 bytes (las tildes, la ñ y los emojis ocupan más de uno)';
const CUERPO = (contrasena) => ({
  codigo: 'XXXX-XXXX', nombre: 'Ana Pérez', correo: 'ana@piloto.test', codigo_estudiantil: '2201234', contrasena, mayor_de_edad: true, aviso_version: '2026-10-v1',
});

const CASOS_DE_COMPOSICION = {
  solo_letras: ['abcdefghij', false],
  solo_digitos: ['1234567890', false],
  letra_y_digito: ['abcdefghi1', true],
  letra_y_simbolo: ['abcdefghi!', true],
  tilde_y_enie_con_digito: ['contraseña1', true],
  mayusculas_con_enie_y_guion: ['Ñandú-Ñoño1', true],
  solo_enies_con_digito: ['ñññññññññ1', true],
  solo_simbolos: ['-_.!@#$%&*+', false],
  simbolo_fuera_de_la_lista: ['clave?????', false],
  espacios_en_vez_de_simbolo: ['mi clave aa', false],
  digito_unicode_no_cuenta: ['abcdefghi²', false],
  digito_arabe_no_cuenta: ['abcdefghi٣', false],
  letras_de_otro_alfabeto: ['παράδειγμα1', true],
};

test('mock (17.8): la composición de la contraseña da, caso por caso, lo mismo que la tabla UR4 del backend, con SU mensaje y sin repetir la contraseña', () => {
  for (const [nombre, [clave, pasa]] of Object.entries(CASOS_DE_COMPOSICION)) {
    const errores = erroresDelRegistro(CUERPO(clave));
    if (pasa) { assert.deepEqual(errores, [], nombre); continue; }
    assert.equal(errores.length, 1, nombre);
    assert.deepEqual(errores[0], { type: 'value_error', loc: ['body', 'contrasena'], msg: MENSAJE_COMPOSICION, input: null, ctx: { error: {} } }, nombre);
  }
});

test('mock (17.8): los 72 bytes ganan a la composición, los 72 caracteres se cuentan como pydantic (puntos de código) y lo corto da el mensaje de siempre', () => {
  const msg = (clave) => erroresDelRegistro(CUERPO(clave)).map((e) => e.msg);
  assert.deepEqual(msg('ñ'.repeat(40)), [MENSAJE_BYTES], '40 ñ = 80 bytes y sin número: gana el error de los bytes');
  assert.deepEqual(msg('ñ'.repeat(36) + '1'), [MENSAJE_BYTES], '37 caracteres, 73 bytes');
  assert.deepEqual(msg('ñ'.repeat(35) + '12'), [], '72 bytes justos');
  assert.deepEqual(msg('🙂'.repeat(17) + 'abc1'), [], '17 emoji + 4 = 72 bytes (cada emoji es UN carácter)');
  assert.deepEqual(msg('🙂'.repeat(19) + 'a1'), [MENSAJE_BYTES], '76+ bytes');
  assert.deepEqual(msg('x'.repeat(72) + '1'), ['Input should be valid'], '73 caracteres: el error genérico de largo, como "at most 72 characters"');
  assert.deepEqual(msg('abc1'), ['Input should be valid'], 'corta');
  assert.deepEqual(msg('🙂🙂🙂🙂🙂'), ['Input should be valid'], '5 emoji son 5 caracteres, aunque pesen 20 bytes');
  assert.deepEqual(msg(12345678901), ['Input should be valid'], 'no es texto');
});

test('mock (17.8): por HTTP, el 422 va en {"detail": [...]}, valida contra HTTPValidationError del backend y NO trae la contraseña (el backend real la devuelve en `input`; el mock no la repite)', async () => {
  const servidor = crearMockApi(crearEstado());
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  try {
    const r = await fetch(`http://127.0.0.1:${servidor.address().port}/auth/registro`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(CUERPO('abcdefghijkl')) });
    assert.equal(r.status, 422);
    const texto = await r.text();
    const json = JSON.parse(texto);
    assert.deepEqual(Object.keys(json), ['detail'], 'envuelto en detail, como FastAPI');
    assert.equal(json.detail.length, 1);
    assert.equal(json.detail[0].msg, MENSAJE_COMPOSICION);
    assert.deepEqual(json.detail[0].loc, ['body', 'contrasena']);
    const { ok, errores } = validarContraEsquema(openapi, 'HTTPValidationError', json);
    assert.ok(ok, errores.join('; '));
    assert.ok(!texto.includes('abcdefghijkl'), 'la contraseña no vuelve en la respuesta');
  } finally { await new Promise((ok) => servidor.close(ok)); }
});
