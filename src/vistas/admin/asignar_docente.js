// @ts-check
// vistas/admin/asignar_docente.js · W13 (M2): asigna un docente a un grupo por su documento_id.
import { h, montar } from '../../ui/dom.js';
import { crearResultado } from '../../ui/retro.js';
import { textos } from '../../textos.js';
import { asignarDocente } from '../../api/admin.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';
import { ligarEscrituraARed } from '../../ui/red.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';

function crearFormulario(onAsignar) {
  const campo = h('input', { type: 'text', id: 'documento-docente', 'data-testid': 'campo-documento-docente', autocomplete: 'off' });
  const boton = h('button', { type: 'submit', 'data-testid': 'boton-asignar-docente' }, textos.admin.asignarDocente.asignar);
  const zonaResultado = h('div', { 'data-testid': 'asignar-docente-resultado' });
  const avisoRed = h('p', { role: 'status', 'data-testid': 'asignar-docente-sin-red' });
  const form = h(
    'form', { 'data-testid': 'form-asignar-docente' },
    h('label', { for: 'documento-docente' }, textos.admin.asignarDocente.etiquetaDocumento),
    campo, boton, zonaResultado, avisoRed,
  );
  form.addEventListener('submit', (ev) => { ev.preventDefault(); onAsignar(campo, boton, zonaResultado); });
  // W16 (§7.3, §9.5 E10): "Asignar" escribe — sin red, deshabilitado con su aviso.
  const cancelarRed = ligarEscrituraARed(boton, avisoRed, textos.red.sinConexionAccion(textos.admin.asignarDocente.accionAsignar));
  return { form, cancelarRed };
}

async function manejarAsignar(gid, ctx, asignarUnaVez, campo, boton, zonaResultado) {
  const documento = campo.value.trim();
  if (!documento) { montar(zonaResultado, crearResultado({ ok: false, texto: textos.admin.asignarDocente.faltaDocumento })); return; }
  boton.disabled = true;
  boton.textContent = textos.admin.asignarDocente.asignando;
  try {
    const r = await asignarUnaVez(gid, documento, ctx);
    montar(zonaResultado, crearResultado({ ok: true, texto: textos.admin.asignarDocente.exito(r.resultado) }));
    campo.value = '';
  } catch (e) {
    const mensaje = e instanceof ErrorApi ? e.mensaje : textos.admin.asignarDocente.errorGeneral;
    montar(zonaResultado, crearResultado({ ok: false, texto: mensaje }));
  } finally {
    boton.disabled = false;
    boton.textContent = textos.admin.asignarDocente.asignar;
  }
}

/** @param {HTMLElement} raiz @param {Record<string,string>} params ({gid}) @param {{token: string, tenantId?: string}} ctx */
export function renderAsignarDocente(raiz, params, ctx) {
  const { gid } = params;
  const asignarUnaVez = accionUnica(asignarDocente);
  const { form, cancelarRed } = crearFormulario((campo, boton, zonaResultado) => manejarAsignar(gid, ctx, asignarUnaVez, campo, boton, zonaResultado));
  montar(raiz, h(
    'div', { 'data-testid': 'vista-admin-asignar-docente' },
    h('h1', {}, textos.admin.asignarDocente.titulo),
    h('a', { href: '#/admin', 'data-testid': 'volver-a-admin' }, textos.admin.asignarDocente.volverAAdmin),
    form,
    crearNavInferior('/admin/asignar-docente/:gid', /** @type {any} */ (ctx).sesion?.rol), // W70: la barra del admin, con Grupos activa
  ));
  document.body.dataset.listo = '1';
  window.addEventListener('hashchange', cancelarRed, { once: true });
}
