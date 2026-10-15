// @ts-check
// U73 (docs/ESPEC_visual_sistema1.md §2b; compuerta visual, hallazgo 5): el aviso «¡Constancia N! Tu llama creció.» va en el FLUJO de la pantalla,
// en su sitio, y nunca flota ni cuelga del `body`. Antes era un cartel fijo a 76 px del borde: tapaba el saludo y dejaba inalcanzable el enlace
// "Ver mis movimientos" durante tres segundos.
//   - Inicio: después de "Ahora" y antes de "Tu semana" (el mismo sitio de la línea neutra "Empezamos de nuevo"), una sola vez.
//   - Asistencia (adenda 4): sin aviso ni llama; el renglón de "Clases seguidas" va dentro de la zona del sello (el número se dice una vez, no dos).
//   - En la hoja no tiene posición propia: ni `fixed`, ni `absolute`, ni `sticky`.
// Tramposo: x_aviso_de_racha_flota (src/ui/racha.js: el aviso vuelve a colgarse del body). En el navegador lo mira E22 (tests/e2e/racha_viva.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { entornoDeFotos, crearRaiz, buscar, textoDe, elementos } from './foto_vistas.mjs';
import { NodoFalso } from './dom_falso.mjs';
import { RUTAS, sesionDeEstudiante } from './fotos_de_las_vistas.mjs';
import { renderInicio } from '../../src/vistas/estudiante/inicio.js';
import { celebrarAsistencia } from '../../src/ui/sello.js';
import { cancelarCelebraciones } from '../../src/ui/celebraciones.js';

const asentar = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const esAviso = (n) => String(n.className || '').split(/\s+/).includes('celebra-racha');

/** Un entorno con movimiento pleno y un `body` que anota todo lo que se le cuelga. */
function entorno() {
  const e = entornoDeFotos(RUTAS, { reducido: false });
  const g = /** @type {any} */ (globalThis);
  /** @type {any[]} */ const colgados = [];
  const body = Object.assign(new NodoFalso('body'), { dataset: {} });
  const colgar = body.appendChild.bind(body);
  body.appendChild = (n) => { colgados.push(n); return colgar(n); };
  g.document.body = body;
  g.document.createDocumentFragment = () => new NodoFalso('fragmento');
  const consola = { ...console };
  for (const nivel of ['log', 'info', 'warn', 'error', 'debug']) console[nivel] = () => {};
  return { colgados, guardar: (clave, valor) => g.localStorage.setItem(clave, String(valor)), cerrar() { cancelarCelebraciones(); Object.assign(console, consola); e.restaurar(); } };
}

test('U73: en Inicio, cuando la constancia sube, el aviso va DENTRO de la pantalla, después de "Ahora" y antes de "Tu semana"; nada con ese aviso cuelga del body', async () => {
  const e = entorno();
  try {
    const sesion = sesionDeEstudiante({ profileId: 'prof-u73', constancia: 3 });
    e.guardar('engrama_ultimo_constancia_prof-u73', 1); // lo último visto era 1 y el servidor dice 3: sube y cruza el umbral de 3
    const raiz = crearRaiz();
    await renderInicio(raiz, { sesion, token: 't', colegios: sesion.colegios, colegioActivo: sesion.colegio.id });
    await asentar();
    const todos = elementos(raiz);
    const avisos = todos.filter(esAviso);
    assert.equal(avisos.length, 1, 'un solo aviso, dentro de la vista');
    assert.equal(textoDe(avisos[0]), '¡Constancia 3! Tu llama creció.');
    assert.equal(avisos[0].getAttribute('role'), 'status');
    assert.equal(avisos[0].parentNode, buscar(raiz, 'vista-inicio'), 'es un bloque más de Inicio, en su flujo');
    const pos = (n) => todos.indexOf(n);
    assert.ok(pos(buscar(raiz, 'ahora')) < pos(avisos[0]) && pos(avisos[0]) < pos(buscar(raiz, 'progreso-semana')), 'después de "Ahora" y antes de "Tu semana"');
    for (const arriba of ['saldo', 'ir-a-monedas', 'escudo', 'tarjeta-reto-hoy']) assert.ok(pos(buscar(raiz, arriba)) < pos(avisos[0]), `${arriba} queda arriba: el aviso no lo empuja ni lo tapa`);
    assert.equal(e.colgados.filter(esAviso).length, 0, 'ningún aviso de constancia cuelga del body (ahí flotaba sobre el saludo)');
    assert.equal(e.colgados.flatMap(elementos).filter(esAviso).length, 0);
    assert.equal(buscar(raiz, 'racha-de-nuevo'), null, 'subir y "Empezamos de nuevo" nunca van juntos');
  } finally { e.cerrar(); }
});

test('U73: en Inicio, con la misma constancia de la última vez o en la primera visita, no hay aviso en ninguna parte', async () => {
  for (const visto of [3, null]) {
    const e = entorno();
    try {
      const sesion = sesionDeEstudiante({ profileId: 'prof-u73b', constancia: 3 });
      if (visto !== null) e.guardar('engrama_ultimo_constancia_prof-u73b', visto);
      const raiz = crearRaiz();
      await renderInicio(raiz, { sesion, token: 't', colegios: sesion.colegios, colegioActivo: sesion.colegio.id });
      await asentar();
      assert.equal(elementos(raiz).filter(esAviso).length + e.colgados.filter(esAviso).length, 0, `último visto ${visto}: sin aviso`);
    } finally { e.cerrar(); }
  }
});

test('U73 (adenda 4): en la asistencia, si el número sube NO hay aviso "¡Constancia N!" ni llama: el renglón de clases seguidas (con su ícono) ocupa su lugar dentro de la zona del sello, una sola vez, y nada cuelga del body', async () => {
  const e = entorno();
  try {
    e.guardar('engrama_ultimo_constancia_prof-u73c', 1);
    const zona = crearRaiz();
    celebrarAsistencia({ zona, monedas: 10, racha: 2, quien: 'prof-u73c' });
    const caja = buscar(zona, 'sello-zona');
    assert.equal(elementos(zona).filter(esAviso).length, 0, 'el aviso con llama es de la racha semanal de Inicio, no de la asistencia');
    const renglones = elementos(caja).filter((n) => n.className === 'constancia-asistencia');
    assert.equal(renglones.length, 1);
    assert.equal(renglones[0].parentNode, caja, 'dentro de la zona del sello, desde el primer pintado');
    assert.equal(textoDe(renglones[0]), 'Clases seguidas: 2');
    assert.equal((textoDe(caja).match(/Clases seguidas/g) || []).length, 1, 'el número se dice una sola vez en la zona');
    await asentar();
    assert.equal(e.colgados.filter(esAviso).length, 0, 'nada flota sobre la pantalla');
  } finally { e.cerrar(); }
  const sinSubir = entorno();
  try {
    sinSubir.guardar('engrama_ultimo_constancia_prof-u73d', 2);
    const zona = crearRaiz();
    celebrarAsistencia({ zona, monedas: 0, racha: 2, quien: 'prof-u73d' });
    assert.equal(elementos(zona).filter(esAviso).length, 0, 'sin subir no hay aviso');
    assert.equal(textoDe(elementos(zona).find((n) => n.className === 'constancia-asistencia')), 'Clases seguidas: 2', 'queda el renglón de siempre');
  } finally { sinSubir.cerrar(); }
});

test('U73: en las hojas de estilo el aviso no tiene posición propia (ni fixed, ni absolute, ni sticky) ni se ancla a un borde', () => {
  for (const hoja of ['estilos/juego.css', 'estilos/cara.css', 'estilos/componentes.css']) {
    const css = readFileSync(new URL(`../../${hoja}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/\.celebra-racha(?![\w-])/.test(m[1])) continue;
      assert.doesNotMatch(m[2], /position\s*:\s*(fixed|absolute|sticky)/, `${hoja} "${m[1].trim()}": el aviso no flota`);
      assert.doesNotMatch(m[2], /(^|[;\s])(top|left|right|bottom|translate)\s*:/, `${hoja} "${m[1].trim()}": el aviso no se ancla a un borde`);
    }
  }
});
