#!/usr/bin/env node
// @ts-check
// capturas_fluidez.mjs · Las pantallas del ciclo del estudiante que toca docs/ESPEC_visual_fluidez.md, contra el doble, a 375 × 812 y a 1280 × 800,
// para MIRARLAS antes y después: Inicio, `#/camino` (camino sintético: una dominada, una completada, la recomendada en curso y dos bloqueadas), el
// reto por pregunta (pregunta, elegida, fallo, acierto con la celebración en vuelo y quieta) y el fin del reto (con 2 de 3 y perfecto, en vuelo y
// final). `--reducido` emula `prefers-reduced-motion: reduce` y saca las mismas fotos SIN esperar a la animación: lo que se ve es el estado final.
// Nada toca el piloto ni un puerto fijo (el doble y el servidor van en puertos libres).
// Uso: node herramientas/capturas_fluidez.mjs <carpeta> [--reducido]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';
import { abrirSesion } from './cdp.mjs';
import { sembrarRetosPractica } from './humo/entradas_practica.mjs';

const AQUI = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const VENTANAS = [{ ancho: 375, alto: 812 }, { ancho: 1280, alto: 800 }];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const REDUCIDO = args.includes('--reducido');
const CARPETA = resolve(args.find((a) => !a.startsWith('--')) || join(AQUI, 'salida', 'fluidez'));

const unidad = (n, titulo, campos) => ({ topic: `a1-u0${n}`, numero: n, titulo, estado: 'sin_empezar', acceso: 'bloqueada', recomendada: false, atascada: false,
  estaciones_total: 6, estaciones_jugadas: 0, preguntas: 14, aciertos: 0, porcentaje: null, empezada_en: null, completada_en: null, se_abre_el: null,
  siguiente_reto: null, estaciones: [], ...campos });
/** Un camino SINTÉTICO (el doble no calcula estados): la recomendada lleva al primer reto de la práctica. @param {string} retoId */
const caminoSintetico = (retoId) => ({ nivel: 'A1', nivel_de_practica: 'A1', con_nivel_de_set: true, prestado: false, umbral_completada: 70, umbral_dominada: 80,
  dias_atasco: 7, recomendada: 'a1-u03', unidades: [
    unidad(1, 'This Is My Family', { estado: 'dominada', acceso: 'abierta', estaciones_jugadas: 6, aciertos: 13, porcentaje: 93 }),
    unidad(2, 'My School', { estado: 'completada', acceso: 'abierta', estaciones_jugadas: 6, aciertos: 11, porcentaje: 79, siguiente_reto: retoId }),
    unidad(3, 'My Daily Routine', { estado: 'en_curso', acceso: 'abierta', recomendada: true, estaciones_jugadas: 2, aciertos: 4, porcentaje: 80, siguiente_reto: retoId }),
    unidad(4, 'Food I Like', { se_abre_el: '2026-10-28T15:00:00+00:00' }),
    unidad(5, 'My Town'), unidad(6, 'Free Time'),
  ] });

/** Toca un testid en cuanto aparece (hasta 4 s). */
const tocar = (sesion, testid) => sesion.evaluar(`(async () => {
  for (let i = 0; i < 80 && !document.querySelector('[data-testid="${testid}"]'); i++) await new Promise((r) => setTimeout(r, 50));
  document.querySelector('[data-testid="${testid}"]')?.click();
})()`);
/** Con movimiento reducido no se espera a nada: la foto tiene que salir ya completa. */
const pausa = (ms) => esperar(REDUCIDO ? Math.min(ms, 250) : ms);

/** Elige y comprueba; con `vuelo` saca también la foto a mitad de la celebración. */
async function responder(sesion, foto, label, nombre, vuelo = false) {
  await tocar(sesion, `opcion-${label}`); await pausa(250);
  await tocar(sesion, 'boton-comprobar');
  if (vuelo && !REDUCIDO) { await esperar(420); await foto(`${nombre}-en-vuelo`); }
  await pausa(1300);
  await foto(nombre);
}

/** El reto A2 con un fallo y dos aciertos (2 de 3) y el fin; luego el de tres aciertos (perfecto) y su fin. @param {any} c */
async function faseReto({ sesion, url, retos, foto }) {
  const g1 = retos.find((r) => r.title === 'Rutina diaria · Gramática 1');
  const g2 = retos.find((r) => r.title === 'Rutina diaria · Gramática 2');
  await sesion.navegar(`${url}#/retos/${g1.id}`); await pausa(1600);
  await foto('03-reto-pregunta');
  await tocar(sesion, 'opcion-A'); await pausa(600);
  await foto('04-reto-elegida');
  await tocar(sesion, 'boton-comprobar'); await pausa(1300);
  await foto('05-reto-fallo');
  await tocar(sesion, 'boton-siguiente'); await pausa(700);
  await responder(sesion, foto, 'B', '06-reto-acierto', true);
  await tocar(sesion, 'boton-siguiente'); await pausa(700);
  await responder(sesion, foto, 'A', '06b-reto-acierto-ultima');
  await tocar(sesion, 'boton-terminar');
  if (!REDUCIDO) { await esperar(1100); await foto('07-fin-en-vuelo'); }
  await pausa(4200);
  await foto('07-fin-2-de-3');
  await sesion.navegar(`${url}#/retos/${g2.id}`); await pausa(1600);
  for (const [i, label] of ['A', 'B', 'B'].entries()) {
    await responder(sesion, foto, label, `08-perfecto-p${i + 1}`);
    await tocar(sesion, i < 2 ? 'boton-siguiente' : 'boton-terminar'); await pausa(700);
  }
  if (!REDUCIDO) { await esperar(900); await foto('09-fin-perfecto-en-vuelo'); }
  await pausa(4500);
  await foto('09-fin-perfecto');
}

/** @param {{ancho: number, alto: number}} ventana @param {string[]} hechas */
async function serie(ventana, hechas) {
  await conAppCompleta(async (url, /** @type {any} */ estado) => {
    const retos = sembrarRetosPractica(estado, [...estado.groups.values()][0].id);
    estado.camino = caminoSintetico(retos[0].id);
    const sesion = await abrirSesion(ventana);
    if (REDUCIDO) await sesion.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const foto = async (/** @type {string} */ nombre) => {
      const archivo = `${nombre}-${ventana.ancho}.png`;
      writeFileSync(join(CARPETA, archivo), await sesion.capturar());
      hechas.push(archivo);
    };
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await sesion.navegar(`${url}#/inicio`); await sesion.recargar(); await pausa(2200);
      await foto('01-inicio');
      await sesion.navegar(`${url}#/camino`); await pausa(1800);
      await foto('02-camino');
      await faseReto({ sesion, url, retos, foto });
      await sesion.navegar(`${url}#/inicio`); await pausa(2200);
      await foto('10-inicio-despues');
      if (sesion.errores.length) console.warn(`capturas_fluidez: ${sesion.errores.length} errores de consola a ${ventana.ancho}:`, sesion.errores.slice(0, 5));
    } finally { await sesion.cerrar(); }
  });
}

async function main() {
  mkdirSync(CARPETA, { recursive: true });
  /** @type {string[]} */
  const hechas = [];
  for (const ventana of VENTANAS) await serie(ventana, hechas);
  writeFileSync(join(CARPETA, 'indice.json'), `${JSON.stringify({ reducido: REDUCIDO, capturas: hechas }, null, 2)}\n`);
  console.log(`capturas_fluidez: ${hechas.length} capturas${REDUCIDO ? ' (movimiento reducido)' : ''} en ${CARPETA}`);
}

main().catch((e) => { console.error('capturas_fluidez: falló', e); process.exit(1); });
