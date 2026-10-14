// @ts-check
// W81 · E37 (docs/ESPEC_practica_del_dia.md §2): la racha semanal en el navegador de verdad, contra el mock (backend f7f7aeb). Dos semanas cumplidas
// por asistencia, el lunes y el martes de esta semana activos y hoy (miércoles) 3 respuestas: la llama dice "2 semanas", "Tu semana" pinta los 7 días
// del servidor con hoy marcado, "3 de 6 respuestas" y el protector. Con la racha apagada en el doble (backend viejo), Inicio es el de antes.
// Cruce: x_semana_desde_el_historial.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarRetosPractica } from '../../herramientas/humo/entradas_practica.mjs';
import { arrancarIntento } from '../../herramientas/mock/rutas_intentos.mjs';
import { responderPregunta, terminarIntento } from '../../herramientas/mock/por_pregunta.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const YA_ENTRO = "localStorage.setItem('engrama_actor_sintetico', 'est-1')";
const MIERCOLES = Date.parse('2026-10-14T15:00:00Z'); // 10:00 en Bogotá

/** La estudiante est-1 con dos semanas cumplidas por asistencia, el lunes y el martes de esta semana, y hoy un reto de 3 preguntas (2 bien). */
function sembrar() {
  const estado = estadoConEstudiantesSembrados();
  estado.reloj.ahora = () => MIERCOLES;
  const retos = sembrarRetosPractica(estado, [...estado.groups.values()][0].id);
  const yo = estado.tokens.get('est-1');
  for (const f of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-12', '2026-10-13']) {
    estado.attendanceRecords.push({ id: `asis-${f}`, tenant_id: estado.tenantDemoId, session_id: 'sesion-sintetica', student_id: yo, attendance_date: f, coins_awarded: 10, geo_status: 'sin_ubicacion', created_at: `${f}T15:00:00.000Z` });
  }
  const req = { headers: { authorization: 'Bearer est-1' } };
  const { cuerpo: intento } = arrancarIntento(estado, req, retos.find((r) => r.title === 'Rutina diaria · Gramática 1').id);
  intento.challenge.questions.forEach((q, i) => responderPregunta(estado, req, intento.attempt_id, { question_id: q.id, answer: ['B', 'A', 'A'][i] }));
  terminarIntento(estado, req, intento.attempt_id);
  return estado;
}

const MIRAR = `(async () => {
  const q = (t) => document.querySelector('[data-testid="' + t + '"]');
  for (let i = 0; i < 80 && !q('progreso-semana'); i++) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 400));
  const dias = [...document.querySelectorAll('[data-testid="semana-dias"] li')].map((li) => ({ fecha: li.dataset.fecha, hecho: li.classList.contains('es-hecho'), hoy: li.classList.contains('es-hoy'), nombre: li.getAttribute('aria-label') }));
  const semana = q('progreso-semana').getBoundingClientRect();
  return {
    constancia: q('constancia').textContent, numero: q('racha-semanas')?.textContent ?? null, dias, resumen: q('semana-resumen')?.textContent ?? null,
    hoy: q('semana-hoy')?.textContent ?? null, protector: q('semana-protector')?.textContent ?? null, anchoSemana: Math.round(semana.width), ancho: innerWidth,
    scrollAncho: document.documentElement.scrollWidth,
  };
})()`;

test('E37: la llama dice "2 semanas" y "Tu semana" pinta los 7 días del servidor (hoy marcado), lo que falta hoy y el protector, sin desbordar a 375', { skip: OMITIR, timeout: 120_000 }, async () => {
  const estado = sembrar();
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({ url: `${url}#/inicio`, ancho: 375, alto: 812, espera_ms: 6000, pre: YA_ENTRO, eval: MIRAR });
    assert.deepEqual(r.errores, []);
    const m = r.eval;
    assert.match(m.constancia, /2 semanas/);
    assert.equal(m.numero, '2');
    assert.deepEqual(m.dias.map((d) => [d.fecha, d.hecho, d.hoy]), [
      ['2026-10-12', true, false], ['2026-10-13', true, false], ['2026-10-14', false, true], ['2026-10-15', false, false],
      ['2026-10-16', false, false], ['2026-10-17', false, false], ['2026-10-18', false, false]]);
    assert.equal(m.dias[0].nombre, 'Lunes: día activo, con asistencia');
    assert.equal(m.dias[2].nombre, 'Miércoles: sin actividad (hoy)');
    assert.equal(m.resumen, '2 de 3 días esta semana');
    assert.equal(m.hoy, 'Hoy: 3 de 6 respuestas. Con 6 respuestas y 4 correctas, el día cuenta.');
    assert.match(m.protector, /^Protector de racha: \d de 2$/);
    assert.ok(m.scrollAncho <= m.ancho, `desplazamiento horizontal: ${m.scrollAncho} > ${m.ancho}`);
  }, { estado });
});

test('E37: con un backend sin la racha semanal (el doble con racha apagada), Inicio es el de antes: "Constancia" y la semana del historial', { skip: OMITIR, timeout: 120_000 }, async () => {
  const estado = sembrar();
  estado.backend.racha = false;
  await conAppCompleta(async (url) => {
    const r = await revisarPagina({ url: `${url}#/inicio`, ancho: 375, alto: 812, espera_ms: 6000, pre: YA_ENTRO, eval: MIRAR });
    assert.deepEqual(r.errores.filter((e) => !/\/core\/racha$/.test(e)), [], 'el 404 de /core/racha es la señal del respaldo, no un error de la página');
    assert.match(r.eval.constancia, /Constancia: 3/);
    assert.equal(r.eval.numero, null);
    assert.equal(r.eval.hoy, null);
  }, { estado });
});
