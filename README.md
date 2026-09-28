# Engrama — Web

> **Estado:** en construcción. MVP para la UIS: Lingo Coins (el MVP viejo, hoy
> dormido) portado sobre `engrama-backend`. Espec commiteada:
> [`docs/ESPEC_mvp_uis.md`](docs/ESPEC_mvp_uis.md).

Engrama es una plataforma EdTech gamificada para aprender inglés. Este repo es
el **cliente web**: la app que ven el estudiante, el profe y el admin del
colegio, consumiendo la API de
[`engrama-backend`](https://github.com/manuelleal/engrama-backend).

Es la evolución de **Lingo Coins**, el MVP en JavaScript vanilla que corrió en
un salón real (~97 estudiantes, Universidad Industrial de Santander). Este
cliente porta su comportamiento probado — asistencia, retos, monedas, racha,
panel del profe — con los arreglos de la auditoría UX y sobre un backend nuevo.

---

## Stack: sin build, sin framework, sin npm

**Decisión 009** (`docs/ESPEC_mvp_uis.md` §6): se descartó Next.js. El stack
real es JavaScript ESM moderno, sin build, con `// @ts-check` + JSDoc para que
los tipos queden listos para `tsc` el día que haya permiso de npm.

| Pieza | Elección |
|---|---|
| Lenguaje | JS ESM + JSDoc, sin build |
| Vistas | ayudante `h(tag, attrs, ...hijos)` solo con `textContent` (nunca `innerHTML`) |
| Estilos | CSS propio con los tokens de `diseno/tokens.json` (decisión 001, Navy Real) |
| Rutas | hash (`#/inicio`, `#/retos/:id`…) |
| Estado | módulo propio de publicar/suscribir |
| PWA | `sw.js` a mano: el shell abre sin red tras la primera visita |
| Tests | `node:test` + E2E por CDP (Edge/Chrome headless), sin dependencias |

`package.json` existe con `"dependencies": {}`. Playwright, axe-core y
TypeScript entran como dependencias de **desarrollo** solo con el sí de
Christiam (§6.3 de la espec); el cliente en producción no descarga nada de
npm.

Por qué: pide una PWA que abra sin red (un service worker escrito a mano se
audita mejor que el plugin de Next.js), un solo cliente que luego sumará el
modo en vivo de EVAGAME (ya ESM puro), npm no está autorizado hoy, y lo
mantiene una persona que es profe — sin build, lo que está en disco es lo que
corre.

---

## Cómo se relaciona con el backend

- Todo pasa por `/api/...` en el mismo origen (el servidor de desarrollo hace
  de proxy; en producción, un reverse proxy). **Nunca** hay CORS ni acceso
  directo a la base (`/rest/v1`, `service_role`): decisión 005.
- La auth vive detrás de una interfaz (`src/auth/interfaz.js`) con tres
  implementaciones: `mock` (hitos 0-1, sin backend), `perfil_actual` (contra
  `/auth/me` de hoy) y `supabase_rest` (login real, hito 3).
- El backend estable montado hoy: `/admin`, `/auth`, `/challenges`, `/core`,
  `/teachers`. Lo que falta lo pide `docs/ENCARGO_F4_lingo.md`.

---

## Estructura

```
engrama-web/
  index.html  manifest.webmanifest  sw.js
  estilos/{base,componentes}.css
  publico/diseno/{tokens.css, drako/*.svg}   # copias idénticas de diseno/ (R1)
  src/app.js  src/rutas.js  src/estado.js  src/textos.js
  src/api/{cliente,auth,retos,core,profe,admin}.js
  src/auth/{interfaz,mock,perfil_actual,supabase_rest}.js
  src/ui/{dom,retro,sonido,drako,escudo,red}.js
  src/vistas/{estudiante,profe,admin}/...
  herramientas/{servidor_dev,mock_api,sembrar_retos,sincronizar_diseno,humo,cdp,verificar}.mjs
  tests/{unit,e2e}/  tests/tramposos/<nombre>/  tests/correr_tramposos.mjs
  contratos/openapi_<sha-backend>.json         # copia de solo lectura (R2)
```

---

## Desarrollo local

```bash
node herramientas/servidor_dev.mjs   # estáticos + proxy /api → ENGRAMA_API_URL (o mock)
node --test                          # tests unitarios y de contrato
node tests/correr_tramposos.mjs      # cada tramposo debe salir en rojo
node herramientas/verificar.mjs      # análisis estático (tokens, DOM prohibido, tamaños)
node herramientas/humo.mjs --contra mock   # humo de sintéticos, escribe salida/humo_mvp_uis.mock.json
```

Detalle completo de cada comando y del guion del humo en `docs/ESPEC_mvp_uis.md` §9.

---

## Qué no se toca desde aquí

`engrama-backend` (solo lectura, salvo exportar su OpenAPI), `coins-mvp`
(dormido, decisión 004, solo lectura), `contenido/`, `diseno/` — ver
`docs/ESPEC_mvp_uis.md` §14.
