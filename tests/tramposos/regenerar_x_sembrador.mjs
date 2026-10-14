#!/usr/bin/env node
// @ts-check
// regenerar_x_sembrador.mjs · Rehace las copias rotas del sembrador (docs/ESPEC_sembrador_refuerzo.md §2) desde los archivos BUENOS de hoy:
// copia rota = el archivo de ahora + SU defecto, escrito aquí como un reemplazo de texto que debe calzar UNA vez (si el archivo bueno ya no trae
// ese texto, el tramposo dejó de romper algo y esto se detiene). Escribe también el manifiesto de cada uno. Córrelo cada vez que cambie uno de
// esos archivos y después confirma, por nombre, que cada tramposo sigue rojo: `node tests/correr_tramposos.mjs x_sembrador`.
// Uso: node tests/tramposos/regenerar_x_sembrador.mjs [nombre]   (sin nombre: todos)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const AQUI = fileURLToPath(new URL('.', import.meta.url));

/** @param {string} texto @param {string} de @param {string} a */
function cambiar(texto, de, a) {
  const partes = texto.split(de);
  if (partes.length !== 2) throw new Error(`regenerar_x_sembrador: se esperaba una vez "${de.slice(0, 80)}" y está ${partes.length - 1}`);
  return partes.join(a);
}

const MAPEO = 'herramientas/sembrar/mapeo.mjs';
const IDENTIDAD = 'tests/unit/sembrar_identidad.test.mjs';
const REFUERZO = 'tests/unit/sembrar_refuerzo.test.mjs';
const REVISION = 'tests/unit/sembrar_revision.test.mjs';
const SR2 = 'SR2: solo_refuerzo true en exactamente los retos de gemelas y repasos';
const SOLO_REFUERZO_BUENO = "export const ROLES_SOLO_REFUERZO = ['gemela', 'repaso'];";
const tap = (prueba) => ['node', '--test', '--test-reporter=tap', prueba];

/**
 * nombre → {archivo, comando, tests (los que deben quedar rojos; vacío = basta el código ≠ 0), descripcion, cambios}.
 * @type {Record<string, {archivo: string, comando: string[], tests: string[], descripcion: string, cambios: Array<[string, string]>}>}
 */
export const TRAMPOSOS = {
  x_sembrador_cambia_topic: {
    archivo: MAPEO, comando: tap(IDENTIDAD), tests: ['SR5: los cuerpos de a1-u01-my-family sin los campos nuevos son la foto de antes del cambio'],
    descripcion: 'SR5: el sembrador manda como topic el título de la unidad y no su id (la tanda ordena por topic: PEDIDO_sembrador §2 dice no cambiarlo)',
    cambios: [['cefr_level: unidad.nivel, skill: destreza, topic: unidad.id,', 'cefr_level: unidad.nivel, skill: destreza, topic: unidad.titulo,']],
  },
  x_sembrador_sin_marcas: {
    archivo: MAPEO, comando: tap(REFUERZO), tests: ['SR1: cada pregunta de piensalo lleva item_ref'],
    descripcion: 'SR1: la pregunta de piensalo sale como antes, sin item_ref, familia, rol, nodos ni explicación (el repaso queda sin formas y la banda sin regla)',
    cambios: [['  return { ...pregunta, ...marcasDelBanco(item, familia, nodos) };', '  return pregunta;']],
  },
  x_sembrador_gemela_en_feed: {
    archivo: MAPEO, comando: tap(REFUERZO), tests: [SR2],
    descripcion: 'SR2: solo el repaso se marca solo_refuerzo; las gemelas siguen en el feed pagando 10 (lo que el dictamen 04 pidió quitar)',
    cambios: [[SOLO_REFUERZO_BUENO, "export const ROLES_SOLO_REFUERZO = ['repaso'];"]],
  },
  x_sembrador_todo_refuerzo: {
    archivo: MAPEO, comando: tap(REFUERZO), tests: [SR2],
    descripcion: 'SR2: también el original se marca solo_refuerzo: el feed y la tanda quedan sin retos nuevos de Accuracy',
    cambios: [[SOLO_REFUERZO_BUENO, "export const ROLES_SOLO_REFUERZO = ['original', 'gemela', 'repaso'];"]],
  },
  x_sembrador_mezcla_roles: {
    archivo: MAPEO, comando: tap(REFUERZO), tests: ['SR3: ningún reto mezcla roles'],
    descripcion: 'SR3: gemelas y repasos de una destreza van en un mismo reto (sirve a la cola, pero nunca a la segunda vuelta: PEDIDO_sembrador §3)',
    cambios: [['      const llave = `${item.rol}:${destreza}`;', "      const llave = `${item.rol === 'repaso' ? 'gemela' : item.rol}:${destreza}`;"]],
  },
  x_sembrador_lectura_con_rol: {
    archivo: MAPEO, comando: tap(REFUERZO), tests: ['SR4: la lectura lleva la explicación'],
    descripcion: 'SR4: la lectura sale con rol original (PEDIDO_sembrador §2: las lecturas van sin rol y sin familia)',
    cambios: [['  return afirmacion.explicacion ? { ...pregunta, explanation:', "  return afirmacion.explicacion ? { ...pregunta, rol: 'original', explanation:"]],
  },
  x_sembrador_campo_en_espanol: {
    archivo: MAPEO, comando: tap('tests/contrato/sembrar_contrato.test.mjs'), tests: ['SR8: los cuerpos de las 20 unidades reales A1 y A2 calzan'],
    descripcion: 'SR8: la explicación viaja como `explicacion` (el nombre del banco) y no como `explanation`: el backend (extra="forbid") responde 422',
    cambios: [['  if (item.explicacion) marcas.explanation = item.explicacion;', '  if (item.explicacion) marcas.explicacion = item.explicacion;']],
  },
  x_sembrador_humo_ve_gemela: {
    archivo: MAPEO, comando: tap('tests/unit/sembrar_humo.test.mjs'), tests: ['SR9: el humo de A1 y A2 sale bien'],
    descripcion: 'SR9: el defecto de x_sembrador_gemela_en_feed (solo el repaso va solo_refuerzo), medido por el humo sobre el contenido real A1/A2',
    cambios: [[SOLO_REFUERZO_BUENO, "export const ROLES_SOLO_REFUERZO = ['repaso'];"]],
  },
  x_sembrador_revision_ciega: {
    archivo: 'herramientas/sembrar/revision.mjs', comando: tap(REVISION), tests: ['SR6: revisarCuerpo encuentra cada error de la espec'],
    descripcion: 'SR6: la revisión no mira el catálogo: un nodo que el backend no conoce pasa, y la siembra se corta a la mitad con 422 nodo_desconocido',
    cambios: [['    else if (vigentes && !vigentes.has(n))', '    else if (vigentes && false)']],
  },
  x_sembrador_sin_revision: {
    archivo: 'herramientas/sembrar_retos.mjs', comando: tap(REVISION), tests: ['SR7: sembrar() con un nodo fuera del catálogo responde 2'],
    descripcion: 'SR7: sembrar() arma la revisión pero no la usa: manda los cuerpos con errores (en el backend real, 422 a la mitad de la siembra)',
    cambios: [['  if (revision.errores.length) {', '  if (false) {']],
  },
  // Los dos que ya existían sobre mapeo.mjs eran copias del mapeo VIEJO: se rehacen con su misma rotura sobre el bueno de hoy.
  x15_mapeo_incumple_contrato: {
    archivo: MAPEO, comando: tap('tests/unit/sembrar_retos.test.mjs'),
    tests: ['sembrar(): con --borrador contra la API local, siembra los 7 retos (6 Accuracy + 1 lectura) de 10 monedas, sin mandar max_winners (lo resuelve el servidor: 40)'],
    descripcion: "Encargo B (F9): mapeo.mjs vuelve a violar el contrato real (description null, order_index 0-based, challenge_type 'practice'). Con el mock YA estricto, sembrar_retos.mjs debe reventar contra /challenges/ en vez de colarse.",
    cambios: [
      ['preguntaDePiensalo(item, qi + 1, {', 'preguntaDePiensalo(item, qi, {'],
      ['preguntaDeAfirmacion(a, qi + 1)', 'preguntaDeAfirmacion(a, qi)'],
      ["{ titulo, destreza, description = '', questions,", '{ titulo, destreza, description = null, questions,'],
      ["description, challenge_type: 'multiple_choice',", "description, challenge_type: 'practice',"],
    ],
  },
  x_sembrador_reto_de_5: {
    archivo: MAPEO, comando: tap('tests/unit/mock_retos_economia.test.mjs'), tests: ['U36: el sembrador usa 10 por reto'],
    descripcion: 'W43 (U36): el sembrador vuelve a poner 5 monedas por reto (la base de Lingo), no las 10 decididas',
    cambios: [['export const COINS_REWARD = 10;', 'export const COINS_REWARD = 5;']],
  },
};

function main() {
  const solo = process.argv[2];
  for (const [nombre, t] of Object.entries(TRAMPOSOS)) {
    if (solo && nombre !== solo) continue;
    mkdirSync(`${AQUI}${nombre}`, { recursive: true });
    let texto = readFileSync(`${RAIZ}${t.archivo}`, 'utf8').replace(/\r\n/g, '\n');
    for (const [de, a] of t.cambios) texto = cambiar(texto, de, a);
    writeFileSync(`${AQUI}${nombre}/${basename(t.archivo)}`, texto);
    const manifiesto = {
      descripcion: t.descripcion, archivos: { [t.archivo]: basename(t.archivo) },
      comando: t.comando, espera_codigo_no_cero: true, espera_fallan_tests: t.tests,
    };
    writeFileSync(`${AQUI}${nombre}/manifiesto.json`, `${JSON.stringify(manifiesto, null, 2)}\n`);
    console.log(`regenerar_x_sembrador: ${nombre}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
