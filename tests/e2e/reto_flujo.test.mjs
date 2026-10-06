// @ts-check
// E2, E6, U9 y U10 en el navegador de verdad (ESPEC_mvp_uis.md §11, W9): el flujo completo de
// un reto — sin clave visible antes de responder (E2), el resultado con ícono y texto real (E6),
// un enunciado con HTML no se vuelve HTML (U9), y Drako nunca dentro del bloque de resultado
// (U10, X11).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { crearChallenge } from '../../herramientas/mock/rutas_challenges.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));

const YA_ENTRO = "localStorage.setItem('engrama_actor_sintetico', 'est-1')";

function reqDocente() {
  return { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } };
}

// El segundo enunciado trae un intento de XSS: si textContent no se respeta en algún punto de
// la cadena, esto se volvería un <img> de verdad (U9, y V4/X8 lo prohíben en el código fuente).
const ENUNCIADO_MALICIOSO = '<img src=x onerror="window.__pwned = true">¿Cuál es correcta?';

function sembrarReto(estado, groupId) {
  const { cuerpo } = crearChallenge(estado, reqDocente(), {
    title: 'Reto de prueba', description: 'd', group_id: groupId, coins_reward: 5, xp_reward: 3,
    questions: [
      { question_text: '2+2?', correct_answer: 'A', options_json: [{ label: 'A', value: '4' }, { label: 'B', value: '5' }] },
      { question_text: ENUNCIADO_MALICIOSO, correct_answer: 'B', options_json: [{ label: 'A', value: 'no' }, { label: 'B', value: 'sí' }] },
    ],
  });
  return cuerpo;
}

function scriptJugar(idPregunta1) {
  return `(async () => {
    const clic = (testid) => document.querySelector('[data-testid="' + testid + '"]').click();
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

    const antesDeResponder = document.body.textContent;

    clic('opcion-A');
    await esperar(80);
    clic('boton-siguiente');
    await esperar(80);
    clic('opcion-B');
    await esperar(80);
    clic('boton-terminar');
    await esperar(700);

    const idQ1 = ${JSON.stringify(idPregunta1)};
    return {
      antesDeResponder,
      imgSospechoso: document.querySelectorAll('img[src="x"]').length,
      fuePwned: window.__pwned === true,
      testids: [...document.querySelectorAll('[data-testid]')].map((e) => e.dataset.testid),
      monedas: document.querySelector('[data-testid="revision-monedas"]')?.textContent ?? null,
      q1Resultado: document.querySelector('[data-testid="revision-' + idQ1 + '-resultado"]')?.textContent ?? null,
      // Toda la fila (el <li data-testid="revision-<id>">), no solo el <p> del ícono+texto:
      // Drako no debe vivir en ningún punto del bloque de resultado de ESTA pregunta.
      q1TieneDrako: !!document.querySelector('[data-testid="revision-' + idQ1 + '"] img, [data-testid="revision-' + idQ1 + '"] [data-testid^="drako-"]'),
      q1Correcta: document.querySelector('[data-testid="revision-' + idQ1 + '-correcta"]')?.textContent ?? null,
    };
  })()`;
}

test(
  'reto_flujo: jugar de punta a punta — sin clave antes, ícono+texto real, sin XSS, Drako fuera del resultado',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url, estado) => {
      const grupoId = [...estado.groups.values()][0].id;
      const reto = sembrarReto(estado, grupoId);
      const r = await revisarPagina({
        url: `${url}#/retos/${reto.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO,
        eval: scriptJugar(reto.questions[0].id),
      });
      assert.deepEqual(r.errores, []);

      // E2: nada de clave visible antes de responder (question_id no revela correct_answer;
      // el texto crudo de la página tampoco trae "correct_answer" ni las labels con su value real).
      assert.ok(!r.eval.antesDeResponder.includes('correct_answer'));

      // U9: el enunciado con HTML nunca se volvió HTML real.
      assert.equal(r.eval.imgSospechoso, 0, 'el <img src=x> del enunciado no debe existir como elemento real');
      assert.equal(r.eval.fuePwned, false, 'el onerror del enunciado malicioso nunca debió ejecutar');

      // E6: el resultado tiene ícono Y texto en el DOM real (no solo una clase de color).
      assert.match(r.eval.q1Resultado, /✓/);
      assert.match(r.eval.q1Resultado, /Correcta/);

      // U10 / X11: Drako nunca vive dentro del bloque de resultado de una pregunta.
      assert.equal(r.eval.q1TieneDrako, false);

      // El resto de la revisión: la correcta se revela DESPUÉS de responder, y las monedas
      // son las que mandó el servidor (2/2 correctas → paga completo, 5 monedas).
      assert.match(r.eval.q1Correcta, /4/);
      assert.match(r.eval.monedas, /\+5 monedas/);
      assert.ok(r.eval.testids.includes('vista-revision'));
    });
  },
);

test(
  'reto_flujo: un repaso avisa antes de empezar y nunca muestra monedas ganadas (matiz de F4)',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url, estado) => {
      const grupoId = [...estado.groups.values()][0].id;
      const reto = sembrarReto(estado, grupoId);
      // Primera vez: gana de verdad (misma secuencia que el test de arriba).
      await revisarPagina({ url: `${url}#/retos/${reto.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO, eval: scriptJugar(reto.questions[0].id) });
      // Segunda vez, con "?repaso=1" (como pone retos.js en su enlace "Repasar"): banner antes
      // de empezar, y la revisión no debe mostrar "+N monedas" aunque las respuestas sean correctas.
      const r2 = await revisarPagina({
        url: `${url}#/retos/${reto.id}?repaso=1`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO,
        eval: `(async () => {
          const antes = document.querySelector('[data-testid="banner-repaso"]')?.textContent ?? null;
          const clic = (t) => document.querySelector('[data-testid="' + t + '"]').click();
          const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
          clic('opcion-A'); await esperar(80); clic('boton-siguiente'); await esperar(80);
          clic('opcion-B'); await esperar(80); clic('boton-terminar'); await esperar(700);
          return { antes, monedas: document.querySelector('[data-testid="revision-monedas"]')?.textContent ?? null };
        })()`,
      });
      assert.match(r2.eval.antes, /Repaso/);
      assert.doesNotMatch(r2.eval.monedas, /\+\d+ monedas/, 'un repaso nunca debe mostrar "+N monedas"');
      assert.match(r2.eval.monedas, /No sumaste monedas/);
    });
  },
);
