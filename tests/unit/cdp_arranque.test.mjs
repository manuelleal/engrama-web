// @ts-check
// herramientas/cdp.mjs: el arranque del navegador no falla ni deja un proceso vivo cuando Windows todavía tiene ocupado `DevToolsActivePort`.
// (Medido en esta máquina: con la CPU cargada, `readFileSync` daba EBUSY, el error salía sin cerrar el navegador y quedaba un Edge huérfano.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { leerPuertoDevTools, conProcesoPropio } from '../../herramientas/cdp.mjs';

const ocupado = (code) => Object.assign(new Error(`${code}: resource busy or locked`), { code });
const sinPausa = async () => {};

test('leerPuertoDevTools: un EBUSY (o EPERM, o el archivo aún sin crear) se reintenta hasta que el navegador termina de escribir', async () => {
  const intentos = [() => { throw ocupado('ENOENT'); }, () => { throw ocupado('EBUSY'); }, () => { throw ocupado('EPERM'); }, () => '', () => '9222\n', () => '9222\n/devtools/browser/abc\n'];
  let n = 0;
  const ws = await leerPuertoDevTools('DevToolsActivePort', 5000, { leer: () => intentos[n++](), pausa: sinPausa });
  assert.equal(ws, 'ws://127.0.0.1:9222/devtools/browser/abc');
  assert.equal(n, 6, 'leyó hasta tener el puerto y la ruta completos');
});

test('leerPuertoDevTools: otro error de lectura (no es "ocupado") se propaga tal cual, sin reintentar', async () => {
  let n = 0;
  await assert.rejects(leerPuertoDevTools('x', 5000, { leer: () => { n++; throw ocupado('EISDIR'); }, pausa: sinPausa }), /EISDIR/);
  assert.equal(n, 1);
});

test('leerPuertoDevTools: si el navegador nunca escribe el puerto, falla al llegar al límite (no se queda esperando para siempre)', async () => {
  await assert.rejects(leerPuertoDevTools('x', 30, { leer: () => { throw ocupado('EBUSY'); }, pausa: (ms) => new Promise((r) => setTimeout(r, ms)) }), /no escribió DevToolsActivePort/);
});

test('conProcesoPropio: si el arranque falla, cierra el proceso que lanzó y relanza el error; si sale bien, no lo toca', async () => {
  let cerrados = 0;
  const proc = { kill: () => { cerrados++; } };
  assert.equal(await conProcesoPropio(proc, async () => 'ws'), 'ws');
  assert.equal(cerrados, 0);
  await assert.rejects(conProcesoPropio(proc, async () => { throw new Error('no abrió el WebSocket de DevTools'); }), /no abrió el WebSocket/);
  assert.equal(cerrados, 1, 'el navegador propio no queda huérfano');
});
