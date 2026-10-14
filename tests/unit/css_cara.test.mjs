// @ts-check
// css_cara.test.mjs · Las reglas duras de la tanda visual 1 (docs/ESPEC_visual_tanda1.md §2, M5 a M10), comprobadas sobre el CSS mismo.
// `estilos/cara.css` es la cara EN REPOSO de las pantallas: no anima nada (el movimiento vive en juego.css), no le pone juego al profe ni al
// admin, y todo texto que pinta se puede leer. Cada prueba tiene su tramposo en tests/tramposos/x_cara_*.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { colorDe, contraste, leer, reglas, sinComentarios, tokensDeColor, valorDe } from './css_apoyo.mjs';

const CARA = 'estilos/cara.css';
const TOKENS = tokensDeColor();
// Las mezclas con nombre de cara.css (`--cara-*`, en su :root) valen lo que vale su cuenta sobre los tokens: se resuelven para poder medirlas.
for (const r of reglas(leer(CARA)).filter((x) => x.selector === ':root')) {
  for (const m of r.cuerpo.matchAll(/--(cara-[\w-]+)\s*:\s*([^;]+)/g)) {
    const color = colorDe(m[2], TOKENS);
    if (color) TOKENS[m[1]] = color;
  }
}
/** Lo que solo recibe el estudiante: lo que cuelga de `.juego` o de su barra (`a[href="#/inicio"]` es la entrada que solo tiene la suya). */
const SOLO_ESTUDIANTE = /\.juego\b|a\[href="#\/inicio"\]/;

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

// Tanda "sistema 1": la pestana rellena salio de cara.css (la barra es `sx-barra` y su registro lo pone ui/nav_inferior.js por rol: lo vigila
// ui_iconos.test.mjs con x_barra_del_profe_con_juego). Aca sigue el fondo de marca; si alguien vuelve a rellenar la pestana en esta hoja, tambien cae aqui.
test('cara: sobriedad. El fondo de marca (y cualquier pestana rellena) es solo del estudiante: el profe y el admin no lo reciben', () => {
  let vigiladas = 0;
  for (const r of reglas(leer(CARA))) {
    for (const selector of r.selector.split(',').map((s) => s.trim())) {
      const pintaElFondo = /^body\b/.test(selector);
      const rellenaLaPestana = /nav-inferior/.test(selector) && valorDe(r.cuerpo, 'background') === 'var(--primario)';
      if (!pintaElFondo && !rellenaLaPestana) continue;
      vigiladas += 1;
      assert.match(selector, SOLO_ESTUDIANTE, `"${selector}" es adorno de juego y no cuelga de .juego ni de la barra del estudiante: lo recibirian el profe y el admin`);
    }
  }
  assert.ok(vigiladas >= 2, `se esperaba el fondo de marca en cara.css (el lienzo y sus dos formas); hay ${vigiladas} selectores vigilados`);
});

const HOJAS = ['estilos/tipografia.css', 'estilos/base.css', 'estilos/componentes.css', 'estilos/formularios.css', 'estilos/juego.css', CARA];

// Medido con `npm run fluidez` (tanda "sistema 1"): UNA regla `#vista:has(.nav-inferior a[href="#/inicio"]) form button[type="submit"]`, activa en el
// celular, bajó la celebración de Inicio de 58,9 a 55,5 fps (18 a 20 fotogramas perdidos): con `:has()` en la RAÍZ de la app y un descendiente
// detrás, cada nodo que entra o sale (el saldo que cuenta, las fichas) obliga a recalcular el estilo de todo el árbol. En el celular, `:has()`
// sobre la raíz solo puede pintar a la raíz misma (o a su seudoelemento). Las de escritorio (`min-width`) no se miden aquí.
// Tramposo: x_cara_has_en_la_raiz (estilos/cara.css).
test('cara: rendimiento. Fuera de un @media de escritorio, ninguna regla usa :has() sobre la raiz de la app (la vista, body, html, main o .juego) seguida de un descendiente', () => {
  const RAIZ_CON_HAS = /^(#vista|body|html|main|\.juego)(?![\w-])[^\s>+~,]*:has\(/;
  let vigiladas = 0;
  for (const hoja of HOJAS) {
    const css = sinComentarios(leer(hoja));
    let i = 0; let enEscritorio = 0; let hondo = 0;
    while (i < css.length) {
      const abre = css.indexOf('{', i); const cierra = css.indexOf('}', i);
      if (cierra >= 0 && (abre < 0 || cierra < abre)) { hondo -= 1; if (hondo < enEscritorio) enEscritorio = 0; i = cierra + 1; continue; }
      if (abre < 0) break;
      const preludio = css.slice(i, abre).trim();
      hondo += 1; i = abre + 1;
      if (/^@media[^{]*min-width/.test(preludio)) { enEscritorio = hondo; continue; }
      if (preludio.startsWith('@') || enEscritorio) continue;
      for (const selector of preludio.split(/,(?![^(]*\))/).map((s) => s.trim())) {
        if (!RAIZ_CON_HAS.test(selector)) continue;
        vigiladas += 1;
        let p = selector.indexOf(':has(') + 5; let abiertos = 1;
        while (p < selector.length && abiertos > 0) { if (selector[p] === '(') abiertos += 1; if (selector[p] === ')') abiertos -= 1; p += 1; }
        assert.doesNotMatch(selector.slice(p), /[\s>+~]/, `${hoja} "${selector}": :has() en la raiz con un descendiente detras recalcula el estilo de toda la app en cada cambio del DOM`);
      }
    }
  }
  assert.ok(vigiladas >= 1, `se esperaba al menos una regla con :has() sobre la raiz que vigilar (la que reserva el espacio de la barra); hay ${vigiladas}`);
});

test('cara: tipografia. La pila empieza por las fuentes de marca y ninguna hoja pide un archivo que no sea de este origen y exista', () => {
  const raiz = reglas(leer('estilos/tipografia.css')).find((r) => r.selector === ':root');
  assert.ok(raiz, 'tipografia.css define las dos variables de fuente en :root');
  assert.match(valorDe(raiz.cuerpo, '--fuente-titulos') || '', /^"Baloo 2",/, 'los titulos empiezan por la fuente de marca de tokens.json');
  assert.match(valorDe(raiz.cuerpo, '--fuente-cuerpo') || '', /^"Nunito Sans",/, 'el cuerpo empieza por la fuente de marca de tokens.json');
  for (const hoja of HOJAS) {
    for (const m of sinComentarios(leer(hoja)).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      assert.match(m[1], /^\/publico\//, `${hoja}: url(${m[1]}) no es de este origen (la CSP es font-src 'self'; nada de CDN)`);
      assert.ok(existsSync(new URL(`../..${m[1]}`, import.meta.url)), `${hoja}: url(${m[1]}) no existe en el disco (un 404 en cada carga)`);
    }
  }
});

test('cara: el texto de apoyo no va en mayusculas y se lee: 4,5:1 o mas sobre la superficie y sobre el fondo', () => {
  const todas = HOJAS.flatMap((hoja) => reglas(leer(hoja)).map((r) => ({ ...r, hoja })));
  const deApoyo = todas.filter((r) => r.selector.split(',').some((s) => /\.texto-apoyo$/.test(s.trim())));
  assert.ok(deApoyo.length >= 1, 'la regla de .texto-apoyo sigue existiendo');
  for (const r of deApoyo) {
    assert.ok(!/text-transform\s*:\s*uppercase/.test(r.cuerpo), `${r.hoja} "${r.selector}": el texto de apoyo es una frase, no un rotulo en mayusculas`);
    const texto = valorDe(r.cuerpo, 'color');
    if (!texto || valorDe(r.cuerpo, 'background')) continue; // con fondo propio lo mide la prueba de contraste de las reglas
    const color = colorDe(texto, TOKENS);
    assert.ok(color, `${r.hoja} "${r.selector}": color ${texto} que no sale de tokens`);
    for (const fondo of ['superficie', 'fondo']) {
      const c = contraste(color, TOKENS[fondo]);
      assert.ok(c >= 4.5, `${r.hoja} "${r.selector}": ${texto} sobre --${fondo} da ${c.toFixed(2)}:1 (minimo 4,5:1)`);
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
  assert.ok(medidas >= 2, `se esperaban varias reglas con color y fondo que medir; hay ${medidas}`);
});
