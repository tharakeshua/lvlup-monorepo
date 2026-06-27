# Mobile Student Build — Parallel Contract (disjoint lanes)

> Enables MANY maestro sessions to build `apps/mobile-student` concurrently
> without conflict. Each session owns a **disjoint directory subtree** and codes
> against the **shared contracts** below. Coordinator (S-mobile-student-2) runs
> the GATE-0 prod proof, integrates, and ships the phone build.

## Hard rules

- **Lane = a directory subtree.** Never edit outside your lane. Shared files
  (`src/app/_layout.tsx`, barrels) are owned by the **shell** lane only; others
  import, never edit them.
- **Stub-first:** the components lane FIRST commits typed stub exports for EVERY
  component (placeholder render), so screen lanes import + compile immediately
  and never block. Then it fleshes them out.
- **No direct Firestore.** Screens get data ONLY via `@levelup/query` hooks. No
  `firebase/firestore` imports anywhere in the app.
- **Styling:** NativeWind v4 classes + the Lyceum theme tokens from `src/theme`.
  Match look to `~/Desktop/lvlup-mobile/Lyceum-Mobile-Family.html` (learner
  routes); structure from
  `docs/rebuild-spec/design/build/app/mobile-family/_build/<screen>.viewjs+viewcss`.
- All sessions Opus 4.8 1M; each runs its own dynamic Workflow to fan out within
  its lane. Report at your gate.

## Folder layout (lanes)

```
apps/mobile-student/src/
  sdk/            [DONE — do not edit]  firebase/api/session/SdkProvider/env
  theme/          [LANE: components]    Lyceum tokens, colors, type scale, spacing → RN
  components/     [LANE: components]    RN Lyceum library (barrel: src/components/index.ts)
  app/            [LANE: shell]         expo-router tree, tab navigator, role shell, providers wiring
  screens/
    home/         [LANE: home-profile]
    learn/        [LANE: learn]
    tests/        [LANE: tests]
    progress/     [LANE: progress]
    profile/      [LANE: home-profile]  (profile, settings, notifications, tutor, store, consumer)
  lib/            [LANE: shell]         shared helpers (formatters, route consts)
```

## Component contract (LANE: components — stub all first)

Barrel `src/components/index.ts` MUST export these (typed), each accepting
`className?` + standard children where sensible: `Screen` (safe-area scroll
container), `Card`, `Button` (variant: primary|secondary|ghost|danger; size),
`Badge`/`Chip`, `Avatar`, `ProgressBar`, `Meter`/`Ring`, `StatTile`, `ListRow`,
`SectionHeader`, `Tabbar` (bottom, items+active), `TopBar` (title, right slot),
`Sheet`/`Drawer` (modal), `Skeleton`, `EmptyState`, `Pill`/`Tag`, `XPChip`,
`StreakChip`, `Divider`, `IconButton`, `SearchField`, `TextField`, and the
item-render kit for the learning view: `MaterialBlock`
(text/code/image/video/file), `QuestionView` (mcq, multi-select, short-answer,
numeric, true-false, code, match — all UnifiedItem types), `AttemptBar`. Icons:
lucide-react-native. Props should mirror the Lyceum web components in
`docs/rebuild-spec/design/build/components/`.

## Screen → @levelup/query hook map (each screen lane)

- **home/**: `student-home-dashboard` → `useStudentSummary`,
  `useSpaces`(recent), `useStudentLevel`, `useStoryPointProgress`.
- **learn/**: `spaces-list` → `useSpaces`; `space-detail-learning-track` →
  `useSpaceDetailView`/`useSpace`+`useStoryPoints`+`useSpaceProgress`;
  `learning-content-view` (ITEM VIEWER, richest) →
  `useItems`(+`useStoryPointProgress`) and the attempt mutation (record item
  attempt) from `@levelup/query` mutations.
- **tests/**: `tests-list` → `useTestSessions`; `timed-test-landing` →
  `useTestSession`+`useTestSessionDeadline`; `timed-test-runner` (full-screen) →
  test-session mutations; `test-results-review`/`test-session-analytics` →
  results hooks.
- **progress/**: `progress-analytics` → `useSpaceProgress`/`useStudentSummary`;
  `gamification-xp-streaks` → `useGamificationSummary`/`useStudentLevel`;
  `achievements` → `useStudentAchievements`; `goals` → `useStudyGoals`;
  `leaderboard` → `useLeaderboardSnapshot`/`useGamificationLeaderboardLive`.
- **profile/**: `profile`/`consumer-profile` → `useStudentSummary`; `settings`;
  `notifications` → notifications hook; `ai-tutor-chat` →
  `useChatSession`/`useChatStream`;
  `store-browse`/`store-space-detail`/`checkout` →
  `useStoreSpaces`/`useStoreSpace`.

Each screen: loading (Skeleton), error, empty states. Export a default screen
component; the shell lane mounts it in the router.

## Shell lane (src/app + tab navigator)

Bottom tabs (learner): **Home · Learn · Tests · Progress · Profile**. Wire each
tab + sub-routes (learn stack: list→detail→item viewer; tests stack incl.
full-screen runner with no tabbar; modals: tutor, notifications, checkout).
Import screens from `../screens/*`. Owns provider wiring (already in sdk/).
Provide `src/lib/routes.ts` consts the screen lanes import for navigation.

## Coordinator (S-mobile-student-2)

GATE-0 prod proof first (login nandini → useSpaces → DSA). Maintain this
contract. Integrate lanes, resolve any interface drift, run build green, ship
the **phone build** (expo start → Expo Go QR pointed at prod `lvlup-ff6fa`) +
`apps/mobile-student/PHONE-TEST.md`.

---

## ⚠️ GATE-0 STATUS = CLOSED (live prod proof passed) + DEPLOYED-BACKEND DRIFTS (read this)

Coordinator ran the live prod proof: `nandini@learner.dev` → fat SDK →
`listSpaces` returned 5 seeded v2 spaces incl. **Data Structures & Algorithms**
`[spc_content-levelup-space-space-dsa_26218a59b7]`. The data path WORKS against
`lvlup-ff6fa`. Two GATE-B server↔contract drifts were found and worked around
**at the composition root only** (`src/sdk` — no lane touches this):

1. **Request-envelope drift (FIXED in `src/sdk/transport-compat.ts`).** Deployed
   callables reject the api-client's `__apiVersion` key. The shim drops
   `__apiVersion` and renames `__idempotencyKey`→`idempotencyKey` before invoke.
   Transparent to all lanes.

2. **Response-shape drift (response validation turned OFF in
   `src/sdk/api.ts`).** The deployed `listSpaces` (and likely other reads)
   return payloads whose **runtime shape differs from the
   `@levelup/query`/api-contract TypeScript types**. Known divergences on the
   space object:
   - `price` → a **number**, not the `{ amount, currency }` object the type
     implies.
   - `ratingAggregate` → `{ average, count }`, NOT
     `{ averageRating, totalReviews, distribution }`.
   - `stats` carries an extra `enrollmentCount`; `publishedAt` may be
     **missing/undefined**.
   - `type` / `accessType` enum values may fall outside the contract enums.

   **→ Screen lanes: code DEFENSIVELY.** Do not assume a field is present or
   matches the TS type exactly. Guard every nested read
   (`space?.ratingAggregate?.average ?? space?.ratingAggregate?.averageRating ?? 0`),
   default missing values, and never `.toFixed()`/index into a
   possibly-undefined nested object. Render real titles/ids/descriptions (those
   are correct); treat price/rating/stats as best-effort. (SDK-coord will
   realign schemas + redeploy; until then the data is real but loosely-shaped.)

**Phone target:** `apps/mobile-student/.env` sets
`EXPO_PUBLIC_USE_EMULATORS=false` → prod `lvlup-ff6fa` (a physical phone can't
reach localhost emulators).

**Gotcha (shell):** expo-router route GROUPS with parens — `src/app/(learner)/…`
— BREAK Metro's pnpm module resolution here (can't resolve `expo-router` from
inside the group; bundle dies ~1112 modules). Use a REAL segment
`src/app/learner/…` instead (routes become `/learner/home`, which also matches
the design `#/learner/*` namespace).

**Common type seams (all screen lanes):** (1) `npx tsc` resolves to a DECOY
package here — ALWAYS verify with
`PATH=/opt/homebrew/opt/node@20/bin:$PATH pnpm exec tsc --noEmit`. (2) Route
params + `useSession().user.uid` are plain `string`; hooks/components want
branded ids —
`import type { UserId, SpaceId, StoryPointId, TestSessionId } from '@levelup/domain'`
and cast at the call boundary (`uid as UserId`). (3) The list hooks
(`useStudentAchievements`/`useStudyGoals`/…) return a FLAT array/object, NOT an
infinite-query `{pages:[…]}`.
