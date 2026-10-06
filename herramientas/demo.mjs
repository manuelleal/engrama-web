#!/usr/bin/env node
// @ts-check
// demo.mjs · UN comando para VER ENGRAMA en esta máquina: levanta el backend de mentira (mock_api, datos
// sintéticos) y el servidor de desarrollo (mismo origen, proxy /api), con un grupo, dos estudiantes, tres
// retos de práctica y una sesión de asistencia abierta. Sin Docker, sin npm, sin red. Nada se guarda en
// disco: al cerrar (Ctrl+C) todo desaparece. Solo para desarrollo — el despliegue usa su propio config.json.
//
// Uso:  npm run demo            (o: node herramientas/demo.mjs [--puerto 8080])
// Luego abre la dirección que imprime, entra como "Ana Sintética · Estudiante" y juega.
import { crearServidor } from './servidor_dev.mjs';
import { crearMockApi } from './mock_api.mjs';
import { crearEstado, ADMIN_BOOTSTRAP_TOKEN, DOCENTE_BOOTSTRAP_TOKEN } from './mock/estado.mjs';
import { crearGrupo, asignarDocente, importarCsv } from './mock/rutas_admin.mjs';
import { crearChallenge } from './mock/rutas_challenges.mjs';
import { abrirSesion } from './mock/rutas_teachers.mjs';

const reqAdmin = () => ({ headers: { authorization: `Bearer ${ADMIN_BOOTSTRAP_TOKEN}` } });
const reqDocente = () => ({ headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } });

const RETOS = [
  ['Daily Routines · Reto 1', [['What time do you ___ up?', 'A', ['get', 'gets']], ['She ___ breakfast at 7.', 'B', ['have', 'has']], ['They ___ to school by bus.', 'A', ['go', 'goes']]]],
  ['At the Airport · Reto 2', [['Where is the ___?', 'B', ['gates', 'gate']], ['I would like a ___ seat.', 'A', ['window', 'windows']], ['Your ___ is ready.', 'B', ['tickets', 'ticket']]]],
  ['Job Interview · Reto 3', [['I have ___ experience.', 'A', ['some', 'any']], ['She ___ in marketing for five years.', 'B', ['work', 'has worked']], ['Tell me ___ yourself.', 'A', ['about', 'on']]]],
];

/** El grupo, dos estudiantes (Ana y Beto), tres retos y una sesión de asistencia abierta. */
export function sembrarDemo(estado) {
  const { cuerpo: grupo } = crearGrupo(estado, reqAdmin(), { group_code: 'SINT-B1-01' });
  asignarDocente(estado, reqAdmin(), grupo.id, { documento_id: 'DOCENTE-DEMO' });
  importarCsv(estado, reqAdmin(), grupo.id, 'documento_id,nombre_completo\nest-1,Ana Sintetica\nest-2,Beto Sintetico\n');
  for (const [titulo, preguntas] of RETOS) {
    crearChallenge(estado, reqDocente(), {
      title: titulo, description: 'Reto de demostración (datos sintéticos)', group_id: grupo.id, coins_reward: 30, xp_reward: 3,
      questions: preguntas.map(([texto, buena, opciones]) => ({
        question_text: texto, correct_answer: buena,
        options_json: opciones.map((value, i) => ({ label: 'AB'[i], value })),
      })),
    });
  }
  const { cuerpo: sesion } = abrirSesion(estado, reqDocente(), grupo.id, {});
  return { grupoId: grupo.id, codigoAsistencia: sesion.session_code };
}

async function main() {
  const i = process.argv.indexOf('--puerto');
  if (i >= 0) process.env.PUERTO = process.argv[i + 1];
  const puerto = Number(process.env.PUERTO || 8080);
  const estado = crearEstado();
  const { codigoAsistencia } = sembrarDemo(estado);
  const mock = crearMockApi(estado);
  await new Promise((ok) => mock.listen(0, '127.0.0.1', ok));
  process.env.ENGRAMA_API_URL = `http://127.0.0.1:${/** @type {any} */ (mock.address()).port}`;
  const dev = crearServidor();
  await new Promise((ok, mal) => { dev.once('error', mal); dev.listen(puerto, '127.0.0.1', ok); });
  console.log([
    '', 'ENGRAMA · demo local (datos sintéticos, nada se guarda)', '',
    `  Abre:  http://127.0.0.1:${puerto}/`,
    '  Entra como:  "Ana Sintética · Estudiante"  (Beto también; "Docente Demo" y "Admin Demo" para el panel)',
    `  Código de asistencia para probar el sello:  ${codigoAsistencia}   (Asistencia > escribirlo > Marcar)`,
    '  Retos:  3 de práctica en la pestaña "Retos". Juégalos: perfecto, con ánimo...',
    '  El sonido empieza al primer toque; el botón "Con sonido" lo silencia. En el celular también vibra.',
    '', '  Ctrl+C para cerrar.', '',
  ].join('\n'));
}

const esCLI = process.argv[1] && process.argv[1].endsWith('demo.mjs');
if (esCLI) main().catch((e) => { console.error(`demo: falló (${e.code === 'EADDRINUSE' ? 'el puerto está ocupado: usa --puerto 8081' : e.message})`); process.exit(1); });
