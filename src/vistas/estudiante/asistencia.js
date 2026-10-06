// @ts-check
// vistas/estudiante/asistencia.js · W8 (ESPEC_mvp_uis.md §11): el código a mano o el enlace del
// QR (`#/asistencia?codigo=XXXXXX`), con el resultado 200/404/409/410 siempre con ícono y texto,
// y el botón deshabilitado (con su mensaje) mientras no hay red — nunca en silencio (§7.3, E8).
import { h, montar } from '../../ui/dom.js';
import { crearResultado } from '../../ui/retro.js';
import { crearNavInferior } from '../../ui/nav_inferior.js';
import { suscribirRed } from '../../ui/red.js';
import { celebrarAsistencia } from '../../ui/sello.js';
import { crearBotonSonido } from '../../ui/boton_sonido.js';
import { marcarCargando, destelloExito } from '../../ui/boton.js';
import { textos } from '../../textos.js';
import { marcarAsistencia } from '../../api/core.js';
import { accionUnica, ErrorApi } from '../../api/cliente.js';

/**
 * Traduce el error del check-in a un mensaje propio (más claro que el genérico de cliente.js
 * para este caso concreto) — pura, sin DOM, así se prueba con `node --test` sin navegador.
 * @param {ErrorApi} e
 */
export function mensajeDeAsistencia(e) {
  if (e.status === 404) return textos.asistencia.codigoInvalido;
  if (e.status === 409) return textos.asistencia.yaMarcada;
  if (e.status === 410) return textos.asistencia.sesionVencida;
  return e.mensaje;
}

function crearFormulario(estado) {
  const campo = h('input', {
    type: 'text', id: 'codigo-sesion', 'data-testid': 'campo-codigo', value: estado.codigoInicial || '',
    autocomplete: 'off', inputmode: 'numeric',
  });
  const boton = h('button', { type: 'submit', 'data-testid': 'boton-marcar' }, textos.asistencia.marcar);
  const avisoRed = h('p', { role: 'status', 'data-testid': 'asistencia-sin-red' });
  const zonaResultado = h('div', { 'data-testid': 'asistencia-resultado' });
  const form = h(
    'form',
    { 'data-testid': 'form-asistencia' },
    h('label', { for: 'codigo-sesion' }, textos.asistencia.etiquetaCodigo),
    campo,
    boton,
    avisoRed,
    zonaResultado,
  );
  return { form, campo, boton, avisoRed, zonaResultado };
}

function actualizarBotonPorRed(boton, avisoRed, enLinea) {
  boton.disabled = !enLinea;
  avisoRed.textContent = enLinea ? '' : textos.asistencia.sinRed;
}

/**
 * @param {HTMLElement} raiz
 * @param {Record<string,string>} query
 * @param {{token: string, tenantId?: string}} ctx
 */
export function renderAsistencia(raiz, query, ctx) {
  const { form, campo, boton, avisoRed, zonaResultado } = crearFormulario({ codigoInicial: query.codigo || '' });
  montar(raiz, h('div', { 'data-testid': 'vista-asistencia', class: 'juego' },
    h('div', { class: 'encabezado-reto' }, h('h1', {}, textos.asistencia.titulo), crearBotonSonido()), form, crearNavInferior('asistencia')));

  const cancelarRed = suscribirRed((enLinea) => actualizarBotonPorRed(boton, avisoRed, enLinea));

  const marcarUnaVez = accionUnica(async () => {
    boton.disabled = true;
    marcarCargando(boton, true);
    boton.textContent = textos.asistencia.marcando;
    try {
      const codigo = campo.value.trim();
      if (!codigo) { montar(zonaResultado, crearResultado({ ok: false, texto: textos.asistencia.faltaCodigo })); return; }
      const r = await marcarAsistencia({ token: ctx.token, tenantId: ctx.tenantId, codigo });
      montar(zonaResultado, crearResultado({ ok: true, texto: textos.asistencia.exito(r.coins_awarded, r.streak) }));
      // Game feel: el sello se estampa, las monedas vuelan a su contador, suena y vibra; la constancia
      // que llega del servidor se celebra solo si subió (ui/sello.js).
      celebrarAsistencia({ zona: zonaResultado, monedas: r.coins_awarded, racha: r.streak, quien: ctx.sesion?.profileId });
      destelloExito(boton);
    } catch (e) {
      const mensaje = e instanceof ErrorApi ? mensajeDeAsistencia(e) : textos.asistencia.codigoInvalido;
      montar(zonaResultado, crearResultado({ ok: false, texto: mensaje }));
    } finally {
      boton.textContent = textos.asistencia.marcar;
      marcarCargando(boton, false);
      boton.disabled = false;
    }
  });

  form.addEventListener('submit', (ev) => { ev.preventDefault(); marcarUnaVez(); });
  document.body.dataset.listo = '1';
  if (query.codigo) marcarUnaVez(); // enlace del QR: se marca sola, sin esperar el toque (§4.1)

  // rutas.js llama vaciar() en el próximo render, que desmonta este nodo — pero la suscripción a
  // 'online'/'offline' seguiría viva si no se cancela. No hay hook de "desmontado" en rutas.js
  // todavía; se cancela cuando cambia el hash, que es el único otro evento que ya escuchamos.
  window.addEventListener('hashchange', cancelarRed, { once: true });
}
