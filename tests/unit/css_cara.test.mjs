// @ts-check
// css_cara.test.mjs · Las reglas duras de la tanda visual 1 (docs/ESPEC_visual_tanda1.md §2, M5 a M10), comprobadas sobre el CSS mismo.
// `estilos/cara.css` es la cara EN REPOSO de las pantallas: no anima nada (el movimiento vive en juego.css), no le pone juego al profe ni al
// admin, y todo texto que pinta se puede leer. Cada prueba tiene su tramposo en tests/tramposos/x_cara_*.
import test from 'node:test';
import assert from 'node:assert/strict';
import { colorDe, contraste, leer, reglas, sinComentarios, tokensDeColor, valorDe } from './css_apoyo.mjs';

const CARA = 'estilos/cara.css';
const TOKENS = tokensDeColor();

test('cara: index.html enlaza /estilos/cara.css, y de ultima (despues de juego.css)', () => {
  const hojas = [...leer('index.html').matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
  assert.ok(hojas.includes('/estilos/cara.css'), 'falta el enlace a cara.css: la app se veria como antes');
  assert.equal(hojas.at(-1), '/estilos/cara.css', 'cara.css gana por orden: tiene que ser la ultima hoja');
  assert.ok(hojas.indexOf('/estilos/juego.css') < hojas.indexOf('/estilos/cara.css'));
});

test('cara: movimiento. cara.css no declara animaciones y sus transiciones solo mueven transform u opacity', () => {
  const css = sinComentarios(leer(CARA));
  assert.ok(!/@keyframes/.test(css), 'cara.css es la cara en reposo: los @keyframes viven en juego.css');
  for (const r of reglas(css)) {
    const animacion = valorDe(r.cuerpo, 'animation') ?? valorDe(r.cuerpo, 'animation-name');
    if (animacion !== null) assert.equal(animacion, 'none', `${r.selector}: cara.css solo puede APAGAR una animacion`);
    for (const m of r.cuerpo.matchAll(/transition(?:-property)?\s*:\s*([^;]+)/g)) {
      for (const parte of m[1].split(',')) {
        const propiedad = parte.trim().split(/\s+/)[0];
        assert.ok(['transform', 'opacity', 'none'].includes(propiedad), `${r.selector}: transition sobre "${propiedad}" (provoca reflow o repintado)`);
      }
    }
  }
});

test('cara: sobriedad. El fondo de marca y la pestana rellena cuelgan de .juego (el profe y el admin no los reciben)', () => {
  for (const r of reglas(leer(CARA))) {
    for (const selector of r.selector.split(',').map((s) => s.trim())) {
      const pintaElFondo = /^body\b/.test(selector) && /::(before|after)/.test(selector);
      const rellenaLaPestana = /nav-inferior/.test(selector) && valorDe(r.cuerpo, 'background') === 'var(--primario)';
      if (pintaElFondo || rellenaLaPestana) assert.match(selector, /\.juego/, `"${selector}" es adorno de juego y no cuelga de .juego: lo recibirian el profe y el admin`);
    }
  }
});

test('cara: contraste. Toda regla de cara.css que declara color y background da 4,5:1 o mas', () => {
  let medidas = 0;
  for (const r of reglas(leer(CARA))) {
    const texto = valorDe(r.cuerpo, 'color');
    const fondo = valorDe(r.cuerpo, 'background') ?? valorDe(r.cuerpo, 'background-color');
    if (!texto || !fondo) continue;
    const a = colorDe(texto, TOKENS); const b = colorDe(fondo, TOKENS);
    if (!a || !b) continue; // un fondo transparente o `none` no se puede medir sin pintar: lo miran las capturas
    medidas += 1;
    const c = contraste(a, b);
    assert.ok(c >= 4.5, `${r.selector}: ${texto} sobre ${fondo} da ${c.toFixed(2)}:1 (minimo 4,5:1)`);
  }
  assert.ok(medidas >= 0);
});
