#!/usr/bin/env node
// @ts-check
// capturas_economia.mjs · Las pantallas de Lingo Coins dentro de ENGRAMA (decisión 017) contra el mock, a 375 × 812 y a 1280 × 800, para MIRARLAS:
//   estudiante: Inicio con la puja en vivo y la tienda, la tienda (y su confirmación), la mochila, La Puja (ganando y superado, y el final);
//   profe: "Ver el grupo" con presupuesto y saldos (y el cuadro de Dar), la tienda del grupo, lanzar puja y la puja en vivo;
//   admin: Profesores (y el cuadro de Recargar).
// Cada ancho arranca con su mock recién sembrado (herramientas/mock/sembrar_economia.mjs, con una puja viva de 10 minutos). Nada toca el piloto ni un puerto fijo.
// Uso: node herramientas/capturas_economia.mjs [carpeta]   (por defecto: salida/economia_web/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';
import { abrirSesion } from './cdp.mjs';
import { sembrarEconomia } from './mock/sembrar_economia.mjs';
import { pujarPor, cerrarPuja } from './mock/subastas.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const VENTANAS = [{ ancho: 375, alto: 812 }, { ancho: 1280, alto: 800 }];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const como = (token) => ({ headers: { authorization: `Bearer ${token}` } });

/** Toca un testid en cuanto aparece (hasta 4 s). */
const tocar = (sesion, testid) => sesion.evaluar(`(async () => {
  for (let i = 0; i < 80 && !document.querySelector('[data-testid="${testid}"]'); i++) await new Promise((r) => setTimeout(r, 50));
  document.querySelector('[data-testid="${testid}"]').click();
})()`);

/** Espera a que haya un elemento con ese testid. */
const esperarA = (sesion, testid) => sesion.evaluar(`(async () => {
  for (let i = 0; i < 100 && !document.querySelector('[data-testid="${testid}"]'); i++) await new Promise((r) => setTimeout(r, 50));
  return Boolean(document.querySelector('[data-testid="${testid}"]'));
})()`);

async function entrarComo(sesion, url, actor) {
  await sesion.navegar(url);
  await sesion.evaluar(`localStorage.setItem('engrama_actor_sintetico', '${actor}')`);
  await sesion.navegar(`${url}#/inicio`);
  await sesion.recargar();
  await esperar(1200);
}

/** @param {any} c */
async function faseEstudiante({ sesion, url, foto, estado, semilla }) {
  await entrarComo(sesion, url, 'est-1');
  await sesion.navegar(`${url}#/inicio`); await esperar(1800);
  await foto('est-01-inicio-sin-puja'); // (la puja ya está viva: se ve la tarjeta)
  await sesion.navegar(`${url}#/tienda`); await esperarA(sesion, 'objetos'); await esperar(600);
  await foto('est-02-tienda');
  await tocar(sesion, 'comprar'); await esperarA(sesion, 'confirmar-compra'); await esperar(300);
  await foto('est-03-tienda-confirmar');
  await tocar(sesion, 'confirmar-compra'); await esperarA(sesion, 'compra-ok'); await esperar(1200);
  await foto('est-04-tienda-comprado');
  await sesion.navegar(`${url}#/mochila`); await esperarA(sesion, 'mochila'); await esperar(500);
  await foto('est-05-mochila');
  await sesion.navegar(`${url}#/puja`); await esperarA(sesion, 'puja-botones'); await esperar(600);
  await foto('est-06-puja-sin-pujar');
  await tocar(sesion, 'pujar-25'); await esperar(900);
  await foto('est-07-puja-vas-ganando');
  pujarPor(estado, como('est-2'), semilla.puja.id, { monto: 35 });
  await esperar(2600);
  await foto('est-08-puja-te-superaron');
  cerrarPuja(estado, como('docente-demo'), semilla.puja.id);
  await esperar(2600);
  await foto('est-09-puja-termino');
}

/** @param {any} c */
async function faseProfe({ sesion, url, foto, estado, semilla, grupoId }) {
  await entrarComo(sesion, url, 'docente-demo');
  await sesion.navegar(`${url}#/profe/grupo/${grupoId}`); await esperarA(sesion, 'saldos'); await esperar(600);
  await foto('profe-01-grupo-saldos');
  await tocar(sesion, 'dar'); await esperarA(sesion, 'dar-enviar'); await esperar(300);
  await foto('profe-02-dar');
  await tocar(sesion, 'dar-cancelar'); await esperar(200);
  await sesion.navegar(`${url}#/profe/grupo/${grupoId}/tienda`); await esperarA(sesion, 'form-objeto'); await esperar(600);
  await foto('profe-03-tienda-del-grupo');
  await sesion.navegar(`${url}#/profe/grupo/${grupoId}/puja`); await esperarA(sesion, 'puja-profe-vivo'); await esperar(600);
  await foto('profe-04-puja-en-vivo');
  cerrarPuja(estado, como('docente-demo'), semilla.puja.id); await esperar(2600);
  await foto('profe-05-puja-termino');
  await tocar(sesion, 'puja-otra'); await esperarA(sesion, 'form-puja'); await esperar(300);
  await foto('profe-06-lanzar-puja');
}

/** @param {any} c */
async function faseAdmin({ sesion, url, foto, grupoId }) {
  await entrarComo(sesion, url, 'admin-demo');
  await sesion.navegar(`${url}#/admin`); await esperarA(sesion, 'ir-a-profesores'); await esperar(500);
  await foto('admin-01-panel-con-enlace');
  await sesion.navegar(`${url}#/admin/profesores`); await esperarA(sesion, 'profesores'); await esperar(600);
  await foto('admin-02-profesores');
  await tocar(sesion, 'recargar'); await esperarA(sesion, 'recarga-enviar'); await esperar(300);
  await foto('admin-03-recargar');
  void grupoId;
}

/** @param {{ancho: number, alto: number}} ventana @param {string} carpeta @param {string[]} hechas */
async function serie(ventana, carpeta, hechas) {
  const fases = [faseEstudiante, faseProfe, faseAdmin];
  for (const fase of fases) {
    await conAppCompleta(async (url, estado) => {
      const grupoId = [...estado.groups.values()][0].id;
      const semilla = sembrarEconomia(estado, { grupoId, conPuja: true, segundosDePuja: 600 });
      const sesion = await abrirSesion(ventana);
      const foto = async (/** @type {string} */ nombre) => {
        const archivo = `${nombre}-${ventana.ancho}.png`;
        writeFileSync(join(carpeta, archivo), await sesion.capturar());
        hechas.push(archivo);
      };
      try { await fase({ sesion, url, foto, estado, semilla, grupoId }); } finally { await sesion.cerrar(); }
    });
  }
}

async function main() {
  const carpeta = resolve(process.argv[2] || join(RAIZ, 'salida', 'economia_web'));
  mkdirSync(carpeta, { recursive: true });
  /** @type {string[]} */
  const hechas = [];
  for (const ventana of VENTANAS) await serie(ventana, carpeta, hechas);
  writeFileSync(join(carpeta, 'indice.json'), `${JSON.stringify(hechas, null, 2)}\n`);
  console.log(`capturas_economia: ${hechas.length} capturas en ${carpeta}`);
}

main().catch((e) => { console.error('capturas_economia: falló', e); process.exit(1); });
