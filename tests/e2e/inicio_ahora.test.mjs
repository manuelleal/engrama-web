// @ts-check
// W65 · E31, la parte de Inicio (docs/ESPEC_navegacion.md §5.4, §9.3): en el navegador de verdad, a 375×812 y con las tres tarjetas de "Ahora"
// (reto de hoy, clase en vivo y examen de nivel), los tres botones terminan POR ENCIMA de la barra de abajo SIN desplazar; cada uno mide 44 px
// de alto o más; no hay desplazamiento horizontal; y solo una tarjeta late. Antes (H4) el botón del examen quedaba bajo la barra.
// A 360×640 (réplica, §10.2) se mide lo mismo y se informa: ahí el criterio es que NINGUNO quede tapado tras desplazar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { crearEstado } from '../../herramientas/mock/estado.mjs';
import { CONFIG_PILOTO, CLAVE_DEMO } from '../../herramientas/mock/login_piloto.mjs';
import { sembrarNavegacion } from '../../herramientas/humo_navegacion.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const CONFIG = { ...CONFIG_PILOTO, EVA_URL: 'https://eva.ejemplo.edu.co', SET_URL: 'https://set.ejemplo.edu.co' };

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperarVista(sesion, testid, limiteMs = 9000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`)) return true; await esperar(100); }
  return false;
}
const entrarCon = (sesion, correo) => sesion.evaluar(`(() => {
  document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(correo)};
  document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(CLAVE_DEMO)};
  document.querySelector('[data-testid="boton-entrar"]').click();
})()`);

/** Dónde quedan los tres botones de "Ahora" y la barra, sin desplazar; y cuántos quedan tapados tras desplazar al final. */
const MEDIR = `(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  window.scrollTo(0, 0); await esperar(100);
  const barra = document.querySelector('nav.nav-inferior').getBoundingClientRect();
  const botones = [...document.querySelectorAll('[data-testid="ahora"] a')].map((a) => { const r = a.getBoundingClientRect(); return { texto: a.textContent, arriba: Math.round(r.top), abajo: Math.round(r.bottom), alto: Math.round(r.height), derecha: Math.round(r.right) }; });
  const invitan = document.querySelectorAll('.fila-invitacion').length;
  window.scrollTo(0, document.documentElement.scrollHeight); await esperar(150);
  const tope = document.querySelector('nav.nav-inferior').getBoundingClientRect().top;
  const tapados = [...document.querySelectorAll('[data-testid="ahora"] a')].filter((a) => { const r = a.getBoundingClientRect(); return r.bottom > tope + 1 && r.top < innerHeight; }).length;
  window.scrollTo(0, 0);
  return { barraArriba: Math.round(barra.top), botones, invitan, tapados, ancho: innerWidth, scrollAncho: document.documentElement.scrollWidth };
})()`;

test('E31 (Inicio): a 375×812, con reto, clase y examen, los tres botones de "Ahora" quedan sobre la barra de abajo sin desplazar, miden 44 px o más y solo una tarjeta late', { skip: OMITIR }, async (t) => {
  const estado = crearEstado();
  sembrarNavegacion(estado);
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      assert.ok(await esperarVista(sesion, 'campo-correo'));
      await entrarCon(sesion, 'estudiante@nav.test');
      assert.ok(await esperarVista(sesion, 'ahora'), 'Inicio con su sección "Ahora"');
      await esperar(900); // el conteo del saldo y el saludo de Drako terminan de asentarse
      const m = await sesion.evaluar(MEDIR);
      assert.deepEqual(m.botones.map((b) => b.texto), ['Jugar', 'Ir a la clase', 'Ir al examen']);
      for (const b of m.botones) {
        assert.ok(b.abajo <= m.barraArriba, `"${b.texto}" termina en y=${b.abajo} y la barra empieza en y=${m.barraArriba}: quedó tapado`);
        assert.ok(b.alto >= 44, `"${b.texto}" mide ${b.alto} px de alto (mínimo 44)`);
        assert.ok(b.derecha <= m.ancho, `"${b.texto}" se sale por la derecha`);
      }
      assert.ok(m.scrollAncho <= m.ancho, `desplazamiento horizontal: ${m.scrollAncho} > ${m.ancho}`);
      assert.equal(m.invitan, 1, 'una sola tarjeta late');
      assert.equal(m.tapados, 0);
      t.diagnostic(`375×812: la barra empieza en y=${m.barraArriba}; los botones terminan en y=${m.botones.map((b) => b.abajo).join(', ')}`);

      // Réplica (360×640): se mide y se informa; el criterio ahí es que nada quede tapado tras desplazar y que no haya desplazamiento horizontal.
      await sesion.redimensionar(360, 640);
      await esperar(300);
      const chico = await sesion.evaluar(MEDIR);
      assert.equal(chico.tapados, 0, 'a 360×640, desplazando al final, ningún botón de "Ahora" queda bajo la barra');
      assert.ok(chico.scrollAncho <= chico.ancho, `a 360 px hay desplazamiento horizontal: ${chico.scrollAncho}`);
      t.diagnostic(`360×640: la barra empieza en y=${chico.barraArriba}; los botones terminan en y=${chico.botones.map((b) => b.abajo).join(', ')} (${chico.botones.filter((b) => b.abajo > chico.barraArriba).length} bajo la barra sin desplazar)`);
    } finally { await sesion.cerrar(); }
  }, { estado, authConfig: CONFIG });
});
