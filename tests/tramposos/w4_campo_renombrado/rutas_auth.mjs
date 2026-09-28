// TRAMPOSO W4 — versión rota a propósito: `full_name` se manda como `nombre`. El backend real
// espera `full_name` (ProfileOut); R2 debe ponerse en rojo.
// @ts-check
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
      id: perfil.id, documento_id: perfil.documento_id, nombre: auth.membresia.full_name, role: auth.membresia.role,
      current_streak: perfil.current_streak, longest_streak: perfil.longest_streak, xp: perfil.xp, level: 1 + Math.floor(perfil.xp / 300),
      is_active: perfil.is_active, last_attendance_date: perfil.last_attendance_date, memberships: propias.map(membershipOut),
    },
  };
}
