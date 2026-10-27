// @ts-check
// docs/ESPEC_visual_sistema1.md §1 (compuerta visual, hallazgo 2): los íconos de la barra de abajo, del sonido y de "Mis monedas" son SVG de la
// casa armados por código (ui/iconos.js), no emoji del sistema (cambian de dibujo en cada teléfono y quedaban agrisados con un filtro).
// La barra es la del sistema (`sx-barra`) y su registro sale del rol: juego (el valor por defecto, sin clase) solo para el estudiante; el profe y
// el admin, `sx-sereno`.
// Tramposo: x_barra_del_profe_con_juego (ui/nav_inferior.js). El resto es visual (método aligerado: capturas, sin tramposo por estilo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { instalarDomFalso } from './dom_falso.mjs';
import { ICONOS, crearIcono } from '../../src/ui/iconos.js';
import { entradasNav, crearNavInferior, registroDeLaBarra } from '../../src/ui/nav_inferior.js';
import { contenidoDelBoton } from '../../src/ui/boton_sonido.js';
import { filasDeMovimientos } from '../../src/ui/movimientos.js';

const EMOJI = /\p{Emoji_Presentation}/u;
const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');
/** @param {any} nodo @returns {any[]} */
const todos = (nodo) => (nodo.nodeType === 3 ? [] : [nodo, ...nodo.children.flatMap(todos)]);
const clases = (nodo) => String(nodo.className || nodo.getAttribute('class') || '').split(/\s+/);

test('íconos: cada uno es un SVG de trazo armado con createElementNS: caja de 24, color heredado, sin relleno, decorativo y solo con trazos, círculos y rectángulos', () => {
  const quitar = instalarDomFalso();
  try {
    assert.ok(ICONOS.length >= 9, 'la barra de los tres roles, el sonido (dos estados) y las cuatro filas de Mis monedas');
    for (const nombre of ICONOS) {
      const svg = /** @type {any} */ (crearIcono(nombre));
      assert.equal(svg.tagName, 'svg', nombre);
      assert.deepEqual(
        ['class', 'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'aria-hidden', 'data-icono'].map((k) => svg.getAttribute(k)),
        ['sx-icono', '0 0 24 24', '24', '24', 'none', 'currentColor', '2.2', 'round', 'round', 'true', nombre], `${nombre}: el mismo trazo en todos`,
      );
      assert.ok(svg.children.length >= 1 && svg.children.length <= 4, `${nombre}: de 1 a 4 formas`);
      for (const forma of svg.children) {
        assert.ok(['path', 'circle', 'rect'].includes(forma.tagName), `${nombre}: ${forma.tagName}`);
        for (const attr of ['fill', 'stroke', 'style']) assert.equal(forma.getAttribute(attr), null, `${nombre}: ninguna forma trae su propio color`);
      }
      assert.equal(svg.textContent, '', `${nombre}: sin texto`);
    }
    assert.equal(crearIcono('no-existe'), null, 'un nombre que no existe no dibuja nada (y no revienta)');
  } finally { quitar(); }
});

test('íconos: sin SVG en el entorno no revientan (devuelven null): ninguna pantalla depende de su ícono', () => {
  const quitar = instalarDomFalso();
  const g = /** @type {any} */ (globalThis);
  try {
    g.document.createElementNS = undefined;
    for (const nombre of ICONOS) assert.equal(crearIcono(nombre), null);
  } finally { quitar(); }
});

test('íconos: la barra de los tres roles, el botón del sonido y las filas de Mis monedas nombran un ícono que existe; ninguno es un emoji', () => {
  const usados = [
    ...['student', 'teacher', 'admin'].flatMap((rol) => (entradasNav(rol, '/perfil') || []).map((e) => e.icono)),
    contenidoDelBoton(true).icono, contenidoDelBoton(false).icono,
    ...filasDeMovimientos({ wallet: { id: 'w' }, entries: ['attendance', 'challenge', 'live', 'cosa_nueva'].map((action) => ({ action, amount: 5, to_wallet_id: 'w', created_at: '2026-10-20T15:00:00Z' })) }).map((f) => f.icono),
  ];
  assert.equal(usados.length, 4 + 3 + 3 + 2 + 4); // panel del super admin: la barra del admin gana Tablero (declarado)
  for (const nombre of usados) assert.ok(ICONOS.includes(nombre), `"${nombre}" no es un ícono de ui/iconos.js`);
  assert.notEqual(contenidoDelBoton(true).icono, contenidoDelBoton(false).icono, 'con sonido y en silencio se dibujan distinto (no solo cambia el color)');
  for (const ruta of ['src/ui/nav_inferior.js', 'src/ui/boton_sonido.js', 'src/ui/movimientos.js', 'src/ui/iconos.js', 'src/vistas/estudiante/monedas.js']) {
    assert.doesNotMatch(leer(ruta), EMOJI, `${ruta}: trae un emoji del sistema`);
  }
  assert.doesNotMatch(leer('estilos/cara.css').replace(/\/\*[\s\S]*?\*\//g, ''), /grayscale/, 'los inactivos se apagan con color y peso, no con un filtro');
});

test('íconos: la barra es la del sistema (sx-barra): cada pestaña con su SVG decorativo y su palabra; sereno para el profe y el admin, juego SOLO para el estudiante', () => {
  const quitar = instalarDomFalso();
  try {
    for (const [rol, patron, registro] of [['student', '/inicio', ''], ['teacher', '/profe/grupos', 'sx-sereno'], ['admin', '/admin', 'sx-sereno']]) {
      const barra = /** @type {any} */ (crearNavInferior(patron, rol));
      assert.deepEqual(clases(barra), ['nav-inferior', 'sx-barra', registro].filter(Boolean), `${rol}: su registro`);
      assert.equal(registroDeLaBarra(rol), registro);
      const pestanas = barra.children.filter((n) => n.tagName === 'a');
      assert.ok(pestanas.length >= 2);
      for (const a of pestanas) {
        assert.deepEqual(clases(a), ['sx-barra__pestana']);
        const [icono, palabra] = a.children;
        assert.equal(icono.getAttribute('aria-hidden'), 'true', 'el ícono no se lee');
        assert.deepEqual(icono.children.map((n) => n.tagName), ['svg'], 'el ícono es un SVG, sin texto');
        assert.equal(icono.textContent, '');
        assert.ok(palabra.nodeType === 3 && palabra.data.length > 0, 'la palabra va al lado, como texto');
      }
      assert.equal(todos(barra).filter((n) => n.getAttribute('aria-current') === 'page').length, 1, `${rol}: una sola activa`);
    }
    assert.equal(registroDeLaBarra(undefined), 'sx-sereno', 'ante la duda, sobria');
    assert.equal(registroDeLaBarra('super_admin'), 'sx-sereno');
  } finally { quitar(); }
});
