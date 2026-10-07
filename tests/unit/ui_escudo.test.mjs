// @ts-check
// U8 (ESPEC_mvp_uis.md §11, W7): con level=7 y 999 monedas pero sin nivel confirmado, el escudo
// dice "Por confirmar" — nunca deriva nada de XP/monedas (X7 en tests/tramposos/).
//
// `textoDelEscudo` es la lógica pura (sin `document`, que no existe bajo `node --test` — este
// proyecto no tiene jsdom, por regla del stack, §6.3). `crearEscudo` (con DOM) lo prueban los
// E2E, que sí corren en un navegador de verdad (tests/e2e/entrada.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { textoDelEscudo, crearEscudo, detalleDelNivel, fechaCorta, valorDeNivel } from '../../src/ui/escudo.js';
import { entornoDeFotos, buscar, textoDe, elementos } from './foto_vistas.mjs';

test('U8: sin nivel confirmado, el escudo dice "Por confirmar" aunque level y monedas sean altos', () => {
  // El objeto se parece a un perfil "peligroso" (level alto, monedas altas): textoDelEscudo()
  // ni siquiera lee esos campos, por su firma — es justo lo que prueba este caso.
  assert.equal(textoDelEscudo({ nivelConfirmado: null, level: 7, monedas: 999 }), 'Por confirmar');
});

test('U8: sin argumento, también dice "Por confirmar"', () => {
  assert.equal(textoDelEscudo(undefined), 'Por confirmar');
});

test('U8: con un nivel confirmado de verdad, lo muestra', () => {
  assert.equal(textoDelEscudo({ nivelConfirmado: 'B1' }), 'B1');
});

// W30 (docs/ESPEC_pantallas_anillo.md §4.3, U15): el escudo con el nivel de /auth/me. Textos del dictamen pedagógico 03 (G1, G4, G6).
const DEFINITIVO = { cefr: 'B1', provisional: false, fuente: 'set', evaluadoEn: '2026-10-06T15:00:00Z' };
const PROVISIONAL = { ...DEFINITIVO, provisional: true };
const AYUDA_G1 = 'Falta tu escritura. Cuando tu profe la califique, tu nivel puede subir, bajar o quedar igual.';

test('U15: sin nivel confirmado el escudo dice "Por confirmar" y nada más; con uno definitivo, el nivel + "✓ Confirmado" con su fuente y fecha', () => {
  const entorno = entornoDeFotos();
  try {
    const sin = crearEscudo({ nivelConfirmado: null });
    assert.equal(textoDe(sin), 'Por confirmar');
    assert.equal(sin.getAttribute('aria-label'), 'Nivel: Por confirmar');
    assert.equal(sin.getAttribute('data-testid'), 'escudo');

    const def = crearEscudo({ nivelConfirmado: DEFINITIVO });
    assert.equal(textoDe(buscar(def, 'escudo')), 'B1');
    const etiqueta = buscar(def, 'escudo-etiqueta');
    assert.match(textoDe(etiqueta), /^✓Confirmado$/, 'ícono + texto');
    assert.equal(textoDe(buscar(def, 'escudo-fuente')), 'Examen de nivel SET · Medido el 6 oct 2026', 'G4: siempre la fuente y la fecha');
    assert.equal(buscar(def, 'escudo-ayuda'), null, 'lo definitivo no trae la ayuda del provisional');
    assert.equal(buscar(def, 'escudo').getAttribute('aria-label'), 'Nivel B1, confirmado. Examen de nivel SET · Medido el 6 oct 2026.');
  } finally { entorno.restaurar(); }
});

test('U15: un provisional dice el nivel + "⏳ Provisional" + la ayuda del dictamen (G1), y el aria-label lo dice completo', () => {
  const entorno = entornoDeFotos();
  try {
    const prov = crearEscudo({ nivelConfirmado: PROVISIONAL });
    assert.equal(textoDe(buscar(prov, 'escudo')), 'B1');
    assert.match(textoDe(buscar(prov, 'escudo-etiqueta')), /^⏳Provisional$/, 'ícono + texto, no solo un color ni un borde');
    assert.equal(textoDe(buscar(prov, 'escudo-ayuda')), AYUDA_G1);
    assert.equal(buscar(prov, 'escudo').getAttribute('aria-label'), `Nivel B1, provisional. ${AYUDA_G1}`);
    assert.equal(textoDe(buscar(prov, 'escudo-fuente')), 'Examen de nivel SET · Medido el 6 oct 2026');
    assert.match(buscar(prov, 'escudo').className, /escudo-provisional/);
    assert.doesNotMatch(buscar(def2(), 'escudo').className, /escudo-provisional/, 'el definitivo no se parece al provisional');
  } finally { entorno.restaurar(); }
});
const def2 = () => crearEscudo({ nivelConfirmado: DEFINITIVO });

test('U15: el nivel no lleva oro nuevo (G6), ni Drako dentro (010), y "animar" solo agrega escudo-sube', () => {
  const entorno = entornoDeFotos();
  try {
    for (const nivel of [DEFINITIVO, PROVISIONAL]) {
      const nodo = crearEscudo({ nivelConfirmado: nivel });
      assert.ok(!elementos(nodo).some((n) => /oro|dorad/i.test(n.className || '')), 'G6: sin clases de oro');
      assert.ok(!elementos(nodo).some((n) => n.getAttribute('data-testid')?.startsWith('drako-')), 'Drako presenta, no califica');
    }
    assert.doesNotMatch(buscar(crearEscudo({ nivelConfirmado: DEFINITIVO }), 'escudo').className, /escudo-sube/);
    assert.match(buscar(crearEscudo({ nivelConfirmado: DEFINITIVO, animar: true }), 'escudo').className, /escudo-sube/);
  } finally { entorno.restaurar(); }
});

test('U15: fuente desconocida → solo la fecha; sin fecha → solo la fuente; un cefr fuera de A1-C2 → "Por confirmar"', () => {
  assert.equal(detalleDelNivel({ ...DEFINITIVO, fuente: 'otra' })?.linea, 'Medido el 6 oct 2026');
  assert.equal(detalleDelNivel({ ...DEFINITIVO, evaluadoEn: 'no es fecha' })?.linea, 'Examen de nivel SET');
  assert.equal(detalleDelNivel({ ...DEFINITIVO, cefr: 'Z9' }), null);
  assert.equal(textoDelEscudo({ nivelConfirmado: { cefr: 'Z9' } }), 'Por confirmar');
  assert.equal(detalleDelNivel(null), null);
});

test('U15: la fecha se dice en hora de Colombia, abreviada, y los niveles se ordenan A1 < ... < C2', () => {
  assert.equal(fechaCorta('2026-10-06T15:00:00Z'), '6 oct 2026');
  assert.equal(fechaCorta('2026-10-06T03:30:00Z'), '5 oct 2026', 'las 22:30 del 5 en Colombia');
  assert.equal(fechaCorta('2026-01-01T12:00:00Z'), '1 ene 2026');
  assert.equal(fechaCorta('basura'), null);
  assert.deepEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(valorDeNivel), [1, 2, 3, 4, 5, 6]);
  assert.equal(valorDeNivel('Z9'), 0);
});
