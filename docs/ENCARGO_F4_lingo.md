# ENCARGO a F4 · Lo que le falta al backend para correr Lingo Coins en la UIS

De: ARQUITECTO (frente engrama-web) · 2026-09-28 · listo para pegar. Nace de `ESPEC_mvp_uis.md` §3 y §4 (engrama-web). El cliente **no** toca el backend: todo lo de aquí lo especifica e implementa F4, con su propia espec, sus tests y sus tramposos. Los números L son los que cita el cliente.

## Misión
Cerrar las brechas entre lo que Lingo Coins hacía en clase y lo que engrama-backend expone hoy, **sin cambiar los contratos estables** (T1-T7, M1-M4 y el `submit` actual). Cada L es un commit, o una espec corta si lleva migración.

## Contexto mínimo
- `ENGRAMA/engrama-web/docs/ESPEC_mvp_uis.md` §3 (lo medido, con archivo:línea) y §4 (la tabla de flujos).
- `src/challenge_engine/service/attempts.py`, `.../challenges.py`, `src/engrama_core/service/attendance.py`.
- Rama `feat/leaderboard` (`6d7dd72`, sin fusionar).
- `ENGRAMA/coins-mvp/app.js:2769-2938` (submitChallenge) y `:4024-4060` (computeChallengeRewards). Solo lectura: es la referencia de comportamiento.

## Orden propuesto (lo reordena el coordinador o Christiam)
Van primero dos bugs chicos, luego la regla de la casa y después el resto: **L2 → L6 → L1 → L4 → L3 → L7 → L5 → L8**. **L9** va dentro de la espec del login 008 (migración 034; la 033 es BUG-13, según F4 68c42ad). **L10** es opcional.

Para el hito 2 del cliente hacen falta L1-L4 y L6 (L5 y L7 son deseables). Para el piloto (hito 3) hacen falta además L8, L9 y el login 008.

---

### L1 · La correcta y la explicación después de CADA respuesta (regla de la casa, 001 §6.1)
- **Migración:** `challenge_questions.explanation jsonb NULL` y `challenge_questions.accepted_answers text[] NULL`.
- **Entrada:** `ChallengeQuestionIn` acepta `explanation` y `accepted_answers`, los dos opcionales. `ChallengeQuestionOut` **no** los expone nunca.
- **Nueva ruta** `POST /challenges/attempts/{attempt_id}/answers`
  - Cuerpo: `{"question_id": uuid, "answer": str}`.
  - Respuesta 200: `{"question_id", "is_correct": bool, "correct_answer": str (label en opción múltiple), "explanation": {"regla": str, "por_opcion": str|null, "ejemplo": str}|null, "repetida": bool}`. `por_opcion` es solo la de la opción elegida, si fue incorrecta.
  - Errores: intento de otro estudiante o de otro colegio → 404; intento que no está `in_progress` → 409; pregunta que no es del reto → 404.
- **Idempotencia:** la llave es `(attempt_id, question_id)` y **gana la primera respuesta**. Repetir, con la misma respuesta o con otra, devuelve el resultado guardado con `repetida: true` y no cambia nada.
- **Calificación:**
  - opción múltiple por **label**: si llega el `value` de una opción, se traduce a su label antes de comparar (cierra la mezcla de convenciones de grupos §0 y §2.4);
  - `fill_blank`: acierta si coincide, normalizada, con `correct_answer` **o** con alguna de `accepted_answers`.
- **Nueva ruta** `POST /challenges/attempts/{attempt_id}/finish`, sin cuerpo: califica con las respuestas guardadas por `/answers` (las que falten cuentan como `""`, incorrectas) y paga según L2 y L3. Responde `AttemptSubmitOut`.
- **`/submit` queda igual** (regresión = identidad de sus tests).
- **Tests y tramposos:**
  - `GET /challenges/{id}` y `/attempt` nunca traen `explanation`, `accepted_answers` ni `correct_answer`: introspección de esquema e integ. *Tramposo:* `ChallengeQuestionOut` con `explanation` → rojo.
  - Una segunda respuesta a la misma pregunta no cambia `is_correct` ni la suma. *Tramposo:* "la última gana" → rojo.
  - Un `value` de la opción correcta califica como correcto.
  - Un `accepted_answers` alternativo acierta en `fill_blank`.

### L2 · Una sola paga por reto (tramposo "monedas acreditadas dos veces")
- **Hoy:** `start_attempt` no mira si el estudiante ya ganó (`attempts.py:113-167`); `submit` paga con `is_correct and current_winners < max_winners` sin mirarlo (`:229`) y lee el intento sin `FOR UPDATE` (`:190-205`). Lingo lo impedía con `hasCorrectBefore` (`app.js:2814`).
- **Contrato:** solo paga el **primer** intento terminado del estudiante en ese reto (decisión D3: repasar no paga). En `submit` y en `finish`, el intento se toma con `SELECT … FOR UPDATE` y se re-verifica el estado. Los intentos siguientes devuelven `coins_earned: 0` y `xp_earned: 0`.
- **Tests y tramposos:**
  - Gana, abre un segundo intento, gana → 1 fila en `coin_ledger` con `action='challenge'` para ese reto.
  - Dos `submit` concurrentes del mismo intento → 1 fila y un 409.
  - *Tramposo:* se quita el chequeo → 2 filas → rojo. *Tramposo:* sin `FOR UPDATE` → el test concurrente, rojo (si no se pone rojo de forma determinista, se declara como no medible, no como verde).

### L3 · Monedas por desempeño, como Lingo (decisión D2)
- Función pura `challenge_reward(score_percent, base, racha) -> (coins, streak_bonus)`, con la tabla de `app.js:4024-4060`:
  - tramos: 100 → base; ≥ 80 → 0,8×; ≥ 60 → 0,5×; ≥ 40 → 0,25×; menos → 0, redondeando la mitad hacia arriba;
  - bono: racha ≥ 7 → round(0,5×base); ≥ 3 → round(0,25×base); ≥ 1 → +1.
- La usa el primer intento (L2). `streak_bonus` deja de ser siempre 0. `max_winners` sigue existiendo, pero el cliente siembra `max_winners` = tamaño del grupo (D4).
- **Tests:** con base 5, una tabla con 100/80/79/60/40/39 y racha 0/1/3/7, con los valores de Lingo escritos a mano. *Tramposo:* todo o nada (lo de hoy) → rojo con 80 %.

### L4 · Asistencia y racha con la semántica de Lingo (y BUG-12)
Tres cambios. Los números salen de D2 y quedan como constantes nombradas.
- **Chequeo de grupo:** `check_in` exige que el estudiante tenga membresía `student` activa con el `group_code` del grupo de la sesión. Si no, **404 igual al de código inexistente** (no filtra que la sesión exista). Hoy solo mira el colegio (`attendance.py:236-239`). *Tramposo:* sin el chequeo, un estudiante de B marca en la sesión de A → 200 → rojo.
- **Racha por sesiones del grupo, no por días calendario:**
  - la racha es el número de sesiones consecutivas **del propio grupo** a las que asistió. Una sesión del grupo cerrada sin su check-in la rompe;
  - una segunda sesión el mismo día **no** la reinicia. Hoy la reinicia a 1: `compute_next_streak` supone un UNIQUE por día, pero el UNIQUE es `(session_id, student_id)` (`models.py:374`);
  - la racha va por colegio (membresía) y no por perfil global (BUG-12).
  - *Tests:* martes y jueves, 4 sesiones seguidas → 4 (hoy 1); dos sesiones el mismo día → +2; faltar a una → 1.
  - *Tramposo:* la regla de días calendario (la de hoy) → rojo con martes y jueves.
- **Monto del check-in (D2):** 5 base + 5 si marca dentro de los primeros 5 minutos desde `starts_at` (Lingo `app.js:1686-1698`), en lugar de 50 × multiplicador (`attendance.py:52`, `:303`). *Tests:* minuto 4 → 10 y minuto 6 → 5.
- **Lectura:** el estudiante lee su racha en `/auth/me` (el campo que fije el login 008). T2 ya la da como `consistency`.

### L5 · Pista de Drako: quitar una opción incorrecta (D2: cuesta 2)
- `POST /challenges/attempts/{attempt_id}/questions/{question_id}/hint`, sin cuerpo → 200 `{"eliminated_label": str, "coins_charged": int, "repetida": bool}`.
- Solo en opción múltiple con 3 o más opciones, y antes de responder esa pregunta (si ya se respondió → 409).
- Débito de 2 en `coin_ledger` con `action='hint'`, de la billetera del estudiante a la del colegio. Sin saldo → 402 y nada cambia.
- **Idempotente** por `(attempt_id, question_id)`: la segunda llamada devuelve la misma label con `coins_charged: 0`.
- La opción que se quita es determinista (por ejemplo, el hash de `attempt_id` y `question_id` sobre las incorrectas) y **nunca** la correcta.
- *Tramposos:* quita la correcta → rojo; cobra dos veces → rojo.

### L6 · El estudiante solo abre retos de su grupo
- `GET /challenges/{id}` y `POST /challenges/{id}/attempt` aplican a un estudiante el mismo filtro de grupo del feed (`challenges.py:107-164`); un reto de otro grupo → 404. Profe y admin no cambian.
- *Tramposo:* se quita el filtro → un estudiante de A abre el reto de B → 200 → rojo.

### L7 · Ranking del grupo (Lingo: top 5 + tu puesto; D4)
- Se porta `feat/leaderboard` con tres cambios:
  - nombres de la **membresía** (BUG-11), nunca de `profiles.full_name`;
  - el profe, por `visible_groups` (BUG-10);
  - el estudiante, solo su grupo: otro grupo → 404, no 403.
- `GET /leaderboard?group_code=&limit=5` → `{"scope": "group", "group_code", "entries": [{"position", "full_name", "coins", "is_me"}], "me": {"position", "coins"}}`. Orden: monedas desc, luego `full_name` y luego `profile_id`.
- **Nunca** incluye nivel, escudo ni logro.
- *Tramposos:* el ranking de A muestra a un estudiante de B → rojo; muestra a uno de otro colegio → rojo; muestra un nombre de `profiles` → rojo.

### L8 · Retos del grupo y creación desde el contenido F8
- `GET /teachers/groups/{gid}/challenges` (`authorize_group`) → `ChallengeOut` más `group_id`. Resuelve que hoy `ChallengeOut` no trae `group_id` y que `/challenges/all` muestra todo el colegio.
- `GET /teachers/content/units` → un catálogo **sin claves**: `id`, nivel, título, bloques y n.º de ítems por bloque.
- `POST /teachers/groups/{gid}/challenges/from-unit {"unit_id", "bloque"}` → crea los retos del bloque **en el servidor**, con el mapeo de `ESPEC_mvp_uis.md` §8.
- **El catálogo con claves se lee de una ruta del servidor** que llega por la variable `ENGRAMA_CATALOGO_RETOS`. **Nunca** se sirve como estático ni viaja al cliente.
- Una unidad sin `revisado_por` → 422 `unidad_sin_firma`, salvo con `ENGRAMA_PERMITIR_BORRADOR=1` (solo local).
- *Tramposos:* el catálogo con `clave` en la respuesta → rojo; una unidad sin firma creada sin la bandera → rojo.

### L9 · Vincular la cuenta UIS con su inscripción (va dentro del login 008)
- **Contrato observable:** un estudiante inscrito por CSV con el correo X que entra con correo verificado, Google o Microsoft usando X queda con **el mismo `profile_id`** y la membresía del CSV. `/auth/me` le da `role=student` en la UIS, sin onboarding.
- M4 acepta `correo` para cuentas adultas **no gestionadas** y lo guarda, único por colegio (D6: la 008 §2 dice "no se guarda", pensado para menores).
- *Tramposos:* correo no verificado → no vincula; el mismo correo inscrito en otro colegio → no vincula de forma cruzada; un gestionado (`managed=true`) nunca se vincula por correo.

### L10 · Nivel confirmado para el escudo (opcional)
- `PUT /teachers/groups/{gid}/students/{pid}/level {"cefr": A1|A2|A2+|B1|B1+|B2|B2+|C1, "evidencia": str}` (`only_assigned=True`). El estudiante lo lee en `/auth/me` como `level_confirmed: {"cefr", "fecha"}|null`.
- Lo relacionado: la migración `memberships.cefr_assigned` de grupos §6.
- *Tramposo:* cualquier reto, moneda o XP que cambie `level_confirmed` → rojo (010: el juego no infla el nivel).

---

## Contrato
- **Puede tocar:** `src/challenge_engine/`, `src/engrama_core/`, `src/leaderboard/` (desde la rama), `src/teachers/` (solo rutas nuevas), `alembic/` (migraciones nuevas y reversibles), `tests/`.
- **Prohibido:**
  - cambiar la forma de T1-T7, M1-M4, `/submit`, `/core/coins/*` o `ProfileOut` sin una ERR;
  - tocar `ENGRAMA/engrama-web`, `coins-mvp`, `contenido/`, `SET/` o `EVAGAME/`;
  - usar un Supabase remoto;
  - poner secretos en archivos (el catálogo y cualquier clave, por variable de entorno).
- Sin sub-agentes, sin commit ni push si F4 delega (lo commitea su coordinador).

## Criterio de aceptación verificable
- `poetry run pytest` sin fallos, los previos idénticos, ruff 0 y mypy 0.
- La **matriz de tramposos medida** (cada tramposo de arriba en rojo en sus tests) y los cruces no previstos anotados por ERR (ERR-15).
- **Humo** `tests/_salida/humo_lingo.json` = `{"respuesta_repetida_igual": true, "paga_una_vez": 1, "tramo_80": 4, "racha_martes_jueves": 4, "checkin_otro_grupo": 404, "pista_repetida_cobra": 0, "reto_otro_grupo": 404, "ranking_sin_otro_grupo": true}`.

## Presupuesto
Lo fija F4 por L. Referencia: Opus para la espec de L1, L2 y L4 (migración y concurrencia); Sonnet para L3, L5, L6 y L7.

## Qué hace el cliente mientras tanto
- Muestra la correcta de todas las preguntas al final del reto (con el `submit` de hoy).
- Oculta "Jugar" en los retos ya ganados.
- Bloquea el doble toque.
- Siembra los retos con un script de operador que usa `POST /challenges/`.
- Todo contra un mock con estas formas, para cambiar a lo real sin reescribir.

**"Declara tus predicciones refutadas y lo que no pudiste verificar."**
