#!/usr/bin/env node
// @ts-check
// mock_api.mjs · Un backend de mentira que habla las formas EXACTAS de engrama-backend (W4,
// ESPEC_mvp_uis.md §11), para desarrollar y probar el cliente sin Docker ni Supabase. No es un
// simulacro de seguridad: la auth es un alias de texto (ver herramientas/mock/auth.mjs), nunca
// un JWT. Las formas de cada respuesta y los códigos de error se leyeron del código real de
// `engrama-backend` (rama `test/fixture-integ`, `c7a8b89`) y de `docs/ESPEC_bug13a15.md`; donde
// esa espec (preregistro, sin commitear en el backend) y el coordinador piden adoptar ya el
// contrato corregido (BUG-13/14/15: una sola paga, check-in y retos solo del propio grupo), el
// mock lo hace — así el cliente no tiene que reescribirse cuando F4 lo despliegue.
//
// Uso: node herramientas/mock_api.mjs [--puerto 8090]
// Actores de arranque (Bearer <token>): "admin-demo" y "docente-demo" (ver mock/estado.mjs).
// Cada estudiante inscrito (M3/M4) queda con token = su documento_id.
import { createServer } from 'node:http';
import { crearEstado } from './mock/estado.mjs';
import { ErrorHTTP } from './mock/errores.mjs';
import { leerMe } from './mock/rutas_auth.mjs';
import { crearGrupo, asignarDocente, inscribirUnEstudiante, importarCsv } from './mock/rutas_admin.mjs';
import {
  listarGrupos, listarEstudiantes, abrirSesion, cerrarSesion, leerLogro, asignarReto, leerErroresDeItem,
} from './mock/rutas_teachers.mjs';
import { listarChallenges, listarTodosLosChallenges, verChallenge, cambiarEstado, crearChallenge } from './mock/rutas_challenges.mjs';
import { arrancarIntento, enviarIntento, historialDeIntentos } from './mock/rutas_intentos.mjs';
import {
  leerSaldo, leerHistorialMonedas, checkIn, historialAsistenciaPropio, historialAsistenciaDeEstudiante,
} from './mock/rutas_core.mjs';

const RUTAS = construirRutas();

function construirRutas() {
  const r = (metodo, patron, manejador, { textoCrudo = false } = {}) => ({ metodo, patron: compilar(patron), manejador, textoCrudo });
  return [
    r('GET', '/health', () => ({ status: 200, cuerpo: { status: 'ok' } })),
    r('GET', '/auth/me', (estado, req) => leerMe(estado, req)),
    r('POST', '/auth/session', (estado, req) => leerMe(estado, req)),

    r('POST', '/admin/groups', (estado, req, p, body) => crearGrupo(estado, req, body)),
    r('POST', '/admin/groups/:gid/teachers', (estado, req, p, body) => asignarDocente(estado, req, p.gid, body)),
    r('POST', '/admin/groups/:gid/students', (estado, req, p, body) => inscribirUnEstudiante(estado, req, p.gid, body)),
    r('POST', '/admin/groups/:gid/students/import', (estado, req, p, body) => importarCsv(estado, req, p.gid, body), { textoCrudo: true }),

    r('GET', '/teachers/groups', (estado, req) => listarGrupos(estado, req)),
    r('GET', '/teachers/groups/:gid/students', (estado, req, p) => listarEstudiantes(estado, req, p.gid)),
    r('GET', '/teachers/groups/:gid/achievement', (estado, req, p) => leerLogro(estado, req, p.gid)),
    r('GET', '/teachers/groups/:gid/item-errors', (estado, req, p) => leerErroresDeItem(estado, req, p.gid)),
    r('POST', '/teachers/groups/:gid/attendance-sessions', (estado, req, p, body) => abrirSesion(estado, req, p.gid, body)),
    r('PUT', '/teachers/groups/:gid/challenges/:cid', (estado, req, p) => asignarReto(estado, req, p.gid, p.cid)),
    r('POST', '/teachers/attendance-sessions/:sid/close', (estado, req, p) => cerrarSesion(estado, req, p.sid)),

    r('GET', '/challenges/attempts/history', (estado, req) => historialDeIntentos(estado, req)),
    r('GET', '/challenges/all', (estado, req) => listarTodosLosChallenges(estado, req)),
    r('GET', '/challenges/', (estado, req) => listarChallenges(estado, req)),
    r('POST', '/challenges/', (estado, req, p, body) => crearChallenge(estado, req, body)),
    r('POST', '/challenges/attempts/:attempt_id/submit', (estado, req, p, body) => enviarIntento(estado, req, p.attempt_id, body)),
    r('PATCH', '/challenges/:challenge_id/status', (estado, req, p, body) => cambiarEstado(estado, req, p.challenge_id, body)),
    r('POST', '/challenges/:challenge_id/attempt', (estado, req, p) => arrancarIntento(estado, req, p.challenge_id)),
    r('GET', '/challenges/:challenge_id', (estado, req, p) => verChallenge(estado, req, p.challenge_id)),

    r('GET', '/core/coins/balance', (estado, req) => leerSaldo(estado, req)),
    r('GET', '/core/coins/history', (estado, req, p, body, url) => leerHistorialMonedas(estado, req, Number(url.searchParams.get('limit')) || 20)),
    r('POST', '/core/attendance/check-in', (estado, req, p, body) => checkIn(estado, req, body)),
    r('GET', '/core/attendance/history', (estado, req) => historialAsistenciaPropio(estado, req)),
    r('GET', '/core/attendance/history/:student_id', (estado, req, p) => historialAsistenciaDeEstudiante(estado, req, p.student_id)),
  ];
}

function compilar(patron) {
  const nombres = [];
  const fuente = patron.split('/').filter(Boolean).map((parte) => {
    if (parte.startsWith(':')) { nombres.push(parte.slice(1)); return '([^/]+)'; }
    return parte;
  }).join('/');
  return { regex: new RegExp(`^/${fuente}/?$`), nombres };
}

function emparejar(metodo, pathname) {
  for (const ruta of RUTAS) {
    if (ruta.metodo !== metodo) continue;
    const m = ruta.patron.regex.exec(pathname);
    if (!m) continue;
    const params = {};
    ruta.patron.nombres.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
    return { ruta, params };
  }
  return null;
}

function leerCuerpo(req) {
  return new Promise((resolver, rechazar) => {
    let datos = '';
    req.on('data', (t) => { datos += t; });
    req.on('end', () => resolver(datos));
    req.on('error', rechazar);
  });
}

/** @param {ReturnType<typeof crearEstado>} estado */
export function crearMockApi(estado = crearEstado()) {
  return createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const emparejado = emparejar(req.method || 'GET', url.pathname);
    if (!emparejado) { responder(res, 404, { detail: 'Not Found' }); return; }
    try {
      const crudo = await leerCuerpo(req);
      const body = emparejado.ruta.textoCrudo ? crudo : (crudo ? JSON.parse(crudo) : undefined);
      const { status, cuerpo } = await emparejado.ruta.manejador(estado, req, emparejado.params, body, url);
      responder(res, status, cuerpo);
    } catch (e) {
      if (e instanceof ErrorHTTP) { responder(res, e.status, e.cuerpo); return; }
      console.error('mock_api: error no controlado', e); // nunca un catch mudo (REGLAS.md §4)
      responder(res, 500, { detail: 'internal error' });
    }
  });
}

function responder(res, status, cuerpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(cuerpo));
}

function main() {
  const iPuerto = process.argv.indexOf('--puerto');
  const puerto = iPuerto >= 0 ? Number(process.argv[iPuerto + 1]) : 8090;
  const servidor = crearMockApi();
  servidor.listen(puerto, () => console.log(`mock_api: http://127.0.0.1:${puerto}  (actores: admin-demo, docente-demo)`));
}

const esCLI = process.argv[1] && process.argv[1].endsWith('mock_api.mjs');
if (esCLI) main();
