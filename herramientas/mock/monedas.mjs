// @ts-check
// mock/monedas.mjs · Doble entrada simple: pool del tenant → billetera del estudiante, con la
// llave de idempotencia que fija BUG-13 (ESPEC_bug13a15.md §1.1, ya adoptada por el mock aunque
// el backend real todavía no la tenga — así lo pidió el coordinador). Con la misma llave, una
// segunda paga no mueve saldos y no revienta: simplemente no paga (§1.1 "con llave").
import { randomUUID } from 'node:crypto';

export function saldoDe(estado, profileId) {
  return estado.balances.get(profileId) || 0;
}

/**
 * @param {{tenantId: string, profileId: string, amount: number, action: string,
 *   metadata?: object, idempotencyKey?: string|null}} datos
 * @returns {object|null} la fila del ledger, o null si la llave ya se usó (no paga dos veces)
 */
export function otorgarMonedas(estado, datos) {
  const { tenantId, profileId, amount, action, metadata = {}, idempotencyKey = null } = datos;
  if (idempotencyKey) {
    const llave = `${tenantId}:${idempotencyKey}`;
    if (estado.llavesUsadas.has(llave)) return null;
    estado.llavesUsadas.add(llave);
  }
  const poolActual = estado.poolBalances.get(tenantId) || 0;
  estado.poolBalances.set(tenantId, poolActual - amount);
  estado.balances.set(profileId, saldoDe(estado, profileId) + amount);
  const entrada = {
    id: randomUUID(), tenant_id: tenantId, amount, action,
    from_wallet_id: tenantId, to_wallet_id: profileId, metadata, created_at: new Date().toISOString(),
  };
  estado.ledger.push(entrada);
  return entrada;
}

/** `WalletOut` de un estudiante — la billetera se identifica con su propio profileId (mock). */
export function walletOut(profileId) {
  return { id: profileId, owner_type: 'profile', balance: 0, currency: 'COIN', updated_at: new Date().toISOString() };
}

export function coinHistoryOut(estado, profileId, limite) {
  const entradas = estado.ledger
    .filter((e) => e.to_wallet_id === profileId || e.from_wallet_id === profileId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limite);
  return {
    wallet: { ...walletOut(profileId), balance: saldoDe(estado, profileId) },
    entries: entradas,
    total: entradas.length,
  };
}
