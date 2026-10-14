#!/usr/bin/env node
// @ts-check
// capturas_correcciones.mjs · Las pantallas de las correcciones de la auditoría 05 (docs/ESPEC_correcciones_practica.md, W83) contra el doble con
// fallas programadas, a 375 × 812 y a 1280 × 800, para MIRARLAS: el error de red con "Reintentar", el fallo y el acierto con la banda (el botón que
// sigue, en navy), el aviso del 409 con "Volver a Retos" y el repaso con su aviso "no suma monedas" (sin oro). Cada ancho arranca con su doble recién
// sembrado (herramientas/humo/entradas_practica.mjs, en el grupo de `est-1`). Nada toca el piloto ni un puerto fijo.
// Uso: node herramientas/capturas_correcciones.mjs [carpeta]   (por defecto: salida/correcciones/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';
import { abrirSesion } from './cdp.mjs';
import { sembrarRetosPractica } from './humo/entradas_practica.mjs';
import { arrancarIntento } from './mock/rutas_intentos.mjs';
import { terminarIntento } from './mock/por_pregunta.mjs';
import { ponerEnRepaso } from './mock/practica.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const VENTANAS = [{ ancho: 375, alto: 812 }, { ancho: 1280, alto: 800 }];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const reqEst = { headers: { authorization: 'Bearer est-1' } };

/** Toca un testid en cuanto aparece (hasta 6 s); si no aparece, lo dice (una captura sin su pantalla no sirve). */
async function tocar(sesion, testid) {
  const ok = await sesion.evaluar(`(async () => {
    for (let i = 0; i < 120 && !document.querySelector('[data-testid="${testid}"]'); i++) await new Promise((r) => setTimeout(r, 50));
    const n = document.querySelector('[data-testid="${testid}"]'); if (!n) return false; n.click(); return true;
  })()`);
  if (!ok) throw new Error(`capturas_correcciones: no apareció ${testid}`);
}
const esperarA = (sesion, testid) => sesion.evaluar(`(async () => {
  for (let i = 0; i < 120 && !document.querySelector('[data-testid="${testid}"]'); i++) await new Promise((r) => setTimeout(r, 50));
  return Boolean(document.querySelector('[data-testid="${testid}"]'));
})()`);

/** 1 a 3: sin red al abrir el reto (dos 503 en el sondeo: el primero y su reintento); "Reintentar"; un fallo y un acierto. @param {any} c */
async function faseRedYBanda({ sesion, estado, g1, foto }) {
  estado.fallas = [{ metodo: 'GET', ruta: /\/answers$/, status: 503 }, { metodo: 'GET', ruta: /\/answers$/, status: 503 }];
  await sesion.evaluar(`location.hash = '#/retos/${g1.id}'`);
  await foto('c1-red-reintentar', 'reto-reintentar');
  await tocar(sesion, 'reto-reintentar');
  await tocar(sesion, 'opcion-A'); await esperar(150); await tocar(sesion, 'boton-comprobar');
  await foto('c2-fallo', 'explicacion');
  await tocar(sesion, 'boton-siguiente'); await esperar(500);
  await tocar(sesion, 'opcion-B'); await esperar(150); await tocar(sesion, 'boton-comprobar');
  await foto('c3-acierto', 'explicacion');
}

/** 4: la última pregunta, el intento cerrado en "otra pestaña", y "Ver resultado": el 409. @param {any} c */
async function fase409({ sesion, estado, g1, foto }) {
  await tocar(sesion, 'boton-siguiente'); await esperar(500);
  await tocar(sesion, 'opcion-A'); await esperar(150); await tocar(sesion, 'boton-comprobar');
  await esperarA(sesion, 'boton-terminar');
  const { cuerpo } = arrancarIntento(estado, reqEst, g1.id);
  terminarIntento(estado, reqEst, cuerpo.attempt_id);
  await tocar(sesion, 'boton-terminar');
  await foto('c4-aviso-409', 'reto-aviso');
}

/** 5: el repaso con su aviso "no suma monedas", ya sin oro. @param {any} c */
async function faseRepaso({ sesion, estado, g2, foto }) {
  estado.tandas.length = 0;
  ponerEnRepaso(estado, { tenantId: estado.tenantDemoId, profileId: estado.tokens.get('est-1'), challengeId: g2.id, questionId: g2.questions[0].id, toca: 0 });
  await sesion.evaluar("location.hash = '#/retos'"); await esperar(600);
  await sesion.evaluar("location.hash = '#/inicio'"); await esperar(1500);
  await tocar(sesion, 'jugar-reto-hoy'); await esperar(1500); // pide la tanda: el repaso va primero
  await sesion.evaluar("location.hash = '#/repaso'");
  await foto('c5-repaso-aviso', 'banner-repaso');
}

/** @param {{ancho: number, alto: number}} ventana @param {string} carpeta @param {string[]} hechas */
async function serie(ventana, carpeta, hechas) {
  await conAppCompleta(async (url, estado) => {
    const retos = sembrarRetosPractica(estado, [...estado.groups.values()][0].id);
    const g1 = retos.find((r) => r.title === 'Rutina diaria · Gramática 1');
    const g2 = retos.find((r) => r.title === 'Rutina diaria · Gramática 2');
    const sesion = await abrirSesion(ventana);
    const foto = async (/** @type {string} */ nombre, /** @type {string} */ testid) => {
      if (!(await esperarA(sesion, testid))) throw new Error(`capturas_correcciones: ${nombre} sin ${testid}`);
      await esperar(700);
      const archivo = `${nombre}-${ventana.ancho}.png`;
      writeFileSync(join(carpeta, archivo), await sesion.capturar());
      hechas.push(archivo);
    };
    try {
      await sesion.navegar(url);
      await sesion.evaluar("localStorage.setItem('engrama_actor_sintetico', 'est-1')");
      await sesion.navegar(`${url}#/inicio`); await sesion.recargar(); await esperar(1500);
      const c = { sesion, estado, g1, g2, foto };
      await faseRedYBanda(c);
      await fase409(c);
      await faseRepaso(c);
    } finally { await sesion.cerrar(); }
  });
}

async function main() {
  const carpeta = resolve(process.argv[2] || join(RAIZ, 'salida', 'correcciones'));
  mkdirSync(carpeta, { recursive: true });
  /** @type {string[]} */
  const hechas = [];
  for (const ventana of VENTANAS) await serie(ventana, carpeta, hechas);
  writeFileSync(join(carpeta, 'indice.json'), `${JSON.stringify(hechas, null, 2)}\n`);
  console.log(`capturas_correcciones: ${hechas.length} capturas en ${carpeta}`);
}

main().catch((e) => { console.error('capturas_correcciones: falló', e); process.exit(1); });
