// @ts-check
// H-18 (auditoría de seguridad 02): las respuestas en curso (`engrama_respuestas_<intento>`) se borran al
// cerrar sesión y al cambiar de institución: en un equipo compartido no sobreviven a quien las escribió.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Un localStorage de mentira con la misma interfaz que usa el módulo. */
function instalarAlmacen(inicial) {
  const datos = new Map(Object.entries(inicial));
  globalThis.localStorage = {
    get length() { return datos.size; },
    key: (i) => [...datos.keys()][i] ?? null,
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => { datos.set(k, String(v)); },
    removeItem: (k) => { datos.delete(k); },
  };
  return datos;
}

const { guardarRespuestas, leerRespuestasGuardadas, limpiarRespuestasEnCurso, borrarRespuestasGuardadas } = await import('../../src/vistas/estudiante/respuestas_locales.js');

test('H-18: limpiarRespuestasEnCurso borra las respuestas de TODOS los intentos y nada más', () => {
  const datos = instalarAlmacen({
    engrama_respuestas_a1: '{"q1":"A"}',
    engrama_respuestas_b2: '{"q1":"B"}',
    engrama_sonido_silenciado: '1',
    engrama_ultimo_saldo_est1: '5',
  });
  assert.equal(limpiarRespuestasEnCurso(), 2);
  assert.deepEqual([...datos.keys()].sort(), ['engrama_sonido_silenciado', 'engrama_ultimo_saldo_est1'], 'lo que no son respuestas en curso se queda');
});

test('H-18: guardar, leer y borrar un intento siguen funcionando', () => {
  instalarAlmacen({});
  guardarRespuestas('x', { q1: 'A' });
  assert.deepEqual(leerRespuestasGuardadas('x'), { q1: 'A' });
  borrarRespuestasGuardadas('x');
  assert.deepEqual(leerRespuestasGuardadas('x'), {});
});

test('H-18: sin almacenamiento disponible no truena', () => {
  // @ts-ignore
  delete globalThis.localStorage;
  assert.equal(limpiarRespuestasEnCurso(), 0);
  assert.deepEqual(leerRespuestasGuardadas('x'), {});
});

test('H-18: app.js limpia las respuestas en curso al cerrar sesión y al cambiar de institución', () => {
  const app = readFileSync(new URL('../../src/app.js', import.meta.url), 'utf8').split(String.fromCharCode(13)).join('');
  const cuerpo = (nombre) => {
    const i = app.indexOf(`async function ${nombre}(`);
    assert.ok(i >= 0, `no encuentro ${nombre}`);
    return app.slice(i, app.indexOf('\n}\n', i));
  };
  assert.match(cuerpo('cerrarSesion'), /limpiarRespuestasEnCurso\(\)/, 'cerrar sesión debe borrar las respuestas a medias');
  assert.match(cuerpo('cambiarColegio'), /limpiarRespuestasEnCurso\(\)/, 'cambiar de institución debe borrarlas');
});
