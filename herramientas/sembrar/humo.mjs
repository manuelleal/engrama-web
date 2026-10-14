#!/usr/bin/env node
// @ts-check
// sembrar/humo.mjs · Humo del sembrador (docs/ESPEC_sembrador_refuerzo.md §3). Arma, SIN mandar (ni red ni contenedores), los cuerpos de
// POST /challenges/ que el sembrador mandaría y escribe `salida/humo_sembrar.<semilla>.json` (JSON canónico + su sha256):
//   - real: las 20 unidades A1 y A2 de contenido/ (solo lectura), con un grupo sintético sacado de la semilla; se compara con la predicción
//     de la espec, hecha leyendo contenido/ sin el mapeo;
//   - sintético: unidades inventadas por sembrar/sinteticos.mjs con la misma semilla; se compara con la cuenta que el generador hizo solo.
// Sale con código 1 si algo no cuadra (un error de la revisión, una gemela o un repaso en el feed, un reto que mezcla roles, un nodo que no
// está en el catálogo, o lo medido distinto de lo esperado). Humo: --semilla 20261014. Réplica: --semilla 7.
// Uso: node herramientas/sembrar/humo.mjs [--semilla N] [--curriculo <dir>] [--contenido <dir>]
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { armarCuerpos } from '../sembrar_retos.mjs';
import { nodosPorFamilia, nodosVigentes } from './curriculo.mjs';
import { revisarCuerpos } from './revision.mjs';
import { generador, generarSinteticos, uuidDe } from './sinteticos.mjs';
import { jsonCanonico, sha256De } from '../humo/canon.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const INGLES = resolve(RAIZ, '..', '..');
export const SEMILLA_HUMO = 20261014;
export const SEMILLA_REPLICA = 7;
// La predicción de la espec (§3), contada leyendo contenido/ en `bb6a571` SIN el mapeo. Si el banco cambia, se actualiza aquí y se declara.
export const PREDICCION = {
  A1: { unidades: 10, retos: 80, en_feed: 40, solo_refuerzo: 40, solo_gemela: 20, preguntas: 179, sin_explicacion: 0, errores: 0 },
  A2: { unidades: 10, retos: 80, en_feed: 40, solo_refuerzo: 40, solo_gemela: 20, preguntas: 180, sin_explicacion: 0, errores: 0 },
};
const ROLES_REFUERZO = ['gemela', 'repaso'];

/** Lo que se mide de un conjunto de cuerpos, directo de los cuerpos (no de la revisión), más lo que dice la revisión. */
function contar(cuerpos, vigentes) {
  const preguntas = cuerpos.flatMap((c) => c.questions);
  const roles = (c) => new Set(c.questions.map((q) => q.rol).filter(Boolean));
  const enFeed = cuerpos.filter((c) => c.solo_refuerzo !== true);
  const revision = revisarCuerpos(cuerpos, { vigentes });
  return {
    retos: cuerpos.length, en_feed: enFeed.length, solo_refuerzo: cuerpos.filter((c) => c.solo_refuerzo === true).length,
    solo_gemela: cuerpos.filter((c) => c.questions.every((q) => q.rol === 'gemela')).length,
    preguntas: preguntas.length, preguntas_lectura: cuerpos.filter((c) => c.skill === 'reading').reduce((n, c) => n + c.questions.length, 0),
    sin_explicacion: preguntas.filter((q) => !q.explanation).length,
    sin_nodos: preguntas.filter((q) => q.rol && !(q.nodos?.length)).length,
    piensalo_sin_marcas: preguntas.filter((q) => q.rol && !(q.item_ref && q.familia)).length,
    nodos_fuera_del_catalogo: preguntas.flatMap((q) => q.nodos || []).filter((n) => !vigentes.has(n)).length,
    gemela_o_repaso_en_feed: enFeed.filter((c) => c.questions.some((q) => ROLES_REFUERZO.includes(q.rol))).length,
    retos_que_mezclan_roles: cuerpos.filter((c) => roles(c).size > 1).length,
    monedas_del_feed: enFeed.reduce((n, c) => n + c.coins_reward, 0),
    errores: revision.errores.length, faltas: revision.faltas.length,
  };
}

/** Los cuerpos y la cuenta de un nivel. */
function medirNivel(unidades, { nodos, vigentes, grupo }) {
  const cuerpos = unidades.flatMap((u) => armarCuerpos(u, { groupId: grupo, borrador: false, nodosPorFamilia: nodos }).map((c) => c.cuerpo));
  return { cuenta: { unidades: unidades.length, ...contar(cuerpos, vigentes) }, cuerpos };
}

/** Las diferencias entre lo esperado y lo medido (solo las claves de lo esperado), más las reglas que nunca se rompen. */
function diferencias(nombre, esperado, medido) {
  const motivos = Object.entries(esperado).filter(([k, v]) => medido[k] !== v).map(([k, v]) => `${nombre}.${k}: esperado ${v}, medido ${medido[k]}`);
  for (const k of ['errores', 'gemela_o_repaso_en_feed', 'retos_que_mezclan_roles', 'nodos_fuera_del_catalogo', 'piensalo_sin_marcas']) {
    if (medido[k] !== 0) motivos.push(`${nombre}.${k}: ${medido[k]} (debe ser 0)`);
  }
  return [...new Set(motivos)];
}

const leerJson = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const unidadesDe = (dir) => readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => leerJson(join(dir, f)));

/** Lo real (contenido/) de A1 y A2. */
function medirReal({ contenido, nodos, vigentes, grupo }) {
  const real = {}; const cuerpos = {}; const motivos = [];
  for (const nivel of ['A1', 'A2']) {
    const m = medirNivel(unidadesDe(join(contenido, nivel.toLowerCase())), { nodos, vigentes, grupo });
    real[nivel] = m.cuenta; cuerpos[nivel] = m.cuerpos;
    motivos.push(...diferencias(`real.${nivel}`, PREDICCION[nivel], m.cuenta));
  }
  return { real, cuerpos, motivos };
}

/** Lo sintético de la semilla, contra la cuenta del generador. */
function medirSintetico(semilla, { catalogo, vigentes, grupo }) {
  const porNivel = (nivel) => catalogo.nodos.filter((n) => n.nivel === nivel).map((n) => n.id);
  const s = generarSinteticos(semilla, { A1: porNivel('A1'), A2: porNivel('A2') });
  const nodos = nodosPorFamilia(s.etiquetas);
  const sintetico = {}; const motivos = [];
  for (const nivel of ['A1', 'A2']) {
    const { cuenta } = medirNivel(s.unidades[nivel], { nodos, vigentes, grupo });
    sintetico[nivel] = { esperado: s.esperado[nivel], medido: cuenta };
    motivos.push(...diferencias(`sintetico.${nivel}`, s.esperado[nivel], cuenta));
  }
  return { sintetico, motivos };
}

/**
 * El humo completo, sin escribir nada. @param {number} semilla
 * @param {{curriculo?: string, contenido?: string}} [rutas]
 */
export function correrHumo(semilla, { curriculo = join(INGLES, 'curriculo'), contenido = join(INGLES, 'contenido') } = {}) {
  const catalogo = leerJson(join(curriculo, 'nodos.json'));
  const vigentes = nodosVigentes(catalogo);
  const grupo = uuidDe(generador(semilla));
  const nodos = nodosPorFamilia(leerJson(join(curriculo, 'etiquetas_unidades.json')));
  const r = medirReal({ contenido, nodos, vigentes, grupo });
  const s = medirSintetico(semilla, { catalogo, vigentes, grupo });
  const motivos = [...r.motivos, ...s.motivos];
  const cuerpo = { semilla, grupo, real: r.real, sintetico: s.sintetico, veredicto: { ok: motivos.length === 0, motivos }, cuerpos: r.cuerpos };
  return { ...cuerpo, sha256: sha256De(jsonCanonico(cuerpo)) };
}

function leerArgs(argv) {
  const valor = (bandera) => { const i = argv.indexOf(bandera); return i >= 0 ? argv[i + 1] : undefined; };
  const semilla = Number(valor('--semilla') ?? SEMILLA_HUMO);
  if (!Number.isInteger(semilla)) throw new Error('humo_sembrar: --semilla debe ser un entero');
  return { semilla, rutas: { ...(valor('--curriculo') ? { curriculo: valor('--curriculo') } : {}), ...(valor('--contenido') ? { contenido: valor('--contenido') } : {}) } };
}

function main() {
  const { semilla, rutas } = leerArgs(process.argv.slice(2));
  const humo = correrHumo(semilla, rutas);
  const ruta = join(RAIZ, 'salida', `humo_sembrar.${semilla}.json`);
  mkdirSync(join(RAIZ, 'salida'), { recursive: true });
  writeFileSync(ruta, `${jsonCanonico(humo)}\n`);
  for (const nivel of ['A1', 'A2']) console.log(`humo_sembrar ${nivel} real: ${jsonCanonico(humo.real[nivel])}`);
  for (const nivel of ['A1', 'A2']) console.log(`humo_sembrar ${nivel} sintético: ${jsonCanonico(humo.sintetico[nivel])}`);
  for (const m of humo.veredicto.motivos) console.error(`humo_sembrar: ${m}`);
  console.log(`humo_sembrar: semilla ${semilla}, ${humo.veredicto.ok ? 'OK' : 'FALLA'}, sha256 ${humo.sha256} -> ${ruta}`);
  process.exit(humo.veredicto.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
