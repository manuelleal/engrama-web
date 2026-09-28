// @ts-check
// W10 (ESPEC_mvp_uis.md §11): Profe · Grupos (T1), Grupo (T2) y Sesión de asistencia (T3/T4 +
// sondeo de T2), en el navegador de verdad. E4 es el criterio del commit: el profe NUNCA ve un
// grupo ajeno (X4, tests/tramposos/x4_grupo_ajeno/ rompe el mock para probar que este test lo
// detecta — el cliente no puede defenderse de un servidor que filtra mal).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { crearEstado, ADMIN_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';
import { crearGrupo, asignarDocente, importarCsv } from '../../herramientas/mock/rutas_admin.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));

const YA_ENTRO_DOCENTE = "localStorage.setItem('engrama_actor_sintetico', 'docente-demo')";

function reqAdmin() {
  return { headers: { authorization: `Bearer ${ADMIN_BOOTSTRAP_TOKEN}` } };
}

/** Dos grupos: "SINT-B1-01" asignado a Docente Demo (con Ana y Beto), y "SINT-B1-99" SIN
 * asignar a nadie, con un estudiante que el docente nunca debería ver (X4). */
function estadoConGrupoAjeno() {
  const estado = crearEstado();
  const { cuerpo: propio } = crearGrupo(estado, reqAdmin(), { group_code: 'SINT-B1-01' });
  asignarDocente(estado, reqAdmin(), propio.id, { documento_id: 'DOCENTE-DEMO' });
  importarCsv(estado, reqAdmin(), propio.id, 'documento_id,nombre_completo\nest-1,Ana Sintetica\nest-2,Beto Sintetico\n');
  const { cuerpo: ajeno } = crearGrupo(estado, reqAdmin(), { group_code: 'SINT-B1-99' });
  importarCsv(estado, reqAdmin(), ajeno.id, 'documento_id,nombre_completo\nest-9,Nombre Ajeno\n');
  return { estado, propio, ajeno };
}

test(
  'T1/T2: el profe ve sus grupos y el roster del propio (nombre, constancia, sin saldo)',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    const { estado, propio } = estadoConGrupoAjeno();
    await conAppCompleta(async (url) => {
      const r = await revisarPagina({
        url: `${url}#/profe/grupos`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_DOCENTE,
        eval: `(async () => { await new Promise((r) => setTimeout(r, 300)); return document.body.textContent; })()`,
      });
      assert.deepEqual(r.errores, []);
      assert.match(r.eval, /SINT-B1-01/);
      assert.doesNotMatch(r.eval, /SINT-B1-99/, 'el grupo ajeno no debe listarse (T1 ya lo filtra)');

      const r2 = await revisarPagina({
        url: `${url}#/profe/grupo/${propio.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_DOCENTE,
        eval: `(async () => { await new Promise((r) => setTimeout(r, 300)); return document.body.textContent; })()`,
      });
      assert.match(r2.eval, /Ana Sintetica/);
      assert.match(r2.eval, /Beto Sintetico/);
      assert.doesNotMatch(r2.eval, /\bcoins?\b/i, 'el roster no muestra saldo (grupos §2.2)');
    }, { estado });
  },
);

test(
  'E4 (X4): el profe NUNCA ve un grupo ajeno — "No encontrado", ningún nombre de B en el DOM',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    const { estado, ajeno } = estadoConGrupoAjeno();
    await conAppCompleta(async (url) => {
      const r = await revisarPagina({
        url: `${url}#/profe/grupo/${ajeno.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_DOCENTE,
        eval: `(async () => { await new Promise((r) => setTimeout(r, 300)); return document.body.textContent; })()`,
      });
      assert.match(r.eval, /No encontrado/);
      assert.doesNotMatch(r.eval, /Nombre Ajeno/, 'ni un nombre del grupo ajeno debe llegar al DOM');
    }, { estado });
  },
);

test(
  'T3/T4: abrir una sesión da un código y un enlace; sondea T2 y cerrar la detiene',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    const { estado, propio } = estadoConGrupoAjeno();
    await conAppCompleta(async (url) => {
      const r = await revisarPagina({
        url: `${url}#/profe/grupo/${propio.id}/sesion`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_DOCENTE,
        eval: `(async () => {
          const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
          document.querySelector('[data-testid="boton-abrir-sesion"]').click();
          await esperar(700);
          const codigo = document.querySelector('[data-testid="sesion-codigo"]')?.textContent ?? null;
          const resumen = document.querySelector('[data-testid="sesion-resumen"]')?.textContent ?? null;
          document.querySelector('[data-testid="boton-cerrar-sesion"]').click();
          await esperar(400);
          const cerrada = !!document.querySelector('[data-testid="sesion-cerrada"]');
          return { codigo, resumen, cerrada };
        })()`,
      });
      assert.deepEqual(r.errores, []);
      assert.match(r.eval.codigo, /^\d{6}$/);
      assert.equal(r.eval.resumen, '0 de 2 marcaron');
      assert.equal(r.eval.cerrada, true);
    }, { estado });
  },
);
