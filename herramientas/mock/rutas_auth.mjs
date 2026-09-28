// @ts-check
// mock/rutas_auth.mjs · GET /auth/me con la forma real de hoy (`ProfileOut`, R2 la valida contra
// el OpenAPI exportado) — no la forma futura de la 034/login vendible, que el backend todavía no
// sirve en ningún endpoint (`auth/mock.js`, W5, fabrica esa forma en el cliente sin red).
// `full_name` sale de la membresía del tenant activo, nunca de un nombre global (BUG-11).
import { autenticar } from './auth.mjs';

function membershipOut(m) {
  return { tenant_id: m.tenant_id, tenant_name: m.tenant_name, tenant_slug: m.tenant_slug, role: m.role, group_code: m.group_code, is_active: m.is_active };
}

export function leerMe(estado, req) {
  const auth = autenticar(estado, req);
  const perfil = estado.profiles.get(auth.profileId);
  const propias = estado.memberships.filter((m) => m.profile_id === auth.profileId);
  return {
    status: 200,
    cuerpo: {
      id: perfil.id, documento_id: perfil.documento_id, full_name: auth.membresia.full_name, role: auth.membresia.role,
      current_streak: perfil.current_streak, longest_streak: perfil.longest_streak, xp: perfil.xp, level: 1 + Math.floor(perfil.xp / 300),
      is_active: perfil.is_active, last_attendance_date: perfil.last_attendance_date, memberships: propias.map(membershipOut),
    },
  };
}
