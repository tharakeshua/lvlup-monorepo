# Analytics Domain — Full Vertical-Slice SDK + Server Plan

> **Domain key:** `analytics` **Module / codebase:** `analytics-fn`
> (`functions/analytics`) · contract module `'analytics'` **Owns
> (authoritative):** cross-system student/class progress summaries, per-exam
> analytics, at-risk detection, AI cost roll-ups, learning-insight generation,
> PDF reports, the notification fan-out + RTDB badge/leaderboard projections,
> and the parent read endpoints.
>
> This domain is almost entirely a **read + derived-projection** domain. Its
> authoritative state is _recomputed_ (precompute-on-write), never directly
> written by clients. The SDK reads projections and requests reports; everything
> else is trigger/scheduler/queue maintained server-side. The single guiding
> move from the status review (`be-analytics.md §5`) is: **collapse the 4-writer
> / 3-reader fan-out on `studentProgressSummaries/{studentId}` into one queued,
> single-writer orchestrator** and lift all read/compute logic into
> transport-agnostic services.
>
> Sources: `status/be-analytics.md`, `status/REVIEW-domain-data-model.md` (§6
> boundary + D4/D6/D13/D14 drift), `functions/analytics/src/**`,
> `packages/shared-types/src/{progress,analytics,autograde,notification}/**`,
> `specs/common-api.md §"analytics"`, `specs/SDK-SERVER-DESIGN.md`.

---

## Domain entities (`@levelup/domain`)

All entities are **Zod-first `.strict()`** (kills D9 `.passthrough()`), branded
IDs (D8), and a single **ISO-8601 `Timestamp`** convention (D4 — replaces the
`FirestoreTimestamp {seconds,nanoseconds}` used across every analytics type
today). Fat record-maps (D6) that risk the 1 MB doc cap (`questionAnalytics`,
`byPurpose`/`byModel`, summary sub-maps) stay as bounded maps where small, but
the **summary-trigger recompute marker** is split out so the summary doc is not
rewritten by 4 writers.

### IDs / brands to add

`StudentId`, `ClassId`, `ExamId`, `TenantId`, `SpaceId`, `StoryPointId` already
brand-able; **add to `branded.ts`:** `InsightId`, `LlmCallLogId`,
`NotificationId` (review §4 notes `asNotificationId` exists but evaporates
inside shapes), `CostSummaryId` (the `YYYY-MM-DD` / `YYYY-MM` doc id),
`HealthSnapshotId`, `PlatformActivityLogId`, `ExamAnalyticsId` (= `ExamId`).

### Entities

| Entity                                     | Branded ID                            | Key fields                                                                                                                                                                                                                                                                                                                                                                                     | Enums / unions                                                                                                                                                                                                                                                                                | Notes / drift reconciliation                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **`StudentProgressSummary`**               | `id: StudentId`                       | `tenantId`, `studentId`, `autograde: StudentAutogradeMetrics`, `levelup: StudentLevelupMetrics`, `overallScore` (0–1), `strengthAreas[]`, `weaknessAreas[]`, `isAtRisk`, `atRiskReasons: AtRiskReason[]`, `lastUpdatedAt: Timestamp`, **+`recompute?: RecomputeMarker`**                                                                                                                       | `atRiskReasons` typed as `AtRiskReason[]` (was `string[]` — fixes the enum-drift D-note: type lists `no_recent_activity` but engine emits `zero_streak`)                                                                                                                                      | ISO `lastUpdatedAt`. Add `recompute` marker (orchestrator input) so 4 writers no longer all rewrite the same doc. `streakDays` becomes **required computed** (no longer hardcoded 0). |
| **`StudentAutogradeMetrics`** (sub)        | —                                     | `totalExams`, `completedExams`, `averageScore` (0–1), `averagePercentage` (0–100), `totalMarksObtained`, `totalMarksAvailable`, `subjectBreakdown: Record<string,AutogradeSubjectBreakdown>`, `recentExams: RecentExamEntry[]`                                                                                                                                                                 | —                                                                                                                                                                                                                                                                                             | `RecentExamEntry.date` → ISO.                                                                                                                                                         |
| **`StudentLevelupMetrics`** (sub)          | —                                     | `totalSpaces`, `completedSpaces`, `averageCompletion`, `totalPointsEarned`, `totalPointsAvailable`, `averageAccuracy`, `streakDays`, `subjectBreakdown`, `recentActivity: RecentActivityEntry[]`                                                                                                                                                                                               | —                                                                                                                                                                                                                                                                                             | `streakDays` is now real (computed from RTDB practice activity, not `0`).                                                                                                             |
| **`ClassProgressSummary`**                 | `id: ClassId`                         | `tenantId`, `classId`, `className`, `studentCount`, `autograde: ClassAutogradeMetrics`, `levelup: ClassLevelupMetrics`, `atRiskStudentIds: StudentId[]`, `atRiskCount`, `lastUpdatedAt: Timestamp`                                                                                                                                                                                             | —                                                                                                                                                                                                                                                                                             | `className` must be resolved real (today `className = classId` placeholder — be-analytics §4).                                                                                        |
| **`ExamAnalytics`**                        | `id: ExamId`                          | `tenantId`, `examId`, `totalSubmissions`, `gradedSubmissions`, `avgScore`, `avgPercentage`, `passRate`, `medianScore`, `scoreDistribution {buckets[], gradeDistribution?}`, `questionAnalytics: Record<ExamQuestionId,QuestionAnalyticsEntry>`, `classBreakdown: Record<ClassId,ClassBreakdownEntry>`, `topicPerformance: Record<string,TopicPerformanceEntry>`, `computedAt`, `lastUpdatedAt` | —                                                                                                                                                                                                                                                                                             | `discriminationIndex` either computed (upper/lower group) or **removed** (be-analytics §10) — no `0` stubs. `topicPerformance` real or omit.                                          |
| **`LearningInsight`**                      | `id: InsightId`                       | `tenantId`, `studentId`, `type`, `priority`, `title`, `description`, `actionType`, `actionEntityId?`, `actionEntityTitle?`, `createdAt`, `dismissedAt?`                                                                                                                                                                                                                                        | `InsightType` (6: `weak_topic_recommendation \| exam_preparation \| streak_encouragement \| improvement_celebration \| at_risk_intervention \| cross_system_correlation`), `InsightPriority` (`high\|medium\|low`), `InsightActionType` (`practice_space\|review_exam\|seek_help\|celebrate`) | `cross_system_correlation` kept only if real correlation data exists, else dropped (the `{gap:0.2}` stub is removed).                                                                 |
| **`DailyCostSummary`**                     | `id: CostSummaryId`                   | `tenantId`, `date` (`YYYY-MM-DD`), `totalCalls`, `totalInputTokens`, `totalOutputTokens`, `totalCostUsd`, `byPurpose: Record<string,CostBucket>`, `byModel: Record<string,CostBucket>`, `budgetLimitUsd?`, `budgetUsedPercent?`, `budgetAlertSent?`, `computedAt`                                                                                                                              | —                                                                                                                                                                                                                                                                                             | **Path normalized (D13):** `costSummaries/{daily                                                                                                                                      | monthly}/{id}`flat collection, not the`daily/{date}`sub-doc ambiguity. ISO`computedAt`. |
| **`MonthlyCostSummary`**                   | `id: CostSummaryId` (`YYYY-MM`)       | same shape as daily, `month: YYYY-MM`                                                                                                                                                                                                                                                                                                                                                          | —                                                                                                                                                                                                                                                                                             | Split-out type to remove the `costSummaries/monthly` path-shape inconsistency (be-analytics §4).                                                                                      |
| **`LlmCallLog`**                           | `id: LlmCallLogId`                    | `tenantId`, `functionName`, `model`, `inputTokens`, `outputTokens`, `totalTokens`, `costUSD`, `latencyMs`, `status`, `errorMessage?`, `userId?`, `examId?`, `spaceId?`, `createdAt`                                                                                                                                                                                                            | `status: 'success' \| 'error'`                                                                                                                                                                                                                                                                | **Read-only in this domain** (written by `@levelup/ai`). Analytics only aggregates it.                                                                                                |
| **`HealthSnapshot`**                       | `id: HealthSnapshotId` (`YYYY-MM-DD`) | `date`, `status`, `services: Record<string,{status,latencyMs?}>`, `checkedAt`                                                                                                                                                                                                                                                                                                                  | `DayHealthStatus: 'healthy' \| 'degraded' \| 'down'`                                                                                                                                                                                                                                          | super-admin only projection.                                                                                                                                                          |
| **`PlatformActivityLog`**                  | `id: PlatformActivityLogId`           | `action`, `actorUid`, `actorEmail`, `tenantId?`, `metadata`, `createdAt`                                                                                                                                                                                                                                                                                                                       | `PlatformActivityAction` (6: tenant_created/updated/deactivated/reactivated, user_created, users_bulk_imported)                                                                                                                                                                               | top-level `/platformActivityLog`; super-admin read only.                                                                                                                              |
| **`Notification`**                         | `id: NotificationId`                  | `tenantId`, `recipientUid` _(renamed from `recipientId` — fixes D12 schema↔interface schism)_, `recipientRole`, `type`, `title`, `body`, `entityType?`, `entityId?`, `actionUrl?`, `isRead`, `createdAt`, `readAt?`                                                                                                                                                                            | `NotificationType` (11), `NotificationEntityType` (5), `NotificationRecipientRole` (4)                                                                                                                                                                                                        | Fan-out is **owned here**; the `manageNotifications` callable is contractually under `identity` (common-api §`v1.identity.manageNotifications`).                                      |
| **`NotificationRTDBState`**                | (path key)                            | `unreadCount`, `latest?: {id,title,type,createdAt}`                                                                                                                                                                                                                                                                                                                                            | —                                                                                                                                                                                                                                                                                             | RTDB projection `/notifications/{tenantId}/{userId}`. SUBSCRIPTION payload.                                                                                                           |
| **`AtRiskDetectionResult`** (value object) | —                                     | `studentId`, `tenantId`, `isAtRisk`, `reasons: AtRiskReason[]`, `details: Record<string,string>`, `detectedAt`                                                                                                                                                                                                                                                                                 | `AtRiskReason` (5; **drop `no_recent_activity`** — never emitted; keep `zero_streak`)                                                                                                                                                                                                         | Not persisted standalone; embedded into summary + carried by the at-risk service.                                                                                                     |
| **`PerformanceTrendPoint`** _(new)_        | —                                     | `periodStart: Timestamp`, `periodEnd`, `avgPercentage`, `examCount`, `completionPct`, `overallScore`                                                                                                                                                                                                                                                                                           | granularity enum on request                                                                                                                                                                                                                                                                   | New entity backing `getPerformanceTrends` (common-api new endpoint).                                                                                                                  |
| **`LeaderboardEntry`** (value object)      | —                                     | `userId`, `score`, `rank`, `tier`, `displayName?`                                                                                                                                                                                                                                                                                                                                              | tier heuristic                                                                                                                                                                                                                                                                                | RTDB-derived; read-shaping value object for leaderboard view repo.                                                                                                                    |

#### `RecomputeMarker` (new — the fan-out fix)

```
RecomputeMarker = z.object({
  reason: z.enum(['autograde', 'levelup', 'storyPoint', 'atRisk', 'manual']),
  requestedAt: Timestamp,
  taskId: z.string().optional(),     // Cloud Task dedupe handle
}).strict()
```

Section writers set the marker (single field merge) instead of recomputing the
whole summary; the orchestrator consumes it (see Function shells).

### ALLOWED_TRANSITIONS

**None.** Analytics owns no lifecycle state machine. All "state" here is
_derived_ and idempotently recomputed; `isAtRisk` flips are computed, not user
transitions. (Exam/submission lifecycle that _gates_ analytics —
`resultsReleased`, `pipelineStatus` — is authored in the `autograde` domain;
this domain only _observes_ those transitions via triggers.) The status-vocab
confusion (`status` vs `pipelineStatus`, be-analytics §4) is reconciled by
importing autograde's shared `SUBMISSION_PIPELINE_STATUSES` / `EXAM_STATUSES`
enums from `@levelup/domain` rather than re-declaring local string sets.

---

## API contract (`@levelup/api-contract`)

Per-callable `CallableDef`. **No request schema declares `tenantId`** — derived
from claims server-side (D2; super-admin `platform`/`health` scopes need no
tenant). Cursor pagination via the shared `PageRequest`/`pageResponse` fragment.

| Callable name                                                          | Module    | Request fields (no `tenantId`)                                                                                       | Response                                                                                                                                                                  | authMode | rateTier | idempotent                              | invalidates                                                                           |
| ---------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| **`v1.analytics.getSummary`**                                          | analytics | `scope: 'student'\|'class'\|'platform'\|'health'` (discriminated union); `studentId?` (student), `classId?` (class)  | discriminated by scope: `{scope:'student', studentSummary}` / `{scope:'class', classSummary}` / `{scope:'platform', platformSummary}` / `{scope:'health', healthSummary}` | authed   | read     | no                                      | —                                                                                     |
| **`v1.analytics.generateReport`**                                      | analytics | `type: 'exam-result'\|'progress'\|'class'`; `examId?`, `studentId?`, `classId?`                                      | `{ pdfUrl, expiresAt: Timestamp }` (was `{pdfUrl}` only — add `expiresAt`, common-api §155)                                                                               | authed   | report   | yes (dedupe expensive PDF gen on retry) | —                                                                                     |
| **`v1.analytics.getExamAnalytics`** _(new READ)_                       | analytics | `examId`                                                                                                             | `ExamAnalytics`                                                                                                                                                           | authed   | read     | no                                      | — (replaces direct `examAnalytics/{examId}` Firestore read — D13 missing rule)        |
| **`v1.analytics.listInsights`** _(new READ)_                           | analytics | `studentId`, `includeDismissed?: boolean`, `PageRequest`                                                             | `pageResponse(LearningInsight)`                                                                                                                                           | authed   | read     | no                                      | — (replaces direct `insights` read — D13)                                             |
| **`v1.analytics.dismissInsight`** _(new WRITE)_                        | analytics | `insightId`                                                                                                          | `{ id, dismissedAt }`                                                                                                                                                     | authed   | write    | yes                                     | `insightKeys.list(studentId)`                                                         |
| **`v1.analytics.getPerformanceTrends`** _(new, common-api §156)_       | analytics | `subjectId?`, `studentId?` (parent/teacher), `classId?`, `granularity: 'week'\|'month'\|'term'`, `range: {from,to}?` | `{ points: PerformanceTrendPoint[] }`                                                                                                                                     | authed   | read     | no                                      | —                                                                                     |
| **`v1.analytics.getChildSummary`** _(new, parent, common-api §156)_    | analytics | `studentId` (must be in caller's `studentIds` claim)                                                                 | `{ studentSummary: StudentProgressSummary, recentInsights: LearningInsight[] }`                                                                                           | authed   | read     | no                                      | — (server-side aggregation; removes parent-web client fan-out + D13 missing-rule gap) |
| **`v1.analytics.listLinkedChildren`** _(new, parent, common-api §156)_ | analytics | `PageRequest?`                                                                                                       | `pageResponse({ studentId, name, classNames[], overallScore, isAtRisk })`                                                                                                 | authed   | read     | no                                      | — (reads from `parentLinkedStudentIds` claim, not body — D10)                         |
| **`v1.analytics.getCostSummary`** _(new READ, admin)_                  | analytics | `granularity: 'daily'\|'monthly'`, `date?` / `month?`, `range?`                                                      | `{ summaries: (DailyCostSummary\|MonthlyCostSummary)[] }`                                                                                                                 | authed   | read     | no                                      | — (replaces direct `costSummaries` read — D13)                                        |
| **`v1.analytics.getLeaderboard`** _(new READ)_                         | analytics | `scope: 'tenant'\|'space'\|'storyPoint'`, `spaceId?`, `storyPointId?`, `limit?`                                      | `{ entries: LeaderboardEntry[], myEntry?: LeaderboardEntry }`                                                                                                             | authed   | read     | no                                      | — (shapes RTDB leaderboard; today the UI reads RTDB directly)                         |

> **`manageNotifications`** (`action: 'list'\|'markRead'`) lives under
> **`v1.identity.*`** per common-api §127 — the _callable contract_ is owned by
> identity, but this domain owns the **notification fan-out producers**
> (triggers/schedulers writing the docs + RTDB badge). Listed in
> `Server services` below as a shared producer service, not a callable.

### SUBSCRIPTIONS (realtime registry)

```
'v1.notification.badge':       { params: z.object({}),                       payload: NotificationStateSchema }  // RTDB /notifications/{tenantId}/{uid}
'v1.analytics.leaderboard':    { params: z.object({ scope, spaceId?, storyPointId? }), payload: LeaderboardSnapshotSchema } // RTDB leaderboard live
```

Both are **read-only RTDB projections** consumed identically on web + RN via
`useSubscription`. (The notification badge subscription is registered in the
realtime registry but its _list/markRead_ mutations go through the identity
callable; analytics produces the badge state.)

---

## Repositories (`@levelup/repositories`)

Per-entity repos for CRUD-ish reads plus **cross-entity "view" repos** for
dashboards (where the fat-SDK value lives: shaping + N+1 collapse). Repos never
import each other except via declared view repos.

### `summaryRepo` (read + view)

- `getStudent(studentId): StudentProgressSummary` →
  `api.analytics.getSummary({scope:'student', studentId})`, unwraps the
  discriminated response.
- `getClass(classId): ClassProgressSummary` →
  `getSummary({scope:'class', classId})`.
- `getPlatform(): PlatformSummary` (super-admin) →
  `getSummary({scope:'platform'})`.
- `getHealth(): HealthSummary` (super-admin) → `getSummary({scope:'health'})`.
- **derived/shaping:** `withOverallBand(summary)` (maps `overallScore` 0–1 →
  label band for UI, computed once), `atRiskBadges(summary)` (maps
  `AtRiskReason[]` → display copy), `subjectRows(summary)` (flattens
  `autograde`+`levelup` `subjectBreakdown` maps into a single merged per-subject
  view-model the dashboard needs — collapses what the UI would otherwise zip
  client-side).

### `examAnalyticsRepo` (read)

- `get(examId): ExamAnalytics` → `api.analytics.getExamAnalytics`.
- **shaping:** `questionRows(analytics)` (turns the `questionAnalytics`
  record-map into a sorted array by difficulty), `classRows(analytics)`,
  `distributionBuckets(analytics)` for charting. Filters out stub/zero fields
  (`discriminationIndex` only surfaced if computed).

### `insightRepo` (read + conservative write)

- `list(studentId, {includeDismissed?}): Page<LearningInsight>` → cursor
  `paginate()` over `api.analytics.listInsights`.
- `dismiss(insightId): {id, dismissedAt}` → `api.analytics.dismissInsight` (**on
  the conservative optimistic allow-list — mark-read-like**).
- **shaping:** `groupByPriority(page)`, `topActionable(page, n)`.

### `costRepo` (read, admin)

- `daily(date?|range?): DailyCostSummary[]` /
  `monthly(month?|range?): MonthlyCostSummary[]` →
  `api.analytics.getCostSummary`.
- **shaping:** `byPurposeRows`, `byModelRows` (flatten the cost record-maps),
  `budgetStatus(summary)` (derives 80%/100% band from `budgetUsedPercent`).

### `trendsRepo` (view)

- `get({granularity, studentId?, classId?, subjectId?, range?}): PerformanceTrendPoint[]`
  → `api.analytics.getPerformanceTrends`.
- **shaping:** `chartSeries(points)` (server already aggregates; repo only maps
  to chart shape).

### `parentRepo` (cross-entity view — N+1 collapse)

- `listChildren(): Page<ChildSummaryRow>` → `api.analytics.listLinkedChildren`
  (single call; **collapses the old per-child fan-out** the review flagged in
  parent-web).
- `childSummary(studentId): {studentSummary, recentInsights}` →
  `api.analytics.getChildSummary` (one round-trip vs `getSummary` +
  `listInsights` separately).
- **shaping:** `childCards(page)` for the parent dashboard grid.

### `reportRepo` (command)

- `examResult({examId, studentId?})`, `progress({studentId})`,
  `classReport({classId})` → all `api.analytics.generateReport` with `type` set;
  returns `{pdfUrl, expiresAt}`. **Never optimistic** (expensive,
  server-authoritative artifact). Idempotency key attached.

### `leaderboardRepo` (view, realtime-backed)

- `get({scope, spaceId?, storyPointId?, limit?}): {entries, myEntry?}` →
  `api.analytics.getLeaderboard` for the snapshot.
- `subscribe({scope,...}, cb)` → realtime seam → RTDB live entries.
- **shaping:** `rankWithTier(entries)` (derives tier band + rank gaps once).

> All cursors are opaque (`paginate()` hides them); all repos are
> framework-free; cross-tenant scoping is implicit (claims), never a repo arg.

---

## Query hooks (`@levelup/query`)

Query-key factories + invalidation. Only `useDismissInsight` is on the
**conservative optimistic allow-list** (mark-read-class). Reports, summaries,
analytics, cost, trends are **never optimistic** (derived/authoritative).

### Key factories

```
summaryKeys = { all:['summary'], student:(id)=>[...,'student',id], class:(id)=>[...,'class',id],
                platform:()=>[...,'platform'], health:()=>[...,'health'] }
examAnalyticsKeys = { all:['examAnalytics'], detail:(examId)=>[...,'detail',examId] }
insightKeys = { all:['insights'], list:(studentId,f?)=>[...,'list',studentId,f??{}] }
costKeys = { all:['cost'], list:(g,f?)=>[...,g,f??{}] }
trendKeys = { all:['trends'], view:(f)=>[...,f] }
parentKeys = { all:['children'], list:()=>[...,'list'], child:(id)=>[...,'child',id] }
leaderboardKeys = { all:['leaderboard'], view:(f)=>[...,f] }
```

| Hook                                  | Backing repo method                    | Key                                       | Invalidation / optimistic                                                   |
| ------------------------------------- | -------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| `useStudentSummary(studentId)`        | `summaryRepo.getStudent`               | `summaryKeys.student`                     | read-only                                                                   |
| `useClassSummary(classId)`            | `summaryRepo.getClass`                 | `summaryKeys.class`                       | read-only                                                                   |
| `usePlatformSummary()`                | `summaryRepo.getPlatform`              | `summaryKeys.platform`                    | read-only (super-admin)                                                     |
| `useHealthSummary()`                  | `summaryRepo.getHealth`                | `summaryKeys.health`                      | read-only (super-admin)                                                     |
| `useExamAnalytics(examId)`            | `examAnalyticsRepo.get`                | `examAnalyticsKeys.detail`                | read-only                                                                   |
| `useInsights(studentId, opts)`        | `insightRepo.list`                     | `insightKeys.list`                        | infinite/paginated read                                                     |
| `useDismissInsight()`                 | `insightRepo.dismiss`                  | invalidates `insightKeys.list(studentId)` | **✅ optimistic** (remove from list / set `dismissedAt`, rollback on error) |
| `useCostSummary(granularity, filter)` | `costRepo.daily/monthly`               | `costKeys.list`                           | read-only (admin)                                                           |
| `usePerformanceTrends(filter)`        | `trendsRepo.get`                       | `trendKeys.view`                          | read-only                                                                   |
| `useLinkedChildren()`                 | `parentRepo.listChildren`              | `parentKeys.list`                         | read-only (parent)                                                          |
| `useChildSummary(studentId)`          | `parentRepo.childSummary`              | `parentKeys.child`                        | read-only (parent)                                                          |
| `useGenerateReport()`                 | `reportRepo.*`                         | none (returns signed URL)                 | ❌ never optimistic; mutation returns `{pdfUrl,expiresAt}`                  |
| `useLeaderboard(filter)`              | `leaderboardRepo.get`                  | `leaderboardKeys.view`                    | read-only snapshot                                                          |
| `useLeaderboardLive(filter)`          | `leaderboardRepo.subscribe` (realtime) | n/a                                       | subscription hook                                                           |
| `useNotificationBadge()`              | realtime `v1.notification.badge`       | n/a                                       | subscription (produced here, listed identical to RN)                        |

---

## Server services (`@levelup/services/{shared,server}`)

Every service is `fn(input, ctx: AuthContext)`, no `firebase-functions` import.
`authorize()` policy keys from `@levelup/access`. **No direct Firestore except
via the repository admin adapter.**

### `services/shared` (client-safe read/compute — also backs a future REST gateway)

| Service                               | Signature                                                                                                                                                | authorize() key                                                                             | Notes                                                                                                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getSummaryService`                   | `(input:{scope, studentId?, classId?}, ctx)`                                                                                                             | `analytics.summary.readStudent` / `.readClass` / `.readPlatform` / `.readHealth` (by scope) | tenant from `ctx.tenantId`; student-self check; teacher class-assignment check; platform/health require `ctx.isSuperAdmin`. Re-validates summary docs with Zod at boundary. |
| `getExamAnalyticsService`             | `(input:{examId}, ctx)`                                                                                                                                  | `analytics.examAnalytics.read`                                                              | replaces direct read; tenant-scoped.                                                                                                                                        |
| `listInsightsService`                 | `(input:{studentId, includeDismissed?, page}, ctx)`                                                                                                      | `analytics.insight.read`                                                                    | student-self or parent-of (`ctx.studentIds`) or teacher-of; cursor paginated.                                                                                               |
| `getPerformanceTrendsService`         | `(input, ctx)`                                                                                                                                           | `analytics.trends.read`                                                                     | server-side aggregation over summaries/submissions/spaceProgress; bucketed by granularity.                                                                                  |
| `getChildSummaryService`              | `(input:{studentId}, ctx)`                                                                                                                               | `analytics.child.read`                                                                      | **enforces `studentId ∈ ctx.studentIds`** (parent link from claims, D10).                                                                                                   |
| `listLinkedChildrenService`           | `(input:{page?}, ctx)`                                                                                                                                   | `analytics.child.list`                                                                      | reads `ctx.studentIds`; batched child-summary fetch (N+1 collapse).                                                                                                         |
| `getCostSummaryService`               | `(input, ctx)`                                                                                                                                           | `analytics.cost.read`                                                                       | tenantAdmin/super-admin; normalized `costSummaries/{daily\|monthly}` path.                                                                                                  |
| `getLeaderboardService`               | `(input, ctx)`                                                                                                                                           | `analytics.leaderboard.read`                                                                | reads RTDB leaderboard, shapes entries + caller's `myEntry`.                                                                                                                |
| **Pure rule engines (no IO, no ctx)** | `evaluateAtRiskRules(summary)`, `generateInsightsForStudent(context)`, `computeOverallScore`, `median`, `identifyStrengthsAndWeaknesses`, `topN/bottomN` | —                                                                                           | Lifted verbatim from `utils/{at-risk,insight,aggregation}-helpers.ts` (the review's "keep" list). Side-effect-free, unit-tested, REST/RN-portable.                          |

### `services/server` (server-only — counters, derived projections, cost, secrets-adjacent, PDFs)

| Service                           | Signature                                                             | authorize() key                                  | Notes (authority)                                                                                                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recomputeStudentSummaryService`  | `(input:{tenantId, studentId, section:'autograde'\|'levelup'}, ctx?)` | internal (trigger/queue ctx)                     | **Single-writer** per summary doc. Section-scoped transaction merge; sets `lastUpdatedAt`; idempotent. Consumed by the orchestrator, not by clients.                                               |
| `recomputeClassSummaryService`    | `(input:{tenantId, classId})`                                         | internal                                         | Recomputes top/bottom performers, at-risk roster; **className resolved real** (not `classId`).                                                                                                     |
| `recomputeExamAnalyticsService`   | `(input:{tenantId, examId})`                                          | internal                                         | Computes avg/median/passRate, distribution, per-question (real `difficultyIndex`; `discriminationIndex` computed or omitted), per-class breakdown.                                                 |
| `detectAtRiskService`             | `(input:{tenantId, summaries[]})`                                     | internal                                         | Applies `evaluateAtRiskRules`; sets `isAtRisk`/`atRiskReasons`; **only sets flags** — does NOT notify (notification is the single milestone path, fixing double-notify).                           |
| `generateInsightsService`         | `(input:{tenantId, studentId, context})`                              | internal                                         | Applies `generateInsightsForStudent`; **fixed cap math** `write min(slotsAvailable, seeds.length)`, deletes deterministically by `createdAt` (fixes the buggy slice). Cap = 5 active.              |
| `aggregateDailyCostService`       | `(input:{tenantId, date})`                                            | internal                                         | Delta-based `increment(new-old)` idempotent monthly roll-up; **emits `ai_budget_alert`** via `notify*` on 80%/100% breach (fixes the silent `console.warn`).                                       |
| `dismissInsightService`           | `(input:{insightId}, ctx)`                                            | `analytics.insight.dismiss`                      | **The only client-facing write in this domain.** Student-self/parent check; sets `dismissedAt = ctx.now()`.                                                                                        |
| `generateReportService`           | `(input:{type, examId?, studentId?, classId?}, ctx)`                  | `analytics.report.exam` / `.progress` / `.class` | Builds PDF via `pdf-helpers`, uploads to `tenants/{ctx.tenantId}/reports/...`, returns 1h signed URL + `expiresAt`. Idempotent on `(uid, idempotencyKey)`. **Server-authoritative artifact.**      |
| `notifyService` (shared producer) | `sendNotification(input)` / `sendBulkNotifications(input[])`          | internal                                         | Dual-writes Firestore `notifications/{id}` (with `recipientUid`) + RTDB `/notifications/{tenantId}/{uid}` badge. Centralized — at-risk fan-out goes through here from the milestone path **only**. |
| `updateLeaderboardService`        | `(input:{tenantId, studentId, spaceId?, storyPointId?})`              | internal                                         | Writes RTDB `tenantLeaderboard`/`courseLeaderboard`/`storyPointLeaderboard`; tier heuristic; handles deletion cleanup.                                                                             |
| `recomputeOrchestratorService`    | `(input:{tenantId, studentId, marker})`                               | internal (Cloud Tasks)                           | **Collapses the fan-out.** Runs in defined order: class-summary → leaderboard → milestone-notify → at-risk flag. Debounced/queued; consumes + clears `RecomputeMarker`.                            |

---

## Function shells (callable / trigger / scheduler)

Thin adapters over the services above. `onCall` =
`buildAuthContext → parseRequest(Zod) → service`. Triggers/schedulers = thin
over `services/server`, **single-writer + idempotent + outbox** for must-deliver
side-effects, **Cloud Tasks** for the multi-step summary orchestration.

### Callable shells (`functions/analytics/src/callable/`)

| Callable                            | Service                       |
| ----------------------------------- | ----------------------------- |
| `v1.analytics.getSummary`           | `getSummaryService`           |
| `v1.analytics.generateReport`       | `generateReportService`       |
| `v1.analytics.getExamAnalytics`     | `getExamAnalyticsService`     |
| `v1.analytics.listInsights`         | `listInsightsService`         |
| `v1.analytics.dismissInsight`       | `dismissInsightService`       |
| `v1.analytics.getPerformanceTrends` | `getPerformanceTrendsService` |
| `v1.analytics.getChildSummary`      | `getChildSummaryService`      |
| `v1.analytics.listLinkedChildren`   | `listLinkedChildrenService`   |
| `v1.analytics.getCostSummary`       | `getCostSummaryService`       |
| `v1.analytics.getLeaderboard`       | `getLeaderboardService`       |

### Triggers (`functions/analytics/src/triggers/`) — restructured per be-analytics §5 rec #2

| Trigger                  | Firestore event                                                                                                                                                                                       | Thin over                                                                                                                        | Single-writer / idempotent / outbox                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onSubmissionGraded`     | `onDocumentUpdated tenants/{t}/submissions/{id}` (transition into a graded `pipelineStatus` using the **shared** `SUBMISSION_PIPELINE_STATUSES` enum — fixes the `status`/`pipelineStatus` vocab bug) | `recomputeStudentSummaryService({section:'autograde'})` then **enqueue** `recomputeOrchestratorService` (Cloud Task) with marker | section-scoped single-writer; idempotent on submission id + status; orchestrator dedupes by taskId                                                                                                                                     |
| `onSpaceProgressUpdated` | `onDocumentWritten tenants/{t}/spaceProgress/{id}`                                                                                                                                                    | `recomputeStudentSummaryService({section:'levelup'})` **+** leaderboard story-point diff (merged) then enqueue orchestrator      | **Merges the two old triggers** (`onSpaceProgressUpdated` + `onUserStoryPointProgressWrite`) that both wrote the same summary — eliminates competing transactions (review §4, be-analytics rec #2)                                     |
| `onExamResultsReleased`  | `onDocumentUpdated tenants/{t}/exams/{id}` on `status → results_released`                                                                                                                             | `recomputeExamAnalyticsService`                                                                                                  | single-writer per examAnalytics doc; idempotent on exam id + status; **outbox** notification (`exam_results_released`)                                                                                                                 |
| `recomputeOrchestrator`  | Cloud Tasks queue handler (not a Firestore trigger)                                                                                                                                                   | `recomputeOrchestratorService`                                                                                                   | the **one** consumer of `RecomputeMarker`; runs class-summary → leaderboard → milestone-notify → at-risk in order; replaces the 3-triggers-on-one-doc topology (`onStudentSummaryUpdated`, `updateLeaderboard`, `onProgressMilestone`) |

> **Deleted/absorbed triggers:** `onUserStoryPointProgressWrite` (merged into
> `onSpaceProgressUpdated`), `onStudentSummaryUpdated` + `updateLeaderboard` +
> `onProgressMilestone` (collapsed into the queued `recomputeOrchestrator`).
> This removes the write-amplification, feedback-loop, and double-notify risks
> and the dead `pendingRecalculation` flag.

### Schedulers (`functions/analytics/src/schedulers/`)

| Scheduler                | Cron                    | Thin over                                  | Notes                                                                                                                                                                          |
| ------------------------ | ----------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dailyCostAggregation`   | `5 0 * * *`             | `aggregateDailyCostService` (per tenant)   | idempotent delta-based monthly roll-up; **now emits `ai_budget_alert`** on breach.                                                                                             |
| `nightlyAtRiskDetection` | `0 2 * * *` (1GiB/540s) | `detectAtRiskService` (paginated 500/page) | **only sets flags**; notification handled by the milestone path. Fixes O(N) student lookup via `where(authUid in [...])` / denormalized `teacherUids`/`parentUids` on summary. |
| `generateInsights`       | `30 2 * * *`            | `generateInsightsService` (per student)    | fixed 5-active cap + deterministic delete by `createdAt`.                                                                                                                      |

---

## Authority boundary (server-only ⚷)

Maps to REVIEW §6. Everything below is **trigger/scheduler/queue/service
maintained; SDK reads projections, never writes**:

- **All `*ProgressSummary` docs** (`studentProgressSummaries`,
  `classProgressSummaries`) — denormalized counters/aggregates (REVIEW §6.9).
  SDK reads via `getSummary`; never writes. `overallScore`, `isAtRisk`,
  `atRiskReasons`, `strengthAreas`, `weaknessAreas` are server-computed.
- **`ExamAnalytics`** — derived from grading outputs; gated on `resultsReleased`
  (REVIEW §6.10). Computed only after the autograde lifecycle releases results.
- **`DailyCostSummary` / `MonthlyCostSummary` / `LlmCallLog` aggregation** — AI
  cost is server-only (REVIEW §6 AI row). `LlmCallLog` written by `@levelup/ai`;
  analytics only reads/aggregates. Budget thresholds + alerts
  server-authoritative.
- **`LearningInsight` creation** — generated server-side by the rule engine; the
  **only** client write is `dismissInsight` (sets `dismissedAt`), which is
  owner/parent-scoped.
- **Notification fan-out + RTDB badge + leaderboards** — denormalized
  projections (REVIEW §6.9); trigger/scheduler maintained; SDK reads/subscribes,
  never writes. `markRead` goes through the identity callable, not a client
  Firestore write.
- **`PlatformActivityLog` / `HealthSnapshot` / platform metrics** —
  super-admin-only projections; `isSuperAdmin` is a **claim** (REVIEW §6.2,
  promoted from the per-rule `get()`), checked in `ctx`, not re-read per
  request.
- **`tenantId`** — claims-derived for all tenant-scoped scopes; never in any
  analytics request body (REVIEW §6.1 / D2). Platform/health scopes are
  tenant-less and require `ctx.isSuperAdmin`.
- **Parent→child access** — `getChildSummary`/`listLinkedChildren` enforce
  membership via `ctx.studentIds` (the `parentLinkedStudentIds` claim, D10) —
  fixes the present functional gap where `studentProgressSummaries` has no rule
  for parents (REVIEW §5, §7 risk #7).
- **PDF reports** — generated + signed server-side; storage path tenant+role
  scoped (REVIEW §6.13); URLs expire (1h, `expiresAt` in contract).

---

## Drift & open questions

### Reconciliations (from REVIEW drift table)

- **D4 (timestamp trichotomy):** every analytics type uses `FirestoreTimestamp`
  today → migrate to ISO `Timestamp`. Edge adapter in the repository admin layer
  converts Firestore `Timestamp` ↔ ISO on read/write; the rule engines (which
  call `.toMillis()`) get plain numeric comparisons against ISO-parsed millis.
- **D6 (record-maps / 1 MB risk):** `questionAnalytics`, `byPurpose`/`byModel`,
  summary sub-maps stay bounded maps (small cardinality), but the **summary
  recompute marker is split out** so the summary doc isn't rewritten by 4
  writers; large per-attempt growth lives in `spaceProgress` (levelup domain),
  not here.
- **D13 (missing rules for materialized analytics):** **decision — callable-only
  access.** No client Firestore reads of
  `studentProgressSummaries`/`classProgressSummaries`/`examAnalytics`/`insights`/
  `costSummaries`; all routed through the new `get*`/`list*` callables above.
  Rules stay default-deny; this is now documented, not an accidental gap. Parent
  access is via `getChildSummary`.
- **D14 (legacy collection groups / path schisms):** normalize `costSummaries`
  to a single flat `costSummaries/{daily|monthly}/{id}` shape (fixes the
  `daily/{date}` sub-doc vs `monthly` collection inconsistency); `spaceProgress`
  keyed consistently on `userId`.
- **D12 (`Notification.recipientId` vs schema `recipientUid`):** standardize on
  **`recipientUid`**.
- **At-risk enum drift:** drop `no_recent_activity` (never emitted); keep
  `zero_streak`. `atRiskReasons` typed as `AtRiskReason[]`, not `string[]`.
- **Status-vocab confusion:** import shared
  `SUBMISSION_PIPELINE_STATUSES`/`EXAM_STATUSES` from `@levelup/domain` instead
  of the local `GRADED_STATUSES` string set (fixes the `status` vs
  `pipelineStatus` header/code mismatch in `onSubmissionGraded`).
- **Single membership model:** `getSummary` and child/class resolution use one
  `userMemberships` representation (`{uid}_{tenantId}`), not the three divergent
  models (top-level `userMemberships`, `tenants/{t}/memberships` with
  `schoolId`-as-classId, rules' composite id) — fixes the silent
  class-resolution disagreement (be-analytics §4).
- **Stubbed metrics:** `streakDays` computed from RTDB practice activity;
  `discriminationIndex`/ `topicPerformance`/`className` either computed real or
  omitted from the schema (no `0`/placeholder values surfacing as truth in
  PDFs/dashboards). `cross_system_correlation` insight kept only if real
  correlation aggregation exists; otherwise the rule is dropped (no `{gap:0.2}`
  stub).
- **Generate-insights cap bug:** fixed to
  `write min(slotsAvailable, seeds.length)` with deterministic
  delete-by-`createdAt`.
- **Vendored shared-types:** replace `file:.local-deps/shared-types` with
  `@levelup/domain` workspace consumption.

### Open questions

1. **`getPerformanceTrends` source:** aggregate on-the-fly from
   summaries/submissions, or maintain a `performanceTrends` rollup doc per
   student updated by the orchestrator? (Recommend: on-the-fly for v1 over the
   already-materialized summary `recentExams`/`recentActivity`; promote to a
   rollup doc if the parent/teacher dashboards prove latency-sensitive.)
2. **Platform metrics cost:** today 6 full-collection count queries
   (be-analytics §4). Use Firestore `.count()` aggregation, or a daily-scheduler
   `platformMetrics` rollup doc? (Recommend: `.count()` for v1; rollup doc if
   super-admin dashboard scales.)
3. **`streakDays` ownership:** computed in the `levelup` domain (RTDB practice
   activity) and read here, or computed here from RTDB directly? (Recommend:
   levelup owns the streak source; analytics reads it into
   `StudentLevelupMetrics` — keeps the single-writer principle.)
4. **Notification callable boundary:** `manageNotifications` is contractually
   under `identity` but its producers (fan-out, RTDB badge) live here. Confirm
   the producer service (`notifyService`) is shared and imported by identity's
   `markRead` for unread-count decrement, to avoid a second badge writer.
5. **`discriminationIndex` / `topicPerformance`:** ship real implementations
   (upper/lower group analysis; topic tagging on questions) or omit from the
   `ExamAnalytics` schema for v1?
