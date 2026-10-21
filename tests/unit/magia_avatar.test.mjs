// @ts-check
// Sprint de la magia · el avatar (docs/ESPEC_avatar_fluidez.md §2): catálogo cerrado (5 por categoría), colores SOLO por nombre de token,
// lo guardado se normaliza, el almacenamiento que falla no rompe nada y una pieza bloqueada se abre con su insignia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO, CATEGORIAS, COLORES, POR_DEFECTO, normalizar, estaLibre, leerAvatar, guardarAvatar, formasDe, conPieza } from '../../src/ui/avatar.js';
import { INSIGNIAS } from '../../src/ui/insignias.js';
import { textosMagia } from '../../src/textos_magia.js';

const COLOR_PERMITIDO = /^(var\(--[a-z-]+\)|color-mix\(in srgb, (var\(--[a-z-]+\)|white) \d+%, (white|black|transparent)\))$/;

/** Un localStorage de mentira (o uno que lanza en todo). */
function ponerAlmacen(lanza = false) {
  const datos = new Map();
  const almacen = {
    getItem: (k) => { if (lanza) throw new Error('bloqueado'); return datos.has(k) ? datos.get(k) : null; },
    setItem: (k, v) => { if (lanza) throw new Error('lleno'); datos.set(k, String(v)); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: almacen, configurable: true, writable: true });
  return datos;
}

test('avatar: cinco categorías, cinco piezas cada una, nombre en textos y desbloqueos que apuntan a insignias que existen', () => {
  assert.deepEqual([...CATEGORIAS], ['cara', 'pelo', 'ropa', 'accesorio', 'fondo']);
  const ids = new Set(INSIGNIAS.map((i) => i.id));
  for (const c of CATEGORIAS) {
    const piezas = /** @type {any[]} */ (/** @type {any} */ (CATALOGO)[c]);
    assert.equal(piezas.length, 5, c);
    assert.ok(piezas.filter((p) => !p.gana).length >= 3, `${c}: al menos 3 libres`);
    for (const p of piezas) {
      assert.ok(/** @type {any} */ (textosMagia.avatar.piezas)[p.id], `${p.id} sin nombre`);
      if (p.gana) { assert.ok(ids.has(p.gana.insignia), p.id); assert.ok(p.gana.nivel >= 1 && p.gana.nivel <= 5, p.id); }
    }
    assert.ok(piezas.some((p) => p.id === /** @type {any} */ (POR_DEFECTO)[c] && !p.gana), `${c}: la de por defecto es libre`);
  }
});

test('avatar: cada color es un token o una mezcla con white/black/transparent, y cada forma nombra un color que existe', () => {
  for (const [nombre, valor] of Object.entries(COLORES)) assert.match(valor, COLOR_PERMITIDO, nombre);
  for (const c of CATEGORIAS) {
    for (const p of /** @type {any[]} */ (/** @type {any} */ (CATALOGO)[c])) {
      for (const f of formasDe(conPieza(POR_DEFECTO, c, p.id))) {
        for (const color of [f.f, f.s].filter(Boolean)) assert.ok(String(color) in COLORES, `${p.id}: ${color}`);
        assert.equal(JSON.stringify(f.a).match(/#[0-9a-f]{3,8}\b/i), null, `${p.id}: un hex en sus atributos`);
      }
    }
  }
});

test('avatar: normalizar deja solo piezas del catálogo; guardar y leer van y vuelven; si el almacenamiento falla, el de por defecto', () => {
  assert.deepEqual(normalizar(null), POR_DEFECTO);
  assert.deepEqual(normalizar({ pelo: 'pelo-rizos', ropa: 'no-existe', extra: 1 }), { ...POR_DEFECTO, pelo: 'pelo-rizos' });
  const datos = ponerAlmacen();
  assert.equal(guardarAvatar('p1', { pelo: 'pelo-largo', fondo: 'fondo-mar' }), true);
  assert.deepEqual(leerAvatar('p1'), { ...POR_DEFECTO, pelo: 'pelo-largo', fondo: 'fondo-mar' });
  assert.deepEqual(leerAvatar('otra'), POR_DEFECTO, 'cada persona con su avatar');
  datos.set('engrama.avatar.v1.p2', '{no es json');
  assert.deepEqual(leerAvatar('p2'), POR_DEFECTO);
  ponerAlmacen(true);
  assert.equal(guardarAvatar('p1', POR_DEFECTO), false);
  assert.deepEqual(leerAvatar('p1'), POR_DEFECTO);
});

test('avatar: una pieza que se gana queda bloqueada hasta el nivel de su insignia', () => {
  const corona = /** @type {any} */ (CATALOGO.accesorio.find((p) => p.id === 'accesorio-corona'));
  assert.ok(corona?.gana);
  assert.equal(estaLibre(corona, {}), false);
  assert.equal(estaLibre(corona, { retador: corona.gana.nivel - 1 }), false);
  assert.equal(estaLibre(corona, { retador: corona.gana.nivel }), true);
  assert.equal(estaLibre(/** @type {any} */ (CATALOGO.pelo[0]), {}), true);
});
