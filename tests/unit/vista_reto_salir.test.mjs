// @ts-check
// W73 · U70 (docs/ESPEC_navegacion.md §5.9, §9.3): se puede salir del reto en curso.
//   - "✕ Salir" existe en la pregunta (y mientras carga y si falla), arriba, y lleva a Retos; su nombre accesible dice de qué se sale;
//   - al tocarlo, 0 peticiones: no envía el intento, y las respuestas ya guardadas en el equipo siguen ahí;
//   - no aparece mientras se revisa el envío; si el servidor dice que el intento ya estaba cerrado (409), la salida vuelve;
//   - el reto sigue sin barra de abajo (una tarea por pantalla) y sin "volver": su salida es esta.
// Tramposos: x_reto_sin_salida, x_salir_del_reto_envia, x_salir_durante_el_envio y x_error_del_reto_sin_salida (estudiante/reto_flujo.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar, textoDe } from './foto_vistas.mjs';
import { RUTAS_NAV, ctxEstudiante, asentar } from './fotos_de_navegacion.mjs';
import { pintar, enOrden, vaAntes, primero, barraDe, volveres, error500, nuncaResponde } from './apoyo_nav.mjs';
import { renderRetoFlujo } from '../../src/vistas/estudiante/reto_flujo.js';
import { claveLocal } from '../../src/vistas/estudiante/respuestas_locales.js';

const ENVIAR = 'POST /challenges/attempts/int-1/submit';
const RESULTADO = { coins_earned: 0, is_correct: false, correct_answers: [{ question_id: 'q1', correct_answer: 'B' }, { question_id: 'q2', correct_answer: 'A' }] };
const abrir = (rutas) => pintar({ ...RUTAS_NAV, ...rutas }, (r) => renderRetoFlujo(r, { id: 'reto-1' }, {}, ctxEstudiante()));
const tocar = async (raiz, testid) => { const n = buscar(raiz, testid); assert.ok(n, `falta ${testid}`); await Promise.all(n.disparar('click')); await asentar(); };
const salidas = (raiz) => enOrden(raiz).filter((e) => e.getAttribute?.('data-testid') === 'reto-salir');
const guardadas = () => localStorage.getItem(claveLocal('int-1'));

test('U70: la pregunta del reto trae UNA salida, "✕ Salir", arriba y antes del título, que lleva a Retos y cuyo nombre dice de qué se sale; el reto sigue sin barra y sin volver', async () => {
  const { raiz, cerrar } = await abrir({});
  try {
    assert.ok(buscar(raiz, 'enunciado'), 'la pregunta está en pantalla');
    const todas = salidas(raiz);
    assert.equal(todas.length, 1, `una salida (hay ${todas.length})`);
    const salir = todas[0];
    assert.equal(salir.tagName, 'a', 'es un enlace interno: funciona sin red y no pide nada');
    assert.equal(salir.getAttribute('href'), '#/retos');
    assert.equal(textoDe(salir), '✕ Salir');
    assert.equal(salir.getAttribute('aria-label'), 'Salir del reto');
    assert.ok(vaAntes(raiz, salir, primero(raiz, 'h1')), 'va antes del título del reto');
    assert.ok(vaAntes(raiz, salir, buscar(raiz, 'enunciado')), 'y antes de la pregunta');
    assert.equal(barraDe(raiz), null, 'el reto en curso no lleva barra (una tarea por pantalla)');
    assert.deepEqual(volveres(raiz), [], 'ni "volver": su salida es esta');
    // Se repinta con cada opción elegida: la salida sigue siendo una sola.
    await tocar(raiz, 'opcion-B');
    assert.equal(salidas(raiz).length, 1, 'tras elegir una opción, sigue habiendo una sola salida');
  } finally { cerrar(); }
});

test('U70: tocar "Salir" no envía el intento ni hace ninguna petición, y las respuestas ya guardadas en el equipo siguen ahí', async () => {
  const { raiz, llamadas, cerrar } = await abrir({ [ENVIAR]: RESULTADO });
  try {
    await tocar(raiz, 'opcion-B');
    assert.equal(guardadas(), '{"q1":"B"}', 'la respuesta quedó guardada en el equipo');
    const antes = llamadas.length;
    const salir = salidas(raiz)[0];
    assert.equal(salir.oyentes, undefined, 'el enlace no tiene ningún oyente: salir es solo navegar');
    await Promise.all(salir.disparar('click'));
    await asentar();
    assert.equal(llamadas.length, antes, 'tocar Salir no pide nada al servidor');
    assert.equal(llamadas.filter((l) => l.metodo === 'POST' && l.ruta.endsWith('/submit')).length, 0, 'el intento NO se envió');
    assert.equal(guardadas(), '{"q1":"B"}', 'las respuestas guardadas siguen ahí');
    assert.ok(buscar(raiz, 'enunciado'), 'y la pantalla no cambió por su cuenta (la navegación la hace el enlace)');
  } finally { cerrar(); }
});

test('U70: mientras se revisa el envío no se ofrece salir; si el servidor responde que ya estaba cerrado (409), la salida vuelve', async () => {
  /** Llega a la última pregunta con las dos respondidas y toca "Terminar". */
  const terminar = async (raiz) => {
    await tocar(raiz, 'opcion-B');
    await tocar(raiz, 'boton-siguiente');
    await tocar(raiz, 'opcion-A');
    assert.equal(salidas(raiz).length, 1, 'antes de terminar, la salida está');
    const boton = buscar(raiz, 'boton-terminar');
    boton.disparar('click'); // sin esperar: el envío queda volando
    await asentar();
  };
  const volando = await abrir({ [ENVIAR]: nuncaResponde });
  try {
    await terminar(volando.raiz);
    assert.equal(volando.llamadas.filter((l) => l.ruta.endsWith('/submit')).length, 1, 'el intento va camino al servidor');
    assert.equal(salidas(volando.raiz).length, 0, 'mientras se revisa, no hay "Salir"');
  } finally { volando.cerrar(); }
  const yaCerrado = await abrir({ [ENVIAR]: () => new Response(JSON.stringify({ detail: 'Attempt already completed or abandoned' }), { status: 409, headers: { 'Content-Type': 'application/json' } }) });
  try {
    await terminar(yaCerrado.raiz);
    await asentar();
    assert.equal(salidas(yaCerrado.raiz).length, 1, 'con un 409 no hay pantalla nueva, pero la salida vuelve: no es un callejón');
  } finally { yaCerrado.cerrar(); }
});

test('U70: si el reto no carga, o no se pudo enviar, la pantalla de error trae la salida a Retos (y mientras carga, también)', async () => {
  const todoFalla = Object.fromEntries(Object.keys(RUTAS_NAV).map((k) => [k, error500]));
  const noCarga = await pintar(todoFalla, (r) => renderRetoFlujo(r, { id: 'reto-1' }, {}, ctxEstudiante()));
  try {
    assert.ok(enOrden(noCarga.raiz).some((e) => e.getAttribute?.('role') === 'alert'), 'el error se ve');
    assert.deepEqual(salidas(noCarga.raiz).map((e) => e.getAttribute('href')), ['#/retos'], 'con su salida');
    assert.equal(barraDe(noCarga.raiz), null);
  } finally { noCarga.cerrar(); }
  const cargando = await pintar(Object.fromEntries(Object.keys(RUTAS_NAV).map((k) => [k, nuncaResponde])), (r) => renderRetoFlujo(r, { id: 'reto-1' }, {}, ctxEstudiante()));
  try { assert.equal(salidas(cargando.raiz).length, 1, 'mientras carga, se puede salir'); } finally { cargando.cerrar(); }
  const noEnvia = await abrir({ [ENVIAR]: error500 });
  try {
    await tocar(noEnvia.raiz, 'opcion-B');
    await tocar(noEnvia.raiz, 'boton-siguiente');
    await tocar(noEnvia.raiz, 'opcion-A');
    await tocar(noEnvia.raiz, 'boton-terminar');
    await asentar();
    assert.ok(enOrden(noEnvia.raiz).some((e) => e.getAttribute?.('role') === 'alert'), 'el envío falló y se dice');
    assert.equal(salidas(noEnvia.raiz).length, 1, 'y se puede salir a Retos');
  } finally { noEnvia.cerrar(); }
});
