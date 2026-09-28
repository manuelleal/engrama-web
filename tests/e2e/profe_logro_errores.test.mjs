// @ts-check
// W11 (ESPEC_mvp_uis.md §11, T5/T7): Logro por eje y Errores por ítem, en el navegador de
// verdad. Criterio del commit: nunca se muestra el estado de un eje sin su `cefr_levels` al
// lado (P1), y en ningún punto del DOM aparece "débil" ni "weak" (P1/P4,
// ESPEC_grupos_y_panel_docente.md §5) — el saldo no es desempeño y la etiqueta la arma el
// servidor, nunca el cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { crearChallenge } from '../../herramientas/mock/rutas_challenges.mjs';
import { arrancarIntento, enviarIntento } from '../../herramientas/mock/rutas_intentos.mjs';
import { importarCsv } from '../../herramientas/mock/rutas_admin.mjs';
import { ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));

const YA_ENTRO_DOCENTE = "localStorage.setItem('engrama_actor_sintetico', 'docente-demo')";

function reqAdmin() { return { headers: { authorization: `Bearer ${ADMIN_BOOTSTRAP_TOKEN}` } }; }
function reqDocente() { return { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }; }
function reqEstudiante(token) { return { headers: { authorization: `Bearer ${token}` } }; }

// Un solo reto de vocabulario (Accuracy), con pocos respondientes a propósito: por debajo del
// mínimo de T5 (3 retos) queda "datos_insuficientes" — el caso más exigente para P1, porque
// `cefr_levels` puede quedar vacío y AUN ASÍ debe mostrarse junto al estado — y por debajo del
// mínimo de T7 (5 respondientes) el ítem queda suprimido, así que la vista de errores lo avisa.
function sembrarYResponder(estado, grupoId) {
  const { cuerpo: reto } = crearChallenge(estado, reqDocente(), {
    title: 'Vocabulario de la unidad', description: 'd', group_id: grupoId, skill: 'vocabulary', cefr_level: 'B1',
    coins_reward: 5, xp_reward: 3,
    questions: [
      { question_text: '¿Cómo se dice "casa"?', correct_answer: 'A', options_json: [{ label: 'A', value: 'house' }, { label: 'B', value: 'car' }] },
      { question_text: '¿Cómo se dice "perro"?', correct_answer: 'B', options_json: [{ label: 'A', value: 'cat' }, { label: 'B', value: 'dog' }] },
    ],
  });
  const responder = (token, respuestas) => {
    const { cuerpo: inicio } = arrancarIntento(estado, reqEstudiante(token), reto.id);
    const answers = reto.questions.map((q, i) => ({ question_id: q.id, answer: respuestas[i] }));
    enviarIntento(estado, reqEstudiante(token), inicio.attempt_id, { answers });
  };
  responder('est-1', ['A', 'B']); // 2/2, perfecto
  responder('est-2', ['A', 'A']); // 1/2
  return reto;
}

test(
  'T5: el logro por eje siempre trae cefr_levels junto al estado, y nunca "débil"/"weak"',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url, estado) => {
      const grupoId = [...estado.groups.values()][0].id;
      sembrarYResponder(estado, grupoId);
      const r = await revisarPagina({
        url: `${url}#/profe/grupo/${grupoId}/logro`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_DOCENTE,
        eval: `(async () => {
          await new Promise((r) => setTimeout(r, 300));
          return {
            cuerpo: document.body.textContent,
            filas: document.querySelectorAll('[data-testid^="logro-fila-"]').length,
          };
        })()`,
      });
      assert.deepEqual(r.errores, []);
      assert.ok(r.scroll_ancho <= 375, `E9: scrollWidth ${r.scroll_ancho} debe ser <= 375 (la tabla no debe desbordar)`);
      assert.equal(r.eval.filas, 2, 'las dos estudiantes deben aparecer, en el orden del servidor (sin ranking)');
      assert.doesNotMatch(r.eval.cuerpo, /débil|weak/i, 'la interfaz nunca dice "débil" ni "weak" (P1/P4)');
      // "datos_insuficientes" con pocos retos: AUN así debe verse junto a la info de nivel MCER.
      assert.match(r.eval.cuerpo, /datos insuficientes/);
      assert.match(r.eval.cuerpo, /B1: 1|sin retos con nivel/, 'el cefr_levels (o su ausencia explícita) va siempre junto al estado');
    });
  },
);

test(
  'T7: "errores con respuesta" descuenta lo dejado en blanco, y avisa lo suprimido por privacidad',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url, estado) => {
      const grupoId = [...estado.groups.values()][0].id;
      sembrarYResponder(estado, grupoId);
      const r = await revisarPagina({
        url: `${url}#/profe/grupo/${grupoId}/errores`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_DOCENTE,
        eval: `(async () => {
          await new Promise((r) => setTimeout(r, 300));
          return {
            filas: document.querySelectorAll('[data-testid^="error-"]').length,
            suprimidos: document.querySelector('[data-testid="errores-suprimidos"]')?.textContent ?? null,
          };
        })()`,
      });
      assert.deepEqual(r.errores, []);
      // Solo 2 respondientes (< mínimo de 5): los dos ítems quedan suprimidos por privacidad.
      assert.equal(r.eval.filas, 0);
      assert.match(r.eval.suprimidos, /2 ítem/);
    });
  },
);

// Con solo 2 respondientes (arriba), los ítems quedan suprimidos y la tabla casi no tiene texto
// largo — no alcanza a mostrar el desborde que sí se vio en la galería de capturas (W16, encargo
// 2: "profe-errores" desbordaba a 375 px con datos reales). Este test agrega 3 respondientes más
// (5 en total, por encima del mínimo) para que las filas SÍ se vean, con su `question_text` y su
// `title` largos — el caso que de verdad ejercita el ancho de la tabla.
test(
  'E: la tabla de errores no desborda a 375 px con datos reales (5 respondientes, sin supresión)',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url, estado) => {
      const grupoId = [...estado.groups.values()][0].id;
      importarCsv(estado, reqAdmin(), grupoId, 'documento_id,nombre_completo\nest-3,Est Tres\nest-4,Est Cuatro\nest-5,Est Cinco\n');
      const reto = sembrarYResponder(estado, grupoId);
      for (const token of ['est-3', 'est-4', 'est-5']) {
        const { cuerpo: inicio } = arrancarIntento(estado, reqEstudiante(token), reto.id);
        const answers = reto.questions.map((q) => ({ question_id: q.id, answer: 'A' }));
        enviarIntento(estado, reqEstudiante(token), inicio.attempt_id, { answers });
      }
      const r = await revisarPagina({
        url: `${url}#/profe/grupo/${grupoId}/errores`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_DOCENTE,
      });
      assert.deepEqual(r.errores, []);
      assert.ok(r.testids.some((t) => t.startsWith('error-')), 'con 5 respondientes, la fila ya no debe estar suprimida');
      assert.ok(r.scroll_ancho <= 375, `scrollWidth ${r.scroll_ancho} debe ser <= 375 (la tabla no debe desbordar)`);
    });
  },
);
