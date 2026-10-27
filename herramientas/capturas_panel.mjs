#!/usr/bin/env node
// @ts-check
// capturas_panel.mjs · El panel del super admin y el tablero del admin (docs/ESPEC_panel_super_admin.md §4) contra el doble (herramientas/mock/panel.mjs,
// con la forma real del backend: tests/contrato/panel_super.test.mjs), a 375 × 812 y a 1280 × 800, para MIRARLAS. Además de cada foto mide, en el
// navegador, que no haya desborde horizontal y que los toques de la pantalla midan al menos 44 px; escribe `medidas.json` junto a las fotos.
//   admin (no super): el tablero de su institución; y #/super, que le dice "solo del super admin";
//   super admin: el tablero con el enlace a todos los clientes, #/super (todo ENGRAMA y la lista) y el detalle de un cliente.
// Uso: node herramientas/capturas_panel.mjs [carpeta]   (por defecto: salida/panel_super/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conAppCompleta } from '../tests/e2e/ayudante_servidor.mjs';
import { abrirSesion } from './cdp.mjs';
import { hacerSuper } from './mock/panel.mjs';
import { ADMIN_BOOTSTRAP_TOKEN } from './mock/estado.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const VENTANAS = [{ ancho: 375, alto: 812 }, { ancho: 1280, alto: 800 }];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Espera a que haya un elemento con ese testid (hasta 5 s). */
const esperarA = (sesion, testid) => sesion.evaluar(`(async () => {
  for (let i = 0; i < 100 && !document.querySelector('[data-testid="${testid}"]'); i++) await new Promise((r) => setTimeout(r, 50));
  return Boolean(document.querySelector('[data-testid="${testid}"]'));
})()`);

/** Desborde horizontal y toques chicos (enlaces, botones y selects visibles de menos de 44 px de alto). */
const MEDIR = `(() => {
  const ancho = document.documentElement.clientWidth;
  const desborde = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > ancho + 1; }).length;
  const chicos = [...document.querySelectorAll('#vista a, #vista button, #vista select')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 44; })
    .map((e) => (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 40) + ' ' + Math.round(e.getBoundingClientRect().height));
  return { desborde, chicos, alto: document.documentElement.scrollHeight };
})()`;

async function entrarComoAdmin(sesion, url) {
  await sesion.navegar(url);
  await sesion.evaluar(`localStorage.setItem('engrama_actor_sintetico', 'admin-demo')`);
  await sesion.navegar(`${url}#/admin`);
  await sesion.recargar();
  await esperar(1200);
}

/** @param {{ancho: number, alto: number}} ventana @param {string} carpeta @param {any[]} hechas */
async function serie(ventana, carpeta, hechas) {
  await conAppCompleta(async (url, estado) => {
    const sesion = await abrirSesion(ventana);
    const foto = async (/** @type {string} */ nombre, /** @type {string} */ testid) => {
      const listo = await esperarA(sesion, testid); await esperar(700);
      const archivo = `${nombre}-${ventana.ancho}.png`;
      const medidas = await sesion.evaluar(MEDIR); // a la altura de la ventana: lo que ve el celular
      await sesion.redimensionar(ventana.ancho, Math.max(ventana.alto, medidas.alto)); await esperar(300); // la página entera, con la barra al final
      writeFileSync(join(carpeta, archivo), await sesion.capturar());
      await sesion.redimensionar(ventana.ancho, ventana.alto);
      hechas.push({ archivo, listo, ...medidas });
    };
    try {
      await entrarComoAdmin(sesion, url);
      await sesion.navegar(`${url}#/admin/tablero`); await foto('01-admin-tablero', 'panel-kpis');
      await sesion.navegar(`${url}#/super`); await foto('02-admin-en-super-sin-permiso', 'panel-sin-permiso');
      hacerSuper(estado, /** @type {any} */ (estado).tokens.get(ADMIN_BOOTSTRAP_TOKEN)); // desde aquí, el perfil es super admin en el doble
      await sesion.navegar(`${url}#/admin/tablero`); await esperarA(sesion, 'ir-a-super');
      await sesion.navegar(`${url}#/super`); await foto('03-super-todo-engrama', 'super-clientes');
      const id = await sesion.evaluar(`document.querySelector('[data-testid="selector-cliente"] option:nth-child(3)')?.value || ''`);
      await sesion.navegar(`${url}#/super/cliente/${id}`); await foto('04-super-cliente', 'panel-kpis');
    } finally { await sesion.cerrar(); }
  });
}

async function main() {
  const carpeta = resolve(process.argv[2] || join(RAIZ, 'salida', 'panel_super'));
  mkdirSync(carpeta, { recursive: true });
  /** @type {any[]} */
  const hechas = [];
  for (const ventana of VENTANAS) await serie(ventana, carpeta, hechas);
  writeFileSync(join(carpeta, 'medidas.json'), `${JSON.stringify(hechas, null, 2)}\n`);
  const malas = hechas.filter((h) => !h.listo || h.desborde > 0);
  console.log(`capturas_panel: ${hechas.length} capturas en ${carpeta}; sin pintar o con desborde: ${malas.length}`);
  if (malas.length) process.exitCode = 1;
}

main().catch((e) => { console.error('capturas_panel: falló', e); process.exit(1); });
