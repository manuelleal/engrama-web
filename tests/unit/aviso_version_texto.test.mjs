// @ts-check
// Aviso v2, auditoría H-4 (docs/ESPEC_aviso_datos.md, adenda): el texto declara SU versión (VERSION_TEXTO). Si la versión que pide el servidor
// (config.json: AVISO_VERSION) no coincide con la del texto que este cliente trae, aceptar sería aceptar un texto que no es el de esa versión
// (el service worker pudo servir el shell viejo con el config nuevo, o al revés). Entonces `renderConsentimiento` NO ofrece la casilla y recarga
// UNA sola vez (marca en sessionStorage, con try/catch: si el almacenamiento falla, no recarga: nunca un bucle).
// Tramposos: x_aviso_version_sin_guardia (ofrece la casilla aunque las versiones difieran), x_aviso_recarga_en_bucle (recarga sin marcar).
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, crearRaiz, buscar } from './foto_vistas.mjs';
import { configurarAviso, leerAviso } from '../../src/aviso.js';
import { renderConsentimiento, estadoDelTexto, MARCA_RECARGA } from '../../src/vistas/aviso_datos.js';
import { VERSION_TEXTO } from '../../src/textos_aviso.js';

const CONFIG = { AVISO_RESPONSABLE: 'Christiam Puentes (creador de ENGRAMA), con la institución de tu curso', AVISO_CONTACTO: 'datos@piloto.test' };

/**
 * Pinta el consentimiento con la versión de config dada. Devuelve la raíz, cuántas veces se pidió recargar y el almacén usado.
 * @param {string} versionConfig @param {{almacen?: any}} [opciones]
 */
function pintar(versionConfig, opciones = {}) {
  const entorno = entornoDeFotos({});
  try {
    configurarAviso({ ...CONFIG, AVISO_VERSION: versionConfig });
    if (opciones.almacen) /** @type {any} */ (globalThis).sessionStorage = opciones.almacen;
    let recargas = 0;
    const raiz = crearRaiz();
    renderConsentimiento(raiz, { aviso: leerAviso(), aceptar: async () => {}, salir: async () => {}, recargar: () => { recargas += 1; } });
    return { raiz, recargas: () => recargas, almacen: /** @type {any} */ (globalThis).sessionStorage };
  } finally { entorno.restaurar(); }
}

test('aviso versión: el texto declara su versión (2026-10-v2) y es la que el despliegue prepara', () => {
  assert.equal(VERSION_TEXTO, '2026-10-v2');
});

test('aviso versión: si la versión de config coincide con la del texto, ofrece la casilla y NO recarga', () => {
  const { raiz, recargas } = pintar(VERSION_TEXTO);
  assert.ok(buscar(raiz, 'aviso-casilla'), 'la casilla está');
  assert.ok(buscar(raiz, 'aviso-aceptar'), 'el botón está');
  assert.equal(recargas(), 0);
});

test('aviso versión: si no coincide, NO ofrece la casilla ni el botón y recarga UNA vez (marca en sessionStorage)', () => {
  const { raiz, recargas, almacen } = pintar('2026-10-v1');
  assert.equal(buscar(raiz, 'aviso-casilla'), null, 'sin casilla no se acepta un texto que no es el de esa versión');
  assert.equal(buscar(raiz, 'aviso-aceptar'), null);
  assert.equal(recargas(), 1);
  assert.equal(almacen.getItem(MARCA_RECARGA), '1', 'queda la marca de que ya se recargó');
});

test('aviso versión: tras la recarga, si sigue sin coincidir NO vuelve a recargar (sin bucle) y avisa con una salida', () => {
  const almacen = (() => { const m = new Map([[MARCA_RECARGA, '1']]); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();
  const { raiz, recargas } = pintar('2026-10-v1', { almacen });
  assert.equal(recargas(), 0, 'una sola recarga: la segunda vez no');
  assert.equal(buscar(raiz, 'aviso-casilla'), null);
  assert.ok(buscar(raiz, 'aviso-texto-desactualizado'), 'dice que hay una actualización pendiente');
  assert.ok(buscar(raiz, 'aviso-no-acepto'), 'y deja salir');
});

test('aviso versión: si sessionStorage falla (privado, bloqueado), no recarga: sin poder marcar, un bucle sería posible', () => {
  const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); }, removeItem: () => { throw new Error('bloqueado'); } };
  const { raiz, recargas } = pintar('2026-10-v1', { almacen: roto });
  assert.equal(recargas(), 0);
  assert.equal(buscar(raiz, 'aviso-casilla'), null);
  assert.ok(buscar(raiz, 'aviso-texto-desactualizado'));
  // y si getItem anda pero setItem falla, tampoco:
  const soloLee = { getItem: () => null, setItem: () => { throw new Error('lleno'); }, removeItem: () => {} };
  assert.equal(estadoDelTexto({ version: '2026-10-v1' }, soloLee), 'distinta');
});

test('aviso versión: cuando coincide, borra la marca (una desincronización futura puede recargar otra vez)', () => {
  const m = new Map([[MARCA_RECARGA, '1']]);
  const almacen = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  assert.equal(estadoDelTexto({ version: VERSION_TEXTO }, almacen), 'ok');
  assert.equal(m.has(MARCA_RECARGA), false);
});

test('aviso versión: la marca no menciona el consentimiento (el servidor es quien sabe quién aceptó; nada de eso en el navegador)', () => {
  assert.doesNotMatch(MARCA_RECARGA, /consent|acepto|2026-10/i);
});
