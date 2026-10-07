// @ts-check
// mock/rutas_datos.mjs · Solicitudes sobre datos personales (backend 5aad55e, `src/datos/router.py`, `docs/ESPEC_solicitud_datos.md`;
// ESPEC_pantallas_anillo §3.2 y §8). Las del usuario (`/auth/solicitudes-datos`) y las del admin (`/admin/solicitudes-datos`).
// Responder NO ejecuta nada: suprimir datos es un trámite manual. Con contraseña temporal las cuatro dan 403 `must_change_password`
// (no están entre las 4 rutas permitidas de mock/auth.mjs), igual que en el backend.
import { autenticar, exigirAdmin } from './auth.mjs';
import { fallar } from './errores.mjs';

const TIPOS = ['conocer', 'actualizar', 'rectificar', 'suprimir'];
const RESPUESTAS = ['en_tramite', 'resuelta', 'rechazada'];
const ESTADOS = ['abierta', 'en_tramite', 'resuelta', 'rechazada'];
const TEXTO_MAX = 1000;
const TOPE_SIN_CERRAR = 5;
const SIN_CERRAR = ['abierta', 'en_tramite'];
const NO_ENCONTRADA = 'Solicitud not found';

const error = (tipo, campo, msg, entrada) => ({ type: tipo, loc: ['body', campo], msg, input: entrada ?? null });
// Como Pydantic: el largo se cuenta en caracteres (puntos de código), no en unidades UTF-16; un emoji es 1.
const textoConAlgo = (v) => typeof v === 'string' && [...v].length >= 1 && [...v].length <= TEXTO_MAX && /\S/.test(v);

/** Los 422 de un cuerpo estricto con `campos` = {nombre: (valor) => ok}. Cualquier clave de más, 422. */
function erroresDe(cuerpo, campos) {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) return [{ type: 'model_attributes_type', loc: ['body'], msg: 'Input should be a valid dictionary', input: null }];
  const errores = [];
  for (const [campo, valida] of Object.entries(campos)) {
    if (!(campo in cuerpo)) errores.push(error('missing', campo, 'Field required', null));
    else if (!valida(cuerpo[campo])) errores.push(error('value_error', campo, 'Input should be valid', cuerpo[campo]));
  }
  for (const campo of Object.keys(cuerpo)) if (!(campo in campos)) errores.push(error('extra_forbidden', campo, 'Extra inputs are not permitted', cuerpo[campo]));
  return errores;
}

/** `SolicitudDatosOut`: sin institución y sin quién respondió. */
function salida(s) {
  return { id: s.id, tipo: s.tipo, mensaje: s.mensaje, estado: s.estado, creada_en: s.creada_en, respuesta: s.respuesta, respondida_en: s.respondida_en };
}

/** POST /auth/solicitudes-datos {tipo, mensaje} → 201. Cualquier rol; la persona sale del token. */
export function crearSolicitudDatos(estado, req, cuerpo) {
  const auth = autenticar(estado, req);
  const errores = erroresDe(cuerpo, { tipo: (v) => TIPOS.includes(v), mensaje: textoConAlgo });
  if (errores.length > 0) fallar(422, errores);
  const sinCerrar = estado.solicitudesDatos.filter((s) => s.profileId === auth.profileId && SIN_CERRAR.includes(s.estado)).length;
  if (sinCerrar >= TOPE_SIN_CERRAR) fallar(409, 'demasiadas_solicitudes_abiertas');
  const fila = {
    id: ++estado.secuencias.solicitudDatos, profileId: auth.profileId, tenantId: auth.tenantId, tipo: cuerpo.tipo, mensaje: cuerpo.mensaje,
    estado: 'abierta', creada_en: new Date(estado.autorregistro.ahora()).toISOString(), respuesta: null, respondida_en: null,
  };
  estado.solicitudesDatos.push(fila);
  return { status: 201, cuerpo: salida(fila) };
}

/** GET /auth/solicitudes-datos → las propias, de TODAS sus instituciones, la más nueva primero. */
export function misSolicitudesDatos(estado, req) {
  const auth = autenticar(estado, req);
  const propias = estado.solicitudesDatos.filter((s) => s.profileId === auth.profileId).sort((a, b) => b.id - a.id);
  return { status: 200, cuerpo: propias.map(salida) };
}

/** GET /admin/solicitudes-datos[?estado=] → las de la institución ACTIVA del admin, con el solicitante. */
export function solicitudesDeLaInstitucion(estado, req, filtro) {
  const auth = autenticar(estado, req);
  exigirAdmin(auth);
  if (filtro && !ESTADOS.includes(filtro)) fallar(422, [{ type: 'enum', loc: ['query', 'estado'], msg: 'Input should be valid', input: filtro }]);
  const propias = estado.solicitudesDatos.filter((s) => s.tenantId === auth.tenantId && (!filtro || s.estado === filtro)).sort((a, b) => b.id - a.id);
  return { status: 200, cuerpo: propias.map((s) => ({ ...salida(s), solicitante: solicitante(estado, s) })) };
}

function solicitante(estado, s) {
  const perfil = estado.profiles.get(s.profileId);
  if (!perfil) return null; // ya no existe
  const membresia = estado.memberships.find((m) => m.profile_id === s.profileId && m.tenant_id === s.tenantId);
  return { profile_id: s.profileId, nombre: membresia?.full_name ?? null, documento_id: perfil.documento_id };
}

/** PUT /admin/solicitudes-datos/{sid} {estado, respuesta} → 200. 404 si no es de su institución; 409 si ya estaba cerrada. */
export function responderSolicitudDatos(estado, req, sid, cuerpo) {
  const auth = autenticar(estado, req);
  exigirAdmin(auth);
  const errores = erroresDe(cuerpo, { estado: (v) => RESPUESTAS.includes(v), respuesta: textoConAlgo });
  if (errores.length > 0) fallar(422, errores);
  const fila = estado.solicitudesDatos.find((s) => s.id === Number(sid) && s.tenantId === auth.tenantId);
  if (!fila) fallar(404, NO_ENCONTRADA);
  if (!SIN_CERRAR.includes(fila.estado)) fallar(409, 'solicitud_cerrada');
  fila.estado = cuerpo.estado;
  fila.respuesta = cuerpo.respuesta;
  fila.respondida_en = new Date(estado.autorregistro.ahora()).toISOString();
  return { status: 200, cuerpo: salida(fila) };
}
