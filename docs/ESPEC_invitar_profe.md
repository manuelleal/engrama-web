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
