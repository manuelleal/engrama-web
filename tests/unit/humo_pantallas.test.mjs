// @ts-check
// W36 (docs/ESPEC_pantallas_anillo.md §9.1 y §9.4, METODO reglas 6 y 7): el humo de sintéticos de las pantallas del anillo ESCRIBE su archivo, con el mismo
// sha256 en dos corridas, y con la tabla de §9.1 (entradas de desarrollo, semilla 20261006) o la de la réplica (entradas nuevas, semilla 7). Las tablas están
// fijadas AQUÍ, antes de la primera medición del código bueno: si el humo da otra cosa, no se edita la tabla, se registra un candidato a ERR.
// Se corre el script de verdad (un proceso hijo por corrida), como lo haría quien lo lanza a mano.
// Tramposos: x_humo_pase_en_consola (src/anillo/abrir.js) y x_humo_registro_distinto (herramientas/mock/rutas_registro.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const SALIDA = (nombre) => `${RAIZ}salida/${nombre}`;

const FORMAS_DESARROLLO = [
  '<EVA>/e#pase=<pase>&sala=1234', '<EVA>/tablero#pase=<pase>', '<EVA>/escamas#pase=<pase>',
  '<SET>/index.html#UIS-0001&pase=<pase>&tenant=<tenant>', '<SET>/revisar.html#pase=<pase>&tenant=<tenant>',
];
const FUGAS_EN_CERO = { peticiones_fuera_de_api: 0, pase_en_almacenamiento: 0, pase_en_consola: 0, contrasena_en_almacenamiento: 0, codigo_de_grupo_en_almacenamiento: 0 };

/** §9.1, tal cual la fijó la espec. */
const ESPERADO_DESARROLLO = {
  semilla: 20261006,
  codigo: { activo_antes: false, activo_despues: true, cupo: 8, usos_al_final: 7, formato_ok: true },
  registro: { 201: 9, 403: 1, pendientes_creadas: 7, sin_clave: 503 },
  espera: { pending_approval: 7, bloqueo: 'pendiente' },
  profe: { listadas: 7, aprobadas: 5, rechazadas: 2, repetir_aprobar: 200, aprobar_rechazada: 404, docente_ajeno: 404 },
  entrada: { entran: 5, login_falla: 2 },
  escudo: ['Por confirmar', 'B1 · Provisional', 'A2 · Confirmado', 'B1 · Confirmado'],
  suspendida: { detalle: 'account_suspended', bloqueo: 'suspendida' },
  solicitudes: { creadas: 8, tope_409: 1, est1: { abierta: 2, resuelta: 1 }, est5: 0 },
  enlaces: { formas: FORMAS_DESARROLLO, pase_en_consulta: 0, a_set_sin_tenant: 0, sin_configuracion: 0 },
  fugas: FUGAS_EN_CERO,
};

/** §9.4: el mismo criterio salvo los valores que dependen de la entrada (nivel, bases, sala y examen), más lo que solo la réplica ejercita. */
const ESPERADO_REPLICA = {
  ...ESPERADO_DESARROLLO,
  semilla: 7,
  escudo: ['Por confirmar', 'A1 · Provisional', 'C1 · Confirmado', 'A2 · Confirmado'],
  enlaces: {
    formas: [
      '<EVA>/e#pase=<pase>&sala=AULA7b', '<EVA>/tablero#pase=<pase>', '<EVA>/escamas#pase=<pase>',
      '<SET>/index.html#UIS_A1_0001&pase=<pase>&tenant=<tenant>', '<SET>/revisar.html#pase=<pase>&tenant=<tenant>',
    ],
    pase_en_consulta: 0, a_set_sin_tenant: 0, sin_configuracion: 0,
  },
  replica: {
    codigos_distintos: true, grupo2_inscribe: 1, cruzado_404: 404, vencido_403: 403, retry_after: 599, dos_campos_422: 2,
    nivel_por_institucion: ['B1 · Confirmado', 'Por confirmar'], enlace_tenant_activo: true, pase_raro_ok: true,
    nombres_ida_y_vuelta: true, solicitud_1000_ok: true,
  },
};

/** Corre el script y devuelve lo que escribió (el archivo, su sha256 y el que el script imprimió). */
function correr(archivo, ...args) {
  rmSync(SALIDA(archivo), { force: true });
  const r = spawnSync(process.execPath, ['herramientas/humo_pantallas.mjs', '--contra', 'mock', ...args], { cwd: RAIZ, encoding: 'utf8', timeout: 120_000 });
  assert.equal(r.status, 0, `el humo salió con ${r.status}: ${r.stderr}`);
  assert.ok(existsSync(SALIDA(archivo)), `el humo no escribió salida/${archivo} (METODO regla 6)`);
  const contenido = readFileSync(SALIDA(archivo), 'utf8');
  const impreso = /sha256 ([0-9a-f]{64})/.exec(r.stdout)?.[1];
  const calculado = createHash('sha256').update(contenido.replace(/\n$/, ''), 'utf8').digest('hex');
  assert.equal(impreso, calculado, 'el sha256 que imprime es el del texto canónico que escribió');
  return { json: JSON.parse(contenido), contenido, sha: calculado };
}

test('W36: el humo de las pantallas (desarrollo) escribe su archivo, da el mismo sha256 en dos corridas y la tabla de §9.1', () => {
  const a = correr('humo_pantallas_anillo.mock.json');
  const b = correr('humo_pantallas_anillo.mock.json');
  assert.equal(a.sha, b.sha, 'dos corridas, el mismo sha256');
  assert.equal(a.contenido, b.contenido);
  assert.deepEqual(a.json, ESPERADO_DESARROLLO);
});

test('W36: el humo de las pantallas no filtra: 0 peticiones fuera de /api, y el pase, las contraseñas y el código de grupo no están en un almacenamiento ni en la consola', () => {
  const { json } = correr('humo_pantallas_anillo.mock.json');
  assert.deepEqual(json.fugas, FUGAS_EN_CERO);
});

test('W36: el archivo del humo no trae fechas, UUID, correos ni nombres, y el pase y la institución van como <pase> y <tenant>', () => {
  const { contenido } = correr('humo_pantallas_anillo.mock.json');
  assert.doesNotMatch(contenido, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, 'ningún UUID');
  assert.doesNotMatch(contenido, /\d{4}-\d{2}-\d{2}T|@/, 'ni fechas ni correos');
  assert.doesNotMatch(contenido, /acceso-|Estudiante \d|clave-sintetica/, 'ni tokens, ni nombres, ni contraseñas');
  assert.match(contenido, /<pase>/);
  assert.match(contenido, /<tenant>/);
});

test('W36: la réplica (entradas nuevas, semilla 7) escribe su archivo, da el mismo sha256 en dos corridas y el mismo criterio con sus valores', () => {
  const a = correr('humo_pantallas_anillo.replica.json', '--replica');
  const b = correr('humo_pantallas_anillo.replica.json', '--replica');
  assert.equal(a.sha, b.sha, 'dos corridas, el mismo sha256');
  assert.deepEqual(a.json, ESPERADO_REPLICA);
  const dev = correr('humo_pantallas_anillo.mock.json');
  assert.notEqual(a.sha, dev.sha, 'otras entradas, otro hash (§9.4)');
});
