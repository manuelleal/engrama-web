# engrama-web — CLAUDE.md

Frontend de Engrama. **Estado: NO inicializado** — los archivos actuales son
placeholders de 0 bytes. El sistema de gestión del proyecto vive en `..\CLAUDE.md`.

## Stack decidido (ARQUITECTURA.md de este repo)

Next.js 14 App Router + TypeScript strict + Tailwind + shadcn/ui (copy-paste) +
Zustand + TanStack Query + Supabase JS (solo auth). Tests: Vitest + Playwright.

## Cuando se inicialice (Fase C del plan maestro)

1. `npx create-next-app` + tooling completo ANTES de la primera feature
   (tsconfig strict, ESLint, Tailwind con el preset generado desde `..\..\diseno\tokens.json`;
   ver `..\..\decisiones\001-sistema-de-diseno-unico.md`).
2. Primera meta: walking skeleton — login → home con wallet → check-in QR →
   leaderboard, consumiendo `engrama-backend`.
3. Toda request al backend: `Authorization: Bearer <JWT>` + header de tenant.
   El front NUNCA consulta la DB directamente (solo Supabase Auth).
4. Game feel desde el día 1: portar patrones de `..\coins-mvp\ui-assets.js` y
   `student.html` (Howler lazy, confetti, conteo animado). *Ninguna acción
   positiva termina en silencio.*
5. Reglas de calidad: TS strict sin `any`, `tsc --noEmit` limpio antes de cerrar
   tarea, mobile-first, **tema claro por defecto** y oscuro opcional (decisión 001, Navy Real).

## Referencia visual

La marca y los tokens salen de la decisión 001 (`..\..\decisiones\`), no del MVP. Del MVP
(`..\coins-mvp\student.html`) se portan el flujo de una pregunta por pantalla, la navegación
inferior y los patrones de game feel. Su paleta oscura + oro inline **no** se porta.
Las fricciones que hay que corregir están en `..\..\investigacion\diseno\03-auditoria-ux-engrama.md`.
`GAME-DESIGN-MVP.md` §4 sigue valiendo para las animaciones, pero no para la paleta.
