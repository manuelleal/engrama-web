// @ts-check
// textos_nav.js · Las cadenas de la navegación (docs/ESPEC_navegacion.md §5.10): la barra de abajo, el "volver" y lo que nombra a dónde se va.
// `textos.js` las esparce (está al tope de su tamaño), así que cada vista sigue importando solo `textos`. PROVISIONALES: las revisan Christiam
// y el pedagogo (ERR-16); donde choquen con el dictamen pedagógico 03, manda el dictamen.
export const textosNav = {
  nav: {
    // Los nombres de las pestañas son los títulos de sus pantallas (Retos y Asistencia reusan textos.retos.titulo y textos.asistencia.titulo).
    inicio: 'Inicio',
    // W68 (§5.6): la entrada de la barra que lleva a "mi cuenta" (el aviso, las solicitudes y "Cerrar sesión" viven ahí).
    perfil: 'Perfil',
    barra: 'Navegación principal', // el nombre accesible de la barra de abajo
    // "Sesión" es SOLO la cuenta (§5.5): este es el único "Cerrar sesión" de la app.
    cerrarSesion: 'Cerrar sesión',
    cerrandoSesion: 'Cerrando…',
    // Un solo "volver": "‹ <nombre de la pantalla a la que vuelve>", con su nombre accesible completo (ui/encabezado.js).
    /** @param {string} nombre */
    volver: (nombre) => `‹ ${nombre}`,
    /** @param {string} nombre */
    volverAccesible: (nombre) => `Volver a ${nombre}`,
  },
  // W69 (§5.6): Perfil es "mi cuenta" para los tres roles. Su título sigue en textos.perfil.titulo ("Tu perfil"); lo nuevo va aquí, en una clave
  // propia de primer nivel (un spread no mezcla claves anidadas de textos.js).
  cuenta: {
    quienSoy: 'Tu cuenta',
    seccionContrasena: 'Cambiar tu contraseña',
    roles: { student: 'Estudiante', teacher: 'Docente', admin: 'Administración' },
    /** @param {string} nombre */
    institucion: (nombre) => `Institución: ${nombre}`,
  },
  // W65 (§5.4): el bloque de Inicio del estudiante que dice qué hacer primero. PROVISIONAL (pedagogo, ERR-16).
  ahora: {
    titulo: 'Ahora',
  },
  // W64 (§5.3): la tarjeta de cada grupo en el inicio del profe. Las tres acciones, la de cada clase primero.
  tarjetaGrupo: {
    asistencia: 'Abrir asistencia',
    inscripciones: 'Inscripciones',
    ver: 'Ver el grupo',
    /** Cuántos esperan que el profe apruebe su inscripción: solo el número, nunca un nombre. @param {number} n */
    esperan: (n) => (n === 1 ? '1 espera aprobación' : `${n} esperan aprobación`),
  },
};
