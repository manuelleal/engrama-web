// @ts-check
// W78 · E35 (docs/ESPEC_practica_del_dia.md §2): la explicación tras cada respuesta en el navegador de verdad, contra el mock (backend f7f7aeb).
// Un reto A2 (explicación en español) y uno B1 (en inglés), con fallo y acierto: nada de la clave antes de Comprobar; la banda con ícono, texto, la
// oración, la regla, "por qué no la tuya" solo al fallar y el ejemplo; el botón que sigue, dentro de la pantalla a 375 × 812; recargar a mitad retoma.
// Cruce: x_l1_no_retoma.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { sembrarRetosPractica } from '../../herramientas/humo/entradas_practica.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarTestid(sesion, testid, limiteMs = 9000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`)) return true; await esperar(80); }
  return false;
}
const clic = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]').click()`);
/** Elige, comprueba y devuelve lo que dice la banda (y dónde queda su botón). */
async function responder(sesion, label) {
  await clic(sesion, `opcion-${label}`);
  await esperar(120);
  await clic(sesion, 'boton-comprobar');
  assert.ok(await esperarTestid(sesion, 'explicacion'), 'la banda sale tras comprobar');
  await esperar(450);
  return sesion.evaluar(`(() => {
    const t = (id) => document.querySelector('[data-testid="' + id + '"]');
    const boton = t('boton-siguiente') || t('boton-terminar');
    const r = boton.getBoundingClientRect();
    return {
      banda: t('explicacion').textContent, veredicto: t('explicacion-veredicto')?.textContent ?? null,
      partes: ['oracion', 'regla', 'porQue', 'ejemplo'].map((p) => t('explicacion-' + p) ? [p, t('explicacion-' + p).getAttribute('lang'), t('explicacion-' + p).textContent] : null).filter(Boolean),
      boton: { id: boton.dataset.testid, arriba: Math.round(r.top), abajo: Math.round(r.bottom), alto: Math.round(r.height), alturaVentana: innerHeight },
    };
  })()`);
}

test('E35: un reto A2 pregunta por pregunta: nada antes de Comprobar, la banda en español con su explicación, recargar retoma, y la revisión al final', { skip: OMITIR, timeout: 120_000 }, async () => {
  await conAppCompleta(async (url, estado) => {
    const retos = sembrarRetosPractica(estado, [...estado.groups.values()][0].id);
    const g1 = retos.find((r) => r.title === 'Rutina diaria · Gramática 1');
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await sesion.navegar(`${url}#/retos/${g1.id}`);
      await sesion.recargar();
      assert.ok(await esperarTestid(sesion, 'enunciado'));
      assert.equal(await sesion.evaluar('document.querySelector(\'[data-testid="vista-reto-flujo"]\').dataset.modo'), 'por-pregunta');
      await clic(sesion, 'opcion-A');
      await esperar(150);
      // H-A (auditoría 06, U94): "Comprobar" es la acción del sistema (navy), nunca oro: se mide el color que pinta el navegador, no el CSS.
      const colores = await sesion.evaluar(`(() => {
        const pintado = (v) => { const n = document.createElement('i'); n.style.background = v; document.body.append(n); const c = getComputedStyle(n).backgroundColor; n.remove(); return c; };
        return { boton: getComputedStyle(document.querySelector('[data-testid="boton-comprobar"]')).backgroundColor, navy: pintado('var(--sx-accion)'), oro: pintado('var(--oro)') };
      })()`);
      assert.equal(colores.boton, colores.navy, '"Comprobar" en el navy del sistema');
      assert.notEqual(colores.boton, colores.oro, '"Comprobar" no va en oro');
      const antes = await sesion.evaluar('document.body.textContent');
      for (const clave of ['She goes to school every day.', 'Con he, she o it', 'Esta vez no']) assert.ok(!antes.includes(clave), `antes de comprobar se ve "${clave}"`);

      const mal = await responder(sesion, 'A');
      assert.equal(mal.veredicto, 'Esta vez no');
      assert.match(mal.banda, /✗/);
      // H-4 (docs/ESPEC_correcciones_practica.md): la oración y el ejemplo son frases en inglés (lang="en"); la regla y el "por qué", en español.
      // Antes esta línea fijaba las cuatro en "es", el defecto que encontró la auditoría 05 (se declara: la espec de H-4 no nombró a E35).
      assert.deepEqual(mal.partes.map(([p, lang]) => [p, lang]), [['oracion', 'en'], ['regla', 'es'], ['porQue', 'es'], ['ejemplo', 'en']]);
      assert.match(mal.partes[0][2], /Así queda: She goes to school every day\./);
      assert.match(mal.partes[2][2], /Por qué no la tuya: Go es para I, you, we y they\./);
      assert.ok(mal.boton.abajo <= mal.boton.alturaVentana && mal.boton.arriba >= 0 && mal.boton.alto >= 44, `el botón "Siguiente" se ve entero y mide 44 px o más: ${JSON.stringify(mal.boton)}`);

      await sesion.recargar(); // a mitad del reto: lo respondido está en el servidor
      assert.ok(await esperarTestid(sesion, 'enunciado'));
      assert.equal(await sesion.evaluar('document.querySelector(\'[data-testid="contador-pregunta"]\').textContent'), 'Pregunta 2 de 3', 'retoma en la primera sin responder');

      const bien = await responder(sesion, 'B');
      assert.equal(bien.veredicto, 'Correcta');
      assert.match(bien.banda, /✓/);
      assert.deepEqual(bien.partes.map(([p]) => p), ['oracion', 'regla', 'ejemplo'], 'al acertar, sin "por qué no la tuya"');
      await clic(sesion, 'boton-siguiente');
      await esperar(300);
      const ultima = await responder(sesion, 'A');
      assert.equal(ultima.boton.id, 'boton-terminar');
      await clic(sesion, 'boton-terminar');
      assert.ok(await esperarTestid(sesion, 'vista-revision'), 'la revisión de siempre');
      await esperar(600);
      assert.match(await sesion.evaluar('document.querySelector(\'[data-testid="revision-monedas"]\').textContent'), /No sumaste monedas/, 'falló una: no paga');
      assert.deepEqual(sesion.errores, []);
    } finally { await sesion.cerrar(); }
  });
});

test('E35: un reto B1: la explicación y sus rótulos en inglés (lang="en"), con "Why not yours" al fallar', { skip: OMITIR, timeout: 120_000 }, async () => {
  await conAppCompleta(async (url, estado) => {
    const retos = sembrarRetosPractica(estado, [...estado.groups.values()][0].id);
    const b1 = retos.find((r) => r.title === 'Trabajo · Gramática 1');
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await sesion.navegar(`${url}#/retos/${b1.id}`);
      await sesion.recargar();
      assert.ok(await esperarTestid(sesion, 'enunciado'));
      const mal = await responder(sesion, 'A');
      assert.equal(mal.veredicto, 'Esta vez no');
      assert.deepEqual(mal.partes.map(([p, lang]) => [p, lang]), [['oracion', 'en'], ['regla', 'en'], ['porQue', 'en'], ['ejemplo', 'en']]);
      assert.match(mal.partes[0][2], /The right sentence: I have worked here since 2020\./);
      assert.match(mal.partes[1][2], /The rule: Use the present perfect/);
      assert.match(mal.partes[2][2], /Why not yours: Work is the simple present/);
      assert.deepEqual(sesion.errores, []);
    } finally { await sesion.cerrar(); }
  });
});
