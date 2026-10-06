// @ts-check
// mock/rutas_auth.mjs · `/auth/me` y `/auth/contrasena` con la forma real del login piloto
// (`ProfileOut` de `engrama-backend/src/auth/schemas.py`, ESPEC_login_piloto.md §1.4 y §1.5).
// Se valida en R2 contra `contratos/openapi_c7a8b89.json` y en R3 contra la adenda
// `contratos/ADENDA_login_piloto.json` (a mano, hasta que haya un OpenAPI exportado nuevo).
//
// `full_name` de la raíz es el de la membresía del colegio ACTIVO (BUG-11); si esa membresía no
// tiene nombre (NULL), cae al nombre propio de la cuenta, como el backend.
import { autenticar } from './auth.mjs';
import { fallar } from './errores.mjs';

const CLAVE_MIN = 10;
const CLAVE_MAX = 72; // el límite de bcrypt, que GoTrue hereda

function membershipOut(m) {
  return {
    tenant_id: m.tenant_id, tenant_name: m.tenant_name, tenant_slug: m.tenant_slug, role: m.role,
    group_code: m.group_code, is_active: m.is_active, full_name: m.full_name ?? null,
  };
}

export function leerMe(estado, req) {
  const auth = autenticar(estado, req);
  const perfil = estado.profiles.get(auth.profileId);
  const propias = estado.memberships.filter((m) => m.profile_id === auth.profileId);
  return {
    status: 200,
    cuerpo: {
      id: perfil.id, documento_id: perfil.documento_id,
      full_name: auth.membresia.full_name ?? estado.nombresPorProfile.get(perfil.id) ?? '',
      role: auth.membresia.role,
      current_streak: perfil.current_streak, longest_streak: perfil.longest_streak, xp: perfil.xp, level: 1 + Math.floor(perfil.xp / 300),
      is_active: perfil.is_active, last_attendance_date: perfil.last_attendance_date, memberships: propias.map(membershipOut),
      active_tenant_id: auth.tenantId, must_change_password: perfil.force_password_reset === true,
    },
  };
}

/** `loc` y `msg` como los arma pydantic: el cliente no los lee, pero el 422 de largo no es un string. */
function fallarLargo(nueva) {
  fallar(422, [{ type: 'string_length', loc: ['body', 'nueva'], msg: `La clave debe tener entre ${CLAVE_MIN} y ${CLAVE_MAX} caracteres`, input: typeof nueva === 'string' ? nueva.length : null }]);
}

/**
 * POST /auth/contrasena {"nueva"}: el backend llama a GoTrue `PUT /user` con el Bearer del
 * usuario. Aquí GoTrue es el mapa `estado.cuentas`: una clave igual a la anterior es 422
 * `password_rejected`, como en GoTrue; si la acepta, la bandera baja a false y el MISMO token
 * sigue sirviendo (la bandera se lee del perfil en cada petición).
 */
export function cambiarContrasena(estado, req, body) {
  const auth = autenticar(estado, req);
  const nueva = body?.nueva;
  if (typeof nueva !== 'string' || nueva.length < CLAVE_MIN || nueva.length > CLAVE_MAX) fallarLargo(nueva);
  const cuenta = [...estado.cuentas.values()].find((c) => c.profileId === auth.profileId);
  if (cuenta && cuenta.password === nueva) fallar(422, 'password_rejected');
  if (cuenta) cuenta.password = nueva;
  estado.profiles.get(auth.profileId).force_password_reset = false;
  return { status: 204, cuerpo: null };
}
