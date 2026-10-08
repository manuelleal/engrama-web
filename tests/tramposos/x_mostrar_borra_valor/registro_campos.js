// @ts-check
// vistas/registro_campos.js · Los campos del formulario de registro con código de grupo (docs/ESPEC_pantallas_anillo.md §4.1, adenda 17.7): cada uno con su
// etiqueta, su mensaje junto al campo y su `aria-describedby`; la casilla de "Tengo 18 años o más", el aviso de datos dentro de la propia pantalla (para no
// perder lo escrito al leerlo) y su casilla. `vistas/registro.js` los arma, lee lo escrito y manda; aquí no hay red ni estado de envío.
// Nada de lo que se escribe aquí (la contraseña, el código de grupo, el correo) se guarda en un almacenamiento, va a la dirección o sale por la consola.
import { h } from '../ui/dom.js';
import { textos } from '../textos.js';
import { crearTextoAviso } from './aviso_datos.js';

const T = textos.registro;

/**
 * Un campo de texto con su etiqueta, su línea de ayuda (opcional, se lee ANTES de escribir) y el sitio de su mensaje.
 * @param {{id: string, etiqueta: string, atributos: Record<string, string>, ayuda?: string}} d
 */
function crearCampo({ id, etiqueta, atributos, ayuda }) {
  const error = h('p', { role: 'alert', id: `${id}-error`, 'data-testid': `registro-error-${id}` });
  const nota = ayuda ? h('p', { class: 'ayuda-campo', id: `${id}-ayuda`, 'data-testid': `registro-ayuda-${id}` }, ayuda) : null;
  const describe = nota ? `${id}-ayuda ${id}-error` : `${id}-error`;
  const entrada = /** @type {HTMLInputElement} */ (h('input', { id, 'data-testid': `registro-${id}`, 'aria-describedby': describe, spellcheck: 'false', ...atributos }));
  return { entrada, error, nodos: [h('label', { for: id }, etiqueta), entrada, ...(nota ? [nota] : []), error] };
}

/** Una casilla con su texto: el blanco táctil es de 44 px (E17). @param {{id: string, texto: string}} d */
function crearCasilla({ id, texto }) {
  const entrada = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', id, 'data-testid': `registro-${id}`, 'aria-describedby': `${id}-error` }));
  const error = h('p', { role: 'alert', id: `${id}-error`, 'data-testid': `registro-error-${id}` });
  return { entrada, error, nodos: [h('label', { for: id, class: 'casilla-registro' }, entrada, ` ${texto}`), error] };
}

/**
 * La contraseña, su repetición y el botón "Mostrar" / "Ocultar" (adenda 17.8). El botón solo cambia el `type` de los dos campos entre `password` y `text`:
 * no toca el valor, no lo guarda en ningún almacenamiento y no escribe nada en la consola.
 */
function crearBloqueContrasena() {
  const clave = crearCampo({ id: 'contrasena', etiqueta: T.etiquetaContrasena, atributos: { type: 'password', autocomplete: 'new-password' }, ayuda: T.reglaContrasena });
  const repite = crearCampo({ id: 'repite', etiqueta: T.etiquetaRepite, atributos: { type: 'password', autocomplete: 'new-password' } });
  const boton = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'boton-secundario', 'aria-controls': 'contrasena repite', 'data-testid': 'registro-mostrar' }));
  let visible = false;
  const verTodo = (/** @type {boolean} */ si) => {
    visible = si;
    if (si) clave.entrada.value = '';
    for (const campo of [clave, repite]) campo.entrada.setAttribute('type', visible ? 'text' : 'password');
    boton.textContent = visible ? T.ocultar : T.mostrar;
  };
  verTodo(false);
  boton.addEventListener('click', () => verTodo(!visible));
  const delCampo = [...clave.nodos];
  delCampo.splice(2, 0, boton); // etiqueta, campo, [Mostrar], regla, mensaje
  return {
    nodos: [...delCampo, ...repite.nodos],
    zonas: { contrasena: clave.error, repite: repite.error },
    leer: () => ({ contrasena: clave.entrada.value, repite_contrasena: repite.entrada.value }),
    /** Vacía las dos y las vuelve a ocultar. */
    borrar() { clave.entrada.value = ''; repite.entrada.value = ''; verTodo(false); },
  };
}

/**
 * Todos los campos del formulario. `leer()` devuelve lo escrito (los textos sin espacios al borde, salvo la contraseña); `marcar()` pone cada mensaje junto a su campo.
 * @param {import('../aviso.js').Aviso} aviso
 */
export function crearCamposDelRegistro(aviso) {
  const codigo = crearCampo({ id: 'codigo', etiqueta: T.etiquetaCodigo, atributos: { type: 'text', autocomplete: 'off', autocapitalize: 'characters', autocorrect: 'off' } });
  const nombre = crearCampo({ id: 'nombre', etiqueta: T.etiquetaNombre, atributos: { type: 'text', autocomplete: 'name' } });
  const correo = crearCampo({ id: 'correo', etiqueta: T.etiquetaCorreo, atributos: { type: 'email', autocomplete: 'email', autocapitalize: 'none' } });
  const estudiantil = crearCampo({ id: 'codigo-estudiantil', etiqueta: T.etiquetaCodigoEstudiantil, atributos: { type: 'text', autocomplete: 'off' } });
  const contrasena = crearBloqueContrasena();
  const mayor = crearCasilla({ id: 'mayor', texto: T.mayor });
  const acepto = crearCasilla({ id: 'acepto-aviso', texto: textos.aviso.acepto });
  const leerAviso = h('details', { class: 'aviso-desplegable', 'data-testid': 'registro-aviso' }, h('summary', {}, T.avisoLeer), crearTextoAviso(aviso));
  const nodos = [
    ...codigo.nodos, ...nombre.nodos, ...correo.nodos, ...estudiantil.nodos, ...contrasena.nodos,
    ...mayor.nodos, h('p', { class: 'texto-apoyo', 'data-testid': 'registro-menor-ayuda' }, T.menorAyuda),
    leerAviso, ...acepto.nodos,
  ];
  const zonas = {
    codigo: codigo.error, nombre: nombre.error, correo: correo.error, codigo_estudiantil: estudiantil.error, ...contrasena.zonas,
    mayor_de_edad: mayor.error, aviso: acepto.error,
  };
  return {
    nodos,
    /** Lo escrito, tal cual lo recibiría el backend (menos `aviso_version`, que no se escribe). */
    leer() {
      return {
        codigo: codigo.entrada.value.trim(), nombre: nombre.entrada.value.trim(), correo: correo.entrada.value.trim(),
        codigo_estudiantil: estudiantil.entrada.value.trim(), ...contrasena.leer(),
        mayor_de_edad: mayor.entrada.checked, aviso_version: aviso.version, acepto_aviso: acepto.entrada.checked,
      };
    },
    /** Pone `mensajes` ({campo: texto}) junto a cada campo y borra los demás. @param {Record<string, string>} mensajes */
    marcar(mensajes) {
      for (const [campo, zona] of Object.entries(zonas)) if (zona) zona.textContent = mensajes[campo] ?? '';
    },
    /** Vacía la contraseña y su repetición (al recibir el 201 ya no hacen falta en ningún lado). */
    borrarContrasena() { contrasena.borrar(); },
  };
}

/**
 * ¿Por qué la repetición no sirve? `null` si las dos son iguales (también si ambas están vacías: entonces habla solo la primera). Pura; compara tal cual, sin recortar.
 * @param {string} clave @param {string} repite @returns {null|'vacio'|'distinta'}
 */
export function motivoDeRepeticion(clave, repite) {
  if (clave === repite) return null;
  return repite === '' ? 'vacio' : 'distinta';
}

/**
 * Qué texto va junto a cada campo malo. Pura.
 * @param {Record<string, string>} errores {campo: motivo} de `validarRegistro` @param {boolean} avisoAceptado @param {null|'vacio'|'distinta'} [repite] de `motivoDeRepeticion`
 */
export function mensajesDeCampos(errores, avisoAceptado, repite = null) {
  const E = T.errores;
  /** @type {Record<string, string>} */
  const m = {};
  if (errores.codigo) m.codigo = E.codigo;
  if (errores.nombre) m.nombre = E.nombre;
  if (errores.correo) m.correo = E.correo;
  if (errores.codigo_estudiantil) m.codigo_estudiantil = E.codigoEstudiantil;
  if (errores.contrasena) m.contrasena = { vacio: E.contrasenaVacia, corta: E.contrasenaCorta, larga: E.contrasenaLarga, composicion: E.contrasenaComposicion }[errores.contrasena] ?? E.contrasenaCorta;
  if (errores.mayor_de_edad) m.mayor_de_edad = E.mayor;
  if (repite) m.repite = repite === 'vacio' ? E.repiteVacia : E.noCoincide;
  if (!avisoAceptado) m.aviso = E.aviso;
  return m;
}
