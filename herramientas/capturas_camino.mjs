#!/usr/bin/env node
// @ts-check
// capturas_camino.mjs · Las pantallas de docs/ESPEC_camino_y_tu_palabra.md §4 contra el doble, a 375 × 812 y a 1280 × 800, para MIRARLAS: Inicio,
// `#/camino` (con una unidad dominada, una completada, la recomendada en curso, dos bloqueadas, y otra variante con una abierta con apoyo) y la
// pregunta "Escríbela" (vacía, escrita, acertada y fallada). Datos: el reto Escríbela que arma el sembrador con la unidad real a1-u01 (fixture
// congelada) y un camino SINTÉTICO (el doble no calcula estados). `--raiz <carpeta>` sirve OTRA copia de la web con su propio doble (p. ej. la de
// `d9dbf85`, para el "antes"): ahí solo hay Inicio y la pregunta.
// Uso: node herramientas/capturas_camino.mjs <carpeta> [--raiz <carpeta de la web>] [--prefijo antes|despues]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { armarCuerpos } from './sembrar_retos.mjs';

const AQUI = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const VENTANAS = [{ ancho: 375, alto: 812 }, { ancho: 1280, alto: 800 }];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const CARPETA = resolve(args.find((a, i) => !a.startsWith('--') && !['--raiz', '--prefijo'].includes(args[i - 1])) || join(AQUI, 'salida', 'camino'));
const RAIZ = resolve(opcion('--raiz', AQUI));
const PREFIJO = opcion('--prefijo', 'despues');
const mod = (/** @type {string} */ r) => import(pathToFileURL(join(RAIZ, r)).href);

const unidad = (n, titulo, campos) => ({ topic: `a1-u0${n}`, numero: n, titulo, estado: 'sin_empezar', acceso: 'bloqueada', recomendada: false, atascada: false,
  estaciones_total: 6, estaciones_jugadas: 0, preguntas: 14, aciertos: 0, porcentaje: null, empezada_en: null, completada_en: null, se_abre_el: null,
  siguiente_reto: null, estaciones: [], ...campos });
function caminoSintetico(retoId, conApoyo) {
  return { nivel: 'A1', nivel_de_practica: 'A1', con_nivel_de_set: true, prestado: false, umbral_completada: 70, umbral_dominada: 80, dias_atasco: 7,
    recomendada: conApoyo ? 'a1-u04' : 'a1-u03', unidades: [
      unidad(1, 'This Is My Family', { estado: 'dominada', acceso: 'abierta', estaciones_jugadas: 6, aciertos: 13, porcentaje: 93 }),
      unidad(2, 'My School', { estado: 'completada', acceso: 'abierta', estaciones_jugadas: 6, aciertos: 11, porcentaje: 79, siguiente_reto: retoId }),
      unidad(3, 'My Daily Routine', { estado: 'en_curso', acceso: 'abierta', recomendada: !conApoyo, atascada: conApoyo, estaciones_jugadas: 2, aciertos: 4, porcentaje: 80, siguiente_reto: retoId, se_abre_el: null }),
      unidad(4, 'Food I Like', conApoyo ? { acceso: 'abierta_con_apoyo', recomendada: true, siguiente_reto: retoId } : { se_abre_el: '2026-10-28T15:00:00+00:00' }),
      unidad(5, 'My Town'), unidad(6, 'Free Time'),
    ] };
}

/** Toca un testid en cuanto aparece (hasta 4 s). */
const tocar = (sesion, testid) => sesion.evaluar(`(async () => {
  for (let i = 0; i < 80 && !document.querySelector('[data-testid="${testid}"]'); i++) await new Promise((r) => setTimeout(r, 50));
  document.querySelector('[data-testid="${testid}"]')?.click();
})()`);
/** Escribe en el campo como lo haría el teclado (valor + evento input). */
const escribir = (sesion, texto) => sesion.evaluar(`(() => { const c = document.querySelector('[data-testid="campo-escrito"]'); if (!c) return;
  c.focus(); c.value = ${JSON.stringify(texto)}; c.dispatchEvent(new Event('input', { bubbles: true })); })()`);

async function serie(ventana, hechas) {
  const { conAppCompleta } = await mod('tests/e2e/ayudante_servidor.mjs');
  const { abrirSesion } = await mod('herramientas/cdp.mjs');
  const { crearChallenge } = await mod('herramientas/mock/rutas_challenges.mjs');
  const { DOCENTE_BOOTSTRAP_TOKEN } = await mod('herramientas/mock/estado.mjs');
  await conAppCompleta(async (/** @type {string} */ url, /** @type {any} */ estado) => {
    const grupo = [...estado.groups.values()][0].id;
    const unidadA1 = JSON.parse(readFileSync(join(AQUI, 'tests', 'fixtures', 'sembrar', 'a1-u01-my-family.json'), 'utf8'));
    const escribela = armarCuerpos(unidadA1, { groupId: grupo, borrador: false }).find((c) => c.tipo === 'escrita' && c.rol === 'original').cuerpo;
    const { cuerpo: reto } = crearChallenge(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, escribela);
    estado.camino = caminoSintetico(reto.id, false);
    const sesion = await abrirSesion(ventana);
    const foto = async (/** @type {string} */ nombre) => {
      const archivo = `${PREFIJO}-${nombre}-${ventana.ancho}.png`;
      writeFileSync(join(CARPETA, archivo), await sesion.capturar());
      hechas.push(archivo);
    };
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await sesion.navegar(`${url}#/inicio`); await sesion.recargar(); await esperar(1800);
      await foto('01-inicio');
      if (PREFIJO !== 'antes') {
        await sesion.navegar(`${url}#/camino`); await esperar(1500);
        await foto('02-camino');
        estado.camino = caminoSintetico(reto.id, true);
        await sesion.navegar(`${url}#/inicio`); await sesion.navegar(`${url}#/camino`); await esperar(1500);
        await foto('03-camino-abierta-con-apoyo');
      }
      await sesion.navegar(`${url}#/retos/${reto.id}`); await esperar(1500);
      await foto('04-escribela-vacia');
      if (PREFIJO !== 'antes') {
        await escribir(sesion, 'Her'); await esperar(300);
        await foto('05-escribela-escrita');
        await tocar(sesion, 'boton-comprobar'); await esperar(1000);
        await foto('06-escribela-acertada');
        await tocar(sesion, 'boton-siguiente'); await esperar(700);
        await escribir(sesion, 'famly'); await esperar(200);
        await tocar(sesion, 'boton-comprobar'); await esperar(1000);
        await foto('07-escribela-fallada');
      }
    } finally { await sesion.cerrar(); }
  });
}

async function main() {
  mkdirSync(CARPETA, { recursive: true });
  /** @type {string[]} */
  const hechas = [];
  for (const ventana of VENTANAS) await serie(ventana, hechas);
  writeFileSync(join(CARPETA, `indice-${PREFIJO}.json`), `${JSON.stringify(hechas, null, 2)}\n`);
  console.log(`capturas_camino: ${hechas.length} capturas (${PREFIJO}, web de ${RAIZ}) en ${CARPETA}`);
}

main().catch((e) => { console.error('capturas_camino: falló', e); process.exit(1); });
