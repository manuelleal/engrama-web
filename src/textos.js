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
    // W16 (§7.3, §9.5 E10): una acción del profe o del admin que escribe, deshabilitada sin red.
    /** @param {string} accion en infinitivo, p. ej. "abrir la sesión" */
    sinConexionAccion: (accion) => `Sin conexión: no puedes ${accion} ahora.`,
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
      accionAbrir: 'abrir la sesión', // W16: infinitivo para textos.red.sinConexionAccion
      cerrar: 'Cerrar sesión',
      cerrando: 'Cerrando…',
      accionCerrar: 'cerrar la sesión',
      codigoPrefijo: 'Código',
      enlacePrefijo: 'Enlace para el celular',
      /** @param {number} marcaron @param {number} total */
      resumen: (marcaron, total) => `${marcaron} de ${total} marcaron`,
      cerrada: 'Sesión cerrada.',
      errorAbrir: 'No se pudo abrir la sesión.',
      errorCerrar: 'No se pudo cerrar la sesión.',
      volverAlGrupo: 'Volver al grupo',
    },
    logro: {
      titulo: 'Logro por eje',
      volverAlGrupo: 'Volver al grupo',
      sinEstudiantes: 'Este grupo no tiene estudiantes con retos respondidos todavía.',
      errorGeneral: 'No se pudo cargar el logro del grupo.',
      // Nunca "débil": el saldo no es desempeño, y la etiqueta la arma el servidor (a_reforzar,
      // en_desarrollo, logrado, datos_insuficientes) — el cliente solo la muestra tal cual.
      sinNivelesCefr: '(sin retos con nivel)',
      columnaEstudiante: 'Estudiante',
    },
    errores: {
      titulo: 'Errores por ítem',
      volverAlGrupo: 'Volver al grupo',
      sinItems: 'Todavía no hay suficientes respuestas para mostrar errores por ítem.',
      errorGeneral: 'No se pudo cargar los errores del grupo.',
      columnaReto: 'Reto',
      columnaPregunta: 'Pregunta',
      columnaRespondientes: 'Respondientes',
      /** "errors - blank_answers" (P4 del pedagogo, ESPEC_grupos_y_panel_docente.md §5) */
      columnaErroresConRespuesta: 'Errores con respuesta',
      columnaEnBlanco: 'En blanco',
      columnaDistractorTop: 'Opción más elegida por error',
      sinDistractor: '—',
      /** @param {number} n */
      suprimidos: (n) => (n === 0 ? '' : `${n} ítem(s) sin mostrar por privacidad (menos del mínimo de respondientes).`),
    },
    retos: {
      titulo: 'Retos',
      // BUG-10 (§3, §11 W12): /challenges/all no filtra por grupo — se lo decimos al profe en vez
      // de esconderlo o fingir que la lista sí está filtrada.
      avisoTodoElColegio: 'Estos son los retos de todo el colegio, no solo de tus grupos (el servidor todavía no los filtra por grupo).',
      sinRetos: 'Este colegio no tiene retos todavía.',
      errorGeneral: 'No se pudieron cargar los retos.',
      /** @param {string|null} groupId */
      grupoAsignado: (groupId) => (groupId ? `Asignado a un grupo` : 'Sin grupo asignado'),
      activar: 'Activar',
      desactivar: 'Desactivar',
      cambiando: 'Cambiando…',
      errorCambiarEstado: 'No se pudo cambiar el estado.',
      etiquetaGrupoDestino: 'Asignar a',
      asignar: 'Asignar',
      asignando: 'Asignando…',
      asignado: 'Asignado ✓',
      errorAsignar: 'No se pudo asignar el reto.',
      elegirGrupo: 'Elige un grupo…',
      accionEscribir: 'activar, desactivar o asignar un reto', // W16: infinitivo para textos.red.sinConexionAccion
    },
  },
  admin: {
    grupos: {
      titulo: 'Grupos',
      sinGrupos: 'Todavía no hay grupos.',
      errorGeneral: 'No se pudieron cargar los grupos.',
      irAAsignarDocente: 'Asignar docente',
      irAImportarCsv: 'Importar estudiantes',
    },
    crearGrupo: {
      titulo: 'Crear grupo',
      etiquetaCodigo: 'Código del grupo',
      etiquetaCupo: 'Cupo máximo (opcional)',
      crear: 'Crear grupo',
      creando: 'Creando…',
      accionCrear: 'crear el grupo', // W16: infinitivo para textos.red.sinConexionAccion
      creado: 'Grupo creado.',
      faltaCodigo: 'Escribe el código del grupo.',
      errorGeneral: 'No se pudo crear el grupo.',
    },
    asignarDocente: {
      titulo: 'Asignar docente',
      volverAAdmin: 'Volver a Grupos',
      etiquetaDocumento: 'Documento del docente',
      asignar: 'Asignar',
      asignando: 'Asignando…',
      accionAsignar: 'asignar el docente', // W16: infinitivo para textos.red.sinConexionAccion
      faltaDocumento: 'Escribe el documento del docente.',
      /** @param {string} resultado 'asignado' | 'ya_estaba' */
      exito: (resultado) => (resultado === 'ya_estaba' ? 'El docente ya estaba asignado a este grupo.' : 'Docente asignado.'),
      errorGeneral: 'No se pudo asignar el docente.',
    },
    importarCsv: {
      titulo: 'Importar estudiantes (CSV)',
      volverAAdmin: 'Volver a Grupos',
      etiquetaArchivo: 'Archivo CSV (documento_id, nombre_completo)',
      vistaPrevia: 'Vista previa',
      importar: 'Importar',
      importando: 'Importando…',
      accionImportar: 'importar el archivo', // W16: infinitivo para textos.red.sinConexionAccion
      faltaArchivo: 'Elige un archivo CSV.',
      /** @param {{creados: number, ya_estaban: number, total: number}} r */
      exito: (r) => `Importado: ${r.creados} nuevo(s), ${r.ya_estaban} ya estaban, de ${r.total} fila(s).`,
      // M4 es todo o nada (§4.3): un 422 nunca escribió ninguna fila — se lo decimos explícito.
      encabezadoErrores: 'No se escribió nada. Corrige estas filas y vuelve a intentar:',
      errorGeneral: 'No se pudo importar el archivo.',
    },
  },
};
