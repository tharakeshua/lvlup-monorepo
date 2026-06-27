# Student Vertical — End-to-End (scoped) Plan

> Goal (user, 2026-06-23): complete **ONE app end to end** — the **student web
> app** (`apps/student-web`), with **spaces content**, **properly seeded data on
> the REAL Firebase project** (same project, collections **prefixed** to isolate
> v2 from legacy), and the **screens linked to the fat SDK**. The screens
> already exist; this is a wiring + seed + prefix job, not a build-from-scratch.

## Decisions (locked)

- **App:** student-only — `apps/student-web` (React/Vite, ~25 pages already
  built). NOT mobile/RN (no Expo app exists; deferred).
- **Seed target:** the **real** project `lvlup-ff6fa`, collections **prefixed**
  (e.g. `LVLUP_COLLECTION_PREFIX=v2_`) so v2 data is isolated from legacy
  collections in the same project. Idempotent.
- **SDK = the FAT callable SDK** (`@levelup/query` → `@levelup/api-client` →
  callables), NOT the legacy `@levelup/shared-hooks` (which read Firestore
  directly client-side). "Link the SDK" = migrate the app off direct-Firestore
  hooks onto the callable SDK. This also keeps the prefix **server-side only**.

## Current state (verified on disk)

- `apps/student-web` = complete screens: SpacesListPage, SpaceViewerPage,
  StoryPointViewerPage, MaterialViewer, ProgressPage, DashboardPage, LoginPage,
  Tests/Practice, Store, Profile, etc.
- It is **hybrid**: some pages use `@levelup/shared-hooks` (legacy, direct
  client Firestore reads via `getFirebaseServices().db`); several local hooks
  (`useStoryPoints`, `useSpaceItems`, `useTestSession`, …) + pages also read
  Firestore directly. **All of this must move to `@levelup/query`.**
- New SDK `@levelup/query` already exposes the full student surface:
  `useSpaces`, `useSpace`, `useSpaceDetailView`, `useStoryPoints`,
  `useStoryPointProgress`, `useItems`, `useSpaceProgress`, `useTestSession(s)`,
  `useStudentSummary`, gamification + chat hooks.
- Callables exist: `functions/sdk-v1/levelup.ts` (+ `identity.ts`,
  `bootstrap.ts`).
- Seed engine ready: `packages/seed` — 5 spaces (DSA published + …) w/
  storyPoints+items, students (`nandini@learner.dev` / `Student@123`), cohort,
  answer-keys, progress.
- **Prefix lives in 2 files only:**
  `packages/services/src/repo-admin/paths.ts` +
  `packages/seed/src/engine/paths.ts` (seed mirrors repo-admin). Client never
  sees collection paths.

## Prefix design

- Single env var `LVLUP_COLLECTION_PREFIX` (default `''` → no change for
  emulator/dev). Applied to **top-level collection names** in the one shared
  path builder; subcollections inherit via their prefixed root.
  - `users`→`v2_users`, `tenants`→`v2_tenants`,
    `userMemberships`→`v2_userMemberships`, `tenantCodes`→`v2_tenantCodes`,
    `globalEvaluationPresets`→…, `platformActivityLog`→…, and the flat ones
    (`spaceProgress`, `costSummaries`, `digitalTestSessions`).
- Firebase **Auth is shared** (cannot prefix) — seed uses distinct emails
  (`*@learner.dev`) + custom claims; app scopes by tenant/membership, so no
  collision with legacy.
- Security rules: with the callable SDK the client never reads Firestore, so v2
  client rules can stay **deny-all**; callables use Admin SDK (bypass rules).
  (Legacy rules untouched.)

## Lanes (no file conflicts)

- **SDK-BUILD-COORD** owns `packages/**` + `functions/**`: finish GATE 5
  (callable correctness), then scoped **Phase 6-student**:
  1. Add `LVLUP_COLLECTION_PREFIX` to `repo-admin/paths.ts` + `seed/paths.ts`
     (env-gated, default empty).
  2. Seed the real project `lvlup-ff6fa` under the prefix (idempotent); emit
     `packages/seed/seed-credentials.json`.
  3. Deploy the `levelup` (+ `identity`/`bootstrap` for auth) callables to
     `lvlup-ff6fa`.
  4. Confirm the student read/write ops return seeded data through callables;
     trust boundary holds (no answer keys client-side, scores server-side).
- **S-student-web** (NEW session) owns `apps/student-web/**` ONLY: migrate every
  page/hook from `@levelup/shared-hooks` + direct `firebase/firestore` →
  `@levelup/query`; wire `QueryProvider` + `@levelup/api-client` transport
  (point at `lvlup-ff6fa` callables) + auth/bootstrap. Screens/UI stay intact.
  Remove all direct Firestore imports from the app. Dev against the emulator
  until the callable contract is stable, then flip to the real project.
- **Coordinator (me)** gates + runs the final E2E.

## Slices & gates

- **A — Prefix + Seed (SDK-coord):** prefix in 2 path files; seed real project
  under prefix; creds emitted; reads verified. → GATE A
- **B — Callables live (SDK-coord):** levelup/identity callables deployed to
  `lvlup-ff6fa`; student ops return seeded data; trust boundary verified. → GATE
  B
- **C — App migration (S-student-web):** all student-web data access on
  `@levelup/query`; zero direct Firestore in the app; provider/transport/auth
  wired; typecheck+build green. → GATE C
- **D — E2E vertical (me):** build student-web against real `lvlup-ff6fa`
  (prefixed); log in as `nandini@learner.dev` → Spaces list → DSA space →
  storyPoints → item viewer (materials + question) → record attempt → progress
  reflects. → DONE

Dependencies: A → B; C can develop in parallel (emulator) but its prod cutover
needs B; D needs B+C.

## Reporting

Each session reports at its gate to the coordinator. Recover from
rate-limits/crashes by count-gating disk and re-running only missing units. All
sessions Opus 4.8 1M, each runs its own dynamic Workflow for fan-out.
