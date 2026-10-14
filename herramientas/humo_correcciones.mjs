#!/usr/bin/env node
// @ts-check
// humo_correcciones.mjs · Humo de sintéticos de las correcciones de la auditoría 05 (docs/ESPEC_correcciones_practica.md §3, W83). Con el CLIENTE real
// (src/api/*.js) contra un mock_api real detrás del proxy de servidor_dev.mjs, y fallas programadas en el doble (`estado.fallas`), mide lo que la red
// irregular de un aula le hace a la práctica del día y escribe un JSON canónico (sin fechas, UUID ni nombres) con su sha256 (el mismo en dos corridas).
//   --contra mock              semilla 20261014 (las entradas de humo_practica): el sondeo con un 500 sigue por pregunta; con dos 503 lanza
//                              ErrorTransitorio y, de vuelta la red, retoma lo respondido; el backend viejo da null; la tanda con 502 y 502 queda en
//                              null y registrada, con un 502 se lee; /finish de un intento ya cerrado da 409 y la relectura dice que ya no está abierto.
//   --contra mock --replica    semilla 7, entradas nuevas: otro estudiante (B1) y otro reto, fallas 504 y 500, un corte de conexión en el doble (el
//                              proxy responde 502), la racha con 503 y 503 (registrada) y con una sola falla (se lee).
// Uso: node herramientas/humo_correcciones.mjs --contra mock [--replica]   → salida/humo_correcciones.{mock,replica}.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearServidor } from './servidor_dev.mjs';
import { crearMockApi } from './mock_api.mjs';
import { crearEstado } from './mock/estado.mjs';
import { configurarRaizApi, fijarColegios, ErrorApi } from '../src/api/cliente.js';
import { arrancarIntento } from '../src/api/retos.js';
import { retomarIntento, responderPregunta, terminarIntento, verTanda, leerRacha, degradacionesDePractica, ErrorTransitorio } from '../src/api/practica.js';
import { jsonCanonico, sha256De } from './humo/canon.mjs';
import { sembrarPractica, sembrarReplicaPractica, SEMILLA_PRACTICA, SEMILLA_PRACTICA_REPLICA } from './humo/entradas_practica.mjs';
import { ponerReloj } from './humo/flujo_practica.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const MARTES = Date.parse('2026-10-13T14:00:00Z');

/** Mock y servidor de desarrollo (proxy `/api`) en puertos libres (nunca 8088, 8089 ni 56421). */
async function levantar() {
  const estado = crearEstado();
  const mock = crearMockApi(estado);
  await new Promise((ok) => mock.listen(0, '127.0.0.1', () => ok(null)));
  const previo = process.env.ENGRAMA_API_URL;
  process.env.ENGRAMA_API_URL = `http://127.0.0.1:${/** @type {any} */ (mock.address()).port}`;
  const dev = crearServidor();
  await new Promise((ok) => dev.listen(0, '127.0.0.1', () => ok(null)));
  configurarRaizApi(`http://127.0.0.1:${/** @type {any} */ (dev.address()).port}`);
  fijarColegios({ activo: null, permitidos: null });
  return {
    estado,
    async cerrar() {
      configurarRaizApi('');
      await new Promise((ok) => dev.close(() => ok(null)));
      await new Promise((ok) => mock.close(() => ok(null)));
      if (previo === undefined) delete process.env.ENGRAMA_API_URL; else process.env.ENGRAMA_API_URL = previo;
    },
  };
}

/** Cuántas peticiones vio el doble (método y final de la ruta) mientras corría `fn`, y qué devolvió `fn` (o qué clase de error lanzó). */
async function medir(estado, metodo, fin, fn) {
  const antes = estado.registro.length;
  let resultado;
  try { resultado = await fn(); } catch (e) {
    resultado = { error: e instanceof ErrorTransitorio ? 'transitorio' : e instanceof ErrorApi ? `http_${e.status}` : String(e) };
  }
  const peticiones = estado.registro.slice(antes).filter((r) => r.metodo === metodo && r.ruta.endsWith(fin)).length;
  return { resultado, peticiones };
}

const falla = (metodo, ruta, extra) => ({ metodo, ruta, ...extra });
const resumenIntento = (r) => (r && !r.error ? { status: r.status, respondidas: r.respondidas.length } : r);

/** El sondeo de L1 con fallas: `primera` (una falla y sigue), `dos` (dos fallas: transitorio; y de vuelta la red). */
async function sondeos(estado, intento, preguntaId, ctx, { primera, dos }) {
  estado.fallas = [falla('GET', /\/answers$/, primera)];
  const una = await medir(estado, 'GET', '/answers', () => retomarIntento(intento, ctx));
  await responderPregunta(intento, preguntaId, 'A', ctx); // ya hay algo respondido: no se debe perder
  estado.fallas = [falla('GET', /\/answers$/, dos), falla('GET', /\/answers$/, dos)];
  const caido = await medir(estado, 'GET', '/answers', () => retomarIntento(intento, ctx));
  const vuelta = await medir(estado, 'GET', '/answers', () => retomarIntento(intento, ctx));
  estado.backend.l1 = false;
  const viejo = await medir(estado, 'GET', '/answers', () => retomarIntento(intento, ctx));
  estado.backend.l1 = true;
  return {
    una_falla: { l1: una.resultado !== null && !una.resultado.error, peticiones: una.peticiones },
    dos_fallas: { error: caido.resultado?.error ?? null, peticiones: caido.peticiones },
    de_vuelta_la_red: { ...resumenIntento(vuelta.resultado), peticiones: vuelta.peticiones },
    backend_viejo: { resultado: viejo.resultado, peticiones: viejo.peticiones },
  };
}

/** Cierra el intento y lo intenta cerrar otra vez (otra pestaña): 409, y la relectura dice cómo quedó. */
async function cierreDoble(estado, intento, challenge, ctx) {
  for (const q of challenge.questions.slice(1)) await responderPregunta(intento, q.id, 'B', ctx);
  const primero = await terminarIntento(intento, ctx);
  const segundo = await medir(estado, 'POST', '/finish', () => terminarIntento(intento, ctx));
  const releido = await retomarIntento(intento, ctx);
  return { primero_paga: Number.isInteger(primero.coins_earned), segundo: segundo.resultado?.error ?? 'sin_error', releido: resumenIntento(releido) };
}

/** Una ruta de Inicio (tanda o racha) con dos fallas y con una. */
async function inicioConFallas(estado, ruta, fin, leer, ctx, status) {
  const antes = degradacionesDePractica().length;
  estado.fallas = [falla('GET', ruta, { status }), falla('GET', ruta, { status })];
  const dos = await medir(estado, 'GET', fin, () => leer(ctx));
  estado.fallas = [falla('GET', ruta, { status })];
  const una = await medir(estado, 'GET', fin, () => leer(ctx));
  return {
    dos_fallas: { leida: dos.resultado !== null, peticiones: dos.peticiones }, una_falla: { leida: una.resultado !== null, peticiones: una.peticiones },
    registrado: degradacionesDePractica().slice(antes),
  };
}

/** Desarrollo (semilla 20261014). */
async function desarrollo() {
  const { estado, cerrar } = await levantar();
  try {
    ponerReloj(estado, MARTES);
    const { retos } = sembrarPractica(estado);
    const ctx = { token: 'prac-1' };
    const reto = retos.find((r) => r.title === 'Rutina diaria · Gramática 1');
    const { attempt_id: intento, challenge } = await arrancarIntento(reto.id, ctx);
    const sondeo = await sondeos(estado, intento, challenge.questions[0].id, ctx, { primera: { status: 500 }, dos: { status: 503 } });
    const cierre = await cierreDoble(estado, intento, challenge, ctx);
    const tanda = await inicioConFallas(estado, /\/challenges\/tanda$/, '/challenges/tanda', verTanda, ctx, 502);
    return { semilla: SEMILLA_PRACTICA, contra: 'mock', sondeo, cierre, tanda, fallas_sin_usar: estado.fallas.length };
  } finally { await cerrar(); }
}

/** Réplica (semilla 7): otro estudiante y otro reto (B1), otras fallas y un corte de conexión. */
async function replica() {
  const { estado, cerrar } = await levantar();
  try {
    ponerReloj(estado, MARTES);
    const { retos } = sembrarReplicaPractica(estado);
    const ctx = { token: 'prac-rep-1' };
    const reto = retos.find((r) => r.title === 'Viajes · Vocabulario 1');
    const { attempt_id: intento, challenge } = await arrancarIntento(reto.id, ctx);
    const sondeo = await sondeos(estado, intento, challenge.questions[0].id, ctx, { primera: { status: 504 }, dos: { cortar: true } });
    const cierre = await cierreDoble(estado, intento, challenge, ctx);
    const racha = await inicioConFallas(estado, /\/core\/racha$/, '/core/racha', leerRacha, ctx, 503);
    return { semilla: SEMILLA_PRACTICA_REPLICA, contra: 'mock', replica: true, sondeo, cierre, racha, fallas_sin_usar: estado.fallas.length };
  } finally { await cerrar(); }
}

/** Una corrida completa; exportada para que la prueba la corra dos veces. @param {boolean} esReplica */
export async function correrHumoCorrecciones(esReplica) {
  const salida = console.warn;
  console.warn = () => {}; // los avisos del cliente (reintentos y degradaciones) son a propósito: lo que cuenta queda en el JSON
  try { return esReplica ? await replica() : await desarrollo(); } finally { console.warn = salida; }
}

async function main() {
  const iContra = process.argv.indexOf('--contra');
  const modo = iContra >= 0 ? process.argv[iContra + 1] : 'mock';
  if (modo !== 'mock') { console.error(`humo_correcciones: --contra "${modo}" no está soportado (el humo contra el backend local es del despliegue)`); process.exit(2); }
  const esReplica = process.argv.includes('--replica');
  const texto = jsonCanonico(await correrHumoCorrecciones(esReplica));
  mkdirSync(join(RAIZ, 'salida'), { recursive: true });
  const ruta = join(RAIZ, 'salida', `humo_correcciones.${esReplica ? 'replica' : 'mock'}.json`);
  writeFileSync(ruta, `${texto}\n`);
  console.log(`humo_correcciones: ${ruta}`);
  console.log(`humo_correcciones: sha256 ${sha256De(texto)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => { console.error('humo_correcciones: falló', e); process.exit(1); });
}
