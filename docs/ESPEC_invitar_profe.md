# ESPEC · Invitar profes por correo (la parte de la web)

- **Fecha:** 2026-10-26. **Autor:** creador (Opus). **Estado:** preregistro.
- **La espec completa vive en el backend:** `engrama-backend` rama `cuentas/invitar-profe`, `docs/ESPEC_invitar_profe.md` (commit `7ac8f2c`). Aquí manda su **§5** (piezas de la web, criterios WI1-WI8 y sus tramposos) y su §7 (qué NO se toca).

## Resumen de lo que cambia en la web (UNA cosa)
El admin invita a un profe desde `#/admin/invitar` ("Profes: invitar") y ve el estado de cada invitación (Enviada / Aceptada) con un "Reenviar"; el profe abre `#/invitacion?token_hash=…`, crea su contraseña y entra.

## Qué NO se toca
- Las pantallas del estudiante (las cambia otro agente).
- `#/recuperar`: solo acepta textos opcionales; RC1-RC7 siguen en verde sin tocarlos.
- La entrada.

## Números fijados que se mueven (declarados)
- Rutas del admin: 7 → 8 (`/admin/invitar`).
- `sw.js`: `engrama-shell-v78` → `v79`, con los módulos nuevos en `DIFERIDOS`; copias rotas rehechas con `regenerar_x_sw.mjs`.

## Errata (2026-10-26, después de la suite completa; candidato a ERR)
La primera suite completa de la rama dio rojos que la lista de arriba no declaraba. Todos son inventarios de pantallas o del doble, hechos para ponerse rojos con una ruta nueva:
- U62 (`tests/unit/nav_encabezado.test.mjs`): toda ruta de la tabla se pinta en contenido, vacío, error y carga → se suma `/admin/invitar` (y `GET /admin/invitaciones` al servidor de mentira).
- U60 (`tests/unit/ui_nav_inferior.test.mjs`): `/admin/invitar` deja activa "Grupos".
- E30 (`tests/e2e/nav_sin_callejones.test.mjs`): el admin recorre 8 pantallas (antes 7).
- W75 (`tests/e2e/humo_navegacion.test.mjs`): las rutas del admin en la tabla del humo, 7 → 8.
- `tests/e2e/admin.test.mjs`: el enlace pedía `GET /admin/invitaciones` al doble, que respondía 404 (la prueba no admite errores HTTP en la consola) → el doble (`herramientas/mock/invitaciones.mjs`) imita las tres rutas del contrato.
