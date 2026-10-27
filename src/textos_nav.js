// @ts-check
// textos_nav.js · Las cadenas de la navegación (docs/ESPEC_navegacion.md §5.10): la barra de abajo, el "volver" y lo que nombra a dónde se va.
// `textos.js` las esparce (está al tope de su tamaño), así que cada vista sigue importando solo `textos`. PROVISIONALES: las revisan Christiam
// y el pedagogo (ERR-16); donde choquen con el dictamen pedagógico 03, manda el dictamen.
export const textosNav = {
  nav: {
    // Los nombres de las pestañas son los títulos de sus pantallas (Retos y Asistencia reusan textos.retos.titulo y textos.asistencia.titulo).
    inicio: 'Inicio',
    repaso: 'Repaso', // W80: el repaso de la tanda
    camino: 'Tu camino', // W92: las unidades del nivel (docs/ESPEC_camino_y_tu_palabra.md §3)
    caminoEnlace: 'Tu camino: tus unidades y la que sigue',
    // W68 (§5.6): la entrada de la barra que lleva a "mi cuenta" (el aviso, las solicitudes y "Cerrar sesión" viven ahí).
    perfil: 'Perfil',
    // W70 (§5.6): las entradas de la barra del profe y del admin. Cada una dice lo mismo que el título de su pantalla.
    misGrupos: 'Mis grupos',
    grupos: 'Grupos',
    tablero: 'Tablero', // panel (docs/ESPEC_panel_super_admin.md §4): la pestaña del admin con las cifras de su institución
    retos: 'Retos',
    barra: 'Navegación principal', // el nombre accesible de la barra de abajo
    // "Sesión" es SOLO la cuenta (§5.5): este es el único "Cerrar sesión" de la app.
    cerrarSesion: 'Cerrar sesión',
    cerrandoSesion: 'Cerrando…',
    // Un solo "volver": "‹ <nombre de la pantalla a la que vuelve>", con su nombre accesible completo (ui/encabezado.js).
    /** @param {string} nombre */
    volver: (nombre) => `‹ ${nombre}`,
    /** @param {string} nombre */
    volverAccesible: (nombre) => `Volver a ${nombre}`,
    // W71 (§5.7): la pestaña del navegador dice dónde estoy.
    /** @param {string} titulo */
    pestana: (titulo) => `${titulo} · ENGRAMA`,
  },
  // W71 (§5.7): el título de una pantalla de un grupo dice de qué grupo es ("Logro por eje · SINT-B1-01"). Si el código no llega, queda el
  // título solo: nunca el identificador interno.
  titulos: {
    /** @param {string} titulo @param {string} codigo */
    conGrupo: (titulo, codigo) => `${titulo} · ${codigo}`,
    inscripciones: 'Inscripciones',
  },
  // W73 (§5.9): se puede salir del reto en curso. PROVISIONAL (C7: sin confirmar). El nombre accesible dice de qué se sale.
  salirDelReto: { texto: 'Salir', nombre: 'Salir del reto' },
  // W69 (§5.6): Perfil es "mi cuenta" para los tres roles. Su título sigue en textos.perfil.titulo ("Tu perfil"); lo nuevo va aquí, en una clave
  // propia de primer nivel (un spread no mezcla claves anidadas de textos.js).
  cuenta: {
    quienSoy: 'Tu cuenta',
    seccionContrasena: 'Cambiar tu contraseña',
    roles: { student: 'Estudiante', teacher: 'Docente', admin: 'Administración' },
    /** @param {string} nombre */
    institucion: (nombre) => `Institución: ${nombre}`,
  },
  // El panel del super admin y el tablero del admin (docs/ESPEC_panel_super_admin.md §4): los títulos de sus tres pantallas. Un cliente se titula
  // por su código neutro ("Cliente 03"), nunca por su nombre.
  panelNav: {
    institucion: 'Tu institución',
    todo: 'Todo ENGRAMA',
    cliente: 'Un cliente',
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
  // Adenda 1 de docs/ESPEC_margen_precarga.md: el respaldo cuando el panel del profe y del admin (que se carga aparte) no llegó. Dice qué pasó y
  // qué hacer: "Reintentar" lo vuelve a pedir y pinta la pantalla ahí mismo; recargar es el último recurso. PROVISIONAL (Christiam y el pedagogo).
  panelSinCargar: {
    titulo: 'No se pudo abrir esta pantalla',
    queOcurrio: 'Falta descargar una parte del panel y no hubo conexión. Revisa tu conexión y toca Reintentar.',
    todaviaNo: 'Todavía no se pudo descargar. Revisa tu conexión y vuelve a tocar Reintentar.',
    reintentar: 'Reintentar',
    reintentando: 'Reintentando…',
    ultimoRecurso: 'Si tienes conexión y sigue sin abrir, recarga la página.',
    recargar: 'Recargar la página',
  },
  // Lingo Coins dentro de ENGRAMA (decisión 017): los títulos de las pantallas de la economía. Los textos de adentro viven en textos_economia.js (diferido).
  economiaNav: {
    tienda: 'La tienda',
    mochila: 'Tu mochila',
    puja: 'La Puja',
    tiendaGrupo: 'Tienda del grupo',
    lanzarPuja: 'Lanzar puja',
    profesores: 'Profesores',
  },
};
