#!/usr/bin/env node
// @ts-check
// regenerar_x_sw.mjs · Rehace las copias rotas de sw.js que derivan del archivo BUENO de hoy (copia rota = sw.js de ahora + SU defecto).
// Córrelo cada vez que cambie sw.js (la lista de precarga o VERSION) y después confirma, por nombre y uno a la vez, que cada tramposo sigue
// rojo en su prueba: `node tests/correr_tramposos.mjs x_sw_cachea_api`. No toca los manifiestos. x9_sin_precarga NO deriva de sw.js (es un
// service worker entero, de cuatro líneas): no se rehace.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const AQUI = fileURLToPath(new URL('.', import.meta.url));

/** Cambia `de` por `a` y exige que `de` estuviera UNA vez: si el archivo bueno ya no trae ese texto, el tramposo dejó de romper algo. */
function cambiar(texto, de, a) {
  const partes = texto.split(de);
  if (partes.length !== 2) throw new Error(`regenerar_x_sw: se esperaba una vez "${de}" y está ${partes.length - 1}`);
  return partes.join(a);
}

const sw = readFileSync(`${RAIZ}sw.js`, 'utf8').replace(/\r\n/g, '\n');

const TRAMPOSOS = {
  // Guarda /api y la sirve de respaldo (H-4: en un equipo compartido, B veía los datos de A).
  x_sw_cachea_api: cambiar(
    sw,
    "  if (url.pathname.startsWith('/api/')) return;\n",
    "  if (url.pathname.startsWith('/api/')) { ev.respondWith(fetch(request).then(async (r) => { if (r.ok) (await caches.open(VERSION)).put(request, r.clone()); return r; }).catch(() => caches.match(request))); return; }\n",
  ),
  // Precarga y cachea /config.json (H-6: una configuración vieja arranca la app en otro modo).
  x_sw_cachea_config: cambiar(
    cambiar(sw, "  '/src/app.js',\n", "  '/config.json',\n  '/src/app.js',\n"),
    "  if (url.pathname === '/config.json') return;\n",
    '',
  ),
  // Instala con addAll: todo o nada y sin techo de tiempo.
  x_sw_instala_con_addall: cambiar(
    sw,
    '  ev.waitUntil(precargar().then(() => self.skipWaiting()));\n',
    '  ev.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECARGA)).then(() => self.skipWaiting()));\n',
  ),
  // No precarga vendor/: sin red, ni Drako se mueve ni cae confeti.
  x_sw_sin_vendor: cambiar(
    sw,
    "  // Animación (vendor/PROCEDENCIA.md, autorizada por Christiam el 2026-10-06): anime.js mueve a Drako por partes y la\n  // línea de tiempo del fin de reto; canvas-confetti dibuja el confeti. Mismo origen, sin tocar la CSP.\n  '/vendor/animejs@4.5.0/anime.esm.min.js',\n  '/vendor/canvas-confetti@1.9.4/confetti.module.mjs',\n",
    '',
  ),
  // U59 (docs/ESPEC_practica_del_dia.md §0): el sistema visual (46 KB) entra a PRECARGA y el shell pasa su techo de 830.000.
  // Desde docs/ESPEC_margen_precarga.md el shell tiene ~86 KB de margen y el sistema solo ya cabría (el tramposo quedaba VERDE): entran también
  // las dos fuentes de marca (64.264 bytes), lo que sw.js dice que no cabe. 110.621 bytes en total.
  x_precarga_engorda: cambiar(sw, "  '/publico/diseno/tokens.css',\n", "  '/publico/diseno/tokens.css',\n  '/publico/diseno/sistema.css',\n  '/publico/fuentes/baloo-2-latin-wght-normal.woff2',\n  '/publico/fuentes/nunito-sans-latin-wght-normal.woff2',\n"),
  // U59: un módulo diferido (el reto pregunta por pregunta) no está en DIFERIDOS: nunca se guarda y, sin red, el reto no abre por ahí.
  x_diferido_suelto: cambiar(sw, "  '/src/vistas/estudiante/reto_l1.js',\n", ''),
  // docs/ESPEC_margen_precarga.md: lo que importa el panel del profe (api/profe.js) no está en DIFERIDOS: nunca se guarda.
  x_panel_suelto: cambiar(sw, "  '/src/api/profe.js',\n", ''),
};

for (const [nombre, contenido] of Object.entries(TRAMPOSOS)) {
  writeFileSync(`${AQUI}${nombre}/sw.js`, contenido);
  console.log(`regenerar_x_sw: ${nombre}`);
}
