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
import { crearSelectorColegio } from '../../ui/selector_colegio.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';

// W70 (docs/ESPEC_navegacion.md §5.6): la barra de abajo del admin (Grupos activa). La de arriba salió: el aviso y "Cerrar sesión" viven en Perfil.
const barra = (ctx) => crearNavInferior('/admin', ctx.sesion?.rol);

// E7 (docs/ESPEC_visual_pulido_salida.md §3): bajo el nombre, cuántos estudiantes tiene (`student_count`, que `GET /teachers/groups` ya trae). El docente
// NO viene en esa respuesta: no se inventa ni se pide grupo por grupo (pedido al backend en la espec, §5).
function filaDeGrupo(grupo) {
  const cuantos = Number.isInteger(grupo.student_count) ? textos.profe.grupos.estudiantes(grupo.student_count) : null;
  return h(
    'li', { class: 'fila', 'data-testid': `admin-grupo-${grupo.id}` },
    h('div', { class: 'fila-texto' },
      h('span', { class: 'fila-titulo' }, grupo.group_code),
      cuantos ? h('span', { class: 'sx-t-apoyo', 'data-testid': `admin-grupo-${grupo.id}-meta` }, cuantos) : null), // 16 px (adenda 1, H-8)
    h('div', { class: 'fila-acciones' },
      h('a', { href: `#/admin/asignar-docente/${grupo.id}`, class: 'boton-chico', 'data-testid': `admin-grupo-${grupo.id}-docente` }, textos.admin.grupos.irAAsignarDocente),
      h('a', { href: `#/admin/importar-csv/${grupo.id}`, class: 'boton-chico', 'data-testid': `admin-grupo-${grupo.id}-csv` }, textos.admin.grupos.irAImportarCsv)),
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
  const cancelarRed = () => {}; void ligarEscrituraARed; void avisoRed; // TRAMPOSO: "Crear grupo" no se entera de la red
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
  // E7 (docs/ESPEC_visual_pulido_salida.md §3): el formulario de crear grupo va en su tarjeta blanca (sx-tarjeta), con su título.
  const tarjeta = h('section', { class: 'sx-tarjeta admin-crear-grupo', 'aria-labelledby': 'crear-grupo-titulo' },
    h('h2', { id: 'crear-grupo-titulo' }, textos.admin.crearGrupo.tarjeta), form);
  const vista = h(
    'div', { 'data-testid': 'vista-admin-crear-grupo' },
    h('h1', {}, textos.admin.grupos.titulo),
    crearSelectorColegio(ctx), // en su propio renglón; solo con más de una institución
    tarjeta,
    listaDeGrupos(grupos),
    barra(ctx),
  );
  montar(raiz, vista);
  // Lingo Coins (decisión 017): el enlace a "Profesores" (presupuestos y recarga), de un módulo diferido; solo aparece si el backend trae los presupuestos.
  import('./profesores.js').then((m) => m.agregarEnlaceDeProfesores(vista, tarjeta, ctx)).catch((e) => console.warn('vistas/admin/crear_grupo: sin el enlace a Profesores', e));
  // Invitar profes por correo (engrama-backend ESPEC_invitar_profe §5): el enlace solo aparece si el backend responde la lista de invitaciones.
  import('./invitar.js').then((m) => m.agregarEnlaceDeInvitar(vista, tarjeta, ctx)).catch((e) => console.warn('vistas/admin/crear_grupo: sin el enlace a invitar', e));
  if (mensajePrevio) { const z = form.querySelector('[data-testid="crear-grupo-mensaje"]'); if (z) z.textContent = mensajePrevio; }
  document.body.dataset.listo = '1';
  window.addEventListener('hashchange', cancelarRed, { once: true });
}

function pintarError(raiz, mensaje, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-admin-crear-grupo' }, h('h1', {}, textos.admin.crearGrupo.titulo), crearSelectorColegio(ctx), h('p', { role: 'alert' }, mensaje), barra(ctx)));
  document.body.dataset.listo = '1';
}

/** @param {HTMLElement} raiz @param {{token: string, tenantId?: string, salir?: () => Promise<void>}} ctx */
export async function renderCrearGrupo(raiz, ctx) {
  montar(raiz, h('div', { 'data-testid': 'vista-admin-crear-grupo' }, h('p', { role: 'status' }, textos.inicio.cargando), barra(ctx)));
  try {
    await pintarVista(raiz, ctx);
  } catch (e) {
    console.warn('vistas/admin/crear_grupo: no se pudo cargar', e);
    pintarError(raiz, e instanceof ErrorApi ? e.mensaje : textos.admin.grupos.errorGeneral, ctx);
  }
}
