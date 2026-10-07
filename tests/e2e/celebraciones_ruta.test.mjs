// @ts-check
// Las celebraciones son de la pantalla donde ocurren (redespliegue real: el aviso "¡Constancia N!" tapaba "PREGUNTA N DE 3" y el
// confeti cubría el formulario del Perfil varios segundos después de navegar). Al cambiar de ruta TODO se cancela: el aviso, el
// confeti (canvas), las monedas en vuelo y la línea de tiempo del fin de reto — con un solo gancho en el router.
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
const SKIP = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const YA_ENTRO = "localStorage.setItem('engrama_actor_sintetico', 'est-1')";

// Lo que podría seguir en pantalla de una celebración.
const RESTOS = `({
  aviso: document.querySelectorAll('[data-testid="celebra-racha"]').length,
  confeti: document.querySelectorAll('[data-testid="confeti"]').length,
  fichas: document.querySelectorAll('.ficha-moneda').length,
})`;

test('celebraciones: al navegar desde Inicio, el aviso de constancia y el confeti desaparecen (no tapan la pantalla nueva)', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 5000,
      pre: `${YA_ENTRO}; localStorage.setItem('engrama_ultimo_constancia_est-1', '1'); localStorage.setItem('engrama_ultimo_saldo_est-1', '-30')`,
      eval: `(async () => {
        const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
        const { celebracionesActivas } = await import('/src/ui/celebraciones.js');
        // en cuanto cae el confeti (no a una hora fija: una librería lenta no debe volver frágil la prueba)
        for (let i = 0; i < 60 && !document.querySelector('[data-testid="confeti"]'); i++) await esperar(25);
        const antes = ${RESTOS};
        const activasAntes = celebracionesActivas();
        location.hash = '#/perfil';
        await esperar(250);
        return { antes, activasAntes, despues: ${RESTOS}, activasDespues: celebracionesActivas(), vista: document.querySelector('[data-testid^="vista-"]')?.dataset.testid };
      })()`,
    });
    assert.deepEqual(r.errores, []);
    assert.equal(r.eval.antes.aviso, 1, 'el aviso estaba (la constancia subió)');
    assert.ok(r.eval.antes.confeti >= 1, 'el confeti estaba cayendo');
    assert.ok(r.eval.activasAntes >= 2);
    assert.deepEqual(r.eval.despues, { aviso: 0, confeti: 0, fichas: 0 }, 'tras navegar no queda NADA de la celebración');
    assert.equal(r.eval.activasDespues, 0);
    assert.notEqual(r.eval.vista, 'vista-inicio', 'ya está en otra pantalla');
  });
});

function sembrarReto(estado) {
  const groupId = [...estado.groups.values()][0].id;
  const q = (t, b) => ({ question_text: t, correct_answer: b, options_json: [{ label: 'A', value: 'uno' }, { label: 'B', value: 'dos' }] });
  const { cuerpo } = crearChallenge(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, {
    title: 'Reto de cancelación', description: 'd', group_id: groupId, coins_reward: 20, xp_reward: 3, questions: [q('Primera?', 'A'), q('Segunda?', 'B')],
  });
  return cuerpo;
}

test('celebraciones: si se navega en pleno fin de reto, la línea de tiempo se cancela (ni confeti, ni monedas en vuelo, ni filas escondidas)', { skip: SKIP }, async () => {
  await conAppCompleta(async (url, estado) => {
    const reto = sembrarReto(estado);
    const r = await revisarPagina({
      url: `${url}#/retos/${reto.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO,
      eval: `(async () => {
        const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
        const q = (t) => document.querySelector('[data-testid="' + t + '"]');
        const { celebracionesActivas } = await import('/src/ui/celebraciones.js');
        q('opcion-A').click(); await esperar(80); q('boton-siguiente').click(); await esperar(80);
        q('opcion-B').click(); await esperar(80); q('boton-terminar').click();
        await esperar(1900); // en pleno confeti, con las monedas a punto de volar
        const durante = { restos: ${RESTOS}, activas: celebracionesActivas() };
        location.hash = '#/retos';
        await esperar(300);
        const despues = { restos: ${RESTOS}, activas: celebracionesActivas(), hero: !!q('hero-resultado') };
        await esperar(2500); // y nada revive solo después
        return { durante, despues, tarde: ${RESTOS} };
      })()`,
    });
    assert.deepEqual(r.errores, []);
    assert.ok(r.eval.durante.activas >= 1 && r.eval.durante.restos.confeti >= 1, 'durante el fin de reto sí hay celebración');
    assert.deepEqual(r.eval.despues.restos, { aviso: 0, confeti: 0, fichas: 0 });
    assert.equal(r.eval.despues.activas, 0);
    assert.equal(r.eval.despues.hero, false, 'la pantalla de resultado ya no está');
    assert.deepEqual(r.eval.tarde, { aviso: 0, confeti: 0, fichas: 0 }, 'nada reaparece después');
  });
});
