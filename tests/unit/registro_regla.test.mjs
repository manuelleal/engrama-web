// @ts-check
// docs/ESPEC_regla_clave.md (C2 y C3): qué le falta a la contraseña del registro. Pura: sin DOM. La línea en vivo y el 422 se prueban en vista_registro.test.mjs.
//   - cada carencia sale por separado y todas a la vez, con el texto exacto;
//   - UNA sola respuesta para tres usos: "no falta nada" coincide con `validarRegistro` (api/registro.js) en un corpus fijo, así que la línea no aprueba lo que el envío rechaza;
//   - ningún texto repite lo escrito, y el 422 nunca devuelve el texto del servidor.
// Tramposo: x_clave_dice_solo_el_largo (src/vistas/registro_regla.js que vuelve a decir solo la primera carencia).
import test from 'node:test';
import assert from 'node:assert/strict';
import { queFalta, mensajeDeLoQueFalta } from '../../src/vistas/registro_regla.js';
import { validarRegistro, SIMBOLOS_CLAVE } from '../../src/api/registro.js';
import { textos } from '../../src/textos.js';

const SIMBOLOS = [...SIMBOLOS_CLAVE].join(' ');

test('queFalta: cada carencia sale por separado (largo, letra, número o símbolo, tope en bytes)', () => {
  assert.deepEqual(queFalta(''), { vacia: true, corta: true, larga: false, sinLetra: true, sinNumeroOSimbolo: true });
  assert.deepEqual(queFalta('abcdefghij'), { vacia: false, corta: false, larga: false, sinLetra: false, sinNumeroOSimbolo: true });
  assert.deepEqual(queFalta('1234567890'), { vacia: false, corta: false, larga: false, sinLetra: true, sinNumeroOSimbolo: false });
  assert.deepEqual(queFalta('abc'), { vacia: false, corta: true, larga: false, sinLetra: false, sinNumeroOSimbolo: true });
  assert.deepEqual(queFalta('abcdefghi1'), { vacia: false, corta: false, larga: false, sinLetra: false, sinNumeroOSimbolo: false });
  assert.equal(queFalta('ñ'.repeat(36) + '1').larga, true, '73 bytes');
});

test('queFalta: el largo se cuenta en caracteres y el tope en bytes, como el backend (la ñ y las tildes pesan 2)', () => {
  assert.equal(queFalta('ñññññññññ1').corta, false, '10 caracteres aunque pesen 19 bytes');
  assert.equal(queFalta('ñññññññ1').corta, true, '8 caracteres');
  const tope = 'a'.repeat(71) + '1'; // 72 bytes exactos
  assert.equal(queFalta(tope).larga, false);
  assert.equal(queFalta(`${tope}1`).larga, true, '73 bytes');
  assert.equal(queFalta('ñ'.repeat(36) + '12').larga, true, '36 ñ + 2 dígitos = 74 bytes');
  assert.equal(queFalta('ñ'.repeat(35) + '12').larga, false, '35 ñ + 2 dígitos = 72 bytes');
});

test('queFalta: un número es 0 a 9 (no ² ni los dígitos árabes) y un símbolo es uno de la lista (no el espacio, el ? ni la /)', () => {
  for (const c of ['²', '٣', ' ', '?', '/', '¿', '€']) assert.equal(queFalta(`abcdefghi${c}`).sinNumeroOSimbolo, true, `"${c}" no cuenta`);
  for (const c of [...SIMBOLOS_CLAVE, '0', '9']) assert.equal(queFalta(`abcdefghi${c}`).sinNumeroOSimbolo, false, `"${c}" cuenta`);
  assert.equal(queFalta('1234567890').sinLetra, true);
  assert.equal(queFalta('ñññññññññ1').sinLetra, false, 'la ñ es letra');
  assert.equal(queFalta('ÁÉÍÓÚáéíóú-').sinLetra, false, 'las tildes son letras');
});

test('mensajeDeLoQueFalta: dice exactamente qué falta, todo junto, y null si está vacía o ya cumple', () => {
  const numSim = `un número o un símbolo (${SIMBOLOS})`;
  assert.equal(mensajeDeLoQueFalta(''), null, 'la vacía tiene su propio mensaje');
  assert.equal(mensajeDeLoQueFalta('abcdefghi1'), null);
  assert.equal(mensajeDeLoQueFalta('abcdef'), `Te falta: llegar a 10 caracteres y ${numSim}.`);
  assert.equal(mensajeDeLoQueFalta('123456'), 'Te falta: llegar a 10 caracteres y una letra.');
  assert.equal(mensajeDeLoQueFalta('abcdefghij'), `Te falta: ${numSim}.`);
  assert.equal(mensajeDeLoQueFalta('1234567890'), 'Te falta: una letra.');
  assert.equal(mensajeDeLoQueFalta('   '), `Te falta: llegar a 10 caracteres, una letra y ${numSim}.`);
  assert.equal(mensajeDeLoQueFalta('ñ'.repeat(37)), `${textos.registro.errores.contrasenaLarga} Te falta: ${numSim}.`, 'demasiado larga y además sin número');
  assert.equal(mensajeDeLoQueFalta('ñ'.repeat(36) + '12'), textos.registro.errores.contrasenaLarga, 'solo demasiado larga');
});

/** Un corpus fijo de contraseñas (semilla fija: el mismo siempre). */
function corpus() {
  let semilla = 20261020;
  const azar = (n) => { semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0; return semilla % n; };
  const alfabeto = [...'abcXYZ', 'ñ', 'Á', 'é', '1', '7', '0', '²', '٣', ' ', '?', '/', '€', '😀', ...SIMBOLOS_CLAVE];
  const lista = ['', ' ', 'a', '1', '-', 'abcdefghij', '1234567890', 'abcdefghi1', 'ñ'.repeat(36) + '1', 'a'.repeat(71) + '1', 'a'.repeat(72) + '1', 'ñ'.repeat(10)];
  for (let i = 0; i < 700; i += 1) {
    const largo = azar(4) === 0 ? 30 + azar(50) : azar(16);
    lista.push(Array.from({ length: largo }, () => alfabeto[azar(alfabeto.length)]).join(''));
  }
  return lista;
}

test('coincide con validarRegistro en un corpus: "no falta nada" ⇔ el envío no la rechaza, y el primer motivo es el mismo', () => {
  let cumplen = 0;
  for (const clave of corpus()) {
    const f = queFalta(clave);
    const local = /** @type {any} */ (validarRegistro({ contrasena: clave })).errores?.contrasena;
    const sinFaltas = !f.vacia && !f.corta && !f.larga && !f.sinLetra && !f.sinNumeroOSimbolo;
    assert.equal(sinFaltas, local === undefined, `"${clave}": línea ${sinFaltas ? 'aprueba' : 'rechaza'}, envío ${local ?? 'aprueba'}`);
    const primero = f.vacia ? 'vacio' : f.corta ? 'corta' : f.larga ? 'larga' : (f.sinLetra || f.sinNumeroOSimbolo) ? 'composicion' : undefined;
    assert.equal(primero, local, `"${clave}": el mismo primer motivo`);
    assert.equal(mensajeDeLoQueFalta(clave) === null, f.vacia || sinFaltas, `"${clave}": el mensaje es null solo si está vacía o cumple`);
    if (sinFaltas) cumplen += 1;
  }
  assert.ok(cumplen > 20, `el corpus tiene contraseñas que cumplen (${cumplen}) y las que no`);
});

test('ningún mensaje repite lo escrito', () => {
  for (const clave of ['Zq9mxwk', 'Qw3rty', 'mnbvcxz', 'Hola Mundo Nuevo', 'Zq9mxwkLpo']) {
    for (const texto of [mensajeDeLoQueFalta(clave)]) assert.ok(texto === null || !texto.includes(clave), `"${clave}" no está en el mensaje`);
  }
});
