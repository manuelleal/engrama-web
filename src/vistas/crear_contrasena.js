// @ts-check
// vistas/crear_contrasena.js · "Crea tu contraseña": la pantalla OBLIGATORIA del primer ingreso
// (login piloto, ESPEC_login_piloto §1.5). Aparece cuando /auth/me dice `must_change_password` o
// cualquier llamada da 403 `must_change_password`: el estudiante entró con la contraseña temporal
// que le dio su profe y no puede usar nada más hasta crear la suya. app.js monta esto en un
// contenedor NUEVO y apaga el router, así que no hay a dónde navegar mientras tanto.
//
// Al cambiarla (POST /auth/contrasena, el backend baja la bandera), pide /auth/me otra vez y entra
// normal (`alTerminar`). Si ese segundo paso falla (sin red), la contraseña YA cambió: "Continuar"
// solo reintenta la entrada, nunca vuelve a cambiarla (GoTrue la rechazaría por igual a la anterior).
import { h, montar } from '../ui/dom.js';
import { crearDrako } from '../ui/drako.js';
import { crearBarraRol } from '../ui/barra_rol.js';
import { textos } from '../textos.js';
import { crearFormularioContrasena } from './formulario_contrasena.js';

/**
 * @param {HTMLElement} raiz
 * @param {{cambiarContrasena?: (nueva: string) => Promise<void>, alTerminar: () => Promise<void>, salir?: () => Promise<void>}} ctx
 */
export function renderCrearContrasena(raiz, ctx) {
  let cambiada = false;
  const cambiar = async (nueva) => {
    if (!cambiada) {
      if (typeof ctx.cambiarContrasena !== 'function') throw new Error(textos.auth.cambioNoDisponible);
      await ctx.cambiarContrasena(nueva);
      cambiada = true;
    }
    try {
      await ctx.alTerminar();
    } catch (e) {
      console.error('vistas/crear_contrasena: no se pudo entrar tras cambiar la contraseña', e); // nunca mudo
      throw new Error(textos.crearContrasena.errorAlEntrar);
    }
  };
  const form = crearFormularioContrasena({
    cambiar, textoBoton: textos.crearContrasena.continuar, textoEnVuelo: textos.crearContrasena.guardando,
    alExito: () => { /* alTerminar ya reemplazó esta pantalla por la app */ },
  });
  montar(raiz, h(
    'div', { 'data-testid': 'vista-crear-contrasena' },
    crearBarraRol({ salir: ctx.salir }),
    crearDrako('presenta', textos.crearContrasena.drako),
    h('h1', {}, textos.crearContrasena.titulo),
    h('p', {}, textos.crearContrasena.ayuda),
    form,
  ));
  document.body.dataset.listo = '1';
}
