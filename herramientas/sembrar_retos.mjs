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
//   ENGRAMA_TOKEN_PROFE=<token> node herramientas/sembrar_retos.mjs <ruta_unidad.json> --grupo <gid> [--borrador]
//   ENGRAMA_API_URL (por defecto http://127.0.0.1:8090, el puerto de mock_api.mjs)
//
// Salida: código 0 y `salida/retos_sembrados.json`; código 2 si la unidad no está firmada y no
// aplica --borrador (o la API no es local); código 1 si la API rechaza una petición.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bloquesDePiensalo, retosDeLectura, verificarFirma, esApiLocal, challengeCreate,
} from './sembrar/mapeo.mjs';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = resolve(AQUI, '..');

function leerArgv(argv) {
  const posicionales = [];
  let grupo = null; let borrador = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--grupo') { grupo = argv[++i]; continue; }
    if (argv[i] === '--borrador') { borrador = true; continue; }
    posicionales.push(argv[i]);
  }
  return { rutaUnidad: posicionales[0], grupo, borrador };
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

/** D4: `max_winners` = tamaño del grupo. T1 (`/teachers/groups`) trae `student_count`. */
async function tamanoDelGrupo(apiUrl, token, grupoId) {
  const grupos = await pedirApi(apiUrl, '/teachers/groups', { token });
  const grupo = grupos.find((g) => g.id === grupoId);
  if (!grupo) throw new Error(`el grupo "${grupoId}" no aparece en /teachers/groups de este token`);
  return grupo.student_count;
}

/** Arma los cuerpos ChallengeCreate de una unidad ya autorizada (firma verificada aparte). */
export function armarCuerpos(unidad, { groupId, maxWinners, borrador }) {
  const ctx = { groupId, maxWinners, borrador };
  const bloques = bloquesDePiensalo(unidad).map((b) => ({ tipo: 'accuracy', ...b, cuerpo: challengeCreate(unidad, b, ctx) }));
  const lecturas = retosDeLectura(unidad).map((r) => ({ tipo: 'reading', ...r, cuerpo: challengeCreate(unidad, { ...r, destreza: 'reading' }, ctx) }));
  return [...bloques, ...lecturas];
}

async function sembrar({ unidad, apiUrl, token, grupoId, borrador }) {
  const veredicto = verificarFirma(unidad, { borrador, apiEsLocal: esApiLocal(apiUrl) });
  if (!veredicto.ok) { console.error(`sembrar_retos: ${veredicto.motivo}`); return { codigo: 2 }; }

  const maxWinners = await tamanoDelGrupo(apiUrl, token, grupoId);
  const cuerpos = armarCuerpos(unidad, { groupId: grupoId, maxWinners, borrador: veredicto.borrador });

  const creados = [];
  for (const item of cuerpos) {
    const challenge = await pedirApi(apiUrl, '/challenges/', { metodo: 'POST', token, cuerpo: item.cuerpo });
    creados.push({ tipo: item.tipo, destreza: item.destreza, rol: item.rol ?? null, titulo: item.cuerpo.title, challenge_id: challenge.id });
  }

  const salida = { unidad: unidad.id, grupo: grupoId, borrador: veredicto.borrador, retos: creados };
  const rutaSalida = join(RAIZ, 'salida', 'retos_sembrados.json');
  mkdirSync(join(RAIZ, 'salida'), { recursive: true });
  writeFileSync(rutaSalida, JSON.stringify(salida, null, 2));
  console.log(`sembrar_retos: ${creados.length} reto(s) sembrado(s) en el grupo ${grupoId} -> ${rutaSalida}`);
  return { codigo: 0, salida };
}

async function main() {
  const { rutaUnidad, grupo, borrador } = leerArgv(process.argv.slice(2));
  if (!rutaUnidad || !grupo) {
    console.error('uso: node herramientas/sembrar_retos.mjs <ruta_unidad.json> --grupo <gid> [--borrador]');
    process.exit(2);
  }
  const token = process.env.ENGRAMA_TOKEN_PROFE;
  if (!token) { console.error('sembrar_retos: falta ENGRAMA_TOKEN_PROFE'); process.exit(2); }
  const apiUrl = process.env.ENGRAMA_API_URL || 'http://127.0.0.1:8090';
  const unidad = leerUnidad(rutaUnidad);
  try {
    const { codigo } = await sembrar({ unidad, apiUrl, token, grupoId: grupo, borrador });
    process.exit(codigo);
  } catch (e) {
    console.error('sembrar_retos: falló contra la API', e.message);
    process.exit(1);
  }
}

export { sembrar };

const esCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCLI) main();
