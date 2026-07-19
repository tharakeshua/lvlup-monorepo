# API-DESIGN-REVIEW — First-Principles Review of the v1 Surface

**Date:** 2026-07-18 · **Branch:** `staging` · **Author:** Fable (APISTD
session) · **Status:** DRAFT — to be finalized interactively with the owner

**Inputs:** `packages/api-contract` (142 callables, built registry verified),
`docs/functions-cleanup/` (FNCLEAN 1–4: 244 deployed → 167 end-state; the usage
map is ground truth for "working/used"), `API_REDESIGN.md`,
`AUTOGRADE-E2E-API-PLAN.md`, `docs/pr-reviews/REVIEW-{B,C,D}`, contract source
(`callable-def.ts`, `errors.ts`, `pagination.ts`, `meta.ts`, `transitions.ts`,
per-module callable files).

**Owner constraints (verbatim intent):** no legacy data; ALL legacy APIs die;
only current, properly-designed, working, tested APIs survive; THREE modular
sets — **Autograde**, **LevelUp/Spaces**, **Platform Core** (users, tenants,
auth, notifications, analytics, "and all that").

---

## 1. Verdict summary

The v1 contract tier is **fundamentally sound and worth keeping as the
chassis**. The `CallableDef` unit (strict zod request/response, authMode,
rateTier, idempotency hints, `authoritySensitive`, `invalidates`), the 14-code
transport-neutral error taxonomy, cursor-only pagination, claims-derived tenancy
(no `tenantId` in request bodies), and the `v1.<module>.<op>` →
`v1-<module>-<op>` naming seam are all first-principles-correct designs already
implemented and 140/140 contract-pinned. **We are not redesigning the chassis.
We are fixing the map.**

What is wrong, in priority order:

1. **The module map doesn't match the product.** Four modules (identity 60 /
   levelup 50 / autograde 19 / analytics 13) vs the owner's three sets. The
   **analytics module is not a bounded context** — it is a grab-bag that
   duplicates three other modules' callables and mixes exam analytics, learning
   analytics, parent surface, cost telemetry, and platform audit. **It should
   dissolve into the three sets.**
2. **Three true duplicate callables with drifted shapes** (§3) — the strongest
   evidence the analytics boundary is wrong.
3. **~25 callables have no verified UI caller** — "SDK-reachable" is proven
   (wire-coverage pin) but "used and working" is not. The owner's bar says these
   must earn their place or die (§6).
4. **A dozen field/shape parity gaps** flagged by PR reviewers B/C/D that the
   standard must close (§5).
5. **Minor naming-grammar drift** (§4) — worth fixing exactly once, now, while
   we're already deleting 77 legacy functions and renaming nothing costs the
   least it ever will.

---

## 2. Module boundaries: the 3-set model vs today's 4 modules

### 2.1 Today

| Module    | Callables | Non-callables | Assessment                                                                                                                                                                       |
| --------- | --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| identity  | 60        | 8             | Coherent but overly broad label — it already IS "platform core" (auth, users, tenants, classes, notifications, announcements, config, impersonation, exports, assets, messaging) |
| levelup   | 50        | 2             | Coherent bounded context (spaces, content, tests, gamification, chat/tutor, store)                                                                                               |
| autograde | 19        | 8             | The best-designed module — view projections, pipeline model, release gating                                                                                                      |
| analytics | 13        | 7             | **Not a bounded context.** Duplicates autograde (`getExamAnalytics`), levelup (`getLeaderboard`, `dismissInsight`), and identity's parent surface; mixes 5 unrelated concerns    |

### 2.2 The finding: "analytics" is a layer, not a domain

Analytics reads are always _about_ some domain's resources. Splitting them into
their own module produced exactly the pathology you'd predict: two teams needing
the same read each declared it in "their" module, and the shapes drifted (§3).
The owner's 3-set model resolves this correctly:

- **Exam analytics → AUTOGRADE** (it's a projection of the exam/submission
  aggregate).
- **Learning analytics (leaderboards, insights, progress trends, assignment
  matrix) → LEVELUP** (projections of spaces/progress).
- **Cross-domain rollups, reporting, cost telemetry, platform activity,
  parent/guardian summaries → PLATFORM CORE** (they aggregate _across_ the other
  two sets, or serve platform roles).

### 2.3 Recommended mapping (the migration delta lives in the STANDARD doc §6)

| Analytics callable (13) | Disposition                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getExamAnalytics`      | **CUT** — duplicate; keep `v1.autograde.getExamAnalytics` (the view-projected one, which is the better design)                                                                                      |
| `getLeaderboard`        | **CUT** — duplicate; keep `v1.levelup.getLeaderboard` (paged + `callerEntry`; tighten its loose `scope: z.string()` to the enum from the analytics twin)                                            |
| `dismissInsight`        | **CUT** — duplicate of `v1.levelup.dismissInsight`                                                                                                                                                  |
| `listInsights`          | **CUT/MERGE** — one insights surface: `v1.levelup.listLearningInsights`                                                                                                                             |
| `getChildSummary`       | **CUT/FOLD** — into `getSummary{scope:'student'}` (REVIEW-B PR#35: the parent-gated twin 403'd students reading their own summary; authorize at the resource, not by caller-role-specific endpoint) |
| `getSummary`            | **MOVE → platform** (cross-domain rollup reader; formalize `scope` enum: student/class/tenant/health)                                                                                               |
| `generateReport`        | **MOVE → platform** (PDF/report generation, report rate-tier)                                                                                                                                       |
| `getCostSummary`        | **MOVE → platform** (AI spend telemetry — admin/ops concern)                                                                                                                                        |
| `listPlatformActivity`  | **MOVE → platform** (audit log)                                                                                                                                                                     |
| `listLinkedChildren`    | **MOVE → platform** (guardianship is identity data)                                                                                                                                                 |
| `listParentAlerts`      | **MOVE → platform** (notification-adjacent parent surface)                                                                                                                                          |
| `getPerformanceTrends`  | **MOVE → levelup** (learning-progress projection)                                                                                                                                                   |
| `getAssignmentMatrix`   | **MOVE → levelup** (content-assignment coverage projection)                                                                                                                                         |

Result: **the analytics module (and its codebase entry) disappears**; 5 cuts, 8
moves. The 7 analytics non-callables (triggers/schedulers/taskQueue: rollups,
insights generation, cost aggregation) move to the module that owns the data
they project — details in STANDARD §6.4.

### 2.4 Module naming: `identity` → `platform`

The owner's label for set 3 is "Platform Core." The module id appears in every
callable name (`v1.identity.getMe` → deployed `v1-identity-getMe`), so this is a
real decision, not cosmetics:

- **Option A (recommended): rename `identity` → `platform`.** One mechanical
  registry change; the SDK, transport mapping, and 140/140 pin test make it a
  controlled sweep; we are already deploying +2 and deleting 77 functions in the
  FNCLEAN waves, so the deploy/soak machinery is already running. This is the
  cheapest this rename will ever be, and the name will be load-bearing for
  years.
- **Option B: keep `identity` as the wire id, brand the set "Platform Core" in
  docs.** Zero deploy cost, permanent name/label mismatch, and `identity`
  genuinely lies about the module's content (it owns notifications, reports,
  config, audit — not just identity).

**⚖ OWNER DECISION #1** — Option A rename, or Option B keep. Everything else in
the standard is written against Option A (`v1.platform.*`) with Option B as a
find-replace fallback.

---

## 3. Duplicates & drifted twins (verified in contract source)

The three duplicate pairs are not aliases — they have **independently drifted
schemas**, which is the failure mode duplicate declarations always produce:

| Pair                                                         | Drift                                                                                                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `analytics.getExamAnalytics` vs `autograde.getExamAnalytics` | analytics returns raw domain `ExamAnalyticsSchema`; autograde returns `ExamAnalyticsViewSchema` (projection, role-stripped). Same request. Two response shapes for one resource.                                    |
| `analytics.getLeaderboard` vs `levelup.getLeaderboard`       | analytics: non-paged `{entries, myEntry?}`, typed scope enum. levelup: paged `pageResponse + {callerEntry}`, **loose `scope: z.string()`**. Different envelope, different caller-entry key, different typing rigor. |
| `analytics.dismissInsight` vs `levelup.dismissInsight`       | Same operation declared twice.                                                                                                                                                                                      |

**Rule for the standard:** one resource, one reader. A callable name may exist
in exactly one module; a resource's projections live in the module that owns the
aggregate.

---

## 4. Naming & grammar findings

The core grammar is good and stays: `save<Entity>` upsert (`{id?, data}` →
`{id, created}`), `list<Entity>s` paged reads, `get<Entity>` single reads,
action verbs only for genuinely distinct operations (`startTestSession`,
`releaseResults`, `gradeQuestion`). Findings:

| #   | Finding                                                                                                                                                               | Recommendation                                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | `getSummary` is the vaguest name on the surface, and its scopes (student/class/tenant/health) make it four endpoints in a trenchcoat                                  | Keep the scope-enum design (it worked in PR#35's consolidation) but rename to **`getProgressSummary`**; split `scope:'health'` out as **`getPlatformHealth`** (a super-admin op with nothing in common with progress rollups)                                                                      |
| N2  | `markAnnouncementRead` / `markNotificationRead` (singular) vs `markAchievementsSeen` (plural + different verb)                                                        | Unify on **`markXRead`** singular-target grammar: `markAchievementsSeen` → **`markAchievementsRead`** only if we touch it anyway; low priority                                                                                                                                                     |
| N3  | `levelup.getLeaderboard` request has `scope: z.string()` (loose)                                                                                                      | Adopt the analytics twin's `z.enum(["tenant","space","storyPoint"])` when the twin is cut                                                                                                                                                                                                          |
| N4  | Three separate evaluation-config surfaces: `identity.{save,list}GlobalEvaluationPreset`, `autograde.{save,list}EvaluationSettings`, `levelup.{save,list}RubricPreset` | These are 3 genuinely different resources (platform-level presets / exam grading settings / item rubrics) — **keep separate** but the STANDARD documents the distinction explicitly so nobody "consolidates" them wrongly, and the eval-settings toggle fields flagged by reviewers get added (§5) |
| N5  | `updateMyProfile` breaks `save*` grammar                                                                                                                              | Keep — **me-scoped ops** are their own grammar class (`getMe`, `updateMyProfile`, `deleteConsumerAccount`); the standard legitimizes it                                                                                                                                                            |
| N6  | Error-code naming: contract says `PRECONDITION_FAILED`, PR#29 review text cites `fail("FAILED_PRECONDITION")` in services                                             | Verify `fail()` call sites use `AppErrorCode` spellings; the contract enum is the SSOT. Any gRPC-spelling stragglers are bugs                                                                                                                                                                      |
| N7  | `sendDirectMessage` (admin→user) vs `sendChatMessage` (student→tutor)                                                                                                 | Different domains, both fine — document the distinction                                                                                                                                                                                                                                            |

Rename policy for the standard: **rename only when the name lies** (N1) or when
a module moves (§2). Grammar-polish renames (N2) ride along only if the callable
is being touched for another reason.

---

## 5. Parity gaps — the ADD/FIX list (from REVIEW-B/C/D + web-SDK-migration findings)

These are places the contract is **missing something clients demonstrably
need**. Every one becomes a work item in the STANDARD's migration delta:

| #   | Gap                                                                                                                                                                                                            | Evidence                                                    | Fix class                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **Batched student summaries** — PR#35 regressed `getMany()` from one batched call to N-call client fan-out; `getStudentSummaries`/`getClassSummary` were deleted from contract types while a consumer remained | REVIEW-B §PR35 (violates PC-14 "never one read per member") | **ADD `platform.listStudentSummaries`** (batched by ids, paged); `getClassSummary` stays folded into `getProgressSummary{scope:'class'}`                                              |
| G2  | `getSummary` 403s: parent-gated `getChildSummary` blocked student self-reads; assigned-teacher class reads 403 (escalated P2)                                                                                  | REVIEW-B §PR35, REVIEW-C §PR6                               | **FIX authz at resource level** in `getProgressSummary`: student may read self, parent may read linked children, teacher may read assigned classes. No caller-role-specific endpoints |
| G3  | `saveExam` must accept `questionPaperImages` + `status`, and the exam **view** must map `questionPaperImages` → `questionPaper.images` (write path and read path currently misaligned → silent no-op)          | REVIEW-C §PR7                                               | **FIX field contract** + view projection alignment; add contract test asserting the round-trip                                                                                        |
| G4  | `saveExamQuestion` contract-declared + hook-wired but **not deployed**                                                                                                                                         | FNCLEAN-2 §1                                                | **DEPLOY** (already Wave 0)                                                                                                                                                           |
| G5  | `duplicateSpace` contract-declared, live caller, **not deployed** (NOT_FOUND in prod)                                                                                                                          | FNCLEAN-2 break #1                                          | **DEPLOY** (already Wave 0)                                                                                                                                                           |
| G6  | Eval-settings toggles not representable in contract (teacher-web settings UI)                                                                                                                                  | web-SDK-migration memory; REVIEW-C                          | **ADD fields** to `autograde.saveEvaluationSettings` request schema                                                                                                                   |
| G7  | `saveSpace` missing retake/price fields                                                                                                                                                                        | web-SDK-migration parity list                               | **ADD fields** to `levelup.saveSpace`                                                                                                                                                 |
| G8  | Notification-preferences shape: client needs 6 named toggles, contract has `enabledTypes[]`                                                                                                                    | student-web migration notes                                 | **⚖ OWNER DECISION #2**: canonical prefs shape (named toggles vs type array). Recommend named-toggle object — closed set, self-documenting, strict-schema-friendly                    |
| G9  | `ClassProgressSummary` domain-vs-legacy shape mismatch (admin-web Dashboard/Analytics HIGH-RISK flag; teacher-web needed `adaptClassSummary`)                                                                  | web-admin migration; REVIEW-B                               | **FIX**: one canonical `ClassProgressSummaryView` in domain, all clients consume it, adapters die                                                                                     |
| G10 | Admin-web LogoUploader asset-upload payload shape vs `uploadTenantAsset` strict schema                                                                                                                         | web-admin migration; FNCLEAN Wave-0 item 5                  | **VERIFY/FIX** payload schema during the Wave-0 rewire                                                                                                                                |
| G11 | Clients passing `tenantId: ""` on the B2C path expecting server-side derivation                                                                                                                                | REVIEW-B §PR34                                              | Not a contract change — the contract already **forbids** `tenantId` in requests (D2). The `tenantId:""` call sites are off-contract legacy seams; they die with the legacy surface    |
| G12 | `startTestSession` must fail `PRECONDITION_FAILED` (not generic 500) on empty question order; `questionOrder` must filter question items only                                                                  | REVIEW-B §PR29                                              | **FIX service behavior** + document in endpoint spec; add unit test                                                                                                                   |
| G13 | Timed-test story points seeded without `assessmentConfig.durationMinutes` → invalid for `startTestSession`                                                                                                     | REVIEW-B §PR27                                              | **FIX schema**: require `durationMinutes` for timed assessments at write time (`saveStoryPoint`/`saveExam` refinement), not via heal scripts                                          |
| G14 | No permissions-read hook (admin-web)                                                                                                                                                                           | web-admin migration                                         | **AUDIT**: decide whether `getMe` claims projection already covers it; if not, ADD a read                                                                                             |
| G15 | Auth-trigger port: sdk-v1 has NO user-create/delete handling (`onUserCreated`/`onUserDeleted` are the last legacy holdouts)                                                                                    | FNCLEAN §5.1                                                | **ADD non-callable**: sdk-v1 auth trigger pair writing `v2_users` (blocks FNCLEAN Wave 4)                                                                                             |
| G16 | No inactivity sweep for v2 chat sessions                                                                                                                                                                       | FNCLEAN §5.4                                                | **ADD non-callable**: `v1-levelup-cleanupInactiveChats` scheduler (recommended option (a))                                                                                            |

---

## 6. The "working + tested" bar — audit bucket

FNCLEAN-2 proved all 140 deployed callables are _SDK-reachable_ (wire-coverage
pin) but explicitly did **not** prove every one has a live UI caller. Under the
owner's bar ("only working, tested APIs survive"), reachability is not enough.
The standard (STANDARD §5) defines the bar: **contract pin + unit tests +
deployed smoke + a verified consumer**. Candidates I could not verify a consumer
for from the available evidence — each needs a UI-caller audit before it earns a
place, else it is cut:

- **Platform:** `estimateAudience`, `joinTenant`, `bulkApplyTenantFeatures`,
  `exportTenantData` + `listExportJobs`,
  `startImpersonation`/`endImpersonation`,
  `savePlatformConfig`/`getPlatformConfig`, `rolloverSession`, `createOrgUser`,
  `bulkUpdateStatus`, `searchUsers`, `sendDirectMessage`, `sendPasswordReset`
- **LevelUp:** `listStudySessions`, `listStudyGoals`/`saveStudyGoal`,
  `listSpaceReviews`/`saveSpaceReview`, `listVersions`,
  `saveAgent`/`listAgents`, `generateContent`, `assignContent`,
  `importFromBank`, store trio (`purchaseSpace`, `getStoreSpace`,
  `listStoreSpaces`) — the store is a product decision, not a tech one
- **Autograde:** `resolveDeadLetter`/`listDeadLetter` (ops surface — keep if the
  DLQ UI exists, else it's an admin-CLI concern)

**⚖ OWNER DECISION #3** — for each audit-bucket group: confirm the feature is
real (keep + test to the bar) or cut it. Recommend running the audit as a
mechanical grep of `@levelup/query` hook → app call sites (same method as
FNCLEAN-2) rather than deciding from memory.

## 7. Envelope / pagination / error model / auth — assessment

| Layer             | Verdict                  | Notes                                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request envelope  | ✅ keep                  | `{id?, data}` upserts; strict schemas; no `tenantId` (claims-derived); `tenantOverride` only via `allowsTenantOverride` (audited super-admin escape hatch)                                                                                                             |
| Response envelope | ✅ keep, enforce         | `SaveResponse {id, created}`; **view projections** (role-stripped `.optional()` fields) are the autograde pattern — the standard makes them mandatory for all read responses; the analytics module's raw-domain-schema responses (§3) are the counterexample that dies |
| Pagination        | ✅ keep                  | `PageRequest` (opaque cursor, limit≤100 default 20) / `pageResponse {items, nextCursor, total?}`; cursor-only, no offset. The non-paged `getLeaderboard` twin dies with the module                                                                                     |
| Errors            | ✅ keep                  | 14-code `AppErrorCode` taxonomy, `DEFAULT_RETRYABLE`, transport maps, copy tables — first-class. Fix N6 spelling stragglers                                                                                                                                            |
| Idempotency       | ✅ keep                  | transport UUIDv7 key default; `domain:` hints where identity is semantic; never a request-schema field                                                                                                                                                                 |
| Rate tiers        | ✅ keep                  | 5 tiers with one `RATE_LIMITS` table                                                                                                                                                                                                                                   |
| State machines    | ✅ keep                  | `ALLOWED_TRANSITIONS` authored once in domain, re-exported; status transitions via `save*` + `INVALID_TRANSITION` error                                                                                                                                                |
| Versioning        | ✅ keep, document policy | `v1` prefix in every name; breaking change ⇒ new op under `v2.<module>.<op>`, dual-run, then delete — never mutate a published schema incompatibly (STANDARD §4.8)                                                                                                     |
| Subscriptions     | ✅ keep                  | RTDB projections + bump-node signals (AD-12 end state, zero Firestore subs) — the standard records this as the realtime pattern                                                                                                                                        |

## 8. Open questions for the finalization session

1. **⚖ #1 (§2.4):** rename `identity` → `platform` (recommended) or keep the
   wire id?
2. **⚖ #2 (G8):** canonical notification-preferences shape — named toggles
   (recommended) or type array?
3. **⚖ #3 (§6):** audit-bucket dispositions — which features are real (store?
   study goals? space reviews? impersonation? exports? DLQ UI?)
4. **Learning-analytics home:** I put
   `getPerformanceTrends`/`getAssignmentMatrix` in LEVELUP (learning analytics
   is first-class platform functionality) and cross-domain rollups in PLATFORM.
   Confirm this split matches your mental model of "analytics" in Platform Core.
5. **`getSummary` rename** to `getProgressSummary` + `getPlatformHealth` split
   (N1) — approve?
6. **Wave timing:** the standard's rename/move deltas piggyback on FNCLEAN Waves
   0–2 (one deploy+soak cycle instead of two). Confirm sequencing.
