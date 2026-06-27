# Launch Hub + Road-to-Test Roadmap

> The user's terminal goal: **ONE launchpad website** that links to every app
> and shows the seeded credentials, so they can click into any role and test.
> This is the LAST WAVE. Everything below marches toward it; do not stop until
> the hub is live and usable.

## THE FINAL DELIVERABLE — the Launch Hub ("one website to rule them all")

A single deployed page (its own Firebase Hosting target, e.g. `hub`),
Lyceum-styled, that contains:

1. **Web app links** — a card per deployed web app (super-admin, admin, teacher,
   student, parent) with role blurb + an **Open** button to its live URL.
2. **Mobile app access** — Expo/EAS links or QR codes for the 3 RN apps (family,
   staff, scanner), or a clear "how to open" note if not yet built.
3. **Seeded credentials table** — per seeded tenant (DEMO01 + the 5-tenant set):
   `role · name · email · password · which app · quick-login link`. Rendered
   from a credentials manifest the seed engine emits (`packages/seed` →
   `seed-credentials.json`), so it always matches what's actually in Firebase.
4. **Tenant codes** (school-code login) + a link to the `lvlup-v0` design system
   for reference.

**Hard dependencies (why it's last):** the apps must be deployed/running to link
to, and Firebase must be **seeded** so the listed credentials actually work. The
hub is generated from real deploy URLs + the real seed manifest — never
hand-typed.

## Road to the hub (fire each as the prior gate lands; don't idle)

```
[running]  SDK BUILD COORD        → tested SDK + seed engine + functions + wired shell + seeded emulator
   ↓ (on SDK GATE 6)
   UI BUILD COORD                 → 8 real production apps (5 web React + 3 Expo RN) on the SDK,
                                     consuming the seeded data, per the route trees + Claude Design SPAs
   ↓ + AI/ASYNC LIVE (parallel)   → content-gen, autograde pipeline, tutor, insights/at-risk, cost/quota
   ↓
   INTEGRATION + E2E              → Playwright hero journeys green; security-rules matrix; contract tests
   ↓
   DEPLOY                         → seed the REAL Firebase project (full mock dataset, idempotent);
                                     deploy all web apps (hosting targets) + functions; EAS builds for RN;
                                     capture every live URL + the seed-credentials manifest
   ↓
   ★ LAUNCH HUB ★ (FINAL WAVE)    → build + deploy the single launchpad from the live URLs + seed creds.
                                     User opens ONE link, sees all apps + all logins, tests everything.
```

## Standing instruction

Keep the pipeline moving across these phases (each phase = its own
coordinator/sessions, dynamic workflows, Opus 4.8 1M, gated, count-gate
recovery). Report at every gate. The run is DONE only when the **Launch Hub is
deployed and the user can log into every app from it with the seeded
credentials.**

## PARALLELIZATION RULE (user directive — applies to ALL coordinators)

Realize every parallel track as a **SEPARATE maestro session**
(`maestro session spawn`, Opus 4.8 1M) that runs its **own dynamic Workflow** —
NOT multiple workflows inside one coordinator's context. The coordinator spawns
worker sessions (one per track / domain / app / failing-bucket), gates and
aggregates; each worker session owns its slice and fans out its own agent team
via the Workflow tool. More true concurrency, isolated budgets, cleaner
recovery. The UI-build coordinator = one session PER APP (8), each running its
workflow.
