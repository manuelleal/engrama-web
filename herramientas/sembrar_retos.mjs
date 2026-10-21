#!/usr/bin/env node
// @ts-check
// sembrar_retos.mjs · Script de OPERADOR (ESPEC_mvp_uis.md §8, W14): lee una unidad de
// `contenido/`, arma sus `ChallengeCreate` (herramientas/sembrar/mapeo.mjs) y los publica con
// `POST /challenges/` en el grupo indicado. Pasa por la API (decisión 005); nunca toca la base.
// El catálogo con claves NUNCA se sirve como archivo estático: escribe en `salida/`, fuera de
// `publico/` (§8 y R2 — X2b prueba que, si alguien lo hiciera mal, V1/herramientas/verificar.mjs
// lo detecta).
//
// Uso:
//   ENGRAMA_TOKEN_PROFE=<token> node herramientas/sembrar_retos.mjs <ruta_unidad.json> --grupo <gid> [--borrador] [--curriculo <dir>]
//   ENGRAMA_API_URL (por defecto http://127.0.0.1:8090, el puerto de mock_api.mjs)
//   --curriculo: la carpeta con etiquetas_unidades.json y nodos.json (por defecto, curriculo/ de la raíz INGLES). Sin ella no se siembra:
//   los nodos de cada pregunta salen de ahí (ESPEC_sembrador_refuerzo §1.1).
//
// Salida: código 0 y `salida/retos_sembrados.json`; código 2 si la unidad no está firmada y no
// aplica --borrador (o la API no es local); código 1 si la API rechaza una petición.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bloquesDePiensalo, retosDeLectura, bloquesDeTuPalabra, verificarFirma, esApiLocal, challengeCreate,
} from './sembrar/mapeo.mjs';
import { nodosPorFamilia as leerNodosPorFamilia, nodosVigentes } from './sembrar/curriculo.mjs';
import { revisarCuerpos } from './sembrar/revision.mjs';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = resolve(AQUI, '..');
const CURRICULO_POR_DEFECTO = resolve(RAIZ, '..', '..', 'curriculo'); // INGLES/curriculo (engrama-web vive en INGLES/ENGRAMA/)

function leerArgv(argv) {
  const posicionales = [];
  let grupo = null; let borrador = false; let curriculo = CURRICULO_POR_DEFECTO;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--grupo') { grupo = argv[++i]; continue; }
    if (argv[i] === '--curriculo') { curriculo = argv[++i]; continue; }
    if (argv[i] === '--borrador') { borrador = true; continue; }
    posicionales.push(argv[i]);
  }
  return { rutaUnidad: posicionales[0], grupo, borrador, curriculo };
}

function leerUnidad(ruta) {
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

async function pedirApi(apiUrl, ruta, { metodo = 'GET', token, cuerpo } = {}) {
  const resp = await fetch(`${apiUrl}${ruta}`, {
    method: metodo,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await resp.text();
  const json = texto ? JSON.parse(texto) : null;
  if (!resp.ok) throw new Error(`${metodo} ${ruta} -> ${resp.status}: ${texto}`);
  return json;
}

/** El grupo debe ser visible para el token (T1). El cupo (`max_winners`) ya no se manda: lo resuelve el servidor (W43). */
async function exigirGrupoVisible(apiUrl, token, grupoId) {
  const grupos = await pedirApi(apiUrl, '/teachers/groups', { token });
  if (!grupos.some((g) => g.id === grupoId)) throw new Error(`el grupo "${grupoId}" no aparece en /teachers/groups de este token`);
}

/** Arma los cuerpos ChallengeCreate de una unidad ya autorizada (firma verificada aparte). `nodosPorFamilia` sale de
 * curriculo/etiquetas_unidades.json (sembrar/curriculo.mjs); sin él, las preguntas van sin nodos. */
export function armarCuerpos(unidad, { groupId, borrador, nodosPorFamilia = {} }) {
  const ctx = { groupId, borrador };
  const bloques = bloquesDePiensalo(unidad, { nodosPorFamilia }).map((b) => ({ tipo: 'accuracy', ...b, cuerpo: challengeCreate(unidad, b, ctx) }));
  const lecturas = retosDeLectura(unidad).map((r) => ({ tipo: 'reading', ...r, cuerpo: challengeCreate(unidad, { ...r, destreza: 'reading' }, ctx) }));
  // W90 (docs/ESPEC_camino_y_tu_palabra.md §1): los retos Escríbela (`tu_palabra`) van AL FINAL: lo que ya se sembraba conserva su orden.
  const escritas = bloquesDeTuPalabra(unidad, { nodosPorFamilia }).filter((b) => !b.vacio).map((b) => ({ tipo: 'escrita', ...b, cuerpo: challengeCreate(unidad, b, ctx) }));
  return [...bloques, ...lecturas, ...escritas];
}

/** W90: los ítems `tu_palabra` que no caben en el contrato (no se recortan: quedan fuera y se dicen). Pura. */
export function excluidasDe(unidad) {
  return bloquesDeTuPalabra(unidad).flatMap((b) => b.excluidas);
}

/** ESPEC_sembrador_refuerzo §1.4: con un error en CUALQUIER cuerpo no se manda ninguno (código 2). `vigentes`: los ids del catálogo
 * (sin ellos no se miran los ids de los nodos). Las faltas no bloquean: van a la salida. */
async function sembrar({ unidad, apiUrl, token, grupoId, borrador, nodosPorFamilia = {}, vigentes }) {
  const veredicto = verificarFirma(unidad, { borrador, apiEsLocal: esApiLocal(apiUrl) });
  if (!veredicto.ok) { console.error(`sembrar_retos: ${veredicto.motivo}`); return { codigo: 2 }; }
  const cuerpos = armarCuerpos(unidad, { groupId: grupoId, borrador: veredicto.borrador, nodosPorFamilia });
  const revision = revisarCuerpos(cuerpos.map((c) => c.cuerpo), { vigentes });
  if (revision.errores.length) {
    for (const e of revision.errores) console.error(`sembrar_retos: ${e}`);
    return { codigo: 2, errores: revision.errores };
  }

  await exigirGrupoVisible(apiUrl, token, grupoId);

  const creados = [];
  for (const item of cuerpos) {
    const challenge = await pedirApi(apiUrl, '/challenges/', { metodo: 'POST', token, cuerpo: item.cuerpo });
    creados.push({
      tipo: item.tipo, destreza: item.destreza, rol: item.rol ?? null, titulo: item.cuerpo.title,
      solo_refuerzo: item.cuerpo.solo_refuerzo === true, challenge_id: challenge.id,
    });
  }

  const salida = { unidad: unidad.id, grupo: grupoId, borrador: veredicto.borrador, retos: creados, faltas: revision.faltas, excluidas: excluidasDe(unidad) };
  const rutaSalida = join(RAIZ, 'salida', 'retos_sembrados.json');
  mkdirSync(join(RAIZ, 'salida'), { recursive: true });
  writeFileSync(rutaSalida, JSON.stringify(salida, null, 2));
  console.log(`sembrar_retos: ${creados.length} reto(s) sembrado(s) en el grupo ${grupoId} -> ${rutaSalida}`);
  return { codigo: 0, salida };
}

/** Las etiquetas (nodos por familia) y el catálogo (ids vigentes) de `dir`; null (y el porqué en la consola) si falta alguno. */
function leerCurriculo(dir) {
  const rutas = { etiquetas: join(dir, 'etiquetas_unidades.json'), catalogo: join(dir, 'nodos.json') };
  const falta = Object.values(rutas).find((r) => !existsSync(r));
  if (falta) { console.error(`sembrar_retos: falta ${falta} (usa --curriculo <dir>)`); return null; }
  const leer = (r) => JSON.parse(readFileSync(r, 'utf8'));
  return { nodosPorFamilia: leerNodosPorFamilia(leer(rutas.etiquetas)), vigentes: nodosVigentes(leer(rutas.catalogo)) };
}

async function main() {
  const { rutaUnidad, grupo, borrador, curriculo } = leerArgv(process.argv.slice(2));
  if (!rutaUnidad || !grupo) {
    console.error('uso: node herramientas/sembrar_retos.mjs <ruta_unidad.json> --grupo <gid> [--borrador] [--curriculo <dir>]');
    process.exit(2);
  }
  const delCurriculo = leerCurriculo(curriculo);
  if (!delCurriculo) process.exit(2);
  const token = process.env.ENGRAMA_TOKEN_PROFE;
  if (!token) { console.error('sembrar_retos: falta ENGRAMA_TOKEN_PROFE'); process.exit(2); }
  const apiUrl = process.env.ENGRAMA_API_URL || 'http://127.0.0.1:8090';
  const unidad = leerUnidad(rutaUnidad);
  try {
    const { codigo } = await sembrar({ unidad, apiUrl, token, grupoId: grupo, borrador, ...delCurriculo });
    process.exit(codigo);
  } catch (e) {
    console.error('sembrar_retos: falló contra la API', e.message);
    process.exit(1);
  }
}

export { sembrar };

const esCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCLI) main();
