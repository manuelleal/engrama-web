// @ts-check
// TRAMPOSO x_set_sin_tenant: a SET se le arma un enlace sin la institución activa: SET no manda X-Tenant-ID y el backend elige la membresía más antigua (D11).
// anillo/enlace.js · El ÚNICO lugar de la app que arma un enlace con pase hacia EVA o SET (decisión 013, docs/ESPEC_pantallas_anillo.md §4.6).
// Es el único archivo de `src/` donde aparecen `pase=` y `tenant=` (V5 en herramientas/verificar.mjs lo vigila): ninguna vista escribe
// ese fragmento a mano.
//
// El PASE es el token de acceso de la sesión (abre toda la API 1 hora). Por eso:
//   - va SOLO en el fragmento (`#`), nunca en la consulta (`?`): el fragmento no llega al servidor ni a sus registros;
//   - cada valor va con `encodeURIComponent`;
//   - esta función es PURA: no lee la sesión, no guarda nada y no registra nada. Sus errores NUNCA llevan el valor del pase.
//
// Los cinco enlaces (013):
//   eva_celular   <EVA>/e#pase=<p>&sala=<s>                          estudiante   (sin sala, EVA pide el código en su pantalla)
//   eva_tablero   <EVA>/tablero#pase=<p>                             docente
//   eva_escamas   <EVA>/escamas#pase=<p>                             docente
//   set_examen    <SET>/index.html#<CODIGO>&pase=<p>&tenant=<t>      estudiante   (el código del examen es el primer tramo, sin clave)
//   set_revisar   <SET>/revisar.html#pase=<p>&tenant=<t>             docente
// A SET `tenant` es OBLIGATORIO (sin él SET no manda X-Tenant-ID y el backend elige la membresía más antigua: D11). A EVA no se manda.

/** Lo que cada destino arma: la ruta bajo la base, si exige `tenant` y si lleva `sala` o `codigo`. */
const DESTINOS = {
  eva_celular: { ruta: '/e', tenant: false, sala: true, codigo: false },
  eva_tablero: { ruta: '/tablero', tenant: false, sala: false, codigo: false },
  eva_escamas: { ruta: '/escamas', tenant: false, sala: false, codigo: false },
  set_examen: { ruta: '/index.html', tenant: true, sala: false, codigo: true },
  set_revisar: { ruta: '/revisar.html', tenant: true, sala: false, codigo: false },
};

/** Los destinos que existen. */
export const NOMBRES_DE_DESTINO = Object.keys(DESTINOS);

const CODIGO_DE_EXAMEN = /^[A-Za-z0-9_-]{1,32}$/;
const SALA_DE_EVA = /^[A-Za-z0-9]{1,8}$/;

/** @param {unknown} v */
const esTextoConAlgo = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * @param {{base: string, destino: keyof typeof DESTINOS, pase: string, tenant?: string, sala?: string, codigo?: string}} d
 *   `base`: la URL de EVA o de SET que salió de config.json (ya validada por anillo/destinos.js); admite barra final y prefijo de ruta.
 * @returns {string} el enlace completo, con todo en el fragmento
 * @throws si falta el pase, si a SET le falta el `tenant` (o el código del examen), si el código o la sala tienen un formato que no es,
 *   o si la base trae consulta o fragmento. Ningún mensaje de error incluye el pase.
 */
export function armarEnlaceAnillo({ base, destino, pase, tenant, sala, codigo }) {
  const def = /** @type {Record<string, {ruta: string, tenant: boolean, sala: boolean, codigo: boolean}>} */ (DESTINOS)[destino];
  if (!def) throw new Error(`anillo/enlace: destino desconocido "${String(destino)}"`);
  if (!esTextoConAlgo(base)) throw new Error('anillo/enlace: falta la base del destino');
  if (/[?#]/.test(base)) throw new Error('anillo/enlace: la base no puede traer consulta ni fragmento');
  if (!esTextoConAlgo(pase)) throw new Error('anillo/enlace: falta el pase');
  if (def.codigo && !CODIGO_DE_EXAMEN.test(String(codigo ?? ''))) throw new Error('anillo/enlace: el código del examen no tiene el formato esperado');
  if (def.sala && sala !== undefined && sala !== '' && !SALA_DE_EVA.test(String(sala))) throw new Error('anillo/enlace: el código de la sala no tiene el formato esperado');

  const partes = [];
  if (def.codigo) partes.push(encodeURIComponent(String(codigo))); // el primer tramo SIN clave: así lo lee SET
  partes.push(`pase=${encodeURIComponent(pase)}`);
  if (def.tenant && tenant) partes.push(`tenant=${encodeURIComponent(String(tenant))}`);
  if (def.sala && sala) partes.push(`sala=${encodeURIComponent(String(sala))}`);
  return `${base.replace(/\/+$/, '')}${def.ruta}#${partes.join('&')}`;
}
