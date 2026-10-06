// @ts-check
// Game feel en el navegador de verdad (CDP). Cada grupo del encargo agrega aquí sus momentos:
// lo que se puede medir con el DOM (que las fichas existan y desaparezcan, que el número termine
// en el valor del servidor, que reduced-motion no deje nada flotando). Lo que no se puede medir
// con el DOM (cómo suena, si el celular vibra) lo dice el informe del encargo.
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
// Se simula una visita anterior con MENOS saldo que el del servidor (0): el valor que llega "sube".
const VISITA_ANTERIOR_MENOR = "localStorage.setItem('engrama_ultimo_saldo_est-1', '-3')";

test('game feel: en Inicio, si el saldo del servidor subió, las monedas vuelan y el contador termina en el valor real', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 5000, pre: `${YA_ENTRO}; ${VISITA_ANTERIOR_MENOR}`,
      eval: `(async () => {
        const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
        const enVuelo = document.querySelectorAll('.ficha-moneda').length;
        await esperar(2800);
        return {
          enVuelo,
          quedan: document.querySelectorAll('.ficha-moneda').length,
          saldo: document.querySelector('[data-testid="saldo"]').textContent,
          guardado: localStorage.getItem('engrama_ultimo_saldo_est-1'),
        };
      })()`,
    });
    assert.deepEqual(r.errores, []);
    assert.ok(r.eval.enVuelo > 0, 'al subir el saldo, hay fichas volando hacia el contador');
    assert.equal(r.eval.quedan, 0, 'las fichas se retiran solas al aterrizar');
    assert.match(r.eval.saldo, /^0 monedas$/, 'el contador termina en el saldo del servidor, no en otro');
    assert.equal(r.eval.guardado, '0', 'lo último visto se actualiza con el valor del servidor');
  });
});

test('game feel: sin visita anterior (o sin que suba) Inicio no lanza fichas', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO,
      eval: "document.querySelectorAll('.ficha-moneda').length",
    });
    assert.equal(r.eval, 0);
  });
});

test('game feel: si la constancia del servidor subió, Inicio la celebra (llama, aviso y confeti) mostrando el número tal cual', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 5000,
      pre: `${YA_ENTRO}; localStorage.setItem('engrama_ultimo_constancia_est-1', '1')`,
      eval: `(async () => {
        await new Promise((r) => setTimeout(r, 400));
        return {
          aviso: document.querySelector('[data-testid="celebra-racha"]')?.textContent ?? null,
          llamas: document.querySelectorAll('[data-testid="constancia"] .llama').length,
          confeti: document.querySelectorAll('[data-testid="confeti"] .confeti-pieza').length,
          constancia: document.querySelector('[data-testid="constancia"]').textContent,
        };
      })()`,
    });
    assert.deepEqual(r.errores, []);
    assert.equal(r.eval.aviso, '¡Constancia 3!', 'est-1 llega con constancia 3 del servidor: se celebra ese número, no otro');
    assert.equal(r.eval.llamas, 1, 'la constancia lleva su llama dibujada');
    assert.ok(r.eval.confeti > 0, 'la racha que sube suelta confeti suave');
    assert.match(r.eval.constancia, /Constancia: 3$/);
  });
});

test('game feel: con la misma constancia que la última vez, Inicio no celebra', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 5000,
      pre: `${YA_ENTRO}; localStorage.setItem('engrama_ultimo_constancia_est-1', '3')`,
      eval: "document.querySelectorAll('[data-testid=\"celebra-racha\"]').length",
    });
    assert.equal(r.eval, 0);
  });
});

function sembrarReto(estado) {
  const groupId = [...estado.groups.values()][0].id;
  const { cuerpo } = crearChallenge(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, {
    title: 'Reto de juego', description: 'd', group_id: groupId, coins_reward: 5, xp_reward: 3,
    questions: [
      { question_text: '2+2?', correct_answer: 'A', options_json: [{ label: 'A', value: '4' }, { label: 'B', value: '5' }] },
      { question_text: 'Color del cielo?', correct_answer: 'B', options_json: [{ label: 'A', value: 'rojo' }, { label: 'B', value: 'azul' }] },
    ],
  });
  return cuerpo;
}

test('game feel: en la pregunta el botón nace plano, despierta al elegir, sube el panel neutro y la barra se llena', { skip: SKIP }, async () => {
  await conAppCompleta(async (url, estado) => {
    const reto = sembrarReto(estado);
    const r = await revisarPagina({
      url: `${url}#/retos/${reto.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO,
      eval: `(async () => {
        const q = (t) => document.querySelector('[data-testid="' + t + '"]');
        const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
        const antes = { deshabilitado: q('boton-siguiente').disabled, progreso: q('progreso-reto').getAttribute('aria-valuenow'), panel: q('panel-respuesta').className };
        q('opcion-A').click();
        await esperar(700);
        const barra = document.querySelector('.barra-accion');
        return {
          antes,
          despues: {
            deshabilitado: q('boton-siguiente').disabled,
            despierta: q('boton-siguiente').classList.contains('despierta'),
            progreso: q('progreso-reto').getAttribute('aria-valuenow'),
            panel: q('panel-respuesta').textContent,
            panelClase: q('panel-respuesta').className,
            elegida: q('opcion-A').getAttribute('aria-pressed'),
            posicionBarra: getComputedStyle(barra).position,
            sonido: !!q('boton-sonido'),
          },
        };
      })()`,
    });
    assert.deepEqual(r.errores, []);
    assert.equal(r.eval.antes.deshabilitado, true, 'el botón empieza plano (deshabilitado)');
    assert.equal(r.eval.antes.progreso, '0');
    assert.match(r.eval.antes.panel, /panel-oculto/);
    assert.equal(r.eval.despues.deshabilitado, false, 'al elegir, el botón cobra vida');
    assert.equal(r.eval.despues.despierta, true, 'y lo hace con su pop');
    assert.equal(r.eval.despues.progreso, '1', 'la barra cuenta la respuesta');
    assert.match(r.eval.despues.panel, /Elegiste A: 4/);
    assert.doesNotMatch(r.eval.despues.panel, /[✓✗]|[Cc]orrect|[Ii]ncorrect|Esta vez no/, 'elegir no revela nada de la clave');
    assert.match(r.eval.despues.panelClase, /panel-sube/);
    assert.equal(r.eval.despues.elegida, 'true');
    assert.equal(r.eval.despues.posicionBarra, 'fixed', 'la barra de acción queda fija abajo');
    assert.equal(r.eval.despues.sonido, true, 'el botón de silencio está visible en la pregunta');
  });
});

function scriptTerminar(labels) {
  return `(async () => {
    const q = (t) => document.querySelector('[data-testid="' + t + '"]');
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    q('opcion-${labels[0]}').click(); await esperar(80); q('boton-siguiente').click(); await esperar(80);
    q('opcion-${labels[1]}').click(); await esperar(80); q('boton-terminar').click();
    await esperar(900);
    const medio = {
      confetiFuerte: document.querySelectorAll('.confeti-fuerte .confeti-pieza').length,
      confetiAlgo: document.querySelectorAll('[data-testid="confeti"] .confeti-pieza').length,
    };
    await esperar(3000);
    return {
      medio,
      hero: q('hero-resultado').className,
      titulo: q('hero-resultado').querySelector('h1').textContent,
      drako: q('hero-resultado').querySelector('img').dataset.testid,
      puntaje: q('puntaje').textContent,
      medalla: document.querySelector('.medalla-num')?.textContent ?? null,
      monedas: q('revision-monedas').textContent,
      drakoEnFilas: document.querySelectorAll('li[data-testid^="revision-"] img').length,
    };
  })()`;
}

test('game feel: un reto perfecto celebra a lo grande (confeti fuerte, medalla de monedas, Drako celebra)', { skip: SKIP }, async () => {
  await conAppCompleta(async (url, estado) => {
    const reto = sembrarReto(estado);
    const r = await revisarPagina({ url: `${url}#/retos/${reto.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO, eval: scriptTerminar(['A', 'B']) });
    assert.deepEqual(r.errores, []);
    assert.match(r.eval.hero, /hero-perfecto/);
    assert.equal(r.eval.titulo, '¡Reto perfecto!');
    assert.equal(r.eval.drako, 'drako-celebra');
    assert.ok(r.eval.medio.confetiFuerte >= 60, 'el perfecto suelta confeti fuerte');
    assert.match(r.eval.puntaje, /2 \/ 2/);
    assert.match(r.eval.puntaje, /2 de 2 correctas/, 'el texto para lectores dice el puntaje completo');
    assert.equal(r.eval.medalla, '+5', 'la medalla termina en lo que pagó el servidor');
    assert.match(r.eval.monedas, /\+5 monedas/);
    assert.equal(r.eval.drakoEnFilas, 0, 'Drako presenta arriba; nunca dentro del bloque de calificación de una pregunta');
  });
});

test('game feel: un reto con todo fallado anima (Drako "ups", sin confeti, sin medalla) y no castiga', { skip: SKIP }, async () => {
  await conAppCompleta(async (url, estado) => {
    const reto = sembrarReto(estado);
    const r = await revisarPagina({ url: `${url}#/retos/${reto.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO, eval: scriptTerminar(['B', 'A']) });
    assert.deepEqual(r.errores, []);
    assert.match(r.eval.hero, /hero-animo/);
    assert.equal(r.eval.drako, 'drako-ups');
    assert.equal(r.eval.medio.confetiAlgo, 0, 'sin confeti cuando no hubo aciertos');
    assert.equal(r.eval.medalla, null, 'sin monedas, sin medalla');
    assert.match(r.eval.monedas, /No sumaste monedas/);
    assert.match(r.eval.titulo, /Buen intento/);
  });
});

test('game feel: marcar asistencia estampa el sello, cuenta las monedas del servidor y deja el resultado con ícono y texto', { skip: SKIP }, async () => {
  const { abrirSesion } = await import('../../herramientas/mock/rutas_teachers.mjs');
  await conAppCompleta(async (url, estado) => {
    const { cuerpo: sesion } = abrirSesion(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, [...estado.groups.values()][0].id, {});
    const r = await revisarPagina({
      url: `${url}#/asistencia?codigo=${sesion.session_code}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO,
      eval: `(async () => {
        const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
        await esperar(500);
        const temprano = { sello: !!document.querySelector('[data-testid="sello"]'), sonido: !!document.querySelector('[data-testid="boton-sonido"]') };
        await esperar(3200);
        return {
          temprano,
          resultado: document.querySelector('[data-testid="asistencia-resultado"] [data-testid="resultado"]').textContent,
          chip: document.querySelector('[data-testid="chip-monedas"]')?.textContent ?? null,
          fichasQuedan: document.querySelectorAll('.ficha-moneda').length,
        };
      })()`,
    });
    assert.deepEqual(r.errores, []);
    assert.equal(r.eval.temprano.sello, true, 'el sello aparece al instante');
    assert.equal(r.eval.temprano.sonido, true);
    assert.match(r.eval.resultado, /✓/);
    const m = r.eval.resultado.match(/\+(\d+) monedas/);
    assert.ok(m, 'el resultado dice cuántas monedas dio el servidor');
    if (Number(m[1]) > 0) assert.equal(r.eval.chip, `+${m[1]} monedas`, 'el chip cuenta hasta lo que dio el servidor, ni una más');
    else assert.equal(r.eval.chip, null);
    assert.equal(r.eval.fichasQuedan, 0);
  });
});

test('game feel: la carga y el vacío tienen personalidad (Drako en espera + esqueleto, con su texto), no un párrafo mudo', { skip: SKIP }, async () => {
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({
      url, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO,
      eval: `(async () => {
        const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
        let carga = null;
        const ver = () => {
          const c = document.querySelector('[data-testid="cargando"]');
          if (c && !carga) carga = { drako: !!c.querySelector('[data-testid="drako-espera"]'), esqueletos: c.querySelectorAll('.esqueleto').length, texto: c.textContent.trim(), role: c.getAttribute('role') };
        };
        new MutationObserver(ver).observe(document.body, { childList: true, subtree: true });
        location.hash = '#/retos';
        await esperar(1500);
        const vacio = document.querySelector('[data-testid="retos-vacio"]');
        return { carga, vacio: vacio ? { drako: !!vacio.querySelector('[data-testid="drako-espera"]'), texto: vacio.textContent } : null };
      })()`,
    });
    assert.deepEqual(r.errores, []);
    assert.ok(r.eval.carga, 'mientras llegan los retos se vio el estado de carga');
    assert.equal(r.eval.carga.drako, true);
    assert.ok(r.eval.carga.esqueletos >= 2);
    assert.match(r.eval.carga.texto, /Cargando/, 'el esqueleto nunca va sin su texto');
    assert.equal(r.eval.carga.role, 'status');
    assert.ok(r.eval.vacio, 'sin retos se ve el vacío con personalidad');
    assert.equal(r.eval.vacio.drako, true);
    assert.match(r.eval.vacio.texto, /Aún no hay retos/);
  });
});
