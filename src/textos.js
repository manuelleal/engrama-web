// @ts-check
// textos.js · Todas las cadenas visibles del cliente, en español (§7.2). Cada vista importa de
// aquí en vez de escribir texto suelto, para que un cambio de redacción sea un solo lugar.
export const textos = {
  app: {
    titulo: 'ENGRAMA',
  },
  inicio: {
    // Placeholder del esqueleto (W3): W7 lo reemplaza por la pantalla real (saldo, constancia,
    // escudo y banner de retos).
    cargando: 'Cargando tu perfil…',
    monedas: 'monedas',
    constanciaPrefijo: 'Constancia',
    /** @param {number} n */
    retos: (n) => (n === 0 ? 'No tienes retos pendientes' : n === 1 ? 'Tienes 1 reto' : `Tienes ${n} retos`),
    drakoBienvenida: 'Drako te da la bienvenida',
    errorGeneral: 'No se pudo cargar tu perfil.',
  },
  red: {
    sinConexionPrefijo: 'Sin conexión · actualizado',
  },
  entrada: {
    titulo: 'Entrar (demo)',
    ayuda: 'Elige un actor de prueba. Datos sintéticos, rotulado "demo" (H0).',
  },
  auth: {
    sinSesion: 'No hay una sesión activa',
    actorDesconocido: (t) => `Actor desconocido: "${t}"`,
  },
  retos: {
    titulo: 'Retos',
    jugar: 'Jugar',
    repasar: 'Repasar',
    completado: 'Completado ✓',
    sinRetos: 'No tienes retos disponibles.',
    errorGeneral: 'No se pudieron cargar tus retos.',
  },
  retoFlujo: {
    /** @param {number} n @param {number} total */
    pregunta: (n, total) => `Pregunta ${n} de ${total}`,
    terminar: 'Terminar',
    siguiente: 'Siguiente',
    terminando: 'Enviando…',
    bannerRepaso: 'Repaso: no suma monedas',
    faltaRespuesta: 'Elige una opción antes de continuar.',
    drakoPresenta: 'Drako presenta el reto',
  },
  revision: {
    titulo: 'Revisión',
    correcta: 'Correcta',
    incorrecta: 'Esta vez no',
    /** @param {string} texto */
    laCorrectaEra: (texto) => `La correcta era: ${texto}`,
    /** @param {number} n */
    gananciaMonedas: (n) => `+${n} monedas`,
    sinGanancia: 'No sumaste monedas esta vez.',
    volver: 'Volver a mis retos',
    drakoCelebra: 'Drako celebra contigo',
  },
  asistencia: {
    titulo: 'Asistencia',
    etiquetaCodigo: 'Código de la sesión',
    marcar: 'Marcar asistencia',
    marcando: 'Marcando…',
    sinRed: 'Sin conexión: no puedes marcar asistencia ahora.',
    /** @param {number} monedas @param {number} racha */
    exito: (monedas, racha) => `Asistencia marcada · +${monedas} monedas · constancia ${racha}`,
    codigoInvalido: 'Código no válido para tu grupo.',
    yaMarcada: 'Ya habías marcado esta sesión.',
    sesionVencida: 'Esta sesión ya venció.',
    faltaCodigo: 'Escribe el código de la sesión.',
  },
  profe: {
    grupos: {
      titulo: 'Mis grupos',
      sinGrupos: 'No tienes grupos asignados.',
      errorGeneral: 'No se pudieron cargar tus grupos.',
      /** @param {number} n */
      estudiantes: (n) => (n === 1 ? '1 estudiante' : `${n} estudiantes`),
    },
    grupo: {
      /** @param {string} codigo */
      titulo: (codigo) => `Grupo ${codigo}`,
      noEncontrado: 'No encontrado.',
      sinEstudiantes: 'Este grupo no tiene estudiantes inscritos todavía.',
      columnaNombre: 'Nombre',
      columnaConstancia: 'Constancia',
      columnaUltimaAsistencia: 'Última asistencia',
      sinAsistencia: 'Sin registro',
      abrirSesion: 'Abrir sesión de asistencia',
      verLogro: 'Logro por eje',
      verErrores: 'Errores por ítem',
      verRetos: 'Retos',
    },
    sesion: {
      titulo: 'Sesión de asistencia',
      etiquetaDuracion: 'Duración (minutos)',
      abrir: 'Abrir sesión',
      abriendo: 'Abriendo…',
      cerrar: 'Cerrar sesión',
      cerrando: 'Cerrando…',
      codigoPrefijo: 'Código',
      enlacePrefijo: 'Enlace para el celular',
      /** @param {number} marcaron @param {number} total */
      resumen: (marcaron, total) => `${marcaron} de ${total} marcaron`,
      cerrada: 'Sesión cerrada.',
      errorAbrir: 'No se pudo abrir la sesión.',
      errorCerrar: 'No se pudo cerrar la sesión.',
      volverAlGrupo: 'Volver al grupo',
    },
  },
};
