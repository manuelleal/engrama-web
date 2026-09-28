// @ts-check
// W13 (ESPEC_mvp_uis.md §11): Admin · crear grupo (M1), asignar docente (M2) e importar CSV (M4),
// en el navegador de verdad. El archivo se simula con `DataTransfer` + `input.files` (funciona en
// Chromium real; es la única forma de disparar un `<input type="file">` sin arrastrar un archivo
// de verdad por CDP) para probar la vista previa y el envío tal cual (§9.6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { revisarPagina } from '../../herramientas/cdp.mjs';
import { conAppCompleta } from './ayudante_servidor.mjs';

const HAY_NAVEGADOR = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean).some((r) => existsSync(r));

const YA_ENTRO_ADMIN = "localStorage.setItem('engrama_actor_sintetico', 'admin-demo')";

const esperarJs = 'const esperar = (ms) => new Promise((r) => setTimeout(r, ms));';

function scriptSubirCsv(testidCampo, textoCsv) {
  return `{
    const dt = new DataTransfer();
    dt.items.add(new File([${JSON.stringify(textoCsv)}], 'estudiantes.csv', { type: 'text/csv' }));
    const input = document.querySelector('[data-testid="${testidCampo}"]');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }`;
}

test(
  'Admin: crear grupo (M1) lo agrega a la lista, sin recargar',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    await conAppCompleta(async (url) => {
      const r = await revisarPagina({
        url: `${url}#/admin`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_ADMIN,
        eval: `(async () => {
          ${esperarJs}
          document.querySelector('[data-testid="campo-codigo-grupo"]').value = 'B1-99';
          document.querySelector('[data-testid="boton-crear-grupo"]').click();
          await esperar(500);
          return document.body.textContent;
        })()`,
      });
      assert.deepEqual(r.errores, []);
      assert.match(r.eval, /B1-99/);
    });
  },
);

test(
  'Admin: crear grupo, asignar docente e importar un CSV con ; y BOM — vista previa y envío tal cual',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    const bom = '\uFEFF';
    const csv = `${bom}documento_id;nombre_completo\nest-30;Ana Ñíguez\nest-31;Beto Muñoz\n`;
    await conAppCompleta(async (url, estado) => {
      // Paso 1: crear el grupo desde la UI y capturar su id real (el mock lo genera).
      await revisarPagina({
        url: `${url}#/admin`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_ADMIN,
        eval: `(async () => {
          ${esperarJs}
          document.querySelector('[data-testid="campo-codigo-grupo"]').value = 'B1-CSV';
          document.querySelector('[data-testid="boton-crear-grupo"]').click();
          await esperar(500);
        })()`,
      });
      const grupo = [...estado.groups.values()].find((g) => g.group_code === 'B1-CSV');
      assert.ok(grupo, 'el grupo debe existir en el servidor tras M1');

      // Paso 2: asignar el docente de arranque por su documento_id (M2).
      const rDocente = await revisarPagina({
        url: `${url}#/admin/asignar-docente/${grupo.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_ADMIN,
        eval: `(async () => {
          ${esperarJs}
          document.querySelector('[data-testid="campo-documento-docente"]').value = 'DOCENTE-DEMO';
          document.querySelector('[data-testid="form-asignar-docente"]').requestSubmit();
          await esperar(400);
          return document.querySelector('[data-testid="asignar-docente-resultado"]').textContent;
        })()`,
      });
      assert.match(rDocente.eval, /✓/);
      assert.match(rDocente.eval, /[Dd]ocente asignado/);

      // Paso 3: importar el CSV — vista previa tal cual, y el resultado con los conteos del servidor.
      const rCsv = await revisarPagina({
        url: `${url}#/admin/importar-csv/${grupo.id}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_ADMIN,
        eval: `(async () => {
          ${esperarJs}
          ${scriptSubirCsv('campo-archivo-csv', csv)}
          await esperar(300);
          const previa = [...document.querySelectorAll('[data-testid^="csv-previa-fila-"]')].map((li) => li.textContent);
          document.querySelector('[data-testid="form-importar-csv"]').requestSubmit();
          await esperar(500);
          const resultado = document.querySelector('[data-testid="csv-resultado-ok"]')?.textContent ?? null;
          return { previa, resultado };
        })()`,
      });
      // FileReader.readAsText() ya decodifica UTF-8 y descarta el BOM (comportamiento estándar
      // del navegador, no algo que este cliente le haga al texto): la vista previa muestra
      // exactamente lo que el navegador entregó, sin recortar nada más.
      assert.deepEqual(rCsv.eval.previa, ['documento_id;nombre_completo', 'est-30;Ana Ñíguez', 'est-31;Beto Muñoz']);
      assert.match(rCsv.eval.resultado, /2 nuevo/);
      assert.match(rCsv.eval.resultado, /de 2 fila/);
    });
  },
);

test(
  'Admin: un CSV inválido no escribe nada, y la vista pinta cada fila con su motivo',
  { skip: !HAY_NAVEGADOR && 'no hay Edge ni Chrome instalado en esta máquina' },
  async () => {
    // Fila 2 con documento_id vacío -> 422, "todo o nada": ni siquiera la fila 3 (válida) se escribe.
    const csvRoto = 'documento_id,nombre_completo\n,Sin Documento\nest-40,Estudiante Valido\n';
    await conAppCompleta(async (url, estado) => {
      const grupoId = [...estado.groups.values()][0].id;
      const r = await revisarPagina({
        url: `${url}#/admin/importar-csv/${grupoId}`, ancho: 375, alto: 812, espera_ms: 5000, pre: YA_ENTRO_ADMIN,
        eval: `(async () => {
          ${esperarJs}
          ${scriptSubirCsv('campo-archivo-csv', csvRoto)}
          await esperar(300);
          document.querySelector('[data-testid="form-importar-csv"]').requestSubmit();
          await esperar(500);
          return {
            encabezado: document.querySelector('[data-testid="csv-resultado-error"] p')?.textContent ?? null,
            filas: [...document.querySelectorAll('[data-testid^="csv-error-fila-"]')].map((li) => li.textContent),
          };
        })()`,
      });
      // El 422 es esperado (fila 2 rota): no se revisa r.errores, que cdp.mjs llena con
      // cualquier HTTP >= 400, incluido este, ya manejado y mostrado en pantalla (§7.3).
      assert.match(r.eval.encabezado, /No se escribió nada/);
      assert.equal(r.eval.filas.length, 1);
      assert.match(r.eval.filas[0], /fila 2/);
      assert.equal(estado.memberships.some((m) => m.full_name === 'Estudiante Valido'), false, 'ni la fila válida debió escribirse (todo o nada)');
    });
  },
);
