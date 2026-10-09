#!/usr/bin/env node
// @ts-check
// humo_navegacion.mjs · Humo de sintéticos de la navegación (docs/ESPEC_navegacion.md §10.1). En el navegador de verdad (CDP) contra mock_api
// detrás de servidor_dev.mjs, modo `supabase` (el GoTrue falso del mock). Por cada rol entra, recorre por los enlaces que se ven y escribe un
// JSON canónico, solo con estructura, y su sha256.
//
// Uso:
//   node herramientas/humo_navegacion.mjs --contra mock                 semilla 20261008 → salida/humo_navegacion.mock.json
//   node herramientas/humo_navegacion.mjs --contra mock --base          lo mismo, a salida/humo_navegacion.base.json (la medida de ANTES, W62)
//   node herramientas/humo_navegacion.mjs --contra mock --capturas DIR  además, una captura de cada pantalla a 375×812 y a 1280×800 en DIR
// (`--replica` y `--contra local` son W75 y W77: no están hechos.)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearServidor } from './servidor_dev.mjs';
import { crearMockApi } from './mock_api.mjs';
import { crearEstado, ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from './mock/estado.mjs';
import { crearCuenta } from './mock/gotrue.mjs';
import { CONFIG_PILOTO, CLAVE_DEMO } from './mock/login_piloto.mjs';
import { sembrarDemo } from './demo.mjs';
import { abrirSesion } from './cdp.mjs';
import { jsonCanonico, sha256De } from './humo/canon.mjs';
import { correrGuionNavegacion } from './humo/flujo_navegacion.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
export const SEMILLA = 20261008;

/** Las tres cuentas del recorrido, sobre los perfiles sintéticos del mock (correos `.test`, clave de juguete). */
const CUENTAS = {
  student: { correo: 'estudiante@nav.test', clave: CLAVE_DEMO, token: 'est-1' },
  teacher: { correo: 'profe@nav.test', clave: CLAVE_DEMO, token: DOCENTE_BOOTSTRAP_TOKEN },
  admin: { correo: 'admin@nav.test', clave: CLAVE_DEMO, token: ADMIN_BOOTSTRAP_TOKEN },
};

/** El grupo, los estudiantes y los retos de la demo, más una cuenta de GoTrue (con el aviso ya aceptado) para cada rol. */
export function sembrarNavegacion(estado) {
  sembrarDemo(estado);
  for (const c of Object.values(CUENTAS)) {
    const profileId = estado.tokens.get(c.token);
    Object.assign(estado.profiles.get(profileId), { consent_version: CONFIG_PILOTO.AVISO_VERSION, consent_at: '2026-10-01T12:00:00.000Z' });
    crearCuenta(estado, { correo: c.correo, password: c.clave, profileId });
  }
}

/** Mock + servidor de desarrollo en puertos libres, con el config.json del recorrido (EVA y SET configurados, registro abierto). */
async function levantarServidores() {
  const estado = crearEstado();
  sembrarNavegacion(estado);
  const mock = crearMockApi(estado);
  await new Promise((ok) => mock.listen(0, '127.0.0.1', ok));
  const previo = { api: process.env.ENGRAMA_API_URL, auth: process.env.ENGRAMA_AUTH_URL, config: process.env.ENGRAMA_AUTH_CONFIG };
  const urlMock = `http://127.0.0.1:${/** @type {any} */ (mock.address()).port}`;
  process.env.ENGRAMA_API_URL = urlMock;
  process.env.ENGRAMA_AUTH_URL = `${urlMock}/gotrue`;
  process.env.ENGRAMA_AUTH_CONFIG = JSON.stringify({ ...CONFIG_PILOTO, EVA_URL: 'https://eva.ejemplo.edu.co', SET_URL: 'https://set.ejemplo.edu.co', REGISTRO_CON_CODIGO: true });
  const dev = crearServidor();
  await new Promise((ok) => dev.listen(0, '127.0.0.1', ok));
  return {
    url: `http://127.0.0.1:${/** @type {any} */ (dev.address()).port}/`,
    async cerrar() {
      await new Promise((ok) => dev.close(ok));
      await new Promise((ok) => mock.close(ok));
      for (const [clave, valor] of [['ENGRAMA_API_URL', previo.api], ['ENGRAMA_AUTH_URL', previo.auth], ['ENGRAMA_AUTH_CONFIG', previo.config]]) {
        if (valor === undefined) delete process.env[clave]; else process.env[clave] = valor;
      }
    },
  };
}

/**
 * Una corrida completa: servidores nuevos, el recorrido y el cierre.
 * @param {{capturas?: string}} [o] `capturas`: carpeta donde dejar una captura de cada pantalla (375×812 y 1280×800)
 */
export async function correrHumoNavegacion(o = {}) {
  const { url, cerrar } = await levantarServidores();
  const sesion = await abrirSesion({ ancho: 375, alto: 812 });
  if (o.capturas) mkdirSync(o.capturas, { recursive: true });
  const foto = async (rol, nombre) => {
    if (!o.capturas) return;
    const archivo = `${rol}-${nombre.replace(/^\//, '').replace(/[/:() ]+/g, '_').replace(/_+$/, '') || 'raiz'}`;
    writeFileSync(join(o.capturas, `${archivo}-375.png`), await sesion.capturar());
    await sesion.redimensionar(1280, 800);
    writeFileSync(join(o.capturas, `${archivo}-1280.png`), await sesion.capturar());
    await sesion.redimensionar(375, 812);
  };
  try {
    return await correrGuionNavegacion({ sesion, url, cuentas: CUENTAS, semilla: SEMILLA, foto });
  } finally {
    await sesion.cerrar();
    await cerrar();
  }
}

async function main() {
  const iContra = process.argv.indexOf('--contra');
  const modo = iContra >= 0 ? process.argv[iContra + 1] : 'mock';
  if (modo !== 'mock') { console.error(`humo_navegacion: --contra "${modo}" no está soportado (es W77)`); process.exit(2); }
  if (process.argv.includes('--replica')) { console.error('humo_navegacion: --replica es W75 y no está hecha'); process.exit(2); }
  const iCapturas = process.argv.indexOf('--capturas');
  const resumen = await correrHumoNavegacion({ capturas: iCapturas >= 0 ? resolve(process.argv[iCapturas + 1]) : undefined });
  const texto = jsonCanonico(resumen);
  mkdirSync(join(RAIZ, 'salida'), { recursive: true });
  const ruta = join(RAIZ, 'salida', `humo_navegacion.${process.argv.includes('--base') ? 'base' : modo}.json`);
  writeFileSync(ruta, `${texto}\n`);
  console.log(`humo_navegacion: ${ruta}`);
  console.log(`humo_navegacion: sha256 ${sha256De(texto)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => { console.error('humo_navegacion: falló', e); process.exit(1); });
}
