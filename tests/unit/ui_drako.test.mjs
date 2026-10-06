// @ts-check
// ui/drako.js: el Drako personaje (rig por partes) para el estudiante y el Drako estático (imagen) para el profe y el admin.
// Con prefers-reduced-motion el personaje queda quieto en su pose final (nada se anima, nada queda corriendo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { instalarDomFalso } from './dom_falso.mjs';
import { crearDrako, crearDrakoEstatico, ESTADOS_DRAKO } from '../../src/ui/drako.js';
import { controladorDe, GUIONES } from '../../src/ui/drako_animado.js';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

test('drako: crearDrako devuelve el personaje (svg por partes) con su estado, texto alternativo y testid', () => {
  const quitar = instalarDomFalso({ reducido: true });
  try {
    for (const estado of ['presenta', 'piensa', 'explica', 'celebra', 'ups', 'espera']) {
      const nodo = /** @type {any} */ (crearDrako(/** @type {any} */ (estado), `Drako ${estado}`));
      assert.equal(nodo.tagName, 'svg', estado);
      assert.equal(nodo.getAttribute('role'), 'img');
      assert.equal(nodo.getAttribute('aria-label'), `Drako ${estado}`);
      assert.equal(nodo.getAttribute('data-testid'), `drako-${estado}`);
      assert.match(nodo.getAttribute('class'), /\bdrako\b/);
      const c = controladorDe(nodo);
      assert.ok(c, 'tiene controlador');
      assert.equal(c.pose, GUIONES[estado].pose, 'nace en la pose de su estado');
      c.detener();
    }
  } finally { quitar(); }
});

test('drako: con prefers-reduced-motion no arranca ningún movimiento (ni reposo, ni ciclo, ni saludo, ni salto)', async () => {
  const quitar = instalarDomFalso({ reducido: true });
  const nodo = /** @type {any} */ (crearDrako('piensa', 'Drako piensa', { saludar: true }));
  const c = controladorDe(nodo);
  try {
    assert.deepEqual(c.idle, [], 'sin respirar ni parpadear');
    assert.equal(c.parpadeoTimer, null);
    await c.celebrarSalto();
    assert.equal(c.pose, 'celebra', 'el salto salta directo a la pose final');
    assert.equal(c.transicion, null);
    await c.ir('ups', 500);
    assert.equal(c.pose, 'ups', 'la transición es instantánea');
  } finally { c.detener(); quitar(); }
});

test('drako: el ícono, la opción estatico y el panel del profe usan la imagen de siempre', () => {
  const quitar = instalarDomFalso();
  try {
    const icono = /** @type {any} */ (crearDrako('icono-32', 'ícono'));
    assert.equal(icono.tagName, 'img');
    const fijo = /** @type {any} */ (crearDrako('presenta', 'Drako', { estatico: true }));
    assert.equal(fijo.tagName, 'img');
    assert.equal(fijo.getAttribute('src'), '/publico/diseno/drako/presenta.svg');
    assert.equal(/** @type {any} */ (crearDrakoEstatico('ups', 'x')).getAttribute('data-testid'), 'drako-ups');
    assert.throws(() => crearDrako(/** @type {any} */ ('enojado'), 'x'), /estado desconocido/);
  } finally { quitar(); }
});

test('drako: si el navegador no puede armar el rig, cae a la imagen y lo dice (nunca un catch mudo)', () => {
  const quitar = instalarDomFalso();
  const g = /** @type {any} */ (globalThis);
  const errores = [];
  const consola = console.error;
  console.error = (...a) => errores.push(a.join(' '));
  g.document.createElementNS = () => { throw new Error('sin SVG'); };
  try {
    const nodo = /** @type {any} */ (crearDrako('presenta', 'Drako'));
    assert.equal(nodo.tagName, 'img');
    assert.equal(errores.length, 1);
  } finally { console.error = consola; quitar(); }
});

test('drako: el panel del profe y del admin se quedan con el Drako estático (ninguna vista de profe/ ni admin/ trae el animado)', () => {
  for (const carpeta of ['src/vistas/profe', 'src/vistas/admin']) {
    for (const f of readdirSync(join(RAIZ, carpeta)).filter((n) => n.endsWith('.js'))) {
      const codigo = readFileSync(join(RAIZ, carpeta, f), 'utf8').replace(/\/\/.*$/gm, '');
      assert.doesNotMatch(codigo, /drako_animado|drako_rig|crearDrako\s*\(/, `${carpeta}/${f} usa el Drako animado`);
    }
  }
  assert.ok(ESTADOS_DRAKO.includes('icono-32'));
});
