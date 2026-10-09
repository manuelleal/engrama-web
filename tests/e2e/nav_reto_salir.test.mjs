// @ts-check
// W73 (docs/ESPEC_navegacion.md §5.9, U70 en el navegador de verdad): del reto en curso se sale con "✕ Salir", que lleva a Retos sin enviar el
// intento ni pedir nada del reto, y sin borrar las respuestas guardadas en el equipo. El reto sigue sin barra; al salir, la barra vuelve.
// De paso MIDE (sin exigirlo: la espec lo dejó como "no verificado", §16) si al volver a entrar al mismo reto se retoman las respuestas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OMITIR, conNavegacion, abrirComo, tocar, esperarVista, MEDIR_NAV } from './apoyo_nav_e2e.mjs';

const respuestasGuardadas = (sesion) => sesion.evaluar(`Object.keys(localStorage).filter((k) => k.startsWith('engrama_respuestas_')).map((k) => k + '=' + localStorage.getItem(k))`);

test('U70 (navegador): "✕ Salir" lleva del reto en curso a Retos sin enviar el intento, sin pedir nada del reto y sin borrar las respuestas guardadas', { skip: OMITIR, timeout: 180_000 }, async (t) => {
  await conNavegacion(async (url, estado) => {
    const sesion = await abrirComo(url, 'student');
    try {
      await tocar(sesion, '[data-testid="jugar-reto-hoy"]');
      assert.ok(await esperarVista(sesion, 'enunciado'), 'un toque desde Inicio: la primera pregunta');
      const enReto = await sesion.evaluar(MEDIR_NAV);
      assert.equal(enReto.barra, null, 'el reto en curso no lleva barra');
      const salir = await sesion.evaluar(`(() => { const a = document.querySelector('[data-testid="reto-salir"]'); if (!a) return null; const r = a.getBoundingClientRect(); const h1 = document.querySelector('h1').getBoundingClientRect(); return { texto: a.textContent, nombre: a.getAttribute('aria-label'), href: a.getAttribute('href'), alto: Math.round(r.height), arriba: Math.round(r.top), tituloArriba: Math.round(h1.top), derecha: Math.round(r.right), cuantos: document.querySelectorAll('[data-testid="reto-salir"]').length }; })()`);
      assert.ok(salir, 'la pregunta trae la salida');
      assert.deepEqual([salir.texto, salir.nombre, salir.href, salir.cuantos], ['✕ Salir', 'Salir del reto', '#/retos', 1]);
      assert.ok(salir.alto >= 44, `"Salir" mide ${salir.alto} px de alto (mínimo 44)`);
      assert.ok(salir.derecha <= 375 && enReto.scrollAncho <= enReto.ancho, 'cabe en 375 px, sin desplazamiento horizontal');

      await tocar(sesion, '[data-testid="opcion-A"]');
      const antes = await respuestasGuardadas(sesion);
      assert.equal(antes.length, 1, 'la respuesta elegida quedó guardada en el equipo');
      const marca = estado.registro.length;
      await tocar(sesion, '[data-testid="reto-salir"]');
      assert.equal(await sesion.evaluar('location.hash'), '#/retos', 'Salir lleva a Retos');
      const enRetos = await sesion.evaluar(MEDIR_NAV);
      assert.deepEqual(enRetos.activas, ['#/retos'], 'con la barra de vuelta y Retos activa');
      const pedidas = estado.registro.slice(marca).map((r) => `${r.metodo} ${r.ruta}`);
      assert.ok(!pedidas.some((p) => p.includes('/submit')), `salir NO envió el intento (pedidas: ${pedidas.join(', ')})`);
      assert.ok(pedidas.every((p) => p.startsWith('GET ')), `tras salir solo hay lecturas de la pantalla de Retos (pedidas: ${pedidas.join(', ')})`);
      assert.deepEqual(await respuestasGuardadas(sesion), antes, 'las respuestas guardadas siguen en el equipo');

      // Medida, sin criterio: ¿al volver a entrar al mismo reto se retoma con lo respondido?
      await sesion.evaluar('history.back()');
      await esperarVista(sesion, 'enunciado');
      const retomado = await sesion.evaluar(`({ elegida: document.querySelector('[data-testid="opciones"] button[aria-pressed="true"]')?.getAttribute('data-testid') ?? null, contador: document.querySelector('[data-testid="contador-pregunta"]')?.textContent ?? null, guardadas: Object.keys(localStorage).filter((k) => k.startsWith('engrama_respuestas_')).length })`);
      t.diagnostic(`al volver a entrar al reto abandonado (contra el mock): opción marcada = ${retomado.elegida}, "${retomado.contador}", intentos con respuestas guardadas en el equipo = ${retomado.guardadas}`);
    } finally { await sesion.cerrar(); }
  });
});
