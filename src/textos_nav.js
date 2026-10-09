// @ts-check
// textos_nav.js · Las cadenas de la navegación (docs/ESPEC_navegacion.md §5.10): la barra de abajo, el "volver" y lo que nombra a dónde se va.
// `textos.js` las esparce (está al tope de su tamaño), así que cada vista sigue importando solo `textos`. PROVISIONALES: las revisan Christiam
// y el pedagogo (ERR-16); donde choquen con el dictamen pedagógico 03, manda el dictamen.
export const textosNav = {
  nav: {
    // Los nombres de las pestañas son los títulos de sus pantallas (Retos y Asistencia reusan textos.retos.titulo y textos.asistencia.titulo).
    inicio: 'Inicio',
    // "Sesión" es SOLO la cuenta (§5.5): este es el único "Cerrar sesión" de la app.
    cerrarSesion: 'Cerrar sesión',
    cerrandoSesion: 'Cerrando…',
    // Un solo "volver": "‹ <nombre de la pantalla a la que vuelve>", con su nombre accesible completo (ui/encabezado.js).
    /** @param {string} nombre */
    volver: (nombre) => `‹ ${nombre}`,
    /** @param {string} nombre */
    volverAccesible: (nombre) => `Volver a ${nombre}`,
  },
};
