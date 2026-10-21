# ESPEC · El aviso de tratamiento de datos, versión `2026-10-v2` (ERR-16, Ley 1581)

Último bloqueo legal antes de abrir ENGRAMA a aprendices del SENA y estudiantes de la UIS (mayores de edad)
(`../../despliegue/LEEME_piloto.md` §8 y §12.1 punto 9). Encargo de Christiam (2026-10-20): *"solo decirle que sus datos
serán anonimizados y se utilizarán para medir la función de la plataforma; es un ejercicio educativo"*.

## Objetivo
Un aviso CORTO, veraz y en voz de la plataforma que diga lo que Christiam pidió y lo mínimo de la ley: responsable y
contacto, qué datos, para qué, quién los ve, cuánto tiempo, derechos y que es voluntario.

## La regla de veracidad (la que decide el texto)
La app **sí guarda nombre y correo** (los necesita para funcionar). Lo anonimizado es **el análisis para medir** la
plataforma. El aviso nunca dice "no guardamos tu nombre/correo" ni "tus datos son anónimos" a secas. Tampoco promete lo
que el sistema no hace: el borrado **no es automático** (lo hace una persona al cerrar el ejercicio o cuando el
estudiante lo pide, vía "Mis solicitudes sobre mis datos") y el respaldo guarda una copia hasta 7 días más.

## Qué cambia
| Archivo | Cambio |
|---|---|
| `src/textos_aviso.js` (nuevo) | El bloque `textos.aviso`, movido desde `textos.js` (que pasaba de 400 líneas) y reescrito. Se esparce en `textos.js` como `...textosAviso`. |
| `src/vistas/aviso_datos.js` | `crearTextoAviso` pinta las secciones nuevas: medir (anonimizados), clase en vivo y examen de nivel, cuánto tiempo, es voluntario. Mismas tres formas de abrirlo (consentir, leer, dentro del registro). |
| `sw.js` | `engrama-shell-v71`; `textos_aviso.js` a la precarga. |
| `config.json` del despliegue | **No se toca en este repo.** `AVISO_VERSION: 2026-10-v2`, `AVISO_RESPONSABLE: Christiam Puentes` y `AVISO_CONTACTO` quedan preparados en `despliegue/aviso_v2/` (con el orden: el backend acepta `v2` ANTES que el cliente la pida). |

## El texto (secciones, en orden)
Intro (ejercicio educativo, mayores de 18, responsable) · Qué datos guardamos · Para qué los usamos · Para medir la
plataforma, anonimizados · Quién los ve · Lo que no hacemos (no se venden; los ven dos encargados: **Cloudflare**, la red
por la que pasa el tráfico, con servidores en EE. UU., y **Brevo**, que envía el correo de recuperar la contraseña) ·
Clase en vivo y Examen de nivel (SET tiene su propio aviso, con la IA de un tercero fuera de Colombia) · Cuánto tiempo
(mientras dure el ejercicio; copias cifradas fuera del servidor 14 días; copias propias del servidor hasta 7) · Registro
de conexiones (IP, hora, página sin consulta ni contraseña, 14 días, solo para abusos) · Es voluntario · Tus derechos +
contacto · Versión. El texto lo aprobó Christiam (2026-10-20); lo de los encargados, el registro y las copias lo dio el
arquitecto desde `despliegue/LEEME_piloto.md` §12.2.

## Pruebas
`tests/unit/aviso_texto.test.mjs` (6 pruebas) y sus tramposos:
- `x_aviso_sin_medicion`: el texto deja de decir que se anonimiza para medir.
- `x_aviso_oculta_lo_que_guarda`: promete que no se guarda nombre ni correo (falso).
- `x_aviso_sin_plazos`: se pierden los plazos reales (14 y 7 días, registro de conexiones).
- `x_aviso_sin_encargados`: calla a Cloudflare y a Brevo.
- `x_aviso_no_dibuja_medir`: la vista no pinta las secciones nuevas.
Las fotos R4 (`entrada_aviso_leer`, `aviso_consentimiento`) y R9 (`aviso_leer`) declaran que cambia SOLO `aviso-texto`.

## Pendiente / fuera de alcance
- Revisión de un abogado (el texto es un aviso claro, no un concepto jurídico).
- Plazo de retención: hoy es "mientras dure el ejercicio"; Christiam decide la fecha de cierre.
- El análisis anonimizado como exportación: no existe todavía; se arma antes de medir.

---

## Adenda 2026-10-20 (noche): correcciones de la auditoría independiente (NO LISTO → corregir)

La auditoría dijo que el texto afirmaba cosas que el **servidor de la casa** (https://engramaingles.com) no hace hoy. Regla:
el texto dice SOLO lo que hoy es cierto allí. Versión del texto: se mantiene `2026-10-v2` (el texto aún no se ha
publicado a nadie).

| Hallazgo | Corrección | Tramposo (`tests/tramposos/`) |
|---|---|---|
| H-1 (bloquea) copias de seguridad | `cuanto` dice lo que corre hoy: servicio `respaldo`, en el mismo servidor, sin cifrar, 7 días. Se quita "cifradas y fuera del servidor" y los 14 días de copias. | `x_aviso_copias_cifradas_fuera` |
| H-2 registro de conexiones | Se mantiene (Caddy con `registro`, `client_ip` real detrás del túnel, 14 días; la poda diaria se instala esta noche). Se agrega que el servicio de inicio de sesión (GoTrue) guarda la IP de tus ingresos mientras dure tu cuenta (H-7); también en la lista "Qué datos guardamos". | `x_aviso_sin_ip_de_ingresos` |
| H-3 Brevo | En condicional y veraz: "Brevo (el servicio de correo con el que te enviamos el enlace si pides recuperar tu contraseña; ve tu correo)". | `x_aviso_brevo_sin_condicional` |
| H-4 versión del texto | `textos_aviso.js` exporta `VERSION_TEXTO = '2026-10-v2'`. Si `config.AVISO_VERSION` no coincide, `renderConsentimiento` NO ofrece la casilla: hace `location.reload()` UNA sola vez (marca en `sessionStorage`, con try/catch; si el almacenamiento falla, no recarga: sin bucle) y, si tras recargar sigue sin coincidir, muestra "hay una actualización pendiente" con salida. Sin casilla no se acepta un texto que no es el de la versión. | `x_aviso_version_sin_guardia`, `x_aviso_recarga_en_bucle` |
| H-5 Ley 1581 | "Tus derechos" completos (art. 8: conocer, actualizar, rectificar, prueba de la autorización, ser informado del uso, revocar y pedir supresión, quejas ante la SIC); gratis; consultas 10 días hábiles y reclamos 15 (art. 14). Responsable (de `config.json`): "Christiam Puentes (creador de ENGRAMA), con la institución de tu curso". "Es voluntario" pasa a "Aceptar es tu decisión. Sin esta autorización no podemos darte una cuenta en ENGRAMA; si no aceptas, habla con tu docente." Retención: "mientras dure el ejercicio educativo de tu curso, y como máximo hasta el 31 de diciembre de 2027". | `x_aviso_derechos_incompletos` |

**Efectos colaterales (y cómo se tratan).** (1) El límite de palabras de `aviso_texto.test.mjs` sube de 420 a 520: la Ley
1581 obliga a nombrar los derechos y los plazos; la nota queda en la prueba. (2) Las fixtures que fijaban `2026-10-v1`
(`CONFIG_PILOTO`, `AVISO_FIJO`, las instantáneas) pasan a `2026-10-v2`, porque con H-4 una configuración de otra versión ya
no muestra la casilla; la prueba G (cambio de versión) ahora parte de quien aceptó `v1` y la configuración vigente es `v2`.
(3) Las copias rotas `x_aviso_*` de `textos_aviso.js` se rehacen con `tests/tramposos/regenerar_x_aviso.mjs` (copia rota =
archivo bueno de hoy + su defecto). (4) Despliegue: el responsable cambia en `config.json` (`AVISO_RESPONSABLE`), no en el código;
`despliegue/aviso_v2/config_aviso.json` y `LEEME.md` quedan al día, con el paso previo "comprobar la poda del registro de
accesos en el cron" antes de publicar el cliente.

**Pruebas de la adenda.** `tests/unit/aviso_texto.test.mjs` (6, con el tope de 520 palabras; el aviso mide 513),
`tests/unit/aviso_version_texto.test.mjs` (7, H-4 con `recargar` inyectado y sessionStorage de mentira o roto) y
`tests/e2e/aviso_version_desfasada.test.mjs` (H-4 con `location.reload()` real en Edge: sin casilla, una recarga, sin bucle).

**Fuera de alcance (para después).** El cifrado de las copias fuera del servidor (cuando se active, el texto cambia y la
versión sube); revisión de un abogado; SET no se toca esta noche.
