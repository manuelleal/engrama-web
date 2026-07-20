# Engrama — Web

> **Status:** 🔴 Planned / not yet implemented — architecture and design system
> defined, application code not started. This repository currently holds the
> project scaffold and the decisions that will guide the build.

Engrama is an early-stage **EdTech platform for gamified English learning**. This
repository is the **web client**: the student- and teacher-facing app that will
consume the [Engrama backend](https://github.com/manuelleal/engrama-backend) API.

It is the front end of the evolution of **Lingo-Coins**, a vanilla-JavaScript MVP
that ran in a real university classroom (~97 students at Universidad Industrial de
Santander, Colombia). Engrama Web is where that MVP's proven "game feel" —
animated coins, confetti, streaks, sound — gets rebuilt on a modern,
component-based, typed foundation.

📖 The full story: [**From Lingo-Coins MVP to Engrama**](https://github.com/manuelleal) *(portfolio narrative)*.

---

## Honest status

There is **no application code yet.** The repository contains the folder
structure, the documented architecture, and a **decided design system** (colors,
typography, tokens). The first milestone is a *walking skeleton* — login → home
with wallet → QR check-in → leaderboard — consuming the live backend endpoints.

Being explicit about this matters: the value on show here is **product and UX
decision-making for education**, not a shipped interface. The backend that this
client will call is real and tested; the client is the next build.

---

## Planned architecture

The stack is decided and documented; the reasoning is intentionally conservative
so the founder (an English teacher, not a career developer) can maintain it.

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Mobile-first, server components, one hosting story |
| Language | TypeScript (strict) | Types auto-generated from the backend's OpenAPI schema |
| Styling | Tailwind CSS + shadcn/ui | Design tokens as the single source of visual truth |
| State | Zustand | Small, explicit global state |
| Data fetching | TanStack Query | Caching + optimistic UI for the coin economy |
| Auth | Supabase JS client (auth only) | JWT issuance; all business logic stays in the backend |
| Icons | Phosphor (navigation) + Lucide | Inherited from the MVP's visual language |
| Testing | Vitest + Playwright | Unit + end-to-end |

**Design boundary:** the web client never talks to the database directly (the
MVP's biggest architectural weakness). It only calls the typed backend API and
uses Supabase solely to obtain a JWT.

### Design system — "Midnight Blue + Gold"

The palette is decided: it evolves the exact colors that ~97 students already
recognized in the MVP. Gold *is* the coin — the brand's whole identity — and
sets Engrama apart from Duolingo (green) and Kahoot/Quizizz (purple).

```css
:root {
  --eng-bg: #0B1221;         /* base background */
  --eng-surface: #161F30;    /* glassmorphism cards (85% alpha + blur) */
  --eng-gold: #F5A623;       /* brand: coins, primary CTA, streaks, achievements */
  --eng-teal: #00F5D4;       /* success / positive feedback */
  --eng-blue: #2B7FE8;       /* info / links */
  --eng-red:  #FF4D6D;       /* error / loss */
  --eng-text: #E8EFF8;
}
```

Rule of thumb baked into the system: **gold is scarce on purpose** — only coins,
the one primary CTA per screen, streaks and achievements. If everything glows,
nothing does. Typography: Lexend (headings) + Inter (body).

---

## Planned structure

```
app/            # Next.js App Router — routes & layouts
lib/            # api-client, generated api-types, supabase, utils
stores/         # Zustand stores (user, ui)
```

*(These directories exist as scaffolding; implementation is pending.)*

---

## Getting started (once implemented)

```bash
npm install
cp .env.local.example .env.local     # NEXT_PUBLIC_SUPABASE_* + API base URL
npm run dev                          # → http://localhost:3000
```

---

## First milestone — walking skeleton

1. Initialize Next.js 14 + Tailwind + shadcn with the design tokens above.
2. Login (Supabase JWT) → home with coin wallet → QR check-in → leaderboard,
   all consuming the backend API.
3. Port the MVP's game feel: animated coin counting, confetti, streak sounds
   (reference implementation lives in the original Lingo-Coins MVP).

---

## My role in this project

I own the **product, learning design and educational UX** of Engrama, and drive
implementation with an **AI-assisted workflow** (Claude Code against written
specs). For the web client specifically, my contribution so far is the decided
architecture and the design system — the choices that determine how the interface
will teach and feel — ahead of writing the code. See the portfolio narrative for
the full breakdown.

---

*Engrama is a work in progress and is not affiliated with any commercial release.
Built in Bucaramanga, Colombia.*
