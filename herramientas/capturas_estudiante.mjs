#!/usr/bin/env node
// @ts-check
// capturas_estudiante.mjs · TODAS las pantallas del estudiante contra el mock, a 375 × 812 (celular) y a 1280 × 800 (portátil), para MIRARLAS
// después de un cambio visual (método aligerado: capturas antes y después y la suite en verde). Cada ancho arranca con su propio mock recién
// sembrado (el mismo grupo, los mismos 5 estudiantes y los mismos 8 retos del humo), así las dos series muestran el mismo estado. Si una
// pantalla es más alta que la ventana, deja además su captura "-abajo" (desplazada hasta el final): lo que tapa la barra se ve ahí.
//
// Uso: node herramientas/capturas_estudiante.mjs [carpeta_de_salida]   (por defecto: salida/hoy/)
// Nada de esto toca el piloto ni un puerto fijo: el mock y el servidor de desarrollo escuchan en puertos libres de 127.0.0.1.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearServidor } from './servidor_dev.mjs';
import { crearMockApi } from './mock_api.mjs';
import { crearEstado, ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from './mock/estado.mjs';
import { crearChallenge } from './mock/rutas_challenges.mjs';
import { abrirSesion as abrirAsistencia } from './mock/rutas_teachers.mjs';
import { configurarRaizApi } from '../src/api/cliente.js';
import { pasoAdmin, pasoSembrar, pasoResolverRetos } from './humo/flujo.mjs';
import { abrirSesion } from './cdp.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const RUTA_UNIDAD = join(RAIZ, 'tests', 'fixtures', 'unidad_sintetica.json');
const VENTANAS = [{ ancho: 375, alto: 812 }, { ancho: 1280, alto: 800 }];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const reqDocente = () => ({ headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } });
const clic = (testid) => `document.querySelector('[data-testid="${testid}"]').click()`;

async function levantar() {
  const estado = crearEstado();
  const mock = crearMockApi(estado);
  await new Promise((ok) => mock.listen(0, '127.0.0.1', () => ok(null)));
  const apiUrl = `http://127.0.0.1:${/** @type {any} */ (mock.address()).port}`;
  process.env.ENGRAMA_API_URL = apiUrl;
  const dev = crearServidor();
  await new Promise((ok) => dev.listen(0, '127.0.0.1', () => ok(null)));
  const urlBase = `http://127.0.0.1:${/** @type {any} */ (dev.address()).port}/`;
  return { estado, apiUrl, urlBase, cerrar: async () => { await new Promise((ok) => dev.close(ok)); await new Promise((ok) => mock.close(ok)); } };
}

/** El grupo del humo; est-1 deja el primer reto sin jugar (lo juega en la captura) y resuelve los demás por la API. */
async function sembrar(apiUrl, urlBase) {
  configurarRaizApi(urlBase.replace(/\/$/, ''));
  const { grupoId, estudiantes } = await pasoAdmin(ADMIN_BOOTSTRAP_TOKEN);
  const retos = await pasoSembrar(JSON.parse(readFileSync(RUTA_UNIDAD, 'utf8')), grupoId, apiUrl, DOCENTE_BOOTSTRAP_TOKEN);
  await pasoResolverRetos([estudiantes[0]], retos.slice(3)); // est-1: tres pendientes y cinco jugados
  configurarRaizApi('');
  return { grupoId, retos };
}

function retoNuevo(estado, grupoId, titulo, correctas) {
  const pregunta = (texto, buena) => ({ question_text: texto, correct_answer: buena, options_json: [{ label: 'A', value: 'Uno' }, { label: 'B', value: 'Dos' }] });
  return crearChallenge(estado, reqDocente(), {
    title: titulo, description: 'd', group_id: grupoId, coins_reward: 10, xp_reward: 3,
    questions: [pregunta('Which one is the first?', correctas[0]), pregunta('Which one is the second?', correctas[1])],
  }).cuerpo;
}

/** @param {any} sesion @param {string} carpeta @param {number} ancho @param {string[]} hechas */
function fotografo(sesion, carpeta, ancho, hechas) {
  return async (nombre, pausaMs = 900) => {
    await esperar(pausaMs);
    writeFileSync(join(carpeta, `${nombre}-${ancho}.png`), await sesion.capturar());
    hechas.push(`${nombre}-${ancho}.png`);
    const sobra = await sesion.evaluar('document.documentElement.scrollHeight - window.innerHeight');
    if (sobra > 40) {
      await sesion.evaluar('window.scrollTo(0, document.documentElement.scrollHeight)');
      await esperar(250);
      writeFileSync(join(carpeta, `${nombre}-abajo-${ancho}.png`), await sesion.capturar());
      hechas.push(`${nombre}-abajo-${ancho}.png`);
      await sesion.evaluar('window.scrollTo(0, 0)');
    }
  };
}

/** Entrada, Inicio, Retos y la asistencia (formulario, código que no es, marcada con su sello y la segunda del día). @param {any} c */
async function faseInicioYAsistencia({ sesion, estado, urlBase, grupoId, foto, ir }) {
    await sesion.navegar(urlBase);
    await foto('00-entrada');
    await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
    await sesion.recargar();
    await ir('/inicio'); await foto('01-inicio', 1600);
    await ir('/retos'); await foto('02-retos');
    await ir('/asistencia'); await foto('03-asistencia-formulario');
    await sesion.evaluar(`document.querySelector('[data-testid="campo-codigo"]').value = "000000"; ${clic('boton-marcar')}`);
    await foto('04-asistencia-codigo-no-valido');
    const { cuerpo: abierta } = abrirAsistencia(estado, reqDocente(), grupoId, {});
    await ir('/retos');
    await ir(`/asistencia?codigo=${abierta.session_code}`); await foto('05-asistencia-marcada', 3200);
    const { cuerpo: otra } = abrirAsistencia(estado, reqDocente(), grupoId, {}); // otra clase el mismo día: marca, y la de hoy ya la cobró
    await ir('/retos');
    await ir(`/asistencia?codigo=${otra.session_code}`); await foto('06-asistencia-ya-cobrada', 2600);
}

/** Un reto jugado de verdad (perfecto), otro con ánimo y el aviso de repaso. @param {any} c */
async function faseRetos({ sesion, estado, grupoId, retos, foto, ir }) {
    await ir(`/retos/${retos[0].challenge_id}`); await foto('07-reto-pregunta', 1200);
    const desafio = estado.challenges.get(retos[0].challenge_id);
    const buena = (i) => desafio.correct_answers[desafio.questions[i].id];
    await sesion.evaluar(clic(`opcion-${buena(0)}`)); await foto('08-reto-opcion-elegida');
    for (let i = 0; i < desafio.questions.length; i++) {
      const ultimo = i === desafio.questions.length - 1;
      await sesion.evaluar(`(async () => { const e = (ms) => new Promise((r) => setTimeout(r, ms)); ${clic(`opcion-${buena(i)}`)}; await e(200); ${clic(ultimo ? 'boton-terminar' : 'boton-siguiente')}; await e(450); })()`);
    }
    await foto('09-fin-de-reto-perfecto-a-los-700-ms', 250);
    await foto('10-fin-de-reto-perfecto', 4200);
    const animo = retoNuevo(estado, grupoId, 'Reto de las capturas', ['A', 'B']);
    await ir('/retos'); await ir(`/retos/${animo.id}`);
    await sesion.evaluar(`(async () => { const e = (ms) => new Promise((r) => setTimeout(r, ms)); ${clic('opcion-B')}; await e(200); ${clic('boton-siguiente')}; await e(500); ${clic('opcion-A')}; await e(200); ${clic('boton-terminar')}; })()`);
    await foto('11-fin-de-reto-animo', 4000);
    await ir('/retos'); await foto('12-retos-despues');
    await sesion.evaluar(`document.querySelector('[data-testid$="-repasar"]').click()`); await foto('13-aviso-de-repaso');
}

/** Lo demás de la barra: Mis monedas, Perfil, Mis datos, las dos salidas del anillo e Inicio después de jugar. @param {any} c */
async function faseResto({ foto, ir }) {
    await ir('/monedas'); await foto('14-mis-monedas');
    await ir('/perfil'); await foto('15-perfil');
    await ir('/datos/solicitudes'); await foto('16-mis-datos');
    await ir('/vivo'); await foto('17-clase-en-vivo');
    await ir('/nivel'); await foto('18-examen-de-nivel');
    await ir('/inicio'); await foto('19-inicio-despues', 2600);
}

/** @param {{ancho: number, alto: number}} ventana @param {string} carpeta @param {string[]} hechas */
async function serie(ventana, carpeta, hechas) {
  const { estado, apiUrl, urlBase, cerrar } = await levantar();
  const { grupoId, retos } = await sembrar(apiUrl, urlBase);
  const sesion = await abrirSesion(ventana);
  const c = { sesion, estado, urlBase, grupoId, retos, foto: fotografo(sesion, carpeta, ventana.ancho, hechas), ir: (/** @type {string} */ ruta) => sesion.navegar(`${urlBase}#${ruta}`) };
  try {
    await faseInicioYAsistencia(c);
    await faseRetos(c);
    await faseResto(c);
  } finally {
    await sesion.cerrar();
    await cerrar();
  }
}

async function main() {
  const carpeta = resolve(process.argv[2] || join(RAIZ, 'salida', 'hoy'));
  mkdirSync(carpeta, { recursive: true });
  // Las salidas a la clase en vivo y al examen solo se pintan si el despliegue trae su base: aquí, dos direcciones de mentira.
  process.env.ENGRAMA_AUTH_CONFIG = JSON.stringify({ ENGRAMA_AUTH: 'mock', EVA_URL: 'https://eva.example', SET_URL: 'https://set.example' });
  /** @type {string[]} */
  const hechas = [];
  for (const ventana of VENTANAS) await serie(ventana, carpeta, hechas);
  writeFileSync(join(carpeta, 'indice.json'), `${JSON.stringify(hechas, null, 2)}\n`);
  console.log(`capturas_estudiante: ${hechas.length} capturas en ${carpeta}`);
}

main().catch((e) => { console.error('capturas_estudiante: falló', e); process.exit(1); });
