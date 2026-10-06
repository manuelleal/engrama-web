// @ts-check
// Game feel, grupo 3: la constancia. La regla central (decisión 010): el cliente NUNCA calcula la
// racha, solo anima el valor que llega del servidor, y solo celebra cuando ese valor sube.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planDeRacha, textoDeRacha } from '../../src/ui/racha.js';
import { planDeConfeti, posicionDePieza } from '../../src/ui/confeti.js';
import { MINIMO_MS } from '../../src/ui/movimiento.js';

test('racha: solo se celebra cuando el valor del servidor sube, y no en la primera visita', () => {
  assert.equal(planDeRacha(3, 4, false).celebrar, true);
  assert.equal(planDeRacha(3, 3, false).celebrar, false);
  assert.equal(planDeRacha(5, 0, false).celebrar, false, 'reiniciarse no se festeja ni se castiga');
  assert.equal(planDeRacha(null, 7, false).celebrar, false, 'primera visita en este equipo: se muestra, no se festeja');
});

test('racha: el salto con reduced-motion no pasa del mínimo, y con movimiento pleno se luce', () => {
  assert.ok(planDeRacha(1, 2, true).animacionMs <= MINIMO_MS);
  assert.ok(planDeRacha(1, 2, false).animacionMs >= 800);
  assert.ok(planDeRacha(1, 2, true).visibleMs >= 2000, 'el aviso se puede leer aunque no se mueva');
});

test('racha: el texto muestra el número del servidor tal cual, sin sumarle nada', () => {
  assert.equal(textoDeRacha(4), '¡Constancia 4!');
  assert.equal(textoDeRacha(0), '¡Constancia 0!');
});

test('racha: el cliente no calcula la racha (ninguna aritmética sobre la constancia en las vistas ni en ui/racha)', () => {
  const fuentes = ['src/ui/racha.js', 'src/vistas/estudiante/inicio.js', 'src/vistas/estudiante/asistencia.js'];
  for (const f of fuentes) {
    const codigo = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(codigo, /(constancia|streak|racha|valor)\s*[+\-*]\s*\d/i, `${f} hace aritmética sobre la racha`);
    assert.doesNotMatch(codigo, /(constancia|streak|racha)\s*(\+\+|--|\+=|-=)/i, `${f} incrementa la racha`);
    assert.doesNotMatch(codigo, /\d\s*[+]\s*(constancia|streak|racha)/i, `${f} suma a la racha`);
  }
});

test('confeti: la fuerza es proporcional (suave < normal < fuerte) y con reduced-motion no cae ninguna pieza', () => {
  const p = (n) => planDeConfeti(n, false).piezas;
  assert.ok(p('suave') < p('normal') && p('normal') < p('fuerte'));
  for (const n of ['suave', 'normal', 'fuerte']) {
    const r = planDeConfeti(/** @type {any} */ (n), true);
    assert.equal(r.piezas, 0);
    assert.ok(r.duracionMs <= MINIMO_MS);
  }
});

test('confeti: la dispersión es repetible (sin azar) y cubre todo el ancho', () => {
  assert.equal(posicionDePieza(5), posicionDePieza(5));
  const xs = Array.from({ length: 40 }, (_, i) => posicionDePieza(i));
  assert.ok(Math.min(...xs) < 10 && Math.max(...xs) > 90);
  assert.ok(new Set(xs).size > 30, 'las piezas no se amontonan en las mismas columnas');
});
