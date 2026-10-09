// @ts-check
// El aviso de tratamiento de datos (Ley 1581) se puede leer SIEMPRE, también el profe y el admin (con
// cuentas reales): desde W70 (docs/ESPEC_navegacion.md §5.6) vive en Perfil, que es de los tres roles (barra → Perfil). Y el correo de contacto que
// llega en AVISO_CONTACTO se muestra como texto seleccionable, no como enlace que abra otra app.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirSesion } from '../../herramientas/cdp.mjs';
import { conAppCompleta, estadoConEstudiantesSembrados } from './ayudante_servidor.mjs';
import { sembrarLoginPiloto, CORREOS_PILOTO, CLAVE_DEMO, CONFIG_PILOTO } from '../../herramientas/mock/login_piloto.mjs';
import { partirContacto } from '../../src/vistas/aviso_datos.js';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));
const OMITIR = !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

test('aviso: un correo dentro del contacto se separa del resto del texto; sin correo, todo es texto', () => {
  assert.deepEqual(partirContacto('datos@piloto.test'), [{ texto: 'datos@piloto.test', correo: true }]);
  assert.deepEqual(partirContacto('la oficina o soporte@uis.edu.co.'), [
    { texto: 'la oficina o ', correo: false }, { texto: 'soporte@uis.edu.co', correo: true }, { texto: '.', correo: false },
  ]);
  assert.deepEqual(partirContacto('Ventanilla 3, edificio B'), [{ texto: 'Ventanilla 3, edificio B', correo: false }]);
});

test('aviso: el profe llega al aviso desde su Perfil (barra → Perfil), lo abre, el correo es texto seleccionable y vuelve a Perfil', { skip: OMITIR }, async () => {
  const estado = estadoConEstudiantesSembrados();
  sembrarLoginPiloto(estado);
  await conAppCompleta(async (url) => {
    const sesion = await abrirSesion({ ancho: 375, alto: 812 });
    try {
      await sesion.navegar(url);
      await esperar(1500);
      await sesion.evaluar(`(() => {
        document.querySelector('[data-testid="campo-correo"]').value = ${JSON.stringify(CORREOS_PILOTO.profe2)};
        document.querySelector('[data-testid="campo-contrasena"]').value = ${JSON.stringify(CLAVE_DEMO)};
        document.querySelector('[data-testid="boton-entrar"]').click();
      })()`);
      await esperar(2500);
      assert.equal(await sesion.evaluar(`document.querySelector('[data-testid="barra-ver-aviso"]')`), null, 'la barra de arriba salió del inicio del profe');
      await sesion.evaluar(`document.querySelector('nav.nav-inferior a[href="#/perfil"]').click()`);
      await esperar(800);
      const enPerfil = await sesion.evaluar(`document.querySelector('[data-testid="perfil-ver-aviso"]')?.textContent ?? null`);
      assert.equal(enPerfil, 'Tratamiento de tus datos', 'el profe ve el enlace al aviso en su Perfil');
      await sesion.evaluar(`document.querySelector('[data-testid="perfil-ver-aviso"]').click()`);
      await esperar(800);
      const aviso = await sesion.evaluar(`({
        correo: document.querySelector('[data-testid="aviso-correo"]')?.textContent ?? null,
        seleccion: getComputedStyle(document.querySelector('[data-testid="aviso-correo"]')).userSelect,
        enlacesMailto: document.querySelectorAll('a[href^="mailto:"]').length,
        contacto: document.querySelector('[data-testid="aviso-contacto"]').textContent,
      })`);
      assert.equal(aviso.correo, 'datos@piloto.test');
      assert.equal(aviso.seleccion, 'all', 'un toque selecciona el correo entero');
      assert.equal(aviso.enlacesMailto, 0, 'texto, no un enlace que abra otra app');
      assert.match(aviso.contacto, /^Para ejercer tus derechos, escribe a datos@piloto\.test\.$/);
      await sesion.evaluar(`document.querySelector('[data-testid="vista-aviso-datos"] a.volver[href="#/perfil"]').click()`); // W71: "‹ Perfil", arriba
      await esperar(800);
      const vuelve = await sesion.evaluar(`({ perfil: !!document.querySelector('[data-testid="vista-perfil"]'), barra: [...document.querySelectorAll('nav.nav-inferior a')].map((a) => a.getAttribute('href')) })`);
      assert.equal(vuelve.perfil, true, 'al volver, el profe cae en su Perfil (de donde abrió el aviso)');
      assert.deepEqual(vuelve.barra, ['#/profe/grupos', '#/profe/retos', '#/perfil'], 'con SU barra (no la del estudiante): a Mis grupos, un toque');
    } finally { await sesion.cerrar(); }
  }, { estado, authConfig: CONFIG_PILOTO });
});
