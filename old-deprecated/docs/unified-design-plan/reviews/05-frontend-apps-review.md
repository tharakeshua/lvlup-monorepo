# Frontend Apps Review — Unified LevelUp + AutoGrade Platform

**Reviewer:** Frontend & Apps Engineer **Review Date:** 2026-02-19 **Plans
Reviewed:** 01-identity-auth-design.md, 02-autograde-design.md,
03-levelup-design.md, 04-analytics-intelligence-design.md,
05-frontend-apps-design.md

---

## Executive Summary

All five design plans collectively describe a coherent and well-thought-out
unified B2B SaaS platform. The shared-types architecture, role-based routing
strategy, TanStack Query caching patterns, and Zustand store design in doc 05
are solid foundations. However, **14 concrete inconsistencies** were identified
across the plans that would cause runtime failures, type errors, or broken UI
states if implemented as written. The most critical cluster involves field-name
mismatches between the AutoGrade data model (doc 02) and the Analytics query
layer (doc 04), which would produce empty or incorrect query results throughout
the analytics and leaderboard surfaces. A second critical cluster is the
`UnifiedRubric` / `EvaluationDimension` type definition conflict between docs 02
and 03, which would break the shared-types package compilation.

**Overall recommendation:** No plan is blocked from proceeding, but **docs 02,
03, and 04 require targeted revisions** before implementation begins in Phase
1+. Doc 01 requires a Firestore rule patch before Admin Web's user-management
screen can function. Doc 05 requires corrections to Cloud Function names and PDF
generation strategy, and addition of a missing notification subscription hook.

---

## Per-Plan Feedback

### Plan 01 — Identity & Auth Design

**Status: APPROVED WITH CHANGES**

The auth architecture is comprehensive: Firebase Auth custom claims, school-code
login, roll-number alias login, multi-org switching via `switchActiveTenant`
CF + force token refresh, and consumer social login are all well-specified. The
`PlatformClaims` shape is clear and Doc 05's `authStore` correctly mirrors it.

**Issues:**

**[P1-01] Firestore Security Rule Gap — TenantAdmin cannot read
`userMemberships`** The Firestore rules for `userMemberships/{membershipId}`
allow read only when `resource.data.userId == request.auth.uid`. A TenantAdmin
managing their school via Admin Web needs to _list_ all memberships for their
`tenantId` (to display the user roster, handle bulk import results, etc.). The
current rule blocks this entirely.

_Required change:_ Add an additional allow-read condition:

```
allow read: if request.auth.uid != null
  && (resource.data.userId == request.auth.uid
      || (request.auth.token.tenantId == resource.data.tenantId
          && request.auth.token.role == 'TenantAdmin'));
```

Without this, `useUserManagement` hook in Admin Web will receive a Firestore
permission-denied error on every load.

**[P1-02] Cloud Function Name Mismatch — `bulkImportStudents` vs
`bulkCreateStudents`** Doc 01 defines the callable Cloud Function as
`bulkImportStudents`. Doc 05 (Integration Points table, line ~1580) references
the same function as `bulkCreateStudents`. These must be reconciled to one
canonical name before the shared-services package is authored.

_Recommended canonical name:_ `bulkImportStudents` (doc 01 is the source of
truth for CF names).

**[P1-03] Open Question — Concurrent multi-tab sessions for different tenants**
A user with `switchActiveTenant` access who opens two browser tabs may end up
with different `activeTenantId` values in localStorage if they switch tenant in
one tab. The `tenantStore` in doc 05 uses `localStorage` persistence, which is
shared across tabs. The design does not specify a `storage` event listener to
sync across tabs or a `BroadcastChannel` solution.

_Required clarification:_ Either document that concurrent multi-tenant tabs are
unsupported (and add a warning banner when switching tenant), or specify a
`BroadcastChannel`-based sync in the `tenantStore` design.

---

### Plan 02 — AutoGrade Design

**Status: APPROVED WITH CHANGES**

The Panopticon + RELMS pipeline, ExamQuestion schema, Submission state machine,
and GradingDeadLetterEntry design are all thorough and well-specified. The
5-status pipeline state machine is clear and the retry/dead-letter strategy is
production-grade.

**Issues:**

**[P2-01] Field Name Mismatch — `studentId` vs `studentUserId` (CRITICAL)** The
`Submission` entity (doc 02, §Submission schema) stores the student's Auth UID
in a field called `studentId`. Doc 04 (§Analytics Queries) queries this
collection with `where('studentUserId', '==', userId)`. This query will return 0
results for every student analytics load.

_Required change:_ Either rename the field in the `Submission` schema to
`studentUserId` (preferred, as it disambiguates Auth UID from entity ID) and
update all doc 02 CF code that writes it, **or** update doc 04 to query
`studentId`. The shared `Submission` TypeScript type in `packages/shared-types`
must reflect the chosen name.

**[P2-02] Field Name Mismatch — `resultsReleased` vs `isReleased` (CRITICAL)**
Doc 02 defines the Submission field as `resultsReleased: boolean`. Doc 04
queries `where('isReleased', '==', true)`. This returns 0 results; exam result
visibility filters will silently fail in every analytics query.

_Required change:_ Standardize to `resultsReleased` (doc 02 source of truth) and
update doc 04.

**[P2-03] Field Name Mismatch — `pipelineStatus` vs `status`, value
`results_released` vs `released` (CRITICAL)** Doc 02 defines
`pipelineStatus: 'pending_upload' | 'mapping' | ... | 'results_released'`. Doc
04 queries `where('status', 'in', ['grading_complete', 'released'])`. Two
problems: (a) wrong field name `status` vs `pipelineStatus`, (b) wrong enum
values `grading_complete`/`released` vs `grading_complete`/`results_released`.

_Required change in doc 04:_

```ts
// Wrong:
.where('status', 'in', ['grading_complete', 'released'])
// Correct:
.where('pipelineStatus', 'in', ['grading_complete', 'results_released'])
```

**[P2-04] PDF Generation Strategy Conflict — Server-side CF vs Client-side
`@react-pdf/renderer`** Doc 02 (§releaseExamResults) specifies that result PDFs
are generated by a Cloud Function using a PDF library and returns a signed GCS
URL. Doc 05 (§Integration Points, Scanner App dependencies) lists
`@react-pdf/renderer` as a client-side dependency for generating exam PDFs.

_Required decision and reconciliation:_ Server-side generation is strongly
preferred for B2B answer-sheet/result PDFs (consistent formatting, no client
memory issues with large PDFs, secure storage). Recommend removing
`@react-pdf/renderer` from doc 05 and having the Teacher Web call the CF to
obtain the signed URL. Client-side `@react-pdf/renderer` may be retained only
for lightweight report cards where offline generation is needed.

**[P2-05] Duplicate Schema Definition — `ExamAnalytics`** `ExamAnalytics` is
fully defined in both doc 02 (§ExamAnalytics entity) and doc 04 (§ExamAnalytics
schema). The two definitions are mostly consistent but doc 02 includes
`itemAnalysis` while doc 04 does not. Having two source-of-truth definitions for
the same Firestore document will cause divergence in `packages/shared-types`.

_Required change:_ Remove the `ExamAnalytics` schema from doc 02. Doc 04
(Analytics & Intelligence) is the correct owner. Doc 02 should reference "see
Analytics design for ExamAnalytics schema."

---

### Plan 03 — LevelUp Design

**Status: NEEDS REVISION**

The LevelUp space/storypoint/item hierarchy, DigitalTestSession 5-status
question tracking, SpaceProgress schema, and AgentConfig design are
well-specified. The RTDB-based practice progress tracking approach is
appropriate for high-frequency writes.

**Issues:**

**[P3-01] `UnifiedRubric.RubricCriterion` Type Conflict (CRITICAL — blocks
shared-types compilation)** Doc 02 defines `RubricCriterion` as:

```ts
{
  description: string;
  marks: number;
}
```

Doc 03 defines `RubricCriterion` as:

```ts
{ id: string; name: string; description: string; maxPoints: number; weight: number; levels: ScoringLevel[] }
```

Since `UnifiedRubric` is in `packages/shared-types` and used by both AutoGrade
and LevelUp, these two definitions cannot coexist. The shared-types package will
not compile.

_Required change:_ Convene AutoGrade and LevelUp engineers to agree on one
canonical `RubricCriterion` shape. **Recommended:** Use the richer doc 03 shape
(`id`, `name`, `description`, `maxPoints`, `weight`, `levels`) since it supports
rubric reuse across AI grading and practice. Update doc 02's
`ExamQuestion.rubric` references and all AutoGrade CF prompt-building code to
use `maxPoints` instead of `marks`.

**[P3-02] `EvaluationDimension` Type Conflict (CRITICAL — blocks shared-types
compilation)** Doc 02 defines `EvaluationDimension` as:

```ts
{
  priority: "HIGH" | "MEDIUM" | "LOW";
  promptGuidance: string;
  expectedFeedbackCount: number;
}
```

Doc 03 defines `EvaluationDimension` as:

```ts
{
  weight: number;
  scoringScale: number;
}
```

These are structurally incompatible. Same compilation-blocking issue as P3-01.

_Required change:_ Merge into one shape that satisfies both use cases:

```ts
interface EvaluationDimension {
  id: string;
  name: string;
  weight: number; // from doc 03
  scoringScale: number; // from doc 03
  priority: "HIGH" | "MEDIUM" | "LOW"; // from doc 02
  promptGuidance: string; // from doc 02
  expectedFeedbackCount: number; // from doc 02
}
```

**[P3-03] RTDB Abbreviated Key Conflict — `b` vs `sc` for best score** Doc 03
defines the RTDB practice progress node using `b` as the abbreviated key for
best score. Doc 04 defines the same RTDB path using `sc` for best score. Since
the frontend reads the key and the Cloud Functions write it, a mismatch here
means the leaderboard and progress charts will show `undefined` for all
best-score values.

_Required change:_ Standardize to one key. Recommend `bs` (best score) to avoid
ambiguity. Update both docs 03 and 04, and the `flushPracticeProgress` CF.

**[P3-04] RTDB Flush Interval Conflict — 10 minutes vs 6 hours** Doc 03 states
that practice session data is flushed from RTDB to Firestore "every 10 minutes."
Doc 04 defines the `flushStalePracticeProgress` Cloud Scheduler trigger with a
6-hour interval. These are irreconcilable as written — a 10-minute flush would
require a Cloud Scheduler job (expensive at scale) or client-triggered write; a
6-hour flush means progress summaries are stale for up to 6 hours.

_Required change:_ Clarify the intended flush architecture:

- **Option A (Recommended):** Client-triggered flush on explicit session end +
  6h Cloud Scheduler as safety net for abandoned sessions. Doc 03's "10 minutes"
  was likely describing the client's RTDB keepalive write interval, not a flush
  interval — clarify this language.
- **Option B:** Use a 30-minute Cloud Scheduler interval as a compromise.

**[P3-05] Missing Firestore Security Rules for `digitalTestSessions`** Doc 03
defines the `digitalTestSessions` Firestore collection but doc 01's Firestore
security rules section does not include rules for this collection. Students must
be able to read/write their own session; Teachers must be able to read sessions
for their classes; TenantAdmin must be able to read all sessions.

_Required addition in doc 01:_

```
match /tenants/{tenantId}/digitalTestSessions/{sessionId} {
  allow create: if isStudentInTenant(tenantId)
    && request.resource.data.studentId == request.auth.uid;
  allow update: if request.auth.uid == resource.data.studentId
    && resource.data.status != 'submitted';
  allow read: if isStudentOwner()
    || isTeacherInTenant(tenantId)
    || isTenantAdmin(tenantId);
}
```

---

### Plan 04 — Analytics & Intelligence Design

**Status: NEEDS REVISION**

The Insight Engine rule-based architecture (no LLM dependency for
recommendations) is a sound design choice for predictability and cost control.
The multi-level analytics hierarchy (student → class → tenant) and the nightly
computation pattern are well-suited to Firestore. The LLMWrapper cost tracking
design is thorough.

**Issues:**

**[P4-01, P4-02, P4-03] — Already documented under P2-01, P2-02, P2-03 above.**
These are the three Submission query field-name errors. They originate in doc
04's query code but the root definition is in doc 02. They are repeated here for
completeness:

- `studentUserId` → should be `studentId` (or the agreed canonical name from
  P2-01)
- `isReleased` → should be `resultsReleased`
- `status in ['released']` → should be `pipelineStatus == 'results_released'`

**[P4-04] Notification Routing is App-Unaware** Doc 04 defines
`Notification.actionUrl: string` as a route path (e.g.,
`/exams/{examId}/results`). This route is used across all apps (Teacher Web,
Student Web, Admin Web, Parent Web), but the same path string is not valid in
all apps — Teacher Web mounts at `/teacher/...`, Student Web at `/student/...`,
etc. as defined in doc 05.

_Required change:_ Either:

- **Option A:** Store a
  `targetApp: 'teacher-web' | 'student-web' | 'admin-web' | 'parent-web'` field
  alongside `actionUrl`, and have each app's notification handler only process
  notifications targeted at it.
- **Option B:** Use fully-qualified app-specific deep-link paths (e.g.,
  `/teacher/exams/{examId}/results`), relying on the app's router to handle or
  reject unrecognized paths.

**[P4-05] `costSummaries` Firestore Path Structure Ambiguity** Doc 04 defines
cost tracking at paths `costSummaries/daily/{YYYY-MM-DD}` and
`costSummaries/monthly/{YYYY-MM}`. In Firestore, a document path must alternate
collection/document segments. `costSummaries/daily/{YYYY-MM-DD}` reads as:
collection `costSummaries`, document `daily`, subcollection _(missing)_. This
would need to be either:

- `costSummaries/{YYYY-MM-DD}` (flat collection, type discriminated by a
  `period: 'daily'` field), or
- `costSummaries/daily/entries/{YYYY-MM-DD}` (subcollection with a non-useful
  intermediate document)

_Required change:_ Clarify as `dailyCostSummaries/{YYYY-MM-DD}` and
`monthlyCostSummaries/{YYYY-MM}` (two top-level collections, not nested under
`costSummaries`). Update Firestore rules accordingly.

---

### Plan 05 — Frontend Apps Design

**Status: APPROVED WITH CHANGES**

The Frontend Apps design is the most complete of the five plans. The 6-app
surface breakdown, 91-component shared-ui library, role-based routing with
ProtectedRoute, Zustand store design, TanStack Query key factory pattern, and
multi-layer caching strategy are all production-quality. The Scanner App offline
queue (IndexedDB + Background Sync) is well-specified.

**Issues:**

**[P5-01] Cloud Function Name Mismatch — `bulkCreateStudents` vs
`bulkImportStudents`** The Integration Points table in doc 05 references
`bulkCreateStudents` as the callable CF for bulk student import. Doc 01 defines
this function as `bulkImportStudents`. See P1-02.

_Required change:_ Update doc 05 to reference `bulkImportStudents`.

**[P5-02] PDF Generation Strategy Conflict** Doc 05 lists `@react-pdf/renderer`
as a client-side dependency. Doc 02 specifies server-side PDF generation via
Cloud Function. See P2-04.

_Required change:_ Remove `@react-pdf/renderer` from doc 05 client dependencies.
The Teacher Web PDF download flow should call the `releaseExamResults` CF (or a
dedicated `generateResultPdf` CF) and open the returned signed GCS URL. Document
this in the Integration Points table.

**[P5-03] Missing Notification Real-Time Subscription Hook** Doc 05 defines
real-time subscription hooks for RTDB (`usePracticeProgress`, `useLeaderboard`)
and Firestore (`useLiveSubmissionStatus`), but there is no hook for subscribing
to user notifications. Notifications are stored in Firestore (per doc 04) and
the notification bell in the nav shell requires a live `onSnapshot` listener.

_Required addition:_

```ts
// packages/shared-hooks/useNotifications.ts
export function useNotifications() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("targetUserId", "==", user.uid),
      where("read", "==", false),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      queryClient.setQueryData(
        notificationKeys.unread(user.uid),
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    });
    return unsub;
  }, [user?.uid]);
}
```

Add `notificationKeys` to the query key factory and add `useNotifications` to
the list of real-time subscription hooks in doc 05.

**[P5-04] `isConsumer` Determination Logic Underspecified** Doc 05 references
`isConsumer` as a flag used in route guards and the `authStore`, but does not
fully specify how it is determined. The `PlatformClaims` in doc 01 does not
include an `isConsumer` field. Consumers are identified by role `'Consumer'` in
the custom claims.

_Required clarification:_ Add to doc 05:

```ts
// In authStore, derived from PlatformClaims:
isConsumer: computed from (claims.role === 'Consumer')
```

Also confirm that the consumer public-store route (`/store`) is accessible
without auth (currently listed under ProtectedRoute but should be public with
optional-auth behavior).

---

## Cross-Cutting Issues

**[XC-01] `UnifiedRubric` and `EvaluationDimension` in `packages/shared-types`
(CRITICAL)** Issues P3-01 and P3-02 above must be resolved before
`packages/shared-types` can be authored. These types are the foundational
contract between AutoGrade's RELMS grading CF, LevelUp's AI evaluation CF, and
the frontend's grading review UI. Recommend scheduling a synchronous meeting
between AutoGrade and LevelUp engineers to finalize the canonical shapes before
Phase 1 begins.

**[XC-02] Submission Field Names Across Three Plans** Issues P2-01, P2-02, P2-03
affect three plans (02, 04, 05) and the shared-types package. Once the canonical
field names are decided, a global search-replace across all docs is needed to
ensure consistency.

**[XC-03] RTDB Schema Must Be Locked Before Phase 1** The RTDB abbreviated key
conflict (P3-03) and flush interval conflict (P3-04) must be resolved before any
frontend hooks are built for practice progress and leaderboards. The abbreviated
keys affect the raw data read from RTDB in `usePracticeProgress` and the
leaderboard subscription hook.

---

## Missing API / Data Contracts

The following are contracts referenced in doc 05 that are not yet fully defined
in any of the other four plans:

| Missing Contract                                                                 | Needed By                  | Blocking |
| -------------------------------------------------------------------------------- | -------------------------- | -------- |
| `generateResultPdf` CF response shape (signed URL + metadata)                    | Teacher Web PDF download   | Phase 2  |
| `Notification` Firestore document full schema (all fields including `targetApp`) | All nav shells             | Phase 1  |
| `costSummaries` correct Firestore path (daily/monthly)                           | Super Admin billing screen | Phase 4  |
| `digitalTestSessions` Firestore security rules                                   | Student Web test runner    | Phase 2  |
| `isConsumer` in PlatformClaims or `authStore` derivation                         | Consumer/B2C path routing  | Phase 6  |
| `bulkImportStudents` callable CF request/response envelope                       | Admin Web bulk import      | Phase 2  |
| `switchActiveTenant` response shape (new custom token vs force-refresh flag)     | Org switcher component     | Phase 1  |

---

## Suggested Changes Summary

| Issue ID | Plan(s) | Severity | Change Required                                                       |
| -------- | ------- | -------- | --------------------------------------------------------------------- |
| P1-01    | 01      | HIGH     | Add TenantAdmin read rule for userMemberships                         |
| P1-02    | 01, 05  | MEDIUM   | Standardize CF name to `bulkImportStudents`                           |
| P1-03    | 01, 05  | LOW      | Clarify multi-tab tenant switching behavior                           |
| P2-01    | 02, 04  | CRITICAL | Standardize `studentId` vs `studentUserId`                            |
| P2-02    | 02, 04  | CRITICAL | Standardize `resultsReleased` vs `isReleased`                         |
| P2-03    | 02, 04  | CRITICAL | Fix `pipelineStatus`/`results_released` in analytics queries          |
| P2-04    | 02, 05  | HIGH     | Decide server vs client PDF; remove `@react-pdf/renderer` from client |
| P2-05    | 02, 04  | MEDIUM   | Remove `ExamAnalytics` definition from doc 02; doc 04 is owner        |
| P3-01    | 02, 03  | CRITICAL | Reconcile `RubricCriterion` shape in shared-types                     |
| P3-02    | 02, 03  | CRITICAL | Reconcile `EvaluationDimension` shape in shared-types                 |
| P3-03    | 03, 04  | HIGH     | Standardize RTDB best-score abbreviated key                           |
| P3-04    | 03, 04  | HIGH     | Clarify flush interval: client-on-end + 6h scheduler                  |
| P3-05    | 01, 03  | HIGH     | Add Firestore rules for `digitalTestSessions`                         |
| P4-04    | 04, 05  | MEDIUM   | Add `targetApp` field to Notification; update routing logic           |
| P4-05    | 04      | MEDIUM   | Fix Firestore path for cost summaries                                 |
| P5-03    | 05      | MEDIUM   | Add `useNotifications` real-time subscription hook                    |
| P5-04    | 01, 05  | LOW      | Specify `isConsumer` derivation in authStore                          |

---

## Approval Status

| Plan                          | Status                    | Conditions                                                                                                                                                                                                                |
| ----------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 — Identity & Auth          | **APPROVED WITH CHANGES** | Fix TenantAdmin userMemberships rule (P1-01); standardize CF name (P1-02); clarify multi-tab behavior (P1-03); add `digitalTestSessions` Firestore rules (P3-05)                                                          |
| 02 — AutoGrade                | **APPROVED WITH CHANGES** | Fix 3 Submission field names (P2-01, P2-02, P2-03); resolve PDF strategy (P2-04); remove duplicate ExamAnalytics definition (P2-05); reconcile shared types (P3-01, P3-02)                                                |
| 03 — LevelUp                  | **NEEDS REVISION**        | Reconcile `RubricCriterion` and `EvaluationDimension` with doc 02 (P3-01, P3-02) — **blocks shared-types authoring**; fix RTDB key and flush interval (P3-03, P3-04); add Firestore rules for digitalTestSessions (P3-05) |
| 04 — Analytics & Intelligence | **NEEDS REVISION**        | Fix 3 wrong field names in Submission queries (P4-01/02/03); add `targetApp` to Notification (P4-04); fix costSummaries Firestore path (P4-05)                                                                            |
| 05 — Frontend Apps            | **APPROVED WITH CHANGES** | Fix CF name (P5-01); resolve PDF dependency (P5-02); add notification subscription hook (P5-03); specify isConsumer derivation (P5-04)                                                                                    |

---

## Implementation Readiness

**Can proceed now (Phase 0):**

- Monorepo scaffolding (Turborepo, pnpm workspaces)
- Shared UI library (`packages/shared-ui`) — no dependency on disputed types
- Auth store and auth UI (school-code login, consumer login) — PlatformClaims
  shape is agreed
- Route shells and ProtectedRoute — roles are agreed

**Blocked until type conflicts resolved (P3-01, P3-02):**

- `packages/shared-types` — cannot finalize `UnifiedRubric`,
  `EvaluationDimension`, `Submission`
- Any grading UI components that import from shared-types
- AutoGrade exam editor and grading review screens
- LevelUp agent configuration UI

**Blocked until field names resolved (P2-01, P2-02, P2-03):**

- Analytics hooks (`useExamAnalytics`, `useStudentProgressSummary`)
- Teacher analytics dashboard
- Student results screen
- Parent progress screen
