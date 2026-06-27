# Gamification — SDK + Server Vertical Slice Plan

> **Domain key:** `gamification` (achievements / levels & XP / story-point
> points / leaderboards / streaks / study goals & sessions).
>
> **Module ownership.** Gamification is **derived, server-authoritative state**.
> Almost nothing in it is a primary client write: levels/XP, achievement
> unlocks, leaderboard ranks, and streak counters are _projections computed by
> triggers_ off `spaceProgress` / `studentProgressSummaries` writes (see live
> `update-leaderboard.ts`, `on-progress-milestone.ts`,
> `on-user-story-point-progress-write.ts`). The only genuine client-initiated
> writes are **study goals** (a student planner CRUD) and the **mark-seen**
> acknowledgement on an unlocked achievement. Everything else the SDK only
> **reads** projections of.
>
> Callables live in the **`levelup` codebase** (functions/levelup) for the
> student-facing read/CRUD endpoints, plus **`analytics`** owns the derivation
> triggers/leaderboard fan-out (it already does today). The contract namespaces
> them under `v1.levelup.*` for student reads and `v1.gamification.*` is folded
> into `levelup` module to avoid a 5th codebase (module discriminator on
> `CallableDef` stays one of `identity|levelup|autograde|analytics`; the
> callable _name segment_ is `gamification`). Where a name reads cleaner we use
> `v1.levelup.<op>` for the student planner ops and
> `v1.levelup.listAchievements` etc.
>
> **Authority one-liner for this domain:** the server is the _sole writer_ of
> `StudentLevel` (level/XP/tier), `StudentAchievement` (unlock + denormalized
> snapshot), all leaderboard nodes (RTDB), and `streakDays`/`pointsEarned`
> counters. The SDK reads them and may write only `StudyGoal` (its own) and flip
> `StudentAchievement.seen`.

---

## Domain entities (`@levelup/domain`)

All entities are **Zod-first `.strict()`**; types via `z.infer`. All timestamps
are **ISO-8601 `Timestamp`** (reconciles REVIEW D4 — the live model uses
`FirestoreTimestamp` for achievement audit + epoch-millis nowhere here, but
`StudySession.date`/`StudyGoal.startDate` are already ISO date strings; we
standardize _instants_ to ISO `Timestamp` and keep **calendar dates** as a
separate branded `IsoDate` (YYYY-MM-DD) so streak math is timezone-stable). All
IDs branded.

> File: `packages/domain/src/gamification/*.ts`, barrel `index.ts`.

### Branded IDs (add to `domain/branded.ts`)

- `AchievementId` (`asAchievementId`) — achievement _definition_ doc id.
- `StudentAchievementId` (`asStudentAchievementId`) — unlock record doc id
  (`{userId}_{achievementId}` composite, but branded opaque).
- `StudyGoalId` (`asStudyGoalId`).
- `StudySessionId` (`asStudySessionId`).
- Reuses existing branded `UserId`, `TenantId`, `SpaceId`, `StoryPointId`.
  (REVIEW §4: brands must persist _inside_ shapes — these fields are branded on
  the entity, not bare `string`.)

> **authUid vs userId reconciliation (D3).** Gamification entities key on the
> **student's `userId`** (the auth uid of the student), matching the live
> `studentLevels/{userId}`, `studentAchievements`, `studyGoals.userId`. We name
> this field **`userId: UserId`** consistently (the student-app actor). We do
> NOT introduce `authUid` here — that schism is an identity-domain concern;
> gamification only ever references the resolved student `UserId`.

### 1. `Achievement` — badge _definition_ template

`achievementSchema` — `.strict()`.

- `id: AchievementId`
- `tenantId: TenantId`
- `title: string`, `description: string`, `icon: string` (Lucide name)
- `category: AchievementCategory` — enum
  `['learning','consistency','excellence','exploration','social','milestone']`
- `rarity: AchievementRarity` — enum
  `['common','uncommon','rare','epic','legendary']`
- `tier: AchievementTier` — enum
  `['bronze','silver','gold','platinum','diamond']`
- `criteria: AchievementCriteria` (nested `.strict()`)
- `pointsReward: number` (int, ≥0)
- `isActive: boolean`
- `createdAt: Timestamp`, `updatedAt: Timestamp` (ISO; reconciles D4 — was
  `FirestoreTimestamp`)
- `archivedAt: Timestamp | null` — **new**, single soft-delete convention
  (reconciles D5; replaces ad-hoc `isActive` flip-only). `isActive` retained as
  a _display/eligibility_ gate distinct from soft-delete.

### 2. `AchievementCriteria` — embedded value object

`achievementCriteriaSchema` — `.strict()`.

- `type: AchievementCriteriaType` — enum
  `['spaces_completed','story_points_completed','exams_passed','perfect_scores','streak_days','total_points','items_completed','chat_sessions','leaderboard_top3','login_days']`
- `threshold: number` (int, ≥1)
- `subject?: string`
- `spaceId?: SpaceId`

> This is the **evaluation predicate** the server uses to award. It is _not_ a
> discriminated union in the live model; we keep it a flat `.strict()` object
> keyed by `type` (the threshold/subject/spaceId fields are uniform across
> types), but document `type` as the discriminant the award-evaluator switches
> on.

### 3. `StudentAchievement` — unlock record

`studentAchievementSchema` — `.strict()`.

- `id: StudentAchievementId`
- `tenantId: TenantId`
- `userId: UserId`
- `achievementId: AchievementId`
- `achievement: Achievement` — **denormalized snapshot** for display (server
  writes it at unlock time; client never assembles it). Mirrors
  `embed-resolved-rubric` pattern from REVIEW §2 — store the resolved snapshot
  so reads need no second fetch.
- `earnedAt: Timestamp` (ISO)
- `seen: boolean` — the **only** client-mutable field (mark-read pattern).

### 4. `StudentLevel` — XP / level summary (one doc per student)

`studentLevelSchema` — `.strict()`. Path `studentLevels/{userId}`.

- `id: UserId` (doc id == userId)
- `tenantId: TenantId`
- `userId: UserId`
- `level: number` (int, ≥1)
- `currentXP: number` (int, ≥0)
- `xpToNextLevel: number` (int, ≥0)
- `totalXP: number` (int, ≥0)
- `tier: AchievementTier`
- `achievementCount: number` (int, ≥0)
- `updatedAt: Timestamp` (ISO)
- **All fields server-authoritative (⚷).** No client write path.

### 5. `StudyGoal` — student planner target (the ONE client-CRUD entity)

`studyGoalSchema` — `.strict()`. Path `studyGoals/{goalId}`.

- `id: StudyGoalId`
- `tenantId: TenantId`
- `userId: UserId`
- `title: string`, `description?: string`
- `targetType: StudyGoalTargetType` — enum
  `['spaces','story_points','items','exams','minutes']`
- `targetCount: number` (int, ≥1)
- `currentCount: number` (int, ≥0) — **server-derived** projection of progress
  toward the goal; client cannot set it.
- `startDate: IsoDate`, `endDate: IsoDate` (YYYY-MM-DD)
- `completed: boolean` — **server-derived** (set true when
  `currentCount >= targetCount`).
- `completedAt: Timestamp | null` (ISO; was optional `FirestoreTimestamp`)
- `createdAt: Timestamp`, `updatedAt: Timestamp`, `archivedAt: Timestamp | null`
  (D5 soft-delete).

> **Authority split inside StudyGoal:** client owns
> `title/description/targetType/targetCount/startDate/endDate`; server owns
> `currentCount/completed/completedAt` (derived from progress). The save request
> schema accepts only the client-owned fields.

### 6. `StudySession` — study log entry (read-mostly; written by progress writer)

`studySessionSchema` — `.strict()`. Path `studySessions/{sessionId}`.

- `id: StudySessionId`
- `tenantId: TenantId`
- `userId: UserId`
- `date: IsoDate`
- `minutesStudied: number` (int, ≥0)
- `spacesWorked: SpaceId[]`
- `itemsCompleted: number` (int, ≥0)
- `pointsEarned: number` (int, ≥0)

> Aggregated server-side from item attempts (the progress writer emits/updates
> the daily session row). Client reads only — drives the heatmap/streak UI. (No
> schema existed live — REVIEW §4.K lists `StudySession` as schema-less; we
> author it.)

### 7. `LeaderboardEntry` — **read-model only**, not a Firestore entity

`leaderboardEntrySchema` — `.strict()`. Mirror of the RTDB node shape written by
`update-leaderboard.ts` / `on-user-story-point-progress-write.ts`. NEVER
client-writable.

- `userId: UserId`
- `displayName: string` (server-projected; not the raw id)
- `avatarUrl?: string`
- `score: number` — scaled integer rank key (`Math.round(overallScore*1000)` for
  tenant board; raw `pointsEarned` for course/story-point board)
- `overallScore?: number`
- `examAvg?: number`
- `spaceCompletion?: number`
- `totalPoints: number`
- `streakDays: number`
- `tier?: AchievementTier`
- `countsByTier?: Record<AchievementTier, number>` (tenant board only)
- `rank: number` (server-computed at read/projection time)
- `isAtRisk?: boolean`
- `updatedAt: Timestamp` (ISO)

`leaderboardScopeSchema` — enum `['tenant','space','storyPoint']` (maps to RTDB
nodes `tenantLeaderboard/{tenantId}`, `courseLeaderboard/{spaceId}`,
`storyPointLeaderboard/{storyPointId}`).

### 8. `GamificationSummary` — composed view-model (domain shape only; assembled by repo)

`gamificationSummarySchema` — `.strict()`. The student "gamification home"
payload:
`{ level: StudentLevel, recentAchievements: StudentAchievement[], unseenCount: number, currentStreakDays: number, tenantRank: number | null, activeGoals: StudyGoal[] }`.
Used as a response schema (see contract).

### ALLOWED_TRANSITIONS

- **None for achievements/levels/leaderboards** — they have no client-driven
  lifecycle (unlock is monotonic, server-only).
- `StudyGoal` has a soft status derived from `completed`/`archivedAt` but **no
  client-requested transition**; therefore **no `ALLOWED_TRANSITIONS.studyGoal`
  entry** is needed (the only "transition" is server-derived completion).
  Documented explicitly so the build-time transition checker knows this domain
  contributes nothing.

---

## API contract (`@levelup/api-contract`)

> One `CallableDef` per op. **No request carries `tenantId`** (claim-derived).
> `invalidates[]` are query-key roots. All under `module: 'levelup'` (student
> reads) except the achievement-definition admin CRUD which is also `levelup`
> (tenant-admin authoring). Files:
> `packages/api-contract/src/gamification/*.ts`; registered in `CALLABLES`.

### Read endpoints (replace direct Firestore reads in student-web / learner-rn / parent-web)

**`v1.levelup.getGamificationSummary`** — composed student home.

- module `levelup`, authMode `authed`, rateTier `read`, idempotent `false`.
- request: `{ userId?: UserId }` (omitted ⇒ self; parent/teacher may pass a
  child/student `userId`, server authorizes).
- response: `gamificationSummarySchema`.
- invalidates: — (read).

**`v1.levelup.getStudentLevel`**

- rateTier `read`. request `{ userId?: UserId }` → response
  `studentLevelSchema`.

**`v1.levelup.listAchievements`** — achievement _definitions_ catalog (active +
earned-state for the caller).

- rateTier `read`. request
  `{ ...PageRequest, category?: AchievementCategory, onlyActive?: boolean }`.
- response `pageResponse(achievementWithEarnedStateSchema)` where
  `achievementWithEarnedStateSchema = achievementSchema.extend({ earned: boolean, earnedAt: Timestamp.nullable() })`
  — server joins definitions ⨯ caller unlocks (collapses the N+1 the UI would
  otherwise do).

**`v1.levelup.listStudentAchievements`** — the caller's (or a child's) unlock
records.

- rateTier `read`. request
  `{ ...PageRequest, userId?: UserId, unseenOnly?: boolean }` →
  `pageResponse(studentAchievementSchema)`.

**`v1.levelup.getLeaderboard`** — point-in-time projection (non-realtime
fallback / first paint).

- rateTier `read`. request
  `{ scope: leaderboardScope, spaceId?: SpaceId, storyPointId?: StoryPointId, ...PageRequest }`.
  Validation: `scope==='space'` requires `spaceId`; `scope==='storyPoint'`
  requires `storyPointId`.
- response:
  `pageResponse(leaderboardEntrySchema).extend({ callerEntry: leaderboardEntrySchema.nullable() })`
  — server always includes the caller's own row + rank even if off the visible
  page.

**`v1.levelup.listStudySessions`** — heatmap/streak feed.

- rateTier `read`. request
  `{ userId?: UserId, fromDate?: IsoDate, toDate?: IsoDate }` →
  `{ sessions: studySession[], streakDays: number, longestStreak: number }`
  (`.strict()`).

**`v1.levelup.listStudyGoals`**

- rateTier `read`. request
  `{ ...PageRequest, userId?: UserId, includeCompleted?: boolean, includeArchived?: boolean }`
  → `pageResponse(studyGoalSchema)`.

### Write endpoints

**`v1.levelup.saveStudyGoal`** — upsert (the `save*` convention; no id ⇒
create).

- rateTier `write`, idempotent `true` (idempotencyKey on create).
- request:
  `{ id?: StudyGoalId, data: { title, description?, targetType, targetCount, startDate, endDate, deleted?: boolean } }`
  — **client-owned fields only**;
  `currentCount/completed/completedAt/userId/tenantId` rejected by `.strict()`.
- response: `SaveResponse { id: StudyGoalId, created: boolean }`.
- invalidates: `['studyGoals','gamificationSummary']`.

**`v1.levelup.markAchievementsSeen`** — flip `seen` on one or many unlocks
(mark-read).

- rateTier `write`, idempotent `true`.
- request: `{ achievementIds: StudentAchievementId[] }` (≤50) **or**
  `{ all: true }`.
- response: `{ updated: number }` (`.strict()`).
- invalidates: `['studentAchievements','gamificationSummary']`.
- **On the conservative optimistic allow-list** (it's a mark-read — REVIEW §5.5
  explicitly permits notification/seen toggles).

**`v1.levelup.saveAchievementDefinition`** _(tenant-admin authoring — NOT
student)_ — upsert a badge template.

- rateTier `write`, idempotent `false`. authMode `authed`.
- request:
  `{ id?: AchievementId, data: { title, description, icon, category, rarity, tier, criteria, pointsReward, isActive, deleted?: boolean } }`.
- response: `SaveResponse`.
- invalidates: `['achievements']`.
- authorize key `gamification.manageAchievements` (tenant-admin only).

### SUBSCRIPTIONS (realtime — leaderboards are RTDB-live today)

Add to `SUBSCRIPTIONS` registry:

- **`v1.levelup.leaderboardLive`** —
  `{ params: z.object({ scope: leaderboardScope, spaceId: z.string().optional(), storyPointId: z.string().optional(), limit: z.number().int().max(100).default(50) }), payload: z.object({ entries: z.array(leaderboardEntrySchema), callerRank: z.number().nullable() }) }`.
  transport-firebase subscribes the matching RTDB node
  (`tenantLeaderboard/{tenantId}` etc.), client-side sorts by `score` desc →
  rank. (Mirrors live `LeaderboardService`.)
- **`v1.levelup.achievementUnlock`** —
  `{ params: z.object({}), payload: studentAchievementSchema }`. Fires when a
  new unlock lands for the signed-in student (Firestore listener on
  `studentAchievements` where `userId == self && seen == false`). Drives the
  toast/confetti.
- **`v1.levelup.studentLevelLive`** —
  `{ params: z.object({}), payload: studentLevelSchema }`. Live XP-bar update on
  `studentLevels/{self}`.

---

## Repositories (`@levelup/repositories`)

> File: `packages/repositories/src/gamification/*.ts`, factory
> `createGamificationRepos(api)`. Per-entity repos plus a cross-entity **view**
> repo.

### `achievementRepo` (definitions + unlock state)

- `listCatalog(filter?: { category?, onlyActive? })` →
  `paginate(cursor => api.levelup.listAchievements({...filter, cursor}))`.
  Returns `Page<AchievementWithEarnedState>`; cursor hidden.
- `listEarned(opts?: { userId?, unseenOnly? })` →
  `paginate(... api.levelup.listStudentAchievements ...)`.
- `markSeen(ids: StudentAchievementId[] | { all: true })` →
  `api.levelup.markAchievementsSeen(...)`.
- **Shaping/derived:** `groupByCategory(catalog)` (view-model grouping for the
  badge wall); `unseenCount(earned)` (derived count the UI shouldn't recompute).

### `studentLevelRepo`

- `get(userId?)` → `api.levelup.getStudentLevel({ userId })`.
- **Derived:** `progressToNext(level): number` =
  `currentXP / (currentXP + xpToNextLevel)` clamped 0..1 — UI never recomputes
  the XP bar fraction.

### `leaderboardRepo` (cross-entity **view** repo — marked VIEW)

- `getPage(scope, opts)` → `paginate(... api.levelup.getLeaderboard ...)`,
  always exposes `callerEntry`.
- **Shaping:** `assignRanks(entries, startOffset)` (dense rank across pages);
  `mergeLive(snapshotPage, rtdbPayload)` — reconcile the first-paint REST
  projection with the realtime RTDB stream so the UI gets one coherent list
  (batching/N+1 collapse: one read + one subscription, not per-row fetches).
- **Transition pre-checks:** none (no lifecycle).

### `studyGoalRepo`

- `list(opts?)` → `paginate(... api.levelup.listStudyGoals ...)`.
- `save(input: SaveStudyGoalInput)` → `api.levelup.saveStudyGoal(input)`.
- `archive(id)` → `save({ id, data: { deleted: true } })` (soft-delete sugar).
- **Derived:** `progressPct(goal)` = `currentCount/targetCount` clamped;
  `daysRemaining(goal)` from `endDate`; `isOverdue(goal)`.
- **Pre-check:** `canEdit(goal)` = `!goal.archivedAt && !goal.completed` (UX
  disable; server still enforces).

### `studySessionRepo`

- `list(range?)` → `api.levelup.listStudySessions({...range})` (already returns
  `streakDays/longestStreak`, server-computed).
- **Shaping:** `toHeatmap(sessions)` → dense `IsoDate → intensity` map for the
  calendar heatmap (fills gaps, normalizes intensity).

### `gamificationViewRepo` (cross-entity **VIEW** — dashboards)

- `summary(userId?)` → `api.levelup.getGamificationSummary({ userId })` — the
  single composed call backing the student home + parent child-overview,
  collapsing what would be 5 separate reads (level + recent achievements +
  streak + rank + goals) into **one** server-aggregated round-trip. This is the
  N+1-collapse win flagged for parent-web in REVIEW.
- Cross-repo composition only via this declared view repo (repos don't import
  each other — SDK-DESIGN §7.2 god-object guard).

---

## Query hooks (`@levelup/query`)

> File: `packages/query/src/gamification/*.ts`. Query-key factories + hooks +
> invalidation. Optimistic allow-list noted.

### Query-key factories

```
gamificationKeys = {
  all: ['gamification'],
  summary: (userId?) => [...all, 'summary', userId ?? 'self'],
}
achievementKeys = {
  all: ['achievements'],
  catalog: (f?) => [...all, 'catalog', f ?? {}],
  earned: (userId?, unseenOnly?) => [...all, 'earned', userId ?? 'self', !!unseenOnly],
}
levelKeys = { all: ['studentLevel'], detail: (userId?) => [...all, userId ?? 'self'] }
leaderboardKeys = {
  all: ['leaderboard'],
  scope: (scope, id?) => [...all, scope, id ?? null],
}
studyGoalKeys = { all: ['studyGoals'], list: (userId?, f?) => [...all, userId ?? 'self', f ?? {}] }
studySessionKeys = { all: ['studySessions'], range: (userId?, r?) => [...all, userId ?? 'self', r ?? {}] }
```

### Read hooks

- `useGamificationSummary(userId?)` → `gamificationViewRepo.summary`; key
  `gamificationKeys.summary`.
- `useStudentLevel(userId?)` → key `levelKeys.detail`.
- `useAchievementCatalog(filter?)` → `useInfiniteQuery`, key
  `achievementKeys.catalog`.
- `useStudentAchievements(opts?)` → `useInfiniteQuery`, key
  `achievementKeys.earned`.
- `useLeaderboard(scope, opts?)` → `useInfiniteQuery`, key
  `leaderboardKeys.scope`. Pairs with realtime hook below.
- `useLeaderboardLive(scope, params)` →
  `useSubscription('v1.levelup.leaderboardLive', ...)`; repo `mergeLive`
  reconciles with the cached page.
- `useAchievementUnlockStream()` →
  `useSubscription('v1.levelup.achievementUnlock', {})` — feeds a toast; on
  payload, `qc.invalidateQueries(achievementKeys.earned())` +
  `gamificationKeys.summary()`.
- `useStudentLevelLive()` →
  `useSubscription('v1.levelup.studentLevelLive', {})`; writes payload straight
  into `levelKeys.detail('self')` cache.
- `useStudyGoals(opts?)` → `useInfiniteQuery`, key `studyGoalKeys.list`.
- `useStudySessions(range?)` → key `studySessionKeys.range`.

### Mutation hooks

- **`useMarkAchievementsSeen()`** — `studentAchievementRepo.markSeen`. **ON THE
  CONSERVATIVE OPTIMISTIC ALLOW-LIST**: optimistically flip `seen=true` in
  `achievementKeys.earned()` cache + decrement `unseenCount` in
  `gamificationKeys.summary()`, rollback on error, reconcile on success.
  Invalidates `achievementKeys.earned()`, `gamificationKeys.summary()`.
- **`useSaveStudyGoal()`** — `studyGoalRepo.save`. **NOT optimistic**
  (`currentCount/completed` are server-derived; an optimistic create would show
  wrong progress). On success invalidate `studyGoalKeys.list()` +
  `gamificationKeys.summary()`.
- **`useArchiveStudyGoal()`** — thin over `save({deleted:true})`; same
  invalidations; not optimistic.
- **`useSaveAchievementDefinition()`** _(admin)_ —
  `achievementRepo.saveDefinition`; **NOT optimistic**
  (authoring/lifecycle-adjacent); invalidates `achievementKeys.all`.

> Leaderboard, level, and achievement _unlock_ are **never** optimistic — they
> are §4-⚷ derived/authoritative values; only `markSeen` qualifies.

---

## Server services (`@levelup/services`)

> `fn(input, ctx: AuthContext)`. **server-only** services live in
> `@levelup/services/server` (write authoritative/derived counters +
> claims-adjacent + admin CRUD); **client-safe** read-shapers in
> `@levelup/services/shared` (pure projection of already-authorized data).
> authorize() keys from `@levelup/access`.

### services/shared (read projections — no authoritative writes)

- **`getGamificationSummaryService(input, ctx)`** — authorize
  `gamification.read` (self, or
  `gamification.readChild`/`gamification.readStudent` for parent/teacher). Reads
  `studentLevels/{userId}`, recent `studentAchievements`, `studyGoals`, streak
  from `studySessions`, tenant rank from RTDB; composes `GamificationSummary`.
  Pure read.
- **`getStudentLevelService`** — authorize `gamification.read`; project
  `studentLevels/{userId}`.
- **`listAchievementsService`** — authorize `gamification.read`; join active
  `achievements` ⨯ caller `studentAchievements` → earned-state page (server-side
  join kills the client N+1).
- **`listStudentAchievementsService`** — authorize `gamification.read`;
  paginated unlocks (optionally `unseenOnly`).
- **`getLeaderboardService`** — authorize `gamification.read`; read RTDB node
  for scope, compute ranks, project `displayName`/`avatarUrl` (NOT raw ids of
  _other_ students beyond display projection), always append `callerEntry`.
  Tenant-scoped: only same-tenant board (tenantId from ctx).
- **`listStudySessionsService`** — authorize `gamification.read`; range query +
  server streak computation (`streakDays`, `longestStreak`).
- **`listStudyGoalsService`** — authorize `gamification.read`; paginate
  `studyGoals` filtered by `userId` (self unless authorized child/student).

### services/server (authoritative / derived writes ⚷)

- **`saveStudyGoalService(input, ctx)`** — authorize
  `gamification.manageOwnGoals` (student self only; parent/teacher denied
  write). Upsert **client-owned fields only**; server stamps `tenantId` (ctx),
  `userId` (ctx.uid), recomputes nothing on create; on every write recomputes
  `currentCount/completed/completedAt` from current progress (single-writer of
  derived goal fields). Idempotent on create via `idempotencyKey`.
- **`markAchievementsSeenService(input, ctx)`** — authorize
  `gamification.manageOwnAchievements`; batch-flip `seen=true` only on the
  caller's own unlock docs (ownership-scoped); returns `updated`.
- **`saveAchievementDefinitionService(input, ctx)`** — **server-only, admin** —
  authorize `gamification.manageAchievements` (tenantAdmin). Upsert
  `achievements/{id}`, `.strict()`-validated criteria, stamps audit +
  soft-delete.
- **`awardAchievementsService(input, ctx)`** — **server-only, internal**
  (invoked by triggers, not a callable). Single-writer of
  `studentAchievements` + `studentLevels`. Evaluates `AchievementCriteria`
  against the changed progress/summary, idempotently creates unlock docs (dedupe
  on `{userId}_{achievementId}`), increments
  `StudentLevel.totalXP/currentXP/level/tier/achievementCount`, writes the
  denormalized `achievement` snapshot, enqueues the unlock notification via
  outbox. ctx is a **system context** (no end-user uid).
- **`recomputeStudyGoalProgressService(input, ctx)`** — **server-only,
  internal** — single-writer that recomputes `currentCount/completed` for a
  student's active goals when progress changes (invoked by progress trigger).
- **`upsertLeaderboardEntryService(input, ctx)`** — **server-only, internal** —
  single-writer of RTDB leaderboard nodes (tenant/course/storyPoint), idempotent
  per `(scope,id,userId)`; mirrors live `update-leaderboard.ts` +
  `on-user-story-point-progress-write.ts` logic but as a service the triggers
  call.

### authorize() policy keys (in `@levelup/access`)

- `gamification.read` (self), `gamification.readChild` (parent→linked student),
  `gamification.readStudent` (teacher→class student) — read projections.
- `gamification.manageOwnGoals`, `gamification.manageOwnAchievements` — student
  self-writes.
- `gamification.manageAchievements` — tenantAdmin authoring of definitions.

---

## Function shells (callable / trigger / scheduler)

> Thin `onCall` adapters → services. Triggers single-writer + idempotent +
> outbox. Lives across `functions/levelup` (student callables) and
> `functions/analytics` (derivation triggers, as today).

### Callable adapters (`functions/levelup/src/callable/`)

Each is `buildAuthContext → parseRequest(Zod) → service`:

- `v1.levelup.getGamificationSummary` → `getGamificationSummaryService`
- `v1.levelup.getStudentLevel` → `getStudentLevelService`
- `v1.levelup.listAchievements` → `listAchievementsService`
- `v1.levelup.listStudentAchievements` → `listStudentAchievementsService`
- `v1.levelup.getLeaderboard` → `getLeaderboardService`
- `v1.levelup.listStudySessions` → `listStudySessionsService`
- `v1.levelup.listStudyGoals` → `listStudyGoalsService`
- `v1.levelup.saveStudyGoal` → `saveStudyGoalService`
- `v1.levelup.markAchievementsSeen` → `markAchievementsSeenService`
- `v1.levelup.saveAchievementDefinition` → `saveAchievementDefinitionService`

### Triggers (`functions/analytics/src/triggers/`)

- **`onProgressWrite_awardAchievements`** — on
  `tenants/{tenantId}/spaceProgress/{progressId}` (and/or
  `studentProgressSummaries/{studentId}`). Thin over
  `awardAchievementsService` + `recomputeStudyGoalProgressService`.
  **Single-writer** of `studentAchievements`/`studentLevels`/goal-derived
  fields; **idempotent** (re-running on the same progress delta unlocks nothing
  new — dedupe by existing unlock docs and by comparing before/after
  thresholds); **outbox** for the unlock notification (must-deliver). Subsumes
  the achievement half of today's milestone logic.
- **`onProgressSummaryWrite_updateLeaderboard`** — on
  `tenants/{tenantId}/studentProgressSummaries/{studentId}`. Thin over
  `upsertLeaderboardEntryService` (tenant + per-space nodes). Replaces live
  `update-leaderboard.ts`. Single-writer of RTDB nodes; idempotent
  (last-write-wins on the entry; deletion path cleans nodes).
- **`onStoryPointProgressWrite_updateLeaderboard`** — on
  `spaceProgress/{progressId}`. Thin over
  `upsertLeaderboardEntryService(scope:'storyPoint')`. Replaces live
  `on-user-story-point-progress-write.ts`. Idempotent per newly-completed story
  point.
- **`onProgressMilestone_notify`** — on `studentProgressSummaries/{studentId}`.
  The _notification_ half of today's `on-progress-milestone.ts` (first-exam,
  80%-cross, streak-7, at-risk transitions). Outbox-delivered; not authoritative
  state (it only sends). Achievement-granting milestones are migrated to the
  award service above so milestones don't double-write.

### Schedulers (`functions/analytics/src/schedulers/`)

- **`nightlyStreakReconciler`** (cron, per-tenant) — recompute
  `StudentLevel`-adjacent `streakDays` and finalize/expire study-session streaks
  at the tenant day boundary (the streak counter must decay when a student
  misses a day; triggers alone can't fire on "absence"). Single-writer of streak
  fields via a dedicated `reconcileStreaksService`. Idempotent (recompute from
  `studySessions`).
- **`weeklyLeaderboardSnapshot`** (cron, optional) — materialize a point-in-time
  top-N snapshot per tenant for the `getLeaderboard` REST first-paint (so cold
  reads don't hammer RTDB) and for historical "last week's rank" deltas.

### Cloud Tasks orchestration

- Achievement award fan-out is **single-step** (evaluate → write → enqueue
  notification) so it stays a plain trigger + outbox, **no Cloud Tasks needed**.
  If a future tenant has hundreds of criteria evaluated per progress write,
  promote `awardAchievementsService` evaluation to a Cloud Tasks queue keyed by
  `studentId` (single-concurrency per student to preserve single-writer). Noted
  as the scale-out seam; not built v1.

---

## Authority boundary (server-only ⚷)

Maps to REVIEW §6:

- **`StudentLevel` (level / currentXP / totalXP / tier / achievementCount)** —
  derived counters; trigger-maintained, SDK reads never writes. (REVIEW §6.9
  denormalized counters/aggregates.)
- **`StudentAchievement` unlock + denormalized `achievement` snapshot +
  `earnedAt`** — server is sole writer; only `seen` is client-mutable (and only
  on own docs). Unlock criteria evaluation is server-only (criteria thresholds
  are an authority input). (§6.9.)
- **All leaderboard nodes (RTDB tenant/course/storyPoint)** — trigger-written
  projections of progress summaries; client subscribes/reads, never writes. Rank
  computed server/SDK-read-side, never client-trusted for authority. (§6.9.)
- **`StudyGoal.currentCount / completed / completedAt`** — server-derived from
  progress; client may not set them (only `title/target/dates`). (§6.9 — derived
  projection.)
- **`StudySession` rows** — written by the progress writer (server) from item
  attempts; client read-only. `streakDays/longestStreak` computed server-side.
  (§6.6 session-authority-adjacent: streak is derived from authoritative attempt
  timestamps, not client clock.)
- **Achievement _definitions_ (`achievements`)** — authored only by
  `gamification.manageAchievements` (tenantAdmin); `criteria`/`pointsReward` are
  scoring-relevant authority (§6.7 analog — they define how points/badges are
  earned), gated to authoring roles.
- **`pointsReward` / XP economy constants** — server-owned; client cannot
  influence how much XP an action grants. (§6.5 grading/scoring analog: points
  are a scoring output.)
- **Tenant scoping** — every gamification read/write is tenant-scoped from
  `ctx.tenantId` (claims), never request body. (§6.1.)

---

## Drift & open questions

### Reconciliations from REVIEW drift table

- **D4 (timestamp trichotomy):** achievement audit timestamps move
  `FirestoreTimestamp → ISO Timestamp`; calendar fields
  (`StudyGoal.startDate/endDate`, `StudySession.date`) become branded `IsoDate`
  (already ISO-ish live). Streak math keyed on `IsoDate` at the **tenant day
  boundary**, not epoch — fixes timezone-ambiguous streak counting.
- **D5 (soft-delete):** `Achievement`, `StudyGoal` get
  `archivedAt: Timestamp | null` as the single soft-delete;
  `Achievement.isActive` is **retained** but redefined as an
  _eligibility/display_ gate (a paused-but-not-deleted badge), distinct from
  archive. `saveStudyGoal`/`saveAchievementDefinition` accept
  `data.deleted=true` to set `archivedAt`.
- **D6 (record-maps):** `StudentAchievement` is already a **per-doc collection**
  (good — no fat record-map). `StudyGoal`/`StudySession` are per-doc. No
  explosion needed; gamification is already subcollection-friendly. Leaderboards
  stay in RTDB nodes (not Firestore docs) — keep.
- **D8 (branded IDs):** all gamification ID fields branded inside the
  `.strict()` shapes (new brands listed above), not bare `string`.
- **D9 (Zod-first / `.passthrough`):** the 3 live schemas (`Achievement`,
  `StudentAchievement`, `StudentLevel`) invert to Zod-first `.strict()`; the
  schema-less
  `StudyGoal`/`StudySession`/`LeaderboardEntry`/`GamificationSummary` are newly
  authored (REVIEW §4.K listed `StudyGoal`/`StudySession` as missing schemas —
  now provided).
- **D3 (authUid vs uid):** gamification standardizes on **`userId: UserId`**
  (the student actor) everywhere; no `uid`/`authUid` schism introduced — defers
  that to identity domain.

### Open questions

1. **XP/level curve authority:** is the `xpToNextLevel` curve a per-tenant
   config or a platform constant? Recommend a platform constant table in
   `@levelup/services/server` (server-owned, not in client bundle) so XP economy
   isn't client-tamperable; expose only resolved `StudentLevel`. _(Needs product
   confirmation.)_
2. **Criteria evaluation source-of-truth:** today milestones are computed ad-hoc
   inside `on-progress-milestone.ts`. The plan migrates _granting_ to
   `awardAchievementsService` driven by `AchievementCriteria`. Open: do existing
   hard-coded milestones (first-exam, 80%-cross) become seeded `Achievement`
   definitions, or stay code-only notifications? Recommend: seed them as
   definitions so they're data-driven and tenant-editable; keep the non-badge
   notifications (at-risk) as code.
3. **Leaderboard PII projection:** `getLeaderboard`/`leaderboardLive` expose
   other students' `displayName`. Confirm the privacy policy — should it be
   opt-in / anonymized (rank only) for B2C vs B2B tenants? Server projects
   `displayName` only where a `gamification.leaderboardVisible` tenant flag is
   on; otherwise anonymized handle. _(Needs policy decision; default to
   anonymized.)_
4. **Realtime vs REST leaderboard duplication:** `getLeaderboard` (REST
   snapshot) + `leaderboardLive` (RTDB) both serve the board. Confirmed
   intentional (first-paint + live merge via `leaderboardRepo.mergeLive`); the
   `weeklyLeaderboardSnapshot` scheduler exists to make the REST path cheap.
   Open: TTL/freshness of the snapshot.
5. **Streak decay timing:** the `nightlyStreakReconciler` runs at the tenant day
   boundary — confirm tenant timezone is available on the tenant doc (it should
   be) so a single global cron sharded by tenant timezone is correct.
6. **`StudySession` write owner:** sessions are emitted by the levelup progress
   writer (`recordItemAttempt`/`evaluateAnswer` persist + roll up a daily
   session). Confirm the progress writer (levelup domain) owns the write, and
   gamification only **reads** — i.e. no separate gamification trigger writes
   sessions (avoids two writers).
