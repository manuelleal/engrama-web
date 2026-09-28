// @ts-check
// U8 (ESPEC_mvp_uis.md §11, W7): con level=7 y 999 monedas pero sin nivel confirmado, el escudo
// dice "Por confirmar" — nunca deriva nada de XP/monedas (X7 en tests/tramposos/).
//
// `textoDelEscudo` es la lógica pura (sin `document`, que no existe bajo `node --test` — este
// proyecto no tiene jsdom, por regla del stack, §6.3). `crearEscudo` (con DOM) lo prueban los
// E2E, que sí corren en un navegador de verdad (tests/e2e/entrada.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { textoDelEscudo } from '../../src/ui/escudo.js';

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
