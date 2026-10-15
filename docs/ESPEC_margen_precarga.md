# ESPEC · Margen de la precarga: las pantallas del profe y del admin salen del shell

Preregistro (2026-10-14), commiteado antes del código. Rama `web/margen-precarga` desde `396e083`.

## 0. Por qué

U59 (`tests/unit/sw_peso.test.mjs`) topa la precarga del shell en 830.000 bytes servidos. Medido en `396e083` con
`node herramientas/peso_servido.mjs HEAD`: **829.960 bytes, margen 40**. Con 40 bytes no entra ninguna tanda más (racha, entrada con marca).
El techo NO se sube.

Qué descarto: quitar comentarios del shell. `ENGRAMA/CLAUDE.md` regla 3 ("código comentado didáctico") y `REGLAS.md` §4 ("se preservan los
existentes") lo prohíben: no se quita ninguno.

## 1. Qué cambia (UNA cosa)

Las 10 pantallas del profe y del admin, con lo que solo ellas importan, dejan de ser imports estáticos de `src/app.js` y pasan a `DIFERIDOS` de
`sw.js` (se cargan con `import()` y se guardan al activar, como `reto_l1.js`). Son 16 módulos, **91.513 bytes LF**:

| Módulo | Bytes LF |
|---|---|
| vistas/profe/grupos, grupo, sesion_asistencia, inscripcion, logro, errores, retos | 5.305 · 5.632 · 11.299 · 5.660 · 5.572 · 4.212 · 6.964 |
| vistas/profe/inscripcion_codigo, inscripcion_pendientes, inscripcion_red, herramientas_clase | 10.956 · 8.140 · 2.122 · 3.618 |
| vistas/admin/crear_grupo, asignar_docente, importar_csv | 5.736 · 3.588 · 6.204 |
| api/profe, api/admin | 5.140 · 1.365 |

(Lista sacada del grafo de imports estáticos: lo alcanzable desde `app.js` con esas 10 vistas y sin ellas. Todo lo demás que usan, `ui/`,
`api/cliente.js`, `textos.js`…, lo usa también el estudiante y se queda en PRECARGA.)

Piezas:
- `src/vistas/panel_docente.js` (nuevo, DIFERIDO): reexporta los `render*` de las 10 pantallas y `olvidarAsistencias`. Un solo `import()`.
- `src/panel_diferido.js` (nuevo, PRECARGA, pequeño): `crearPanelDiferido(importar)` carga el panel una sola vez y envuelve el render de cada
  ruta del panel.
- `src/app.js`: las 10 rutas pasan por `panel.vista(...)`; al entrar con sesión, si el rol NO es `student`, pide el panel en segundo plano.
- `sw.js`: los 16 + `panel_docente.js` salen de PRECARGA y entran a DIFERIDOS; `VERSION` → `engrama-shell-v61`.

Esperado: PRECARGA ≈ 829.960 − 91.513 + lo que suman `panel_diferido.js` y `app.js` (≈ 3-4 KB) → **margen ≥ 85.000** (meta del encargo:
≥ 8.000). Se mide con `peso_servido.mjs HEAD` y U59.

## 2. Por qué no cambia ninguna conducta visible

1. **El estudiante** nunca pinta una pantalla del panel: la guardia de rutas (`redireccionPara`) lo saca ANTES de pintar. No las necesitaba;
   ahora tampoco las descarga.
2. **Profe y admin**: al entrar con sesión, `app.js` pide el panel en segundo plano. Las pantallas quedan en memoria como antes; moverse SIN
   red dentro de la sesión (E10 `sin_red_profe_admin`, E34 `nav_sin_red`) es idéntico. La primera pantalla del rol espera esa misma carga.
3. **Ya cargado, el render es el de antes**: se llama en el mismo turno, justo después del token (sin un `await` de más).
4. **Recargar sin red**: `config.json` nunca se guarda (H-6), así que sin red la app se queda en "Sin conexión" antes de saber quién entró;
   ni antes ni ahora se llega a una pantalla del panel. El service worker igual guarda los DIFERIDOS al activar (el panel abre de la caché).
5. **`olvidarAsistencias`** (W66, al cerrar la cuenta y al cambiar de institución): la memoria vive en `sesion_asistencia.js`; si el panel no
   se cargó, no hay nada que olvidar. `app.js` conserva su `olvidarAsistencias()` local (U64 lo lee).
6. **Si el panel no carga** (caso que antes no existía: sin él la app entera no abría): la ruta dice "Sin conexión." con la barra de su rol
   (`data-testid="panel-sin-red"`), nunca en blanco. El siguiente intento vuelve a pedirlo.
7. **Si se cambia de ruta mientras carga**, la pantalla vieja no se pinta encima de la nueva.

## 3. Cómo sabremos que FALLÓ (lo que se pone rojo)

| Prueba | Qué vigila | Tramposo (por nombre) |
|---|---|---|
| U59, tercera (`sw_peso`) | todo `import()` de src/ y lo que un diferido importa está en PRECARGA o DIFERIDOS | `x_panel_suelto` (sw.js sin `/src/api/profe.js` en DIFERIDOS) |
| `sw_precarga`, primera | lo que app.js importa estático está en PRECARGA | (existente; si alguien vuelve a importar una vista estática) |
| `panel_diferido` (unit, nuevo) | una sola importación; reintento tras fallo; ya cargado pinta sin esperar; no pinta si cambió la dirección; si falla, "Sin conexión." con barra | `x_panel_pinta_encima`, `x_panel_falla_en_blanco` |
| `panel_diferido` (E2E, nuevo) | (a) el estudiante recorre sus pestañas y no pide NINGÚN módulo del panel; (b) el profe, recargado en `#/perfil`, ya pidió el panel sin abrir una pantalla suya, y sin red llega a Mis grupos y a la asistencia | `x_panel_para_el_estudiante` (a), `x_panel_sin_adelanto` (b) |

Regresión = identidad (deben dar idéntico):
- Fotos R4/R9: `tests/unit/regresion_vistas.test.mjs`, `tests/unit/regresion_nav.test.mjs` sin cambios en sus snapshots.
- `node herramientas/humo_navegacion.mjs --contra mock`: sha256 `909fb7b86c3f8c207f5d74c7a650f04669f56c34b5aab43f86ce3c88c39f9e0a` (medido
  en `396e083`). Réplica `--replica` (semilla 7, 360×640): `16106a57077e8387f48cfd32c9181d75c20b303b4a2c5b71eadf1cfe540757ee`.
- unit+contrato 756/756 hoy (más los nuevos); `verificar.mjs` sin violaciones; todos los E2E salvo `e2e_real`.

## 4. Qué NO se toca

`rutas.js`, `navegacion.js`, ningún archivo de `vistas/profe/` ni `vistas/admin/`, `textos*.js`, CSS, el techo (830.000) y el criterio de U59,
la estrategia del service worker (solo sus listas y `VERSION`), ningún comentario existente.

## 5. Tramposos que dependen de la lista (declarados)

- `x_precarga_engorda`: metía `sistema.css` (46.357) a PRECARGA; con ~88 KB de margen cabría y quedaría VERDE. Pasa a meter `sistema.css` y
  las dos fuentes (110.621 bytes), justo lo que sw.js dice que no cabe. Mismo test esperado en rojo.
- Las 6 copias de `sw.js` se rehacen con `tests/tramposos/regenerar_x_sw.mjs`; las 9 copias de `src/app.js` con
  `node tests/tramposos/regenerar_por_mezcla.mjs src/app.js`. Cada una se confirma roja por nombre.

## 6. Humo y réplica

- Humo: `node herramientas/humo_navegacion.mjs --contra mock` escribe `salida/humo_navegacion.mock.json` (sha arriba); `peso_servido.mjs HEAD`
  escribe `salida/peso_servido.json` con el margen nuevo.
- Réplica: `--replica` (entradas nuevas: semilla 7, otra ventana), mismo sha que antes.

## 7. Provisional

El texto del respaldo ("Sin conexión.", `textos.auth.sinConexion`, que ya existe) es PROVISIONAL hasta que lo revisen Christiam y el pedagogo.
