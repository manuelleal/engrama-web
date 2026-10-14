#!/usr/bin/env node
// @ts-check
// capturas_practica.mjs · Las pantallas de la práctica del día (docs/ESPEC_practica_del_dia.md) contra el mock, a 375 × 812 y a 1280 × 800, para
// MIRARLAS: Inicio con "Tu práctica de hoy" (para empezar, a mitad, terminada, listo por hoy y con nivel de SET), el reto con su explicación
// (fallo y acierto; A2 en español y B1 en inglés) y la racha semanal. Cada ancho arranca con su mock recién sembrado
// (herramientas/humo/entradas_practica.mjs, en el grupo de `est-1`). Nada toca el piloto ni un puerto fijo.
// Uso: node herramientas/capturas_practica.mjs [carpeta]   (por defecto: salida/practica/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';
import { abrirSesion } from './cdp.mjs';
import { sembrarRetosPractica } from './humo/entradas_practica.mjs';
import { arrancarIntento } from './mock/rutas_intentos.mjs';
import { responderPregunta, terminarIntento } from './mock/por_pregunta.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const VENTANAS = [{ ancho: 375, alto: 812 }, { ancho: 1280, alto: 800 }];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Toca un testid en cuanto aparece (hasta 4 s). */
const tocar = (sesion, testid) => sesion.evaluar(`(async () => {
  for (let i = 0; i < 80 && !document.querySelector('[data-testid="${testid}"]'); i++) await new Promise((r) => setTimeout(r, 50));
  document.querySelector('[data-testid="${testid}"]').click();
})()`);

/** Elige y comprueba; la captura queda con la banda arriba de todo (su botón incluido). */
async function responder(sesion, label) {
  await tocar(sesion, `opcion-${label}`);
  await esperar(150);
  await tocar(sesion, 'boton-comprobar');
  await esperar(900);
}

/** El reto A2 (fallo y acierto, en español) y el B1 (fallo, en inglés). @param {any} c */
async function faseExplicacion({ sesion, url, retos, foto }) {
  const g1 = retos.find((r) => r.title === 'Rutina diaria · Gramática 1');
  const b1 = retos.find((r) => r.title === 'Trabajo · Gramática 1');
  await sesion.navegar(`${url}#/retos/${g1.id}`);
  await sesion.recargar();
  await esperar(1200);
  await tocar(sesion, 'opcion-A'); await esperar(500);
  await foto('l1-01-a2-elegida');
  await tocar(sesion, 'boton-comprobar'); await esperar(900);
  await foto('l1-02-a2-fallo-espanol');
  await tocar(sesion, 'boton-siguiente'); await esperar(600);
  await responder(sesion, 'B');
  await foto('l1-03-a2-acierto-espanol');
  await sesion.navegar(`${url}#/retos/${b1.id}`);
  await esperar(1200);
  await responder(sesion, 'A');
  await foto('l1-04-b1-fallo-ingles');
  await tocar(sesion, 'boton-siguiente'); await esperar(600);
  await responder(sesion, 'A');
  await foto('l1-05-b1-acierto-ingles');
}

const reqEst = { headers: { authorization: 'Bearer est-1' } };
/** Un reto jugado entero del lado del doble (como si la estudiante lo hubiera jugado en otra pestaña). */
function jugarEnElDoble(estado, retoId, labels) {
  const { cuerpo: inicio } = arrancarIntento(estado, reqEst, retoId);
  inicio.challenge.questions.forEach((q, i) => responderPregunta(estado, reqEst, inicio.attempt_id, { question_id: q.id, answer: labels[i] }));
  terminarIntento(estado, reqEst, inicio.attempt_id);
}

/** Inicio con "Tu práctica de hoy": para empezar, a mitad (paso 2), "listo por hoy" y con nivel de SET. @param {any} c */
async function faseInicio({ sesion, url, retos, foto, estado }) {
  const id = (/** @type {string} */ t) => retos.find((r) => r.title === t).id;
  await sesion.navegar(`${url}#/inicio`); await sesion.recargar(); await esperar(1800);
  await foto('inicio-01-practica-para-empezar');
  await tocar(sesion, 'jugar-reto-hoy'); await esperar(1500); // pide la tanda y va al primer reto
  jugarEnElDoble(estado, id('Rutina diaria · Gramática 1'), ['B', 'B', 'A']);
  await sesion.navegar(`${url}#/inicio`); await esperar(1800);
  await foto('inicio-02-practica-paso-2');
  jugarEnElDoble(estado, id('Rutina diaria · Gramática 2'), ['A', 'B', 'B']);
  await sesion.navegar(`${url}#/retos`); await sesion.navegar(`${url}#/inicio`); await esperar(1500);
  await foto('inicio-03-practica-terminada');
  await tocar(sesion, 'jugar-reto-hoy'); await esperar(1500); // la segunda tanda
  jugarEnElDoble(estado, id('Rutina diaria · Vocabulario 1'), ['A', 'A']);
  await sesion.navegar(`${url}#/inicio`); await esperar(1800);
  await foto('inicio-04-listo-por-hoy');
  estado.niveles.set(`${estado.tokens.get('est-1')}:${estado.tenantDemoId}`, { cefr: 'B1', source: 'set', provisional: false, assessed_at: '2026-10-01T00:00:00Z' });
  estado.tandas.length = 0; // otro día, con nivel de SET
  await sesion.navegar(`${url}#/retos`); await sesion.navegar(`${url}#/inicio`); await esperar(1800);
  await foto('inicio-05-con-nivel-de-set');
}

/** La racha semanal: dos semanas cumplidas por asistencia, el lunes y el martes de esta semana activos y hoy 3 respuestas. @param {any} c */
async function faseRacha({ sesion, url, retos, foto, estado }) {
  const miercoles = Date.parse('2026-10-14T15:00:00Z');
  estado.reloj.ahora = () => miercoles;
  estado.tandas.length = 0;
  const yo = estado.tokens.get('est-1');
  for (const f of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-12', '2026-10-13']) {
    estado.attendanceRecords.push({ id: `asis-${f}`, tenant_id: estado.tenantDemoId, session_id: 'sesion-sintetica', student_id: yo, attendance_date: f, coins_awarded: 10, geo_status: 'sin_ubicacion', created_at: `${f}T15:00:00.000Z` });
  }
  jugarEnElDoble(estado, retos.find((r) => r.title === 'Trabajo · Gramática 1').id, ['B', 'B']);
  await sesion.navegar(`${url}#/retos`); await sesion.navegar(`${url}#/inicio`); await esperar(1800);
  await foto('inicio-06-racha-semanal');
  await sesion.evaluar("document.querySelector('[data-testid=\"progreso-semana\"]').scrollIntoView({ block: 'center' })"); await esperar(400);
  await foto('inicio-07-racha-semanal-tarjeta');
}

/** @param {{ancho: number, alto: number}} ventana @param {string} carpeta @param {string[]} hechas */
async function serie(ventana, carpeta, hechas) {
  await conAppCompleta(async (url, estado) => {
    const retos = sembrarRetosPractica(estado, [...estado.groups.values()][0].id);
    const sesion = await abrirSesion(ventana);
    const foto = async (/** @type {string} */ nombre) => {
      const archivo = `${nombre}-${ventana.ancho}.png`;
      writeFileSync(join(carpeta, archivo), await sesion.capturar());
      hechas.push(archivo);
    };
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await faseInicio({ sesion, url, retos, foto, estado });
      await faseExplicacion({ sesion, url, retos, foto, estado });
      await faseRacha({ sesion, url, retos, foto, estado });
    } finally { await sesion.cerrar(); }
  });
}

async function main() {
  const carpeta = resolve(process.argv[2] || join(RAIZ, 'salida', 'practica'));
  mkdirSync(carpeta, { recursive: true });
  /** @type {string[]} */
  const hechas = [];
  for (const ventana of VENTANAS) await serie(ventana, carpeta, hechas);
  writeFileSync(join(carpeta, 'indice.json'), `${JSON.stringify(hechas, null, 2)}\n`);
  console.log(`capturas_practica: ${hechas.length} capturas en ${carpeta}`);
}

main().catch((e) => { console.error('capturas_practica: falló', e); process.exit(1); });
