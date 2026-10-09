# ESPEC · engrama-web: moverse por la app sin perderse (navegación)

Creador · 2026-10-08 · **preregistro** (METODO regla 2): se commitea antes de cualquier código. **Este documento no trae código.** Pedido de Christiam tras probar el piloto a mano por primera vez: *"por ahora no es fácil moverse, es confuso"* (sin más detalle). Frente: **el anillo listo para la conferencia** (`TABLERO.md`, hacia el 2026-10-23, con el sistema en vivo). Continúa la numeración después de lo que reservó `docs/ESPEC_juego_oleada1.md` (W40-W60, U33-U59, V6, V7, R7, R8, E20-E28): aquí **W61+, U60+, V8+, R9+ y E29+**. Los tramposos llevan nombre (`x_<nombre>`).

Marcas: **[VISTO]** = lo miré en una captura del piloto (`http://127.0.0.1:8088`, web `4ff225f`), hecha hoy con `herramientas/cdp.mjs` · **[VISTO-GALERÍA]** = lo miré en una captura de `salida/galeria/` del 2026-10-06 (contra el mock, commit anterior; la vista no cambió desde entonces según `git log`) · **[LEÍDO]** = cotejado en el código de `661f12c` (`src/` idéntico a `4ff225f`: el commit de por medio es solo de documentos) · **[INFERIDO]** = deducido, sin ejecutar ni ver · **PROVISIONAL** = valor puesto para no frenar; lo confirma quien se indica en §13.

**Qué se ejecutó para escribir esto:** solo un recorrido de lectura del piloto (entrar con cuentas sintéticas y navegar; ninguna escritura: no se generó código de grupo, no se aprobó ni rechazó a nadie, no se abrió asistencia, no se abrió ningún reto porque abrirlo crea un intento, no se salió a EVA ni a SET con pase). No se corrió ninguna suite ni ningún tramposo (hay un implementador en el árbol). Las capturas están en `salida/navegacion/` (81 archivos; `salida/` está en `.gitignore`: no son versionables) con un índice de medidas por flujo (`indice-<flujo>.json`: título, enlaces y botones visibles con su posición, alto y tamaño de letra).

---

## 1. Problema
Christiam no pudo moverse con facilidad y en unos 15 días muestra la app en vivo. El recorrido encontró por qué: **el profe no tiene navegación** (hay pantallas de las que solo se sale con el botón atrás del navegador, y una de ellas es justo la de la asistencia abierta), **el estudiante tiene dos navegaciones a la vez y cuatro formas distintas de "volver"**, **las dos pantallas de inicio no dicen qué hacer primero**, y **la misma palabra nombra dos cosas** ("Cerrar sesión" cierra la cuenta en un botón y la asistencia en otro).
Lo que puede fallar al arreglarlo: que la barra nueva tape contenido en 375 px; que al poder salir de la asistencia abierta el profe pierda el código de la pantalla; que mover "Cerrar sesión" rompa las pruebas que lo tocan o deje a alguien sin salida en un equipo compartido; que el profe reciba animación de juego; que el criterio se acomode a lo que salga.

## 2. Qué cambia (una cosa)
**Toda pantalla con sesión dice dónde estoy, ofrece una sola forma de volver y deja el inicio de mi rol a un toque; y cada inicio pone primero lo que se hace en cada clase.** Son 9 cambios chicos de navegación (§5), no un rediseño: no cambia ninguna llamada de escritura, ningún contrato, ningún color ni el arte. Cada encargo de §11 es un commit con un solo cambio.

## 3. Medido

### 3.1 Commits y estado del árbol
| Repo | Rama | Commit | Árbol al leer |
|---|---|---|---|
| `ENGRAMA/engrama-web` | `main` | `661f12c` (docs sobre `4ff225f`) | Limpio al empezar. Al terminar: `estilos/formularios.css`, `src/api/registro.js`, `src/textos_anillo.js`, `src/vistas/registro.js` y `src/vistas/registro_campos.js` modificados por el implementador del registro (no los tocó este encargo). Nada de lo citado aquí sale de esos archivos, salvo los textos de `textos_anillo.js`, que se leyeron del árbol durante el recorrido y pueden diferir en lo que el implementador haya tocado (los de `registro`) |
| Piloto | — | web `4ff225f`; `config.json` en modo `supabase`, registro abierto, `SET_URL` y EVA para una institución | `/api/health` respondió `ok` durante todo el recorrido |

### 3.2 El mapa de hoy, por rol
"Toques" = enlaces o botones que hay que tocar desde el inicio del rol, sin contar lo que se escribe. "(+desplazar)" = el control queda fuera de la ventana de 375×812.

**Estudiante** (inicio: `#/inicio`). Barra de abajo: Inicio · Retos · Asistencia (`src/ui/nav_inferior.js:19-25`).

| Pantalla (título que se ve) | Cómo se llega | Toques | Barra | Cómo se vuelve | Marca |
|---|---|---|---|---|---|
| Inicio ("Hola, <nombre>") | al entrar | 0 | sí | — | VISTO `e01` |
| Retos | barra, o fila de enlaces al final de Inicio | 1 | sí | barra | VISTO `e02` |
| Reto en curso (título del reto) | "Jugar" en Inicio o en Retos | 1 a 2 | **no** | **ninguna** (ni barra, ni enlace, ni X) | LEÍDO `reto_flujo.js:99-112`; VISTO-GALERÍA `31` |
| Revisión | al terminar el reto | — | sí | "Volver a mis retos", al final de la lista | LEÍDO `revision.js:58-67` |
| Asistencia | barra, o fila del final de Inicio | 1 | sí | barra | VISTO `e03` |
| Clase en vivo | tarjeta de Inicio, botón "Abrir" | 1 | **no** | "Volver al inicio", debajo del formulario | VISTO `e07` |
| Examen de nivel | tarjeta de Inicio, botón "Abrir" (tapado por la barra) | 1 (+desplazar) | **no** | "Volver al inicio" | VISTO `e08`, `e01` |
| "Cambia tu contraseña" (es `#/perfil`) | "Tu perfil", al final de Inicio | 1 (+desplazar) | **no** | "Volver a Inicio", a media pantalla | VISTO `e04` |
| Tratamiento de tus datos | Perfil | 2 | **no** | botón "Volver" al final (lleva a Perfil) | VISTO `e05` |
| Mis datos: solicitudes | Perfil, o el aviso | 2 a 3 | **no** | **ninguna** | VISTO `e06` |
| Cerrar sesión | al final de Inicio, o en Perfil | 1 (+desplazar) | — | — | VISTO `e01-completa` |
| EVA (clase) y SET (examen) | desde Clase en vivo / Examen de nivel | 2 | otro sitio | "usa el botón atrás" | no verificado con pase (§16) |

**Profe** (inicio: `#/profe/grupos`). Sin barra de abajo. Arriba, solo en su inicio: "Tratamiento de tus datos" y "Cerrar sesión" (`src/ui/barra_rol.js:13-20`).

| Pantalla | Cómo se llega | Toques | Cómo se vuelve | Marca |
|---|---|---|---|---|
| Mis grupos | al entrar | 0 | — | VISTO `p01` |
| Retos (del profe) | chip "Retos" bajo el título | 1 | **ninguna** | VISTO `p07` |
| Grupo <código> | "Abrir" en la fila del grupo | 1 | **ninguna** | VISTO `p02` |
| Sesión de asistencia (formulario) | Grupo → "Abrir sesión de asistencia" | 2 | "Volver al grupo" | VISTO `p03` |
| Asistencia abierta (el código en grande) | + "Abrir sesión" | 3 | **ninguna**; el único botón dice "Cerrar sesión" | LEÍDO `sesion_asistencia.js:93`; VISTO-GALERÍA `05` |
| Inscripciones del grupo <código> | Grupo → cuarto chip | 2 | "Volver al grupo" | VISTO `p04` |
| Logro por eje | Grupo → chip | 2 | "Volver al grupo" | VISTO `p05` |
| Errores por ítem | Grupo → chip | 2 | "Volver al grupo" | VISTO `p06` |
| Tratamiento de tus datos | barra de arriba | 1 | "Volver" (a Mis grupos) | VISTO `p08` |
| Mis datos: solicitudes | desde el aviso | 2 | **ninguna** | VISTO `p09` |
| EVA (tablero, Escamas) y SET (calificar) | "Herramientas de clase" en Mis grupos | 1 | "usa el botón atrás" | no verificado con pase |

**Admin** (inicio: `#/admin`, titulado "Grupos"): Asignar docente (1 toque, "Volver a Grupos"), Importar estudiantes (1, "Volver a Grupos"), aviso (1), solicitudes (2, sin salida). VISTO `m01`-`m03`.

**Sin sesión:** Entrada → "Crear cuenta con código de grupo" (1; el formulario mide 1405 px y su única salida, "Volver a entrar", está al final, a 1339 px) → aviso de datos (1; "Volver" al final). VISTO `a01`-`a03`. Las pantallas obligatorias (crear contraseña, aceptar el aviso, esperando al profe, solicitud que ya no está, suspendida, sin inscribir) apagan el router y traen sus propias salidas [LEÍDO `app.js:257-271`, `esperando.js:50-60`]; hoy no se vieron en el piloto (verlas exige crear una cuenta).

### 3.3 Los pasos de la demostración, en toques (guion de `despliegue/salida/DEMO_USUARIOS.md`)
| Paso | Quién | Hoy | Marca |
|---|---|---|---|
| 1 · generar el código | profe | 3: "Abrir" → "Inscripciones del grupo" → "Generar código" | VISTO `p01`, `p02`, `p04` |
| 4 · aprobar | profe | 1 si sigue en Inscripciones; 3 desde Mis grupos | VISTO |
| 6 · abrir asistencia | profe | 3 desde Inscripciones: "Volver al grupo" → "Abrir sesión de asistencia" → "Abrir sesión" | VISTO `p03` |
| 6 · marcar | estudiante | 2: barra "Asistencia" → "Marcar asistencia" | VISTO `e03` |
| 7 · jugar | estudiante | 1 desde Inicio | VISTO `e01` |
| 8 · abrir el tablero **viniendo de la asistencia abierta** | profe | **no hay camino en pantalla**: botón atrás del navegador dos veces, luego "Abrir el tablero de la clase" | LEÍDO + VISTO-GALERÍA |
| 8 · entrar a la clase | estudiante | 2: "Abrir" → "Entrar a la clase" | VISTO `e07` |
| 9 · examen de nivel | estudiante | 2, pero el "Abrir" del examen está en y≈818 de 812 y bajo la barra (que empieza en y=751): hay que desplazar | VISTO `e01` |

### 3.4 Hallazgos, ordenados por cuánto estorban en la demostración
Capturas en `salida/navegacion/`; las de la galería, en `salida/galeria/`.

| # | Hallazgo | Captura | Código | Por qué confunde |
|---|---|---|---|---|
| H1 | **La asistencia abierta es un callejón, y su botón se llama igual que salir de la cuenta.** Al abrir, la pantalla se repinta sin "Volver al grupo"; queda un solo botón: "Cerrar sesión" | `galeria/05-profe-sesion-asistencia-375.png` [VISTO-GALERÍA] | `src/vistas/profe/sesion_asistencia.js:93`; `src/textos.js:277` frente a `:69` | En vivo, el profe tiene que ir de ahí a "Mis grupos" (paso 8) y no hay cómo; y "Cerrar sesión" parece que lo saca de la app |
| H2 | **El profe no tiene navegación.** "Grupo" no tiene vuelta a "Mis grupos", ni salida, ni marca; "Retos" del profe tampoco (y mide 24.318 px con 96 retos) | `p02-grupo-375.png`, `p02-grupo-1280.png`, `p07-retos-375.png` [VISTO] | `src/vistas/profe/grupo.js:49-64`; `src/vistas/profe/retos.js:101-107` | Solo se sale con el botón atrás del navegador. "Cerrar sesión" y el aviso existen solo en una pantalla |
| H3 | **El inicio del profe pone primero lo que saca de la app.** Los tres botones grandes y azules son las salidas a EVA y SET; el grupo es una fila con un "Abrir" chico y blanco, debajo. Lo primero de la pantalla es "Tratamiento de tus datos" | `p01-tras-entrar-375.png`, `p01-tras-entrar-1280.png` [VISTO] | `src/vistas/profe/grupos.js:25-32` | Lo de cada clase (asistencia, quién espera aprobación) queda a 2 o 3 toques, detrás de 4 chips iguales; "Inscripciones del grupo" es el cuarto y nada dice si alguien espera |
| H4 | **Inicio del estudiante no dice qué hacer ahora.** Tres tarjetas laten en oro a la vez; dos botones se llaman igual ("Abrir"); "Esta semana" con ceros va antes que la clase y el examen; el botón del examen queda bajo la barra | `e01-tras-entrar-375.png`, `e01-tras-entrar-375-completa.png` [VISTO] | `src/vistas/estudiante/inicio.js:239-253`, `:197-208`; `estilos/juego.css:785-803` | No hay una acción principal ni un orden; los botones no dicen a dónde llevan |
| H5 | **Dos navegaciones en Inicio.** Al final hay una segunda fila (Asistencia, Retos, Tu perfil, Cerrar sesión) que repite la barra y esconde lo único que la barra no tiene | `e01-tras-entrar-375-completa.png` [VISTO] | `inicio.js:221-233` | "Tu perfil" y "Cerrar sesión" están fuera de la ventana (y=871 y 925) |
| H6 | **Al salir de las tres pestañas, la barra desaparece, y "volver" es distinto cada vez:** "Volver al inicio" (chip, abajo), "Volver a Inicio" (chip, al medio), "Volver" (botón, al final), "Volver al grupo" (chip, arriba) y nada | `e04`, `e05`, `e07`, `e08`, `p03` [VISTO] | `salida_codigo.js:101`; `perfil.js:45`; `aviso_datos.js:104`; `sesion_asistencia.js:127` | Cuatro textos, tres posiciones, dos formas (enlace y botón) para la misma acción |
| H7 | **"Mis datos: solicitudes" no tiene salida** para ningún rol | `e06-solicitudes-375.png`, `p09-solicitudes-375.png` [VISTO] | `src/vistas/datos_solicitudes.js:105-106` (el "Volver" solo existe dentro del aviso obligatorio); `src/app.js:316` | Callejón |
| H8 | **El botón dice una cosa y la pantalla otra.** "Tu perfil" abre "Cambia tu contraseña"; la pestaña del navegador dice siempre "ENGRAMA"; "Logro por eje", "Errores por ítem" y "Sesión de asistencia" no dicen de qué grupo | `e04-perfil-375.png`, `p03`, `p05`, `p06` [VISTO] | `perfil.js:41`; `logro.js:78`; `errores.js:53`; `sesion_asistencia.js:126` | No sé dónde estoy; con dos grupos, no sé de cuál es la tabla |
| H9 | **Cualquier rol abre cualquier ruta.** El profe en `#/inicio` ve un Inicio de estudiante ("0 monedas", "No tienes retos pendientes") con la barra del estudiante; el estudiante en `#/profe/grupos` ve "Mis grupos · No tienes permiso." sin vuelta a su Inicio; una ruta que no existe deja la pantalla **en blanco** | `p10-inicio-de-estudiante-375.png`, `e10-ruta-de-profe-375.png`, `e09-ruta-inexistente-375.png` [VISTO] | `src/app.js:311-331` (sin filtro por rol); `src/rutas.js:57`, `:68` (`alNoEncontrar` existe y `app.js` no lo usa) | Un enlace pegado, un marcador o un dedo en la barra de direcciones dejan a la persona en una pantalla que no es suya o vacía |
| H10 | **El reto en curso no tiene salida** | `galeria/31-juego-pregunta-elegida-375.png` [VISTO-GALERÍA] | `src/vistas/estudiante/reto_flujo.js:99-112` | Quien entra por error solo puede terminar o usar el botón atrás |
| H11 | **Una palabra, varias cosas.** "Sesión": la cuenta y la asistencia. "Código": de la sesión (asistencia), de la sala, del examen, de tu grupo (inscripción) y "Código del grupo" del admin, que es el *nombre* del grupo. "Inicio" / "inicio". "Retos": la lista del estudiante y la de todo el colegio del profe. "Colegio" e "institución" | `e03`, `e07`, `e08`, `a02`, `m01`, `p07` [VISTO] | `textos.js:232`, `:266`, `:274`, `:277`, `:326`, `:354`; `textos_anillo.js` (`vivoCampo`, `nivelCampo`, `registro.etiquetaCodigo`) | El guion de la demostración nombra cuatro códigos distintos en diez pasos |
| H12 | **La instrucción para volver de EVA y SET casi no se lee** (gris, chica, en mayúsculas): "VAS A SALIR DE ENGRAMA CON TU CUENTA. PARA VOLVER, USA EL BOTÓN ATRÁS." Las portadas de EVA y de SET no ofrecen volver a ENGRAMA y parecen otro producto | `e07-vivo-375.png`, `p01`; `x01-eva-celular-sin-pase-375.png`, `x02-set-portada-sin-pase-375.png` [VISTO, portadas sin pase] | `salida_codigo.js:100`; `herramientas_clase.js:54`; `estilos/tipografia.css:33-37` | La única forma de volver es una frase que nadie lee |
| H13 | **Con dos instituciones, el selector queda tapado** por "Tratamiento de tus datos" a 375 px | `c01-tras-entrar-375.png` [VISTO] | `src/ui/barra_rol.js:19`; `estilos/componentes.css:494-500` | No se ve en qué institución estoy ni cómo cambiar |

**[INFERIDO], sin ver:** si el profe sale de la asistencia abierta y vuelve a esa ruta, ve otra vez el formulario vacío y el código ya no está en pantalla (`sesion_asistencia.js:117-131` pinta siempre el formulario; la asistencia sigue abierta en el servidor). Hoy casi no pasa porque no hay cómo salir; en cuanto haya barra, pasará. Por eso el cambio 2 va con el cambio 1.

### 3.5 Lo ya sabido, cotejado
- `investigacion/diseno/03-auditoria-ux-engrama.md` audita `coins-mvp`, no esta app. De ahí vale: "una tarea por pantalla" en el reto y una barra de abajo simple (§6 de la auditoría). Sus 10 fricciones ya se atendieron en `ESPEC_mvp_uis.md` §5; ninguna es de navegación.
- Decisión 001: modo estudiante "una tarea por pantalla"; correcto e incorrecto con ícono y texto. Decisión 010: Drako presenta y no califica. Nada de aquí las contradice: el reto en curso sigue sin barra.
- `docs/ESPEC_juego_oleada1.md` (pendiente, W40-W60) dice "la barra inferior no cambia (siguen sus 3 entradas)" (§4.3) y lista la barra y las vistas de `profe/` en "Qué NO se toca" (§8). **Esta espec cambia eso** (§12, choques declarados).

## 4. Reglas que esta espec hace cumplir
| Regla | Cómo se comprueba |
|---|---|
| Sin build ni npm; vistas con `h()`; textos en un archivo de textos | V1-V4 (existen); ningún paquete; V8 |
| Colores, fuentes y radios solo de tokens; claro por defecto | V3 (existe) sobre los estilos nuevos; ningún token nuevo |
| Dónde estoy se dice con **texto e ícono**, nunca solo con color | U60: la pestaña activa lleva `aria-current="page"` y su texto; E31 |
| Estudiante con animación; profe y admin sobrios | E33: en vistas de `profe/` y `admin/` la barra no anima; `ui_drako.test.mjs` sigue cubriendo `profe/` |
| "Reducir movimiento" | E33 |
| 375 px, toque de 44 px, nombre accesible | E31 |
| Una tarea por pantalla en el reto | U60: `#/retos/:id` es la única ruta con sesión sin barra |
| Privacidad en equipo compartido | "Cerrar sesión" sigue llamando a `ctx.salir()` (no cambia); E29 lo usa desde Perfil |

## 5. La propuesta: 9 cambios (antes → después)
Textos PROVISIONALES en §5.10. Ningún cambio agrega una llamada que escriba.

### 5.1 Cambio 1 · Ningún callejón en el panel del profe
- **Antes:** Grupo, Retos del profe y la asistencia abierta no tienen vuelta (H1, H2).
- **Después:** Grupo trae "‹ Mis grupos"; Retos del profe trae "‹ Mis grupos"; la asistencia abierta **conserva** "‹ Grupo <código>" al repintarse, también después de cerrarla. El enlace va arriba, antes del título, en las pantallas de carga, de error y de vacío por igual (hoy el error de Grupo no trae nada: `grupo.js:72-75`).

### 5.2 Cambio 2 · La asistencia abierta sigue ahí al volver
- **Antes:** salir de la ruta apaga el sondeo y, al volver, sale el formulario vacío.
- **Después:** mientras dure la carga de la página, la app recuerda **en memoria** (nunca en un almacenamiento) la asistencia que abrió para cada grupo. Al volver a `#/profe/grupo/:gid/sesion` con una abierta y sin vencer (`expires_at`), se pinta el código, el enlace y el conteo, y se reanuda el sondeo; no se ofrece abrir otra. Al cerrarla, al vencer, al cerrar la cuenta o al cambiar de institución, se olvida. Tras recargar la página (F5) se pierde: recuperarla de verdad pide un dato que el backend no da (§12.2).

### 5.3 Cambio 3 · Inicio del profe: primero los grupos, con lo de cada clase a la mano
- **Antes:** barra con el aviso y la salida → "Mis grupos" → chip "Retos" → "Herramientas de clase" (3 botones grandes) → la fila del grupo con "Abrir".
- **Después, en este orden:** título "Mis grupos" → (si tiene más de una institución) el selector, en su propio renglón → **una tarjeta por grupo** → "Herramientas de clase" → nada más.
- **La tarjeta del grupo:** código del grupo y "N estudiantes"; si hay solicitudes, "⏳ N esperan aprobación" (ícono y texto); y tres acciones, en este orden: **"Abrir asistencia"** (la principal; lleva al formulario de `#/profe/grupo/:gid/sesion`), **"Inscripciones"** y **"Ver el grupo"**.
- **El conteo de quienes esperan:** un `GET` de solicitudes por grupo, al pintar, **sin sondeo** y solo para los primeros 12 grupos (PROVISIONAL). Si esa lectura falla, la tarjeta sale sin conteo y la página no se rompe. Solo el número: ningún nombre en el inicio.
- **"Herramientas de clase"** baja al final; cada botón lleva "↗" (con `aria-hidden`) y el bloque, su nota de salida legible (cambio 7).

### 5.4 Cambio 4 · Inicio del estudiante: qué hago ahora, en orden
- **Antes:** saldo → saludo → escudo → reto de hoy → "Esta semana" → Clase en vivo → Examen de nivel → fila de enlaces repetidos. Las tres tarjetas laten en oro; dos botones "Abrir".
- **Después, en este orden:** saldo y constancia → saludo → escudo (y su aviso, si lo hay) → **"Ahora"**: (1) tu reto de hoy, botón "Jugar"; (2) Clase en vivo, botón "Ir a la clase"; (3) Examen de nivel, botón "Ir al examen" → "Esta semana".
- **Solo la primera tarjeta de "Ahora" late en oro** (hoy, las tres). Si no hay reto pendiente, la primera es la que siga.
- El botón de cada tarjeta va a la derecha, como "Jugar" hoy, para que las tres acciones quepan **sin desplazar** en 375×812.
- Las tarjetas de clase y de examen siguen saliendo solo si hay base configurada para esa institución (no cambia `destinosVisibles`).

### 5.5 Cambio 5 · Una palabra, una cosa
- **"Sesión" queda solo para la cuenta.** En la asistencia: "Abrir asistencia", "Cerrar la asistencia", "Asistencia cerrada.", "Código de asistencia".
- **Cada código con su apellido, siempre igual:** "código de asistencia", "código de la sala", "código del examen", "código de grupo" (el de inscribirse). El campo del admin deja de llamarse "Código del grupo" y pasa a "Nombre del grupo".
- **"Inicio" con mayúscula** cuando nombra la pantalla. **"Institución"**, nunca "colegio", en lo que se ve.
- Ningún par de controles de una misma pantalla tiene el mismo nombre accesible con destinos distintos.

### 5.6 Cambio 6 · La barra de abajo, por rol, en todas las pantallas; y Perfil como "mi cuenta"
| Rol | Entradas de la barra (texto = título de la pantalla) | Pestaña activa en las pantallas de adentro |
|---|---|---|
| Estudiante | Inicio · Retos · Asistencia · **Perfil** | Clase en vivo y Examen de nivel → Inicio; revisión → Retos; aviso y solicitudes → Perfil |
| Profe | **Mis grupos** · **Retos** · **Perfil** | Grupo, asistencia, inscripciones, logro y errores → Mis grupos |
| Admin | **Grupos** · **Perfil** | Asignar docente e importar → Grupos |

- **Antes:** barra solo del estudiante y solo en 4 pantallas; el profe, ninguna.
- **Después:** la misma barra en toda pantalla con sesión, **menos el reto en curso** (una tarea por pantalla) y las pantallas obligatorias (router apagado). Una sola pestaña activa, con `aria-current="page"`; nunca dos.
- **Perfil (`#/perfil`) es de los tres roles** y se titula "Tu perfil": nombre, rol e institución; "Cambiar tu contraseña" (solo si el modo lo permite; pasa a ser una sección, no el título); "Tratamiento de tus datos"; "Mis solicitudes sobre mis datos"; "Cerrar sesión". Sobrio: sin `.juego` y sin Drako animado.
- **Desaparecen:** la fila de enlaces del final de Inicio (`inicio.js:221-233`) y la barra de arriba del inicio del profe y del admin (el aviso y la salida viven en Perfil). Las pantallas obligatorias conservan su "Cerrar sesión" como hoy.
- **Profe y admin, sobrios:** su barra no anima el ícono (hoy la regla del rebote no distingue rol: `estilos/juego.css:469-471`).
- En portátil la barra va abajo igual que en el celular (PROVISIONAL, pregunta C2 de §13).

### 5.7 Cambio 7 · Un solo "volver" y un título que dice de qué
- **Antes:** cuatro textos, tres posiciones y un callejón (H6, H7); títulos sin el grupo (H8).
- **Después:** toda pantalla que **no** es pestaña lleva **un** encabezado igual: arriba, "‹ <nombre de la pantalla a la que vuelve>" (un enlace; nombre accesible "Volver a <nombre>"), y debajo el título. Las pestañas no llevan "volver".

| Pantalla | Vuelve a | Título |
|---|---|---|
| Clase en vivo, Examen de nivel | ‹ Inicio | sin cambio |
| Tratamiento de tus datos (con sesión) | ‹ Perfil | sin cambio |
| Mis datos: solicitudes (por la ruta) | ‹ Perfil | sin cambio |
| Grupo | ‹ Mis grupos | "Grupo <código>" |
| Asistencia (formulario y abierta) | ‹ Grupo <código> | "Asistencia · <código>" |
| Inscripciones | ‹ Grupo <código> | "Inscripciones · <código>" |
| Logro por eje, Errores por ítem | ‹ Grupo <código> | "Logro por eje · <código>", "Errores por ítem · <código>" |
| Asignar docente, Importar estudiantes | ‹ Grupos | "<título> · <código>" |

- Si el código del grupo no llega, el título queda sin él y **nunca** muestra el identificador interno (regla que ya existe en `grupo.js`).
- **La pestaña del navegador** dice "<título> · ENGRAMA" en cada ruta.
- **La nota de salida a EVA y SET** se lee como una frase normal (no en mayúsculas grises), con "↗" delante.
- No cambian: "Volver a entrar" del registro y de la solicitud que ya no está, y el "Volver" del aviso abierto desde la entrada o desde el aviso obligatorio (no son rutas; el router está apagado).

### 5.8 Cambio 8 · Cada rol en sus rutas, y nunca una pantalla en blanco
- **Antes:** H9.
- **Después:** una ruta que no es del rol, o que no existe, **reemplaza** la dirección por el inicio del rol (sin sumar una entrada al historial: el botón atrás no rebota) y no hace ninguna petición de la pantalla ajena.
- De quién es cada ruta: Inicio, Retos, reto, Asistencia, Clase en vivo y Examen de nivel → estudiante; `#/profe/...` → profe; `#/admin...` → admin; Perfil, aviso y solicitudes → todos.
- El admin ya puede abrir hoy las rutas del profe escribiendo la dirección (VISTO `m04-ruta-de-profe-375.png`) y lo conserva (PROVISIONAL, pregunta C6): la tabla las marca para él como "permitida por dirección, sin enlace". No cuentan en `rutas.admin` ni como huérfanas (§10.1), y ahí su barra no marca ninguna pestaña.

### 5.9 Cambio 9 · Se puede salir del reto
- **Antes:** H10.
- **Después:** en el encabezado del reto en curso, "✕ Salir" lleva a Retos. Tocarlo **no envía** el intento ni hace ninguna petición; las respuestas ya guardadas en el equipo no se borran. No aparece mientras se revisa el envío. El reto sigue sin barra.

### 5.10 Textos PROVISIONALES (van a un archivo nuevo `src/textos_nav.js`, esparcido por `textos.js`, que está en 392 de 400 líneas; los revisan Christiam y el pedagogo, ERR-16)
| Clave | Texto |
|---|---|
| `nav.perfil` · `nav.misGrupos` · `nav.grupos` · `nav.retos` | "Perfil" · "Mis grupos" · "Grupos" · "Retos" |
| `nav.volver(nombre)` · su nombre accesible | "‹ <nombre>" · "Volver a <nombre>" |
| `nav.pestana(titulo)` | "<título> · ENGRAMA" |
| `profe.sesion.titulo(código)` | "Asistencia · <código>" |
| `profe.grupo.abrirSesion` y `profe.sesion.abrir` | "Abrir asistencia" |
| `profe.sesion.etiquetaDuracion` | "¿Cuántos minutos queda abierta?" |
| `profe.sesion.cerrar` · `cerrada` | "Cerrar la asistencia" · "Asistencia cerrada." |
| `profe.sesion.codigoPrefijo` | "Código de asistencia" |
| `asistencia.etiquetaCodigo` · `faltaCodigo` · `sesionVencida` · `yaMarcada` | "Código de asistencia" · "Escribe el código de asistencia." · "Ese código ya venció." · "Ya habías marcado esta asistencia." |
| `profe.grupos.tarjeta`: asistencia · inscripciones · ver | "Abrir asistencia" · "Inscripciones" · "Ver el grupo" |
| `profe.grupos.esperan(n)` | "1 espera aprobación" / "<n> esperan aprobación" |
| `inicio.ahora` | "Ahora" |
| `anillo.tarjetaIrClase` · `anillo.tarjetaIrExamen` | "Ir a la clase" · "Ir al examen" |
| `anillo.sales` | "Vas a salir de ENGRAMA con tu cuenta; se abre en esta misma pestaña. Para volver, usa el botón atrás del navegador." |
| `perfil.titulo` · sección · roles | "Tu perfil" · "Cambiar tu contraseña" · "Estudiante" / "Docente" / "Administración" |
| `perfil.institucion(nombre)` | "Institución: <nombre>" |
| `admin.crearGrupo.etiquetaCodigo` | "Nombre del grupo" |
| `profe.retos.avisoTodoElColegio` | "Estos son los retos de toda la institución, no solo de tus grupos." |
| `retoFlujo.salir` · su nombre accesible | "✕ Salir" · "Salir del reto" |

## 6. Stack
Sin cambios: el de `ESPEC_mvp_uis.md` §6 y `CLAUDE.md`. Ninguna librería ni paquete. Los íconos de la barra siguen siendo los caracteres de hoy, con `aria-hidden` (el arte de los íconos es del chat visual, §14).

## 7. Arquitectura: archivos nuevos y ediciones declaradas (ERR-25)
**Nuevos:** `src/navegacion.js` (puro: **la única tabla** que dice, por ruta, de qué rol es, qué pestaña queda activa, a dónde vuelve y cómo se titula) · `src/ui/encabezado.js` ("‹ volver" + título) · `src/textos_nav.js` · `herramientas/humo_navegacion.mjs` (+ `herramientas/humo/flujo_navegacion.mjs`) · `tests/snapshots/vistas_nav_<commit>.json` · los tests y tramposos de §9.

**Ediciones a lo existente:** `src/ui/nav_inferior.js` (recibe el rol y la ruta) · `src/app.js` (filtro por rol, ruta desconocida, la vuelta del aviso) · `src/rutas.js` (título de la pestaña; reemplazar sin historial) · `src/textos.js` (esparce `textos_nav.js`; se le sacan las claves que se mueven) · `src/textos_anillo.js` (`anillo.sales`, las dos etiquetas de tarjeta) · `src/vistas/estudiante/inicio.js`, `retos.js`, `asistencia.js`, `revision.js`, `reto_flujo.js`, `salida_codigo.js` · `src/vistas/perfil.js`, `datos_solicitudes.js`, `aviso_datos.js` (solo `renderLeerAviso`) · `src/vistas/profe/grupos.js`, `grupo.js`, `sesion_asistencia.js`, `inscripcion.js`, `logro.js`, `errores.js`, `retos.js`, `herramientas_clase.js` · `src/vistas/admin/crear_grupo.js`, `asignar_docente.js`, `importar_csv.js` · `estilos/componentes.css` (barra sobria, encabezado, tarjeta del grupo, nota de salida) · `sw.js` (`PRECARGA` y `VERSION`, por los archivos nuevos) · `herramientas/verificar.mjs` (V8) · `herramientas/galeria.mjs` y `herramientas/e2e_real.mjs` (usan `ir-a-sesion` y el recorrido viejo).
**Llamadas de lectura que se agregan:** `listarGrupos` en asistencia, logro y errores (para el título, como ya hacen `grupo.js:81` e `inscripcion.js:78`); una lectura de solicitudes por grupo en el inicio del profe (§5.3).

**Tests que cambian, declarados:** `tests/unit/ui_nav_inferior.test.mjs` (3 entradas → por rol) · `tests/unit/regresion_vistas.test.mjs` (`DECLARADAS`, §9.2) · `tests/unit/foto_vistas.mjs` (excluir también un nodo sin `data-testid`, §9.2) · los E2E que tocan `boton-cerrar-sesion` desde Inicio o desde "Mis grupos" pasan por Perfil (`cerrar_sesion`, `login_piloto`, `profe`, `sin_red_profe_admin`, `solicitudes_datos`, `sw_sin_controlador`; `espera_suspendida` y `vista_bloqueos` no cambian: son pantallas obligatorias) · `aviso_profe.test.mjs` y `solicitudes_datos.test.mjs` (`barra-ver-aviso` → el enlace de Perfil) · `enlaces_anillo.test.mjs` (`salida-volver`) · `linea_fin_reto.test.mjs` (`revision-volver`, solo si cambia su testid; PROVISIONAL: no cambia).
**Tramposos que hay que regenerar** (ERR-26; copia rota = el archivo bueno de ahora + SU defecto, y debe seguir roja en su mismo test). Contados hoy en `tests/tramposos/` por nombre de archivo: `inicio.js` 7 · `app.js` 6 · `salida_codigo.js` 3 · `grupos.js` 2 · `perfil.js` 2 · `reto_flujo.js` 2 · `revision.js` 2 · `grupo.js` 1 · `sesion_asistencia.js` 1 · `datos_solicitudes.js` 1 · `rutas.js` 1.
Si la implementación encuentra otra edición, **se corrige esta lista primero** (regla 8).

## 8. Qué NO se toca
`engrama-backend`, `EVAGAME`, `SET`, `TESDER`, `ENGRAMA/despliegue`, `coins-mvp` · `diseno/`, los tokens y el rig de Drako · `vendor/` · la CSP · `src/anillo/*` (quién ve qué enlace y cómo se arma el pase no cambia) · `src/api/*` (ninguna llamada nueva; solo se usan las que existen) · `src/auth/*` · `src/bloqueos.js` y las pantallas obligatorias · `src/vistas/registro*.js` (los tiene el implementador del registro) · `src/vistas/profe/inscripcion_codigo.js` e `inscripcion_pendientes.js` · la regla de `sw.js` de no guardar `/api` ni `/config.json` · el contenido de las tablas de logro y errores, y la lista de retos · la economía, el sonido y las celebraciones · `REGLAS.md`, `TABLERO.md`, `REGISTRO.md` (los edita el coordinador) · cualquier Supabase remoto, despliegue o push · librerías nuevas.

## 9. Criterios de aceptación (fijados antes de ver resultados)

### 9.1 Regresión = identidad (antes de tocar nada)
- **Línea base:** la que mida el probador sobre el commit de partida (suites y tramposos); se escribe en `REGISTRO.md` antes de W63. `TABLERO.md` no trae cifra para `4ff225f`.
- **R4** sigue comparando contra `vistas_595fd98.json`; cambia **solo** lo de §9.2.
- **R9 · Fotos de navegación.** `tests/snapshots/vistas_nav_<commit>.json`, tomada en W62 **antes de tocar `src/`**, con las vistas que R4 no cubre y esta espec edita: Retos, Asistencia, revisión, reto en curso, Clase en vivo, Examen de nivel, aviso (leer) y solicitudes por la ruta, asistencia del profe (formulario y abierta), inscripciones, logro, errores, retos del profe y las tres del admin; cada una en sus estados de contenido, vacío y error. Cada commit posterior cambia solo el nodo que declara en §11.
- **R5** (`humo_mvp_uis`) y los dos sha256 de `humo_pantallas_anillo` (mock y réplica): idénticos después de cada commit. R1, R6 y los 160 directorios de tramposos de hoy, como estén en la línea base.
- **La medida de hoy queda escrita:** W62 corre el humo de §10 sobre el código sin cambiar y guarda `salida/humo_navegacion.base.json`. **Predicción** (de lo visto en §3): `sin_salida` = reto en curso y solicitudes (estudiante); Grupo, Retos, asistencia abierta y solicitudes (profe); solicitudes (admin); `bajo_la_barra_375` ≥ 1; `rol_ajeno.desconocida` = "en blanco". Si la medición difiere, se anota y **no** se tocan los criterios de §9.3.

### 9.2 Fotos de R4 que cambian, declaradas
| Vista de R4 | Qué cambia | Encargo |
|---|---|---|
| `profe_grupo` | gana el encabezado con "‹ Mis grupos" | W63 |
| `profe_grupos` | orden (grupos antes que herramientas), la tarjeta del grupo con tres acciones, sale el chip "Retos" | W64 |
| `inicio` | orden ("Esta semana" al final), textos de dos botones, una sola tarjeta con invitación | W65 |
| `inicio` | sale la fila de enlaces del final; la barra gana "Perfil" | W68 |
| `perfil`, `perfil_sin_soporte` | la vista entera (pasa a ser "Tu perfil" para los tres roles) | W69 |
| `profe_grupos`, `profe_grupo` | sale la barra de arriba; entra la barra de abajo | W70 |
| `entrada_supabase`, `aviso_consentimiento`, `sin_perfil` | **nada**: idénticas en todos los commits | — |

[INFERIDO] `sinSubarboles` excluye por `data-testid` y ni la barra ni el `nav` de enlaces lo tienen: W62 la extiende para excluir también por etiqueta y clase, con su tramposo (`x_foto_excluye_de_mas`: una exclusión que se traga la vista entera debe poner rojo a R4). Si la herramienta no lo permite, se corrige esta tabla antes de seguir.

### 9.3 Criterios y tramposos
Cada tramposo es una versión rota real en `tests/tramposos/<nombre>/`; cuenta solo si su test se pone ROJO. **La columna "rojo predicho" es una predicción (ERR-15):** la matriz medida se escribe aparte y el criterio no se mueve.

| # | Criterio (medible) | Tramposo → archivo que muta | Rojo predicho |
|---|---|---|---|
| U60 | `entradasNav(rol, ruta)`: estudiante 4 entradas, profe 3, admin 2, con los textos de §5.6; **a lo más una** activa; para cada ruta de la tabla, la pestaña activa es la de §5.6; para `#/retos/:id` no hay barra | `x_barra_del_estudiante_para_el_profe` y `x_dos_pestanas_activas` → `src/ui/nav_inferior.js` | U60 (y E30 el primero) |
| U61 | **Toda ruta registrada en `app.js` está en la tabla de `navegacion.js`**, con rol, pestaña, vuelta y título; y la tabla no trae rutas que no existan | `x_ruta_sin_mapa` → `src/navegacion.js` (le falta una entrada) | U61 |
| U62 | Cada vista con sesión, pintada en contenido, vacío y **error**: trae la barra (salvo el reto) y, si la tabla dice vuelta, **exactamente un** enlace de volver, antes del título, con su destino y su texto; las pestañas, cero | `x_grupo_sin_volver` → `profe/grupo.js`; `x_error_sin_salida` → `profe/logro.js`; `x_dos_volver` → `vistas/perfil.js`; `x_solicitudes_sin_salida` → `vistas/datos_solicitudes.js` | U62 (y E30 el primero y el cuarto) |
| U63 | Asistencia abierta: conserva el volver al repintar y tras cerrar; el botón de cerrar la asistencia **no** tiene el mismo texto que el de cerrar la cuenta; en todo `textos` no quedan dos acciones distintas con el mismo texto de §5.5 | `x_asistencia_abierta_sin_volver` → `profe/sesion_asistencia.js`; `x_dos_cerrar_sesion` → `src/textos_nav.js` | U63 (y E29 el primero) |
| U64 | Asistencia recordada: volver a la ruta con una abierta y sin vencer pinta el código y **0** `POST`; vencida o cerrada → formulario; nada en `localStorage` ni `sessionStorage`; al cerrar la cuenta o cambiar de institución se olvida | `x_asistencia_se_pierde_al_volver` y `x_asistencia_en_almacenamiento` → `profe/sesion_asistencia.js` | U64 (y E29 el primero) |
| U65 | Inicio del profe: los grupos van **antes** que las herramientas; cada tarjeta trae las tres acciones con su destino; el conteo sale solo si es mayor que 0, con ícono y texto; si la lectura del conteo falla, la página sale completa y sin conteo; peticiones al pintar = 1 + grupos (tope 12) y 0 sondeos; ningún nombre de estudiante | `x_herramientas_antes_que_los_grupos` y `x_conteo_rompe_el_inicio` → `profe/grupos.js` | U65 (y E29 el primero) |
| U66 | Inicio del estudiante: el orden de §5.4; ningún `nav` fuera de la barra; ningún par de enlaces con el mismo destino; ningún par de botones con el mismo texto; **una sola** tarjeta con invitación | `x_inicio_con_dos_navegaciones`, `x_tarjetas_con_el_mismo_boton` y `x_tres_invitaciones` → `estudiante/inicio.js` | U66 |
| U67 | Perfil para los tres roles: título "Tu perfil", nombre, rol, institución, aviso, solicitudes y "Cerrar sesión"; la contraseña solo si el modo la soporta; sin `.juego` ni Drako animado | `x_perfil_sin_cerrar_sesion` → `vistas/perfil.js` | U67 (y E29) |
| U68 | Títulos de §5.7 con el código del grupo; sin código, título genérico y nunca el identificador; tras cada ruta, `document.title` = "<título> · ENGRAMA" | `x_titulo_sin_grupo` → `profe/logro.js`; `x_pestana_siempre_igual` → `src/rutas.js` | U68 |
| U69 | Ruta de otro rol o desconocida: la dirección queda en el inicio del rol, **0 peticiones** de la vista ajena, el largo del historial no crece; `#/registro` con sesión se comporta como hoy | `x_profe_ve_inicio_de_estudiante` y `x_ruta_desconocida_en_blanco` → `src/app.js` | U69, E32 |
| U70 | Salir del reto: el enlace existe en la pregunta y no mientras se revisa; al tocarlo, 0 peticiones y las respuestas guardadas siguen | `x_salir_del_reto_envia` y `x_reto_sin_salida` → `estudiante/reto_flujo.js` | U70 |
| V8 | En `src/vistas/`, ningún archivo arma su propio "volver": la palabra "Volver" y un `data-testid` que contenga `volver` aparecen solo en `ui/encabezado.js` y en la lista cerrada de pantallas sin router (`registro.js`, `esperando.js`, `aviso_datos.js`) | `x_volver_casero` → `profe/errores.js` | V8 |
| R9 | Las fotos de navegación | `x_regresion_retos_cambia` → `estudiante/retos.js` (un enlace de más) | R9 |

**E2E por CDP** (`tests/e2e/`, modo `supabase` con el GoTrue falso; los destinos de EVA y SET, con el "destino doble" de E16):

| # | Qué hace | Pasa si |
|---|---|---|
| E29 | **El guion de la demostración, tocando solo lo que se ve.** Recorre los pasos 1 a 9 a 375×812 **sin** escribir en la dirección ni usar el botón atrás (salvo al volver del destino doble), y cuenta los toques | Toques, desde el inicio del rol: generar código **2**; aprobar **2**; abrir asistencia **2**; del código de asistencia abierto al botón del tablero **2**; marcar asistencia **2**; primera pregunta de un reto **1**; salir a la clase **2**; salir al examen **2**. Al volver al grupo y otra vez a la asistencia, el código sigue en pantalla. Cerrar sesión desde cualquier pantalla con barra: **2** (Perfil → Cerrar sesión) |
| E30 | **Sin callejones.** Por rol, recorre desde el inicio todos los enlaces internos (sin tocar botones que escriben) | Toda pantalla alcanzada tiene barra o volver; desde toda pantalla se llega al inicio del rol en **≤ 2** toques; toda ruta de la tabla para ese rol se alcanza por toques (salvo `#/asistencia?codigo=`); 0 pantallas sin título |
| E31 | 375×812 y 1280×800, con un grupo de nombre de 40 caracteres y un nombre de persona de 60 | Sin desplazamiento horizontal; enlaces de la barra y volver de **≥ 44 px** de alto; desplazando al final, **0** controles tapados por la barra; en Inicio del estudiante con las tres tarjetas, sus tres botones terminan por encima de la barra **sin desplazar**; el selector de institución no queda tapado (H13) |
| E32 | El profe escribe `#/inicio`; el estudiante, `#/profe/grupos`; ambos, `#/no-existe` | Quedan en su inicio; nunca una pantalla vacía; el botón atrás no rebota entre dos direcciones |
| E33 | `prefers-reduced-motion: reduce`; y las vistas de `profe/` y `admin/` sin esa preferencia | Con la preferencia, el ícono activo no rebota; en profe y admin la barra tiene `animation-name: none` siempre y no hay `.juego` |
| E34 | Sin red, en cada pantalla | La barra y el volver siguen llevando a su pantalla (son enlaces internos); lo que escribe o sale a otro origen sigue deshabilitado con su texto; ninguna pantalla queda en blanco |

## 10. Humo y réplica

### 10.1 Humo (escribe su archivo, con hash estable)
`node herramientas/humo_navegacion.mjs --contra mock`, semilla **20261008**. En el navegador de verdad (CDP) contra `mock_api` detrás de `servidor_dev.mjs`, modo `supabase`. Por cada rol: entra, recorre por toques y anota solo estructura (rutas, textos de la barra, vueltas, toques); sin fechas, sin identificadores, sin nombres. Escribe `salida/humo_navegacion.mock.json` (JSON canónico) e imprime su sha256.

**Criterio (fijado ahora, sobre el árbol sin la ruta `#/monedas` de W47):** el archivo existe; el sha256 es idéntico en 2 corridas; y
```
{"semilla":20261008,
 "rutas":{"student":9,"teacher":10,"admin":6},
 "barra":{"student":["Inicio","Retos","Asistencia","Perfil"],"teacher":["Mis grupos","Retos","Perfil"],"admin":["Grupos","Perfil"]},
 "sin_barra":["/retos/:id"],
 "sin_salida":[],
 "huerfanas":[],
 "formas_de_volver":1,
 "pestanas_activas_a_la_vez_max":1,
 "al_inicio_max_toques":2,
 "toques":{"profe_codigo":2,"profe_aprobar":2,"profe_asistencia":2,"profe_tablero_desde_asistencia":2,
           "est_asistencia":2,"est_reto":1,"est_clase":2,"est_examen":2,"cerrar_sesion":2},
 "bajo_la_barra_375":0,
 "titulos_sin_grupo":0,
 "controles_con_el_mismo_nombre":0,
 "rol_ajeno":{"profe_en_inicio":"/profe/grupos","estudiante_en_profe":"/inicio","desconocida":"<inicio del rol>"},
 "asistencia_al_volver":"codigo_en_pantalla",
 "animacion_en_profe":0}
```
Si la primera medición del código bueno difiere de esta tabla, **no se edita la tabla**: se registra un candidato a ERR y se decide antes de volver a correr. Si W47 entra antes, `rutas.student` pasa a 10 y eso se declara en el commit de W47, no aquí.

### 10.2 Réplica (entradas que no se usan al desarrollar)
`... --replica` → `salida/humo_navegacion.replica.json`, semilla **7**. Mismo criterio salvo los valores que dependen de la entrada; si una pasa y la otra no, vale la menor.
- Un profe con **dos instituciones** y **tres grupos**, uno con nombre de 40 caracteres con tildes, ñ y espacios; un grupo sin estudiantes y un profe **sin grupos**.
- Un estudiante de una institución **sin** EVA ni SET (sin tarjetas: la primera de "Ahora" es el reto) y otro **sin reto pendiente** (la primera es la clase).
- El modo `mock` (sin cambio de contraseña): Perfil sin esa sección, con todo lo demás.
- 13 grupos (el conteo de quienes esperan se corta en 12) y la lectura del conteo fallando en uno.
- Una asistencia abierta que **vence** mientras el profe está en otra pantalla.
- Chrome además de Edge en E29 a E32; y 360×640 además de 375×812.

## 11. Plan de encargos (un commit cada uno, en orden)
Marca: **∅** nada externo · **P** lo corre el probador · **REG** espera a que el implementador del registro libere el árbol · **PED** un texto espera al pedagogo (se entrega con el provisional).

| # | Encargo (un cambio) | Marca | Criterio del commit | Foto que cambia |
|---|---|---|---|---|
| W61 | Esta espec | ∅ | commiteada antes del código | — |
| W62 | Arnés: R9 (fotos de navegación), `navegacion.js` **solo como tabla del estado de hoy** con U61, `humo_navegacion` y su medida base; línea base a `REGISTRO.md` | REG · P | R9 y U61 verdes; `x_regresion_retos_cambia` y `x_ruta_sin_mapa` rojos; `humo_navegacion.base.json` escrito | — (las crea) |
| W63 | **Cambio 1:** ningún callejón en el panel del profe (Grupo, Retos y asistencia abierta con su vuelta) | ∅ | U62 (las tres vistas), U63 (el volver) | `profe_grupo`; R9: asistencia abierta, retos del profe |
| W64 | **Cambio 3:** inicio del profe, grupos primero con sus tres acciones y el conteo | ∅ | U65 | `profe_grupos` |
| W65 | **Cambio 4:** inicio del estudiante en orden, botones con nombre y una sola invitación | ∅ · PED | U66; E31 (los tres botones sobre la barra) | `inicio` |
| W66 | **Cambio 2:** la asistencia abierta se recuerda en memoria | ∅ | U64 | R9: asistencia del profe |
| W67 | **Cambio 5:** una palabra, una cosa (`textos_nav.js`; "sesión" solo para la cuenta; los códigos con apellido) | ∅ · PED | U63 (los textos); `sw_precarga` verde | solo textos, en las vistas que los usan |
| W68 | **Cambio 6a:** la barra del estudiante con "Perfil", en todas sus pantallas; sale la fila repetida de Inicio | ∅ | U60 (estudiante), U66 (sin segundo `nav`) | `inicio`; R9: clase, examen, aviso, solicitudes |
| W69 | **Cambio 6b:** Perfil es "mi cuenta" para los tres roles | ∅ | U67 | `perfil`, `perfil_sin_soporte` |
| W70 | **Cambio 6c:** la barra del profe y del admin, sobria; sale la barra de arriba de sus inicios; el selector, en su renglón | ∅ | U60 (profe, admin), E33 | `profe_grupos`, `profe_grupo`; R9: las de profe y admin |
| W71 | **Cambio 7:** un solo encabezado ("‹ volver" + título con el grupo), el título de la pestaña y la nota de salida legible | ∅ | U62 completo, U68, V8 | R9: todas las que no son pestaña |
| W72 | **Cambio 8:** cada rol en sus rutas; ruta desconocida al inicio | ∅ | U69, E32 | ninguna |
| W73 | **Cambio 9:** salir del reto | ∅ | U70 | R9: reto en curso |
| W74 | E29, E30, E31, E33 y E34 | ∅ | los cinco verdes; sus tramposos de §9.3 rojos también aquí | — |
| W75 | Humo, réplica y su test | ∅ | §10 | — |
| W76 | Docs: `CLAUDE.md` del repo (la regla "toda ruta nueva entra en `navegacion.js`"), `herramientas/galeria.mjs` al día y el guion de la demostración (los pasos cambian de nombre; lo edita quien lleva `despliegue/`) | ∅ | `git diff` solo en documentos y herramientas de captura | — |
| W77 | Humo `--contra local` contra el piloto, con cuentas sintéticas y solo lectura | P | las secciones `barra`, `sin_salida` y `toques` (las que no escriben) iguales que contra el mock | — |

**W63, W64 y W65 ya mejoran la demostración por sí solos:** quitan el callejón del paso 8, bajan a 2 toques los pasos 1, 4 y 6, y dejan a la vista el examen del paso 9. Si el tiempo se acaba, se puede parar después de W66 o de W67 y lo hecho queda coherente. Cada encargo va con `plantillas/ENCARGO.md` y termina con *"Declara tus predicciones refutadas y lo que no pudiste verificar."* Después de W75: auditor (LISTO / NO LISTO).

## 12. Choques y lo que falta fuera de este repo

### 12.1 Con `ESPEC_juego_oleada1.md` (W40-W60, sin empezar)
- Esa espec dice que la barra no cambia y que no toca `profe/`: **aquí la barra gana "Perfil" y el profe gana barra.** No se pisan si navegación va primero; quien haga W47 agrega `#/monedas` a la tabla (pestaña Inicio, vuelve a Inicio) o U61 se pone rojo, que es para lo que está.
- Las dos editan `inicio.js`, `reto_flujo.js`, `revision.js`, `retos.js` y `app.js`. El enlace "Ver mis movimientos" (W47) va bajo el saldo y "Tu semana" (W51) ocupa el lugar de "Esta semana": con el orden de §5.4 no chocan, pero sus fotos se declaran de nuevo. **Decide el coordinador el orden;** PROVISIONAL: W62 a W66 antes que W47.

### 12.2 Lo que el backend no ofrece y esto necesitaría
- **Recuperar la asistencia abierta tras recargar.** `GET /core/attendance/sessions/active` existe en el contrato (`contratos/openapi_5aad55e.json`) y ni la app ni el mock lo usan; su respuesta (`AttendanceSessionOut`: `id`, `session_code`, `starts_at`, `expires_at`, `status`, `qr_payload`) **no trae el grupo**, así que la app no sabe de qué grupo es cada una [LEÍDO]. Pedido para F4: que traiga `group_id`. Mientras tanto, el cambio 2 (memoria).
- **Cuántos esperan aprobación, en una sola llamada.** Hoy es una lectura por grupo.

### 12.3 Lo que falta en EVA y en SET (otros repos, otros chats)
Ninguna de las dos portadas ofrece "Volver a ENGRAMA" [VISTO sin pase: `x01`, `x02`]. Con pase y al terminar una clase o un examen, **no verificado**. Pedido para quien lleve EVA y SET: un enlace de vuelta visible al terminar; ENGRAMA puede mandar su dirección de vuelta en el fragmento, pero eso cambia la decisión 013 y no se decide aquí.

## 13. Preguntas abiertas (cada una con su provisional; ninguna bloquea)

### Solo Christiam
- **C1 · ¿En qué tres momentos te perdiste?** No hubo detalle. PROVISIONAL: se asume que fueron los de §3.4 (H1 a H5). Si fue otra cosa, se anota antes de W63 y se reordena §11; los criterios no se tocan.
- **C2 · ¿La barra del profe abajo también en el portátil?** PROVISIONAL: sí, igual que en el celular (un solo modelo: "abajo está la barra").
- **C3 · "Cerrar sesión" a 2 toques (Perfil → Cerrar sesión).** PROVISIONAL: sí. En un salón con equipos compartidos podría quererse a 1.
- **C4 · Orden de "Ahora" en Inicio del estudiante.** PROVISIONAL: reto, clase, examen, fijo. La app no sabe si hay clase en vivo en este momento.
- **C5 · "Abrir asistencia" desde Mis grupos lleva al formulario (2 toques, 15 minutos ya escritos).** PROVISIONAL: sí; abrirla de un solo toque arriesga abrirla sin querer.
- **C6 · ¿El admin puede abrir las pantallas del profe por la dirección?** PROVISIONAL: como hoy (puede), sin enlace que lo lleve.
- **C7 · ¿Se puede salir de un reto a medias sin aviso?** PROVISIONAL: sí, sin confirmar.
- **C8 · Nombres:** "Perfil" (o "Mi cuenta"), "Mis grupos", "Asistencia" en lugar de "sesión", "Nombre del grupo". PROVISIONAL: los de §5.10.
- **C9 · El conteo "N esperan aprobación" en el inicio del profe.** PROVISIONAL: sí, hasta 12 grupos.

### Del pedagogo (ERR-16: ninguna queda decidida aquí)
- Los textos de la asistencia del estudiante ("Código de asistencia", "Ese código ya venció.", "Ya habías marcado esta asistencia.") y "Ahora", "Ir a la clase", "Ir al examen".
- Si "Logro por eje" y "Errores por ítem" son nombres que un profe entiende sin explicación (aquí solo se les agrega el grupo).

## 14. Lo que NO es navegación y se vio de paso (para el chat visual; no se especifica aquí)
- **Logro por eje a 375 px:** los encabezados se parten a mitad de palabra ("ESTUDIAN/TE", "COMPREHEN/SION") y cada celda repite "datos insuficientes: Comprehension · (sin retos con nivel)" (`p05-logro-375.png`).
- **Retos del profe:** 96 tarjetas iguales en 24.318 px, sin buscar ni agrupar, con el estado crudo en inglés ("ACTIVE") y una disculpa técnica como aviso (`p07-retos-375.png`).
- **Retos del estudiante:** 24 filas "Jugar" idénticas, sin tema ni nivel ni orden visible (`e02-retos-375.png`).
- **Saludo de Inicio:** "Hola, Estudiante Anillo UIS 5" se parte en cuatro renglones, apretado entre Drako y "Con sonido" (`e01-tras-entrar-375.png`).
- **"Esta semana"** con dos ceros ocupa media pantalla en una cuenta nueva.
- **Entrada:** sin marca ni Drako, y dos tercios de la pantalla vacíos (`a01-entrada-375.png`). El inicio del admin empieza con un formulario sin título propio (`m01`).
- **Íconos de la barra y del sonido:** son caracteres del sistema (cambian con cada equipo); falta arte propio.
- **Texto de apoyo en mayúsculas grises** para frases largas (la ayuda de menor de edad del registro, "Mínimo 10 caracteres"): cuesta leerlo (`a02-registro-375-completa.png`).
- **EVA y SET se ven como otros productos** (SET en verde, "English Placement Exam"; EVA casi sin estilo y con "gato-rojo") (`x01`, `x02`).
- **"Abrir Escamas"** no dice qué es.
- **Pantallas vacías del profe** (errores por ítem sin datos, grupo sin registro de asistencia): texto solo.

## 15. Después (anotado, no se hace ahora)
- Volver arriba en el registro ("Volver a entrar" solo está al final de 1405 px): cuando el implementador del registro libere esos archivos.
- La barra arriba en portátil, si C2 lo pide.
- La asistencia abierta tras recargar (§12.2) y un aviso en la tarjeta del grupo ("Asistencia abierta").
- El enlace de vuelta desde EVA y SET (§12.3).
- Buscar y agrupar en las dos listas de retos (§14).
- Una migas de pan completa (Mis grupos › Grupo › Logro): con un solo nivel de vuelta alcanza hoy.

## 16. Predicciones del Creador (para refutar) y lo no verificado
**Predicciones:**
- **P1:** con W63 a W65, Christiam completa los 10 pasos del guion sin usar el botón atrás del navegador, salvo al volver de EVA y de SET.
- **P2:** la medida base de W62 da los callejones de §9.1 y ninguno más.
- **P3:** la barra de 4 entradas cabe en 360 px sin partir ningún texto, y la del profe ("Mis grupos" es la más larga) también.
- **P4:** las tres tarjetas de "Ahora" con el botón a la derecha terminan antes de y=751 en 375×812 (la tarjeta del reto, que ya tiene el botón a la derecha, mide hoy unos 82 px, de y≈288 a y≈370, en `e01-tras-entrar-375.png`; tres así terminan cerca de y≈566).
- **P5:** `inicio.js` (286 líneas) y `app.js` (337) siguen bajo 400 tras los cambios; `textos.js` baja al sacar las claves que se mueven.
- **P6:** el conteo por grupo no retrasa el pintado del inicio del profe de forma visible con 1 a 4 grupos.
- **P7:** mover "Cerrar sesión" a Perfil obliga a editar 6 archivos de E2E y ningún test unitario fuera de los declarados.

**Lo que no pude verificar:**
- **No se vio en el piloto:** la asistencia abierta, el reto en curso y la revisión (abrirlos escribe datos); se miraron las capturas de `salida/galeria/` del 2026-10-06, hechas contra el mock con un commit anterior.
- **No se salió a EVA ni a SET con pase:** no sé cuántas veces hay que tocar "atrás" para volver después de una clase o de un examen, ni cómo queda ENGRAMA al volver. Solo se vieron sus portadas sin pase.
- **No se vieron** "Registro enviado", "Esperando a tu profe", "Tu solicitud ya no está activa", "Crea tu contraseña", el aviso obligatorio, "Cuenta suspendida" ni "Cuenta sin inscribir": exigen crear o cambiar cuentas.
- **No se corrió ninguna suite, ningún tramposo ni ningún E2E.** La cifra de la línea base es del probador.
- **Navegador:** Edge headless con la ventana emulada; ningún celular real, ningún gesto de "atrás" del sistema, ningún teclado en pantalla tapando la barra.
- **A 1280×800 se miraron** Inicio del estudiante, Mis grupos y Grupo; del resto solo hay captura y medidas, sin mirar una por una.
- Cómo excluye nodos la herramienta de fotos (`foto_vistas.mjs`) es [INFERIDO] de su uso en `regresion_vistas.test.mjs`.
- Que el intento de un reto abandonado se pueda retomar con sus respuestas: no se leyó `respuestas_locales.js` contra un intento nuevo.
- **La causa real de la confusión de Christiam es una hipótesis:** él no dijo dónde se perdió (pregunta C1).
- Las herramientas `mcp__alefast__*` que pide `CLAUDE.md` no estaban disponibles en este agente: no se consultaron ni se anotó nada en ellas.
