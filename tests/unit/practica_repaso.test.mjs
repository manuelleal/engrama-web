// @ts-check
// W80 · U82 (docs/ESPEC_practica_del_dia.md §W80): la pantalla "Repaso" (#/repaso), con el DOM de mentira y un servidor fijo. La fila de la tabla y
// su barra/volver los vigilan U61, U62, U69 y U60 (tests/unit/nav_*.test.mjs, ui_nav_inferior), que ya la nombran.
//   - una pregunta de la tanda por pantalla, con el aviso de que no suma monedas; la barra de abajo con Inicio activa;
//   - Comprobar manda la LABEL, una vez por toque; la banda dice veredicto, oración, regla, "por qué no la tuya" (solo si falló) y ejemplo;
//   - nunca monedas ni "+0"; "Siguiente" vuelve a pedir la tanda; sin más, "Repaso al día."; sin tanda, "No hay repaso por ahora.".
// Tramposos: x_repaso_envia_value y x_repaso_doble_envio (vistas/estudiante/repaso.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscar, textoDe, elementos } from './foto_vistas.mjs';
/** El hueco del ícono de la banda (tanda visual 2: un SVG de ui/iconos.js, antes el glifo ✓/✗ de texto; en el DOM de las fotos no se dibuja SVG). */
const hayIcono = (n) => elementos(n).some((e) => String(e.className).includes('sx-banda__icono') && e.getAttribute('aria-hidden') === 'true');
import { ctxEstudiante, asentar } from './fotos_de_navegacion.mjs';
import { pintar, enOrden, barraDe } from './apoyo_nav.mjs';
import { renderRepaso } from '../../src/vistas/estudiante/repaso.js';

const json = (status, cuerpo) => () => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const pregunta = (id, texto) => ({ id, question_type: 'multiple_choice', question_text: texto, options_json: [{ label: 'A', value: 'go' }, { label: 'B', value: 'goes' }], order_index: 1 });
const entrada = (id, p) => ({ entrada_id: id, etapa: 'refuerzo', nodo: { id: 'n', tipo: 'grammar', nivel: 'A2', nombre_es: 'Rutina' }, pregunta: p });
const tandaCon = (repaso) => ({ fecha: '2026-10-14', practica: { nivel: 'A2', con_nivel_de_set: false }, tandas_hoy: 1, tope_al_dia: 2, puede_pedir_otra: false, listo_por_hoy: false, sin_contenido_nuevo: false, racha_protegida: false,
  tanda: { numero: 1, modo: 'nuevo', nivel: 'A2', preguntas: 0, completa: true, repaso, retos: [] } });
const RESPUESTA = { entrada_id: 12, question_id: 'p1', is_correct: false, correct_answer: 'B', oracion_correcta: 'She goes to school every day.', estado: 'en_refuerzo', proxima_fecha: null, repetida: false, coins_earned: 0,
  explanation: { idioma: 'es', regla: 'Con he, she o it, el verbo lleva -s.', por_opcion: 'Go es para I, you, we y they.', ejemplo: 'He plays football.' } };

/** Un servidor fijo: la tanda va cambiando con cada GET (lo respondido ya no sale). */
function servidor(tandas) {
  const cuerpos = [];
  let i = 0;
  return {
    cuerpos,
    rutas: {
      'GET /challenges/tanda': () => json(200, tandas[Math.min(i++, tandas.length - 1)])(),
      'POST /challenges/refuerzo/12/respuestas': ({ init }) => { cuerpos.push(JSON.parse(init.body)); return new Promise((ok) => setTimeout(() => ok(RESPUESTA), 5)); },
    },
  };
}
const abrir = (rutas) => pintar(rutas, (r) => renderRepaso(r, ctxEstudiante()));
async function tocar(raiz, testid, veces = 1) {
  const n = buscar(raiz, testid);
  assert.ok(n, `falta ${testid}`);
  await Promise.all(Array.from({ length: veces }, () => n.disparar('click')).flat());
  await asentar(); await new Promise((ok) => setTimeout(ok, 20)); await asentar();
}

test('U82: el repaso muestra una pregunta de la tanda con su aviso ("no suma monedas"), la barra con Inicio activa, y Comprobar manda la label UNA vez', async () => {
  const { rutas, cuerpos } = servidor([tandaCon([entrada(12, pregunta('p1', 'She ___ to school.')), entrada(13, pregunta('p2', 'He ___ TV.'))])]);
  const { raiz, llamadas, cerrar } = await abrir(rutas);
  try {
    assert.equal(textoDe(buscar(raiz, 'banner-repaso')), 'Repaso: no suma monedas, sí cuenta para tu racha');
    assert.equal(textoDe(buscar(raiz, 'repaso-quedan')), 'Te quedan 2 preguntas de repaso');
    assert.equal(textoDe(buscar(raiz, 'enunciado')), 'She ___ to school.');
    const barra = barraDe(raiz);
    assert.ok(barra, 'lleva la barra de abajo');
    assert.deepEqual(enOrden(barra).filter((e) => e.getAttribute?.('aria-current') === 'page').map((e) => e.getAttribute('href')), ['#/inicio'], 'con Inicio activa');
    await tocar(raiz, 'opcion-A');
    await tocar(raiz, 'boton-comprobar', 2);
    assert.equal(llamadas.filter((l) => l.metodo === 'POST').length, 1, 'dos toques, una petición');
    assert.deepEqual(cuerpos, [{ question_id: 'p1', answer: 'A' }], 'la label, nunca el texto');
  } finally { cerrar(); }
});

test('U82: tras responder, la banda con el veredicto, la oración, la regla, por qué no la tuya y el ejemplo; nunca monedas ni "+0"', async () => {
  const { rutas } = servidor([tandaCon([entrada(12, pregunta('p1', 'She ___ to school.'))])]);
  const { raiz, cerrar } = await abrir(rutas);
  try {
    await tocar(raiz, 'opcion-A');
    await tocar(raiz, 'boton-comprobar');
    assert.equal(textoDe(buscar(raiz, 'explicacion-veredicto')), 'Esta vez no');
    assert.ok(hayIcono(buscar(raiz, 'explicacion')));
    for (const parte of ['oracion', 'regla', 'porQue', 'ejemplo']) assert.ok(buscar(raiz, `explicacion-${parte}`), parte);
    const texto = textoDe(raiz);
    assert.ok(!/moneda|\+0/i.test(texto.replace('no suma monedas', '')), `el repaso no habla de monedas: ${texto}`);
  } finally { cerrar(); }
});

test('U82: "Siguiente" vuelve a pedir la tanda: con lo que queda sigue; sin más, "Repaso al día." y el camino a Inicio', async () => {
  const { rutas } = servidor([tandaCon([entrada(12, pregunta('p1', 'uno'))]), tandaCon([])]);
  const { raiz, cerrar } = await abrir(rutas);
  try {
    await tocar(raiz, 'opcion-B');
    await tocar(raiz, 'boton-comprobar');
    await tocar(raiz, 'boton-siguiente');
    assert.equal(textoDe(buscar(raiz, 'repaso-al-dia')), 'Repaso al día.Seguir con tu práctica');
    assert.equal(buscar(raiz, 'repaso-seguir').getAttribute('href'), '#/inicio');
  } finally { cerrar(); }
});

test('U82: sin tanda (la ruta no existe o no se ha pedido hoy) dice "No hay repaso por ahora." y no es un callejón', async () => {
  for (const tanda of [json(404, { detail: 'Not Found' }), json(200, { ...tandaCon([]), tanda: null })]) {
    const { raiz, cerrar } = await abrir({ 'GET /challenges/tanda': tanda });
    try {
      assert.match(textoDe(buscar(raiz, 'repaso-vacio')), /No hay repaso por ahora\./);
      assert.ok(barraDe(raiz) && buscar(raiz, 'repaso-seguir'));
    } finally { cerrar(); }
  }
});
