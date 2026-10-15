// @ts-check
// Encargo C (W22): el mismo flujo de herramientas/e2e_real.mjs, como prueba OPCIONAL contra el piloto VIVO.
// ERR-27: solo corre con la bandera explícita `E2E_REAL=1`. Sin ella se salta SIN sondear nada (ni siquiera
// `GET /api/health`), así `node --test` (la suite completa) nunca toca el piloto, tenga o no las credenciales.
// Para correrla de verdad: levanta el stack (LEEME_piloto.md) y corre
//   E2E_REAL=1 node --test tests/e2e/e2e_real.test.mjs      (o directo: node herramientas/e2e_real.mjs)
// La bandera y el no-sondeo los fija tests/unit/e2e_real_bandera.test.mjs (tramposo: tests/tramposos/err27_e2e_real_sin_bandera).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { e2eRealActivado, stackArriba, correrE2eReal } from '../../herramientas/e2e_real.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));

const ACTIVADO = e2eRealActivado();
// El sondeo SOLO se intenta con la bandera: `&&` en cortocircuito, sin bandera `stackArriba` ni se llama.
// TRAMPOSO ERR-27: ignora la bandera y sondea siempre, como antes.
const ARRIBA = HAY_NAVEGADOR && (await stackArriba());

const MOTIVO_SALTO = !ACTIVADO
  ? 'e2e_real juega contra el piloto VIVO y solo corre con la bandera explícita: levanta el stack (docker compose up -d --build en despliegue/) y corre E2E_REAL=1 node --test tests/e2e/e2e_real.test.mjs'
  : 'E2E_REAL=1 está puesta, pero el stack de despliegue/ no responde en http://localhost:8088 (docker compose up -d --build) o no hay navegador';

test(
  'E2E real: profe abre asistencia, estudiante entra de verdad, marca, juega y revisa; el profe ve el logro',
  { skip: !ARRIBA && MOTIVO_SALTO },
  async () => {
    const { carpeta, registro } = await correrE2eReal();
    assert.ok(registro.length >= 4, 'al menos 4 capturas del flujo real');
    for (const item of registro) assert.ok(existsSync(`${carpeta}/${item.archivo}`), `falta la captura ${item.archivo}`);
  },
);
