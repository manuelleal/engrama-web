#!/usr/bin/env node
// @ts-check
// capturas_titulos.mjs · La lista de Retos del estudiante con 40 retos sembrados como los del piloto (docs/ESPEC_titulos_unidad.md §4): diez unidades con sus
// cuatro retos (Lectura 2, Lectura 1, Vocabulario 1, Gramática 1, el orden en que el feed los entrega) con el título EXACTO que arma el sembrador
// (`tituloBloque`/`tituloLectura`, con el prefijo "[BORRADOR] " de los grupos de borrador) y, al final, un reto que el profe creó a mano. Capturas a
// 375 × 812 y 1280 × 800, arriba de la lista y más abajo (para ver que cada tramo dice de qué unidad es). Nada toca el piloto ni un puerto fijo.
// Uso: node herramientas/capturas_titulos.mjs [carpeta] [prefijo]   (por defecto: salida/titulos/ y "antes"; la rama nueva usa "despues")
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';
import { abrirSesion } from './cdp.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from './mock/estado.mjs';
import { crearChallenge } from './mock/rutas_challenges.mjs';
import { tituloBloque, tituloLectura } from './sembrar/mapeo.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const VENTANAS = [{ ancho: 375, alto: 812 }, { ancho: 1280, alto: 800 }];
const esperar = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

const UNIDADES = [
  ['a1-u10', "I Don't Feel Well"], ['a1-u11', 'At the Restaurant'], ['a1-u12', 'My Daily Routine'], ['a1-u13', 'Going Shopping'], ['a1-u14', 'Weekend Plans'],
  ['a1-u15', 'My Family'], ['a1-u16', 'Directions in the City'], ['a1-u17', 'What Are You Wearing?'], ['a1-u18', 'Weather and Seasons'], ['a1-u19', 'A Trip to the Beach'],
].map(([id, titulo]) => ({ id, titulo }));

/** Los títulos del feed: por unidad, Lectura 2, Lectura 1, Vocabulario 1 y Gramática 1; los de bloque con su rol, como los escribe el sembrador. */
export function titulosDelPiloto() {
  const titulos = [];
  for (const u of UNIDADES) {
    titulos.push(`[BORRADOR] ${tituloLectura(u, 2)}`, `[BORRADOR] ${tituloLectura(u, 1)}`);
    titulos.push(`[BORRADOR] ${tituloBloque(u, 'vocabulary', 1, 'original')}`, `[BORRADOR] ${tituloBloque(u, 'grammar', 1, 'original')}`);
  }
  return titulos;
}

const pregunta = { question_text: 'She ___ to school.', correct_answer: 'A', options_json: [{ label: 'A', value: 'goes' }, { label: 'B', value: 'go' }], explanation: { regla: 'Tercera persona: -s.' } };

/** @param {{ancho: number, alto: number}} ventana @param {string} carpeta @param {string} prefijo @param {string[]} hechas */
async function serie(ventana, carpeta, prefijo, hechas) {
  await conAppCompleta(async (url, estado) => {
    const grupoId = [...estado.groups.values()][0].id;
    const req = { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } };
    for (const title of [...titulosDelPiloto(), 'Reto de la semana (lo creó el profe)']) {
      crearChallenge(estado, req, { title, description: 'Sintético', group_id: grupoId, cefr_level: 'A1', topic: 'sint', skill: 'grammar', coins_reward: 10, xp_reward: 3, questions: [pregunta] });
    }
    const sesion = await abrirSesion(ventana);
    const foto = async (/** @type {string} */ nombre) => {
      const archivo = `${prefijo}-${nombre}-${ventana.ancho}.png`;
      writeFileSync(join(carpeta, archivo), await sesion.capturar());
      hechas.push(archivo);
    };
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await sesion.navegar(`${url}#/retos`); await sesion.recargar(); await esperar(1800);
      await foto('retos-arriba');
      await sesion.evaluar('window.scrollTo(0, 900)'); await esperar(400);
      await foto('retos-medio');
      await sesion.evaluar('window.scrollTo(0, document.body.scrollHeight)'); await esperar(400);
      await foto('retos-final');
    } finally { await sesion.cerrar(); }
  });
}

async function main() {
  const carpeta = resolve(process.argv[2] || join(RAIZ, 'salida', 'titulos'));
  const prefijo = process.argv[3] || 'antes';
  mkdirSync(carpeta, { recursive: true });
  /** @type {string[]} */
  const hechas = [];
  for (const ventana of VENTANAS) await serie(ventana, carpeta, prefijo, hechas);
  console.log(`capturas_titulos: ${hechas.length} capturas en ${carpeta}: ${hechas.join(', ')}`);
}

if (import.meta.url === new URL(process.argv[1], 'file:///').href || process.argv[1]?.endsWith('capturas_titulos.mjs')) {
  main().catch((e) => { console.error('capturas_titulos: falló', e); process.exit(1); });
}
