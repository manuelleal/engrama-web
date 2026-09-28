// TRAMPOSO X1 — versión rota a propósito: en vez de pasar por src/api/cliente.js (/api/...),
// consulta PostgREST directo, con la anon key en el cliente. Debe quedar en rojo en V1.
// @ts-check
const SUPABASE_URL = 'https://ejemplo.supabase.co';
const ANON_KEY = 'ejemplo-no-es-una-clave-real';

export async function saldoDeMonedas(perfilId) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=coins_balance&id=eq.${perfilId}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  const filas = await resp.json();
  return filas[0]?.coins_balance ?? 0;
}
