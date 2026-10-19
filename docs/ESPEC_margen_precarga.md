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

---

## Adenda 1 · El respaldo del panel se recupera y dice qué hacer (2026-10-18)

Preregistro, commiteado antes del código. Rama `web/panel-se-recupera` desde `7b146c6`. Origen: hallazgos 1 y 2 de la compuerta previa
(`investigacion/diseno/24-compuerta-previa-web-7b146c6.md`).

### A1.0 Qué pasa hoy (medido en `7b146c6`, Edge headless, service worker al mando)

Guion temporal (`salida/creador_panel/explorar.mjs`): el profe entra, se borra el panel de la caché del service worker, se bloquea `*panel_docente.js*`
(en la pestaña y en el service worker), se recarga en `#/profe/grupos` → sale el respaldo. Se desbloquea, Perfil → Mis grupos:
- sigue el respaldo; `import('/src/vistas/panel_docente.js')` → "Failed to fetch dynamically imported module" **sin ninguna petición nueva**
  (Chromium guarda el fallo en el mapa de módulos del documento, por dirección); `import('…panel_docente.js?x=1')` → carga (11 exportaciones).
- El "el siguiente intento vuelve a pedirlo" de §2.6 y de `panel_diferido.js` es falso en el navegador; la prueba unit solo contaba llamadas a
  un import de mentira.
- Si lo que falla es un módulo que el panel importa (bloqueando `*vistas/profe/grupos.js*`), **tampoco `?x=1` carga**: el fallo de la dependencia
  queda guardado con SU dirección, y las importaciones relativas de `panel_docente.js?x=1` resuelven a la misma. Eso solo lo arregla recargar.
- Respaldo: "Sin conexión." a 16 px, sin título ni acción; a 1280 el texto en x=416 (columna de 480) y el panel en x=106 (columna de 1100).
  Fotos: `ENGRAMA/despliegue/salida/web_panel/antes/respaldo_{375,1280}.png`.

### A1.1 Qué cambia (UNA cosa: el respaldo del panel se recupera y lo dice), en dos commits

**(a) La pantalla de respaldo** (`src/panel_diferido.js`; textos en `src/textos_nav.js`, clave `panelSinCargar`; una regla en `estilos/componentes.css`):
título (`h1`), una línea de qué pasó y qué hacer (`role="status"`), botón **"Reintentar"** (primario, el de todo el panel) y, debajo, una línea de
último recurso con **"Recargar la página"** (`boton-secundario`, `location.reload()`), y la barra del rol. Sobrio: sin Drako ni `.juego`. A ≥ 900 px
`#vista` se ensancha a 1100 como las demás pantallas del panel (se suma `[data-testid="panel-sin-red"]` a la lista de `:has()` que ya existe dentro
del `@media` de escritorio; al hacerlo, V3 de `verificar.mjs` leyó `#vista:has([…panel-sin-red])` como la declaración `vista: has(… red)`, el color
con nombre: la regla usa la clase `.panel-sin-cargar` del mismo nodo, y el `data-testid` sigue igual). "Reintentar" bloquea su botón mientras vuela ("Reintentando…"); si carga y la dirección no cambió, pinta la pantalla
pedida en el mismo lugar, sin recargar; si vuelve a fallar, repinta el respaldo con "Todavía no se pudo abrir…" y devuelve el foco a "Reintentar".

**(b) El reintento pide una dirección nueva** (`src/panel_diferido.js`, `src/app.js`, `sw.js`):
- `crearPanelDiferido(importar)`: `importar(n)` recibe cuántas veces se pidió antes. El primero (`n = 0`) va a la dirección de siempre
  (`./vistas/panel_docente.js`, que U59 sigue viendo literal); cada reintento, a `./vistas/panel_docente.js?intento=N` (N = 1, 2…): una dirección que el
  mapa de módulos no tiene, así que el navegador la vuelve a pedir.
- **Service worker:** `DIFERIDOS` se guarda por dirección y `caches.match` compara la consulta, así que `?intento=N` no casaría con lo guardado y,
  con red, `cachePrimeroConRed` lo guardaría otra vez con su consulta (una entrada nueva por reintento). `cachePrimeroConRed` quita **solo** el
  parámetro `intento` antes de buscar, de pedir a la red y de guardar: el reintento se sirve de la caché sin red si el panel ya estaba guardado, y si
  no, se pide a la red la dirección de siempre y se guarda con ella (una sola entrada por módulo). Cualquier otra consulta queda como hoy.
  `VERSION` → `engrama-shell-v67` (cambia la estrategia; y como es caché-primero, sin subirla un celular con v65 seguiría con el `panel_diferido.js`
  viejo).
- **Los módulos que el panel importa** resuelven a su dirección de siempre (lo relativo ignora la consulta): no se duplican instancias de
  `textos.js`, `ui/*` ni `api/cliente.js`, y van al service worker y a su caché como hoy. Límite aceptado: si el fallo fue de una dependencia
  (A1.0, último punto), "Reintentar" no la recupera; para eso está "Recargar la página" y la línea que lo dice. No se arregla aquí (pediría cambiar
  las importaciones estáticas de las 16 piezas del panel o duplicar módulos compartidos).

### A1.2 Qué debe pasar (medible)

1. En el navegador real, con el service worker al mando y el panel fuera de su caché: bloqueado `*panel_docente.js*` sale el respaldo con título,
   línea, "Reintentar", "Recargar la página" y la barra; "Reintentar" aún bloqueado → sigue el respaldo con "Todavía…"; desbloqueado, "Reintentar"
   → `vista-profe-grupos` en ≤ 9 s **en el mismo documento** (una marca puesta en `window` antes sigue ahí).
2. Después, en todas las cachés: `/src/vistas/panel_docente.js` exactamente 1 vez y ninguna dirección con `intento=`.
3. Sin red, `fetch('/src/vistas/panel_docente.js?intento=99')` desde la página → 200 con el mismo cuerpo que lo guardado (lo sirve el service worker).
4. A 1280, el `h1` del respaldo empieza en la misma x que el `h1` de Mis grupos (± 1 px); el respaldo no desborda a 375 ni a 1280.
5. Sin cambios en lo que ya pasaba (§3): el estudiante no pide nada del panel; el profe lo pide por adelantado (`/src/vistas/panel_docente.js`, sin
   consulta) y se mueve sin red; ya cargado pinta en el mismo turno; no pinta encima si cambió la dirección.

### A1.3 Cómo sabremos que FALLÓ

| Prueba | Qué vigila | Tramposo (por nombre) |
|---|---|---|
| `panel_diferido` (unit), "el siguiente intento pide OTRA dirección" | `importar` recibe 0 y luego 1 (no 0 otra vez) | `x_panel_reintento_misma_url` (panel_diferido.js siempre pide `importar(0)`) |
| `panel_diferido` (unit), respaldo | título, línea, "Reintentar", "Recargar la página", barra; Reintentar repinta la pantalla pedida, bloquea su botón mientras vuela y si falla dice "Todavía…" | `x_panel_respaldo_sin_reintentar` (el respaldo de antes: solo "Sin conexión."); `x_panel_falla_en_blanco` (existente; el test cambia de nombre y su manifiesto se actualiza) |
| `panel_diferido` (unit), app.js | el reintento de app.js va a la MISMA ruta del literal, con `?intento=` | (lo cubre el E2E) |
| `sw_reintento` (unit, nuevo: sw.js de verdad en un `vm`) | `?intento=N` sin red se sirve de lo guardado sin ir a la red; con red pide y guarda la dirección sin `intento`; otra consulta no se toca | `x_sw_reintento_duplica` (sw.js sin quitar el parámetro) |
| `panel_reintento` (E2E, nuevo), A1.2.1-3 | Reintentar llega a Mis grupos sin recargar; una entrada en la caché; el reintento se sirve sin red | `x_panel_reintento_misma_url_e2e` (app.js de `7b146c6`: `importar` ignora el número y pide siempre la misma dirección) |
| `panel_reintento` (E2E), A1.2.4 | a 1280 el respaldo alineado con el panel | (lo pone rojo quitar la regla; sin tramposo propio) |

Regresión = identidad: R4/R9 sin cambios en sus fotos; `humo_navegacion --contra mock` sha `909fb7b8…` y réplica `16106a57…` (§3);
E2E `panel_diferido`, `sin_red_profe_admin`, `nav_sin_red`, `profe`, `admin` en verde; U59 en verde con el margen nuevo (`peso_servido.mjs HEAD`).

### A1.4 Qué NO se toca

`rutas.js`, `navegacion.js`, ninguna vista de `profe/` ni `admin/`, `panel_docente.js`, `textos.js` (lo nuevo va en `textos_nav.js`), el criterio de
U59, el techo, `/api` y `/config.json` en el service worker (siguen sin pasar por él), las listas `PRECARGA`/`DIFERIDOS`, `cara.css`.
Herramienta de prueba: `herramientas/cdp.mjs` gana `bloquear(patrones)` (pestaña + cada service worker adjunto), sin cambiar lo que ya hace.

### A1.5 Tramposos que dependen de lo que cambia (declarados)

Se rehacen y se confirman rojos por nombre, de a uno: las copias de `src/panel_diferido.js` (2), `src/textos_nav.js` (1), `estilos/componentes.css` (4)
y `src/app.js` (12) con `regenerar_por_mezcla.mjs`, y las de `sw.js` (7) con `regenerar_x_sw.mjs` (más la nueva). `x_panel_falla_en_blanco`: su copia
sigue siendo "la ruta queda en blanco si el panel no carga", sobre el archivo nuevo.

### A1.6 Humo y réplica

- Humo: `node herramientas/humo_navegacion.mjs --contra mock` (mismo sha) y `peso_servido.mjs HEAD` (escribe `salida/peso_servido.json`).
- Las capturas antes/después (375 y 1280) en `ENGRAMA/despliegue/salida/web_panel/{antes,despues}/`.
- Réplica: `--replica` (semilla 7, 360×640), mismo sha; el E2E corre el mismo guion a dos anchos (375 y 1280).

### A1.7 Provisional

Los textos nuevos (`textos_nav.js`, `panelSinCargar`) son PROVISIONALES hasta que los revisen Christiam y el pedagogo.
