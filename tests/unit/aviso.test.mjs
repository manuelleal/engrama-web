// @ts-check
// G (aviso de datos, Ley 1581): src/aviso.js. El responsable, el contacto y la versión salen de config.json
// (nunca del código); si falta cualquiera, no hay aviso y la app no continúa. El consentimiento se decide por lo
// que dice el SERVIDOR (`consentimiento` de la Sesion), nunca por algo guardado en el navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { leerAvisoDeConfig, debePedirConsentimiento } from '../../src/aviso.js';

const COMPLETA = { AVISO_RESPONSABLE: 'Responsable X', AVISO_CONTACTO: 'datos@x.test', AVISO_VERSION: '2026-10-v1' };

test('leerAvisoDeConfig: con las tres claves, el aviso queda completo (y recorta espacios)', () => {
  const aviso = leerAvisoDeConfig({ ...COMPLETA, AVISO_CONTACTO: '  datos@x.test  ' });
  assert.deepEqual(aviso, { ok: true, faltan: [], responsable: 'Responsable X', contacto: 'datos@x.test', version: '2026-10-v1' });
});

test('leerAvisoDeConfig: sin responsable, contacto o versión (ausente, vacío, solo espacios o no texto) no hay aviso: ok es false', () => {
  for (const clave of ['AVISO_RESPONSABLE', 'AVISO_CONTACTO', 'AVISO_VERSION']) {
    for (const valor of [undefined, '', '   ', null, 7]) {
      const aviso = leerAvisoDeConfig({ ...COMPLETA, [clave]: valor });
      assert.equal(aviso.ok, false, `${clave}=${JSON.stringify(valor)} debe dejar el aviso incompleto`);
      assert.deepEqual(aviso.faltan, [clave]);
    }
  }
  assert.deepEqual(leerAvisoDeConfig({}).faltan, ['AVISO_RESPONSABLE', 'AVISO_CONTACTO', 'AVISO_VERSION']);
  assert.equal(leerAvisoDeConfig(/** @type {any} */ (undefined)).ok, false, 'ni siquiera hay config.json');
});

test('debePedirConsentimiento: nunca aceptó o aceptó otra versión: sí; la vigente: no; el modo mock (sin el dato): no', () => {
  const vigente = leerAvisoDeConfig(COMPLETA);
  assert.equal(debePedirConsentimiento({ consentimiento: null }, vigente), true, 'nunca aceptó');
  assert.equal(debePedirConsentimiento({ consentimiento: '2026-01-v0' }, vigente), true, 'versión vieja: se vuelve a pedir');
  assert.equal(debePedirConsentimiento({ consentimiento: '2026-11-v2' }, vigente), true, 'cualquier versión distinta se vuelve a pedir');
  assert.equal(debePedirConsentimiento({ consentimiento: '2026-10-v1' }, vigente), false);
  assert.equal(debePedirConsentimiento({}, vigente), false, 'modo mock: la Sesion no trae el dato y no se pide');
});
