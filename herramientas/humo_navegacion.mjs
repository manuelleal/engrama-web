#!/usr/bin/env node
// @ts-check
// humo_navegacion.mjs · Humo de sintéticos de la navegación (docs/ESPEC_navegacion.md §10). En el navegador de verdad (CDP) contra mock_api
// detrás de servidor_dev.mjs, modo `supabase` (el GoTrue falso del mock). Por cada rol entra, recorre por los enlaces que se ven y escribe un
// JSON canónico, solo con estructura (sin fechas, sin identificadores, sin nombres), y su sha256.
//
// Uso:
//   node herramientas/humo_navegacion.mjs --contra mock                 semilla 20261008, a 375×812 → salida/humo_navegacion.mock.json
//   node herramientas/humo_navegacion.mjs --contra mock --replica       semilla 7, entradas nuevas, a 360×640 → salida/humo_navegacion.replica.json
//   node herramientas/humo_navegacion.mjs --contra mock --base          lo mismo que el primero, a salida/humo_navegacion.base.json (la medida de ANTES, W62)
//   node herramientas/humo_navegacion.mjs --contra mock --capturas DIR  además, una captura de cada pantalla (ventana del recorrido y 1280×800) en DIR
// (`--contra local`, contra el piloto con cuentas sintéticas y solo lectura, es W77: no está hecho.)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearServidor } from './servidor_dev.mjs';
import { crearMockApi } from './mock_api.mjs';
import { crearEstado } from './mock/estado.mjs';
import { CONFIG_PILOTO } from './mock/login_piloto.mjs';
import { abrirSesion } from './cdp.mjs';
import { jsonCanonico, sha256De } from './humo/canon.mjs';
import { correrGuionNavegacion } from './humo/flujo_navegacion.mjs';
import { medirReplica } from './humo/flujo_navegacion_replica.mjs';
import { SEMILLA, SEMILLA_REPLICA, CUENTAS, CUENTAS_REPLICA, GRUPO_DE_40, sembrarNavegacion, sembrarReplica } from './humo/entradas_navegacion.mjs';

export { SEMILLA, sembrarNavegacion }; // los E2E de la navegación siembran lo mismo que el humo

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const VENTANA = { ancho: 375, alto: 812 };
const VENTANA_REPLICA = { ancho: 360, alto: 640 };
/** El config.json del recorrido: EVA y SET configurados y el registro abierto. La réplica mide además una instalación sin EVA ni SET. */
const CONFIG_CON_ANILLO = { ...CONFIG_PILOTO, EVA_URL: 'https://eva.ejemplo.edu.co', SET_URL: 'https://set.ejemplo.edu.co', REGISTRO_CON_CODIGO: true };
const CONFIG_SIN_ANILLO = { ...CONFIG_PILOTO, REGISTRO_CON_CODIGO: true };

/** Mock + servidor de desarrollo en puertos libres. `ponerConfig` cambia el config.json que se sirve (null = el del repo, modo `mock`). */
async function levantarServidores(sembrar) {
  const estado = crearEstado();
  const ids = sembrar(estado);
  const mock = crearMockApi(estado);
  await new Promise((ok) => mock.listen(0, '127.0.0.1', ok));
  const previo = { api: process.env.ENGRAMA_API_URL, auth: process.env.ENGRAMA_AUTH_URL, config: process.env.ENGRAMA_AUTH_CONFIG };
  const urlMock = `http://127.0.0.1:${/** @type {any} */ (mock.address()).port}`;
  process.env.ENGRAMA_API_URL = urlMock;
  process.env.ENGRAMA_AUTH_URL = `${urlMock}/gotrue`;
  const ponerConfig = (config) => { if (config) process.env.ENGRAMA_AUTH_CONFIG = JSON.stringify(config); else delete process.env.ENGRAMA_AUTH_CONFIG; };
  ponerConfig(CONFIG_CON_ANILLO);
  const dev = crearServidor();
  await new Promise((ok) => dev.listen(0, '127.0.0.1', ok));
  return {
    url: `http://127.0.0.1:${/** @type {any} */ (dev.address()).port}/`, ids, ponerConfig,
    async cerrar() {
      await new Promise((ok) => dev.close(ok));
      await new Promise((ok) => mock.close(ok));
      for (const [clave, valor] of [['ENGRAMA_API_URL', previo.api], ['ENGRAMA_AUTH_URL', previo.auth], ['ENGRAMA_AUTH_CONFIG', previo.config]]) {
        if (valor === undefined) delete process.env[clave]; else process.env[clave] = valor;
      }
    },
  };
}

/** Cómo guardar una captura de la pantalla que está pintada, en la ventana del recorrido y a 1280×800. */
function fotografo(sesion, carpeta, ventana) {
  if (!carpeta) return async () => {};
  mkdirSync(carpeta, { recursive: true });
  return async (rol, nombre) => {
    const archivo = `${rol}-${nombre.replace(/^\//, '').replace(/[/:() ]+/g, '_').replace(/_+$/, '') || 'raiz'}`;
    writeFileSync(join(carpeta, `${archivo}-${ventana.ancho}.png`), await sesion.capturar());
    await sesion.redimensionar(1280, 800);
    writeFileSync(join(carpeta, `${archivo}-1280.png`), await sesion.capturar());
    await sesion.redimensionar(ventana.ancho, ventana.alto);
  };
}

/**
 * Una corrida completa: servidores nuevos, el recorrido y el cierre.
 * @param {{capturas?: string, replica?: boolean}} [o] `capturas`: carpeta donde dejar una captura de cada pantalla; `replica`: las entradas de §10.2
 */
export async function correrHumoNavegacion(o = {}) {
  const ventana = o.replica ? VENTANA_REPLICA : VENTANA;
  const { url, ids, ponerConfig, cerrar } = await levantarServidores(o.replica ? sembrarReplica : sembrarNavegacion);
  const sesion = await abrirSesion(ventana);
  try {
    const resumen = await correrGuionNavegacion({
      sesion, url, cuentas: CUENTAS, semilla: o.replica ? SEMILLA_REPLICA : SEMILLA, foto: fotografo(sesion, o.capturas, ventana),
      codigos: o.replica ? ['SINT-B1-01', 'SINT-A2-03', GRUPO_DE_40] : ['SINT-B1-01'],
    });
    if (o.replica) {
      resumen.replica = await medirReplica({
        sesion, abrirSesion, ventana, url, cuentas: CUENTAS, cuentasReplica: CUENTAS_REPLICA, ids, ponerConfig, configs: { conAnillo: CONFIG_CON_ANILLO, sinAnillo: CONFIG_SIN_ANILLO },
      });
    }
    return resumen;
  } finally {
    await sesion.cerrar();
    await cerrar();
  }
}

async function main() {
  const iContra = process.argv.indexOf('--contra');
  const modo = iContra >= 0 ? process.argv[iContra + 1] : 'mock';
  if (modo !== 'mock') { console.error(`humo_navegacion: --contra "${modo}" no está soportado (es W77)`); process.exit(2); }
  const replica = process.argv.includes('--replica');
  const iCapturas = process.argv.indexOf('--capturas');
  const resumen = await correrHumoNavegacion({ replica, capturas: iCapturas >= 0 ? resolve(process.argv[iCapturas + 1]) : undefined });
  const texto = jsonCanonico(resumen);
  mkdirSync(join(RAIZ, 'salida'), { recursive: true });
  const nombre = process.argv.includes('--base') ? 'base' : (replica ? 'replica' : modo);
  const ruta = join(RAIZ, 'salida', `humo_navegacion.${nombre}.json`);
  writeFileSync(ruta, `${texto}\n`);
  console.log(`humo_navegacion: ${ruta}`);
  console.log(`humo_navegacion: sha256 ${sha256De(texto)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => { console.error('humo_navegacion: falló', e); process.exit(1); });
}
