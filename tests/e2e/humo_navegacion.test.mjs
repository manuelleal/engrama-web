// @ts-check
// W75 (docs/ESPEC_navegacion.md §10, METODO reglas 6 y 7): el humo de sintéticos de la navegación ESCRIBE su archivo, con el mismo sha256 en dos
// corridas, y con la tabla de §10.1 (desarrollo, semilla 20261008, 375×812) o la de la réplica (§10.2: entradas nuevas, semilla 7, 360×640).
// La tabla de §10.1 es la de la espec, copiada tal cual. La de la réplica se fijó AQUÍ antes de la primera medición del código bueno: el mismo
// criterio, y lo que solo la réplica ejercita. Si el humo da otra cosa, no se edita la tabla: se registra un candidato a ERR.
// Corre el script de verdad (un proceso hijo por corrida), como quien lo lanza a mano. Vive en tests/e2e porque necesita el navegador (Edge o
// Chrome sin ventana): el humo recorre la app por toques. Tramposos: x_humo_ve_un_callejon (profe/sesion_asistencia.js),
// x_admin_sin_perfil_en_la_barra_humo (ui/nav_inferior.js), x_humo_con_nombres (herramientas/humo/flujo_navegacion.mjs) y x_conteo_sin_tope (profe/grupos.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { OMITIR } from './apoyo_nav_e2e.mjs';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const SALIDA = (nombre) => `${RAIZ}salida/${nombre}`;

/** §10.1, tal cual la fijó la espec (antes de cualquier código). */
const ESPERADO_DESARROLLO = {
  semilla: 20261008,
  rutas: { student: 9, teacher: 10, admin: 6 },
  barra: { student: ['Inicio', 'Retos', 'Asistencia', 'Perfil'], teacher: ['Mis grupos', 'Retos', 'Perfil'], admin: ['Grupos', 'Perfil'] },
  sin_barra: ['/retos/:id'],
  sin_salida: [],
  huerfanas: [],
  formas_de_volver: 1,
  pestanas_activas_a_la_vez_max: 1,
  al_inicio_max_toques: 2,
  toques: {
    profe_codigo: 2, profe_aprobar: 2, profe_asistencia: 2, profe_tablero_desde_asistencia: 2,
    est_asistencia: 2, est_reto: 1, est_clase: 2, est_examen: 2, cerrar_sesion: 2,
  },
  bajo_la_barra_375: 0,
  titulos_sin_grupo: 0,
  controles_con_el_mismo_nombre: 0,
  rol_ajeno: { profe_en_inicio: '/profe/grupos', estudiante_en_profe: '/inicio', desconocida: '<inicio del rol>' },
  asistencia_al_volver: 'codigo_en_pantalla',
  animacion_en_profe: 0,
};

/** §10.2: el mismo criterio (lo que dependía de la entrada aquí no cambia: mismas pantallas, mismos toques) y lo que solo la réplica ejercita. */
const ESPERADO_REPLICA = {
  ...ESPERADO_DESARROLLO,
  semilla: 7,
  replica: {
    ventana: '360x640',
    profe_dos_instituciones: { selector: true, instituciones: 2, grupos: 3 },
    grupo_de_40: { titulo_con_su_nombre: true, sin_estudiantes: true, barra: true, volver: 1, desborda: 0 },
    profe_sin_grupos: { tarjetas: 0, lo_dice: true, barra: ['Mis grupos', 'Retos', 'Perfil'], sin_salida: false },
    trece_grupos: { tarjetas: 13, conteos_pedidos: 12, conteo_que_falla: 1, pagina_completa: true },
    est_sin_eva_ni_set: { ahora: ['tarjeta-reto-hoy'], invitacion: 'tarjeta-reto-hoy' },
    est_sin_reto: { ahora: ['tarjeta-eva_celular', 'tarjeta-set_examen'], invitacion: 'tarjeta-eva_celular' },
    modo_mock_perfil: { titulo: 'Tu perfil', contrasena: false, quien_soy: true, cerrar_sesion: true, barra: ['Inicio', 'Retos', 'Asistencia', 'Perfil'] },
    asistencia_que_vence: 'formulario',
  },
};

/** Corre el script y devuelve lo que escribió (el archivo, su sha256 y el que el script imprimió). */
function correr(archivo, ...args) {
  rmSync(SALIDA(archivo), { force: true });
  const r = spawnSync(process.execPath, ['herramientas/humo_navegacion.mjs', '--contra', 'mock', ...args], { cwd: RAIZ, encoding: 'utf8', timeout: 240_000 });
  assert.equal(r.status, 0, `el humo salió con ${r.status}: ${r.stderr}`);
  assert.ok(existsSync(SALIDA(archivo)), `el humo no escribió salida/${archivo} (METODO regla 6)`);
  const contenido = readFileSync(SALIDA(archivo), 'utf8');
  const impreso = /sha256 ([0-9a-f]{64})/.exec(r.stdout)?.[1];
  const calculado = createHash('sha256').update(contenido.replace(/\n$/, ''), 'utf8').digest('hex');
  assert.equal(impreso, calculado, 'el sha256 que imprime es el del texto canónico que escribió');
  const { informativo, ...criterio } = JSON.parse(contenido);
  return { criterio, informativo, contenido, sha: calculado };
}

test('W75: el humo de navegación (desarrollo) escribe su archivo, da el mismo sha256 en dos corridas y la tabla de la espec (10.1), sin tocar', { skip: OMITIR, timeout: 600_000 }, (t) => {
  const a = correr('humo_navegacion.mock.json');
  const b = correr('humo_navegacion.mock.json');
  assert.equal(a.sha, b.sha, 'dos corridas, el mismo sha256');
  assert.equal(a.contenido, b.contenido);
  assert.deepEqual(a.criterio, ESPERADO_DESARROLLO);
  assert.deepEqual(a.informativo.formas, ['a|‹'], 'la única forma de volver es el enlace "‹ <a dónde>" del encabezado');
  t.diagnostic(`humo_navegacion.mock.json sha256 ${a.sha}`);
});

test('W75: el archivo del humo de navegación solo trae estructura: ni fechas, ni UUID, ni correos, ni nombres de persona, ni códigos de grupo', { skip: OMITIR, timeout: 300_000 }, () => {
  const { contenido } = correr('humo_navegacion.mock.json');
  assert.doesNotMatch(contenido, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, 'ningún UUID');
  assert.doesNotMatch(contenido, /\d{4}-\d{2}-\d{2}T|@/, 'ni fechas ni correos');
  assert.doesNotMatch(contenido, /Sint[eé]tic|Docente Demo|Admin Demo|SINT-B1|demo-clave/, 'ni nombres, ni códigos de grupo, ni la clave de juguete');
});

test('W75: la réplica (entradas nuevas, semilla 7, a 360×640) escribe su archivo, da el mismo sha256 en dos corridas y el mismo criterio con lo que solo ella ejercita', { skip: OMITIR, timeout: 900_000 }, (t) => {
  const a = correr('humo_navegacion.replica.json', '--replica');
  const b = correr('humo_navegacion.replica.json', '--replica');
  assert.equal(a.sha, b.sha, 'dos corridas, el mismo sha256');
  assert.deepEqual(a.criterio, ESPERADO_REPLICA);
  assert.doesNotMatch(a.contenido, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|@|Ñandú|TRECE-/i, 'la réplica tampoco trae identificadores, correos ni nombres de grupo');
  const dev = correr('humo_navegacion.mock.json');
  assert.notEqual(a.sha, dev.sha, 'otras entradas, otro hash');
  t.diagnostic(`humo_navegacion.replica.json sha256 ${a.sha}`);
});
