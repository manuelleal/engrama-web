# ESPEC · La regla de la contraseña, explicada en el registro

Adenda corta (2026-10-20), commiteada antes del código. Rama `web/regla-clave` desde `d9dbf85`. Cierra el punto 9 de `despliegue/LEEME_piloto.md` §12.1
y lo que §14.14 deja pendiente para la web. NO se despliega antes del 22-oct.

## 0. Qué falla hoy (medido en `d9dbf85`, a 375 px)

La regla del backend (`engrama-backend/src/auth/politica_clave.py` + `CLAVE_MIN`/`CLAVE_MAX` de `auth/schemas.py`, desde `539a06a`): **10 caracteres o
más, 72 bytes o menos, al menos una letra y al menos un dígito `0`-`9` o un símbolo de `- _ . ! @ # $ % & * +`**; si no, 422 con la regla en español.

La web ya frena antes de enviar (adenda 17.8: `cumpleComposicion`, la línea de la regla junto al campo, el 422 sin `Value error, `), pero:

1. **La regla de arriba del campo está incompleta y debajo del campo**: no dice el máximo (72 bytes) y se lee DESPUÉS de escribir.
2. **Dice una cosa por vez y la primera que encuentra**: con `abcdef` dice solo "Usa al menos 10 caracteres." aunque también falte el número o el símbolo
   (la persona corrige el largo, vuelve a enviar y recién entonces se entera del resto).
3. **No dice nada mientras se escribe**: el mensaje solo sale al tocar "Crear mi cuenta".
4. **El 422 del backend sale con el texto del servidor** (otra redacción que la de la pantalla).

## 1. Qué cambia (tres cambios, un commit cada uno)

| # | Cambio | Dónde |
|---|---|---|
| C1 | La regla COMPLETA, entre la etiqueta y el campo (se lee antes de escribir): mínimo 10, máximo 72 bytes con la ñ y las tildes contando doble, una letra, y un número o un símbolo con su lista | `textos_anillo.js` (`registro.reglaContrasena`, PRECARGA: es la regla y debe verse siempre), `registro_campos.js` (orden) |
| C2 | **Qué falta, mientras se escribe**, en una línea de estado propia (`role="status"`) con ícono y texto: "Te falta: llegar a 10 caracteres, una letra y un número o un símbolo (…)." / "Cumple la regla."; y **el mismo texto** al tocar "Crear mi cuenta" (junto al campo, en vez de "Usa al menos 10 caracteres.") | módulo DIFERIDO nuevo `vistas/registro_regla.js` + `textos_clave.js` + `estilos/registro_regla.css`; `registro.js` lo conecta |
| C3 | El 422 del backend en la contraseña se traduce a ESE mismo mensaje (lo que falta de lo escrito; si localmente cumple —la regla del servidor se movió—, "El servidor no aceptó esa contraseña" + la regla completa). Nunca el texto del servidor | `registro.js` |

## 2. Decisiones

- **Una sola función** decide qué falta (`queFalta(clave)` en `registro_regla.js`): la usan la línea en vivo, el envío y el 422. Su veredicto "no falta nada"
  coincide con `validarRegistro(...)` (se prueba con un corpus fijo): no puede haber una contraseña que la línea aprueba y el envío rechaza.
- **Nada sale a ningún lado al escribir**: la línea se calcula en la página con el valor del campo; 0 peticiones, 0 líneas de consola, nada en un
  almacenamiento, y el texto de la línea no repite lo escrito.
- **Peso (U59, margen 75.468 bytes)**: la lógica en vivo, sus textos y su hoja son DIFERIDOS (`DIFERIDOS` de `sw.js`, `engrama-shell-v70`). El shell solo
  crece en la regla completa (texto de una línea) y el enchufe de `registro.js`. Si el módulo no carga, el formulario funciona como hoy (regla visible,
  mensajes de siempre al enviar, 422 con el texto del servidor): la línea en vivo es una mejora, no un requisito.
- Sin cuenta de caracteres en la línea ("te faltan 3"): cambiaría en cada tecla y un lector de pantalla la leería cada vez. El texto solo cambia cuando
  cambia QUÉ falta.
- Al volver a escribir, el error del envío de la contraseña se borra y manda la línea en vivo (para no dejar dos mensajes distintos a la vez). Al enviar con
  la contraseña mal, el mensaje va en el sitio del error (`role="alert"`) y la línea en vivo se vacía hasta la próxima tecla (no repite el mismo texto).
- Las tres cosas siguen la regla del sistema: ícono + texto (nunca solo color), tokens `--correcto` / `--incorrecto` y sus fondos, sin `innerHTML`, sin
  glifos de texto, textos en `textos*.js`.

## 3. Fuera de alcance (a "Después")

- La pantalla "Crea tu contraseña" del primer ingreso y el Perfil (`auth/clave.js`, `textos.clave`: "Usa al menos 10 caracteres.") tienen la misma regla
  (`POST /auth/contrasena` responde 422 `password_rejected`) y el mismo hueco; no son el registro.
- `LEEME_piloto.md` §12.1 punto 9 y §14.14 / §14.13 ("la app todavía dice…") quedan viejos al desplegar esto: es otro repo.

## 4. Cómo sabremos que FALLÓ

| Prueba | Qué vigila | Tramposo (por nombre) |
|---|---|---|
| `tests/unit/registro_regla.test.mjs` (nuevo) | `queFalta` dice cada carencia por separado y todas a la vez; coincide con `validarRegistro` en un corpus; el mensaje no repite lo escrito | `x_clave_dice_solo_el_largo` (módulo que vuelve a decir solo lo primero) |
| `vista_registro` (U17/U19) | la regla completa está ANTES del campo; la línea en vivo; el envío y el 422 dicen lo mismo; 0 peticiones, 0 consola, 0 almacén al escribir | `x_clave_mensaje_viejo` (registro.js sin la regla: "Usa al menos 10 caracteres."), `x_clave_422_texto_del_servidor`, `x_clave_en_vivo_escribe_en_consola` |
| `tests/e2e/registro.test.mjs` | a 375 px la regla completa y la línea caben, sin desbordar; escribir cambia la línea; enviar con una contraseña mala no sale | `x_clave_regla_debajo` (registro_campos.js con la regla otra vez debajo del campo) |
| `sw_peso` (U59), `sw_precarga` | el módulo y su hoja están en `DIFERIDOS`; el shell no pasa su techo | (los `x_diferido_suelto`, `x_precarga_engorda` de siempre, rehechos sobre `v70`) |

## 5. Adenda (2026-10-21) · correcciones de la compuerta 28 (`investigacion/diseno/28-compuerta-regla-clave.md`)

Tres correcciones, un commit cada una, cada una con su prueba y su tramposo (comprobado en rojo uno a uno). `sw.js` se queda en `engrama-shell-v70` (no se sube la versión; ver 5.4).

| # | Hallazgo | Corrección | Prueba / tramposo |
|---|---|---|---|
| K1 | [Media] Al enviar y en el 422 el error (`#contrasena-error`, `role="alert"`) salía como texto suelto, sin ícono y sin `--incorrecto`, aunque §2 promete ícono + texto en los tres usos | `marcar()` de `registro_campos.js` pinta el mensaje de la contraseña como ícono `equis` (decorativo, `aria-hidden`) + texto (`.error-texto`); `estilos/formularios.css` le pone `--incorrecto` y `--incorrecto-fondo`, en flex, solo cuando tiene algo. Es del shell (no del módulo diferido): el envío y el 422 sin el módulo también llevan ícono. El `textContent` del error sigue siendo exactamente el texto (el ícono no tiene texto) | `vista_registro` (el error del envío y el del 422 llevan ícono `equis` + el texto de siempre; vacío no lleva ícono; al volver a escribir se va entero); `registro.test.mjs` (a 375 px el error tiene fondo `--incorrecto-fondo`, color `--incorrecto` y un `svg`). Tramposo `x_clave_error_sin_icono` (`registro_campos.js` con el error de antes) |
| K2 | [Media] `.regla-viva:empty {display:none}`: la región `role="status"` entraba al árbol de accesibilidad en el mismo instante en que recibía su texto y algunos lectores no la anuncian | La región nunca sale del árbol: vacía es un bloque sin alto (margen y relleno en 0, sin `display:none`); con texto pasa a `flex`. `callarLinea` la vacía sin sacarla (ya lo hace: vacía y deja `data-estado=""`) | `registro.test.mjs` (en el navegador, vacía: `display` ≠ `none`, alto 0, aún en el árbol; escribe: `flex`; después de enviar mal, vuelve a alto 0 sin `none`). Tramposo `x_clave_linea_display_none` (`registro_regla.css` con `display:none` vacía) |
| K3 | [Nit] El mínimo se decía dos veces seguidas; "Máximo 72" sin unidad | Etiqueta `Crea una contraseña` (sin paréntesis). Regla: `Mínimo 10 caracteres. Máximo 72 bytes (la ñ y las letras con tilde cuentan doble). …` | `vista_registro` y `registro.test.mjs` (etiqueta exacta; la regla dice "Máximo 72 bytes"; el mínimo aparece UNA vez en la etiqueta+regla). Tramposo `x_clave_minimo_repetido` (`textos_anillo.js` con el paréntesis de antes) |

- 5.4 `sw.js` y la precarga: K1 y K3 cambian archivos del shell (`registro_campos.js`, `textos_anillo.js`, `formularios.css`), que ya están en la precarga; K2 cambia un diferido. Por orden del encargo la versión de la caché se queda en `v70` (las copias de `sw` de los tramposos no cambian); **se avisa**: un navegador que ya cacheó `v70` no ve estos cambios hasta que la versión suba, lo que se decide al desplegar.
- Los nits 4 (la unidad "bytes") y 3 entran en K3. Quedan fuera (a "Después"): el nit 5 (la lista de símbolos sale dos veces mientras se escribe) y el 6 (las fotos a 1280 se hacen ahora, al cerrar).
