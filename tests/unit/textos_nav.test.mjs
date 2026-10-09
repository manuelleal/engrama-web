// @ts-check
// W67 · U63, los textos (docs/ESPEC_navegacion.md §5.5, §9.3): una palabra, una cosa.
//   - "sesión" queda SOLO para la cuenta: el botón de cerrar la asistencia no dice lo mismo que el de cerrar la cuenta, y nada de la asistencia
//     dice "sesión";
//   - cada código con su apellido, siempre igual: "código de asistencia", "código de la sala", "código del examen", "código de grupo";
//     el campo del admin es el "Nombre del grupo";
//   - "institución", nunca "colegio", en lo que se ve; "Inicio" con mayúscula cuando nombra la pantalla.
// Y lo de W63: textos_nav.js se esparce en textos.js sin pisar ninguna clave suya.
// Tramposo: x_dos_cerrar_sesion (sobre src/textos.js, que es donde vive el texto del botón de la asistencia).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { textos } from '../../src/textos.js';
import { textosNav } from '../../src/textos_nav.js';
import { textosAnillo } from '../../src/textos_anillo.js';

const FUENTE = readFileSync(fileURLToPath(new URL('../../src/textos.js', import.meta.url)), 'utf8');
const PROPIAS = new Set([...FUENTE.matchAll(/^ {2}([A-Za-z_]\w*): \{/gm)].map((m) => m[1]));

/** Todas las cadenas de una rama de `textos` (las funciones se llaman con valores de muestra), con su ruta. */
function cadenas(valor, ruta = '') {
  if (typeof valor === 'string') return [[ruta, valor]];
  if (typeof valor === 'function') {
    try { const r = valor(2, 3); return typeof r === 'string' ? [[`${ruta}()`, r]] : []; } catch { return []; }
  }
  if (Array.isArray(valor)) return valor.flatMap((v, i) => cadenas(v, `${ruta}[${i}]`));
  if (valor && typeof valor === 'object') return Object.entries(valor).flatMap(([k, v]) => cadenas(v, ruta ? `${ruta}.${k}` : k));
  return [];
}

test('W63: textos.js esparce textos_nav.js y ninguna clave de textos_nav.js pisa una de textos.js ni de textos_anillo.js', () => {
  assert.match(FUENTE, /\.\.\.textosNav/);
  assert.deepEqual(Object.keys(textosNav).filter((k) => PROPIAS.has(k)), [], 'esas claves existen en textos.js: el spread las pisaría sin avisar');
  assert.deepEqual(Object.keys(textosNav).filter((k) => k in textosAnillo), [], 'ni una de textos_anillo.js');
  for (const [clave, valor] of Object.entries(textosNav)) assert.equal(textos[clave], valor, `textos.${clave}`);
  assert.ok(FUENTE.split('\n').length <= 400, 'textos.js sigue en 400 líneas o menos');
});

test('U63: el botón de cerrar la asistencia NO dice lo mismo que el de cerrar la cuenta, y "sesión" queda solo para la cuenta', () => {
  assert.equal(textos.nav.cerrarSesion, 'Cerrar sesión', 'la cuenta');
  assert.equal(textos.profe.sesion.cerrar, 'Cerrar la asistencia', 'la asistencia');
  assert.notEqual(textos.profe.sesion.cerrar, textos.nav.cerrarSesion);
  const deLaAsistencia = [...cadenas(textos.profe.sesion, 'profe.sesion'), ...cadenas(textos.profe.grupo, 'profe.grupo'), ...cadenas(textos.asistencia, 'asistencia'), ...cadenas(textos.tarjetaGrupo, 'tarjetaGrupo')];
  assert.ok(deLaAsistencia.length > 25, 'la lectura de las cadenas funciona');
  assert.deepEqual(deLaAsistencia.filter(([, t]) => /sesi[oó]n/i.test(t)), [], 'nada de la asistencia dice "sesión"');
  assert.equal(textos.profe.sesion.abrir, 'Abrir asistencia');
  assert.equal(textos.profe.grupo.abrirSesion, textos.profe.sesion.abrir, 'la misma acción se llama igual en el grupo, en la tarjeta y en el formulario');
  assert.equal(textos.tarjetaGrupo.asistencia, textos.profe.sesion.abrir);
  assert.equal(textos.profe.sesion.cerrada, 'Asistencia cerrada.');
  assert.equal(textos.profe.sesion.etiquetaDuracion, '¿Cuántos minutos queda abierta?');
});

test('U63: cada código con su apellido, siempre igual; y el campo del admin es el nombre del grupo', () => {
  assert.equal(textos.asistencia.etiquetaCodigo, 'Código de asistencia');
  assert.equal(textos.profe.sesion.codigoPrefijo, 'Código de asistencia');
  assert.equal(textos.asistencia.faltaCodigo, 'Escribe el código de asistencia.');
  assert.equal(textos.asistencia.sesionVencida, 'Ese código ya venció.');
  assert.equal(textos.asistencia.yaMarcada, 'Ya habías marcado esta asistencia.');
  assert.equal(textos.anillo.vivoCampo, 'Código de la sala');
  assert.equal(textos.anillo.nivelCampo, 'Código del examen');
  assert.match(textos.registro.etiquetaCodigo, /^Código de (tu )?grupo$/);
  assert.equal(textos.admin.crearGrupo.etiquetaCodigo, 'Nombre del grupo');
  assert.equal(textos.admin.crearGrupo.faltaCodigo, 'Escribe el nombre del grupo.');
  const etiquetas = [textos.asistencia.etiquetaCodigo, textos.anillo.vivoCampo, textos.anillo.nivelCampo, textos.registro.etiquetaCodigo, textos.admin.crearGrupo.etiquetaCodigo];
  assert.equal(new Set(etiquetas).size, etiquetas.length, 'ningún par de campos distintos con la misma etiqueta');
  assert.ok(!etiquetas.includes('Código'), 'ningún "Código" a secas');
});

test('U63: en lo que se ve dice "institución", nunca "colegio"; e "Inicio" va con mayúscula cuando nombra la pantalla', () => {
  const todas = cadenas(textos);
  assert.ok(todas.length > 250, `se leyeron ${todas.length} cadenas`);
  assert.deepEqual(todas.filter(([, t]) => /colegio/i.test(t)), [], '"colegio" en un texto visible');
  assert.equal(textos.profe.retos.avisoTodoElColegio, 'Estos son los retos de toda la institución, no solo de tus grupos.');
  assert.equal(textos.nav.inicio, 'Inicio');
  assert.deepEqual(todas.filter(([ruta, t]) => /\bal inicio\b|\ba inicio\b/.test(t) && !/anillo\.volverInicio/.test(ruta)), [], '"inicio" en minúscula nombrando la pantalla (anillo.volverInicio sale en W71)');
});
