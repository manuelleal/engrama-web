#!/usr/bin/env node
// @ts-check
// humo.mjs · Humo de sintéticos con hash estable (ESPEC_mvp_uis.md §9.1, W15). Corre el guion
// completo con el CLIENTE real (src/api/*.js) contra un mock_api real detrás del mismo proxy que
// usaría el navegador (servidor_dev.mjs) — así "fugas.peticiones_fuera_de_api" y
// "claves_antes_de_responder" miden lo mismo que medirían los E2E, sin necesitar un navegador. El
// guion en sí vive en herramientas/humo/flujo.mjs.
//
// Uso: node herramientas/humo.mjs --contra mock   (--contra local llega con W17, backend de F4)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearServidor } from './servidor_dev.mjs';
import { crearMockApi } from './mock_api.mjs';
import { crearEstado, ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from './mock/estado.mjs';
import { configurarRaizApi } from '../src/api/cliente.js';
import {
  pasoAdmin, pasoSembrar, pasoAsistencia, pasoResolverRetos, leerSaldos, pasoLecturaDocente,
  reiniciarContadorDeFugas, contadorDeFugas,
} from './humo/flujo.mjs';
import { jsonCanonico, sha256De } from './humo/canon.mjs';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = resolve(AQUI, '..');
const RUTA_UNIDAD_SINTETICA = join(RAIZ, 'tests', 'fixtures', 'unidad_sintetica.json');

/** Instrumenta `fetch` global para contar peticiones que NO pasan por el proxy `/api` (V1/E1
 * ya lo prueban por otras vías; esto es la tercera capa, la que corre en el humo, §9.3 X1). */
function instrumentarFetch(prefijoValido) {
  const original = globalThis.fetch;
  let fueraDeApi = 0;
  globalThis.fetch = async (url, opciones) => {
    if (!String(url).startsWith(prefijoValido)) fueraDeApi += 1;
    return original(url, opciones);
  };
  return { contador: () => fueraDeApi, restaurar: () => { globalThis.fetch = original; } };
}

async function levantarServidores() {
  const estado = crearEstado();
  const mock = crearMockApi(estado);
  await new Promise((ok) => mock.listen(0, '127.0.0.1', ok));
  const apiUrlDirecta = `http://127.0.0.1:${mock.address().port}`;
  const dev = crearServidor();
  process.env.ENGRAMA_API_URL = apiUrlDirecta; // servidor_dev.mjs lo lee en cada petición
  await new Promise((ok) => dev.listen(0, '127.0.0.1', ok));
  const urlShell = `http://127.0.0.1:${dev.address().port}`;
  return { mock, dev, apiUrlDirecta, urlShell, cerrar: async () => { await new Promise((ok) => dev.close(ok)); await new Promise((ok) => mock.close(ok)); } };
}

/** Todo el guion de §9.1, punto 1 a 6. Devuelve el resumen ya en la forma final (sin fechas, con
 * los UUID cambiados por "est-N"/"reto-N" — nunca se leyó un UUID crudo para armarlo). El
 * sembrado (paso 2) es del OPERADOR, no del cliente (habla directo con la API, sin pasar por el
 * proxy `/api` del navegador — igual que en producción, §8): no cuenta para las fugas.
 */
async function correrGuionCompleto(apiUrlDirecta, urlShell) {
  reiniciarContadorDeFugas();
  const prefijoApi = `${urlShell}/api/`;

  const registro1 = instrumentarFetch(prefijoApi);
  const { grupoId, estudiantes } = await pasoAdmin(ADMIN_BOOTSTRAP_TOKEN);
  registro1.restaurar();

  const unidad = JSON.parse(readFileSync(RUTA_UNIDAD_SINTETICA, 'utf8'));
  const retos = await pasoSembrar(unidad, grupoId, apiUrlDirecta, DOCENTE_BOOTSTRAP_TOKEN);

  const registro2 = instrumentarFetch(prefijoApi);
  const asistencia = await pasoAsistencia(DOCENTE_BOOTSTRAP_TOKEN, grupoId, estudiantes);
  const resueltos = await pasoResolverRetos(estudiantes, retos);
  const monedas = await leerSaldos(estudiantes);
  const lectura = await pasoLecturaDocente(DOCENTE_BOOTSTRAP_TOKEN, grupoId, estudiantes);
  registro2.restaurar();

  const fueraDeApi = registro1.contador() + registro2.contador();
  return armarResumen({ retos, asistencia, resueltos, monedas, lectura, fueraDeApi });
}

function armarResumen({ retos, asistencia, resueltos, monedas, lectura, fueraDeApi }) {
  return {
    grupo: { inscritos: lectura.inscritos },
    asistencia: { marcaron: asistencia.marcaron, tarde_410: asistencia.tarde410 },
    retos: { sembrados: retos.length, terminados: resueltos.terminados, envios_por_doble_toque: resueltos.envios_por_doble_toque },
    monedas,
    logro: lectura.logro,
    errores: lectura.errores,
    fugas: { claves_antes_de_responder: contadorDeFugas(), peticiones_fuera_de_api: fueraDeApi },
  };
}

async function correrUnaVez(modo) {
  const { apiUrlDirecta, urlShell, cerrar } = await levantarServidores();
  configurarRaizApi(urlShell);
  try {
    return await correrGuionCompleto(apiUrlDirecta, urlShell);
  } finally {
    configurarRaizApi('');
    await cerrar();
  }
}

async function main() {
  const iContra = process.argv.indexOf('--contra');
  const modo = iContra >= 0 ? process.argv[iContra + 1] : 'mock';
  if (modo !== 'mock') { console.error(`humo: --contra "${modo}" no está soportado todavía (llega con W17)`); process.exit(2); }

  const resumen = await correrUnaVez(modo);
  const texto = jsonCanonico(resumen);
  const hash = sha256De(texto);
  mkdirSync(join(RAIZ, 'salida'), { recursive: true });
  const rutaSalida = join(RAIZ, 'salida', `humo_mvp_uis.${modo}.json`);
  writeFileSync(rutaSalida, `${texto}\n`);
  console.log(`humo: ${rutaSalida}`);
  console.log(`humo: sha256 ${hash}`);
}

main().catch((e) => { console.error('humo: falló', e); process.exit(1); });
