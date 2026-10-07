// @ts-check
// W29 (docs/ESPEC_pantallas_anillo.md §5, U23): UNA tabla con los 11 estados que la espec muestra; cada uno devuelve un ícono y un
// texto no vacíos, el ícono va con aria-hidden y el texto es visible. Un estado nunca se indica solo con color.
// Tramposo: x_estado_solo_color.
import test from 'node:test';
import assert from 'node:assert/strict';
import { entornoDeFotos, buscar, textoDe, elementos } from './foto_vistas.mjs';
import { etiquetaDeEstado, crearEtiquetaEstado, ESTADOS_CON_ETIQUETA } from '../../src/ui/estado_etiqueta.js';

// Los de §5: pendiente, ya no está, suspendida, aprobado, rechazada, confirmado, provisional y los 4 de las solicitudes.
const LOS_11 = [
  'pendiente', 'ya_no_esta', 'suspendida', 'inscripcion_aprobada', 'inscripcion_rechazada', 'nivel_confirmado', 'nivel_provisional',
  'solicitud_abierta', 'solicitud_en_tramite', 'solicitud_resuelta', 'solicitud_rechazada',
];

test('U23: los 11 estados de §5 devuelven ícono y texto no vacíos (la tabla es esa y ninguna más)', () => {
  assert.deepEqual([...ESTADOS_CON_ETIQUETA].sort(), [...LOS_11].sort());
  for (const estado of LOS_11) {
    const { icono, texto } = etiquetaDeEstado(estado);
    assert.ok(typeof icono === 'string' && icono.trim().length > 0, `${estado}: ícono vacío`);
    assert.ok(typeof texto === 'string' && texto.trim().length > 0, `${estado}: texto vacío`);
  }
  assert.throws(() => etiquetaDeEstado('inventado'), /no tiene ícono y texto/, 'un estado que no existe no da una etiqueta vacía: lanza');
});

test('U23: la etiqueta pintada trae el ícono con aria-hidden y el texto visible (el color no es lo único que informa)', () => {
  const entorno = entornoDeFotos();
  try {
    for (const estado of LOS_11) {
      const nodo = crearEtiquetaEstado(estado);
      const icono = elementos(nodo).find((n) => n.className === 'etiqueta-icono');
      const texto = elementos(nodo).find((n) => n.className === 'etiqueta-texto');
      assert.equal(icono?.getAttribute('aria-hidden'), 'true', `${estado}: el ícono es decorativo`);
      assert.ok(textoDe(icono).trim() !== '', `${estado}: ícono`);
      assert.equal(texto?.getAttribute('aria-hidden'), null, `${estado}: el texto SÍ lo lee el lector de pantalla`);
      assert.equal(textoDe(texto), etiquetaDeEstado(estado).texto);
      assert.equal(buscar(nodo, `estado-${estado}`), nodo);
    }
  } finally { entorno.restaurar(); }
});

test('U23: lo que no es una respuesta incorrecta no usa la ✗ (dictamen 03, G5), y Drako no aparece dentro de una etiqueta', () => {
  assert.notEqual(etiquetaDeEstado('solicitud_rechazada').icono, '✗');
  assert.equal(etiquetaDeEstado('solicitud_rechazada').texto, 'Respondida: no se pudo hacer');
  assert.equal(etiquetaDeEstado('nivel_provisional').texto, 'Provisional');
  assert.equal(etiquetaDeEstado('nivel_confirmado').icono, '✓');
  const entorno = entornoDeFotos();
  try {
    for (const estado of LOS_11) {
      assert.ok(!elementos(crearEtiquetaEstado(estado)).some((n) => n.getAttribute('data-testid')?.startsWith('drako-')), `${estado}: Drako presenta, no califica`);
    }
  } finally { entorno.restaurar(); }
});
