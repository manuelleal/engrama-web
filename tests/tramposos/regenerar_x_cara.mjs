#!/usr/bin/env node
// @ts-check
// regenerar_x_cara.mjs · Rehace las copias rotas de la tanda visual 1 (docs/ESPEC_visual_tanda1.md §6) a partir de los archivos BUENOS de hoy:
// copia rota = el archivo bueno de ahora + SU defecto. Córrelo cada vez que cambien estilos/cara.css o estilos/tipografia.css, y después
// confirma que cada tramposo sigue rojo en su prueba, por nombre y uno a la vez: `node tests/correr_tramposos.mjs x_cara_anima_ancho`.
// x_fuente_rango_supuesto (las fuentes de marca) también sale de aquí porque es otra copia rota de tipografia.css; su prueba es fuentes_procedencia.
// (x_cara_sin_enlace es una copia de index.html sin la línea de cara.css: si index.html cambia, se rehace a mano quitando esa línea.)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const AQUI = fileURLToPath(new URL('.', import.meta.url));
const PRUEBA = ['node', '--test', '--test-reporter=tap', 'tests/unit/css_cara.test.mjs'];

/** Cambia `de` por `a` y exige que `de` estuviera UNA vez: si el archivo bueno ya no trae ese texto, el tramposo dejó de romper algo. */
function cambiar(texto, de, a) {
  const partes = texto.split(de);
  if (partes.length !== 2) throw new Error(`regenerar_x_cara: se esperaba una vez "${de}" y está ${partes.length - 1}`);
  return partes.join(a);
}

/** En Windows el arbol de trabajo puede traer CRLF: las copias rotas se arman siempre sobre LF. */
const leer = (/** @type {string} */ ruta) => readFileSync(`${RAIZ}${ruta}`, 'utf8').split(String.fromCharCode(13)).join('');
const cara = leer('estilos/cara.css');
const tipografia = leer('estilos/tipografia.css');

const TRAMPOSOS = [
  {
    nombre: 'x_cara_apoyo_gris', destino: 'estilos/tipografia.css', archivo: 'tipografia.css',
    descripcion: 'Tanda visual 1: el texto de apoyo vuelve al gris de antes (55 % de --texto sobre blanco: 3,8:1), que no pasa el 4,5:1',
    contenido: cambiar(tipografia, 'color: color-mix(in srgb, var(--texto) 70%, white);', 'color: color-mix(in srgb, var(--texto) 55%, white);'),
    falla: 'cara: el texto de apoyo no va en mayusculas y se lee: 4,5:1 o mas sobre la superficie y sobre el fondo',
  },
  {
    nombre: 'x_cara_anima_ancho', destino: 'estilos/cara.css', archivo: 'cara.css',
    descripcion: 'Tanda visual 1: una transicion de cara.css mueve el ancho (width) en vez de transform: reflow en cada fotograma',
    contenido: `${cara}\n.fila {\n  transition: width 200ms ease;\n}\n`,
    falla: 'cara: movimiento. cara.css no declara animaciones y sus transiciones solo mueven transform u opacity',
  },
  {
    // El fondo de marca pierde su ancla en el estudiante (x_cara_barra_del_profe_rellena salio con la tanda "sistema 1": la pestana rellena ya no vive en cara.css).
    nombre: 'x_cara_fondo_de_marca_para_todos', destino: 'estilos/cara.css', archivo: 'cara.css',
    descripcion: 'Tanda visual 1: el fondo de marca (el lienzo navy claro de escritorio) pierde su ancla en .juego y en la barra del estudiante y le cae tambien al profe y al admin (dejan de ser sobrios)',
    contenido: cambiar(cara, '  body:has(.juego),\n  body:has(.nav-inferior a[href="#/inicio"]) {\n    background:', '  body {\n    background:'),
    falla: 'cara: sobriedad. El fondo de marca (y cualquier pestana rellena) es solo del estudiante: el profe y el admin no lo reciben',
  },
  {
    nombre: 'x_cara_texto_ilegible', destino: 'estilos/cara.css', archivo: 'cara.css',
    descripcion: 'Tanda visual 1: una regla de cara.css pinta texto oro sobre blanco (alrededor de 2:1): el oro es relleno, nunca texto sobre claro',
    contenido: `${cara}\n.insignia {\n  color: var(--oro);\n  background: var(--superficie);\n}\n`,
    falla: 'cara: contraste. Toda regla de cara.css que declara color y background da 4,5:1 o mas',
  },
  {
    nombre: 'x_fuente_rango_supuesto', destino: 'estilos/tipografia.css', archivo: 'tipografia.css',
    descripcion: 'Fuentes de marca: el font-face de Baloo 2 declara el rango de pesos "de siempre" (100 a 900) en vez del que el archivo trae (400 a 800): el navegador sintetiza pesos que la fuente no tiene',
    contenido: cambiar(tipografia, 'font-weight: 400 800;', 'font-weight: 100 900;'),
    falla: 'fuentes: cada font-face declara el rango de pesos MEDIDO en su archivo (eje wght), con swap y woff2-variations, al principio de la hoja',
    comando: ['node', '--test', '--test-reporter=tap', 'tests/unit/fuentes_procedencia.test.mjs'],
  },
];

for (const t of TRAMPOSOS) {
  mkdirSync(`${AQUI}${t.nombre}`, { recursive: true });
  writeFileSync(`${AQUI}${t.nombre}/${t.archivo}`, t.contenido);
  const manifiesto = { descripcion: t.descripcion, archivos: { [t.destino]: t.archivo }, comando: t.comando ?? PRUEBA, espera_codigo_no_cero: true, espera_fallan_tests: [t.falla] };
  writeFileSync(`${AQUI}${t.nombre}/manifiesto.json`, `${JSON.stringify(manifiesto, null, 2)}\n`);
  console.log(`regenerar_x_cara: ${t.nombre}`);
}
