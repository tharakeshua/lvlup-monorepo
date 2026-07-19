# API-DESIGN-STANDARD — The Auto-LevelUp API Standard

**Date:** 2026-07-18 · **Author:** Fable (APISTD session) · **Status:** DRAFT —
becomes THE standard on owner finalization **Companion:** `API-DESIGN-REVIEW.md`
(the first-principles critique this standard resolves; ⚖ owner decisions
referenced from there)

This document defines the complete, final API surface of the platform: **three
modular API sets** — **AUTOGRADE**, **LEVELUP/SPACES**, **PLATFORM CORE** — plus
the grammar, envelopes, error taxonomy, and testing bar every endpoint must
meet. There is no legacy tier. Anything not in this document does not exist.

---

## 1. Architecture invariants (unchanged, now normative)

1. **One contract.** Every client operation is a callable declared in
   `packages/api-contract` as a `CallableDef` — strict zod request/response
   schemas, `authMode`, `rateTier`, idempotency hints, `authoritySensitive`,
   `invalidates`. The registry is the SSOT; the 100%-coverage wire pin test is
   mandatory and blocks merge.
2. **One transport seam.** Contract name `v1.<module>.<op>` → deployed id
   `v1-<module>-<op>` via `toDeployedCallableId` (dots→dashes). Clients invoke
   only through `@levelup/query` → `@levelup/repositories` →
   `@levelup/api-client`. **Zero raw `httpsCallable` strings in app code.**
3. **One implementation layer.** All business logic in `packages/services`;
   `functions/sdk-v1` is a thin wire()/call() composition root; Firestore access
   only via `repo-admin` on `v2_`-prefixed roots.
4. **One codebase.** `firebase.json` declares only `sdk-v1` (FNCLEAN end state).
5. **Realtime = RTDB projections + bump nodes** (AD-12 end state). Zero
   Firestore client subscriptions. Callables are the only Firestore-derived read
   path.
6. **Types from `@levelup/domain` only.** No shared-types. View schemas live
   beside their callable defs and project domain types.

## 2. The three API sets

| Set                  | Module id                                 | Deployed prefix  | Scope                                                                                                                                                  |
| -------------------- | ----------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PLATFORM CORE**    | `platform` (⚖ #1: rename from `identity`) | `v1-platform-*`  | Auth & session, people & roles, tenancy, classes & academic sessions, notifications & comms, platform admin/config, cross-domain analytics & reporting |
| **LEVELUP / SPACES** | `levelup`                                 | `v1-levelup-*`   | Spaces, story points, content items, question bank & rubrics, test sessions, progress & learning analytics, gamification, tutor chat & agents, store   |
| **AUTOGRADE**        | `autograde`                               | `v1-autograde-*` | Exams, questions, submissions & uploads, grading pipeline, results release, exam analytics, evaluation settings, DLQ ops                               |

**Boundary rule:** a callable lives in the module that **owns the aggregate it
reads or mutates**. One resource, one reader — a resource's projections are
declared exactly once, in the owner module. Cross-domain rollups
(student/class/tenant summaries composed from levelup + autograde data) are
owned by PLATFORM CORE, which is the only module allowed to aggregate across the
other two.

## 3. Naming grammar

```
name      := "v1" "." module "." op
module    := "platform" | "levelup" | "autograde"
op        := saveOp | getOp | listOp | actionOp | meOp | bulkOp | markOp
saveOp    := "save" Entity                  — upsert; {id?, data} → {id, created}; absorbs status transitions
getOp     := "get" Entity                   — single view projection by id
listOp    := "list" Entity "s"              — paged view projections; cursor pagination mandatory
actionOp  := verb Noun                      — ONLY for genuinely distinct operations (startTestSession,
                                              releaseResults, gradeQuestion, purchaseSpace, extractQuestions…)
meOp      := "getMe" | "updateMyProfile" | …— caller-scoped; no id in request
bulkOp    := "bulk" Verb Noun               — batch mutations (bulkImportStudents…)
markOp    := "mark" Noun "Read"             — read-receipt acknowledgements
```

- **No create/update pairs.** `save*` upsert only (`id` absent = create). Status
  changes ride `data.status` and are validated against `ALLOWED_TRANSITIONS`
  (domain-authored state machines); invalid → `INVALID_TRANSITION`.
- **No assignment/link endpoints.** Assignments are field updates via `save*`.
- **Rename only when the name lies.** Grammar-polish renames ride along with
  other changes, never alone.

## 4. Wire contract

### 4.1 Request envelope

- `save*`: `{ id?: EntityId, data: Partial<DomainWrite> }` — `.strict()`,
  zod-branded ids.
- **No `tenantId` in any request schema** (structurally asserted by contract
  test). Tenant derives from auth claims server-side. Sole exception: optional
  `tenantOverride` on defs with `allowsTenantOverride: true` (super-admin,
  audited).
- `list*`: filter fields + `withPaging(...)` (`cursor?`, `limit` 1–100 default
  20).

### 4.2 Response envelope

- Mutations: `SaveResponse { id, created }` (+ op-specific fields only when the
  operation genuinely returns more, e.g. `startTestSession` → session view).
- Reads: **view projections, never raw domain docs.** Views whitelist fields,
  normalize timestamps, and encode authority by presence: role-stripped fields
  are `.optional()` and omitted for non-authorized roles (answer keys, rubric
  guidance, cost telemetry, pre-release evaluations). `authoritySensitive: true`
  on every def whose response varies by authority.
- Lists: `pageResponse(item)` → `{ items, nextCursor: string | null, total? }`.
  `total` only from a maintained counter, never a live count.
- Response validation is **ON in all clients** (dev-strict; the read-canon work
  made this literal-true).

### 4.3 Error taxonomy (closed set — `AppErrorCode`)

`VALIDATION_ERROR · INVALID_TRANSITION · NOT_FOUND · PERMISSION_DENIED · UNAUTHENTICATED · RATE_LIMITED · QUOTA_EXCEEDED · FEATURE_DISABLED · TENANT_SUSPENDED · CONFLICT · PRECONDITION_FAILED · IDEMPOTENCY_CONFLICT · PAYMENT_FAILED · INTERNAL_ERROR`

- Server `fail()` and client `normalizeError()` both speak this vocabulary;
  `ApiErrorDetails` (`code`, user-safe `message`, `validationErrors[]` iff
  validation, `retryable?`, `meta`) always rides `HttpsError.details`.
  Retryability defaults per `DEFAULT_RETRYABLE`.
- These spellings are the SSOT — no gRPC spellings (`FAILED_PRECONDITION`)
  anywhere in services (REVIEW N6).
- Semantics contract: empty test → `PRECONDITION_FAILED`; state-machine
  violation → `INVALID_TRANSITION` (with `currentStatus`/`allowedTransitions` in
  `meta`); duplicate idempotent submit → dedupe-hit success or
  `IDEMPOTENCY_CONFLICT` while in-flight; never a generic 500 for a predictable
  failure.

### 4.4 Pagination — cursor-only, opaque server-encoded cursors, `nextCursor: null` = end. No offset pagination anywhere.

### 4.5 Idempotency

- All reads idempotent by nature.
- All `save*` idempotent via the transport UUIDv7 retry key (api-client
  envelope; **never** a request-schema field).
- Actions declare explicitly: `releaseResults` idempotent;
  `startTestSession`/`purchaseSpace`/`uploadAnswerSheets` idempotent with
  `domain:` keys; `gradeQuestion`/`sendChatMessage`/`generateContent`
  **non-idempotent** by design.

### 4.6 Auth & tenancy

- `authMode: "public"` ONLY for pre-auth lookups (`lookupTenantByCode`).
  Everything else `authed`.
- Single authority decision: `authorize(ctx, action, resource)` —
  **resource-level, not endpoint-per-role.** A summary read authorizes
  student-self / parent-of / teacher-of-class / admin at the resource; there are
  no caller-role-specific twin endpoints (REVIEW G2).
- Claims resync: defs mutating role/status/class/permissions carry
  `resyncsClaims: true`.
- Rate tiers:
  `write 30/min · read 60/min · ai 10/min · auth 10/min · report 5/min` — one
  `RATE_LIMITS` table.

### 4.7 Uploads — all client uploads go through `requestUploadUrl`-style signed, server-owned paths (autograde) or the asset callables (`uploadTenantAsset`, `uploadUserAsset`). Clients never construct Storage paths.

### 4.8 Versioning

- `v1` is the version prefix of every name. A breaking change to a published
  schema ⇒ **new op under `v2.<module>.<op>`**, dual-run window, client
  migration, delete the v1 op. Published schemas are never mutated incompatibly;
  additive optional fields are allowed within v1.
- The contract-pin diff (`CALLABLE_NAMES` vs `functions:list`) is the drift
  alarm and runs in CI.

## 5. The testing bar — definition of "working, tested"

An endpoint **exists** only when ALL of:

| Gate            | What                                                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Contract pin | In the registry; wire-coverage pin test (SDK reaches it); contract↔deployed parity diff green                                                                                    |
| 2. Unit         | Service-impl tests: happy path, authz denial, error paths (incl. state-machine + idempotency where flagged)                                                                      |
| 3. Smoke        | Invoked against the deployed function (or emulator suite in CI + post-deploy probe) with a real auth context; response validates against the response schema                     |
| 4. Consumer     | A verified live caller: app UI call site, scheduler, trigger, or documented external consumer. **No consumer → the endpoint is deleted** (owner rule: only working+used survive) |

Modules additionally pin: state-machine transition tables, authority-stripping
tests per authoritySensitive view, and the no-`tenantId`-in-request structural
test.

---

## 6. The API sets — full endpoint inventories

Legend: ✅ exists today (survives as-is) · 🔀 moved from analytics · ✏️ renamed
· ➕ new · 🅰 audit bucket (⚖ #3: verify consumer or cut) · deployed-gap ⚠ =
declared but needs deploy. All entries implicitly: authed unless noted, strict
schemas, view-projected responses, paged if `list*`.

### 6.1 PLATFORM CORE — `v1.platform.*` — 68 callables

**Auth & session (10)** | Op | Kind | Notes | |---|---|---| | `getMe` ✅ |
me-read | Session bootstrap: profile + memberships + claims projection (also
answers G14 permissions-read) | | `updateMyProfile` ✅ | me-write | | |
`deleteConsumerAccount` ✅ | me-write | B2C account deletion | |
`switchActiveTenant` ✅ | action | resyncsClaims; auth tier; the highest-traffic
auth seam | | `lookupTenantByCode` ✅ | read | **public**; folded into contract
path (no direct httpsCallable string) | | `joinTenant` ✅ 🅰 | action | | |
`sendPasswordReset` ✅ | action | auth tier | | `startImpersonation` ✅ 🅰 /
`endImpersonation` ✅ 🅰 | action pair | super-admin; authoritySensitive | |
`uploadUserAsset` ✅ | action | avatar etc.; signed server-owned path |

**People & roles (18)** | Op | Notes | |---|---| | `saveStudent` / `getStudent`
/ `listStudents` ✅ | | | `saveTeacher` / `getTeacher` / `listTeachers` ✅ | | |
`saveParent` / `listParents` ✅ | | | `saveStaff` / `listStaff` ✅ | | |
`createOrgUser` ✅ 🅰 | org-admin bootstrap; audit vs folding into save\* with
role | | `bulkImportStudents` / `bulkImportTeachers` ✅ | bulk; idempotent
domain-keyed | | `bulkUpdateStatus` ✅ 🅰 | | | `setUserStatus` ✅ |
resyncsClaims | | `changeMembershipRole` ✅ | resyncsClaims; authoritySensitive
| | `searchUsers` ✅ 🅰 | | | `listLinkedChildren` 🔀 | guardianship reader
(from analytics) |

**Tenancy (11)** `saveTenant` / `getTenant` / `listTenants` ✅ ·
`saveTenantSettings` ✅ · `saveTenantFeatures` ✅ · `bulkApplyTenantFeatures` ✅
🅰 · `deactivateTenant` / `reactivateTenant` ✅ (authoritySensitive) ·
`uploadTenantAsset` ✅ (G10 payload verified) · `exportTenantData` /
`listExportJobs` ✅ 🅰

**Classes & academic sessions (6)** `saveClass` / `getClass` / `listClasses` ✅
· `saveAcademicSession` / `listAcademicSessions` ✅ · `rolloverSession` ✅ 🅰

**Notifications & comms (13)** | Op | Notes | |---|---| | `listNotifications` /
`markNotificationRead` / `getNotificationBadge` ✅ | | |
`getNotificationPreferences` / `saveNotificationPreferences` ✅ | prefs shape
per ⚖ #2 (recommend named-toggle object; G8) | | `registerDeviceToken` /
`unregisterDeviceToken` ✅ | | | `saveAnnouncement` / `listAnnouncements` /
`markAnnouncementRead` ✅ | | | `sendDirectMessage` ✅ 🅰 | admin→user messaging
(distinct from tutor chat) | | `estimateAudience` ✅ 🅰 | announcement targeting
size | | `listParentAlerts` 🔀 | parent alert feed (from analytics) |

**Platform admin & config (6)** `savePlatformConfig` / `getPlatformConfig` ✅ 🅰
· `saveGlobalEvaluationPreset` / `listGlobalEvaluationPresets` ✅
(platform-level presets — distinct from autograde eval-settings and levelup
rubrics by design, REVIEW N4) · `getPlatformHealth` ➕✏️ (split from getSummary
scope:'health'; super-admin; replaces the intentionally-failing saveTenant probe
semantics) · `listPlatformActivity` 🔀 (audit log)

**Analytics & reporting (4)** | Op | Notes | |---|---| | `getProgressSummary`
✏️🔀 | was `getSummary`; scope enum `student \| class \| tenant`; resource-level
authz (student-self / parent-of-child / teacher-of-assigned-class / admin) —
fixes both 403 classes of G2; absorbs `getChildSummary` | |
`listStudentSummaries` ➕ | batched by `studentIds[]` (bounded ≤100), paged —
restores PC-14 batched fan-in (G1) | | `getCostSummary` 🔀 | AI spend telemetry;
admin | | `generateReport` 🔀 | PDF/report generation; report tier; typed
`reportType` enum |

**Non-callables (platform runtime):** triggers
`onMembershipWritten, onStudentArchived, onClassArchived, onTenantDeactivated, onAnnouncementPublished`
· scheduled `tenantLifecycleCheck, monthlyUsageReset, cleanupExpiredExports` ·
🔀 from analytics: `recomputeStudentRollup` (taskQueue), `dailyCostAggregation`
(sched), rollup triggers
`onSpaceProgressUpdated, onSubmissionGraded, onExamResultsReleased` · ➕ **auth
trigger pair** (user-create/delete → writes `v2_users`, soft-delete + membership
deactivation; G15, unblocks FNCLEAN Wave 4).

### 6.2 LEVELUP / SPACES — `v1.levelup.*` — 52 callables

**Spaces & content (13)** | Op | Notes | |---|---| | `saveSpace` / `getSpace` /
`listSpaces` ✅ | + retake/price fields (G7); status machine
draft→published→archived, `listedInStore` toggle | | `duplicateSpace` ✅⚠ |
deep-copy; **deploy** (Wave 0; live NOT_FOUND today) | | `saveStoryPoint` /
`getStoryPoint` / `listStoryPoints` ✅ | timed assessments **require**
`assessmentConfig.durationMinutes` at write (G13) | | `saveItem` /
`getItemForEdit` / `listItems` ✅ | ItemEditor rewired to contract path (Wave 0)
| | `listVersions` ✅ 🅰 | content version history | | `assignContent` ✅ 🅰 ·
`generateContent` ✅ 🅰 | AI generation: ai tier, non-idempotent |

**Question bank & rubrics (5)** `saveQuestionBankItem` / `listQuestionBank` ✅ ·
`importFromBank` ✅ 🅰 · `saveRubricPreset` / `listRubricPresets` ✅ (item-level
rubrics; UnifiedRubric coercion in domain SSOT)

**Assessment & test sessions (7)** | Op | Notes | |---|---| | `startTestSession`
✅ | idempotent domain-keyed; `PRECONDITION_FAILED` on empty question order;
questionOrder = question items only, orderIndex-sorted (G12) | |
`saveTestAnswer` ✅ · `submitTestSession` ✅ · `getTestSession` /
`listTestSessions` ✅ | | | `recordItemAttempt` ✅ | practice-mode attempts | |
`evaluateAnswer` ✅ | AI evaluation; ai tier, non-idempotent |

**Progress & learning analytics (10)** `getSpaceProgress` /
`listSpaceProgressForUser` / `getStoryPointProgress` ✅ · `listStudySessions` ✅
🅰 · `saveStudyGoal` / `listStudyGoals` ✅ 🅰 · `listLearningInsights` /
`dismissInsight` ✅ (the ONE insights surface) · `getPerformanceTrends` 🔀 ·
`getAssignmentMatrix` 🔀

**Gamification (7)** `getGamificationSummary` / `getStudentLevel` ✅ ·
`getLeaderboard` ✅ (scope tightened to
`z.enum(["tenant","space","storyPoint"])`; paged + callerEntry — the analytics
twin dies) · `listAchievements` / `listStudentAchievements` /
`saveAchievementDefinition` / `markAchievementsSeen` ✅

**Tutor chat & agents (5)** `sendChatMessage` ✅ (ai tier, non-idempotent; reply
readable via getChatSession + chatBump RTDB signal) · `getChatSession` /
`listChatSessions` ✅ · `saveAgent` / `listAgents` ✅ 🅰

**Store (5)** — ⚖ #3 product decision as a group `listStoreSpaces` /
`getStoreSpace` ✅ 🅰 · `purchaseSpace` ✅ 🅰 (idempotent domain-keyed;
`PAYMENT_FAILED`) · `saveSpaceReview` / `listSpaceReviews` ✅ 🅰

**Non-callables:** scheduled `expireTestSessions, cleanupStaleSessions` · 🔀
`generateInsights, nightlyAtRiskDetection` (learning-insight writers follow
their readers) · ➕ `cleanupInactiveChats` (G16).

### 6.3 AUTOGRADE — `v1.autograde.*` — 19 callables

**Exams & questions (6)** | Op | Notes | |---|---| | `saveExam` ✅ | upsert;
accepts `questionPaperImages` + `status` (G3); machine
draft→published→grading→results_released | | `getExam` / `listExams` ✅ |
ExamDetailView maps `questionPaperImages` → `questionPaper.images` (G3
round-trip contract test) | | `saveExamQuestion` ✅⚠ | per-question edit;
**deploy** (Wave 0; G4) | | `listQuestions` ✅ · `extractQuestions` ✅ |
extraction: ai tier, mode full\|single |

**Submissions & uploads (6)** `requestUploadUrl` ✅ (signed server-owned paths —
the ONLY upload path) · `uploadAnswerSheets` ✅ (idempotent domain-keyed) ·
`listSubmissions` / `getSubmission` / `getSubmissionForExam` /
`listQuestionSubmissions` ✅ (pipeline:
uploaded→scouting→grading→graded→released; views strip answer keys/evaluation
pre-release)

**Grading & results (3)** `gradeQuestion` ✅ (mode manual\|retry\|ai;
non-idempotent by design) · `releaseResults` ✅ (idempotent; authoritySensitive)
· `getExamAnalytics` ✅ (ExamAnalyticsViewSchema — canonical; analytics twin
dies)

**Evaluation config & ops (4)** `saveEvaluationSettings` ✅ (+ toggle fields,
G6) / `listEvaluationSettings` ✅ · `listDeadLetter` / `resolveDeadLetter` ✅ 🅰
(DLQ ops surface)

**Non-callables:** triggers
`onSubmissionCreated, onSubmissionUpdated, onQuestionSubmissionUpdated, onExamPublished, onResultsReleased, onExamDeleted`
· taskQueue `advancePipeline` (Cloud Tasks grading pipeline) · scheduled
`staleSubmissionWatchdog`.

### 6.4 Set totals

| Set            | Callables                                            | Non-callables                          |
| -------------- | ---------------------------------------------------- | -------------------------------------- |
| Platform Core  | 68                                                   | 8 + 5 moved + 2 auth-trigger adds = 15 |
| LevelUp/Spaces | 52                                                   | 2 + 2 moved + 1 add = 5                |
| Autograde      | 19                                                   | 8                                      |
| **Total**      | **139** (before ⚖ #3 audit cuts; 🅰 = 27 candidates) | **28**                                 |

---

## 7. Migration delta from today's 142 callables

### 7.1 CUT — 5 (duplicate/folded; delete contract def + deployed fn)

| Callable                        | Survivor                                           |
| ------------------------------- | -------------------------------------------------- |
| `v1.analytics.getExamAnalytics` | `v1.autograde.getExamAnalytics`                    |
| `v1.analytics.getLeaderboard`   | `v1.levelup.getLeaderboard` (scope enum tightened) |
| `v1.analytics.dismissInsight`   | `v1.levelup.dismissInsight`                        |
| `v1.analytics.listInsights`     | `v1.levelup.listLearningInsights`                  |
| `v1.analytics.getChildSummary`  | `v1.platform.getProgressSummary{scope:'student'}`  |

### 7.2 MOVE/RENAME — module dissolution + module rename

- **8 analytics moves:** → platform: `getSummary`(✏️`getProgressSummary`),
  `generateReport`, `getCostSummary`, `listPlatformActivity`,
  `listLinkedChildren`, `listParentAlerts` · → levelup: `getPerformanceTrends`,
  `getAssignmentMatrix`.
- **60 identity → platform** (⚖ #1): mechanical registry rename, SDK
  regenerates, deploy new ids + delete old after soak. Rides FNCLEAN Wave-2
  deploy machinery.
- **Op renames:** `getSummary` → `getProgressSummary` (+ `getPlatformHealth`
  split). Nothing else renamed standalone.
- **7 analytics non-callables** redistributed per §6.1/§6.2; the `analytics`
  module id and codebase entry cease to exist.

### 7.3 ADD — 2 callables, 3 non-callables, field-level adds

| Add                                                                                                                                                                                                                                                                       | Class                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `platform.listStudentSummaries` (batched, paged)                                                                                                                                                                                                                          | new callable (G1)          |
| `platform.getPlatformHealth`                                                                                                                                                                                                                                              | new callable (split, N1)   |
| sdk-v1 auth trigger pair (user create/delete → `v2_users`)                                                                                                                                                                                                                | non-callable (G15)         |
| `levelup.cleanupInactiveChats` scheduler                                                                                                                                                                                                                                  | non-callable (G16)         |
| Deploy `duplicateSpace`, `saveExamQuestion`                                                                                                                                                                                                                               | deploy gap (G4/G5, Wave 0) |
| Fields: saveExam `questionPaperImages`+`status`+view mapping (G3) · saveEvaluationSettings toggles (G6) · saveSpace retake/price (G7) · notif-prefs shape (G8, ⚖ #2) · canonical `ClassProgressSummaryView` (G9) · `durationMinutes` required for timed assessments (G13) | schema fixes               |

### 7.4 Sequencing (rides FNCLEAN waves — one deploy/soak train, not two)

1. **Wave 0 (now):** deploy the 2 gap callables; rewire 6 legacy seams;
   field-level schema fixes (G3/G6/G7/G9/G13); hosting flip.
2. **Wave 1 (now):** FNCLEAN hazard deletions (unchanged).
3. **Wave 2 (+soak):** legacy purge (66) **+ this standard's deltas**: 5 dup
   cuts, 8 moves, identity→platform rename, adds — one contract PR, one sdk-v1
   deploy, one client flip, one soak.
4. **Waves 3–4:** unchanged (data migration gates, auth-trigger port lands the
   G15 add).
5. **Audit pass (⚖ #3):** grep-verified consumer audit of the 27 🅰 candidates →
   keep-with-tests or cut. Final count recorded here on completion.

### 7.5 Legacy surface — total kill list

All 79 unprefixed legacy functions die per FNCLEAN waves (66 DELETE-NOW, 6 after
Wave-0 rewire, 7 after migration/port). All legacy codebases
(`functions/{identity,levelup,autograde,analytics}`) are removed from
`firebase.json` and archived. The dead client bypass layer
(`shared-services/*-callables.ts` unused wrappers, `shared-hooks/queries/*`) is
deleted in Wave 0 (anti-resurrection). **No legacy name survives in any form.**

---

## 8. Finalization checklist (owner session)

- [ ] ⚖ #1 module rename `identity` → `platform`
- [ ] ⚖ #2 notification-preferences canonical shape
- [ ] ⚖ #3 audit-bucket dispositions (27 🅰 across the three sets — esp. store,
      study goals, reviews, impersonation, exports, DLQ UI)
- [ ] Learning-analytics home confirmed (trends/matrix in levelup; rollups in
      platform)
- [ ] `getProgressSummary` + `getPlatformHealth` naming approved
- [ ] Sequencing (§7.4) approved
- [ ] On FINAL: this doc's status flips, REVIEW stays as rationale record,
      FNCLEAN plan cross-links here as the statement of record
