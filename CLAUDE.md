# engrama-web — CLAUDE.md

Cliente de ENGRAMA. **Estado: en construcción** — MVP para la UIS (Lingo Coins
sobre `engrama-backend`), especificado en `docs/ESPEC_mvp_uis.md` (preregistro,
commiteado antes del código). El sistema de gestión del proyecto vive en `..\..\CLAUDE.md`.

## Stack decidido (009, `docs/ESPEC_mvp_uis.md` §6)

**Se descarta Next.js.** El stack real: JavaScript ESM moderno, **sin build**,
`// @ts-check` + JSDoc, **sin paquetes npm** (hoy: `package.json` con
`"dependencies": {}`). `ARQUITECTURA.md` §4.1 y este archivo quedaban fijados en
Next.js 14 + TS + Tailwind + shadcn + Zustand + TanStack + supabase-js; esa
decisión está **superada** (nota en `ARQUITECTURA.md` §4.1). Razones completas
en la espec §6.1: PWA sin red, un solo cliente para EVAGAME, npm no autorizado
hoy, lo mantiene una persona que es profe, supabase-js no hace falta (GoTrue es
REST).

| Pieza | Elección |
|---|---|
| Vistas | `h(tag, attrs, ...hijos)` con `textContent`. Prohibidos `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function` |
| Estilos | solo `var(--token)` de `tokens.css` o `color-mix()` con `transparent`/`white`/`black` |
| Rutas | hash (`#/inicio`, `#/retos/:id`…) |
| Estado | `src/estado.js`: publicar/suscribir, sin librería |
| Sin red | `sw.js` a mano; GET de la API con red primero y caché de respaldo; nunca cachea un POST ni `/teachers` ni `/admin` |
| Servidor de desarrollo | `herramientas/servidor_dev.mjs` (`node:http`): estáticos + proxy `/api/*` → `ENGRAMA_API_URL`, mismo origen |
| Tests | `node:test`; E2E por CDP (`herramientas/cdp.mjs`, Edge o Chrome headless) |
| Análisis estático | `herramientas/verificar.mjs`: colores fuera de tokens, DOM prohibido, acceso directo a la base, tamaño de archivo/función |

Paquetes de desarrollo (Playwright, axe, TypeScript) y el QR de Nayuki solo
**después** del sí de Christiam (§6.3 de la espec); ninguna dependencia de
ejecución por npm.

## Reglas del cliente (§7.2 de la espec)

1. Toda llamada pasa por `src/api/cliente.js`: ruta `/api/...`, `Authorization:
   Bearer`, `X-Tenant-ID`, errores traducidos a mensajes. Ningún módulo llama
   `fetch` fuera de `cliente.js` y `auth/supabase_rest.js`.
2. **Nada de acceso a la base:** ni `/rest/v1`, ni PostgREST, ni `service_role`,
   ni `postgres://` (decisión 005). El único origen externo permitido es
   Supabase Auth (`/auth/v1/*`), y solo en el hito 3.
3. **La clave nunca se muestra antes de responder.** `api/retos.js` descarta
   `correct_answer`/`clave`/`aceptadas`/`explicacion`/`explanation` si llegan
   antes de tiempo y registra `fuga_de_clave`.
4. Opción múltiple: se envía la `label` ("A", "B"…), nunca el `value`.
5. Una sola acción por toque: todo botón que escribe queda bloqueado mientras
   su petición vuela.
6. Cadenas en `src/textos.js`, en español. Drako **presenta y nunca califica**
   (010): no aparece dentro del bloque de resultado individual.

## Auth detrás de una interfaz (§7.4)

`src/auth/interfaz.js` define el contrato; tres implementaciones
(`mock.js`, `perfil_actual.js`, `supabase_rest.js`) elegidas por
`ENGRAMA_AUTH` en la configuración de despliegue, nunca un secreto.

## Referencia visual

Los tokens salen de `..\..\diseno\tokens.json` (decisión 001, Navy Real, claro
por defecto); se copian a `publico/diseno/tokens.css` y deben ser idénticos
byte a byte (R1, criterio de regresión). Drako sale de
`..\..\diseno\personajes\drako\*.svg`. Del MVP (`..\coins-mvp\student.html`) se
porta el **comportamiento** de Lingo Coins (asistencia, retos, monedas, racha,
panel del profe) con los arreglos de la auditoría UX
(`..\..\investigacion\diseno\03-auditoria-ux-engrama.md`) fijados en la espec
§5; su paleta oscura y sus fallas (clave en el cliente, monedas al azar, sin
explicación) **no** se portan. `coins-mvp/` es solo lectura (004, dormido).

## Plan de encargos y alcance de esta tanda

`docs/ESPEC_mvp_uis.md` §11 tiene el plan completo (W0-W24) y §12 los hitos
(H0 demo clicable, H1 backend local, H2 reglas completas de Lingo, H3 piloto).
Esta tanda cubre los encargos que no necesitan npm ni cambios de F4, en orden,
hasta donde llegue H0. El encargo para F4 vive en `docs/ENCARGO_F4_lingo.md`.
