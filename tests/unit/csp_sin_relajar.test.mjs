// @ts-check
// La CSP de index.html sigue en 'self': sumar anime.js y canvas-confetti (vendor/) NO la relaja. Si una librería pidiera
// 'unsafe-eval', 'unsafe-inline', blob: o un origen externo, no se usa (queda el confeti propio de ui/confeti.js).
// Además la del Caddyfile del despliegue tiene que ser la MISMA (H-15 de la auditoría de seguridad 02).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

/** @param {string} html */
export function cspDeIndex(html) {
  const m = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(html);
  return m ? m[1] : null;
}

/** "a 'self'; b 'self' x" → { a: ["'self'"], b: ["'self'", 'x'] } */
export function directivas(csp) {
  const mapa = {};
  for (const trozo of csp.split(';').map((t) => t.trim()).filter(Boolean)) {
    const [nombre, ...valores] = trozo.split(/\s+/);
    mapa[nombre] = valores;
  }
  return mapa;
}

test('CSP: script-src, style-src y default-src siguen EXACTAMENTE en \'self\' (sin unsafe-eval, unsafe-inline, blob: ni orígenes externos)', () => {
  const csp = cspDeIndex(readFileSync(`${RAIZ}index.html`, 'utf8'));
  assert.ok(csp, 'index.html debe traer su <meta http-equiv="Content-Security-Policy">');
  const d = directivas(csp);
  for (const nombre of ['default-src', 'script-src', 'style-src']) assert.deepEqual(d[nombre], ["'self'"], `${nombre} se relajó`);
  assert.doesNotMatch(csp, /unsafe-eval|unsafe-inline|wasm-unsafe-eval|blob:|https?:|\*/, 'la CSP no admite nada de eso');
  assert.equal(d['worker-src'], undefined, 'no hay worker-src: ninguna librería usa workers (canvas-confetti va con useWorker:false)');
  assert.deepEqual(d['object-src'], ["'none'"]);
});

test('CSP: la del Caddyfile del despliegue es la misma que la de index.html (si el despliegue está al lado)', () => {
  const caddy = `${RAIZ}../despliegue/Caddyfile`;
  if (!existsSync(caddy)) return; // este repo solo, sin el despliegue al lado
  const enCaddy = /Content-Security-Policy\s+"([^"]*)"/.exec(readFileSync(caddy, 'utf8'))?.[1];
  const enIndex = cspDeIndex(readFileSync(`${RAIZ}index.html`, 'utf8'));
  assert.deepEqual(directivas(String(enCaddy)), directivas(String(enIndex)));
});
