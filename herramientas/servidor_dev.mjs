#!/usr/bin/env node
// @ts-check
// servidor_dev.mjs · Servidor de desarrollo: estáticos + proxy /api/* → ENGRAMA_API_URL (§6.2).
// Mismo origen que la API, así que nunca hace falta CORS (el backend de hoy no tiene
// CORSMiddleware — §3 de la espec). Node puro (`node:http`), sin dependencias.
//
// Uso:
//   node herramientas/servidor_dev.mjs                          # PUERTO=8080, sin proxy real (502)
//   ENGRAMA_API_URL=http://127.0.0.1:8000 node herramientas/servidor_dev.mjs
import { createServer, request as httpRequest } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
export const RAIZ = resolve(AQUI, '..');
const PUERTO = Number(process.env.PUERTO || 8080);
// Se lee en cada petición (no una vez al cargar el módulo): así los tests pueden apuntar el
// proxy a un mock_api.mjs propio sin reiniciar el proceso ni pelear con el orden de los imports.
function apiUrlActual() {
  return process.env.ENGRAMA_API_URL || '';
}

// Solo estas rutas se sirven como archivos: nada de listar el proyecto entero (tests/, docs/,
// herramientas/, .git — nada de eso debe llegar nunca a un navegador).
const RAICES_ESTATICAS = ['estilos', 'publico', 'src', 'contratos'];
const ARCHIVOS_SUELTOS = ['index.html', 'manifest.webmanifest', 'sw.js'];

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/** @param {string} rutaPedida sin query, ya decodificada. @returns {string|null} ruta absoluta si es servible */
export function resolverArchivo(rutaPedida) {
  const limpia = normalize(rutaPedida).replace(/^([/\\])+/, '');
  const camino = limpia === '' ? 'index.html' : limpia;
  if (ARCHIVOS_SUELTOS.includes(camino)) return join(RAIZ, camino);
  const primeraParte = camino.split(/[/\\]/)[0];
  if (!RAICES_ESTATICAS.includes(primeraParte)) return null;
  const absoluta = join(RAIZ, camino);
  // Nada de escapar RAIZ con "..": normalize ya colapsa ".." pero lo revisamos de nuevo por si acaso.
  if (!absoluta.startsWith(RAIZ)) return null;
  return absoluta;
}

function servirEstatico(res, rutaAbsoluta) {
  if (!existsSync(rutaAbsoluta) || !statSync(rutaAbsoluta).isFile()) { res.writeHead(404).end('no encontrado'); return; }
  const ext = rutaAbsoluta.slice(rutaAbsoluta.lastIndexOf('.'));
  res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream' });
  res.end(readFileSync(rutaAbsoluta));
}

function proxyApi(req, res, rutaConQuery) {
  const apiUrl = apiUrlActual();
  if (!apiUrl) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'ENGRAMA_API_URL no está configurada (o usa mock_api.mjs, W4)' }));
    return;
  }
  const destino = new URL(rutaConQuery, apiUrl);
  const cabeceras = { ...req.headers, host: destino.host };
  const proxied = httpRequest(destino, { method: req.method, headers: cabeceras }, (respBackend) => {
    res.writeHead(respBackend.statusCode || 502, respBackend.headers);
    respBackend.pipe(res);
  });
  proxied.on('error', (e) => {
    console.error('servidor_dev: el backend no respondió', e); // nunca un catch mudo (REGLAS.md §4)
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'no se pudo hablar con el backend' }));
  });
  req.pipe(proxied);
}

export function crearServidor() {
  return createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) { proxyApi(req, res, url.pathname.slice('/api'.length) + url.search); return; }
    const rutaAbsoluta = resolverArchivo(decodeURIComponent(url.pathname));
    if (!rutaAbsoluta) { res.writeHead(404).end('no encontrado'); return; }
    servirEstatico(res, rutaAbsoluta);
  });
}

function main() {
  const servidor = crearServidor();
  servidor.listen(PUERTO, () => {
    console.log(`servidor_dev: http://127.0.0.1:${PUERTO}  (ENGRAMA_API_URL=${apiUrlActual() || '(sin configurar)'})`);
  });
}

const esCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCLI) main();
