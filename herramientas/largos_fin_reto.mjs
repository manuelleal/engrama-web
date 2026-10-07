#!/usr/bin/env node
// @ts-check
// largos_fin_reto.mjs · ¿En qué instante del fin de reto caen los fotogramas largos? Igual que herramientas/fluidez.mjs (CPU frenada 4×),
// pero anota CUÁNDO (ms desde que se toca "Terminar") se pasó de 50 ms entre fotogramas, para saber qué paso de la línea de tiempo lo causa.
// Uso: node herramientas/largos_fin_reto.mjs [--cpu 4]
import { abrirSesion } from './cdp.mjs';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';
import { crearChallenge } from './mock/rutas_challenges.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from './mock/estado.mjs';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const iCpu = process.argv.indexOf('--cpu');
const cpu = iCpu >= 0 ? Number(process.argv[iCpu + 1]) : 4;

await conAppCompleta(async (url, estado) => {
  const groupId = [...estado.groups.values()][0].id;
  const q = (t, b) => ({ question_text: t, correct_answer: b, options_json: [{ label: 'A', value: 'uno' }, { label: 'B', value: 'dos' }] });
  const { cuerpo: reto } = crearChallenge(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, {
    title: 'largos', description: 'd', group_id: groupId, coins_reward: 30, xp_reward: 3, questions: [q('1?', 'A'), q('2?', 'B'), q('3?', 'A')],
  });
  const sesion = await abrirSesion({ ancho: 375, alto: 812 });
  try {
    await sesion.navegar(url);
    await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
    await sesion.recargar();
    await sesion.enviar('Emulation.setCPUThrottlingRate', { rate: cpu });
    await sesion.evaluar(`location.hash = '#/retos/${reto.id}'; void 0`);
    await esperar(2500);
    const largos = await sesion.evaluar(`(async () => {
      const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
      const c = (t) => document.querySelector('[data-testid="' + t + '"]');
      c('opcion-A').click(); await esperar(300); c('boton-siguiente').click(); await esperar(700);
      c('opcion-B').click(); await esperar(300); c('boton-siguiente').click(); await esperar(700);
      c('opcion-A').click(); await esperar(300);
      const t0 = performance.now(); let ultimo = t0; const largos = []; let activo = true;
      const paso = (t) => { if (!activo) return; if (t - ultimo > 50) largos.push([Math.round(ultimo - t0), Math.round(t - ultimo)]); ultimo = t; requestAnimationFrame(paso); };
      requestAnimationFrame(paso);
      c('boton-terminar').click();
      await esperar(6500); activo = false; return largos;
    })()`);
    console.log(`largos_fin_reto (CPU ${cpu}x): [inicio ms desde "Terminar", duración ms] →`, JSON.stringify(largos));
  } finally { await sesion.cerrar(); }
});
