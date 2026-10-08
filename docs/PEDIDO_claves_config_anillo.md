# Pedido al despliegue: claves de `config.json` para los enlaces a EVA y a SET

W38 de `docs/ESPEC_pantallas_anillo.md` · 2026-10-07. Este repo **no toca** `ENGRAMA/despliegue/` (ni su `config.json` ni su Caddyfile): esta es la lista de lo que el
despliegue tiene que poner. `config.json` se pide siempre a la red (`src/config.js`), nunca es un secreto y nunca se guarda en el service worker.

## Claves que la app YA lee

| Clave | Para qué | Valor | Sin ella |
|---|---|---|---|
| `ENGRAMA_AUTH` | modo de autenticación | `"supabase"` en el piloto (`mock` y `perfil_actual` son de desarrollo) | la app no arranca (H-6) |
| `AVISO_RESPONSABLE`, `AVISO_CONTACTO`, `AVISO_VERSION` | aviso de tratamiento de datos (Ley 1581) y el contacto de las pantallas de espera y suspendida | texto; la versión debe estar entre las que acepta el backend | con cuentas reales la app no continúa |
| `SET_URL` | dirección de SET (una para todas las instituciones) | `https://...` (o `http://localhost` / `http://127.0.0.1` solo en desarrollo), **sin** usuario, consulta ni fragmento; admite prefijo de ruta y barra final | no hay enlaces a SET (ni la tarjeta "Examen de nivel" ni "Calificar escritura") |
| `EVA_URL` | dirección de EVA para todas las instituciones | igual que `SET_URL` | no hay enlaces a EVA, salvo las instituciones que estén en el mapa de abajo |
| `EVA_URL_POR_INSTITUCION` | EVA es **de una institución por contenedor** (`EVA_TENANT_ID`): una dirección por institución | objeto `{"<uuid de la institución>": "<url>"}`; **gana** sobre `EVA_URL`; si la institución está en el mapa pero su dirección no es válida, no se cae a `EVA_URL` | esa institución usa `EVA_URL`, o no tiene enlaces |

Ejemplo (valores de mentira):

```json
{
  "ENGRAMA_AUTH": "supabase",
  "AVISO_RESPONSABLE": "...", "AVISO_CONTACTO": "...", "AVISO_VERSION": "...",
  "SET_URL": "https://set.ejemplo.edu.co",
  "EVA_URL": "https://eva.ejemplo.edu.co",
  "EVA_URL_POR_INSTITUCION": { "11111111-1111-4111-8111-111111111111": "https://eva-uis.ejemplo.edu.co/aula" }
}
```

## Lo que el despliegue tiene que garantizar a su lado
- **SET** acepta `#<CODIGO>&pase=...&tenant=...` y `#pase=...&tenant=...` (decisión 013); `engrama=` ya no se lee. Con `tenant=` mal formado responde 400, y sin él, 409 si la persona tiene más de una institución.
- **EVA** lee `pase=` (y `sala=`) del fragmento y lo borra de la barra antes de cualquier otra cosa; ignora `tenant=`.
- Los dos destinos están en `https` (el pase es el token de acceso y viaja en el fragmento); el pase de 1 hora completo pasa por EVA y SET en el piloto (C5 de la espec).
- Si EVA corre en el portátil del profe, una dirección fija en `config.json` no alcanza (C3 de la espec): hoy no hay forma de que la app la sepa.

## Registro con código de grupo (W31, ya lo lee la app)
- `REGISTRO_CON_CODIGO`: el booleano `true` (no la cadena `"true"`, no `1`) abre el registro con código de grupo. Sin ella, o con otro valor, el botón "Crear cuenta con código de grupo" de la entrada y el enlace
  `#/registro` llevan a "Todavía no está abierto", sin formulario y sin petición (el backend solo responde 503 DESPUÉS de validar los 7 campos, y no hay otra forma de saber si está encendido).
  Se pone en `true` solo cuando el backend del piloto tiene la clave de servicio (D7, aprobada el 2026-10-08): sin ella el backend responde 503 `registro_no_configurado`.
  Con `AVISO_VERSION` en `config.json` debe ir una versión que el backend acepte para el registro (si no, el 422 `aviso_version_no_permitida` dice "El aviso de datos cambió").
- Para el panel de inscripciones del profe (W32) la misma clave decide si el panel ofrece generar el código.

## Qué NO va en `config.json`
Ningún token, contraseña, clave de servicio ni el código de un grupo. Las bases no se toman nunca de la dirección de la página ni de un campo: solo de aquí.
