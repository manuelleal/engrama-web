// @ts-check
// Apoyo de tests/unit/e2e_real_bandera.test.mjs (ERR-27), se carga con `node --import`: cambia `fetch` por uno que NO sale a la red
// y anota cada URL que alguien intente sondear en el archivo de $SONDA_REGISTRO. Así se mide "¿intentó el sondeo?" sin tocar el puerto 8088.
import { appendFileSync } from 'node:fs';

globalThis.fetch = async (entrada) => {
  appendFileSync(String(process.env.SONDA_REGISTRO), `${String(entrada)}\n`);
  throw new Error('sonda_falsa: sin red a propósito');
};
