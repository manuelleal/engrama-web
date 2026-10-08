// @ts-check
// W37 · E17, E18 y E19 (docs/ESPEC_pantallas_anillo.md §9.3; la medida de E17 es la de ESPEC_mvp_uis.md §9.4): las pantallas NUEVAS del anillo que ya existen, en el
// navegador de verdad y en modo supabase: Inicio con sus tarjetas, "Clase en vivo", "Examen de nivel", "Mis datos: solicitudes", "Herramientas de clase" del
// profe, "Esperando a tu profe" y "Cuenta suspendida". Quedan FUERA (sus pantallas no están hechas, W31 y W32 esperan el sí de Christiam sobre la clave de servicio):
// el registro con código de grupo y el panel de inscripciones del profe.
//   E17  a 375×812 y a 1280×800: sin scroll horizontal, blancos táctiles de 44 px, texto de 16 px, html[lang=es], nombre accesible en todo, label en todo
//        campo, y una región con aria-live/role donde la pantalla da un resultado.
//   E18  sin red: toda acción que escribe o que sale a otro origen queda deshabilitada con su texto, y no sale ninguna petición.
//   E19  prefers-reduced-motion: el Drako de la espera queda quieto y el escudo no se anima (con un control sin esa preferencia, para que la medida pueda fallar).
// Con Edge headless y la CPU cargada los E2E fallan por tiempo: repite una vez antes de concluir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarLoginPiloto, CORREOS_PILOTO, CLAVE_DEMO, CONFIG_PILOTO } from '../../herramientas/mock/login_piloto.mjs';
import { crearProfile, agregarMembresia } from '../../herramientas/mock/estado.mjs';
import { crearCuenta } from '../../herramientas/mock/gotrue.mjs';
import { registrarse } from '../../herramientas/mock/rutas_registro.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const CONFIG = { ...CONFIG_PILOTO, EVA_URL: 'http://127.0.0.1:9/eva', SET_URL: 'http://127.0.0.1:9/set' }; // el puerto 9 no escucha: ningún test sale de verdad
const CLAVE_PIA = 'clave-larga-123';
const TAMANOS = [[375, 812], [1280, 800]];

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
/** Si un paso del navegador se cuelga, el test dice cuál (en vez de quedarse mudo hasta el tope del test). */
const limite = (promesa, que, ms = 30_000) => Promise.race([promesa, new Promise((_, rechazar) => setTimeout(() => rechazar(new Error(`se colgó: ${que}`)), ms))]);
const hay = (sesion, testid) => sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`);
const texto = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]')?.textContent ?? null`);
async function esperarVista(sesion, testid, limiteMs = 8000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await hay(sesion, testid)) return true; await esperar(100); }
  return false;
}
const entrarCon = (sesion, correo, clave) => sesion.evaluar(`(() => {
  document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(correo)};
  document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(clave)};
  document.querySelector('[data-testid="boton-entrar"]').click();
})()`);
const ir = async (sesion, hash, testid) => { await sesion.evaluar(`location.hash = ${JSON.stringify(hash)}`); return esperarVista(sesion, testid); };

/** El mock de siempre + las cuentas del piloto + una estudiante con nivel definitivo + una pendiente (Pía) + una suspendida (Sofía). */
function estadoDeLasPantallas() {
  const estado = estadoConEstudiantesSembrados();
  const ids = sembrarLoginPiloto(estado);
  const profileId = crearProfile(estado, { documentoId: 'E17-ANA', nombre: 'Ana Pantallas' });
  agregarMembresia(estado, { tenantId: estado.tenantDemoId, profileId, role: 'student', fullName: 'Ana Pantallas', groupCode: 'SINT-B1-01' });
  Object.assign(estado.profiles.get(profileId), { consent_version: CONFIG_PILOTO.AVISO_VERSION, consent_at: '2026-10-01T12:00:00.000Z' });
  crearCuenta(estado, { correo: 'ana17@piloto.test', password: CLAVE_DEMO, profileId });
  estado.niveles.set(`${profileId}:${estado.tenantDemoId}`, { cefr: 'A2', source: 'set', provisional: false, assessed_at: '2026-10-06T15:00:00Z' });
  const grupo = [...estado.groups.values()][0];
  estado.codigosInscripcion.set(grupo.id, { codigo: 'ABCDEFGH', vence: Date.now() + 3600_000, cupo: 8, usos: 0, activo: true });
  const r = registrarse(estado, {}, {
    codigo: 'ABCD-EFGH', nombre: 'Pía Pendiente', correo: 'pia17@piloto.test', codigo_estudiantil: '917',
    contrasena: CLAVE_PIA, mayor_de_edad: true, aviso_version: CONFIG_PILOTO.AVISO_VERSION,
  });
  assert.equal(r.status, 201);
  [...estado.profiles.values()].find((p) => p.documento_id === 'PILOTO-ESTUDIANTE').is_active = false; // Elena Estudiante: suspendida
  return { estado, ids };
}

/**
 * Lo que E17 mide en la pantalla que esté a la vista: su contenido PROPIO. Quedan fuera los componentes compartidos que ya existían (la navegación, la barra del
 * profe con su selector de institución y su "Cerrar sesión", la cabecera de Inicio con el sonido y la constancia): no son de estas pantallas.
 * "Texto base" (16 px) es el de los párrafos, los títulos y los campos; los chips y las etiquetas siguen el tamaño del sistema de diseño.
 */
const MEDIR = `(() => {
  const compartido = (e) => e.closest('nav, .barra-rol, .barra-superior, .encabezado-reto, .selector-colegio');
  const visible = (e) => { if (compartido(e)) return false; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden]'); };
  const dato = (e) => (e.dataset.testid || e.tagName.toLowerCase()) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height);
  const interactivos = [...document.querySelectorAll('button, a[href], input, select, textarea')].filter(visible);
  const nombre = (e) => (e.getAttribute('aria-label') || e.textContent || (e.labels && e.labels[0] && e.labels[0].textContent) || e.getAttribute('title') || '').trim();
  const campos = [...document.querySelectorAll('input, select, textarea')].filter(visible);
  const textos = [...document.querySelectorAll('h1, h2, p, input, select, textarea')].filter(visible)
    .filter((e) => !e.classList.contains('texto-apoyo') && !e.classList.contains('etiqueta-icono'));
  return {
    scroll: document.documentElement.scrollWidth, ancho: window.innerWidth, lang: document.documentElement.lang,
    // html y body pueden recortar en vez de desbordar: se mira también el borde derecho de lo que está pintado en la pantalla.
    desbordan: [...document.querySelectorAll('#vista *')].filter(visible).filter((e) => e.getBoundingClientRect().right > __ANCHO__ + 1).slice(0, 5).map(dato),
    chicos: interactivos.filter((e) => { const r = e.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map(dato),
    sinNombre: interactivos.filter((e) => !nombre(e)).map(dato),
    sinLabel: campos.filter((e) => !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).map(dato),
    pequenos: textos.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => dato(e) + ' ' + getComputedStyle(e).fontSize),
    letra: parseFloat(getComputedStyle(document.body).fontSize),
    vivas: document.querySelectorAll('[role="alert"], [role="status"], [aria-live]').length,
  };
})()`;

/** Mide la pantalla actual a los dos tamaños y devuelve los hallazgos (vacío = todo bien). */
async function medirEnLosDosTamanos(sesion, nombre, { conRegionViva = true } = {}) {
  const hallazgos = [];
  await esperar(1500); // la entrada de cada pantalla es una animación de escala: medida a medias, un botón de 44 px mide 43
  for (const [ancho, alto] of TAMANOS) {
    await sesion.redimensionar(ancho, alto);
    await esperar(400);
    // Con la emulación de celular, `innerWidth` crece hasta el contenido: el ancho que cuenta es el que se pidió, no el que reporta la página.
    const m = await sesion.evaluar(MEDIR.replaceAll('__ANCHO__', String(ancho)));
    const donde = `${nombre} a ${ancho}x${alto}`;
    if (m.scroll > ancho) hallazgos.push(`${donde}: scrollWidth ${m.scroll} > ${ancho}`);
    if (m.lang !== 'es') hallazgos.push(`${donde}: html[lang] = "${m.lang}"`);
    if (m.letra < 16) hallazgos.push(`${donde}: texto base ${m.letra}px`);
    for (const [clave, etiqueta] of [['desbordan', 'se sale del ancho'], ['chicos', 'blanco táctil < 44 px'], ['sinNombre', 'sin nombre accesible'], ['sinLabel', 'campo sin label'], ['pequenos', 'texto < 16 px']]) {
      if (m[clave].length) hallazgos.push(`${donde}: ${etiqueta}: ${m[clave].join('; ')}`);
    }
    if (conRegionViva && m.vivas === 0) hallazgos.push(`${donde}: ninguna región aria-live / role="status" / role="alert"`);
  }
  return hallazgos;
}

test('E17: las pantallas nuevas del anillo (Inicio con tarjetas, vivo, nivel, solicitudes, herramientas, espera y suspendida) a 375×812 y a 1280×800', { skip: OMITIR, timeout: 150_000 }, async () => {
  const { estado } = estadoDeLasPantallas();
  await conAppCompleta(async (url) => {
    const hallazgos = [];
    // El estudiante: Inicio con las tarjetas, Clase en vivo, Examen de nivel y Mis datos: solicitudes.
    let sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await entrarCon(sesion, 'ana17@piloto.test', CLAVE_DEMO);
      assert.ok(await esperarVista(sesion, 'anillo-tarjetas'), 'Inicio con las tarjetas');
      hallazgos.push(...await medirEnLosDosTamanos(sesion, 'Inicio con tarjetas', { conRegionViva: false }));
      assert.ok(await ir(sesion, '#/vivo', 'form-salida'));
      hallazgos.push(...await medirEnLosDosTamanos(sesion, 'Clase en vivo'));
      assert.ok(await ir(sesion, '#/nivel', 'form-salida'));
      hallazgos.push(...await medirEnLosDosTamanos(sesion, 'Examen de nivel'));
      assert.ok(await ir(sesion, '#/datos/solicitudes', 'form-solicitud'));
      hallazgos.push(...await medirEnLosDosTamanos(sesion, 'Mis datos: solicitudes'));
    } finally { await sesion.cerrar(); }
    // El docente: Herramientas de clase.
    sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await entrarCon(sesion, CORREOS_PILOTO.profe2, CLAVE_DEMO);
      assert.ok(await esperarVista(sesion, 'herramientas-clase'), 'Herramientas de clase');
      hallazgos.push(...await medirEnLosDosTamanos(sesion, 'Herramientas de clase'));
    } finally { await sesion.cerrar(); }
    // La pendiente y la suspendida.
    for (const [correo, clave, vista, nombre] of [['pia17@piloto.test', CLAVE_PIA, 'vista-esperando', 'Esperando a tu profe'], [CORREOS_PILOTO.estudiante, CLAVE_DEMO, 'vista-suspendida', 'Cuenta suspendida']]) {
      sesion = await abrirSesion({ ancho: 375, alto: 812 });
      try {
        await sesion.navegar(url);
        await entrarCon(sesion, correo, clave);
        assert.ok(await esperarVista(sesion, vista), nombre);
        hallazgos.push(...await medirEnLosDosTamanos(sesion, nombre, { conRegionViva: vista === 'vista-esperando' }));
      } finally { await sesion.cerrar(); }
    }
    assert.deepEqual(hallazgos, [], hallazgos.join('\n'));
  }, { estado, authConfig: CONFIG });
});

test('E18: sin red, vivo, nivel, herramientas y solicitudes deshabilitan lo que escribe o sale a otro origen, con su texto y sin una petición', { skip: OMITIR, timeout: 150_000 }, async () => {
  const { estado } = estadoDeLasPantallas();
  await conAppCompleta(async (url) => {
    const estado18 = (testid) => ({ testid });
    void estado18;
    let sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await entrarCon(sesion, 'ana17@piloto.test', CLAVE_DEMO);
      assert.ok(await esperarVista(sesion, 'anillo-tarjetas'));
      const casos = [['#/vivo', 'form-salida', 'salida-entrar', 'salida-sin-red', /Sin conexión: no puedes entrar a la clase ahora\./],
        ['#/nivel', 'form-salida', 'salida-entrar', 'salida-sin-red', /Sin conexión: no puedes empezar el examen ahora\./],
        ['#/datos/solicitudes', 'form-solicitud', 'solicitud-enviar', 'solicitud-sin-red', /Sin conexión/]];
      for (const [hash, vista, boton, aviso, patron] of casos) {
        assert.ok(await ir(sesion, hash, vista), hash);
        await sesion.redSinConexion(true);
        await esperar(400);
        const antes = estado.registro.length;
        assert.equal(await sesion.evaluar(`document.querySelector('[data-testid="${boton}"]').disabled`), true, `${hash}: el botón queda deshabilitado`);
        assert.match(await texto(sesion, aviso), patron, `${hash}: con su texto`);
        await sesion.evaluar(`document.querySelector('[data-testid="${boton}"]').click()`); // deshabilitado: no hace nada
        await esperar(300);
        assert.equal(estado.registro.length, antes, `${hash}: 0 peticiones`);
        await sesion.redSinConexion(false);
        await esperar(400);
        assert.equal(await sesion.evaluar(`document.querySelector('[data-testid="${boton}"]').disabled`), false, `${hash}: al volver la red, el botón sirve otra vez`);
      }
    } finally { await sesion.cerrar(); }
    sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await entrarCon(sesion, CORREOS_PILOTO.profe2, CLAVE_DEMO);
      assert.ok(await esperarVista(sesion, 'herramientas-clase'));
      await sesion.redSinConexion(true);
      await esperar(400);
      const antes = estado.registro.length;
      const estados = JSON.parse(await sesion.evaluar('JSON.stringify([...document.querySelectorAll("[data-destino]")].map((b) => b.disabled))'));
      assert.deepEqual(estados, [true, true, true], 'los tres botones deshabilitados');
      assert.match(await texto(sesion, 'herramientas-sin-red'), /Sin conexión: no puedes abrir esta herramienta ahora\./);
      await sesion.evaluar('document.querySelector("[data-destino]").click()');
      await esperar(300);
      assert.equal(estado.registro.length, antes, '0 peticiones');
      assert.equal(await sesion.evaluar('location.origin'), new URL(url).origin, 'no salió a otro origen');
    } finally { await sesion.cerrar(); }
  }, { estado, authConfig: CONFIG });
});

test('E18: sin red, "Revisar de nuevo" de la espera no sale una sola petición y lo dice', { skip: OMITIR, timeout: 150_000 }, async () => {
  const { estado } = estadoDeLasPantallas();
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await entrarCon(sesion, 'pia17@piloto.test', CLAVE_PIA);
      assert.ok(await esperarVista(sesion, 'vista-esperando'));
      await sesion.redSinConexion(true);
      await esperar(400);
      const antes = estado.registro.length;
      await sesion.evaluar('document.querySelector(\'[data-testid="espera-revisar"]\').click()');
      await esperar(800);
      assert.equal(estado.registro.length, antes, '0 peticiones al servidor');
      assert.match(await texto(sesion, 'espera-estado'), /Sin conexión/, 'lo dice');
    } finally { await sesion.cerrar(); }
  }, { estado, authConfig: CONFIG });
});

/** Cuánto se mueve el Drako de la espera en ~2,4 s: cuántas veces cambia la posición de alguna de sus partes entre muestras. */
const MOVIMIENTO_DEL_DRAKO = `(async () => {
  const partes = ['cuerpo', 'cabeza', 'cola', 'ala', 'brazo-delantero'];
  const foto = () => partes.map((p) => { const e = document.querySelector('[data-testid="vista-esperando"] [data-parte="' + p + '"]'); if (!e) return 'x'; const r = e.getBoundingClientRect(); return Math.round(r.x * 10) + ',' + Math.round(r.y * 10); }).join('|');
  const muestras = [foto()];
  for (let i = 0; i < 12; i += 1) { await new Promise((r) => setTimeout(r, 200)); muestras.push(foto()); }
  return { hayRig: !!document.querySelector('[data-testid="vista-esperando"] svg [data-parte]'), cambios: muestras.filter((m, i) => i > 0 && m !== muestras[i - 1]).length };
})()`;

test('E19: con prefers-reduced-motion el Drako de la espera queda quieto (y sin esa preferencia SÍ se mueve: la medida puede fallar)', { skip: OMITIR, timeout: 150_000 }, async () => {
  const { estado } = estadoDeLasPantallas();
  await conAppCompleta(async (url) => {
    const medir = async (reducido) => {
      const sesion = await abrirSesion({ ancho: 375, alto: 812 });
      try {
        await limite(sesion.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reducido ? 'reduce' : 'no-preference' }] }), 'emular la preferencia');
        await limite(sesion.navegar(url), 'navegar');
        await limite(entrarCon(sesion, 'pia17@piloto.test', CLAVE_PIA), 'entrar');
        assert.ok(await limite(esperarVista(sesion, 'vista-esperando'), 'esperar la pantalla de espera'));
        await esperar(500);
        return await limite(sesion.evaluar(MOVIMIENTO_DEL_DRAKO), 'medir el Drako');
      } finally { await limite(sesion.cerrar(), 'cerrar el navegador'); }
    };
    const quieto = await medir(true);
    assert.equal(quieto.hayRig, true, 'es el Drako por partes (animado), no la imagen');
    assert.equal(quieto.cambios, 0, 'con "reducir movimiento" ninguna parte se mueve');
    const vivo = await medir(false);
    assert.equal(vivo.hayRig, true);
    assert.ok(vivo.cambios > 0, `el control: sin esa preferencia el Drako se mueve (cambios: ${vivo.cambios})`);
  }, { estado, authConfig: CONFIG });
});

test('E19: con prefers-reduced-motion el escudo no se anima (sin esa preferencia, un primer nivel definitivo SÍ lleva escudo-sube)', { skip: OMITIR, timeout: 150_000 }, async () => {
  const { estado } = estadoDeLasPantallas();
  await conAppCompleta(async (url) => {
    const clase = async (reducido) => {
      const sesion = await abrirSesion({ ancho: 375, alto: 812 });
      try {
        await sesion.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reducido ? 'reduce' : 'no-preference' }] });
        await sesion.navegar(url);
        await entrarCon(sesion, 'ana17@piloto.test', CLAVE_DEMO);
        assert.ok(await esperarVista(sesion, 'escudo'));
        await esperar(300);
        return { clase: await sesion.evaluar('document.querySelector(\'[data-testid="escudo"]\').className'), texto: await texto(sesion, 'escudo') };
      } finally { await sesion.cerrar(); }
    };
    const normal = await clase(false);
    assert.match(normal.clase, /escudo-sube/, 'el control: sin la preferencia, el primer nivel definitivo anima el escudo');
    assert.equal(normal.texto, 'A2');
    // Un navegador nuevo = sin "último visto": también sería el primer nivel; con la preferencia, aun así, no se anima.
    const reducido = await clase(true);
    assert.doesNotMatch(reducido.clase, /escudo-sube/, 'con "reducir movimiento", sin animación');
    assert.equal(reducido.texto, 'A2');
  }, { estado, authConfig: CONFIG });
});
