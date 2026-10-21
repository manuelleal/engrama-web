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
