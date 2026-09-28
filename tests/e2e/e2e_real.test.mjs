// @ts-check
// Encargo C (W22): el mismo flujo de herramientas/e2e_real.mjs, como prueba OPCIONAL — se salta
// sola (no falla) si el stack de ENGRAMA/despliegue/ no responde, así la suite normal
// (`npm test`, sin Docker) nunca se rompe por esto. Para correrla de verdad: levanta el stack
// (LEEME_piloto.md) y corre `node --test tests/e2e/e2e_real.test.mjs`, o directo
// `node herramientas/e2e_real.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { stackArriba, correrE2eReal } from '../../herramientas/e2e_real.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));

const ARRIBA = HAY_NAVEGADOR && (await stackArriba());

test(
  'E2E real: profe abre asistencia, estudiante entra de verdad, marca, juega y revisa; el profe ve el logro',
  { skip: !ARRIBA && 'el stack de despliegue/ no responde en http://localhost:8088 (docker compose up -d --build) o no hay navegador' },
  async () => {
    const { carpeta, registro } = await correrE2eReal();
    assert.ok(registro.length >= 4, 'al menos 4 capturas del flujo real');
    for (const item of registro) assert.ok(existsSync(`${carpeta}/${item.archivo}`), `falta la captura ${item.archivo}`);
  },
);
