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
const RACHA = 'tests/unit/practica_racha.test.mjs';
const CORR = 'tests/unit/practica_correcciones.test.mjs'; // W83: docs/ESPEC_correcciones_practica.md
const LECT = 'tests/unit/practica_lectura.test.mjs'; // W84: docs/ESPEC_lectura_texto.md
const BANDA = 'tests/unit/despejar_banda.test.mjs'; // adenda 1 de docs/ESPEC_visual_reto_tanda2.md (la banda no tapa lo que explica)
/** @type {[string, string]} W84: el reto de Lectura sin su texto (como antes de W84). */
const LECTURA_CIEGA = ['  return texto || null;\n', '  return null; // TRAMPOSO: el reto de Lectura sin su texto, como antes de W84\n'];
/** El override de H-A en estilos/practica.css (el defecto lo quita). */
const ORO_COMPROBAR = '.juego[data-modo="por-pregunta"] .barra-accion .boton-principal:not(:disabled) {\n  background: var(--sx-accion);\n  color: var(--sx-sobre-accion);\n  border-bottom-color: var(--sx-accion-labio);\n}\n';
/** @type {[string, string]} */
const SIN_SALIDA_L1 = ["    estado.encabezado = crearCabecera({ piezas: [estado.salir, h('h1', { class: 'titulo-reto' }, tituloLegible(challenge.title))], sonido: true }),",
  "    estado.encabezado = crearCabecera({ piezas: [/* TRAMPOSO: sin salida */ h('h1', { class: 'titulo-reto' }, tituloLegible(challenge.title))], sonido: true }),"];

/**
 * nombre → {archivo, prueba, tests (los que deben quedar rojos), descripcion, cambios}; `otros`: más archivos del mismo defecto (con sus cambios).
 * @type {Record<string, {archivo: string, copia?: string, prueba: string, tests: string[], descripcion: string, cambios: Array<[string, string]>, otros?: Array<{archivo: string, cambios: Array<[string, string]>}>}>}
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
    cambios: [["  } catch (e) {\n    registrar('/challenges/tanda', claseDeError(e), e);",
      "  } catch (e) {\n    if (e instanceof ErrorApi && SIN_LA_RUTA.has(e.status)) return { fecha: '', practica: { nivel: 'A2', con_nivel_de_set: false }, tanda: null, tandas_hoy: 0, tope_al_dia: 2, puede_pedir_otra: true, listo_por_hoy: false, sin_contenido_nuevo: false };\n    registrar('/challenges/tanda', claseDeError(e), e);"]],
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
    cambios: [['  const [tanda, racha] = await Promise.all([verTanda(ctx), leerRacha(ctx)]);', '  const [tanda, racha] = await Promise.all([pedirTanda(ctx), leerRacha(ctx)]);']],
  },
  x_practica_aviso_de_nivel_mudo: {
    archivo: 'src/vistas/estudiante/inicio_practica.js', prueba: TANDA, tests: ['U81: sin tanda pedida, la protagonista es la primera'],
    descripcion: 'U81: "Practicas en: A2" sin el "Todavía no es tu nivel" cuando no hay SET (se lee como el nivel: riesgo 6 del dictamen)',
    cambios: [["    plan.nivel.conSet ? null : h('span', { 'data-testid': 'practica-sin-set' }, ` ${T.sinSet}`));", '    null);']],
  },
  x_repaso_envia_value: {
    archivo: 'src/vistas/estudiante/repaso.js', prueba: REPASO, tests: ['U82: el repaso muestra una pregunta de la tanda'],
    descripcion: 'U82: el repaso manda el texto de la opción en vez de su label (regla 4 del cliente)',
    cambios: [['    estado.respuesta = await estado.enviar(label);', '    estado.respuesta = await estado.enviar(textoDeOpcion(estado.entrada.pregunta, label));']],
  },
  x_repaso_doble_envio: {
    archivo: 'src/vistas/estudiante/repaso.js', prueba: REPASO, tests: ['U82: el repaso muestra una pregunta de la tanda'],
    descripcion: 'U82: dos toques de Comprobar en el repaso mandan dos respuestas (regla 5 del cliente)',
    cambios: [['  estado.enviar = accionUnica((label) => responderRepaso(', '  estado.enviar = ((label) => responderRepaso(']],
  },
  x_mock_racha_seis_dias: {
    archivo: 'herramientas/mock/racha.mjs', prueba: R10, tests: ['R10: GET /core/racha responde RachaOut'],
    descripcion: 'R10: la semana del doble tiene 6 días (se pierde el domingo): los puntos de "Tu semana" no son los del backend',
    cambios: [['export const diasDeSemana = (lunes) => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));', 'export const diasDeSemana = (lunes) => Array.from({ length: 6 }, (_, i) => sumarDias(lunes, i));']],
  },
  x_semana_cuenta_los_puntos: {
    archivo: 'src/ui/racha_semanal.js', prueba: RACHA, tests: ['U83: los 7 puntos son los del servidor'],
    descripcion: 'U83: la web cuenta los puntos llenos en vez de usar dias_activos del servidor (y se equivoca cuando un día cuenta por algo que no ve)',
    cambios: [['    resumen: completa ? T.cumplida(semana.dias_activos, semana.meta_dias) : T.resumen(semana.dias_activos, semana.meta_dias), // los del servidor',
      '    resumen: completa ? T.cumplida(puntos.filter((p) => p.lleno).length, semana.meta_dias) : T.resumen(puntos.filter((p) => p.lleno).length, semana.meta_dias),']],
  },
  x_racha_valida_todo: {
    archivo: 'src/ui/racha_semanal.js', prueba: RACHA, tests: ['U83: rachaValida rechaza 6 días'],
    descripcion: 'U83: cualquier respuesta de /core/racha se usa (con 6 días o números como texto, "ausente" pasa por "0")',
    cambios: [['export function rachaValida(r) {\n', 'export function rachaValida(r) {\n  return esObjeto(r);\n']],
  },
  x_semana_desde_el_historial: {
    archivo: 'src/vistas/estudiante/inicio_practica.js', prueba: RACHA, tests: ['U84: con /core/racha, la llama dice "2 semanas"'],
    descripcion: 'U84: Inicio no usa la racha del servidor: la llama sigue en días y "Tu semana" sale de las asistencias del historial',
    cambios: [['    racha: racha ? rachaParaInicio(racha) : null,', '    racha: null,']],
  },
  x_textos_practica_perderas: {
    archivo: 'src/textos_practica.js', prueba: RACHA, tests: ['U85: ningún texto de la práctica del día trae una palabra prohibida'],
    descripcion: 'U85: la semana nueva dice "Perdiste tu racha" (dictamen 04 §1.1: prohibido; informa sin culpa)',
    cambios: [['    semanaNueva: (mejor, total) => `Semana nueva. Tu mejor racha: ${mejor}. Semanas cumplidas: ${total}.`,',
      '    semanaNueva: (mejor, total) => `Perdiste tu racha. Tu mejor racha: ${mejor}. Semanas cumplidas: ${total}.`,']],
  },
  x_humo_practica_repaso_paga: {
    archivo: 'herramientas/mock/practica.mjs', prueba: 'tests/unit/humo_practica.test.mjs', tests: ['W82: el humo de la práctica (desarrollo)'],
    descripcion: 'W82: el repaso del doble paga al acertar: el humo del día de práctica lo ve (monedas del repaso distintas de 0)',
    cambios: [['      estado: entrada.estado, proxima_fecha: entrada.toca === null ? null : new Date(entrada.toca).toISOString(), repetida, coins_earned: 0,',
      '      estado: entrada.estado, proxima_fecha: entrada.toca === null ? null : new Date(entrada.toca).toISOString(), repetida, coins_earned: acierto ? 2 : 0,']],
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
    // W84: el ancla era `ctx })) return;`; desde W84 la llamada es `porPregunta(raiz, datos)` (mismo defecto, otra línea).
    cambios: [['if (await porPregunta(raiz, datos)) return;', "if (await porPregunta(raiz, datos)) return;\n    pintarErrorFlujo(raiz, 'No se pudo cargar el reto.'); return;"]],
  },
  // ---------- W83: las correcciones de la auditoría 05 (docs/ESPEC_correcciones_practica.md) ----------
  x_l1_500_es_viejo: {
    archivo: 'src/api/practica.js', prueba: CORR, tests: ['U86: retomarIntento reintenta UNA vez', 'U86: con el sondeo caído dos veces'],
    descripcion: 'U86 (H-1): un 500 o un corte al leer el intento se toma por backend viejo (null): el reto se juega con el flujo viejo y se pierde la explicación',
    cambios: [["    if (clase === 'transitorio') throw new ErrorTransitorio(RUTA_ANSWERS, codigoDe(e));\n", '']],
  },
  x_l1_transitorio_degrada: {
    archivo: 'src/vistas/estudiante/reto_l1.js', prueba: CORR, tests: ['U86: con el sondeo caído dos veces'],
    descripcion: 'U86 (H-1): con el intento ilegible por la red, el reto cae en silencio al flujo viejo en vez de ofrecer Reintentar',
    cambios: [['    pintarSinConexion(raiz, datos);\n    return true;\n', '    return false;\n']],
  },
  // El mismo defecto, medido en el navegador (E38): el doble con dos 503 en el sondeo, y la página cae al flujo viejo.
  x_l1_transitorio_degrada_e38: {
    archivo: 'src/vistas/estudiante/reto_l1.js', prueba: 'tests/e2e/practica_correcciones.test.mjs', tests: ['E38: con el sondeo del intento caído dos veces'],
    descripcion: 'E38 (H-1): el mismo defecto de x_l1_transitorio_degrada, en el navegador: con el sondeo caído el reto cae en silencio al flujo viejo',
    cambios: [['    pintarSinConexion(raiz, datos);\n    return true;\n', '    return false;\n']],
  },
  x_l1_finish_409_colgado: {
    archivo: 'src/vistas/estudiante/reto_l1.js', prueba: CORR, tests: ['U87: un 409 en /finish'],
    descripcion: 'U87 (H-2): un 409 en /finish solo devuelve la salida: el botón queda en "Enviando…" y Drako pensando para siempre',
    cambios: [['    if (e instanceof ErrorApi && e.status === 409) { avisoDeCierre(raiz, estado); return; } // H-2: ya estaba cerrado (nunca se cobra dos veces)',
      '    if (e instanceof ErrorApi && e.status === 409) { if (estado.salir) estado.encabezado?.prepend(estado.salir); return; }']],
  },
  x_l1_comprobar_409_crudo: {
    archivo: 'src/vistas/estudiante/reto_l1.js', prueba: CORR, tests: ['U87: un 409 al Comprobar'],
    descripcion: 'U87 (H-2): un 409 o un 404 al Comprobar pinta el mensaje crudo del servidor, en inglés ("Attempt already completed or abandoned")',
    cambios: [['    if (e instanceof ErrorApi && e.status === 409) { avisoDeCierre(raiz, estado); return; } // H-2: el intento ya no admite respuestas\n    if (e instanceof ErrorApi && e.status === 404) { avisoDeCierre(raiz, estado, T.noDisponible); return; }',
      '    if (e instanceof ErrorApi && [404, 409].includes(e.status)) { pintarErrorFlujo(raiz, e.mensaje); return; }']],
  },
  x_explicacion_lang_del_idioma: {
    archivo: 'src/ui/explicacion.js', prueba: L1, tests: ['U78: en A1 y A2 (idioma es)'],
    descripcion: 'U78 (H-4): cada parte lleva el lang del idioma: en A1/A2 la oración y el ejemplo en inglés quedan marcados como español',
    cambios: [["h('p', { class: 'sx-banda__cuerpo', lang: p.lang,", "h('p', { class: 'sx-banda__cuerpo', lang: plan.idioma,"]],
  },
  x_l1_reelige_en_vuelo: {
    archivo: 'src/vistas/estudiante/reto_l1.js', prueba: CORR, tests: ['U88: con "Comprobar" en vuelo las opciones del reto'],
    descripcion: 'U88 (H-6): con Comprobar en vuelo las opciones siguen vivas: reelegir repinta, suena dos veces y sale "Quedó guardada tu primera respuesta"',
    cambios: [['  estado.enVuelo = true; quietas(estado.opciones); // H-6: mientras vuela, la que se ve elegida es la que se envía\n', '']],
  },
  x_repaso_reelige_en_vuelo: {
    archivo: 'src/vistas/estudiante/repaso.js', prueba: CORR, tests: ['U88: en el repaso'],
    descripcion: 'U88 (H-6): en el repaso se reelige en vuelo y, como RespuestaOut no trae answer, queda marcada C con el veredicto de B',
    cambios: [['  estado.enviada = label; estado.enVuelo = true; quietas(estado.opciones); // H-6: lo que se marca después es lo que se envió\n', ''],
      ['estado.respuesta.answer ?? estado.enviada : estado.elegida;', 'estado.respuesta.answer ?? estado.elegida : estado.elegida;']],
  },
  x_fuga_campos_nuevos: {
    archivo: 'src/api/retos.js', prueba: CORR, tests: ['U89: el filtro de la clave quita y cuenta los 6 campos'],
    descripcion: 'U89 (H-7): el filtro de la clave es el de antes: la oración correcta, las aceptadas, la tolerancia, el "por qué" y las pistas pasan',
    cambios: [["'explicacion', 'explanation', 'oracion_correcta', 'accepted_answers', 'tolerance', 'tolerancia', 'por_opcion', 'pistas'];", "'explicacion', 'explanation'];"]],
  },
  x_practica_loguea_payload: {
    archivo: 'src/api/practica.js', prueba: CORR, tests: ['U89: con una respuesta mal formada'],
    descripcion: 'U89 (H-7): la tanda mal formada se vuelca entera en la consola (con la clave, si la trae)',
    cambios: [["console.warn('api/practica: la tanda llegó mal formada; Inicio queda como antes', camposDe(datos));", "console.warn('api/practica: la tanda llegó mal formada; Inicio queda como antes', datos);"]],
  },
  x_l1_sin_opciones_muda: {
    archivo: 'src/vistas/estudiante/reto_l1.js', prueba: CORR, tests: ['U90: en el reto, una pregunta fill_blank'],
    descripcion: 'U90 (H-3): una pregunta que no es de opción múltiple se pinta sin opciones y con un Comprobar muerto: el estudiante queda atascado',
    cambios: [['    ...(respuesta || preguntaContestable(pregunta) ? [', '    ...(true ? [']],
  },
  x_repaso_no_salta: {
    archivo: 'src/vistas/estudiante/repaso.js', prueba: CORR, tests: ['U90: el repaso salta lo que no se puede contestar'],
    descripcion: 'U90 (H-3): el repaso muestra primero una pregunta que no se puede contestar y bloquea la tanda (el repaso va siempre primero)',
    cambios: [['  const entradas = tanda.tanda.repaso.filter((/** @type {any} */ e) => preguntaContestable(e.pregunta));', '  const entradas = tanda.tanda.repaso;']],
  },
  x_practica_cuenta_no_contestables: {
    archivo: 'src/ui/practica.js', prueba: CORR, tests: ['U90: el repaso salta lo que no se puede contestar'],
    descripcion: 'U90 (H-3): "Tu práctica de hoy" cuenta como repaso lo que no se puede contestar: manda a "Repaso primero" para siempre',
    cambios: [['  const repaso = t.tanda.repaso.filter((/** @type {any} */ e) => preguntaContestable(e.pregunta));', '  const repaso = t.tanda.repaso;']],
  },
  x_tanda_then_sin_catch: {
    archivo: 'src/vistas/estudiante/inicio_practica.js', prueba: CORR, tests: ['U91: si algo falla DESPUÉS del POST de la tanda'],
    descripcion: 'U91 (H-9): .then(ir, manejar): un error al ir al primer paso queda sin manejar y el botón se queda en "Armando tu práctica…"',
    cambios: [['    pedir().then((t) => irAlPrimerPaso(ctx, t, { o, fallback, tarjeta, antes: plan.tipo })).catch((e) => {', '    pedir().then((t) => irAlPrimerPaso(ctx, t, { o, fallback, tarjeta, antes: plan.tipo }), (e) => {']],
  },
  x_repaso_sin_tope: {
    archivo: 'src/vistas/estudiante/repaso.js', prueba: CORR, tests: ['U91: el repaso no repite en bucle'],
    descripcion: 'U91 (H-9): tras un 409 el repaso vuelve a pedir la tanda y, si el servidor sigue listando esa entrada, muestra la misma pregunta en bucle',
    cambios: [['      estado.saltadas.add(estado.entrada.entrada_id);\n', '']],
  },
  x_l1_texto_fijo: {
    archivo: 'src/vistas/estudiante/reto_l1.js', prueba: CORR, tests: ['U91: "No se pudo enviar tu reto." sale de textos_practica.js'],
    descripcion: 'U91 (H-9): "No se pudo enviar tu reto." vuelve a estar fijo en la vista (regla 6 del cliente: las cadenas, en su archivo de textos)',
    cambios: [["    pintarErrorFlujo(raiz, e instanceof ErrorApi ? e.mensaje : T.noSeEnvio);", "    pintarErrorFlujo(raiz, e instanceof ErrorApi ? e.mensaje : 'No se pudo enviar tu reto.');"]],
  },
  x_aviso_corto_en_oro: {
    archivo: 'estilos/componentes.css', prueba: CORR, tests: ['U92: los avisos cortos'],
    descripcion: 'U92: el aviso "Repaso: no suma monedas" vuelve a ser un chip de oro (el oro es solo logro, monedas y racha)',
    cambios: [['  background: color-mix(in srgb, var(--primario) 10%, white);\n  color: var(--primario);\n  font-weight: 800;', '  background: var(--oro);\n  color: var(--oro-texto);\n  font-weight: 800;']],
  },
  x_comprobar_en_oro: {
    archivo: 'estilos/practica.css', prueba: CORR, tests: ['U94: "Comprobar" del reto por pregunta va en navy'],
    descripcion: 'U94 (H-A, auditoría 06): se quita el override de practica.css y "Comprobar" vuelve al oro de la barra de acción (juego.css): el oro es solo logro, monedas y racha',
    cambios: [[ORO_COMPROBAR, '']],
  },
  x_comprobar_en_oro_e35: {
    archivo: 'estilos/practica.css', prueba: 'tests/e2e/practica_l1.test.mjs', tests: ['E35: un reto A2 pregunta por pregunta'],
    descripcion: 'U94 cruce (H-A): el mismo defecto medido en el navegador: el color que pinta "Comprobar" es el oro, no el navy del sistema',
    cambios: [[ORO_COMPROBAR, '']],
  },
  x_l1_error_inesperado_es_viejo: {
    archivo: 'src/vistas/estudiante/reto_flujo.js', prueba: CORR, tests: ['U95: si intentarL1 lanza algo inesperado'],
    descripcion: 'U95 (H-B, auditoría 06): porPregunta como antes de H-1: cualquier error de intentarL1 (no solo un import() que falla) devuelve false y el reto cae al flujo de siempre y su /submit',
    cambios: [["  let l1;\n  try { l1 = await import('./reto_l1.js'); } catch (e) { console.warn('reto_flujo: sin L1', e); return false; }\n  return l1.intentarL1(raiz, datos);\n",
      "  try { return await (await import('./reto_l1.js')).intentarL1(raiz, datos); } catch (e) { console.warn('reto_flujo: sin L1', e); return false; }\n"]],
  },
  x_humo_correcciones_500_viejo: {
    archivo: 'src/api/practica.js', prueba: 'tests/unit/humo_correcciones.test.mjs', tests: ['U93: el humo de las correcciones (desarrollo)', 'U93: la réplica'],
    descripcion: 'U93 (W83): el humo de la red irregular lo ve: dos 503 (o un corte) al leer el intento dan null, como un backend viejo',
    cambios: [["    if (clase === 'transitorio') throw new ErrorTransitorio(RUTA_ANSWERS, codigoDe(e));\n", '']],
  },
  x_sin_eol_lf: {
    archivo: '.gitattributes', copia: 'gitattributes.txt', prueba: 'tests/unit/sw_peso.test.mjs', tests: ['U59: cada archivo de PRECARGA sale de git archive'],
    descripcion: 'U59 (H-5): sin `*.js text eol=lf`, git archive con core.autocrlf=true sirve el shell en CRLF (más pesado que lo que mide U59) y nada lo ve',
    cambios: [['*.js text eol=lf\n', '']],
  },
  x_l1_409_mudo: {
    archivo: 'src/vistas/estudiante/reto_flujo.js', prueba: L1, tests: ['U79: si /submit responde 409 intento_con_respuestas'],
    descripcion: 'U79: el 409 intento_con_respuestas se calla: el estudiante queda en un reto que no se puede enviar',
    cambios: [["    if (!query.reabierto) estado.reabrir = () => renderRetoFlujo(raiz, params, { ...query, reabierto: '1' }, ctx);\n", '']],
  },
  // W84 (docs/ESPEC_lectura_texto.md §2): los retos de Lectura muestran su texto.
  x_lectura_ciega: {
    archivo: 'src/ui/lectura.js', prueba: LECT,
    tests: ['U96: textoDeLectura da el pasaje', 'U97: reto por pregunta', 'U97: la revisión del final', 'U97: con un backend sin L1'],
    descripcion: 'U96/U97 (W84): ui/lectura.js nunca halla el texto: los retos de Lectura se juegan a ciegas, como en la compuerta 18 (hallazgo Alta 1)',
    cambios: [LECTURA_CIEGA],
  },
  x_lectura_flujo_viejo_ciego: {
    archivo: 'src/vistas/estudiante/reto_flujo.js', prueba: LECT, tests: ['U97: con un backend sin L1'],
    descripcion: 'U97 (W84): el flujo de siempre (backend sin L1) no pinta el texto: con un backend viejo la Lectura se juega a ciegas',
    cambios: [['    estado.lectura?.(challenge),\n', '']],
  },
  x_lectura_olvida_plegado: {
    archivo: 'src/ui/lectura.js', prueba: LECT, tests: ['U97: plegar el texto y elegir una opción'],
    descripcion: 'U97 (W84): sin la memoria por reto, elegir una opción (que repinta la pantalla) vuelve a abrir el texto que el estudiante plegó',
    cambios: [['(memoria.get(clave) ?? { abierta: true, desplazado: 0 })', '{ abierta: true, desplazado: 0 }']],
  },
  x_e39_lectura_ciega: {
    archivo: 'src/ui/lectura.js', prueba: 'tests/e2e/practica_lectura.test.mjs', tests: ['E39: a 375 × 667', 'E39: a 1280 × 800'],
    descripcion: 'E39 (W84): el defecto de x_lectura_ciega medido en el navegador: el reto de Lectura sin su texto, a 375 y a 1280',
    cambios: [LECTURA_CIEGA],
  },
  // Adenda 1 de docs/ESPEC_visual_reto_tanda2.md (compuerta 21, hallazgo 4): la banda de resultado no tapa el enunciado ni lo marcado.
  x_despejo_ignora_marcadas: {
    archivo: 'src/ui/despejar_banda.js', prueba: BANDA, tests: ['U101a: la banda tapa lo marcado'],
    descripcion: 'U101a: la cuenta del desplazamiento solo mira el enunciado y no las opciones marcadas: la banda sigue tapando "Correcta" y "Tu respuesta" (el defecto del hallazgo 4)',
    cambios: [['  const masBajo = Math.max(enunciado.abajo, ...marcadas.map((m) => m.abajo));\n', '  const masBajo = enunciado.abajo; // TRAMPOSO: solo mira el enunciado\n']],
  },
  x_banda_sin_reducido: {
    archivo: 'src/ui/despejar_banda.js', prueba: BANDA, tests: ['U101b: con prefers-reduced-motion'],
    descripcion: 'U101b: el desplazamiento es siempre suave, aun con prefers-reduced-motion',
    cambios: [["behavior: reducirMovimiento() ? 'auto' : 'smooth'", "behavior: 'smooth'"]],
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
      // `copia`: otro nombre para la copia (un `.gitattributes` copiado tal cual valdría como atributos de su carpeta).
      const copia = archivo === t.archivo && t.copia ? t.copia : basename(archivo);
      writeFileSync(`${AQUI}${nombre}/${copia}`, texto);
      archivos[archivo] = copia;
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
