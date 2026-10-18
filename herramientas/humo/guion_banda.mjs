// @ts-check
// humo/guion_banda.mjs · Tanda visual 3 (adenda de docs/ESPEC_visual_reto_tanda2.md): el guion que recorre el reto pregunta por pregunta en el navegador de verdad
// y mide la geometría tras cada "Comprobar" (con herramientas/humo/medir_banda.mjs). Lo comparten el E2E (tests/e2e/practica_banda.test.mjs) y las capturas
// (herramientas/capturas_banda.mjs). Los retos son los sintéticos de entradas_practica.mjs (nunca estudiantes reales).
//   - cada escenario elige a propósito la opción que FALLA (la banda más larga: lleva "por qué no la tuya") y, donde se puede, una que deja la marcada
//     y la correcta NO contiguas (hay que ver las tres opciones a la vez).
import { abrirSesion } from '../cdp.mjs';
import { MEDIR_BANDA } from './medir_banda.mjs';
import { sembrarRetoLectura, sembrarRetosPractica } from './entradas_practica.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from '../mock/estado.mjs';
import { crearChallenge } from '../mock/rutas_challenges.mjs';

export const esperar = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
export const VENTANAS = [{ ancho: 375, alto: 667 }, { ancho: 1280, alto: 800 }];

/** prefers-reduced-motion simulado por JS (lo que lee ui/movimiento.js): mismo truco que los demás E2E. */
export const REDUCIDO = "const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/prefers-reduced-motion/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q));";
/** Anota cada desplazamiento que pide la app (con su `behavior`), para probar que respeta el movimiento reducido. */
export const ESPIA_DE_DESPLAZAMIENTO = `window.__desplazos = [];
for (const [objeto, nombre] of [[window, 'scrollTo'], [window, 'scrollBy'], [Element.prototype, 'scrollIntoView'], [Element.prototype, 'scrollTo'], [Element.prototype, 'scrollBy']]) {
  const original = objeto[nombre];
  objeto[nombre] = function (...args) { window.__desplazos.push({ nombre, args: JSON.stringify(args[0] ?? null) }); return original.apply(this, args); };
}`;

/**
 * Los escenarios: cómo se llama, qué reto abre y qué responde en cada pregunta (las labels, una por pregunta, en el orden en que las sirve el doble).
 */
export const ESCENARIOS = [
  { nombre: 'lectura', reto: 'lectura', elegir: ['V', 'F', 'V', 'F'] },
  { nombre: 'gramB1', reto: 'Trabajo · Gramática 1', elegir: ['A', 'C'] },
  { nombre: 'gramA2', reto: 'Rutina diaria · Gramática 1', elegir: ['A', 'C', 'B'] },
  { nombre: 'vocabA2', reto: 'Rutina diaria · Vocabulario 1', elegir: ['B', 'C'] },
];
/** Aparte: una explicación MUY larga (la banda llega a su tope de 78 vh y se desplaza por dentro) con la correcta y la tuya al final de las opciones. */
export const ESCENARIO_LARGO = { nombre: 'larga', reto: 'larga', elegir: ['C'] };

const PARRAFO = 'Use the present perfect with since or for when something started in the past and continues now, and keep the verb form have plus the past participle. '
  + 'It is not the same as the simple past, which closes the action in a finished time, and it is not the continuous, which stresses the activity itself. ';
/** El reto de la explicación larga: B1, tres opciones, la correcta A y la elegida C, con la regla, el porqué y el ejemplo muy largos (datos inventados). */
export function sembrarRetoBandaLarga(/** @type {any} */ estado, /** @type {string} */ grupoId) {
  const pregunta = { question_text: 'I ___ here since 2020.', correct_answer: 'A', options_json: [{ label: 'A', value: 'have worked' }, { label: 'B', value: 'work' }, { label: 'C', value: 'am working' }],
    explanation: { regla: PARRAFO.repeat(2), por_opcion: { B: PARRAFO, C: PARRAFO.repeat(2) }, ejemplo: 'She has lived in Bogotá for ten years, and she still lives there today.' } };
  return crearChallenge(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, {
    title: 'Banda larga · Gramática 1', description: 'Reto de la banda larga (datos sintéticos)', group_id: grupoId, cefr_level: 'B1', topic: 'sint-b1-u09', skill: 'grammar', coins_reward: 10, xp_reward: 3, questions: [pregunta],
  }).cuerpo;
}

/** Espera a que la pantalla se asiente: el desplazamiento suave termina cuando `scrollY` no cambia durante 250 ms. */
export async function esperarAsentado(sesion, limiteMs = 4000) {
  const fin = Date.now() + limiteMs;
  let anterior = -1; let desde = Date.now();
  while (Date.now() < fin) {
    const y = await sesion.evaluar('Math.round(scrollY)');
    if (y !== anterior) { anterior = y; desde = Date.now(); } else if (Date.now() - desde >= 250) return;
    await esperar(60);
  }
}

/** Toca un testid en cuanto aparece (hasta 6 s). @returns {Promise<boolean>} */
export const tocar = (sesion, testid) => sesion.evaluar(`(async () => {
  for (let i = 0; i < 120 && !document.querySelector('[data-testid="${testid}"]'); i++) await new Promise((r) => setTimeout(r, 50));
  const n = document.querySelector('[data-testid="${testid}"]'); if (!n) return false; n.click(); return true;
})()`);

/**
 * Recorre un escenario en una ventana: tras cada Comprobar espera a que la pantalla se asiente, mide y llama `alMedir(paso, medida, sesion)` (para capturar o afirmar).
 * @param {{ancho: number, alto: number}} ventana
 * @param {{nombre: string, reto: string, elegir: string[]}} escenario
 * @param {(paso: {indice: number, escenario: string, ancho: number, alto: number}, medida: any, sesion: any) => Promise<void>} alMedir
 * @param {{reducido?: boolean, conAppCompleta: Function}} o
 */
export async function recorrerEscenario(ventana, escenario, alMedir, { reducido = false, conAppCompleta }) {
  await conAppCompleta(async (/** @type {string} */ url, /** @type {any} */ estado) => {
    const grupo = [...estado.groups.values()][0].id;
    const reto = escenario.reto === 'lectura' ? sembrarRetoLectura(estado, grupo)
      : escenario.reto === 'larga' ? sembrarRetoBandaLarga(estado, grupo) : sembrarRetosPractica(estado, grupo).find((r) => r.title === escenario.reto);
    if (!reto) throw new Error(`guion_banda: no hay reto ${escenario.reto}`);
    const sesion = await abrirSesion(ventana);
    try {
      await sesion.enviar('Page.addScriptToEvaluateOnNewDocument', { source: `${reducido ? REDUCIDO : ''}\n${ESPIA_DE_DESPLAZAMIENTO}` });
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await sesion.navegar(`${url}#/retos/${reto.id}`);
      await sesion.recargar();
      if (!(await tocar(sesion, 'enunciado'))) throw new Error('guion_banda: no apareció el enunciado');
      await esperar(900); // la entrada de la pregunta
      let scrollAlEntrar = null;
      for (let i = 0; i < escenario.elegir.length; i++) {
        await tocar(sesion, `opcion-${escenario.elegir[i]}`); await esperar(250);
        await tocar(sesion, 'boton-comprobar');
        if (!(await tocar(sesion, 'explicacion-veredicto'))) throw new Error('guion_banda: no apareció la banda');
        await esperarAsentado(sesion);
        const medida = await sesion.evaluar(MEDIR_BANDA);
        medida.scrollAlEntrar = scrollAlEntrar; // dónde abrió ESTA pregunta (null en la primera)
        medida.desplazos = await sesion.evaluar('window.__desplazos.splice(0)'); // lo que pidió la app: scrollBy con su behavior
        await alMedir({ indice: i, escenario: escenario.nombre, ancho: ventana.ancho, alto: ventana.alto }, medida, sesion);
        if (i < escenario.elegir.length - 1) { await tocar(sesion, 'boton-siguiente'); await esperar(900); scrollAlEntrar = await sesion.evaluar('Math.round(scrollY)'); }
      }
    } finally { await sesion.cerrar(); }
  });
}
