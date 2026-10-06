# Encargo al backend: registro del consentimiento (aviso de tratamiento de datos, Ley 1581)

Origen: encargo de Christiam (2026-10-06), antes de que entren estudiantes reales (mayores de edad, UIS). Es un
**supuesto del cliente**: engrama-web ya lo usa contra su mock (`herramientas/mock/rutas_auth.mjs`); el backend lo
implementa después, y si la forma real difiere, se corrige el mock y el cliente en un commit aparte.

> **Nota para Christiam: el texto del aviso NO es un concepto jurídico.** Está en `src/textos.js` (`textos.aviso`) y
> es un aviso claro y corto. Hay que **hacerlo revisar por quien corresponda** (abogado o el área de datos de cada
> institución) antes de usarlo con estudiantes reales, junto con el acuerdo de encargo de cada institución y la
> definición de quién es el responsable. Si el texto cambia, **sube `AVISO_VERSION`** en `config.json`: todos vuelven
> a aceptar.

## Qué hace el cliente

1. Con cuentas reales (modos `supabase` y `perfil_actual`), después de crear la contraseña y **antes de Inicio**,
   muestra "Tratamiento de tus datos" con una casilla "He leído y acepto" y un botón. Sin aceptar no se entra;
   "No acepto" cierra la sesión.
2. Al aceptar llama a `POST /api/auth/consentimiento` y **vuelve a pedir `/auth/me`**. Solo entra si
   `consent_version` es igual a `AVISO_VERSION`. Nunca decide por algo guardado en el navegador.
3. Si `AVISO_VERSION` cambia, `consent_version` ya no coincide y se vuelve a pedir.
4. Se puede leer siempre: desde el perfil (`#/datos`) y desde un enlace en la pantalla de entrada.

## Contrato

### `POST /auth/consentimiento`
- **Guarda `user`** (JWT válido, perfil existente). Como el resto de `/auth`, **no** está entre las 4 rutas permitidas
  con contraseña temporal: con `force_password_reset` da `403 must_change_password` (el cliente la pide después de
  crear la contraseña, así que no choca).
- **Cuerpo**: `{"version": "<texto, 1 a 32 caracteres, sin espacios al borde>"}`. Cualquier otra cosa: `422`
  (arreglo de errores de pydantic, como `POST /auth/contrasena`). `extra="forbid"`.
- **Respuesta `200`**: `{"version": "<la guardada>", "accepted_at": "<ISO 8601 con zona>"}`.
- **Idempotencia**: repetir la **misma versión** no crea una fila nueva ni cambia `accepted_at` (devuelve la primera);
  responde `200` igual. Una versión **distinta** guarda una fila nueva (queda el historial).
- **Qué guarda** (tabla nueva, p. ej. `consentimientos`): `profile_id`, `version`, `accepted_at`
  (`timestamptz`, `now()` del servidor), con `UNIQUE (profile_id, version)`. El consentimiento es **de la persona**
  (perfil), no de una institución: un docente en UIS y SENA acepta una vez. **No** se guarda IP ni dispositivo
  (dato mínimo). RLS como el resto de tablas del perfil.
- **Auditoría**: una fila en `audit_logs` (`action_type = 'consent_accept'`, `result = 'success'`).

### `GET /auth/me` y `POST /auth/session` (campo nuevo)
- `consent_version: string | null`: la versión **más reciente** que ese perfil aceptó, o `null` si nunca aceptó.
  Se agrega a `ProfileOut` (`active_tenant_id`, `must_change_password` y `memberships[].full_name` no cambian).
- El cliente compara con `AVISO_VERSION` por **igualdad**: una versión distinta (anterior o posterior) pide el aviso.
- **Mientras el backend no devuelva este campo, el cliente lo trata como `null` y pide el aviso en cada ingreso**
  (falla cerrado): no se entra a Inicio hasta que el backend lo implemente.

### Lo que NO pide el cliente al backend
- Nada de endpoints para borrar el consentimiento ni para exportar/suprimir datos: los derechos (conocer, actualizar,
  rectificar, suprimir) se ejercen escribiendo al contacto del aviso (`AVISO_CONTACTO`), que es una persona.

## Configuración del despliegue (`config.json`, nunca en el código)

| Clave | Qué es | Ejemplo (de prueba) |
|---|---|---|
| `AVISO_RESPONSABLE` | quién es el responsable de los datos | `Responsable de Prueba (UIS, demostración)` |
| `AVISO_CONTACTO` | a quién escribir para ejercer los derechos | `datos@piloto.test` |
| `AVISO_VERSION` | versión del aviso; es lo que se registra | `2026-10-v1` |

Si falta cualquiera (o está vacía), con cuentas reales la app muestra "Falta configurar el aviso de datos" y **no deja
entrar**: no puede haber aviso sin responsable. El modo `mock` (actores de prueba, sin cuentas) no pide aviso.

**Aviso a ARQUITECTO (`despliegue/`):** el `config.json` que sirve Caddy hoy trae solo `ENGRAMA_AUTH`. Hay que agregarle
las tres claves o nadie podrá entrar en modo real. El responsable es **uno por despliegue**: con UIS, SENA y UNAD en el
mismo despliegue, el aviso nombra a quien Christiam defina como responsable único; si cada institución es responsable
de sus datos, hace falta un aviso por institución (decisión pendiente, no la toma el cliente).

## Pruebas del cliente que dependen de este contrato
- Mock: `POST /auth/consentimiento` (200, idempotente, 422 de versión) y `consent_version` en `/auth/me`.
- E2E (`tests/e2e/login_piloto.test.mjs`, G): primer ingreso, "No acepto", versión vieja, configuración incompleta,
  lectura desde perfil y desde la entrada.
- Tramposos: `x_entra_sin_consentimiento` y `x_consentimiento_solo_local`.
