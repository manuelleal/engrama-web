// @ts-check
// vistas/panel_docente.js · El panel del profe y del admin en UN módulo diferido (docs/ESPEC_margen_precarga.md).
// No pinta nada: junta las 10 pantallas para que app.js las pida con un solo `import()` (src/panel_diferido.js) en vez de importarlas
// de forma estática. Este archivo y todo lo que importa (y que el estudiante no usa) van en la lista DIFERIDOS de sw.js, fuera de PRECARGA:
// U59 (tests/unit/sw_peso.test.mjs) exige que cada import de aquí esté guardado, en PRECARGA o en DIFERIDOS.
export { renderGrupos } from './profe/grupos.js';
export { renderGrupo } from './profe/grupo.js';
export { renderSesionAsistencia, olvidarAsistencias } from './profe/sesion_asistencia.js';
export { renderInscripcion } from './profe/inscripcion.js';
export { renderLogro } from './profe/logro.js';
export { renderErrores } from './profe/errores.js';
export { renderRetosProfe } from './profe/retos.js';
export { renderCrearGrupo } from './admin/crear_grupo.js';
export { renderAsignarDocente } from './admin/asignar_docente.js';
export { renderImportarCsv } from './admin/importar_csv.js';
export { renderTiendaGrupo } from './profe/tienda_grupo.js'; // Lingo Coins (decisión 017)
export { renderPujaProfe } from './profe/puja_profe.js';
export { renderProfesores } from './admin/profesores.js';
// El panel del super admin y el tablero del admin (docs/ESPEC_panel_super_admin.md §4 y su adenda 1).
export { renderTablero } from './admin/tablero.js';
export { renderSuper } from './super/clientes.js';
export { renderCliente } from './super/cliente.js';
export { renderInvitar } from './admin/invitar.js'; // invitar profes por correo (engrama-backend ESPEC_invitar_profe)
