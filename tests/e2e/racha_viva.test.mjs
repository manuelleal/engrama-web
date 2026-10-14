// @ts-check
// E22 (docs/ESPEC_juego_oleada1.md §9.3, W48 y W49): la llama de la constancia con vida, en el navegador de verdad y con /auth/me de verdad (modo
// `supabase` contra el mock: la constancia y la mejor constancia son las del perfil del servidor; los "efectos de fuera" se hacen tocando el estado).
//   - visto 2 y el servidor dice 3: aviso "Tu llama creció", la llama en etapa 1 y confeti;
//   - 3 → 3: nada;
//   - visto 5 y el servidor dice 1: "Empezamos de nuevo. Tu mejor constancia: 5.", sin confeti ni aviso flotante;
//   - abrir Inicio dos veces sin cambios: 0 lienzos, 0 fichas, 0 avisos.
// Tramposos que deben ponerse rojos aquí: x_racha_rota_asusta (src/ui/racha.js) y x_premio_por_abrir (src/vistas/estudiante/inicio.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { conNavegacion, abrirComo, escribirDireccion, CORREOS, OMITIR } from './apoyo_nav_e2e.mjs';

/** Vuelve a Inicio y mira lo que pasa durante 1,6 s: lo más que hubo de cada cosa y cómo quedó la pantalla. */
const VISITAR_INICIO = `(async () => {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const contar = (s) => document.querySelectorAll(s).length;
  const visto = { confeti: 0, fichas: 0, avisos: 0, aviso: null, cruce: null };
  document.body.dataset.listo = '';
  location.hash = '#/inicio';
  for (let i = 0; i < 80 && !(document.body.dataset.listo === '1' && document.querySelector('[data-testid="constancia"]')); i++) await esperar(25);
  for (let i = 0; i < 32; i++) {
    visto.confeti = Math.max(visto.confeti, contar('[data-testid="confeti"]'));
    visto.fichas = Math.max(visto.fichas, contar('.ficha-moneda'));
    visto.avisos = Math.max(visto.avisos, contar('[data-testid="celebra-racha"]'));
    const aviso = document.querySelector('[data-testid="celebra-racha"]');
    if (aviso) {
      visto.aviso = aviso.textContent; visto.cruce = aviso.getAttribute('data-cruce');
      // U73: el aviso va en el flujo de Inicio. No toca la caja del saludo ni la del enlace a Mis monedas, y lo que está en el centro de cada una es ella misma.
      const a = aviso.getBoundingClientRect();
      const toca = (el) => { const r = el.getBoundingClientRect(); return a.top < r.bottom - 1 && a.bottom > r.top + 1 && a.left < r.right - 1 && a.right > r.left + 1; };
      const libre = (el) => { const r = el.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === el || el.contains(e); };
      const saludo = document.querySelector('[data-testid="vista-inicio"] h1'); const enlace = document.querySelector('[data-testid="ir-a-monedas"]');
      visto.lugar = { posicion: getComputedStyle(aviso).position, dentro: !!aviso.closest('[data-testid="vista-inicio"]'), tocaSaludo: toca(saludo), tocaEnlace: toca(enlace), saludoLibre: libre(saludo), enlaceLibre: libre(enlace) };
    }
    await esperar(50);
  }
  const constancia = document.querySelector('[data-testid="constancia"]');
  return {
    ...visto,
    constancia: constancia.textContent,
    etapa: constancia.querySelector('.llama').getAttribute('data-etapa'),
    deNuevo: document.querySelector('[data-testid="racha-de-nuevo"]')?.textContent ?? null,
    pagina: document.querySelector('[data-testid="vista-inicio"]').textContent,
  };
})()`;

test('E22: la llama crece al cruzar 3 (aviso, etapa 1 y confeti); con el mismo valor, nada; si baja desde 5, "Empezamos de nuevo" con la mejor constancia del servidor, sin confeti ni aviso; y abrir Inicio sin cambios no celebra nada', { skip: OMITIR, timeout: 120_000 }, async () => {
  await conNavegacion(async (url, estado) => {
    estado.backend.racha = false; // W81: mide la constancia de siempre (el respaldo); la racha semanal la mide E37 (docs/ESPEC_practica_del_dia.md §3)
    const profileId = estado.cuentas.get(CORREOS.student).profileId;
    const perfil = estado.profiles.get(profileId);
    Object.assign(perfil, { current_streak: 3, longest_streak: 5 });
    const sesion = await abrirComo(url, 'student');
    const visto = (n) => sesion.evaluar(`localStorage.setItem('engrama_ultimo_constancia_${profileId}', '${n}'); void 0`);
    const salirYVolver = async () => { await escribirDireccion(sesion, '#/retos'); return sesion.evaluar(VISITAR_INICIO); };
    try {
      // Lo último visto en este equipo era 2 y el servidor dice 3: cruza el umbral.
      await visto(2);
      const crece = await salirYVolver();
      assert.equal(crece.aviso, '¡Constancia 3! Tu llama creció.');
      assert.equal(crece.cruce, '3');
      assert.deepEqual(crece.lugar, { posicion: 'static', dentro: true, tocaSaludo: false, tocaEnlace: false, saludoLibre: true, enlaceLibre: true }, 'U73: el aviso va en el flujo de Inicio; no tapa el saludo ni el enlace a Mis monedas');
      assert.equal(crece.etapa, '1', 'la llama está en su etapa 1');
      assert.match(crece.constancia, /Constancia: 3$/, 'y el número va aparte, en texto');
      assert.ok(crece.confeti >= 1, 'hubo confeti');
      assert.equal(crece.deNuevo, null);

      // 3 → 3: nada.
      const igual = await salirYVolver();
      assert.deepEqual([igual.confeti, igual.fichas, igual.avisos, igual.deNuevo], [0, 0, 0, null], 'con el mismo valor no se celebra nada');
      assert.equal(igual.etapa, '1', 'la llama sigue en su etapa');

      // Lo último visto era 5 y el servidor dice 1 (su mejor constancia: 5): una línea neutra, nada más.
      await visto(5);
      Object.assign(perfil, { current_streak: 1, longest_streak: 5 });
      const baja = await salirYVolver();
      assert.equal(baja.deNuevo, 'Empezamos de nuevo. Tu mejor constancia: 5.');
      assert.deepEqual([baja.confeti, baja.fichas, baja.avisos], [0, 0, 0], 'sin confeti ni aviso flotante');
      assert.equal(baja.etapa, '0');
      assert.doesNotMatch(baja.pagina, /✗|perdiste|en riesgo|se rompió/i);

      // Abrir Inicio dos veces más, sin que nada cambie: no se celebra por abrir, y la línea neutra se dijo una sola vez.
      for (const vez of ['primera', 'segunda']) {
        const quieto = await salirYVolver();
        assert.deepEqual([quieto.confeti, quieto.fichas, quieto.avisos, quieto.deNuevo], [0, 0, 0, null], `${vez} apertura sin cambios: 0 lienzos, 0 fichas, 0 avisos`);
      }
      assert.deepEqual(sesion.errores, []);
    } finally { await sesion.cerrar(); }
  });
});
