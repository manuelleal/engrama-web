// @ts-check
// mock/gotrue.mjs · Un GoTrue de mentira, SOLO para entrar al cliente en modo supabase sin Docker
// (E2E y galería). Imita lo que el cliente usa (`auth/supabase_rest.js`): login con contraseña,
// renovación con el refresh token y salida. Vive bajo `/gotrue/*` en mock_api.mjs; el servidor de
// desarrollo lo ve como `ENGRAMA_AUTH_URL` y le quita `/auth/v1`, igual que Caddy hacia `gotrue:9999`.
//
// El "token de acceso" es un alias que mock/auth.mjs ya entiende (`estado.tokens`), no un JWT.
// La contraseña se cambia por el backend (`POST /auth/contrasena`, mock/rutas_auth.mjs), no aquí:
// el cliente ya no llama a `PUT /auth/v1/user`, así que este mock tampoco lo ofrece.
import { randomUUID } from 'node:crypto';
import { fallar } from './errores.mjs';

const EXPIRA_EN = 3600;

function emitir(estado, profileId) {
  const access = `acceso-${randomUUID()}`;
  const refresh = `refresco-${randomUUID()}`;
  estado.tokens.set(access, profileId);
  estado.refrescos.set(refresh, profileId);
  return { status: 200, cuerpo: { access_token: access, refresh_token: refresh, expires_in: EXPIRA_EN, token_type: 'bearer' } };
}

/** POST /gotrue/token?grant_type=password | refresh_token */
export function pedirToken(estado, url, body) {
  const tipo = url.searchParams.get('grant_type');
  if (tipo === 'password') {
    const cuenta = estado.cuentas.get(String(body?.email || '').toLowerCase());
    if (!cuenta || cuenta.password !== body?.password) {
      fallar(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
    }
    return emitir(estado, cuenta.profileId);
  }
  if (tipo === 'refresh_token') {
    const profileId = estado.refrescos.get(body?.refresh_token);
    if (!profileId) fallar(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
    estado.refrescos.delete(body.refresh_token); // GoTrue rota el refresh token
    return emitir(estado, profileId);
  }
  return fallar(400, { error: 'unsupported_grant_type', error_description: 'unsupported grant type' });
}

/** POST /gotrue/logout */
export function cerrarSesionGoTrue() {
  return { status: 204, cuerpo: null };
}

/** Crea la cuenta de GoTrue de un perfil (lo que haría el alta del operador, §1.7). */
export function crearCuenta(estado, { correo, password, profileId }) {
  estado.cuentas.set(correo.toLowerCase(), { profileId, password });
}
