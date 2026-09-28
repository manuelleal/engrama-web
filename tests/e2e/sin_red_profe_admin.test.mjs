// @ts-check
// W16 (ESPEC_mvp_uis.md §7.3, §9.5, criterio E10): sin red, las pantallas del profe y del admin
// muestran su último estado conocido (lo ya pintado en esta sesión — nunca una caché en disco,
// §7.3 último punto: "por privacidad... no se guarda nada de /teachers ni de /admin"), el banner
// global "Sin conexión" queda visible, y toda acción que escribe queda deshabilitada con su
// propio aviso. Cada test carga la pantalla CON red y luego corta la red SIN recargar
// (`tras.sinNavegar`, cdp.mjs): así se prueba lo que ya está en el DOM, no lo que una recarga
// podría volver a pedir (el profe/admin nunca cachea su respuesta, sw.js `NUNCA_CACHEAR`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';
import { crearChallenge } from '../../herramientas/mock/rutas_challenges.mjs';
import { DOCENTE_BOOTSTRAP_TOKEN } from '../../herramientas/mock/estado.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));

const YA_ENTRO_DOCENTE = "localStorage.setItem('engrama_actor_sintetico', 'docente-demo')";
const YA_ENTRO_ADMIN = "localStorage.setItem('engrama_actor_sintetico', 'admin-demo')";
const esperarJs = 'const esperar = (ms) => new Promise((r) => setTimeout(r, ms));';

function bannerVisible(txt) { return /[Ss]in conexión/.test(txt || ''); }

test(
  'E10: sesión de asistencia — sin red, "Cerrar sesión" se deshabilita y el código/enlace se quedan (último estado conocido)',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url, estado) => {
      const gid = [...estado.groups.values()][0].id;
      const r = await revisarPagina({
        url: `${url}#/profe/grupo/${gid}/sesion`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_DOCENTE,
        eval: `(async () => {
          ${esperarJs}
          document.querySelector('[data-testid="boton-abrir-sesion"]').click();
          await esperar(700);
          return document.querySelector('[data-testid="sesion-codigo"]')?.textContent ?? null;
        })()`,
        tras: {
          sinRed: true, sinNavegar: true, espera_ms: 1000,
          eval: `({
            deshabilitado: document.querySelector('[data-testid="boton-cerrar-sesion"]').disabled,
            aviso: document.querySelector('[data-testid="sesion-sin-red"]').textContent,
            codigo: document.querySelector('[data-testid="sesion-codigo"]')?.textContent ?? null,
            enlace: document.querySelector('[data-testid="sesion-enlace"]')?.textContent ?? null,
            banner: document.querySelector('[data-testid="banner-red"]').textContent,
          })`,
        },
      });
      assert.match(r.eval, /^\d{6}$/, 'la sesión debe haber abierto con red');
      assert.equal(r.tras.eval.deshabilitado, true, '"Cerrar sesión" debe quedar deshabilitado sin red');
      assert.match(r.tras.eval.aviso, /[Ss]in conexión/);
      assert.equal(r.tras.eval.codigo, r.eval, 'el código sigue visible: último estado conocido, no una recarga');
      assert.ok(r.tras.eval.enlace, 'el enlace también se queda');
      assert.ok(bannerVisible(r.tras.eval.banner), 'el banner global debe verse en esta pantalla del profe');
    });
  },
);

test(
  'E10: Profe · Retos — sin red, activar/desactivar y asignar se deshabilitan; la fila se queda pintada',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url, estado) => {
      const { cuerpo: reto } = crearChallenge(estado, { headers: { authorization: `Bearer ${DOCENTE_BOOTSTRAP_TOKEN}` } }, {
        title: 'Reto sin red', description: 'd', group_id: null, coins_reward: 5, xp_reward: 0,
        questions: [{ question_text: '2+2?', correct_answer: 'A', options_json: [{ label: 'A', value: '4' }, { label: 'B', value: '5' }] }],
      });
      const r = await revisarPagina({
        url: `${url}#/profe/retos`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_DOCENTE,
        tras: {
          sinRed: true, sinNavegar: true, espera_ms: 1000,
          eval: `({
            estadoDeshabilitado: document.querySelector('[data-testid="reto-${reto.id}-estado"]').disabled,
            asignarDeshabilitado: document.querySelector('[data-testid="reto-${reto.id}-asignar"]').disabled,
            aviso: document.querySelector('[data-testid="profe-retos-sin-red"]').textContent,
            titulo: document.querySelector('[data-testid="reto-${reto.id}"]').textContent,
          })`,
        },
      });
      assert.equal(r.tras.eval.estadoDeshabilitado, true);
      assert.equal(r.tras.eval.asignarDeshabilitado, true);
      assert.match(r.tras.eval.aviso, /[Ss]in conexión/);
      assert.match(r.tras.eval.titulo, /Reto sin red/, 'la fila se queda pintada: último estado conocido');
    });
  },
);

test(
  'E10: Admin · crear grupo — sin red, "Crear grupo" se deshabilita y la lista ya cargada se queda',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url) => {
      const r = await revisarPagina({
        url: `${url}#/admin`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_ADMIN,
        tras: {
          sinRed: true, sinNavegar: true, espera_ms: 1000,
          eval: `({
            deshabilitado: document.querySelector('[data-testid="boton-crear-grupo"]').disabled,
            aviso: document.querySelector('[data-testid="crear-grupo-sin-red"]').textContent,
            lista: document.querySelector('[data-testid="admin-lista-grupos"], [data-testid="admin-sin-grupos"]')?.textContent ?? null,
          })`,
        },
      });
      assert.equal(r.tras.eval.deshabilitado, true);
      assert.match(r.tras.eval.aviso, /[Ss]in conexión/);
      assert.ok(r.tras.eval.lista, 'la lista de grupos ya cargada se queda visible sin red');
    });
  },
);

test(
  'E10: Admin · asignar docente e importar CSV — sin red, los botones que escriben se deshabilitan',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url, estado) => {
      const gid = [...estado.groups.values()][0].id;

      const rDocente = await revisarPagina({
        url: `${url}#/admin/asignar-docente/${gid}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_ADMIN,
        tras: {
          sinRed: true, sinNavegar: true, espera_ms: 1000,
          eval: `({
            deshabilitado: document.querySelector('[data-testid="boton-asignar-docente"]').disabled,
            aviso: document.querySelector('[data-testid="asignar-docente-sin-red"]').textContent,
          })`,
        },
      });
      assert.equal(rDocente.tras.eval.deshabilitado, true);
      assert.match(rDocente.tras.eval.aviso, /[Ss]in conexión/);

      // Importar CSV: el botón nace deshabilitado (sin archivo). Con red y un archivo elegido se
      // habilita; sin red debe volver a deshabilitarse aunque el archivo siga elegido (el gancho
      // `otraCondicionOk` de `ligarEscrituraARed` no debe perder la condición original).
      const rCsv = await revisarPagina({
        url: `${url}#/admin/importar-csv/${gid}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_ADMIN,
        eval: `(async () => {
          ${esperarJs}
          const dt = new DataTransfer();
          dt.items.add(new File(['documento_id,nombre_completo\\nx,Y\\n'], 'e.csv', { type: 'text/csv' }));
          const input = document.querySelector('[data-testid="campo-archivo-csv"]');
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await esperar(300);
          return document.querySelector('[data-testid="boton-importar-csv"]').disabled;
        })()`,
        tras: {
          sinRed: true, sinNavegar: true, espera_ms: 1000,
          eval: `({
            deshabilitado: document.querySelector('[data-testid="boton-importar-csv"]').disabled,
            aviso: document.querySelector('[data-testid="importar-csv-sin-red"]').textContent,
            previa: [...document.querySelectorAll('[data-testid^="csv-previa-fila-"]')].map((li) => li.textContent),
          })`,
        },
      });
      assert.equal(rCsv.eval, false, 'con red y un archivo elegido, el botón debe habilitarse');
      assert.equal(rCsv.tras.eval.deshabilitado, true, 'sin red vuelve a deshabilitarse aunque el archivo siga elegido');
      assert.match(rCsv.tras.eval.aviso, /[Ss]in conexión/);
      assert.equal(rCsv.tras.eval.previa.length, 2, 'la vista previa (lectura local, no del servidor) se queda');
    });
  },
);
