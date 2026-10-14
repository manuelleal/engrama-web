#!/usr/bin/env node
// @ts-check
// humo_practica.mjs · Humo de sintéticos de la práctica del día (docs/ESPEC_practica_del_dia.md §W82). Con el CLIENTE real (src/api/*.js) contra un
// mock_api real detrás del proxy de servidor_dev.mjs, recorre días de práctica con el reloj del doble y escribe un JSON canónico (sin fechas
// absolutas, UUID ni nombres) con su sha256 (el mismo en dos corridas).
//   --contra mock              semilla 20261014: una estudiante sin SET (A2): asistencia el lunes; el martes la tanda (dos retos pregunta por pregunta,
//                              otra tanda y el tope); el miércoles el repaso primero (0 monedas), el reintento y la asistencia: la semana se cumple y
//                              paga el bono una vez; y el backend viejo (las tres partes apagadas: la web cae a lo de siempre).
//   --contra mock --replica    semilla 7, entradas que no se usan al desarrollar: un estudiante con SET en B1 (sin aviso de nivel, explicación en
//                              inglés), cinco días activos (gana protector), semanas sin cumplir (gasta protectores y después vuelve a 0: "semana
//                              nueva") y una institución sin retos de nivel (tanda: null).
// Uso: node herramientas/humo_practica.mjs --contra mock [--replica]   → salida/humo_practica.{mock,replica}.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearServidor } from './servidor_dev.mjs';
import { crearMockApi } from './mock_api.mjs';
import { crearEstado } from './mock/estado.mjs';
import { configurarRaizApi, fijarColegios } from '../src/api/cliente.js';
import { jsonCanonico, sha256De } from './humo/canon.mjs';
import { sembrarPractica, sembrarReplicaPractica, SEMILLA_PRACTICA, SEMILLA_PRACTICA_REPLICA } from './humo/entradas_practica.mjs';
import { DIA, ponerReloj, asistir, jugarReto, pasoDeHoy, rachaDeHoy, repasar, respaldoViejo, sembrarGrupoVacio, fugas, pedirTanda } from './humo/flujo_practica.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const LUNES = Date.parse('2026-10-12T14:00:00Z'); // lunes 12 de octubre, 9:00 en Bogotá
const cuentaNueva = () => ({ es: 0, en: 0, por_que_al_fallar: 0, por_que_al_acertar: 0, aciertos: 0 });

/** Mock y servidor de desarrollo (proxy `/api`) en puertos libres. */
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

/** El martes: la tanda 1 (dos retos), la 2 (uno) y el tope. */
async function martes(retos, ctx, cuenta) {
  const id = (t) => retos.find((r) => r.title === t).id;
  const antes = await pasoDeHoy(ctx);
  const t1 = await pedirTanda(ctx);
  const titulos1 = t1.tanda.retos.map((r) => r.reto.title);
  const g1 = await jugarReto(id('Rutina diaria · Gramática 1'), ['A', 'B', 'A'], ctx, cuenta); // falla la 1: va a la cola de repaso
  const g2 = await jugarReto(id('Rutina diaria · Gramática 2'), ['A', 'B', 'B'], ctx, cuenta);
  const despues = await pasoDeHoy(ctx);
  const t2 = await pedirTanda(ctx);
  const v1 = await jugarReto(id('Rutina diaria · Vocabulario 1'), ['A', 'A'], ctx, cuenta);
  const tope = await pedirTanda(ctx);
  return {
    paso_al_abrir: antes.paso, tanda_1: titulos1, monedas_retos: [g1.monedas, g2.monedas, v1.monedas], paso_tras_la_1: despues.paso,
    tanda_2: t2.tanda.retos.map((r) => r.reto.title), tras_el_tope: { numero: tope.tanda.numero, tandas_hoy: tope.tandas_hoy, listo_por_hoy: tope.listo_por_hoy },
  };
}

/** El miércoles: el repaso primero (0 monedas), el reintento del reto fallado y la asistencia. */
async function miercoles(estado, grupoId, retos, ctx, cuenta) {
  const t = await pedirTanda(ctx);
  const repaso = await repasar(t, 'B', ctx, cuenta);
  const reintento = await jugarReto(retos.find((r) => r.title === 'Rutina diaria · Gramática 1').id, ['B', 'B', 'A'], ctx, cuenta);
  const asistio = await asistir(estado, grupoId, ctx);
  return { repaso_primero: (t.tanda?.repaso?.length ?? 0) > 0, retos: t.tanda.retos.map((r) => r.reto.title), repaso, monedas_reintento: reintento.monedas, asistio };
}

/** Desarrollo (semilla 20261014). */
async function desarrollo() {
  const { estado, cerrar } = await levantar();
  try {
    const reloj = ponerReloj(estado, LUNES);
    const { grupoId, retos } = sembrarPractica(estado);
    const ctx = { token: 'prac-1' };
    const cuenta = cuentaNueva();
    const lunes = { asistio: await asistir(estado, grupoId, ctx), racha: await rachaDeHoy(ctx) };
    reloj.avanzar(DIA);
    const dosDias = { ...(await martes(retos, ctx, cuenta)), racha: await rachaDeHoy(ctx) };
    reloj.avanzar(DIA);
    const tresDias = { ...(await miercoles(estado, grupoId, retos, ctx, cuenta)), racha: await rachaDeHoy(ctx) };
    const bonos = estado.ledger.filter((e) => e.action === 'streak_week').map((e) => e.amount);
    const viejo = await respaldoViejo(estado, retos.find((r) => r.title === 'Trabajo · Gramática 1').id, ctx);
    return {
      semilla: SEMILLA_PRACTICA, contra: 'mock', practica: (await pasoDeHoy(ctx)).nivel, lunes, martes: dosDias, miercoles: tresDias,
      explicaciones: cuenta, bono_de_semana: bonos, fugas_de_clave: fugas(),
      respaldo_backend_viejo: { tanda: viejo.tanda, racha: viejo.racha, l1: viejo.l1 },
    };
  } finally { await cerrar(); }
}

/** Réplica (semilla 7): SET en B1, cinco días activos, semanas sin cumplir y una institución sin retos de nivel. */
async function replica() {
  const { estado, cerrar } = await levantar();
  try {
    const reloj = ponerReloj(estado, Date.parse('2026-10-05T14:00:00Z')); // lunes 5
    const { grupoId, retos } = sembrarReplicaPractica(estado);
    const ctx = { token: 'prac-rep-1' };
    const cuenta = cuentaNueva();
    for (let i = 0; i < 5; i++) { await asistir(estado, grupoId, ctx); if (i < 4) reloj.avanzar(DIA); }
    const cincoDias = await rachaDeHoy(ctx);
    reloj.avanzar(3 * DIA); // lunes 12
    const paso = await pasoDeHoy(ctx);
    const t = await pedirTanda(ctx);
    const reto = await jugarReto(t.tanda.retos[0].reto.id, ['B', 'B', 'C'], ctx, cuenta);
    const semanas = [];
    for (let i = 0; i < 4; i++) { reloj.avanzar(7 * DIA); semanas.push(await rachaDeHoy(ctx)); } // semanas sin nada: protector, protector, a 0
    const vacio = sembrarGrupoVacio(estado, 'SINT-PRAC-VACIO', 'prac-vacio-1');
    const sinContenido = await pedirTanda({ token: vacio });
    return {
      semilla: SEMILLA_PRACTICA_REPLICA, contra: 'mock', replica: true, cinco_dias: cincoDias, con_set: { paso: paso.paso, nivel: paso.nivel, reto_monedas: reto.monedas },
      explicaciones: cuenta, semanas_sin_cumplir: semanas,
      sin_contenido: { tanda: sinContenido.tanda, sin_contenido_nuevo: sinContenido.sin_contenido_nuevo, tandas_hoy: sinContenido.tandas_hoy }, fugas_de_clave: fugas(),
    };
  } finally { await cerrar(); }
}

/** Una corrida completa; exportada para que la prueba la corra dos veces. @param {boolean} esReplica */
export async function correrHumoPractica(esReplica) {
  return esReplica ? replica() : desarrollo();
}

async function main() {
  const iContra = process.argv.indexOf('--contra');
  const modo = iContra >= 0 ? process.argv[iContra + 1] : 'mock';
  if (modo !== 'mock') { console.error(`humo_practica: --contra "${modo}" no está soportado (el humo contra el backend local es del despliegue)`); process.exit(2); }
  const esReplica = process.argv.includes('--replica');
  const texto = jsonCanonico(await correrHumoPractica(esReplica));
  mkdirSync(join(RAIZ, 'salida'), { recursive: true });
  const ruta = join(RAIZ, 'salida', `humo_practica.${esReplica ? 'replica' : 'mock'}.json`);
  writeFileSync(ruta, `${texto}\n`);
  console.log(`humo_practica: ${ruta}`);
  console.log(`humo_practica: sha256 ${sha256De(texto)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => { console.error('humo_practica: falló', e); process.exit(1); });
}
