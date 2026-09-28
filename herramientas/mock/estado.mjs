// @ts-check
// mock/estado.mjs · El modelo de datos en memoria del mock (W4). No es una base de datos: vive
// mientras el proceso de mock_api.mjs corre, y `crearEstado()` siempre arranca igual (para que
// el humo, §9.1, dé el mismo sha256 en dos corridas).
//
// Auth del mock (nunca real, documentado en mock_api.mjs): el `Bearer <token>` ES el
// identificador del actor — el `documento_id` para estudiantes y docentes, o un alias fijo para
// el admin de arranque. `perfil_actual.js`/`supabase_rest.js` (hitos 2-3) validan JWT de verdad
// contra el backend real; este mock nunca lo simula.
import { randomUUID } from 'node:crypto';

export const ADMIN_BOOTSTRAP_TOKEN = 'admin-demo';
export const DOCENTE_BOOTSTRAP_TOKEN = 'docente-demo';

function crearProfile(estado, { documentoId, nombre }) {
  const id = randomUUID();
  estado.profiles.set(id, {
    id, documento_id: documentoId, current_streak: 0, longest_streak: 0,
    xp: 0, is_active: true, last_attendance_date: null,
  });
  estado.nombresPorProfile.set(id, nombre); // nombre "global" de respaldo, solo para depurar
  return id;
}

function agregarMembresia(estado, { tenantId, profileId, role, fullName, groupCode = null }) {
  const tenant = estado.tenants.get(tenantId);
  estado.memberships.push({
    tenant_id: tenantId, tenant_name: tenant.name, tenant_slug: tenant.slug,
    profile_id: profileId, role, full_name: fullName, group_code: groupCode, is_active: true,
  });
}

/** Crea el estado inicial: un tenant "UIS (demo)", un admin y un docente de arranque. */
export function crearEstado() {
  const estado = {
    tenants: new Map(), profiles: new Map(), memberships: [], groups: new Map(),
    teacherGroups: [], // {tenant_id, profile_id, group_id} — visibilidad del docente (T1)
    challenges: new Map(), attempts: new Map(),
    attendanceSessions: new Map(), attendanceRecords: [],
    balances: new Map(), poolBalances: new Map(), ledger: [], llavesUsadas: new Set(),
    tokens: new Map(), nombresPorProfile: new Map(),
  };

  const tenantId = randomUUID();
  estado.tenants.set(tenantId, { id: tenantId, name: 'UIS (demo)', slug: 'uis-demo' });
  estado.poolBalances.set(tenantId, 1_000_000); // fondo de monedas del colegio (§9.1)

  const adminId = crearProfile(estado, { documentoId: 'ADMIN-DEMO', nombre: 'Admin Demo' });
  agregarMembresia(estado, { tenantId, profileId: adminId, role: 'admin', fullName: 'Admin Demo' });
  estado.tokens.set(ADMIN_BOOTSTRAP_TOKEN, adminId);

  const docenteId = crearProfile(estado, { documentoId: 'DOCENTE-DEMO', nombre: 'Docente Demo' });
  agregarMembresia(estado, { tenantId, profileId: docenteId, role: 'teacher', fullName: 'Docente Demo' });
  estado.tokens.set(DOCENTE_BOOTSTRAP_TOKEN, docenteId);

  estado.tenantDemoId = tenantId;
  return estado;
}

/** @returns {{profileId: string, tenantId: string}|null} */
export function resolverActor(estado, token, tenantIdPedido) {
  const profileId = estado.tokens.get(token);
  if (!profileId) return null;
  const propias = estado.memberships.filter((m) => m.profile_id === profileId && m.is_active);
  if (propias.length === 0) return null;
  const membresia = tenantIdPedido
    ? propias.find((m) => m.tenant_id === tenantIdPedido)
    : propias[0];
  if (!membresia) return null;
  return { profileId, tenantId: membresia.tenant_id };
}

export function membresiaDe(estado, profileId, tenantId) {
  return estado.memberships.find((m) => m.profile_id === profileId && m.tenant_id === tenantId) || null;
}

/** Inscribe (o encuentra) un estudiante por documento_id, con token = documento_id (mock). */
export function inscribirEstudiante(estado, { tenantId, documentoId, nombreCompleto, groupCode }) {
  const existente = estado.memberships.find(
    (m) => m.tenant_id === tenantId && m.role === 'student'
      && estado.profiles.get(m.profile_id)?.documento_id === documentoId,
  );
  if (existente) return { profileId: existente.profile_id, yaEstaba: true };
  const profileId = crearProfile(estado, { documentoId, nombre: nombreCompleto });
  agregarMembresia(estado, { tenantId, profileId, role: 'student', fullName: nombreCompleto, groupCode });
  estado.tokens.set(documentoId, profileId);
  return { profileId, yaEstaba: false };
}
