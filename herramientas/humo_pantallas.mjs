#!/usr/bin/env node
// @ts-check
// humo_pantallas.mjs · Humo de sintéticos de las pantallas del anillo (docs/ESPEC_pantallas_anillo.md §9.1 y §9.4, W36). Corre el guion
// (herramientas/humo/flujo_pantallas.mjs) con el CLIENTE real (src/api/*.js y src/anillo/*.js) contra un mock_api real detrás del mismo proxy que
// usaría el navegador (servidor_dev.mjs, con el GoTrue falso bajo /auth/v1), y escribe un JSON canónico (sin fechas, UUID, correos ni nombres)
// con su sha256.
//
// Uso:
//   node herramientas/humo_pantallas.mjs --contra mock             semilla 20261006 → salida/humo_pantallas_anillo.mock.json
//   node herramientas/humo_pantallas.mjs --contra mock --replica   semilla 7, entradas nuevas → salida/humo_pantallas_anillo.replica.json
// (`--contra local`, contra el backend 5aad55e en el proyecto desechable de D7, es W39 y no está hecho.)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearServidor } from './servidor_dev.mjs';
import { crearMockApi } from './mock_api.mjs';
import { crearEstado } from './mock/estado.mjs';
import { configurarRaizApi } from '../src/api/cliente.js';
import { jsonCanonico, sha256De } from './humo/canon.mjs';
import { ENTRADA_DESARROLLO, ENTRADA_REPLICA } from './humo/entradas_pantallas.mjs';
import { correrGuionPantallas } from './humo/flujo_pantallas.mjs';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

/** Levanta el mock y el servidor de desarrollo (con el proxy `/api` y `/auth/v1`) en puertos libres. @returns {Promise<{estado: any, urlShell: string, cerrar: () => Promise<void>}>} */
async function levantarServidores() {
  const estado = crearEstado();
  const mock = crearMockApi(estado);
  await new Promise((ok) => mock.listen(0, '127.0.0.1', ok));
  const previo = { api: process.env.ENGRAMA_API_URL, auth: process.env.ENGRAMA_AUTH_URL };
  const urlMock = `http://127.0.0.1:${mock.address().port}`;
  process.env.ENGRAMA_API_URL = urlMock; // servidor_dev.mjs lo lee en cada petición
  process.env.ENGRAMA_AUTH_URL = `${urlMock}/gotrue`;
  const dev = crearServidor();
  await new Promise((ok) => dev.listen(0, '127.0.0.1', ok));
  return {
    estado, urlShell: `http://127.0.0.1:${dev.address().port}`,
    async cerrar() {
      await new Promise((ok) => dev.close(ok));
      await new Promise((ok) => mock.close(ok));
      for (const [clave, valor] of [['ENGRAMA_API_URL', previo.api], ['ENGRAMA_AUTH_URL', previo.auth]]) {
        if (valor === undefined) delete process.env[clave]; else process.env[clave] = valor;
      }
    },
  };
}

/**
 * Una corrida completa: servidores nuevos, el guion y el cierre. Exportada para que el test la corra dos veces seguidas en el mismo proceso.
 * @param {import('./humo/entradas_pantallas.mjs').Entrada} entrada
 */
export async function correrHumoPantallas(entrada) {
  const { estado, urlShell, cerrar } = await levantarServidores();
  configurarRaizApi(urlShell);
  try {
    return await correrGuionPantallas({ urlShell, estado, entrada });
  } finally {
    configurarRaizApi('');
    await cerrar();
  }
}

async function main() {
  const iContra = process.argv.indexOf('--contra');
  const modo = iContra >= 0 ? process.argv[iContra + 1] : 'mock';
  if (modo !== 'mock') { console.error(`humo_pantallas: --contra "${modo}" no está soportado todavía (es W39, necesita el proyecto desechable de D7)`); process.exit(2); }
  const replica = process.argv.includes('--replica');
  const resumen = await correrHumoPantallas(replica ? ENTRADA_REPLICA : ENTRADA_DESARROLLO);
  const texto = jsonCanonico(resumen);
  mkdirSync(join(RAIZ, 'salida'), { recursive: true });
  const ruta = join(RAIZ, 'salida', `humo_pantallas_anillo.${replica ? 'replica' : modo}.json`);
  writeFileSync(ruta, `${texto}\n`);
  console.log(`humo_pantallas: ${ruta}`);
  console.log(`humo_pantallas: sha256 ${sha256De(texto)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => { console.error('humo_pantallas: falló', e); process.exit(1); });
}
