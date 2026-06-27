# Student Mobile App — Build Plan (NEW app, on the fat SDK)

> Goal (user, 2026-06-23): build a **NEW mobile (Expo/React Native) student
> app** from the **new design screens** wired to the **fat callable SDK**,
> running against the **seeded v2 real Firebase project**. **Do NOT touch any
> existing `apps/*`** — they are legacy and stay as-is. Everything happens in
> the new app + the SDK.

## Decisions (locked)

- **New app:** `apps/mobile-student` (Expo + expo-router + TypeScript).
  Student/learner role only (not the full family merge; parent deferred).
- **Screens source:** the NEW design prototypes —
  `docs/rebuild-spec/design/build/prototypes/student/` (27 cards) + the
  assembled `build/app/mobile-family/` (App-MobileFamily SPA + ROUTE-TREE.md,
  **learner** half). Lift layout/IA from these; they are the spec. Mobile
  divergence per each screen spec's §10.
- **SDK:** the FAT callable SDK — `@levelup/query` (hooks) →
  `@levelup/api-client` → `@levelup/transport-firebase` (callables). **No direct
  Firestore in the app.** This is the only data path.
- **Backend:** the seeded **real** project `lvlup-ff6fa`, collections prefixed
  `v2_` (done, GATE A). Callables deployed there by SDK-coord (GATE B). Test
  login `nandini@learner.dev` / `Student@123` (see
  `packages/seed/seed-credentials.json`).
- **Styling:** port the Lyceum design tokens to RN (NativeWind v4 preferred so
  Lyceum/Tailwind tokens carry over; else a RN theme + StyleSheet). The 27 cards
  use Lyceum web components (Card/Button/ProgressBar/Tabbar/etc.) — these must
  be **re-implemented as RN components** (no CSS in RN).

## ⚠️ De-risk FIRST (Phase 0 gate — do before building 27 screens)

The fat SDK was built for web. Before investing in the full screen set, prove it
runs in Expo/Hermes:

- Firebase JS modular SDK v11 init in RN (no analytics; Auth persistence via
  AsyncStorage; `getFunctions`/`httpsCallable` against `lvlup-ff6fa`, region
  matched to GATE B).
- A thin smoke screen that calls ONE SDK hook (e.g. `useSpaces`) through
  `@levelup/api-client` + `@levelup/transport-firebase` and renders the seeded
  v2 spaces. If the transport/api-client pulls in anything Node-only that breaks
  under Hermes, fix the seam (or add an RN-safe transport shim) NOW.
- **GATE 0:** Expo app boots, logs in as `nandini`, and `useSpaces` returns the
  seeded v2 DSA space on a real device/simulator. Only then proceed.

## Build phases (coordinator session runs a dynamic Workflow; fan out where parallel)

- **Phase 0 — Scaffold + theme + SDK runtime + smoke** (foundational, single
  track): Expo scaffold, NativeWind + Lyceum tokens, QueryProvider, api-client
  transport → `lvlup-ff6fa`, Firebase RN init, auth/bootstrap, the GATE-0 smoke.
  → GATE 0
- **Phase 1 — RN component library** (fan out by group): port the Lyceum
  primitives the screens need — Card, Button, Badge/Chip, ProgressBar/Meter,
  ListRow, Tabbar, TopBar, Sheet/Drawer, Skeleton, EmptyState, item/material
  renderers (the StoryPoint item viewer is the richest — materials + the
  question types). Map from `build/components/` + `00-FOUNDATION.md`. → GATE 1
- **Phase 2 — Screens** (fan out by tab/flow, per the mobile-family learner
  ROUTE-TREE): **Home** dashboard · **Learn** (spaces-list →
  space-detail-learning-track → learning-content-view item viewer) · **Tests**
  (tests-list → timed-test-landing → timed-test-runner full-screen →
  test-results-review/analytics) · **Progress** (progress-analytics,
  gamification/xp/streaks, achievements, goals, leaderboard) · **Profile**
  (profile, settings, notifications, ai-tutor-chat drawer,
  store-browse/detail/checkout). Each screen wired to its `@levelup/query` hook.
  NO orphans — every learner screen in the route tree maps to a node. → GATE 2
- **Phase 3 — Wire flows + verify**: navigation/tabbar/role(student) wired, deep
  flows route correctly, build + typecheck green, runs against seeded v2
  `lvlup-ff6fa`. → GATE 3
- **Phase 4 (coordinator/me) — E2E vertical**: login as `nandini` → Learn → DSA
  space → storyPoints → item viewer (materials + answer a question → record
  attempt) → Progress reflects. → DONE

## Lanes (no conflicts)

- **S-mobile-student** (this coordinator) owns `apps/mobile-student/**` ONLY.
  May add RN-safe shims under the SDK ONLY if Phase 0 proves a Node-only break —
  coordinate with SDK-coord before editing `packages/**`.
- **SDK-BUILD-COORD** owns `packages/**` + `functions/**` (finishing GATE B:
  callables deployed to `lvlup-ff6fa` + transport config). The mobile app
  consumes that.
- All sessions Opus 4.8 1M; each runs its own dynamic Workflow. Report at each
  GATE.
