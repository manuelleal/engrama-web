// @ts-check
// El servidor de desarrollo sirve /vendor/* (anime.js y canvas-confetti) con el tipo de contenido de un módulo JS y no
// deja salir de la carpeta. El Caddyfile del despliegue tiene su propia lista blanca de estáticos: ahí hay que sumar
// `/vendor/*` (ver el informe del encargo y vendor/PROCEDENCIA.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { crearServidor, resolverArchivo } from '../../herramientas/servidor_dev.mjs';

const LIBRERIAS = ['/vendor/animejs@4.5.0/anime.esm.min.js', '/vendor/canvas-confetti@1.9.4/confetti.module.mjs'];

test('servidor_dev: /vendor/* se resuelve; lo que no es de las raíces estáticas sigue sin servirse', () => {
  for (const ruta of LIBRERIAS) assert.ok(resolverArchivo(ruta), `${ruta} debería servirse`);
  assert.equal(resolverArchivo('/vendor/../package.json'), null, 'no se sale de la carpeta con ..');
  assert.equal(resolverArchivo('/herramientas/servidor_dev.mjs'), null);
  assert.equal(resolverArchivo('/tests/unit/x.mjs'), null);
});

test('servidor_dev: por HTTP, las dos librerías llegan idénticas a PROCEDENCIA.md y con tipo JavaScript', async () => {
  const servidor = crearServidor();
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(undefined)));
  try {
    const { port } = /** @type {import('node:net').AddressInfo} */ (servidor.address());
    for (const ruta of LIBRERIAS) {
      const r = await fetch(`http://127.0.0.1:${port}${ruta}`);
      assert.equal(r.status, 200, ruta);
      assert.match(r.headers.get('content-type') || '', /text\/javascript/);
      const cuerpo = Buffer.from(await r.arrayBuffer());
      const enDisco = readFileSync(new URL(`../..${ruta}`, import.meta.url));
      assert.equal(createHash('sha256').update(cuerpo).digest('hex'), createHash('sha256').update(enDisco).digest('hex'));
    }
    const fuera = await fetch(`http://127.0.0.1:${port}/herramientas/servidor_dev.mjs`);
    assert.equal(fuera.status, 404);
  } finally { servidor.close(); }
});
