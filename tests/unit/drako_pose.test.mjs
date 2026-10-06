// @ts-check
// Drako por partes: las poses se mezclan número a número (transición suave y cortable), las plantillas se llenan en orden y
// ninguna pose se sale de la forma de los canales. Lo que se VE (que las partes se muevan de verdad) lo prueba el E2E de
// tests/e2e/drako_animado.test.mjs; aquí solo lo decidible sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CANALES, POSES, REPOSO, NOMBRES_DE_POSE } from '../../src/ui/drako_rig.js';
import { aplicarVector, copiar, mezclar, rellenar, vectorDe } from '../../src/ui/drako_pose.js';

const ESTADOS_ESTATICOS = ['presenta', 'piensa', 'explica', 'celebra', 'ups', 'espera'];
const EXTRAS = ['reposo', 'saluda_a', 'saluda_b', 'agacha', 'salta', 'celebra_b', 'piensa_b', 'espera_b'];

test('drako_pose: están las poses de los 6 estados y las de saludo, salto y ciclos; el reposo existe', () => {
  for (const p of [...ESTADOS_ESTATICOS, ...EXTRAS]) assert.ok(POSES[p], `falta la pose ${p}`);
  assert.ok(POSES[REPOSO]);
  assert.deepEqual(NOMBRES_DE_POSE, Object.keys(POSES));
});

test('drako_pose: cada pose trae un vector por canal y tantos números como "#" tiene la plantilla (todas la misma forma)', () => {
  for (const [nombre, pose] of Object.entries(POSES)) {
    assert.equal(pose.v.length, CANALES.length, `${nombre}: un vector por canal`);
    CANALES.forEach((c, i) => {
      const huecos = (c.t.match(/#/g) || []).length;
      assert.equal(pose.v[i].length, huecos, `${nombre} · ${c.n}: ${pose.v[i].length} números para ${huecos} huecos`);
      assert.ok(pose.v[i].every(Number.isFinite), `${nombre} · ${c.n}: hay un número que no es finito`);
    });
  }
});

test('drako_pose: rellenar llena la plantilla en orden y redondea a 2 decimales', () => {
  assert.equal(rellenar('translate(#px,#px) rotate(#deg)', [110.456, 55, -4]), 'translate(110.46px,55px) rotate(-4deg)');
  assert.equal(rellenar('#', [0.3333333]), '0.33');
});

test('drako_pose: mezclar es lineal — t=0 es la de partida, t=1 la de llegada, t=0.5 el punto medio; no cambia las originales', () => {
  const a = vectorDe('reposo');
  const b = vectorDe('celebra');
  const copiaA = copiar(a);
  assert.deepEqual(mezclar(a, b, 0), a);
  assert.deepEqual(mezclar(a, b, 1), b);
  const medio = mezclar(a, b, 0.5);
  a.forEach((fila, i) => fila.forEach((n, j) => assert.ok(Math.abs(medio[i][j] - (n + b[i][j]) / 2) < 1e-9)));
  assert.deepEqual(a, copiaA, 'mezclar no muta');
  assert.deepEqual(vectorDe('reposo'), POSES.reposo.v, 'vectorDe devuelve una copia igual');
  assert.notEqual(vectorDe('reposo'), POSES.reposo.v);
});

test('drako_pose: una transición cortada a la mitad sigue desde donde iba (mezclar a mezclar es continuo)', () => {
  const a = vectorDe('reposo');
  const medio = mezclar(a, vectorDe('celebra'), 0.4);
  const seguido = mezclar(medio, vectorDe('ups'), 0);
  assert.deepEqual(seguido, medio, 'en t=0 de la nueva transición no hay salto');
});

test('drako_pose: aplicarVector escribe cada canal en sus partes, acota la opacidad a 0..1 y no repite lo que no cambió', () => {
  const escrituras = [];
  const parte = (n) => ({ n, setAttribute: (k, v) => escrituras.push([n, 'attr', k, v]), style: { setProperty: (k, v) => escrituras.push([n, 'css', k, v]) } });
  const rig = { destinos: CANALES.map((c) => c.ids.map((id) => parte(id))), cache: [] };
  const v = vectorDe('reposo');
  const iOp = CANALES.findIndex((c) => c.p === 'opacity');
  v[iOp] = [1.4];
  aplicarVector(rig, v);
  const op = escrituras.find((e) => e[1] === 'css' && e[2] === 'opacity');
  assert.equal(op[3], '1', 'la opacidad nunca pasa de 1 (un rebote puede extrapolar)');
  assert.ok(escrituras.some((e) => e[1] === 'attr' && e[2] === 'd' && e[3].startsWith('M')), 'los trazos van por atributo d');
  assert.ok(escrituras.some((e) => e[1] === 'css' && e[2] === 'transform'), 'las transformaciones van por CSS');
  const antes = escrituras.length;
  aplicarVector(rig, v);
  assert.equal(escrituras.length, antes, 'misma pose otra vez: no se escribe nada');
});

test('drako_pose: el párpado nunca se escala negativo ni la opacidad sale de 0..1 al extrapolar un rebote', () => {
  const escrituras = [];
  const parte = () => ({ setAttribute() {}, style: { setProperty: (k, v) => escrituras.push([k, v]) } });
  const rig = { destinos: CANALES.map((c) => c.ids.map(() => parte())), cache: [] };
  aplicarVector(rig, mezclar(vectorDe('reposo'), vectorDe('celebra'), 1.6));
  for (const [k, v] of escrituras) {
    if (k === 'opacity') assert.ok(Number(v) >= 0 && Number(v) <= 1, `opacidad ${v}`);
    if (k === 'transform' && v.startsWith('scaleY(')) assert.ok(parseFloat(v.slice(7)) >= 0, `escala ${v}`);
  }
});

test('drako_pose: solo los saltos y el "ups" levantan el brazo de atrás por delante del torso', () => {
  assert.equal(POSES.salta.delante, true);
  for (const p of ['reposo', 'presenta', 'celebra', 'piensa', 'espera']) assert.equal(POSES[p].delante, false, p);
});
