#!/usr/bin/env node
// @ts-check
// humo_camino.mjs · El humo de docs/ESPEC_camino_y_tu_palabra.md §4 (METODO regla 6): un caso chico de punta a punta que ESCRIBE su archivo,
// `salida/humo_camino.json`. Datos: la unidad a1-u01 congelada (tests/fixtures/sembrar/) y un camino sintético. Nada toca la red ni el piloto:
//   1. el sembrador arma los retos Escríbela y la revisión no encuentra errores;
//   2. el doble los crea y una pregunta se responde por /answers ("Her " acierta: el doble normaliza como el backend; la tolerancia de una letra es
//      del backend y aquí NO se mide);
//   3. el plan del camino sintético: recomendada, bloqueadas sin acción, oro solo en Dominada.
// Uso: node herramientas/humo_camino.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { armarCuerpos } from './sembrar_retos.mjs';
import { revisarCuerpos } from './sembrar/revision.mjs';
import { estadoConEstudiantesSembrados } from '../tests/e2e/ayudante_servidor.mjs';
import { crearChallenge } from './mock/rutas_challenges.mjs';
import { arrancarIntento } from './mock/rutas_intentos.mjs';
import { responderPregunta } from './mock/por_pregunta.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from './mock/estado.mjs';
import { planDeCamino } from '../src/ui/camino.js';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
export const RUTA_HUMO = join(RAIZ, 'salida', 'humo_camino.json');

const unidad = (n, campos) => ({ topic: `a1-u0${n}`, numero: n, titulo: `U${n}`, estado: 'sin_empezar', acceso: 'bloqueada', recomendada: false, atascada: false,
  estaciones_total: 4, estaciones_jugadas: 0, preguntas: 9, aciertos: 0, porcentaje: null, empezada_en: null, completada_en: null, se_abre_el: null,
  siguiente_reto: 'r', estaciones: [], ...campos });
const CAMINO = { nivel: 'A1', nivel_de_practica: 'A1', con_nivel_de_set: true, prestado: false, umbral_completada: 70, umbral_dominada: 80, dias_atasco: 7,
  recomendada: 'a1-u02', unidades: [unidad(1, { estado: 'dominada', acceso: 'abierta' }), unidad(2, { estado: 'en_curso', acceso: 'abierta', recomendada: true }),
    unidad(3, {}), unidad(4, { acceso: 'abierta_con_apoyo' })] };

export function correrHumo() {
  const u = JSON.parse(readFileSync(join(RAIZ, 'tests', 'fixtures', 'sembrar', 'a1-u01-my-family.json'), 'utf8'));
  const estado = estadoConEstudiantesSembrados();
  const grupo = [...estado.groups.values()][0].id;
  const escritas = armarCuerpos(u, { groupId: grupo, borrador: false }).filter((c) => c.tipo === 'escrita');
  const revision = revisarCuerpos(escritas.map((c) => c.cuerpo));
  const { cuerpo: reto } = crearChallenge(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, escritas[0].cuerpo);
  const est = { headers: { authorization: 'Bearer est-1' } };
  const { cuerpo: inicio } = arrancarIntento(estado, est, reto.id);
  const q = inicio.challenge.questions[0];
  const { cuerpo: r } = responderPregunta(estado, est, inicio.attempt_id, { question_id: q.id, answer: 'Her ' });
  const plan = planDeCamino(CAMINO);
  const salida = {
    sembrador: { retos: escritas.map((c) => [c.cuerpo.title, c.cuerpo.challenge_type, c.cuerpo.questions.length, c.cuerpo.solo_refuerzo === true]),
      errores: revision.errores.length },
    respuesta: { enviada: 'Her ', is_correct: r.is_correct, oracion: r.oracion_correcta, sin_opciones: q.options_json === null },
    camino: plan.estaciones.map((e) => [e.nombre, e.icono, e.texto, e.oro, e.recomendada, e.accion?.href ?? null]),
  };
  mkdirSync(join(RAIZ, 'salida'), { recursive: true });
  writeFileSync(RUTA_HUMO, `${JSON.stringify(salida, null, 2)}\n`);
  return salida;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const s = correrHumo();
  console.log(`humo_camino: ${s.sembrador.retos.length} retos Escríbela, ${s.sembrador.errores} errores, respuesta ${s.respuesta.is_correct ? 'correcta' : 'incorrecta'} -> ${RUTA_HUMO}`);
}
