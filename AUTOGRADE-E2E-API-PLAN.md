# AUTOGRADE — End-to-End Journey + Proper-API-Design Master Plan

**The #1 Fable blueprint: make the ENTIRE autograde journey work perfectly, on a
clean API.**

**Author:** scoping worker `sess_1783166173234_jk2iegn4s` · Task
`task_1783166164336_sf694b9jh` **Date:** 2026-07-04 · **Mode:** analysis + API
design + planning only. **No code changed.** **Builds on (does NOT redo):**
`functions/autograde/AUTOGRADE_ANALYSIS.md`,
`functions/autograde/CONTRACT_REPORT.md`,
`functions/identity/CORE-B2B-DOMAIN-BRIEF.md`, `DATA-MODEL-FIX-PLAN.md`,
`API_REDESIGN.md`. **User's stated goal (2026-07-04):** (1) the website, (2)
admin/teacher autograde features, (3) student autograde features — **deployed**,
apps published as **debug**. §9 maps every ask to a phase.

---

## 0. TL;DR — the one thing you must understand

There are **two parallel autograde backends** in this repo, and **both are
configured to deploy**:

|                                                 | LEGACY tier                               | **v1 tier (the proper design)**                                      |
| ----------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| Code                                            | `functions/autograde/src/*`               | `functions/sdk-v1/src/autograde.ts` → `@levelup/services`            |
| Deploy codebase                                 | `firebase.json` → `autograde`             | `firebase.json` → `sdk-v1`                                           |
| Type SSOT                                       | `@levelup/shared-types` (legacy)          | **`@levelup/domain` (Zod SSOT)**                                     |
| Callable names                                  | bare `saveExam`, `extractQuestions`…      | **`v1.autograde.*` (16 callables)**                                  |
| Reads                                           | ❌ none (only 4 writes)                   | ✅ full (`listExams`/`getExam`/`getSubmission`/…)                    |
| Pipeline                                        | trigger-chaining (implicit state machine) | **Cloud Tasks single-writer `advancePipeline` reducer**              |
| DLQ / eval-settings / upload-URL                | partial / absent                          | ✅ `resolveDeadLetter`, `saveEvaluationSettings`, `requestUploadUrl` |
| Carries the P0 `questionPaperImages .url()` bug | **YES**                                   | NO (domain schema is correct)                                        |

**The proper, well-designed API the user is asking for is ~85% already built —
it is the v1 tier.** It is domain-pure, consistent (`{ id?, data }` upsert
writes + `{ cursor?, limit }` reads + view projections + a canonical `Transport`
envelope), release-gated, and the dotted→dashed wire seam is **RESOLVED**
(`transport-firebase/.../invoke-via-callable.ts:toDeployedCallableId` maps
`v1.autograde.saveExam` → deployed id `v1-autograde-saveExam`; unit-tested).

**So "autograde doesn't work end to end" is NOT primarily a design problem —
it's a **convergence + finish + deploy** problem.** Five things keep the journey
from being GREEN end-to-end:

1. **Split write path (the live breakage).** Reads are 100% v1, but
   teacher-web's three lifecycle writes — **create exam / extract questions /
   upload answer sheets** — still call the **LEGACY** `functions/autograde`
   callables via `@levelup/shared-services` (`callSaveExam`,
   `callExtractQuestions`, `callUploadAnswerSheets`). The v1 replacement hooks
   (`useSaveExam`/`useExtractQuestions`/`useUploadAnswerSheets`) **already exist
   in `@levelup/query` and are unused for these three.** The legacy path is
   exactly where the `questionPaperImages` `.url()` P0 lives → **exam creation
   is the most likely broken step.**
2. **Onboarding v1 gaps.** `saveTenantService` does **not** create the
   `tenantCode` index doc nor an owner membership; `bulkImportStudentsService`
   creates entity docs but **no auth users / memberships / claims** →
   bulk-imported students cannot log in, and `joinTenant`/`lookupTenantByCode`
   fail with no code index. The school-onboarding front door is partial.
3. **Response validation is OFF** in both `teacher-web` and `mobile-teacher`
   api-clients because read canonicalization is only partial (legacy `order` vs
   `orderIndex`, enum drift). This is a load-bearing workaround that masks
   contract drift — the target is validation **ON**.
4. **Student results discovery gap.** Student detail view works
   (`/exams/:examId/results`), but `student-web` has **no `/results` listing
   page** (route missing though linked + e2e-expected); students can only reach
   results via a notification deep-link. Parent-web is complete.
5. **Two backends deployed at once.** Pick **v1 as canonical**, cut all clients
   to it, and stop deploying (retire) `functions/autograde` so there is one
   source of truth.

Everything below is the map, the gap list, the clean-API spec, the Fable-sized
units, and the proof plan.

---

## 1. END-TO-END SEQUENCE MAP (onboard → exam → upload → grade → feedback)

Status legend: 🟢 **GREEN** works · 🟡 **YELLOW** partial / drift / workaround ·
🔴 **RED** broken or missing. Every callable below is the **v1 target**; where
the live client still calls legacy, it's flagged.

### Phase A — Onboard a SCHOOL (tenant)

| #   | Step                             | Callable (v1)                       | Service impl                     | Firestore writes                                                           | Status                                                                              |
| --- | -------------------------------- | ----------------------------------- | -------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A1  | Create tenant + stash Gemini key | `v1.identity.saveTenant`            | `services/identity/tenant.ts`    | `tenants/{t}`; Secret Manager `tenant-{t}-gemini`, `settings.geminiKeyRef` | 🟡 key path ✅, but **no `tenantCode` index, no owner membership, no trial expiry** |
| A2  | Tenant-code lookup (login/join)  | `v1.identity.lookupTenantByCode`    | shell reads `tenantCodes/{code}` | —                                                                          | 🔴 index never created by A1 → resolves nothing                                     |
| A3  | Feature/quota gates              | on tenant `features`/`subscription` | read in every write              | —                                                                          | 🟢 schema present; enforcement thin in student paths                                |

### Phase B — Onboard STUDENTS (+ teachers, classes)

| #   | Step                                                | Callable (v1)                                   | Service impl                                                    | Writes                                                     | Status                                                                      |
| --- | --------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| B1  | Create class / academic session                     | `v1.identity.saveClass` / `saveAcademicSession` | `save-entities.ts`                                              | `classes/{c}`, `academicSessions/{s}`                      | 🟢                                                                          |
| B2  | Create one org user (auth+entity+membership+claims) | `v1.identity.createOrgUser`                     | `org-users.ts` + `provisionMembership` + `syncMembershipClaims` | `users/{uid}`, role doc, `userMemberships/{uid_t}`, claims | 🟢 full saga                                                                |
| B3  | Save one student (+class assignment)                | `v1.identity.saveStudent`                       | `save-entities.ts`                                              | role doc; membership **only if `authUid` present**         | 🟡 no auth-user creation (expects pre-made `authUid`)                       |
| B4  | **Bulk import students**                            | `v1.identity.bulkImportStudents`                | `org-users.ts:156`                                              | entity docs only                                           | 🔴 **no auth / no membership / no claims** → imported students can't log in |

### Phase C — Create an EXAM

| #   | Step                                       | Callable (v1)                                | Impl                                                           | Writes                                                                 | Status                                                                                      |
| --- | ------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| C1  | Request signed upload URL for paper        | `v1.autograde.requestUploadUrl`              | `services/autograde/request-upload-url.ts` (`buildScopedPath`) | — (returns `{uploadUrl,path,expiresAt}`)                               | 🟡 **exists but unused** — FE builds Storage paths client-side instead                      |
| C2  | Create exam (+`questionPaperImages` paths) | `v1.autograde.saveExam`                      | `services/autograde/save-exam.ts`                              | `exams/{e}` `status:question_paper_uploaded`, `usage.examsThisMonth++` | 🔴 **teacher-web still calls LEGACY `callSaveExam`** → hits `questionPaperImages .url()` P0 |
| C3  | Extract questions + rubric (Gemini)        | `v1.autograde.extractQuestions`              | `services/autograde/extract-questions.ts`                      | `exams/{e}/questions/{qN}` (batch), `status:question_paper_extracted`  | 🔴 **teacher-web calls LEGACY `callExtractQuestions`**                                      |
| C4  | Publish (rubric-sum gated)                 | `v1.autograde.saveExam {status:'published'}` | `save-exam.ts` (`POST_PUBLISH_LOCKED_FIELDS`)                  | `status:published`                                                     | 🟡 v1 path exists; teacher-web publish also via legacy saveExam                             |

### Phase D — Upload ANSWER SHEETS

| #   | Step                              | Callable (v1)                     | Impl                                                                   | Writes                                                       | Status                                                   |
| --- | --------------------------------- | --------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| D1  | Upload sheets → create submission | `v1.autograde.uploadAnswerSheets` | `services/autograde/upload-answer-sheets.ts` (`validatePathsInTenant`) | `submissions/{id}` `pipelineStatus:uploaded`; exam→`grading` | 🔴 **teacher-web calls LEGACY `callUploadAnswerSheets`** |
| D2  | (alt) scanner/GCS bulk            | storage trigger                   | legacy only                                                            | —                                                            | 🟡 alt path; not the primary flow                        |

### Phase E — GRADING pipeline (the state machine)

| #   | Step                                      | Entry (v1)                                               | Impl                                                       | Writes                                                  | Status                                                                                  |
| --- | ----------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| E1  | Submission created → start pipeline       | trigger `onSubmissionCreated`                            | `services/autograde/triggers` → `advancePipeline`          | enqueue `{submissionId, step:'scouting'}`               | 🟢 v1 uses **Cloud Tasks single-writer reducer** (cleaner than legacy trigger-chaining) |
| E2  | Answer→page mapping (Panopticon AI)       | `advancePipeline step:scouting` → `processAnswerMapping` | `pipeline/process-answer-mapping.ts`                       | `questionSubmissions/{q}` `mapping.imageUrls` invariant | 🟢                                                                                      |
| E3  | Per-question scoring vs rubric (RELMS AI) | `advancePipeline step:grading` → `processAnswerGrading`  | `pipeline/process-answer-grading.ts` + `resolve-rubric.ts` | per-Q `evaluation{…}`; DLQ on failure                   | 🟢 (quota/circuit-breaker → `manual_review_needed`)                                     |
| E4  | Finalize / aggregate → letter grade       | `advancePipeline step:finalize` → `finalizeSubmission`   | `pipeline/finalize-submission.ts` (`gradeFor`)             | `summary{totalScore,grade}`, `ready_for_review`         | 🟢                                                                                      |
| E5  | Manual override / retry / AI-regrade      | `v1.autograde.gradeQuestion` (mode manual\|retry\|ai)    | `services/autograde/grade-question.ts`                     | per-Q + recomputed `summary`                            | 🟢 (v1; teacher-web grading lane already on v1)                                         |
| E6  | Stale-submission watchdog                 | scheduler `staleSubmissionWatchdog`                      | `schedulers/stale-submission-watchdog.ts`                  | re-drive / escalate DLQ                                 | 🟡 per-tenant fan-out ✅; legacy `.limit(50)` cap concern noted                         |

### Phase F — FEEDBACK / RESULTS

| #   | Step                                                    | Callable (v1)                                                                                                      | Impl                                                 | Consumer                                                             | Status                                                         |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| F1  | Release results                                         | `v1.autograde.releaseResults`                                                                                      | `services/autograde/release-results.ts`              | teacher-web `useReleaseResults` (v1)                                 | 🟢                                                             |
| F2  | Release notifications (student/parent/teacher)          | trigger `onResultsReleased`                                                                                        | `services/autograde/triggers` → notifications outbox | student-web/parent-web NotificationsPage                             | 🟢                                                             |
| F3  | Teacher: grading review / rubric breakdown              | `getSubmission`, `listQuestionSubmissions`, `getExamAnalytics`, `getGradingReviewBundle`, `getExamGradingOverview` | `services/autograde/reads.ts` + analytics            | teacher-web + mobile-teacher (v1)                                    | 🟡 works but **response validation OFF**                       |
| F4  | **Student: view own released results + per-Q feedback** | `getExam`,`listSubmissions`,`listQuestionSubmissions` (release-gated views)                                        | reads.ts (summary withheld until released)           | student-web `ExamResultPage`, mobile-student `ExamResultsViewScreen` | 🟡 detail works; **no `/results` listing page in student-web** |
| F5  | **Parent: child released results + PDF**                | same reads (`resultsReleasedOnly`) + `generateReport`                                                              | reads.ts + analytics                                 | parent-web `ExamResultsPage`                                         | 🟢                                                             |

### Phase G — RUBRICS & EVALUATION SETTINGS

| #   | Step                                        | Callable (v1)                                                   | Impl                                      | Status                                                  |
| --- | ------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| G1  | Author eval settings / dimensions / presets | `v1.autograde.saveEvaluationSettings`, `listEvaluationSettings` | `save-evaluation-settings.ts`, `reads.ts` | 🟢 v1                                                   |
| G2  | Rubric flows extract → resolve → RELMS      | `extractQuestions` rubric → `resolve-rubric.ts` → RELMS prompt  | pipeline                                  | 🟢 (rubric criteria sum = maxMarks enforced at publish) |
| G3  | Global presets (super-admin)                | `v1.identity.listGlobalEvaluationPresets`                       | shell read                                | 🟡 shell                                                |

**End-to-end verdict:** the **grade pipeline (E) and release/feedback core
(F1–F3, F5) are GREEN on v1.** The journey breaks at **onboarding (A2/B4), exam
authoring writes (C2–C4, D1 still legacy), and student results discovery (F4
listing).** Fix those, converge all writes to v1, retire legacy, turn validation
on, deploy → the whole journey is GREEN.

---

## 2. PRIORITIZED GAP LIST

Tags: `bug` · `missing-impl` · `api-design` · `data-model` · `rules` · `test` ·
`deploy`. P0 = blocks the happy path. P1 = correctness/works-perfectly. P2 =
hardening/polish.

| ID       | P   | Tag              | Gap                                                                                                                                                                                | Where                                                       | Fix summary                                                                                                            |
| -------- | --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **G-01** | P0  | bug + api-design | teacher-web exam **create/extract/upload** call LEGACY `functions/autograde` (via `@levelup/shared-services`), hitting the `questionPaperImages .url()` P0                         | `teacher-web` ExamCreatePage/ExamDetailPage/SubmissionsPage | Cut to existing v1 hooks `useSaveExam`/`useExtractQuestions`/`useUploadAnswerSheets`; delete shared-services callables |
| **G-02** | P0  | missing-impl     | `saveTenantService` doesn't create `tenantCode` index or owner membership                                                                                                          | `services/identity/tenant.ts`                               | Create `tenantCodes/{code}` + owner `tenantAdmin` membership + claims on create                                        |
| **G-03** | P0  | missing-impl     | `bulkImportStudentsService` creates entity docs only — no auth/membership/claims                                                                                                   | `services/identity/org-users.ts:156`                        | Per row: create auth user + `provisionMembership` + claims (reuse createOrgUser saga); keep dry-run + CSV creds        |
| **G-04** | P0  | deploy           | Two autograde backends deployed; clients split                                                                                                                                     | `firebase.json` codebases                                   | Deploy `sdk-v1` as canonical; after G-01 cutover, stop deploying `functions/autograde`                                 |
| **G-05** | P1  | data-model       | Read canonicalization partial → response validation OFF (legacy `order`/enum drift)                                                                                                | both api-clients, `reads.ts`                                | Canonicalize all v1 read views to domain keys/enums; flip `validateResponses:true`                                     |
| **G-06** | P1  | data-model       | 5 enum divergences (exam `completed`, submission `ocr_*`, grade `C+`, upload `rn`, step `ocr`) bite when reading **legacy SUB001 docs** via v1                                     | `packages/domain/enums`, read adapters                      | **Reuse DATA-MODEL-FIX-PLAN U1.1/U1.2** — widen-on-read / narrow-on-write adapters                                     |
| **G-07** | P1  | missing-impl     | student-web has no `/results` **listing** page (route missing, linked + e2e-expected)                                                                                              | `student-web` App.tsx                                       | Add `/results` list page (reuse parent-web pattern, self-scope)                                                        |
| **G-08** | P1  | api-design       | FE constructs Storage upload paths client-side; `requestUploadUrl` unused                                                                                                          | teacher-web upload, `request-upload-url.ts`                 | Route paper + answer-sheet uploads through `v1.autograde.requestUploadUrl` (scoped, signed, server-owned path)         |
| **G-09** | P1  | rules            | Confirm firestore.rules submission/questionSubmission read-gates match v1 release model; student read of own submission relies on callable projection (no rule-level release gate) | `firestore.rules:394-432`                                   | Verify + keep parent gate `resultsReleased==true`; ensure indexes deployed                                             |
| **G-10** | P1  | test             | No live-Gemini smoke test; enum/read-adapter untested against real SUB001 shapes                                                                                                   | services tests                                              | Add read-adapter unit tests + one flagged live-Gemini smoke                                                            |
| **G-11** | P2  | api-design       | `Exam` dual `evaluationSettingsId` (top-level + `gradingConfig.evaluationSettingsId`)                                                                                              | domain `exam.ts`                                            | **DATA-MODEL-FIX-PLAN U1.3** — pick top-level, deprecate nested                                                        |
| **G-12** | P2  | missing-impl     | Identity shells (`getTenant`, `changeMembershipRole`, `saveTenantSettings/Features`, `savePlatformConfig`) thin/stub                                                               | `sdk-v1/src/identity.ts`                                    | Flesh out as onboarding/admin console needs them                                                                       |
| **G-13** | P2  | bug              | Watchdog `.limit(50)`/tenant silent cap                                                                                                                                            | scheduler                                                   | **DATA-MODEL-FIX-PLAN U4.4** — paginate + metric                                                                       |
| **G-14** | P2  | data-model       | `group-options` question type falls through to AI grader                                                                                                                           | `services/levelup/grading.ts`                               | **DATA-MODEL-FIX-PLAN U0.1** (levelup, not autograde — but same build)                                                 |

---

## 3. THE PROPER API-DESIGN SPEC (autograde + onboarding surface)

**This is largely a _ratification_ of the v1 contract that already exists, plus
the deltas to make it clean.** The design principles below are already embodied
in `packages/api-contract/src/callables/*`.

### 3.1 Conventions (canonical, already enforced by the contract core)

- **Names:** `v1.<module>.<op>` dotted contract name → deployed id
  `v1-<module>-<op>` (dashes) via `toDeployedCallableId`. HTTP transport maps
  dots→slashes. One mechanical mapping, unit-tested.
- **Writes (`save*`):** `{ id?: BrandedId, data: Partial<Entity> }` →
  `{ id, created }`. Upsert; status transitions are `data.status` (server
  validates the state machine); assignments are fields. **Exception (correct):**
  `releaseResults` is carved out of `saveExam` as its own idempotent callable.
- **Reads (`list*`/`get*`):** `list*` spreads `PageRequest`
  (`{ cursor?, limit=20 }`) → `{ items, nextCursor }`; `get*` → a **view
  projection** schema (never the raw entity). Cursor pagination throughout.
- **No `tenantId` in ANY request body (D2).** Tenant is claim-derived
  server-side. Structurally asserted by the no-tenant-id-in-request contract
  test. (Legacy tier violates this — a reason to retire it.)
- **Transport envelope:** the canonical `Transport`/`StorageTransport` seam
  lives in `api-contract/src/transport`; api-client injects it; `result.data` is
  unwrapped by the carrier (`invoke-via-callable` returns `result.data`). The
  historical `{data}` double-envelope bug is fixed here.
- **Auth/rate:** every def carries `authMode` + `rateTier` (`read|write|ai`) +
  `idempotent` + `idempotencyKey:'transport'` + `invalidates:[cacheKeys]` +
  `authoritySensitive`. Authority is the single
  `authorize(ctx, action, resource)` decision.
- **Release-gating & ⚷ server-only:** view schemas mark
  answer-key/rubric-guidance/cost telemetry `.optional()` — present only for
  authoring roles, stripped otherwise; `summary`/`evaluation` withheld until
  `resultsReleased`. This is **projection-based authority**, the right model.

### 3.2 Canonical autograde callable surface (16 — ratify as-is)

**Writes (7):** `saveExam` · `extractQuestions` (mode full|single) ·
`uploadAnswerSheets` · `requestUploadUrl` · `gradeQuestion` (mode
manual|retry|ai, non-idempotent) · `releaseResults` · `saveEvaluationSettings` ·
`resolveDeadLetter` (method enum). **Reads (9):** `listExams` (filter) ·
`getExam` · `listQuestions` · `listSubmissions` · `getSubmission` ·
`getSubmissionForExam` · `listQuestionSubmissions` · `getExamAnalytics` ·
`listEvaluationSettings` · `listDeadLetter`. (+ realtime `gradingStatus`,
`examGrading` subscriptions.) **Views:**
`ExamListView`/`ExamDetailView`/`ExamQuestionView`/`SubmissionListView`/`SubmissionDetailView`/
`QuestionSubmissionView`/`EvaluationSettingsView`/`DeadLetterView`/`ExamAnalyticsView`
— all in `autograde/_shared.ts`.

### 3.3 Deltas to make it _clean_ (the only design work, small)

1. **Enums from domain SSOT only (G-06).** Canonical: exam status (no
   `completed` — map on read), submission pipelineStatus (no `ocr_*`), 8 grade
   letters incl `C+` `{letter,min}`, upload source `web|scanner|rn` (drop
   `gcs`), grading step `scouting|grading`. Read-adapter widens legacy →
   canonical.
2. **Error model (ratify + document).** `HttpsError(code)` where code ∈ standard
   set; the api-client `normalizeError` → `ApiError` class. Standardize on:
   `INVALID_ARGUMENT` (schema) · `FAILED_PRECONDITION` (bad state transition,
   e.g. publish w/o rubric) · `PERMISSION_DENIED` (authorize) · `NOT_FOUND` ·
   `RESOURCE_EXHAUSTED` (quota) · `ALREADY_EXISTS` (dup submission). Document
   the transition-error detail shape (current status, requested, allowed) from
   `API_REDESIGN.md §Error`. **No new code — just pin it in the contract doc + a
   test.**
3. **Pagination = cursor everywhere (already true).** Ratify
   `{cursor?,limit}`→`{items,nextCursor}`; forbid offset. One `PageRequest`
   fragment.
4. **Response validation ON (G-05).** The target end state:
   `validateResponses:true` once reads are canonicalized. This is the single
   flag that proves the contract is honored on the wire.
5. **`requestUploadUrl` is the ONLY sanctioned upload path (G-08).** Deprecate
   client-side Storage path construction; server owns the scoped path
   (`buildScopedPath`) → removes the storage-path-mismatch footgun.
6. **Resolve `Exam` dual `evaluationSettingsId` (G-11).** One field.
7. **Retire the legacy tier (G-04).** After clients cut over,
   `functions/autograde` stops deploying;
   `saveExam`/`extractQuestions`/`uploadAnswerSheets`/`gradeQuestion` exist ONLY
   as `v1.autograde.*`.

### 3.4 Onboarding surface (identity — ratify + fill)

Writes: `saveTenant` · `saveClass` · `saveAcademicSession` ·
`saveStudent`/`saveTeacher`/`saveParent`/`saveStaff` · `createOrgUser` ·
`bulkImportStudents`/`bulkImportTeachers` · `joinTenant` · `switchActiveTenant`
· `changeMembershipRole`. Reads: `getTenant` · `listTenants` ·
`lookupTenantByCode` · `listGlobalEvaluationPresets`. **Deltas:** G-02
(tenantCode + owner membership in `saveTenant`), G-03 (bulk import full
provisioning), G-12 (flesh shells). Gemini key: `settings.geminiKeyRef` ↔ Secret
Manager `tenant-{t}-gemini` — **verified: `saveTenant` writes the ref the
autograde LLM layer reads.** ✅

---

## 4. PHASED, FABLE-SIZED TASK BREAKDOWN

Each unit: **surgical, self-contained, independently verifiable.** Ordered so
blockers land first. Cross-references reuse — **do NOT duplicate** —
`DATA-MODEL-FIX-PLAN.md` units (U\*).

### WAVE 1 — Unblock the happy path (P0; land first, in this order)

| Unit                                                  | Scope                                                                                                                                                                                                                       | Files                                                                                                                                              | Accept                                                                                                                         | Deps          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| **AG-1 · Cut teacher-web writes to v1**               | Replace `callSaveExam`/`callExtractQuestions`/`callUploadAnswerSheets` (shared-services) with `useSaveExam`/`useExtractQuestions`/`useUploadAnswerSheets` (@levelup/query). Delete the 3 shared-services callable wrappers. | `apps/teacher-web/src/pages/exams/{ExamCreatePage,ExamDetailPage,SubmissionsPage}.tsx`; `packages/shared-services/src/autograde/exam-callables.ts` | Exam create→extract→publish→upload runs entirely on `v1.autograde.*`; no `functions/autograde` call remains; e2e create passes | —             |
| **AG-2 · Verify v1 saveExam accepts Storage paths**   | Confirm domain `SaveExamData.questionPaperImages: z.array(z.string())` (no `.url()`); pin a test that a `tenants/{t}/…` path is accepted                                                                                    | `services/autograde/save-exam.ts`, `api-contract/.../save-exam.ts`, new test                                                                       | Path-not-URL create passes; regression test guards it                                                                          | AG-1          |
| **IDN-1 · saveTenant: tenantCode + owner membership** | On create: write `tenantCodes/{code}`, create owner `tenantAdmin` membership via `provisionMembership`, mint claims, set trial expiry                                                                                       | `services/identity/tenant.ts`                                                                                                                      | Create tenant → `lookupTenantByCode` resolves; owner can act as admin; unit test                                               | —             |
| **IDN-2 · bulkImportStudents: full provisioning**     | Per row: create/lookup auth user + `provisionMembership` + `syncMembershipClaims`; keep dry-run validation + creds-CSV-to-signed-URL                                                                                        | `services/identity/org-users.ts`                                                                                                                   | Imported student has auth+membership+claims and can log in; dry-run unchanged; unit test                                       | IDN-1         |
| **DEP-1 · Deploy v1 canonical**                       | Deploy `sdk-v1` codebase (+ rules + indexes). Smoke each `v1.autograde.*`/`v1.identity.*` reaches its function (dashed id). Keep legacy deployed until AG-1 lands in prod                                                   | `firebase.json`, deploy                                                                                                                            | All v1 callables return (not 404); dotted→dashed verified live                                                                 | AG-1, IDN-1/2 |

### WAVE 2 — Works _perfectly_ (P1)

| Unit                                                         | Scope                                                                                                                             | Files                                                        | Accept                                                                        | Deps       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------- |
| **DM-1 · Enum read-adapters** = **DATA-MODEL-FIX-PLAN U1.1** | widen-on-read/narrow-on-write for exam `completed`, submission `ocr_*`, step `ocr`, upload `gcs→scanner`, story `test→timed_test` | `domain/enums`, adapter in `repositories`/`functions-shared` | Legacy SUB001 docs parse via v1 reads; new writes canonical; per-enum tests   | Wave 1     |
| **DM-2 · Grade-letter unify** = **U1.2**                     | 8-letter `{letter,min}` incl `C+`                                                                                                 | `domain/enums/grading.ts`, readers                           | `C+` round-trips; boundary matches `gradeFor`/`calculateGrade`                | DM-1       |
| **AG-3 · Read canonicalization + validation ON**             | Canonicalize all v1 read views to domain keys; flip `validateResponses:true` in teacher-web + mobile-teacher (and student/parent) | `services/autograde/reads.ts`, app `sdk/api.ts`              | Every autograde read validates clean; apps run with validation ON             | DM-1, DM-2 |
| **AG-4 · requestUploadUrl adoption**                         | Route paper + answer-sheet uploads through `v1.autograde.requestUploadUrl`; drop client-side path construction                    | teacher-web upload code                                      | Uploads use server-scoped signed paths; storage-path footgun gone             | AG-1       |
| **STU-1 · Student results listing**                          | Add `student-web` `/results` list page (self-scoped, reuse parent-web pattern); wire notification deep-link                       | `apps/student-web/src/App.tsx`, new page                     | Student browses their released exams; e2e `student-web.spec.ts:1695` passes   | AG-3       |
| **RUL-1 · Rules + index audit**                              | Verify submission/questionSubmission read-gates match v1 release model; confirm all autograde composite indexes deployed          | `firestore.rules`, `firestore.indexes.json`                  | Student reads own, parent gated on `resultsReleased`; no missing-index errors | Wave 1     |
| **IDN-3 · Exam dual eval-settings** = **U1.3**               | One `evaluationSettingsId`; deprecate nested                                                                                      | `domain/exam.ts`, readers                                    | compiles; grading resolves the single field                                   | DM-1       |

### WAVE 3 — Deploy the product the user asked for (P0 for the user, after Wave 1–2 correctness)

| Unit                                       | Scope                                                                                                                                                                                                     | Accept                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **SHIP-1 · Websites deployed**             | Deploy `teacher-web` (+ admin/super-admin as needed) and `student-web`/`parent-web` to Firebase Hosting on `lvlup-ff6fa`; wire hosting → `sdk-v1` region `asia-south1`                                    | Live URLs load; login works; autograde create→grade→release→view works against deployed v1 |
| **SHIP-2 · Mobile apps published (debug)** | Build+push `mobile-teacher` (grading/release) and `mobile-student` (results view) **debug** APKs to Firebase App Distribution (per `mobile-student-app-distribution` memory: version bump, testers group) | Debug builds installable; teacher grades+releases, student views results end-to-end        |

### WAVE 3b — "How to use the product" (in-website role guides) — user-requested

The website must **explain how to use autograde** to every role, and the app
must just work. Each guide is a real in-app page (not a PDF), role-gated,
reachable from a persistent Help/? entry in the nav.

| Unit                                | Scope                                                                                                                                                                   | Files                                                                          | Accept                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **HELP-1 · Admin guide**            | How to: onboard the school (tenant + Gemini key), bulk-import/create students & teachers, create classes/sessions, manage features/quota                                | new `apps/admin-web` (+ super-admin) Help route + content                      | Admin can follow the guide start→finish and complete onboarding         |
| **HELP-2 · Teacher guide**          | How to: create an exam, upload the question paper, extract & edit questions/rubric, publish, upload answer sheets, watch grading, review/override, release results      | new `apps/teacher-web` Help route + content, contextual tips on the exam pages | Teacher runs create→grade→release by following it                       |
| **HELP-3 · Student guide**          | How to: find a published exam, understand the sealed-until-released state, open released results, read per-question feedback & rubric breakdown, act on recommendations | new `apps/student-web` Help route + content                                    | Student locates + interprets their released results                     |
| **HELP-4 · Parent guide**           | How to: see linked children, view released child results, download the PDF report                                                                                       | new `apps/parent-web` Help route + content                                     | Parent views a child's released results                                 |
| **HELP-5 · Landing "How it works"** | Public marketing/landing section on the website summarizing the autograde flow for all roles (the "the website will say how to use it" ask)                             | website landing page                                                           | A logged-out visitor understands what the product does + the role flows |

**Content source of truth:** the E2E sequence map in §1
(onboard→exam→upload→grade→feedback) IS the script for these guides — write each
role's guide from the steps that role performs.

### WAVE 4 — Hardening / deferred (P2)

`WD-1` watchdog pagination (**U4.4**) · `QT-1` group-options grading (**U0.1**,
levelup) · `IDN-4` flesh identity shells (**G-12**) · `SEC-1` deny-all
server-only paths (**U2.5**) · `SEED-1` migrate SUB001 to canonical
(**U4.2/real-subhang-migration**) · `TEST-1` live-Gemini smoke (**G-10**).

**Token discipline for Fable:** each unit above is one Fable task. AG-1, IDN-1,
IDN-2 are the three that most directly turn the journey GREEN — sequence them
first. DM-1/DM-2/AG-3 are coupled (validation ON depends on canonicalization) —
do them as a mini-chain. Everything else is independently shippable.

---

## 5. END-TO-END VERIFICATION / TEST PLAN (so "done" is provable)

**Target env:** Firebase **emulator** first (fast, deterministic), then the
**real SUB001 tenant** (`lvlup-ff6fa` `tenants/tenant_subhang`, code SUB001) for
the deployed smoke.

### 5.1 The single canonical happy-path e2e (emulator, mocked Gemini)

Extend the existing green
`functions/autograde/src/__tests__/e2e-pipeline.test.ts` shape onto the **v1
services** stack (it already drives stages 1→8). Assert the full chain on
`v1.*`:

1. `saveTenant` → `tenantCodes/{code}` exists; owner membership + claims minted.
   _(IDN-1)_
2. `bulkImportStudents` (2 rows) → each has auth+membership+claims; can resolve
   login. _(IDN-2)_
3. `saveClass` + assign students.
4. `requestUploadUrl` → `saveExam` (Storage **paths**, not URLs) →
   `status:question_paper_uploaded`. _(AG-1/AG-2/AG-4)_
5. `extractQuestions` → 2 questions, rubric criteria sum = maxMarks.
6. `saveExam {published}` (rubric-gated).
7. `uploadAnswerSheets` → submission `uploaded`; exam→`grading`.
8. Pipeline: `advancePipeline` scouting→grading→finalize → `mapping.imageUrls`
   invariant, per-Q `evaluation`, `summary{totalScore,grade}`,
   `ready_for_review`.
9. `gradeQuestion` manual override recomputes summary.
10. `releaseResults` → `resultsReleased:true`, exam `results_released`,
    notifications fan out.
11. **Release gate:** `getSubmission` as student **before** release → summary
    withheld; **after** → full; `listQuestionSubmissions` returns `evaluation`;
    parent sees only after release.
12. **Validation ON:** run the whole thing with `validateResponses:true` — every
    read view validates. _(AG-3)_

### 5.2 Legacy-data adapter test (SUB001 realism)

Seed docs with legacy enum values (`status:'completed'`, `ocr_*`, `grade:'C+'`,
`uploadSource:'gcs'`) → assert v1 reads parse them via the widen-on-read adapter
(DM-1/DM-2).

### 5.3 Deployed smoke (real, post-SHIP-1)

Against deployed `sdk-v1`: log in as `student.test@subhang.academy` (see
TEST_CREDENTIALS), a teacher, and a parent. Manually run
create→extract→publish→upload→grade→release on a throwaway exam in SUB001;
confirm each role's UI shows the right release-gated data. Verify no 404
(dotted→dashed live), no missing-index errors, no `Invalid URL` on create.

### 5.4 App smoke (post-SHIP-2)

mobile-teacher debug: grade + release. mobile-student debug: open notification →
view released result + per-question feedback. Both against deployed v1.

**Definition of DONE:** §5.1 green with validation ON, §5.2 green, §5.3 all
three roles pass on the deployed site, §5.4 both debug apps pass — and only the
`sdk-v1` codebase is serving autograde.

---

## 6. KEY FILE MAP (for the executing Fable tasks)

| Concern                                        | Path                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| v1 wiring (callables/triggers/scheduler/tasks) | `functions/sdk-v1/src/{autograde,identity}.ts`                                                                               |
| v1 services (business logic)                   | `packages/services/src/{autograde,identity}/**`                                                                              |
| Contract (defs + view schemas)                 | `packages/api-contract/src/callables/{autograde,identity}/**`                                                                |
| Transport dotted→dashed seam                   | `packages/transport-firebase/src/invoke/invoke-via-callable.ts`                                                              |
| Client hooks (v1)                              | `packages/query/src/autograde/{hooks,realtime}.ts`                                                                           |
| Repos (call api.autograde.\*)                  | `packages/repositories/src/autograde/**`                                                                                     |
| Domain enums (SSOT for G-06)                   | `packages/domain/src/enums/{exam,submission,grading,misc}.ts`                                                                |
| Rules / indexes                                | `firestore.rules`, `firestore.indexes.json`                                                                                  |
| Legacy tier (to retire)                        | `functions/autograde/src/**`, `packages/shared-services/src/autograde/exam-callables.ts`                                     |
| Deploy config                                  | `firebase.json` (codebases `sdk-v1` canonical, `autograde` legacy)                                                           |
| Gemini secret                                  | write `services/identity/tenant.ts` (`geminiKeyRef`) ↔ read `functions/autograde/src/utils/llm.ts:145` (`tenant-{t}-gemini`) |

---

## 7. HOW THIS RELATES TO THE OTHER PLANS (no duplication)

- **DATA-MODEL-FIX-PLAN.md** owns the enum/timestamp/rules foundation. This plan
  **reuses** its U0.1, U1.1, U1.2, U1.3, U2.5, U4.2, U4.4 by reference (mapped
  into Waves 2/4 above) and adds the **end-to-end + convergence + deploy** layer
  it didn't cover.
- **AUTOGRADE_ANALYSIS.md / CONTRACT_REPORT.md** are authoritative on the
  **legacy** pipeline shapes and the `questionPaperImages` P0. This plan's new
  finding is that the **v1 tier already supersedes the legacy design** and the
  P0 only bites because teacher-web writes still route to legacy (G-01).
- **CORE-B2B-DOMAIN-BRIEF.md** owns identity authz; this plan consumes it for
  the onboarding gaps (G-02/G-03) and the claim-builder convergence caveat
  (RR-T2-A) that touches provisioning.
- **API_REDESIGN.md** is the design north star; the v1 contract **already
  implements** its save\*/status-transition/upsert principles — this plan
  ratifies that and lists the small remaining deltas (§3.3).

---

## 8. THE 5 THINGS, RESTATED (if you read nothing else)

1. **Converge writes to v1** (G-01/AG-1) — teacher-web create/extract/upload →
   `v1.autograde.*`. **This unblocks exam creation.**
2. **Finish onboarding** (G-02/G-03) — tenantCode + owner membership +
   bulk-import provisioning.
3. **Canonicalize reads + validation ON** (G-05/G-06/AG-3) — kill the
   load-bearing `validateResponses:false`.
4. **Student results discovery** (G-07/STU-1) — the `/results` listing page.
5. **Deploy v1 canonical + retire legacy** (G-04/DEP-1) — one backend; then ship
   sites + debug apps.

---

## 9. MAPPING TO THE USER'S EXPLICIT ASKS (2026-07-04)

| User ask                                       | Covered by                                          | Notes                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **1. The website**                             | SHIP-1 (Wave 3)                                     | Deploy teacher-web + student-web/parent-web (+admin) to Hosting on `lvlup-ff6fa`, wired to deployed `sdk-v1` |
| **2. Admin / teacher autograde features**      | AG-1, AG-2, AG-4, DEP-1, RUL-1 + onboarding IDN-1/2 | Create→extract→publish→upload→grade→release all on v1; admin onboards school + students                      |
| **3. Student autograde features**              | STU-1, AG-3, F4 release-gated reads, SHIP-2         | Student views released results + per-Q feedback; listing page added; mobile-student debug                    |
| **Websites deployed**                          | SHIP-1                                              | Firebase Hosting                                                                                             |
| **Apps published as debug**                    | SHIP-2                                              | Firebase App Distribution debug APKs (mobile-teacher, mobile-student)                                        |
| **Website explains how to use it (all roles)** | HELP-1..5 (Wave 3b)                                 | In-website role guides (admin/teacher/student/parent) + public "How it works" landing section                |

> **User directive (2026-07-04):** "Fix the autograde app end-to-end as a
> product; the website says how to use it and the app works." → Execution =
> Waves 1→3 (make it work + deploy + debug apps) **plus** Wave 3b (the
> how-to-use guides). The product is DONE when a new school can be onboarded, a
> teacher can run an exam through grading + release, a student/parent can view
> results, and every role has a guide.

> This is a **scoping deliverable** — it does not itself build or deploy.
> Execution = the Fable tasks in §4 (Waves 1→3 land the user's three asks;
> sequence AG-1 → IDN-1 → IDN-2 → DEP-1 → SHIP first).

```

```
