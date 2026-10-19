// @ts-check
// H5 (compuerta visual 24, hallazgo 5), E41: el error de la entrada ("Correo o contraseña incorrectos.") se LEE como error en el navegador de verdad, a 375×812 y
// a 1280×800: dentro de la región role="alert" lleva el ícono de lo incorrecto (equis SVG), el texto, el color de "incorrecto" del sistema (--sx-mal) sobre su
// fondo (--sx-mal-fondo) con contraste de texto (≥ 4,5:1) y el ícono con el mismo tono; y vacía no ocupa sitio.
// Tramposo: x_entrada_error_sin_tono (estilos/entrada.css con el error en tinta negra, como antes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarLoginPiloto, CORREOS_PILOTO, CONFIG_PILOTO } from '../../herramientas/mock/login_piloto.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lo que se mide de la zona de error: texto, ícono, colores resueltos, contraste y tamaño. Corre en la página. */
const MEDIR = `(() => { try {
  const zona = document.querySelector('[data-testid="entrada-error"]');
  const rgb = (c) => c.match(/[0-9.]+/g).slice(0, 3).map(Number);
  const luz = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contraste = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const raiz = getComputedStyle(document.documentElement);
  const resolver = (variable) => { const e = document.createElement('i'); e.style.color = 'var(' + variable + ')'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; };
  const estilo = getComputedStyle(zona); const caja = zona.getBoundingClientRect();
  const icono = zona.querySelector('svg');
  return {
    rol: zona.getAttribute('role'), texto: zona.textContent, icono: icono?.getAttribute('data-icono') ?? null,
    iconoOculto: icono?.parentElement?.getAttribute('aria-hidden') ?? null,
    color: estilo.color, fondo: estilo.backgroundColor, colorIcono: icono ? getComputedStyle(icono).color : null,
    mal: resolver('--sx-mal'), malFondo: resolver('--sx-mal-fondo'),
    contraste: Math.round(contraste(estilo.color, estilo.backgroundColor) * 100) / 100,
    alto: Math.round(caja.height), ancho: Math.round(caja.width), desborda: document.documentElement.scrollWidth > window.innerWidth,
  };
  } catch (e) { return { fallo: String(e && e.stack || e) }; }
})()`;

test('E41: el error de la entrada se lee como error (ícono equis + color de incorrecto + texto, role alert) a 375×812 y a 1280×800; vacío no ocupa sitio', { skip: OMITIR, timeout: 120_000 }, async () => {
  const estado = estadoConEstudiantesSembrados();
  sembrarLoginPiloto(estado);
  await conAppCompleta(async (url) => {
    for (const [ancho, alto] of [[375, 812], [1280, 800]]) {
      const sesion = await abrirSesion({ ancho, alto });
      try {
        await sesion.navegar(url);
        const antes = await sesion.evaluar(MEDIR);
        assert.equal(antes.fallo, undefined, String(antes.fallo));
        assert.equal(antes.rol, 'alert', `${ancho}: la región que avisa existe desde el principio`);
        assert.equal(antes.texto, '');
        assert.ok(antes.alto <= 4, `${ancho}: vacía no ocupa sitio (${antes.alto} px)`);
        await sesion.evaluar(`(() => {
          document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(CORREOS_PILOTO.estudiante)};
          document.querySelector('[data-testid="campo-contrasena"]').value = 'una-clave-que-no-es-1';
          document.querySelector('[data-testid="boton-entrar"]').click();
        })()`);
        for (let i = 0; i < 60 && !(await sesion.evaluar(`(document.querySelector('[data-testid="entrada-error"]')?.textContent || '').length > 0`)); i++) await esperar(100);
        const m = await sesion.evaluar(MEDIR);
        assert.equal(m.texto, 'Correo o contraseña incorrectos.', `${ancho}: el texto de siempre`);
        assert.equal(m.rol, 'alert');
        assert.equal(m.icono, 'equis', `${ancho}: ícono de lo incorrecto (SVG)`);
        assert.equal(m.iconoOculto, 'true', `${ancho}: el ícono es decorativo`);
        assert.equal(m.color, m.mal, `${ancho}: el texto en el color de "incorrecto" del sistema (${m.color} contra ${m.mal})`);
        assert.equal(m.fondo, m.malFondo, `${ancho}: sobre su fondo de "incorrecto"`);
        assert.equal(m.colorIcono, m.mal, `${ancho}: el ícono hereda el mismo tono`);
        assert.ok(m.contraste >= 4.5, `${ancho}: contraste de texto ${m.contraste}:1`);
        assert.ok(m.alto >= 36 && m.alto <= 80, `${ancho}: la banda mide lo que un renglón con aire (${m.alto} px)`);
        assert.equal(m.desborda, false, `${ancho}: sin desborde horizontal`);
        assert.deepEqual(sesion.errores.filter((e) => !/HTTP 400 .*\/auth\/v1\/token/.test(e)), [], `${ancho}: sin errores de consola (salvo el 400 del propio intento fallido)`);
      } finally { await sesion.cerrar(); }
    }
  }, { estado, authConfig: CONFIG_PILOTO });
});
