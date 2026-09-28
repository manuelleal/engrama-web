// @ts-check
// vistas/admin/crear_grupo.js · W13 (M1): el formulario para crear un grupo, y la única puerta
// de entrada del admin (§4.3) — debajo del formulario lista los grupos que ya existen (mismo
// endpoint que T1, `GET /teachers/groups`: el admin también los ve todos, sin filtrar por
// asignación) con un enlace a cada paso siguiente (asignar docente, importar CSV).
import { h, montar } from '../../ui/dom.js';
import { textos } from '../../textos.js';
import { crearGrupo } from '../../api/admin.js';
import { listarGrupos } from '../../api/profe.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { ligarEscrituraARed } from '../../ui/red.js';

function filaDeGrupo(grupo) {
  return h(
    'li', { 'data-testid': `admin-grupo-${grupo.id}` },
    h('span', {}, grupo.group_code),
    ' · ',
    h('a', { href: `#/admin/asignar-docente/${grupo.id}`, 'data-testid': `admin-grupo-${grupo.id}-docente` }, textos.admin.grupos.irAAsignarDocente),
    ' · ',
    h('a', { href: `#/admin/importar-csv/${grupo.id}`, 'data-testid': `admin-grupo-${grupo.id}-csv` }, textos.admin.grupos.irAImportarCsv),
  );
}

function listaDeGrupos(grupos) {
  return grupos.length === 0
    ? h('p', { role: 'status', 'data-testid': 'admin-sin-grupos' }, textos.admin.grupos.sinGrupos)
    : h('ul', { 'data-testid': 'admin-lista-grupos' }, ...grupos.map(filaDeGrupo));
}

function crearFormulario(onCrear) {
  const campoCodigo = h('input', { type: 'text', id: 'codigo-grupo', 'data-testid': 'campo-codigo-grupo', autocomplete: 'off' });
  const campoCupo = h('input', { type: 'number', id: 'cupo-grupo', 'data-testid': 'campo-cupo-grupo', min: '1' });
  const boton = h('button', { type: 'submit', 'data-testid': 'boton-crear-grupo' }, textos.admin.crearGrupo.crear);
  const zonaMensaje = h('p', { role: 'status', 'aria-live': 'polite', 'data-testid': 'crear-grupo-mensaje' });
  const avisoRed = h('p', { role: 'status', 'data-testid': 'crear-grupo-sin-red' });
  const form = h(
    'form', { 'data-testid': 'form-crear-grupo' },
    h('label', { for: 'codigo-grupo' }, textos.admin.crearGrupo.etiquetaCodigo), campoCodigo,
    h('label', { for: 'cupo-grupo' }, textos.admin.crearGrupo.etiquetaCupo), campoCupo,
    boton, zonaMensaje, avisoRed,
  );
  form.addEventListener('submit', (ev) => { ev.preventDefault(); onCrear(campoCodigo, campoCupo, boton, zonaMensaje); });
  // W16 (§7.3, §9.5 E10): "Crear grupo" escribe — sin red, deshabilitado con su aviso.
  const cancelarRed = ligarEscrituraARed(boton, avisoRed, textos.red.sinConexionAccion(textos.admin.crearGrupo.accionCrear));
  return { form, cancelarRed };
}

async function manejarCrear(raiz, ctx, crearUnaVez, campoCodigo, campoCupo, boton, zonaMensaje, cancelarRed) {
  const codigo = campoCodigo.value.trim();
  if (!codigo) { zonaMensaje.textContent = textos.admin.crearGrupo.faltaCodigo; return; }
  boton.disabled = true;
  boton.textContent = textos.admin.crearGrupo.creando;
  try {
    const cupo = campoCupo.value ? Number(campoCupo.value) : null;
    await crearUnaVez(codigo, { ...ctx, maxCapacity: cupo });
    cancelarRed(); // la vista se repinta entera (form + suscripción nuevos) justo abajo
    await pintarVista(raiz, ctx, textos.admin.crearGrupo.creado); // recarga la lista con el grupo nuevo
  } catch (e) {
    boton.disabled = false;
    boton.textContent = textos.admin.crearGrupo.crear;
    zonaMensaje.textContent = e instanceof ErrorApi ? e.mensaje : textos.admin.crearGrupo.errorGeneral;
  }
}

/** @param {string} [mensajePrevio] se muestra una vez, justo tras crear (§7.2: nunca en silencio). */
async function pintarVista(raiz, ctx, mensajePrevio) {
  const grupos = await listarGrupos(ctx);
  const crearUnaVez = accionUnica(crearGrupo);
  const { form, cancelarRed } = crearFormulario(
    (campoCodigo, campoCupo, boton, zonaMensaje) => manejarCrear(raiz, ctx, crearUnaVez, campoCodigo, campoCupo, boton, zonaMensaje, cancelarRed),
  );
  montar(raiz, h(
    'div', { 'data-testid': 'vista-admin-crear-grupo' },
    h('h1', {}, textos.admin.grupos.titulo),
    form,
    listaDeGrupos(grupos),
  ));
  if (mensajePrevio) { const z = form.querySelector('[data-testid="crear-grupo-mensaje"]'); if (z) z.textContent = mensajePrevio; }
  document.body.dataset.listo = '1';
  window.addEventListener('hashchange', cancelarRed, { once: true });
}

function pintarError(raiz, mensaje) {
  montar(raiz, h('div', { 'data-testid': 'vista-admin-crear-grupo' }, h('h1', {}, textos.admin.crearGrupo.titulo), h('p', { role: 'alert' }, mensaje)));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {{token: string, tenantId?: string}} ctx */
export async function renderCrearGrupo(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-admin-crear-grupo' }, h('p', { role: 'status' }, textos.inicio.cargando)));
  try {
    await pintarVista(raiz, ctx);
  } catch (e) {
    console.warn('vistas/admin/crear_grupo: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.admin.grupos.errorGeneral);
  }
}
