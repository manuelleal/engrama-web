// @ts-check
// U44, U45 y U47 (docs/ESPEC_juego_oleada1.md §4.4 y §9.3, W48): la llama de la constancia con vida. Todo es presentación del número del servidor:
//   U44: `etapaDeLlama` (menos de 3 → 0; 3 a 6 → 1; 7 a 13 → 2; 14 o más → 3) y la llama que lleva su etapa, con el número aparte;
//   U45: `planDeRacha`: la primera vez y un valor igual, nada; sube sin cruzar → confeti suave; cruza 3, 7 o 14 → el umbral mayor y confeti normal;
//        baja desde 3 o más → una línea neutra, sin sonido ni confeti; baja desde menos de 3 → nada;
//   U47: la "mejor constancia" es `longest_streak` del servidor, tal cual; si falta, la línea sin número; ninguna vista calcula un máximo.
// Tramposos: x_llama_no_crece, x_racha_cruce_en_cada_subida y x_racha_rota_asusta (src/ui/racha.js); x_mejor_constancia_calculada
// (src/vistas/estudiante/asistencia.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { etapaDeLlama, planDeRacha, crearLlama, nombreDeLlama, textoDeNuevo, crearDeNuevo } from '../../src/ui/racha.js';
import { perfilAJson } from '../../src/auth/perfil_actual.js';
import { validarSesion } from '../../src/auth/interfaz.js';
import { entornoDeFotos, crearRaiz, buscar, textoDe, elementos } from './foto_vistas.mjs';
import { RUTAS, sesionDeEstudiante } from './fotos_de_las_vistas.mjs';
import { renderInicio } from '../../src/vistas/estudiante/inicio.js';
import { renderAsistencia } from '../../src/vistas/estudiante/asistencia.js';
import { cancelarCelebraciones } from '../../src/ui/celebraciones.js';
import { instalarDomFalso } from './dom_falso.mjs';

test('U44: la etapa de la llama sale del número del servidor: 0, 1 y 2 → 0; 3 y 6 → 1; 7 y 13 → 2; 14 y 99 → 3; negativo o no numérico → 0', () => {
  assert.deepEqual([0, 1, 2, 3, 6, 7, 13, 14, 99].map(etapaDeLlama), [0, 0, 0, 1, 1, 2, 2, 3, 3]);
  for (const raro of [-1, -14, NaN, Infinity, '7', null, undefined, {}, [14]]) assert.equal(etapaDeLlama(raro === Infinity ? -Infinity : raro), 0, String(raro));
});

test('U44: la llama lleva su etapa (clase y data-etapa), es decorativa y NO trae el número: el número va aparte, en texto', () => {
  const quitar = instalarDomFalso();
  try {
    for (const [racha, etapa, chispas, halo] of /** @type {[number, number, number, number][]} */ ([[0, 0, 0, 0], [2, 0, 0, 0], [3, 1, 0, 0], [7, 2, 2, 0], [14, 3, 4, 1]])) {
      const llama = /** @type {any} */ (crearLlama(racha));
      assert.equal(llama.className, `llama llama-etapa-${etapa}`, `racha ${racha}`);
      assert.equal(llama.getAttribute('data-etapa'), String(etapa));
      assert.equal(llama.getAttribute('aria-hidden'), 'true');
      const clases = llama.children.map((n) => n.className);
      assert.equal(clases.filter((c) => /llama-chispa /.test(c)).length, chispas, `racha ${racha}: chispas`);
      assert.equal(clases.filter((c) => c === 'llama-halo').length, halo, `racha ${racha}: halo`);
      assert.equal(clases.includes('llama-lengua'), etapa >= 1, `racha ${racha}: lengua lateral`);
      assert.equal(textoDe(llama), '', 'la llama no dice nada: el número no vive dentro de ella');
    }
    assert.equal(/** @type {any} */ (crearLlama()).className, 'llama llama-etapa-0', 'sin número, la llama de siempre');
  } finally { quitar(); }
  assert.deepEqual([0, 3, 7, 14].map(nombreDeLlama), ['Llama', 'Llama que crece', 'Llama alta', 'Llama plena']);
});

test('U45: la primera vez y un valor igual, nada; sube sin cruzar un umbral → se celebra con confeti suave y el texto de siempre', () => {
  for (const [previo, actual] of [[null, 7], [3, 3], [0, 0]]) {
    const p = planDeRacha(/** @type {any} */ (previo), actual, false);
    assert.deepEqual([p.celebrar, p.cruce, p.neutro, p.confeti, p.sonido, p.texto], [false, null, false, null, null, null], `${previo} → ${actual}`);
  }
  for (const [previo, actual] of [[0, 1], [1, 2], [3, 4], [7, 9], [14, 15]]) {
    const p = planDeRacha(previo, actual, false);
    assert.deepEqual([p.celebrar, p.cruce, p.confeti, p.texto], [true, null, 'suave', `¡Constancia ${actual}!`], `${previo} → ${actual}`);
  }
});

test('U45: 2 → 3, 6 → 7, 13 → 14 y 2 → 8 cruzan un umbral (el MAYOR cruzado): la llama crece, el aviso lo dice y el confeti es normal', () => {
  for (const [previo, actual, cruce, etapa] of [[2, 3, 3, 1], [6, 7, 7, 2], [13, 14, 14, 3], [2, 8, 7, 2], [0, 14, 14, 3], [1, 30, 14, 3]]) {
    const p = planDeRacha(previo, actual, false);
    assert.deepEqual([p.celebrar, p.cruce, p.etapa, p.confeti, p.sonido], [true, cruce, etapa, 'normal', 'racha'], `${previo} → ${actual}`);
    assert.equal(p.texto, `¡Constancia ${actual}! Tu llama creció.`);
    assert.ok(p.animacionMs <= 900 && p.animacionMs >= 800, 'A2: 900 ms');
  }
});

test('U45: 5 → 1 es neutro (ni celebración, ni sonido, ni confeti); 2 → 1 no dice nada', () => {
  for (const [previo, actual] of [[5, 1], [3, 0], [14, 13], [9, 1]]) {
    const p = planDeRacha(previo, actual, false);
    assert.deepEqual([p.celebrar, p.neutro, p.cruce, p.confeti, p.sonido, p.texto, p.animacionMs, p.fichas], [false, true, null, null, null, null, 0, 0], `${previo} → ${actual}`);
  }
  for (const [previo, actual] of [[2, 1], [2, 0], [1, 0]]) {
    const p = planDeRacha(previo, actual, false);
    assert.deepEqual([p.celebrar, p.neutro, p.sonido], [false, false, null], `${previo} → ${actual}: lo último visto era menor que 3`);
  }
});

test('U45 y U58: con "reducir movimiento" el plan dura 120 ms como máximo, sin confeti ni fichas, y dice lo mismo', () => {
  for (const [previo, actual] of [[2, 3], [3, 4], [13, 14]]) {
    const pleno = planDeRacha(previo, actual, false);
    const reducido = planDeRacha(previo, actual, true);
    assert.ok(reducido.animacionMs <= 120, `${previo} → ${actual}`);
    assert.deepEqual([reducido.confeti, reducido.fichas], [null, 0]);
    assert.deepEqual([reducido.texto, reducido.cruce, reducido.etapa, reducido.celebrar], [pleno.texto, pleno.cruce, pleno.etapa, pleno.celebrar], 'el mismo estado final');
  }
});

test('U47: mejorConstancia sale de longest_streak tal cual (o null si no vino), y la Sesion sigue sin level ni xp', () => {
  const perfil = { id: 'p', current_streak: 2, longest_streak: 9, level: 7, xp: 900, memberships: [{ tenant_id: 't', tenant_name: 'UIS', role: 'student', full_name: 'Ana' }] };
  const sesion = perfilAJson(perfil, 't');
  assert.equal(sesion.mejorConstancia, 9);
  assert.equal(sesion.constancia, 2, 'y no se mezcla con la constancia');
  assert.deepEqual(validarSesion(sesion), []);
  assert.ok(!('level' in sesion) && !('xp' in sesion));
  for (const raro of [undefined, null, '9', 9.5]) assert.equal(perfilAJson({ ...perfil, longest_streak: raro }, 't').mejorConstancia, null, String(raro));
  assert.ok(validarSesion({ ...sesion, level: 3 }).length > 0, 'validarSesion sigue rechazando level');
  assert.ok(validarSesion({ ...sesion, xp: 3 }).length > 0, 'y xp');
  assert.ok(validarSesion({ ...sesion, mejorConstancia: 'nueve' }).length > 0);
});

test('U47: la línea neutra muestra la mejor constancia del servidor tal cual; si falta, el texto sin número', () => {
  assert.equal(textoDeNuevo(5), 'Empezamos de nuevo. Tu mejor constancia: 5.');
  for (const sinDato of [null, undefined, 0, -3, '5', 2.5, NaN]) assert.equal(textoDeNuevo(sinDato), 'Empezamos de nuevo.', String(sinDato));
  const quitar = instalarDomFalso();
  try {
    const linea = /** @type {any} */ (crearDeNuevo(12));
    assert.equal(linea.getAttribute('role'), 'status');
    assert.equal(textoDe(linea), 'Empezamos de nuevo. Tu mejor constancia: 12.');
    assert.doesNotMatch(textoDe(linea), /perd|riesgo|romp|✗/i);
  } finally { quitar(); }
});

/** Inicio, visita tras visita, con el mismo almacenamiento. */
function visitante() {
  const entorno = entornoDeFotos(RUTAS);
  const consola = { ...console };
  for (const n of ['log', 'info', 'warn', 'error']) console[n] = () => {};
  return {
    async inicio(constancia, mejorConstancia) {
      const sesion = { ...sesionDeEstudiante(), profileId: 'prof-u47', constancia: 0 };
      const raiz = crearRaiz();
      // La sesión que YA había dice 0; la fresca de /auth/me dice lo de ahora: Inicio debe pintar la fresca.
      await renderInicio(raiz, { sesion, token: 't', colegios: sesion.colegios, colegioActivo: sesion.colegio.id, recargarSesion: async () => ({ ...sesion, constancia, mejorConstancia }) });
      cancelarCelebraciones();
      return raiz;
    },
    cerrar() { cancelarCelebraciones(); Object.assign(console, consola); entorno.restaurar(); },
  };
}

test('U47: en Inicio, si la racha baja desde 3 o más se dice UNA vez "Empezamos de nuevo" con la mejor constancia DEL SERVIDOR (aunque lo último visto fuera mayor)', async () => {
  const v = visitante();
  try {
    const primera = await v.inicio(9, 9);
    assert.equal(buscar(primera, 'racha-de-nuevo'), null, 'primera visita: nada');
    assert.match(textoDe(buscar(primera, 'constancia')), /Constancia: 9$/, 'Inicio pinta la constancia de /auth/me de este pintado');
    assert.equal(elementos(buscar(primera, 'constancia')).find((e) => /llama /.test(e.className)).getAttribute('data-etapa'), '2');
    const baja = await v.inicio(1, 5); // el servidor dice que la mejor es 5 (lo último visto aquí era 9: no se usa)
    assert.equal(textoDe(buscar(baja, 'racha-de-nuevo')), 'Empezamos de nuevo. Tu mejor constancia: 5.');
    assert.match(textoDe(buscar(baja, 'constancia')), /Constancia: 1$/);
    const despues = await v.inicio(1, 5);
    assert.equal(buscar(despues, 'racha-de-nuevo'), null, 'se dice una sola vez');
    const sube = await v.inicio(2, 5);
    assert.equal(buscar(sube, 'racha-de-nuevo'), null);
    const otraBaja = await v.inicio(1, 5);
    assert.equal(buscar(otraBaja, 'racha-de-nuevo'), null, 'de 2 a 1 no se dice nada: lo último visto era menor que 3');
  } finally { v.cerrar(); }
});

test('U47: si el servidor no manda la mejor constancia, la línea sale sin número', async () => {
  const v = visitante();
  try {
    await v.inicio(4, null);
    assert.equal(textoDe(buscar(await v.inicio(1, null), 'racha-de-nuevo')), 'Empezamos de nuevo.');
  } finally { v.cerrar(); }
});

test('U47: en la asistencia, la racha que baja pide /auth/me SOLO en ese caso y dice la mejor constancia del servidor', async () => {
  const g = /** @type {any} */ (globalThis);
  const entorno = entornoDeFotos({ 'POST /core/attendance/check-in': ({ init }) => ({ success: true, coins_awarded: 10, streak: racha, message: 'ok', base: 5, puntualidad: 5, puntual: true, ya_cobrada_hoy: false }) });
  const previo = { window: g.window, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), consola: { ...console } };
  g.window = { addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  for (const n of ['log', 'info', 'warn', 'error']) console[n] = () => {};
  let racha = 6; let recargas = 0;
  const marcar = async () => {
    const raiz = crearRaiz();
    const sesion = { profileId: 'prof-u47-asis', rol: 'student', mejorConstancia: 99 };
    renderAsistencia(raiz, {}, { token: 't', tenantId: 'tn', sesion, recargarSesion: async () => { recargas += 1; return { ...sesion, mejorConstancia: 6 }; } });
    buscar(raiz, 'campo-codigo').value = 'ABC123';
    buscar(raiz, 'form-asistencia').disparar('submit');
    await new Promise((r) => setTimeout(r, 60));
    cancelarCelebraciones();
    return raiz;
  };
  try {
    assert.equal(buscar(await marcar(), 'racha-de-nuevo'), null, 'primera marca: nada que decir');
    assert.equal(recargas, 0, 'y no se pidió /auth/me');
    racha = 1;
    const baja = await marcar();
    assert.equal(textoDe(buscar(baja, 'racha-de-nuevo')), 'Empezamos de nuevo. Tu mejor constancia: 6.', 'la que dijo el servidor al refrescar, no la de la sesión vieja ni una calculada');
    assert.equal(recargas, 1, 'una sola petición, solo en este caso');
    assert.doesNotMatch(textoDe(baja), /✗|perd|riesgo/i);
    racha = 2;
    assert.equal(buscar(await marcar(), 'racha-de-nuevo'), null, 'sube: no hay línea neutra');
    assert.equal(recargas, 1);
  } finally {
    entorno.restaurar(); Object.assign(console, previo.consola);
    if (previo.window === undefined) delete g.window; else g.window = previo.window;
    if (previo.navigator) Object.defineProperty(globalThis, 'navigator', previo.navigator); else delete g.navigator;
  }
});

test('U47: ninguna vista ni componente de la racha calcula un máximo ni hace aritmética sobre la constancia', () => {
  for (const f of ['src/ui/racha.js', 'src/ui/sello.js', 'src/vistas/estudiante/inicio.js', 'src/vistas/estudiante/asistencia.js', 'src/auth/perfil_actual.js']) {
    const codigo = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/Math\.max\([^)]*(constancia|streak|racha|mejor|previo)/i.test(codigo), `${f} calcula un máximo de la racha`);
    assert.ok(!/(constancia|streak|racha|mejor\w*)\s*[+\-*]\s*\d/i.test(codigo), `${f} hace aritmética sobre la racha`);
  }
});
