// @ts-check
// vistas/admin/importar_csv.js · W13 (M4): lee el CSV EN EL NAVEGADOR (FileReader, sin subirlo a
// ningún sitio hasta el clic de "Importar"), muestra una vista previa tal cual — nunca recodifica
// ni recorta el texto (§9.6: un CSV con `;`, BOM y tildes se manda exactamente como llegó) — y lo
// envía como `text/csv` (§7.2). M4 es todo o nada: un 422 nunca escribió una sola fila, y esta
// vista lo dice explícito y pinta cada fila con su motivo (no un solo texto pegado).
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { importarCsv } from '../../api/admin.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { ligarEscrituraARed } from '../../ui/red.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';

/** Pura (U, sin DOM): una línea por fila del CSV, tal cual (sin trim ni normalizar). */
export function lineasDePrevia(textoCsv) {
  return textoCsv.split(/\r\n|\n/).filter((l) => l !== '');
}

/** Pura (U, sin DOM): las filas de un 422 (`[{fila, motivo}]`), una por una. `[]` si no aplica. */
export function filasDeError(cuerpoError) {
  return Array.isArray(cuerpoError) ? cuerpoError.map((f) => `fila ${f.fila}: ${f.motivo}`) : [];
}

function leerArchivoComoTexto(archivo) {
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result));
    lector.onerror = () => mal(lector.error || new Error('no se pudo leer el archivo'));
    lector.readAsText(archivo);
  });
}

function pintarPrevia(zonaPrevia, textoCsv) {
  const lineas = lineasDePrevia(textoCsv);
  montar(zonaPrevia, h(
    'div', { class: 'tarjeta', 'data-testid': 'csv-previa' },
    h('h2', {}, textos.admin.importarCsv.vistaPrevia),
    h('ul', {}, ...lineas.map((l, i) => h('li', { class: 'linea-csv', 'data-testid': `csv-previa-fila-${i}` }, l))),
  ));
}

function pintarResultadoOk(zonaResultado, r) {
  montar(zonaResultado, h('p', { role: 'status', class: 'resultado resultado-ok', 'data-testid': 'csv-resultado-ok' }, textos.admin.importarCsv.exito(r)));
}

function pintarErrores422(zonaResultado, e) {
  const filas = filasDeError(e.cuerpo);
  montar(zonaResultado, h(
    'div', { role: 'alert', class: 'tarjeta', 'data-testid': 'csv-resultado-error' },
    h('p', { class: 'fila-titulo' }, textos.admin.importarCsv.encabezadoErrores),
    h('ul', {}, ...filas.map((f, i) => h('li', { class: 'linea-csv', 'data-testid': `csv-error-fila-${i}` }, f))),
  ));
}

async function manejarImportar(gid, ctx, textoCsv, importarUnaVez, boton, zonaResultado) {
  if (!textoCsv) { montar(zonaResultado, h('p', { role: 'alert' }, textos.admin.importarCsv.faltaArchivo)); return; }
  boton.disabled = true;
  boton.textContent = textos.admin.importarCsv.importando;
  try {
    const r = await importarUnaVez(gid, textoCsv, ctx);
    pintarResultadoOk(zonaResultado, r);
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 422) pintarErrores422(zonaResultado, e);
    else montar(zonaResultado, h('p', { role: 'alert' }, e instanceof ErrorApi ? e.mensaje : textos.admin.importarCsv.errorGeneral));
  } finally {
    boton.disabled = false;
    boton.textContent = textos.admin.importarCsv.importar;
  }
}

// W16 (§7.3, §9.5 E10): "Importar" escribe — sin red queda deshabilitado con su aviso, SIN
// importar si ya hay un archivo elegido (`hayArchivo`, el gancho `otraCondicionOk` de
// `ligarEscrituraARed`). Al revés también manda: con red pero sin archivo todavía, sigue
// deshabilitado — la condición original ("elige un archivo primero") no se pierde.
function crearFormulario(gid, ctx) {
  let textoCsv = '';
  const hayArchivo = { valor: false };
  const campoArchivo = h('input', { type: 'file', accept: '.csv,text/csv', id: 'archivo-csv', 'data-testid': 'campo-archivo-csv' });
  const zonaPrevia = h('div', { 'data-testid': 'csv-zona-previa' });
  const boton = h('button', { type: 'submit', 'data-testid': 'boton-importar-csv', disabled: true }, textos.admin.importarCsv.importar);
  const zonaResultado = h('div', { 'data-testid': 'csv-zona-resultado' });
  const avisoRed = h('p', { role: 'status', 'data-testid': 'importar-csv-sin-red' });
  const importarUnaVez = accionUnica(importarCsv);

  campoArchivo.addEventListener('change', async () => {
    const archivo = campoArchivo.files?.[0];
    if (!archivo) return;
    textoCsv = await leerArchivoComoTexto(archivo);
    pintarPrevia(zonaPrevia, textoCsv);
    hayArchivo.valor = true;
    if (navigator.onLine) boton.disabled = false;
  });

  const form = h(
    'form', { 'data-testid': 'form-importar-csv' },
    h('label', { for: 'archivo-csv' }, textos.admin.importarCsv.etiquetaArchivo),
    campoArchivo, zonaPrevia, boton, zonaResultado, avisoRed,
  );
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    manejarImportar(gid, ctx, textoCsv, importarUnaVez, boton, zonaResultado);
  });
  const cancelarRed = ligarEscrituraARed(boton, avisoRed, textos.red.sinConexionAccion(textos.admin.importarCsv.accionImportar), () => hayArchivo.valor);
  return { form, cancelarRed };
}

/** @param {HTMLElement} raiz @param {Record<string,string>} params ({gid}) @param {{token: string, tenantId?: string}} ctx */
export function renderImportarCsv(raiz, params, ctx) {
  const { gid } = params;
  const { form, cancelarRed } = crearFormulario(gid, ctx);
  montar(raiz, h(
    'div', { 'data-testid': 'vista-admin-importar-csv' },
    h('h1', {}, textos.admin.importarCsv.titulo),
    h('a', { href: '#/admin', 'data-testid': 'volver-a-admin' }, textos.admin.importarCsv.volverAAdmin),
    form,
    crearNavInferior('/admin/importar-csv/:gid', /** @type {any} */ (ctx).sesion?.rol), // W70: la barra del admin, con Grupos activa
  ));
  document.body.dataset.listo = '1';
  window.addEventListener('hashchange', cancelarRed, { once: true });
}
