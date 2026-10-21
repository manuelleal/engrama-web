// @ts-check
// W31 · E12 (docs/ESPEC_pantallas_anillo.md §9.3, con la adenda 17.7): el registro con código de grupo en el navegador de verdad y en modo supabase (GoTrue falso).
//   - Registro completo: 201 → la pantalla "Registro enviado" (NO "Esperando a tu profe": el 201 no inicia sesión ni dice si la cuenta existía); la dirección sin el código;
//     los almacenamientos sin la contraseña, el correo ni el código; después, quien entra con sus credenciales ve "Esperando a tu profe" (el camino de W29).
//   - Con el mock sin la clave de servicio: 503 → "Todavía no está abierto" (y no "Error inesperado (503)").
//   - Con un código inventado: el texto único del 403.
//   - Doble toque en "Crear mi cuenta": UNA petición.
//   - El enlace `#/registro` sin sesión abre el registro; con REGISTRO_CON_CODIGO apagado, el botón de la entrada y el enlace dicen "Todavía no está abierto" con 0 peticiones.
//   - "Tu solicitud ya no está activa" ofrece "Crear cuenta", que lleva al registro.
// Tramposos: x_503_como_error_generico, x_codigo_en_la_url, x_registro_avisa_lo_que_no_sabe (registro.js), x_registro_abierto_sin_interruptor (registro.js, U26).
// Con Edge headless y la CPU cargada los E2E fallan por tiempo: repite una vez antes de concluir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarLoginPiloto, CONFIG_PILOTO } from '../../herramientas/mock/login_piloto.mjs';
import { rechazarSolicitud } from '../../herramientas/mock/rutas_registro.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const ABIERTO = { authConfig: { ...CONFIG_PILOTO, REGISTRO_CON_CODIGO: true } };
const CERRADO = { authConfig: CONFIG_PILOTO };
const CODIGO = 'ABCD-EFGH';
const NUEVA = { codigo: CODIGO, nombre: 'Nora Núñez', correo: 'nora12@piloto.test', estudiantil: '123456', clave: 'clave-larga-123' };

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const hay = (sesion, testid) => sesion.evaluar(`Boolean(document.querySelector('[data-testid="${testid}"]'))`);
const texto = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]')?.textContent ?? null`);
async function esperarVista(sesion, testid, limiteMs = 7000) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) { if (await hay(sesion, testid)) return true; await esperar(100); }
  return false;
}
const tocar = (sesion, testid) => sesion.evaluar(`document.querySelector('[data-testid="${testid}"]').click()`);

/** El mock de siempre + las cuentas del piloto + un código de grupo activo. */
function estadoConCodigo() {
  const estado = estadoConEstudiantesSembrados();
  sembrarLoginPiloto(estado);
  const grupo = [...estado.groups.values()][0];
  estado.codigosInscripcion.set(grupo.id, { codigo: 'ABCDEFGH', vence: Date.now() + 3600_000, cupo: 8, usos: 0, activo: true });
  return { estado, grupo };
}

/** Escribe el formulario (con `cambios` sobre `NUEVA`) y marca las dos casillas; NO envía. */
const llenar = (sesion, cambios = {}) => {
  const v = { ...NUEVA, ...cambios };
  return sesion.evaluar(`(() => {
    const poner = (id, valor) => { document.querySelector('[data-testid="registro-' + id + '"]').value = valor; };
    poner('codigo', ${JSON.stringify(v.codigo)}); poner('nombre', ${JSON.stringify(v.nombre)}); poner('correo', ${JSON.stringify(v.correo)});
    poner('codigo-estudiantil', ${JSON.stringify(v.estudiantil)}); poner('contrasena', ${JSON.stringify(v.clave)}); poner('repite', ${JSON.stringify(v.repite ?? v.clave)});
    document.querySelector('[data-testid="registro-mayor"]').checked = true;
    document.querySelector('[data-testid="registro-acepto-aviso"]').checked = true;
  })()`);
};
const enviar = (sesion) => tocar(sesion, 'registro-enviar');
const peticionesDeRegistro = (estado) => estado.registro.filter((r) => r.ruta === '/auth/registro').length;

async function abrirRegistro(url) {
  const sesion = await abrirSesion({ ancho: 375, alto: 812 });
  await sesion.navegar(url);
  assert.ok(await hay(sesion, 'form-entrada'), 'modo supabase: la entrada');
  await tocar(sesion, 'entrada-crear-cuenta');
  return sesion;
}

test('E12: registro completo → "Registro enviado" (no "Esperando"), la dirección y los almacenamientos sin secretos, y al entrar con sus credenciales ve "Esperando a tu profe"', { skip: OMITIR, timeout: 120_000 }, async () => {
  const { estado } = estadoConCodigo();
  await conAppCompleta(async (url) => {
    const sesion = await abrirRegistro(url);
    try {
      assert.ok(await esperarVista(sesion, 'vista-registro'), 'el formulario');
      await llenar(sesion);
      await enviar(sesion);
      assert.ok(await esperarVista(sesion, 'vista-registro-enviado'), `se ve: ${await sesion.evaluar('document.body.innerText')}`);
      const visible = await texto(sesion, 'vista-registro-enviado');
      assert.match(visible, /Recibimos tus datos\. Si todo está en orden, tu profe verá tu solicitud/);
      assert.doesNotMatch(await sesion.evaluar('document.body.innerText'), /Esperando a tu profe|No tienes permiso|Error inesperado/);
      assert.equal(await hay(sesion, 'vista-esperando'), false, 'el 201 no se hace pasar por la espera');
      // La dirección y los almacenamientos: sin el código, la contraseña ni el correo.
      const href = await sesion.evaluar('location.href');
      assert.ok(!href.includes('ABCD') && !href.toLowerCase().includes('abcdefgh') && !href.includes(NUEVA.clave) && !href.includes('nora12'), `la dirección limpia: ${href}`);
      const guardado = await sesion.evaluar('JSON.stringify([localStorage, sessionStorage])');
      for (const secreto of [NUEVA.clave, NUEVA.correo, 'ABCD', 'abcdefgh']) assert.ok(!guardado.toLowerCase().includes(secreto.toLowerCase()), `los almacenamientos no llevan "${secreto}": ${guardado}`);
      // El servidor sí la tiene: UNA petición, y ni un login ni un /auth/me por parte del registro.
      assert.equal(peticionesDeRegistro(estado), 1);
      assert.equal(estado.registro.filter((r) => r.ruta === '/auth/me').length, 0, 'el 201 no pide /auth/me');
      assert.equal(estado.solicitudesInscripcion.length, 1);
      // "Volver a entrar" y entrar con lo que acaba de crear: el camino de W29 la lleva a "Esperando a tu profe".
      await tocar(sesion, 'registro-volver');
      assert.ok(await esperarVista(sesion, 'form-entrada'), 'de vuelta en la entrada');
      await sesion.evaluar(`(() => {
        document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(NUEVA.correo)};
        document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(NUEVA.clave)};
        document.querySelector('[data-testid="boton-entrar"]').click();
      })()`);
      assert.ok(await esperarVista(sesion, 'vista-esperando'), 'ahora sí, "Esperando a tu profe"');
    } finally { await sesion.cerrar(); }
  }, { estado, ...ABIERTO });
});

test('E12: con el mock sin la clave de servicio, el 503 dice "Todavía no está abierto" (y no "Error inesperado (503)"); un código inventado da el texto único del 403', { skip: OMITIR, timeout: 120_000 }, async () => {
  const { estado } = estadoConCodigo();
  await conAppCompleta(async (url) => {
    const sesion = await abrirRegistro(url);
    try {
      assert.ok(await esperarVista(sesion, 'vista-registro'));
      // Código inventado: el texto único junto al campo, y lo escrito sigue ahí.
      await llenar(sesion, { codigo: 'ZZZZ-ZZZZ' });
      await enviar(sesion);
      const fin = Date.now() + 5000;
      while (Date.now() < fin && !(await texto(sesion, 'registro-error-codigo'))) await esperar(100);
      assert.equal(await texto(sesion, 'registro-error-codigo'), 'Ese código no sirve. Revisa que esté bien escrito o pídele uno nuevo a tu profe.');
      assert.equal(await sesion.evaluar('document.querySelector(\'[data-testid="registro-nombre"]\').value'), NUEVA.nombre, 'conserva lo escrito');
      // Sin la clave de servicio (D7 sin el sí): 503.
      estado.autorregistro.configurado = false;
      await llenar(sesion);
      await enviar(sesion);
      assert.ok(await esperarVista(sesion, 'vista-registro-no-abierto'), `se ve: ${await sesion.evaluar('document.body.innerText')}`);
      const visible = await sesion.evaluar('document.body.innerText');
      assert.match(visible, /Todavía no está abierto/);
      assert.doesNotMatch(visible, /Error inesperado|503/);
      const antes = peticionesDeRegistro(estado);
      await esperar(1500);
      assert.equal(peticionesDeRegistro(estado), antes, 'sin reintento automático');
    } finally { await sesion.cerrar(); }
  }, { estado, ...ABIERTO });
});

test('E12: un doble toque en "Crear mi cuenta" es UNA sola petición', { skip: OMITIR, timeout: 120_000 }, async () => {
  const { estado } = estadoConCodigo();
  await conAppCompleta(async (url) => {
    const sesion = await abrirRegistro(url);
    try {
      assert.ok(await esperarVista(sesion, 'vista-registro'));
      await llenar(sesion);
      await sesion.evaluar('(() => { const b = document.querySelector(\'[data-testid="registro-enviar"]\'); b.click(); b.click(); b.click(); })()');
      assert.ok(await esperarVista(sesion, 'vista-registro-enviado'));
      assert.equal(peticionesDeRegistro(estado), 1, 'una sola petición');
      assert.equal(estado.solicitudesInscripcion.length, 1);
    } finally { await sesion.cerrar(); }
  }, { estado, ...ABIERTO });
});

test('E12 / U26: el enlace del registro (el hash literal) abre el registro sin sesión; con REGISTRO_CON_CODIGO apagado, ese enlace y el botón de la entrada dicen "Todavía no está abierto" con 0 peticiones', { skip: OMITIR, timeout: 120_000 }, async () => {
  const { estado } = estadoConCodigo();
  await conAppCompleta(async (url) => {
    const enlace = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await enlace.navegar(`${url}#/registro`);
      assert.ok(await esperarVista(enlace, 'vista-registro'), 'el enlace que el profe comparte lleva al formulario');
      assert.equal(await hay(enlace, 'form-entrada'), false);
      assert.equal(estado.registro.length, 0, 'abrirlo no pide nada al servidor');
    } finally { await enlace.cerrar(); }
  }, { estado, ...ABIERTO });
  await conAppCompleta(async (url) => {
    const porBoton = await abrirRegistro(url);
    try {
      assert.ok(await esperarVista(porBoton, 'vista-registro-no-abierto'), 'el botón de la entrada');
      assert.match(await porBoton.evaluar('document.body.innerText'), /Todavía no está abierto/);
      assert.equal(await hay(porBoton, 'form-registro'), false, 'sin formulario');
    } finally { await porBoton.cerrar(); }
    const porEnlace = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await porEnlace.navegar(`${url}#/registro`);
      assert.ok(await esperarVista(porEnlace, 'vista-registro-no-abierto'), 'el enlace');
      await tocar(porEnlace, 'registro-volver');
      assert.ok(await esperarVista(porEnlace, 'form-entrada'), '"Volver a entrar" recarga en la dirección limpia');
      assert.equal(await porEnlace.evaluar('location.hash'), '', 'sin #/registro');
    } finally { await porEnlace.cerrar(); }
    assert.equal(estado.registro.length, 0, '0 peticiones al servidor en todo el recorrido');
  }, { estado, ...CERRADO });
});

test('E12: "Tu solicitud ya no está activa" ofrece "Crear cuenta", que lleva al formulario de registro', { skip: OMITIR, timeout: 120_000 }, async () => {
  const { estado, grupo } = estadoConCodigo();
  await conAppCompleta(async (url) => {
    // Pía se registra por el formulario, entra, y su profe la rechaza.
    const sesion = await abrirRegistro(url);
    try {
      assert.ok(await esperarVista(sesion, 'vista-registro'));
      await llenar(sesion);
      await enviar(sesion);
      assert.ok(await esperarVista(sesion, 'vista-registro-enviado'));
      await tocar(sesion, 'registro-volver');
      assert.ok(await esperarVista(sesion, 'form-entrada'));
      await sesion.evaluar(`(() => {
        document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(NUEVA.correo)};
        document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(NUEVA.clave)};
        document.querySelector('[data-testid="boton-entrar"]').click();
      })()`);
      assert.ok(await esperarVista(sesion, 'vista-esperando'));
      const profe = { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } };
      assert.equal(rechazarSolicitud(estado, profe, grupo.id, estado.solicitudesInscripcion[0].id).status, 200);
      await tocar(sesion, 'espera-revisar');
      assert.ok(await esperarVista(sesion, 'vista-ya-no-esta'));
      await tocar(sesion, 'ya-no-esta-crear');
      assert.ok(await esperarVista(sesion, 'vista-registro'), '"Crear cuenta" lleva al formulario');
    } finally { await sesion.cerrar(); }
  }, { estado, ...ABIERTO });
});

test('E12 (17.8): la regla de la contraseña se lee antes de enviar, sin desbordar a 375 px; una contraseña sin número ni símbolo no sale (0 peticiones) y el mensaje está junto al campo', { skip: OMITIR, timeout: 120_000 }, async () => {
  const { estado } = estadoConCodigo();
  await conAppCompleta(async (url) => {
    const sesion = await abrirRegistro(url);
    try {
      assert.ok(await esperarVista(sesion, 'vista-registro'));
      assert.equal(await texto(sesion, 'registro-ayuda-contrasena'), 'Mínimo 10 caracteres. Máximo 72 (la ñ y las letras con tilde cuentan doble). Debe tener una letra y un número o un símbolo: - _ . ! @ # $ % & * +');
      const caja = await sesion.evaluar(`(() => { const r = document.querySelector('[data-testid="registro-ayuda-contrasena"]').getBoundingClientRect(); return {derecha: r.right, ancho: window.innerWidth, alto: r.height}; })()`);
      assert.ok(caja.derecha <= 375 && caja.alto > 0, `la regla cabe en 375 px: ${JSON.stringify(caja)}`);
      // ESPEC_regla_clave C1: la regla se lee ANTES del campo (arriba de él en la pantalla), no después de empezar a escribir.
      const orden = await sesion.evaluar(`(() => { const a = document.querySelector('[data-testid="registro-ayuda-contrasena"]').getBoundingClientRect(); const c = document.querySelector('[data-testid="registro-contrasena"]').getBoundingClientRect(); return {reglaFin: a.bottom, campoIni: c.top}; })()`);
      assert.ok(orden.reglaFin <= orden.campoIni, `la regla termina antes de donde empieza el campo: ${JSON.stringify(orden)}`);
      await llenar(sesion, { clave: 'solo-letras-aqui'.replace(/-/g, '').padEnd(12, 'x') });
      await enviar(sesion);
      await esperar(600);
      assert.equal(await texto(sesion, 'registro-error-contrasena'), 'Te falta: un número o un símbolo (- _ . ! @ # $ % & * +).', 'dice exactamente qué falta (ESPEC_regla_clave C2)');
      assert.equal(peticionesDeRegistro(estado), 0, '0 peticiones');
      // con la letra ñ y un número, sí sale
      await llenar(sesion, { clave: 'contraseña1' });
      await enviar(sesion);
      assert.ok(await esperarVista(sesion, 'vista-registro-enviado'));
      assert.equal(peticionesDeRegistro(estado), 1);
    } finally { await sesion.cerrar(); }
  }, { estado, ...ABIERTO });
});

test('E12 (ESPEC_regla_clave C2): mientras se escribe, la línea "qué falta" cambia con ícono y texto, cabe a 375 px sin desbordar, con su hoja diferida puesta; escribir no pide nada y enviar con la contraseña corta dice lo mismo', { skip: OMITIR, timeout: 120_000 }, async () => {
  const { estado } = estadoConCodigo();
  await conAppCompleta(async (url) => {
    const sesion = await abrirRegistro(url);
    try {
      assert.ok(await esperarVista(sesion, 'vista-registro'));
      const escribir = (valor) => sesion.evaluar(`(() => { const e = document.querySelector('[data-testid="registro-contrasena"]'); e.value = ${JSON.stringify(valor)}; e.dispatchEvent(new Event('input', {bubbles: true})); })()`);
      const linea = () => sesion.evaluar(`(() => { const v = document.querySelector('[data-testid="registro-falta-contrasena"]'); const r = v.getBoundingClientRect(); return {texto: v.textContent, estado: v.dataset.estado, iconos: v.querySelectorAll('svg').length, display: getComputedStyle(v).display, derecha: r.right, alto: r.height, rol: v.getAttribute('role')}; })()`);
      // el módulo diferido tarda unos milisegundos en llegar: se espera a que la primera tecla ya tenga línea
      const inicio = Date.now();
      let l;
      do { await escribir('abcdef'); await esperar(100); l = await linea(); } while (!l.texto && Date.now() - inicio < 6000);
      assert.equal(l.texto, 'Te falta: llegar a 10 caracteres y un número o un símbolo (- _ . ! @ # $ % & * +).');
      assert.equal(l.estado, 'falta');
      assert.equal(l.rol, 'status');
      assert.equal(l.iconos, 1, 'ícono + texto, no solo color');
      assert.equal(l.display, 'flex', 'la hoja diferida (registro_regla.css) llegó: sin ella la línea sería un párrafo suelto');
      assert.ok(l.derecha <= 375 && l.alto > 0, `la línea cabe en 375 px: ${JSON.stringify(l)}`);
      assert.equal(await sesion.evaluar('document.documentElement.scrollWidth <= window.innerWidth'), true, 'sin scroll horizontal');
      assert.equal(await sesion.evaluar(`Boolean(document.head.querySelector('link[href="/estilos/registro_regla.css"]'))`), true, 'la hoja la puso el módulo, no index.html');
      await escribir('abcdefghij');
      assert.equal((await linea()).texto, 'Te falta: un número o un símbolo (- _ . ! @ # $ % & * +).');
      await escribir('abcdefghi1');
      const ok = await linea();
      assert.equal(ok.texto, 'Cumple la regla.');
      assert.equal(ok.estado, 'ok');
      assert.equal(ok.iconos, 1);
      assert.equal(peticionesDeRegistro(estado), 0, 'escribir no pide nada');
      // enviar con la contraseña corta: el mensaje junto al campo es el mismo que decía la línea
      await escribir('abcdef');
      const dicho = (await linea()).texto;
      await llenar(sesion, { clave: 'abcdef' });
      await enviar(sesion);
      await esperar(600);
      assert.equal(await texto(sesion, 'registro-error-contrasena'), dicho, 'el envío dice lo mismo que la línea');
      assert.equal((await linea()).texto, '', 'y la línea calla para no repetirlo');
      assert.equal(peticionesDeRegistro(estado), 0, '0 peticiones');
      assert.equal(await sesion.evaluar('JSON.stringify([localStorage, sessionStorage])'), '[{},{}]', 'nada guardado');
    } finally { await sesion.cerrar(); }
  }, { estado, ...ABIERTO });
});

test('E12 (17.8): "Mostrar" / "Ocultar" alterna los dos campos sin tocar el valor (blanco táctil de 44 px, sin desbordar); una repetición distinta no sale (0 peticiones) y el cuerpo que sale tiene las 7 claves', { skip: OMITIR, timeout: 120_000 }, async () => {
  const { estado } = estadoConCodigo();
  await conAppCompleta(async (url) => {
    const sesion = await abrirRegistro(url);
    try {
      assert.ok(await esperarVista(sesion, 'vista-registro'));
      const tipos = () => sesion.evaluar(`['registro-contrasena', 'registro-repite'].map((t) => document.querySelector('[data-testid="' + t + '"]').type).join(',')`);
      assert.equal(await tipos(), 'password,password');
      assert.equal(await texto(sesion, 'registro-mostrar'), 'Mostrar');
      const caja = await sesion.evaluar(`(() => { const r = document.querySelector('[data-testid="registro-mostrar"]').getBoundingClientRect(); return {alto: r.height, derecha: r.right}; })()`);
      assert.ok(caja.alto >= 44 && caja.derecha <= 375, `el botón mide 44 px o más y cabe: ${JSON.stringify(caja)}`);
      await llenar(sesion);
      await tocar(sesion, 'registro-mostrar');
      assert.equal(await tipos(), 'text,text');
      assert.equal(await texto(sesion, 'registro-mostrar'), 'Ocultar');
      assert.equal(await sesion.evaluar(`document.querySelector('[data-testid="registro-contrasena"]').value`), NUEVA.clave, 'el valor no cambia');
      assert.equal(await sesion.evaluar('document.documentElement.scrollWidth <= window.innerWidth'), true, 'sin scroll horizontal con las contraseñas a la vista');
      await tocar(sesion, 'registro-mostrar');
      assert.equal(await tipos(), 'password,password');
      assert.equal(await sesion.evaluar('JSON.stringify([localStorage, sessionStorage])'), '[{},{}]', 'mostrar no guarda nada');
      // una repetición distinta: no sale
      await llenar(sesion, { repite: NUEVA.clave + 'x' });
      await enviar(sesion);
      await esperar(600);
      assert.equal(await texto(sesion, 'registro-error-repite'), 'Las dos contraseñas no coinciden.');
      assert.equal(peticionesDeRegistro(estado), 0, '0 peticiones');
      // iguales: sale una, con las 7 claves y sin la repetición (se mira el cuerpo en la página, antes de que viaje)
      await sesion.evaluar("(() => { window.__cuerpos = []; const f = window.fetch; window.fetch = (u, i) => { if (String(u).includes('/auth/registro')) window.__cuerpos.push(i.body); return f(u, i); }; })()");
      await llenar(sesion);
      await enviar(sesion);
      assert.ok(await esperarVista(sesion, 'vista-registro-enviado'));
      assert.equal(peticionesDeRegistro(estado), 1);
      const cuerpos = await sesion.evaluar('window.__cuerpos');
      assert.equal(cuerpos.length, 1);
      assert.deepEqual(Object.keys(JSON.parse(cuerpos[0])).sort(), ['aviso_version', 'codigo', 'codigo_estudiantil', 'contrasena', 'correo', 'mayor_de_edad', 'nombre']);
      assert.ok(!cuerpos[0].includes('repite'), 'la repetición no viaja');
    } finally { await sesion.cerrar(); }
  }, { estado, ...ABIERTO });
});
