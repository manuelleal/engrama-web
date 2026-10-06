// @ts-check
// vistas/sin_perfil.js · "Tu cuenta todavía no está inscrita" (login piloto, ESPEC_login_piloto §1.2).
// La cuenta de GoTrue existe y el JWT es válido, pero ENGRAMA no tiene perfil para ella (403 `Account
// has no ENGRAMA profile`) o no tiene ninguna membresía activa (403 `User has no active tenant
// memberships`): el operador todavía no la dio de alta, o la dio de baja. Para quien la usa es lo mismo:
// habla con su profe. Es un callejón con salida: solo "Cerrar sesión", sin reintentos ni redirecciones
// (nunca un bucle ni una pantalla en blanco). app.js la monta en un contenedor nuevo y apaga el router.
import { h, montar } from '../ui/dom.js';
import { crearDrako } from '../ui/drako.js';
import { crearBarraRol } from '../ui/barra_rol.js';
import { textos } from '../textos.js';

/** @param {HTMLElement} raiz @param {{salir?: () => Promise<void>}} ctx */
export function renderSinPerfil(raiz, ctx) {
  montar(raiz, h(
    'div', { 'data-testid': 'vista-sin-perfil' },
    crearBarraRol({ salir: ctx.salir }),
    crearDrako('ups', textos.sinPerfil.drako),
    h('h1', {}, textos.sinPerfil.titulo),
    h('p', { role: 'status', 'data-testid': 'sin-perfil-mensaje' }, textos.sinPerfil.mensaje),
  ));
  document.body.dataset.listo = '1';
}
