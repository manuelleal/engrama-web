// @ts-check
// W79 y W80 · E36 (docs/ESPEC_practica_del_dia.md §2): un día de práctica en el navegador de verdad, contra el mock (backend f7f7aeb). A 375 × 812:
// los tres botones de "Ahora" sobre la barra sin desplazar y la protagonista primera; 0 POST de la tanda al pintar; "Jugar" la pide y va al repaso
// (primero); el repaso, el primer reto pregunta por pregunta y, de vuelta en Inicio, "Paso 2 de 2"; terminada, "Practicar más" arma la segunda;
// terminada la segunda, "Listo por hoy.". Cruce: x_tanda_se_pide_al_pintar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarRetosPractica } from '../../herramientas/humo/entradas_practica.mjs';
import { ponerEnRepaso } from '../../herramientas/mock/practica.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const CONFIG = { ENGRAMA_AUTH: 'mock', EVA_URL: 'https://eva.ejemplo.edu.co', SET_URL: 'https://set.ejemplo.edu.co' };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarTestid(sesion, testid, limiteMs = 9000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`)) return true; await esperar(80); }
  return false;
}
async function tocar(sesion, testid) {
  assert.ok(await esperarTestid(sesion, testid), `falta ${testid}`);
  await sesion.evaluar(`document.querySelector('[data-testid="${testid}"]').click()`);
  await esperar(250);
}
const texto = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]')?.textContent ?? null`);
/** Un reto entero pregunta por pregunta, hasta la revisión. */
async function jugarReto(sesion, labels) {
  for (const [i, label] of labels.entries()) {
    await tocar(sesion, `opcion-${label}`);
    await tocar(sesion, 'boton-comprobar');
    await tocar(sesion, i === labels.length - 1 ? 'boton-terminar' : 'boton-siguiente');
  }
  assert.ok(await esperarTestid(sesion, 'vista-revision'), 'la revisión');
}
async function aInicio(sesion, url) {
  await sesion.navegar(`${url}#/retos`);
  await sesion.navegar(`${url}#/inicio`);
  assert.ok(await esperarTestid(sesion, 'practica-titulo'), 'Inicio con la práctica');
  await esperar(600);
}
const MEDIR_AHORA = `(() => {
  window.scrollTo(0, 0);
  const barra = document.querySelector('nav.nav-inferior').getBoundingClientRect().top;
  const botones = [...document.querySelectorAll('[data-testid="ahora"] a')].map((a) => ({ texto: a.textContent, abajo: Math.round(a.getBoundingClientRect().bottom), alto: Math.round(a.getBoundingClientRect().height) }));
  return { barra: Math.round(barra), botones, invitan: document.querySelectorAll('.fila-invitacion').length };
})()`;

test('E36: un día de práctica: Inicio sin pedir nada, "Jugar" pide la tanda y va al repaso, después los retos de la tanda, otra tanda y "Listo por hoy."', { skip: OMITIR, timeout: 240_000 }, async (t) => {
  const estado = estadoConEstudiantesSembrados();
  const retos = sembrarRetosPractica(estado, [...estado.groups.values()][0].id);
  const id = (titulo) => retos.find((r) => r.title === titulo).id;
  const g1 = retos.find((r) => r.title === 'Rutina diaria · Gramática 1');
  // Ayer falló la primera de Gramática 1: hoy le toca repasarla (la cola de repaso, sembrada como lo haría el cierre de ayer).
  ponerEnRepaso(estado, { tenantId: estado.tenantDemoId, profileId: estado.tokens.get('est-1'), challengeId: g1.id, questionId: g1.questions[0].id, toca: 0 });
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await sesion.navegar(`${url}#/inicio`);
      await sesion.recargar();
      assert.ok(await esperarTestid(sesion, 'practica-titulo'));
      await esperar(900);
      const m = await sesion.evaluar(MEDIR_AHORA);
      // Con la entrada de prueba (`mock`) la institución no es un UUID y SET no se ofrece: aquí van "Jugar" y la clase (E31 mide las tres con login).
      assert.deepEqual(m.botones.map((b) => b.texto), ['Jugar', 'Ir a la clase'], 'la protagonista primero');
      for (const b of m.botones) assert.ok(b.abajo <= m.barra && b.alto >= 44, `"${b.texto}" termina en y=${b.abajo} (barra en y=${m.barra}) y mide ${b.alto}`);
      assert.equal(m.invitan, 1, 'una sola invitación');
      t.diagnostic(`375×812: la barra empieza en y=${m.barra}; los botones de "Ahora" terminan en y=${m.botones.map((b) => b.abajo).join(', ')}`);
      const posts = () => estado.registro.filter((r) => r.metodo === 'POST' && r.ruta === '/challenges/tanda').length;
      assert.equal(posts(), 0, 'pintar Inicio no pide la tanda');

      await tocar(sesion, 'jugar-reto-hoy');
      assert.ok(await esperarTestid(sesion, 'vista-repaso'), 'el repaso va primero');
      assert.equal(posts(), 1);
      await tocar(sesion, 'opcion-B');
      await tocar(sesion, 'boton-comprobar');
      assert.equal(await texto(sesion, 'explicacion-veredicto'), 'Correcta');
      await tocar(sesion, 'boton-siguiente');
      assert.ok(await esperarTestid(sesion, 'repaso-al-dia'), 'repaso al día');
      await tocar(sesion, 'repaso-seguir');
      assert.ok(await esperarTestid(sesion, 'practica-titulo'));
      await esperar(500);
      assert.equal(await texto(sesion, 'practica-apoyo'), 'Paso 1 de 2 · Hasta 10 monedas');

      await tocar(sesion, 'jugar-reto-hoy');
      await jugarReto(sesion, ['B', 'B', 'A']);
      await aInicio(sesion, url);
      assert.equal(await texto(sesion, 'practica-apoyo'), 'Paso 2 de 2 · Hasta 10 monedas');
      await tocar(sesion, 'jugar-reto-hoy');
      await jugarReto(sesion, ['A', 'B', 'B']);
      await aInicio(sesion, url);
      assert.equal(await texto(sesion, 'practica-titulo'), 'Terminaste tu práctica');
      assert.equal(await texto(sesion, 'jugar-reto-hoy'), 'Practicar más');

      await tocar(sesion, 'jugar-reto-hoy');
      assert.ok(await esperarTestid(sesion, 'enunciado'), 'la segunda tanda va a su reto');
      assert.equal(await sesion.evaluar('location.hash'), `#/retos/${id('Rutina diaria · Vocabulario 1')}`);
      await jugarReto(sesion, ['A', 'A']);
      await aInicio(sesion, url);
      assert.equal(await texto(sesion, 'practica-titulo'), 'Listo por hoy.');
      assert.equal(await texto(sesion, 'practica-apoyo'), 'Lo que se estudia en días distintos se recuerda más. Mañana hay más.');
      assert.equal(posts(), 2, 'dos tandas pedidas: el tope del día');
      assert.deepEqual(sesion.errores, []);
    } finally { await sesion.cerrar(); }
  }, { estado, authConfig: CONFIG });
});
