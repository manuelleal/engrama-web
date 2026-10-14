#!/usr/bin/env node
// @ts-check
// regenerar_x_practica.mjs · Rehace las copias rotas de la práctica del día (docs/ESPEC_practica_del_dia.md §2) desde los archivos BUENOS de hoy: copia
// rota = el archivo de ahora + SU defecto, escrito aquí como un reemplazo de texto que debe calzar UNA vez (si el archivo bueno ya no trae ese texto,
// el tramposo dejó de romper algo y esto se detiene). Escribe también el manifiesto de cada uno. Córrelo cada vez que cambie uno de esos archivos y
// después confirma, por nombre y uno a la vez, que cada tramposo sigue rojo: `node tests/correr_tramposos.mjs x_l1_envia_value`.
// Uso: node tests/tramposos/regenerar_x_practica.mjs [nombre]   (sin nombre: todos)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const AQUI = fileURLToPath(new URL('.', import.meta.url));

/** @param {string} texto @param {string} de @param {string} a */
function cambiar(texto, de, a) {
  const partes = texto.split(de);
  if (partes.length !== 2) throw new Error(`regenerar_x_practica: se esperaba una vez "${de.slice(0, 80)}" y está ${partes.length - 1}`);
  return partes.join(a);
}

const L1 = 'tests/unit/practica_l1.test.mjs';
const R10 = 'tests/contrato/mock_practica.test.mjs';
const TANDA = 'tests/unit/practica_tanda.test.mjs';
const REPASO = 'tests/unit/practica_repaso.test.mjs';
/** @type {[string, string]} */
const SIN_SALIDA_L1 = ["    estado.encabezado = crearCabecera({ piezas: [estado.salir, h('h1', { class: 'titulo-reto' }, tituloLegible(challenge.title))], sonido: true }),",
  "    estado.encabezado = crearCabecera({ piezas: [/* TRAMPOSO: sin salida */ h('h1', { class: 'titulo-reto' }, tituloLegible(challenge.title))], sonido: true }),"];

/**
 * nombre → {archivo, prueba, tests (los que deben quedar rojos), descripcion, cambios}; `otros`: más archivos del mismo defecto (con sus cambios).
 * @type {Record<string, {archivo: string, prueba: string, tests: string[], descripcion: string, cambios: Array<[string, string]>, otros?: Array<{archivo: string, cambios: Array<[string, string]>}>}>}
 */
export const TRAMPOSOS = {
  x_mock_repaso_paga: {
    archivo: 'herramientas/mock/practica.mjs', prueba: R10, tests: ['R10: lo fallado vuelve al día siguiente como repaso'],
    descripcion: 'R10: el repaso del doble paga monedas por respuesta (invita a fallar a propósito: dictamen 04 §1.4)',
    cambios: [['      estado: entrada.estado, proxima_fecha: entrada.toca === null ? null : new Date(entrada.toca).toISOString(), repetida, coins_earned: 0,',
      '      estado: entrada.estado, proxima_fecha: entrada.toca === null ? null : new Date(entrada.toca).toISOString(), repetida, coins_earned: acierto ? 2 : 0,']],
  },
  x_mock_tanda_sin_tope: {
    archivo: 'herramientas/mock/practica.mjs', prueba: R10, tests: ['R10: completar la tanda deja pedir la segunda'],
    descripcion: 'R10: el doble no tiene tope de tandas al día (siempre arma otra)',
    cambios: [['  if (terminada && hechas.length < estado.practica.maxAlDia) crearTanda(estado, auth, hoy, hechas);', '  if (terminada) crearTanda(estado, auth, hoy, hechas);']],
  },
  x_api_practica_sin_filtro: {
    archivo: 'src/api/practica.js', prueba: TANDA, tests: ['U77: la tanda llega sin la clave'],
    descripcion: 'U77: la tanda pasa tal cual: si el servidor manda la clave de un reto o de una pregunta de repaso, llega a la vista (regla 3)',
    cambios: [['  if (!t?.tanda) return t;\n', '  return t;\n']],
  },
  x_tanda_422_como_vacia: {
    archivo: 'src/api/practica.js', prueba: TANDA, tests: ['U81: con un backend sin la tanda'],
    descripcion: 'U81: el 422 de un backend viejo se toma como "tanda vacía": Inicio invita a una práctica que no existe en vez de quedar como antes',
    cambios: [["  } catch (e) {\n    console.warn(e instanceof ErrorApi && SIN_LA_RUTA.has(e.status) ? 'api/practica: este backend no arma tandas'",
      "  } catch (e) {\n    if (e instanceof ErrorApi && SIN_LA_RUTA.has(e.status)) return { fecha: '', practica: { nivel: 'A2', con_nivel_de_set: false }, tanda: null, tandas_hoy: 0, tope_al_dia: 2, puede_pedir_otra: true, listo_por_hoy: false, sin_contenido_nuevo: false };\n    console.warn(e instanceof ErrorApi && SIN_LA_RUTA.has(e.status) ? 'api/practica: este backend no arma tandas'"]],
  },
  x_practica_reto_antes_del_repaso: {
    archivo: 'src/ui/practica.js', prueba: TANDA, tests: ['U80: el repaso va antes que cualquier reto'],
    descripcion: 'U80: el primer reto pendiente va antes que el repaso (el repaso, que no paga, queda para nunca)',
    cambios: [["  if (repaso.length > 0) return { tipo: 'repaso', nivel, cuantas: repaso.length, hechos, pasos: retos.length }; // el repaso, primero\n", ''],
      ["  return { tipo: t.puede_pedir_otra && !sinMasHoy ? 'otra' : 'listo', nivel, hechos, pasos: retos.length };",
        "  if (repaso.length > 0) return { tipo: 'repaso', nivel, cuantas: repaso.length, hechos, pasos: retos.length };\n  return { tipo: t.puede_pedir_otra && !sinMasHoy ? 'otra' : 'listo', nivel, hechos, pasos: retos.length };"]],
  },
  x_tanda_se_pide_al_pintar: {
    archivo: 'src/vistas/estudiante/inicio_practica.js', prueba: TANDA, tests: ['U81: sin tanda pedida, la protagonista es la primera'],
    descripcion: 'U81: Inicio PIDE la tanda al pintar (POST): abrir la app gasta el tope del día y marca días "sin contenido" que nadie pidió',
    cambios: [['  const tanda = await verTanda(ctx);', '  const tanda = await pedirTanda(ctx);']],
  },
  x_practica_aviso_de_nivel_mudo: {
    archivo: 'src/vistas/estudiante/inicio_practica.js', prueba: TANDA, tests: ['U81: sin tanda pedida, la protagonista es la primera'],
    descripcion: 'U81: "Practicas en: A2" sin el "Todavía no es tu nivel" cuando no hay SET (se lee como el nivel: riesgo 6 del dictamen)',
    cambios: [["    plan.nivel.conSet ? null : h('span', { 'data-testid': 'practica-sin-set' }, ` ${T.sinSet}`));", '    null);']],
  },
  x_repaso_envia_value: {
    archivo: 'src/vistas/estudiante/repaso.js', prueba: REPASO, tests: ['U82: el repaso muestra una pregunta de la tanda'],
    descripcion: 'U82: el repaso manda el texto de la opción en vez de su label (regla 4 del cliente)',
    cambios: [['    estado.respuesta = await estado.enviar(estado.elegida);', '    estado.respuesta = await estado.enviar(textoDeOpcion(estado.entrada.pregunta, estado.elegida));']],
  },
  x_repaso_doble_envio: {
    archivo: 'src/vistas/estudiante/repaso.js', prueba: REPASO, tests: ['U82: el repaso muestra una pregunta de la tanda'],
    descripcion: 'U82: dos toques de Comprobar en el repaso mandan dos respuestas (regla 5 del cliente)',
    cambios: [['  estado.enviar = accionUnica((label) => responderRepaso(', '  estado.enviar = ((label) => responderRepaso(']],
  },
  x_api_l1_sin_validar: {
    archivo: 'src/api/practica.js', prueba: L1, tests: ['U77: responderPregunta manda la label'],
    descripcion: 'U77: la respuesta de /answers se usa sin validar (ausente pasa por cero y la banda pinta "undefined")',
    cambios: [["  if (!respuestaValida(datos) || datos.question_id !== questionId) throw new RespuestaMalFormada('api/practica: la respuesta de /answers llegó mal formada');\n", '']],
  },
  x_explicacion_por_que_al_acertar: {
    archivo: 'src/ui/explicacion.js', prueba: L1, tests: ['U78: al acertar no hay', 'U79: Ver resultado cierra con /finish'],
    descripcion: 'U78: "por qué no la tuya" sale también al acertar (corrige a quien acertó)',
    cambios: [["  if (!ok) poner('porQue', e?.por_opcion);", "  poner('porQue', e?.por_opcion);"]],
  },
  x_explicacion_sin_idioma: {
    archivo: 'src/ui/explicacion.js', prueba: L1, tests: ['U78: desde B1 (idioma en)'],
    descripcion: 'U78: la explicación de B1 sale con rótulos en español y sin lang (el lector la pronuncia mal)',
    cambios: [["  const idioma = e?.idioma === 'en' ? 'en' : 'es';", "  const idioma = 'es';"]],
  },
  x_l1_envia_value: {
    archivo: 'src/vistas/estudiante/reto_l1.js', prueba: L1, tests: ['U79: Comprobar manda la label'],
    descripcion: 'U79: Comprobar manda el texto de la opción en vez de su label (regla 4 del cliente)',
    cambios: [['    const r = await estado.comprobar(pregunta.id, label);', '    const r = await estado.comprobar(pregunta.id, textoDeOpcion(pregunta, label));']],
  },
  x_l1_doble_comprobar: {
    archivo: 'src/vistas/estudiante/reto_l1.js', prueba: L1, tests: ['U79: Comprobar manda la label'],
    descripcion: 'U79: dos toques de Comprobar mandan dos respuestas (regla 5 del cliente)',
    cambios: [['  estado.comprobar = accionUnica((qid, label) => responderPregunta(datos.attemptId, qid, label, datos.ctx));', '  estado.comprobar = (qid, label) => responderPregunta(datos.attemptId, qid, label, datos.ctx);']],
  },
  x_l1_no_retoma: {
    archivo: 'src/vistas/estudiante/reto_l1.js', prueba: L1, tests: ['U79: al recargar retoma donde iba'],
    descripcion: 'U79: al recargar el reto vuelve a la pregunta 1 aunque ya se respondió (y la banda de la 1 se ve otra vez)',
    cambios: [['  return i === -1 ? Math.max(0, preguntas.length - 1) : i;', '  return 0;']],
  },
  x_l1_sin_salida: {
    archivo: 'src/vistas/estudiante/reto_l1.js', prueba: L1, tests: ['U79: pinta las preguntas de /attempt'],
    descripcion: 'U79: la pregunta del reto con L1 no trae "✕ Salir" (un callejón, como antes de W73)',
    cambios: [SIN_SALIDA_L1],
  },
  // El mismo defecto de x_reto_sin_salida, medido en el navegador (E30): desde W78 el reto en curso va por reto_l1.js contra el mock, así que la
  // copia rompe la salida en los DOS caminos (el de siempre y el pregunta por pregunta).
  x_reto_sin_salida_e30: {
    archivo: 'src/vistas/estudiante/reto_flujo.js', prueba: 'tests/e2e/nav_sin_callejones.test.mjs',
    tests: ['E30: el estudiante recorre tocando sus 9 pantallas: ninguna es un callejón, Inicio queda a 2 toques o menos, y el reto en curso tiene su salida'],
    descripcion: 'El mismo defecto de x_reto_sin_salida, medido en el navegador: el reto en curso es un callejon (E30), en el camino de siempre y en el de L1',
    cambios: [["    estado.encabezado = crearCabecera({ piezas: [estado.salir, h('h1', { class: 'titulo-reto' }, tituloLegible(challenge.title))], sonido: true }),",
      "    estado.encabezado = crearCabecera({ piezas: [/* TRAMPOSO: la pregunta sin salida, como antes de W73 */ h('h1', { class: 'titulo-reto' }, tituloLegible(challenge.title))], sonido: true }),"]],
    otros: [{ archivo: 'src/vistas/estudiante/reto_l1.js', cambios: [SIN_SALIDA_L1] }],
  },
  x_l1_sin_respaldo: {
    archivo: 'src/vistas/estudiante/reto_flujo.js', prueba: L1, tests: ['U79: con un backend sin L1'],
    descripcion: 'U79: con un backend sin /answers el reto muestra un error en vez de jugarse como hoy',
    cambios: [['ctx })) return;', "ctx })) return;\n    pintarErrorFlujo(raiz, 'No se pudo cargar el reto.'); return;"]],
  },
  x_l1_409_mudo: {
    archivo: 'src/vistas/estudiante/reto_flujo.js', prueba: L1, tests: ['U79: si /submit responde 409 intento_con_respuestas'],
    descripcion: 'U79: el 409 intento_con_respuestas se calla: el estudiante queda en un reto que no se puede enviar',
    cambios: [["    if (!query.reabierto) estado.reabrir = () => renderRetoFlujo(raiz, params, { ...query, reabierto: '1' }, ctx);\n", '']],
  },
};

function main() {
  const solo = process.argv[2];
  for (const [nombre, t] of Object.entries(TRAMPOSOS)) {
    if (solo && nombre !== solo) continue;
    mkdirSync(`${AQUI}${nombre}`, { recursive: true });
    const archivos = {};
    for (const { archivo, cambios } of [{ archivo: t.archivo, cambios: t.cambios }, ...(t.otros || [])]) {
      let texto = readFileSync(`${RAIZ}${archivo}`, 'utf8').replace(/\r\n/g, '\n');
      for (const [de, a] of cambios) texto = cambiar(texto, de, a);
      writeFileSync(`${AQUI}${nombre}/${basename(archivo)}`, texto);
      archivos[archivo] = basename(archivo);
    }
    const manifiesto = {
      descripcion: t.descripcion, archivos,
      comando: ['node', '--test', '--test-reporter=tap', t.prueba], espera_codigo_no_cero: true, espera_fallan_tests: t.tests,
    };
    writeFileSync(`${AQUI}${nombre}/manifiesto.json`, `${JSON.stringify(manifiesto, null, 2)}\n`);
    console.log(`regenerar_x_practica: ${nombre}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
