// @ts-check
// U100 (docs/ESPEC_practica_del_dia.md §6e, adenda 4; compuerta visual 18, hallazgo 4): una sola racha con un solo nombre. La llama y "racha"/"semanas"
// son de la racha SEMANAL de práctica; la asistencia se llama "Clases seguidas" (sin llama, sin "constancia", con el ícono de asistencia).
//   U100a  los textos del resultado de la asistencia dicen "clases seguidas" y ninguno dice "constancia".
//   U100b  la columna del roster del profe dice "Clases seguidas".
// Tramposos: x_asistencia_dice_constancia (src/textos.js: el resultado vuelve a decir "Constancia"), x_profe_columna_constancia (src/textos.js: la columna).
import test from 'node:test';
import assert from 'node:assert/strict';
import { textos } from '../../src/textos.js';
import { tomarFotos } from './fotos_de_las_vistas.mjs';

test('U100a: los textos del resultado de la asistencia dicen "clases seguidas", con el número del servidor, y ninguno dice "constancia"', () => {
  const dichos = [textos.asistencia.exito(10, 3), textos.asistencia.yaCobrada(3), textos.asistencia.sinMonedas(3), textos.asistencia.exito(5, 1)];
  for (const t of dichos) {
    assert.match(t, /[Cc]lases seguidas:? \d/, t);
    assert.doesNotMatch(t, /constancia|llama|racha|semana/i, `${t}: la asistencia no usa el vocabulario de la racha semanal`);
  }
  assert.equal(textos.asistencia.exito(10, 3), 'Asistencia marcada · +10 monedas · clases seguidas 3');
  assert.equal(textos.asistencia.sinMonedas(2), 'Asistencia marcada. Clases seguidas: 2.');
  assert.match(textos.asistencia.yaCobrada(4), /una vez por día\. Clases seguidas: 4\.$/);
});

test('U100b: el roster del profe titula la columna "Clases seguidas" (y no "Constancia"), con el número del servidor debajo', async () => {
  const foto = (await tomarFotos()).profe_grupo;
  const textosDeLaFoto = foto.map((l) => l.trim());
  assert.ok(textosDeLaFoto.includes('"Clases seguidas"'), 'la columna se llama Clases seguidas');
  assert.ok(!textosDeLaFoto.some((l) => /constancia/i.test(l)), 'ninguna línea del grupo dice constancia');
  assert.equal(textos.profe.grupo.columnaClases, 'Clases seguidas');
});
