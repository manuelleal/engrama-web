// @ts-check
// W34 · U29 (docs/ESPEC_pantallas_anillo.md §4.6 y §9.3, decisión 013): `armarEnlaceAnillo` es la ÚNICA función que arma un enlace con pase hacia
// EVA o SET. Da las 5 formas exactas; el pase va solo en el fragmento (`new URL(x).search === ''`); a SET sin `tenant` no hay enlace; a EVA no se
// manda `tenant`; cada valor va codificado; y ningún error lleva el pase. Tramposos: x_pase_en_la_consulta, x_set_sin_tenant, x_clave_mal_escrita.
import test from 'node:test';
import assert from 'node:assert/strict';
import { armarEnlaceAnillo, NOMBRES_DE_DESTINO } from '../../src/anillo/enlace.js';

const EVA = 'https://eva.ejemplo.edu.co';
const SET = 'https://set.ejemplo.edu.co';
const PASE = 'eyJhbGciOiJIUzI1NiJ9.cuerpo-de-prueba.firma';
const TENANT = '11111111-1111-4111-8111-111111111111';

test('U29: armarEnlaceAnillo da las 5 formas exactas de §4.6 y de la decisión 013', () => {
  assert.equal(armarEnlaceAnillo({ base: EVA, destino: 'eva_celular', pase: PASE, sala: '1234' }), `${EVA}/e#pase=${PASE}&sala=1234`);
  assert.equal(armarEnlaceAnillo({ base: EVA, destino: 'eva_tablero', pase: PASE }), `${EVA}/tablero#pase=${PASE}`);
  assert.equal(armarEnlaceAnillo({ base: EVA, destino: 'eva_escamas', pase: PASE }), `${EVA}/escamas#pase=${PASE}`);
  assert.equal(armarEnlaceAnillo({ base: SET, destino: 'set_examen', pase: PASE, tenant: TENANT, codigo: 'UIS-0001' }), `${SET}/index.html#UIS-0001&pase=${PASE}&tenant=${TENANT}`);
  assert.equal(armarEnlaceAnillo({ base: SET, destino: 'set_revisar', pase: PASE, tenant: TENANT }), `${SET}/revisar.html#pase=${PASE}&tenant=${TENANT}`);
  assert.deepEqual([...NOMBRES_DE_DESTINO].sort(), ['eva_celular', 'eva_escamas', 'eva_tablero', 'set_examen', 'set_revisar']);
});

test('U29: el pase va SOLO en el fragmento: la consulta de cada enlace queda vacía y no hay ningún ? en el resultado', () => {
  const enlaces = [
    armarEnlaceAnillo({ base: EVA, destino: 'eva_celular', pase: PASE, sala: 'AB12' }),
    armarEnlaceAnillo({ base: EVA, destino: 'eva_tablero', pase: PASE }),
    armarEnlaceAnillo({ base: EVA, destino: 'eva_escamas', pase: PASE }),
    armarEnlaceAnillo({ base: SET, destino: 'set_examen', pase: PASE, tenant: TENANT, codigo: 'UIS-0001' }),
    armarEnlaceAnillo({ base: SET, destino: 'set_revisar', pase: PASE, tenant: TENANT }),
  ];
  for (const e of enlaces) {
    assert.equal(new URL(e).search, '', e);
    assert.ok(!e.includes('?'), e);
    assert.ok(new URL(e).hash.includes(`pase=${PASE}`), 'el pase está en el fragmento');
    assert.doesNotMatch(new URL(e).pathname, /pase/, 'ni en la ruta');
  }
});

test('U29: a SET sin tenant no hay enlace (lanza); a EVA no se le manda tenant', () => {
  for (const tenant of [undefined, '', '   ']) {
    assert.throws(() => armarEnlaceAnillo({ base: SET, destino: 'set_examen', pase: PASE, tenant, codigo: 'UIS-0001' }), /tenant/);
    assert.throws(() => armarEnlaceAnillo({ base: SET, destino: 'set_revisar', pase: PASE, tenant }), /tenant/);
  }
  for (const destino of ['eva_celular', 'eva_tablero', 'eva_escamas']) {
    const e = armarEnlaceAnillo({ base: EVA, destino, pase: PASE, tenant: TENANT, sala: '1234' });
    assert.ok(!e.includes('tenant'), `${destino}: EVA ignora la institución (cada EVA nace atado a una)`);
  }
});

test('U29: cada valor va codificado: un pase con + / = & # ? y espacios no rompe el fragmento ni se cuela como otra clave', () => {
  const raro = 'a+b/c=d&tenant=otra#x?y z';
  const e = armarEnlaceAnillo({ base: SET, destino: 'set_revisar', pase: raro, tenant: 'un tenant & más' });
  assert.equal(e, `${SET}/revisar.html#pase=${encodeURIComponent(raro)}&tenant=${encodeURIComponent('un tenant & más')}`);
  const hash = new URL(e).hash.slice(1);
  assert.equal(hash.split('&').length, 2, 'dos claves, no más');
  assert.equal(decodeURIComponent(new URLSearchParams(hash).get('pase') ?? ''), raro, 'se recupera tal cual (es lo que hacen EVA y SET)');
  assert.equal(new URL(e).search, '');
  assert.equal(armarEnlaceAnillo({ base: EVA, destino: 'eva_celular', pase: raro, sala: 'Ab12' }), `${EVA}/e#pase=${encodeURIComponent(raro)}&sala=Ab12`);
});

test('U29: la base admite barra final y prefijo de ruta; el código de sala y el del examen respetan su formato', () => {
  assert.equal(armarEnlaceAnillo({ base: 'https://ejemplo.edu.co/eva/', destino: 'eva_tablero', pase: 'p' }), 'https://ejemplo.edu.co/eva/tablero#pase=p');
  assert.equal(armarEnlaceAnillo({ base: `${SET}///`, destino: 'set_revisar', pase: 'p', tenant: 't' }), `${SET}/revisar.html#pase=p&tenant=t`);
  assert.equal(armarEnlaceAnillo({ base: SET, destino: 'set_examen', pase: 'p', tenant: 't', codigo: 'mi_examen-1' }), `${SET}/index.html#mi_examen-1&pase=p&tenant=t`);
  assert.throws(() => armarEnlaceAnillo({ base: SET, destino: 'set_examen', pase: 'p', tenant: 't', codigo: 'mal código&pase=x' }), /código del examen/);
  assert.throws(() => armarEnlaceAnillo({ base: SET, destino: 'set_examen', pase: 'p', tenant: 't' }), /código del examen/);
  assert.throws(() => armarEnlaceAnillo({ base: EVA, destino: 'eva_celular', pase: 'p', sala: '123456789' }), /sala/, 'más de 8 caracteres');
  assert.throws(() => armarEnlaceAnillo({ base: EVA, destino: 'eva_celular', pase: 'p', sala: 'a&b' }), /sala/);
  assert.equal(armarEnlaceAnillo({ base: EVA, destino: 'eva_celular', pase: 'p' }), `${EVA}/e#pase=p`, 'sin sala, EVA pide el código en su propia pantalla');
});

test('U29: sin pase, sin base o con destino desconocido no hay enlace; la base no puede traer consulta ni fragmento; y los errores NUNCA llevan el pase', () => {
  const intentos = [
    () => armarEnlaceAnillo({ base: EVA, destino: 'eva_tablero', pase: '' }),
    () => armarEnlaceAnillo({ base: EVA, destino: 'eva_tablero', pase: /** @type {any} */ (undefined) }),
    () => armarEnlaceAnillo({ base: '', destino: 'eva_tablero', pase: PASE }),
    () => armarEnlaceAnillo({ base: EVA, destino: /** @type {any} */ ('eva_inventado'), pase: PASE }),
    () => armarEnlaceAnillo({ base: `${EVA}/?x=1`, destino: 'eva_tablero', pase: PASE }),
    () => armarEnlaceAnillo({ base: `${EVA}/#a`, destino: 'eva_tablero', pase: PASE }),
    () => armarEnlaceAnillo({ base: SET, destino: 'set_revisar', pase: PASE }),
    () => armarEnlaceAnillo({ base: SET, destino: 'set_examen', pase: PASE, tenant: TENANT, codigo: `no vale ${PASE}` }),
  ];
  for (const intento of intentos) {
    assert.throws(intento, (e) => { assert.ok(!String(e.message).includes(PASE), `el error filtró el pase: ${e.message}`); return true; });
  }
});

test('U29: la clave se llama "pase" (013): nunca "engrama", "Pase" ni "token", y nunca en la consulta', () => {
  const e = armarEnlaceAnillo({ base: SET, destino: 'set_revisar', pase: PASE, tenant: TENANT });
  assert.match(e, /#pase=/);
  assert.doesNotMatch(e, /engrama=|Pase=|token=|[?&]pase/);
  assert.doesNotMatch(armarEnlaceAnillo({ base: EVA, destino: 'eva_tablero', pase: PASE }), /engrama=|Pase=|token=|\?/);
});
