// @ts-check
// mock/rutas_registro.mjs · El autorregistro con código de grupo (backend 5aad55e, `src/registro/router.py`; ESPEC_pantallas_anillo §3.2 y §8).
//   POST /auth/registro                                         público, sin JWT
//   POST|GET|DELETE /teachers/groups/{gid}/codigo-inscripcion   el código del grupo (se ve UNA vez, al crearlo)
//   GET /teachers/groups/{gid}/solicitudes · POST …/{sid}/aprobar · POST …/{sid}/rechazar
// Las formas se validan en R6 contra `contratos/openapi_5aad55e.json` (tests/contrato/mock_registro.test.mjs).
//
// El orden de las respuestas de `POST /auth/registro` es el del backend: 422 del cuerpo → 422 `aviso_version_no_permitida` →
// 503 `registro_no_configurado` → 429 `demasiados_intentos` (con `Retry-After`) → 403 `codigo_no_valido` (UN solo cuerpo, no dice por
// qué) → 201 `{"estado":"pendiente"}` SIEMPRE igual (también si el código estudiantil o el correo ya existían: nadie puede preguntar
// si alguien tiene cuenta). El 503 llega DESPUÉS de validar el cuerpo completo: por eso la app no puede saber si el registro está encendido
// sin enviar el formulario (ESPEC §12, punto 1).
import { autenticar, exigirDocente } from './auth.mjs';
import { fallar } from './errores.mjs';
import { autorizarGrupo } from './rutas_teachers.mjs';
import { crearProfile, agregarMembresia } from './estado.mjs';
import { crearCuenta, borrarCuenta } from './gotrue.mjs';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 símbolos, sin I, L, O, 0 ni 1 (backend: codigos.ALFABETO)
const HORAS_POR_DEFECTO = 48;
const CUPO_POR_DEFECTO = 40;
const CLAVE_MIN = 10;
const CLAVE_MAX = 72;
const NO_ENCONTRADA = 'Solicitud not found';

const SIN_ESPACIOS_AL_BORDE = /^\S(.*\S)?$/s;
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODIGO_ESTUDIANTIL = /^[A-Za-z0-9-]{1,24}$/;

/** Una entrada de error al estilo de pydantic. */
const error = (tipo, campo, msg, entrada) => ({ type: tipo, loc: ['body', campo], msg, input: entrada ?? null });

function textoEntre(valor, min, max, patron) {
  return typeof valor === 'string' && valor.length >= min && valor.length <= max && (!patron || patron.test(valor));
}

/** Los 422 del cuerpo de `RegistroIn` (strict + extra="forbid"), todos a la vez. Devuelve [] si el cuerpo es válido. */
export function erroresDelRegistro(cuerpo) {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) return [{ type: 'model_attributes_type', loc: ['body'], msg: 'Input should be a valid dictionary', input: null }];
  const errores = [];
  const reglas = {
    codigo: (v) => textoEntre(v, 1, 20),
    nombre: (v) => textoEntre(v, 1, 120, SIN_ESPACIOS_AL_BORDE),
    correo: (v) => textoEntre(v, 3, 254, CORREO),
    codigo_estudiantil: (v) => typeof v === 'string' && CODIGO_ESTUDIANTIL.test(v),
    contrasena: (v) => textoEntre(v, CLAVE_MIN, CLAVE_MAX),
    mayor_de_edad: (v) => v === true,
    aviso_version: (v) => textoEntre(v, 1, 32, SIN_ESPACIOS_AL_BORDE),
  };
  for (const [campo, valida] of Object.entries(reglas)) {
    if (!(campo in cuerpo)) errores.push(error('missing', campo, 'Field required', null));
    else if (!valida(cuerpo[campo])) errores.push(error('value_error', campo, 'Input should be valid', campo === 'contrasena' ? null : cuerpo[campo]));
  }
  for (const campo of Object.keys(cuerpo)) if (!(campo in reglas)) errores.push(error('extra_forbidden', campo, 'Extra inputs are not permitted', cuerpo[campo]));
  return errores;
}

/** `abcd-efgh` y `ABCD EFGH` son el mismo código: mayúsculas, sin espacios, guiones ni tabuladores (backend: codigos.normalizar). */
export const normalizarCodigo = (texto) => String(texto).toUpperCase().replace(/[ \-\t]/g, '');
const mostrarCodigo = (codigo) => `${codigo.slice(0, 4)}-${codigo.slice(4)}`;

/** Un código de 8 símbolos que NO es al azar: sale del contador del estado, así el humo da el mismo hash en dos corridas. */
function generarCodigo(estado) {
  const n = ++estado.secuencias.codigo;
  let semilla = (n * 2654435761) >>> 0;
  let codigo = '';
  for (let i = 0; i < 8; i += 1) { semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0; codigo += ALFABETO[semilla % ALFABETO.length]; }
  return codigo;
}

function filaDeCodigoVigente(estado, codigoEscrito) {
  const buscado = normalizarCodigo(codigoEscrito);
  for (const [groupId, fila] of estado.codigosInscripcion) {
    if (fila.codigo !== buscado) continue;
    const vigente = fila.vence > estado.autorregistro.ahora();
    if (fila.activo && vigente && fila.usos < fila.cupo) return { groupId, fila };
  }
  return null;
}

/** POST /auth/registro — sin autenticación. */
export function registrarse(estado, req, cuerpo) {
  const reg = estado.autorregistro;
  const errores = erroresDelRegistro(cuerpo);
  if (errores.length > 0) fallar(422, errores);
  if (reg.versionesPermitidas && !reg.versionesPermitidas.has(cuerpo.aviso_version)) fallar(422, 'aviso_version_no_permitida');
  if (!reg.configurado) fallar(503, 'registro_no_configurado');
  if (reg.espera429 > 0) fallar(429, 'demasiados_intentos', { 'Retry-After': String(reg.espera429) });
  const hallado = filaDeCodigoVigente(estado, cuerpo.codigo);
  if (!hallado) fallar(403, 'codigo_no_valido'); // inexistente, apagado, vencido o sin cupo: el mismo cuerpo
  const grupo = estado.groups.get(hallado.groupId);
  const tenant = estado.tenants.get(grupo.tenant_id);
  const documento = `${tenant.slug}_${cuerpo.codigo_estudiantil}`;
  const ocupado = [...estado.profiles.values()].some((p) => p.documento_id === documento);
  const correoEnUso = estado.cuentas.has(cuerpo.correo.toLowerCase());
  if (!ocupado && !correoEnUso) crearSolicitud(estado, { cuerpo, grupo, documento, fila: hallado.fila });
  return { status: 201, cuerpo: { estado: 'pendiente' } }; // idéntico en los tres casos
}

function crearSolicitud(estado, { cuerpo, grupo, documento, fila }) {
  const profileId = crearProfile(estado, { documentoId: documento, nombre: cuerpo.nombre });
  agregarMembresia(estado, { tenantId: grupo.tenant_id, profileId, role: 'student', fullName: cuerpo.nombre, groupCode: grupo.group_code });
  estado.memberships.at(-1).is_active = false; // no entra hasta que su profe la apruebe
  const perfil = estado.profiles.get(profileId);
  perfil.consent_version = cuerpo.aviso_version; // aceptó el aviso ANTES de crear la cuenta
  perfil.consent_at = new Date(estado.autorregistro.ahora()).toISOString();
  crearCuenta(estado, { correo: cuerpo.correo, password: cuerpo.contrasena, profileId });
  fila.usos += 1;
  estado.solicitudesInscripcion.push({
    id: ++estado.secuencias.solicitudInscripcion, profileId, tenantId: grupo.tenant_id, groupId: grupo.id,
    estado: 'pendiente', creada: estado.autorregistro.ahora(),
  });
}

// ---------- el docente ----------
function docenteDelGrupo(estado, req, gid) {
  const auth = autenticar(estado, req);
  exigirDocente(auth);
  return { auth, grupo: autorizarGrupo(estado, auth, gid) };
}

/** `CodigoIn`: opcional; `horas` 1..168, `cupo` 1..200; cualquier otra clave, 422. */
function erroresDelCodigo(cuerpo) {
  if (cuerpo === undefined || cuerpo === null) return [];
  if (typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return [{ type: 'model_attributes_type', loc: ['body'], msg: 'Input should be a valid dictionary', input: null }];
  const errores = [];
  for (const [campo, [min, max]] of Object.entries({ horas: [1, 168], cupo: [1, 200] })) {
    const v = cuerpo[campo];
    if (v !== undefined && v !== null && !(Number.isInteger(v) && v >= min && v <= max)) errores.push(error('int_range', campo, `Input should be between ${min} and ${max}`, v));
  }
  for (const campo of Object.keys(cuerpo)) if (campo !== 'horas' && campo !== 'cupo') errores.push(error('extra_forbidden', campo, 'Extra inputs are not permitted', cuerpo[campo]));
  return errores;
}

const aISO = (ms) => new Date(ms).toISOString();

/** POST …/codigo-inscripcion → 201 {codigo, vence, cupo, usos}. Apaga el anterior. La ÚNICA respuesta que trae el código en claro. */
export function crearCodigo(estado, req, gid, cuerpo) {
  const { grupo } = docenteDelGrupo(estado, req, gid);
  const errores = erroresDelCodigo(cuerpo);
  if (errores.length > 0) fallar(422, errores);
  const horas = cuerpo?.horas ?? HORAS_POR_DEFECTO;
  const fila = { codigo: generarCodigo(estado), vence: estado.autorregistro.ahora() + horas * 3600_000, cupo: cuerpo?.cupo ?? CUPO_POR_DEFECTO, usos: 0, activo: true };
  estado.codigosInscripcion.set(grupo.id, fila); // el anterior deja de existir: su código ya no sirve
  return { status: 201, cuerpo: { codigo: mostrarCodigo(fila.codigo), vence: aISO(fila.vence), cupo: fila.cupo, usos: fila.usos } };
}

/** GET …/codigo-inscripcion → {activo, vence, cupo, usos}. NUNCA el código. */
export function leerCodigo(estado, req, gid) {
  const { grupo } = docenteDelGrupo(estado, req, gid);
  const fila = estado.codigosInscripcion.get(grupo.id);
  if (!fila) return { status: 200, cuerpo: { activo: false, vence: null, cupo: null, usos: null } };
  const vigente = fila.vence > estado.autorregistro.ahora();
  return { status: 200, cuerpo: { activo: fila.activo && vigente, vence: aISO(fila.vence), cupo: fila.cupo, usos: fila.usos } };
}

/** DELETE …/codigo-inscripcion → 204, también si no había. */
export function apagarCodigo(estado, req, gid) {
  const { grupo } = docenteDelGrupo(estado, req, gid);
  const fila = estado.codigosInscripcion.get(grupo.id);
  if (fila) fila.activo = false;
  return { status: 204, cuerpo: null };
}

/** GET …/solicitudes → las pendientes de ESE grupo, en orden de llegada. Sin correo (el backend no lo guarda). */
export function listarSolicitudes(estado, req, gid) {
  const { grupo } = docenteDelGrupo(estado, req, gid);
  const cuerpo = estado.solicitudesInscripcion
    .filter((s) => s.groupId === grupo.id && s.tenantId === grupo.tenant_id && s.estado === 'pendiente')
    .sort((a, b) => a.id - b.id)
    .map((s) => ({
      id: s.id, nombre: estado.memberships.find((m) => m.profile_id === s.profileId && m.tenant_id === s.tenantId)?.full_name || '',
      codigo_estudiantil: estado.profiles.get(s.profileId).documento_id, creada_en: aISO(s.creada),
    }));
  return { status: 200, cuerpo };
}

/** La solicitud, solo si es de ESE grupo (una de otro grupo o inexistente da el mismo 404). */
function solicitudDelGrupo(estado, grupo, sid) {
  const id = Number(sid);
  return estado.solicitudesInscripcion.find((s) => s.id === id && s.groupId === grupo.id && s.tenantId === grupo.tenant_id) || null;
}

/** POST …/aprobar → 200 {id, estado:"aprobada"}. Repetirlo no cambia nada. */
export function aprobarSolicitud(estado, req, gid, sid) {
  const { grupo } = docenteDelGrupo(estado, req, gid);
  const solicitud = solicitudDelGrupo(estado, grupo, sid);
  if (!solicitud) fallar(404, NO_ENCONTRADA);
  if (solicitud.estado !== 'aprobada') {
    const m = estado.memberships.find((x) => x.profile_id === solicitud.profileId && x.tenant_id === solicitud.tenantId);
    if (m) m.is_active = true;
    solicitud.estado = 'aprobada';
  }
  return { status: 200, cuerpo: { id: solicitud.id, estado: 'aprobada' } };
}

/** POST …/rechazar → 200 {id, estado:"rechazada"}. BORRA la cuenta de GoTrue y el perfil: no existe un estado "rechazada" que consultar. */
export function rechazarSolicitud(estado, req, gid, sid) {
  const { grupo } = docenteDelGrupo(estado, req, gid);
  if (!estado.autorregistro.configurado) fallar(503, 'registro_no_configurado'); // sin la clave de servicio no se puede borrar la cuenta
  const solicitud = solicitudDelGrupo(estado, grupo, sid);
  if (!solicitud || solicitud.estado !== 'pendiente') fallar(404, NO_ENCONTRADA);
  const { profileId } = solicitud;
  borrarCuenta(estado, profileId);
  estado.profiles.delete(profileId);
  estado.nombresPorProfile.delete(profileId);
  estado.memberships = estado.memberships.filter((m) => m.profile_id !== profileId);
  estado.solicitudesInscripcion = estado.solicitudesInscripcion.filter((s) => s.profileId !== profileId);
  return { status: 200, cuerpo: { id: solicitud.id, estado: 'rechazada' } };
}
