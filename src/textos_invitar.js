// @ts-check
// textos_invitar.js · Las cadenas de "Profes: invitar" (vistas/admin/invitar.js) y de aceptar la invitación (el enlace del correo,
// `#/invitacion`, que pinta vistas/recuperar.js con estos textos). Espec: engrama-backend docs/ESPEC_invitar_profe.md §5.
// DIFERIDO: lo importan solo esas dos pantallas (sw.js DIFERIDOS). PROVISIONALES: los revisan Christiam y el pedagogo.
// Lo que NO dicen nunca: si un correo ya tiene cuenta en otra institución (el servidor responde igual; aquí tampoco se adivina).

/** @param {number} n */
const veces = (n) => (n === 1 ? '1 vez' : `${n} veces`);

export const textosInvitar = {
  // El profe abre el enlace del correo: pisa solo lo que cambia frente a "recuperar la contraseña".
  aceptar: {
    nuevaTitulo: 'Bienvenido a ENGRAMA: crea tu contraseña',
    nuevaAyuda: 'Escríbela dos veces. Con tu correo y esta contraseña entras desde ahora.',
    guardar: 'Crear mi contraseña',
    vencidoTitulo: 'Este enlace ya no sirve',
    vencido: 'Ya se usó o venció (dura 1 hora). Pide a quien te invitó que lo reenvíe, o pide un enlace nuevo con tu correo.',
    pedirOtro: 'Pedir un enlace nuevo',
    listoTitulo: 'Listo: ya tienes tu contraseña',
    listo: 'Entra con tu correo y la contraseña que acabas de crear.',
  },
  admin: {
    enlace: 'Profes: invitar',
    intro: 'Escribe el nombre y el correo del profe. Le llega un correo de ENGRAMA para que cree su contraseña; tú no la ves ni la asignas.',
    nombre: 'Nombre del profe',
    correo: 'Correo del profe',
    grupo: 'Grupo',
    grupoNuevo: 'Un grupo nuevo…',
    nombreGrupoNuevo: 'Nombre del grupo nuevo',
    invitar: 'Invitar',
    invitando: 'Enviando la invitación…',
    hecho: (nombre) => `Listo: le enviamos la invitación a ${nombre}.`,
    lista: 'Invitaciones',
    vacia: 'Todavía no has invitado a nadie.',
    enviada: 'Enviada',
    aceptada: 'Aceptada',
    /** @param {string} cuando @param {number} n */
    detalle: (cuando, n) => `Enviada ${cuando} · ${veces(n)}`,
    reenviar: 'Reenviar',
    cancelar: 'Cancelar',
    cancelarSeguro: '¿Seguro? Toca otra vez para cancelar',
    cancelando: 'Cancelando…',
    cancelada: (nombre) => `Listo: cancelamos la invitación de ${nombre}.`,
    noSePudoCancelar: 'No se pudo cancelar la invitación ahora. Intenta de nuevo en unos minutos.',
    yaAceptadaNoSeCancela: 'Ese profe ya aceptó la invitación: ya no se puede cancelar.',
    accesoCancelar: (nombre) => `Cancelar la invitación de ${nombre}`,
    reenviando: 'Reenviando…',
    reenviada: (nombre) => `Listo: le reenviamos la invitación a ${nombre}.`,
    accesoReenviar: (nombre) => `Reenviar la invitación a ${nombre}`,
    ayudaReenvio: 'Si no le llegó en unos minutos, que revise spam o correo no deseado, o reenvíala. El enlace dura 1 hora.',
    cargando: 'Cargando las invitaciones…',
    // Lo que se arregla en el formulario (0 peticiones)
    faltaNombre: 'Escribe el nombre del profe.',
    faltaCorreo: 'Escribe el correo del profe.',
    correoMalEscrito: 'Revisa el correo: parece que está mal escrito.',
    faltaGrupo: 'Elige un grupo o escribe el nombre del grupo nuevo.',
    // Lo que responde el servidor, en palabras (nunca el código crudo)
    yaInvitado: 'Ya invitaste ese correo en tu institución. Búscalo en la lista y reenvía la invitación.',
    yaAceptada: 'Ese profe ya aceptó la invitación: ya puede entrar.',
    demasiadas: (min) => `Llegaste al límite de invitaciones por hora. Intenta de nuevo en ${min} min.`,
    esperaReenvio: (s) => `Espera ${s} s para volver a reenviar esta invitación.`,
    grupoNoEncontrado: 'Ese grupo ya no está en tu institución. Recarga la página y elige otro.',
    grupoRepetido: 'Ya hay un grupo con ese nombre. Elígelo en la lista.',
    grupoCreadoSinInvitar: 'El grupo nuevo ya quedó creado y elegido en la lista; la invitación no salió.',
    noConfigurado: 'Invitar por correo todavía no está activo en este servidor. Avisa a quien administra ENGRAMA.',
    sinRed: 'Sin conexión: no se pudo enviar. Intenta de nuevo cuando tengas red.',
    error: 'No se pudo completar. Intenta de nuevo en unos minutos.',
    errorLista: 'No se pudo cargar la lista de invitaciones.',
  },
};
