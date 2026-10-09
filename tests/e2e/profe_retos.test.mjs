// @ts-check
// W12 (ESPEC_mvp_uis.md §11): Profe · Retos — `/challenges/all` con el aviso "todo el colegio"
// (BUG-10), activar/desactivar y asignar a un grupo propio (T6), en el navegador de verdad.
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

const YA_ENTRO_DOCENTE = "localStorage.setItem('engrama_actor_sintetico', 'docente-demo')";

function reqDocente() { return { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }; }

function sembrarSinGrupo(estado) {
  const { cuerpo } = crearChallenge(estado, reqDocente(), {
    title: 'Reto suelto (sin grupo)', description: 'd', group_id: null, coins_reward: 5, xp_reward: 0,
    questions: [{ question_text: '2+2?', correct_answer: 'A', options_json: [{ label: 'A', value: '4' }, { label: 'B', value: '5' }] }],
  });
  return cuerpo;
}

test(
  'Profe · Retos: aviso "todo el colegio", activar/desactivar y asignar a un grupo propio',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url, estado) => {
      const reto = sembrarSinGrupo(estado);
      const r = await revisarPagina({
        url: `${url}#/profe/retos`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_DOCENTE,
        eval: `(async () => {
          const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
          const aviso = document.querySelector('[data-testid="aviso-todo-el-colegio"]')?.textContent ?? null;
          const estadoInicial = document.querySelector('[data-testid="reto-${reto.id}-estado"]')?.textContent ?? null;

          document.querySelector('[data-testid="reto-${reto.id}-estado"]').click();
          await esperar(400);
          const estadoTrasClic = document.querySelector('[data-testid="reto-${reto.id}-estado"]').textContent;

          const select = document.querySelector('[data-testid="select-grupo"]');
          select.value = [...select.options].find((o) => o.value !== '').value;
          document.querySelector('[data-testid="reto-${reto.id}-asignar"]').click();
          await esperar(400);
          const asignado = document.querySelector('[data-testid="reto-${reto.id}-asignar"]').textContent;

          return { aviso, estadoInicial, estadoTrasClic, asignado };
        })()`,
      });
      assert.deepEqual(r.errores, []);
      assert.match(r.eval.aviso, /toda la institución/); // W67: "institución", nunca "colegio"
      assert.equal(r.eval.estadoInicial, 'Desactivar', 'un reto recién creado empieza activo');
      assert.equal(r.eval.estadoTrasClic, 'Activar', 'tras un clic, pasa a inactivo (botón ahora ofrece reactivarlo)');
      assert.equal(r.eval.asignado, 'Asignado ✓');
      assert.equal(estado.challenges.get(reto.id).group_id, [...estado.groups.values()][0].id, 'T6 debe haber movido el reto al grupo elegido');
    });
  },
);
