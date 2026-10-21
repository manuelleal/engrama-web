#!/usr/bin/env node
// @ts-check
// regenerar_x_aviso.mjs · Rehace las copias rotas x_aviso_* del aviso de datos (docs/ESPEC_aviso_datos.md, incluida la adenda de la
// auditoría) a partir de los archivos BUENOS de hoy: copia rota = el archivo bueno de ahora + SU defecto. Córrelo cada vez que cambie
// src/textos_aviso.js o src/vistas/aviso_datos.js, y confirma cada tramposo, por nombre y uno a la vez: `node tests/correr_tramposos.mjs x_aviso_sin_plazos`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const AQUI = fileURLToPath(new URL('.', import.meta.url));
const PRUEBA = ['node', '--test', '--test-reporter=tap', 'tests/unit/aviso_texto.test.mjs'];

/** Siempre sobre LF (en Windows el árbol de trabajo puede traer CRLF). */
const leer = (/** @type {string} */ ruta) => readFileSync(`${RAIZ}${ruta}`, 'utf8').split(String.fromCharCode(13)).join('');
const textos = leer('src/textos_aviso.js');
const vista = leer('src/vistas/aviso_datos.js');

/** Cambia `de` por `a` y exige que `de` estuviera UNA vez: si el archivo bueno ya no trae ese texto, el tramposo dejó de romper algo. */
function cambiar(/** @type {string} */ texto, /** @type {string} */ de, /** @type {string} */ a) {
  const partes = texto.split(de);
  if (partes.length !== 2) throw new Error(`regenerar_x_aviso: se esperaba una vez "${de}" y está ${partes.length - 1}`);
  return partes.join(a);
}

/** Reemplaza el valor entero de la propiedad `clave` de textos_aviso.js (una sola línea) por el literal `valor` (JS, ya entre comillas). */
function propiedad(/** @type {string} */ texto, /** @type {string} */ clave, /** @type {string} */ valor) {
  const lineas = texto.split('\n');
  const i = lineas.findIndex((l) => l.startsWith(`    ${clave}: `));
  if (i < 0 || lineas.filter((l) => l.startsWith(`    ${clave}: `)).length !== 1) throw new Error(`regenerar_x_aviso: no hay UNA propiedad ${clave}`);
  lineas[i] = `    ${clave}: ${valor},`;
  return lineas.join('\n');
}

const SOLO = (/** @type {string} */ nombre) => `aviso v2: ${nombre}`;
const T_MEDIR = SOLO('dice lo que pidió Christiam: ejercicio educativo, anonimizados, para medir la plataforma');
const T_GUARDA = SOLO('es VERAZ: dice que el nombre y el correo SÍ se guardan (lo anonimizado es el análisis) y la IP');
const T_TIEMPO = SOLO('dice cuánto tiempo (copias de seguridad en el mismo servidor, sin cifrar, 7 días; registro de conexiones 14) y que se suprimen');
const T_DERECHOS = SOLO('derechos (conocer, actualizar, corregir, suprimir, retirar) con la pantalla "Mis solicitudes sobre mis datos"; voluntario; mayores de 18; no se vende');
const T_CORTO = SOLO('es CORTO (menos de 520 palabras) y la pantalla obligatoria trae el mismo texto con su casilla');

/** @type {Array<{nombre: string, destino: string, archivo: string, descripcion: string, contenido: string, falla: string[], comando?: string[]}>} */
const TRAMPOSOS = [
  {
    nombre: 'x_aviso_sin_medicion', destino: 'src/textos_aviso.js', archivo: 'textos_aviso.js',
    descripcion: 'Aviso v2: el texto deja de decir que los datos se anonimizan para medir la plataforma (lo que pidió Christiam).',
    contenido: propiedad(propiedad(textos, 'medirTitulo', "'Cómo usamos tus resultados'"), 'medir', "'Para saber si ENGRAMA ayuda a aprender, miramos los resultados.'"),
    falla: [T_MEDIR],
  },
  {
    nombre: 'x_aviso_oculta_lo_que_guarda', destino: 'src/textos_aviso.js', archivo: 'textos_aviso.js',
    descripcion: 'Aviso v2: promete que no se guarda nombre ni correo (falso: la app los necesita para funcionar).',
    contenido: propiedad(textos, 'medir', "'Para saber si ENGRAMA ayuda a aprender, analizamos los resultados sin tu nombre, sin tu correo y sin tu código, de modo que no se sepa de quién son. No guardamos tu nombre ni tu correo.'"),
    falla: [T_GUARDA],
  },
  {
    nombre: 'x_aviso_sin_encargados', destino: 'src/textos_aviso.js', archivo: 'textos_aviso.js',
    descripcion: 'Aviso v2: calla a Cloudflare y a Brevo (los servicios que sí ven datos).',
    contenido: propiedad(textos, 'noSeVenden', "'Tus datos no se venden ni se comparten con nadie más. Solo pasan por servicios técnicos de servidor y de conexión que los transportan.'"),
    falla: [T_DERECHOS],
  },
  {
    nombre: 'x_aviso_sin_plazos', destino: 'src/textos_aviso.js', archivo: 'textos_aviso.js',
    descripcion: 'Aviso v2: calla los plazos reales (copias 7 días, registro de conexiones 14).',
    contenido: propiedad(propiedad(textos, 'cuanto', "'Los guardamos mientras dure el ejercicio educativo de tu curso. Cuando termine, o antes si tú lo pides, se suprimen.'"), 'conexiones', "'Nuestro servidor guarda tu dirección IP.'"),
    falla: [T_TIEMPO],
  },
  {
    nombre: 'x_aviso_copias_cifradas_fuera', destino: 'src/textos_aviso.js', archivo: 'textos_aviso.js',
    descripcion: 'Auditoría H-1: el texto vuelve a prometer copias cifradas y fuera del servidor durante 14 días, que hoy no existen (solo corre el servicio `respaldo`: mismo servidor, sin cifrar, 7 días).',
    contenido: cambiar(textos, 'se guardan en el mismo servidor, sin cifrar, durante 7 días', 'se guardan cifradas y fuera del servidor durante 14 días (el servidor conserva además copias propias hasta 7 días)'),
    falla: [T_TIEMPO],
  },
  {
    nombre: 'x_aviso_sin_ip_de_ingresos', destino: 'src/textos_aviso.js', archivo: 'textos_aviso.js',
    descripcion: 'Auditoría H-2/H-7: el texto calla que el servicio de inicio de sesión (GoTrue) guarda la IP de tus ingresos mientras dure tu cuenta.',
    contenido: cambiar(cambiar(textos, ' Aparte, el servicio de inicio de sesión guarda la dirección IP de tus ingresos mientras dure tu cuenta.', ''), 'Tu dirección IP: en el registro de conexiones del servidor y en tus ingresos a la cuenta', 'Tu dirección IP, en el registro de conexiones del servidor'),
    falla: [T_GUARDA, T_TIEMPO],
  },
  {
    nombre: 'x_aviso_brevo_sin_condicional', destino: 'src/textos_aviso.js', archivo: 'textos_aviso.js',
    descripcion: 'Auditoría H-3: Brevo vuelve a aparecer como si enviara el correo siempre ("envía el correo para recuperar tu contraseña, por eso ve tu correo"), sin el condicional "si pides recuperar".',
    contenido: cambiar(textos, 'Brevo (el servicio de correo con el que te enviamos el enlace si pides recuperar tu contraseña; ve tu correo).', 'Brevo (envía el correo para recuperar tu contraseña, por eso ve tu correo).'),
    falla: [T_DERECHOS],
  },
  {
    nombre: 'x_aviso_no_dibuja_medir', destino: 'src/vistas/aviso_datos.js', archivo: 'aviso_datos.js',
    descripcion: 'Aviso v2: la vista no pinta las secciones "medir", "cuánto tiempo" ni "registro de conexiones" aunque los textos existan.',
    contenido: [
      "    seccion(T.medirTitulo, h('p', { 'data-testid': 'aviso-medir' }, T.medir)),\n",
      "    seccion(T.cuantoTitulo, h('p', { 'data-testid': 'aviso-cuanto' }, T.cuanto)),\n",
      "    seccion(T.conexionesTitulo, h('p', { 'data-testid': 'aviso-conexiones' }, T.conexiones)),\n",
    ].reduce((t, l) => cambiar(t, l, ''), vista),
    falla: [T_MEDIR, T_TIEMPO, T_CORTO],
  },
];

for (const t of TRAMPOSOS) {
  mkdirSync(`${AQUI}${t.nombre}`, { recursive: true });
  writeFileSync(`${AQUI}${t.nombre}/${t.archivo}`, t.contenido);
  const manifiesto = { descripcion: t.descripcion, archivos: { [t.destino]: t.archivo }, comando: t.comando ?? PRUEBA, espera_codigo_no_cero: true, espera_fallan_tests: t.falla };
  writeFileSync(`${AQUI}${t.nombre}/manifiesto.json`, `${JSON.stringify(manifiesto, null, 2)}\n`);
  console.log(`regenerar_x_aviso: ${t.nombre}`);
}
