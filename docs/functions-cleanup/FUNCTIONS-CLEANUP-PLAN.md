# FUNCTIONS-CLEANUP-PLAN — Executable Cleanup Plan for lvlup-ff6fa

**Date:** 2026-07-13 · **Branch:** `staging` · **Project:** `lvlup-ff6fa`
(asia-south1) · **Author:** FNCLEAN-4 (Fable) **Inputs:**
`01-deployed-source-map.md` (FNCLEAN-1), `02-client-usage-map.md` (FNCLEAN-2),
`03-architecture-and-triggers.md` (FNCLEAN-3). Key claims re-verified against
source 2026-07-13 (firebase.json codebases, auth-store.ts:206/266,
request-upload-url.ts:87 collision, SpaceListPage.tsx:98, ItemEditor.tsx:470).

---

## 0. Executive summary

244 functions are deployed today: **165 `v1-*`** (canonical sdk-v1 backend — all
KEEP) and **79 unprefixed legacy** (all eventually deleted). Of the 79, only **6
callables are load-bearing for live frontends**, and every one has a deployed v1
equivalent — 6 rewire seams (5 files + shared-stores auth-store) unblock the
entire legacy callable surface. Two hazards must move **first**: the legacy
Storage triggers fire on every v1 upload (shared Storage namespace — phantom
legacy submissions + AI spend), and two legacy schedulers still **mutate the
real unprefixed tenant docs** (SUB001/CHAITANY source-of-truth) on a
daily/monthly schedule.

Two live runtime breaks get fixed in the same prerequisite wave:
`v1-levelup-duplicateSpace` is invoked but not deployed (NOT_FOUND on
teacher-web Duplicate Space), and ItemEditor calls unprefixed `getItemForEdit`,
which has never been deployed.

| Verdict                                        | Count   |
| ---------------------------------------------- | ------- |
| KEEP (v1 surface)                              | 165     |
| DELETE-NOW (no prerequisite beyond wave order) | 66      |
| DELETE-AFTER-REWIRE (live client seams)        | 6       |
| KEEP-UNTIL-MIGRATED (legacy-data load-bearing) | 7       |
| **Total**                                      | **244** |

**End state:** one codebase (`sdk-v1`), **167 functions** (165 current +
`v1-levelup-duplicateSpace` + `v1-autograde-saveExamQuestion`), plus up to 3
optional ports (auth-trigger pair, chat-inactivity sweep). Timeline gates: Waves
0–2 are executable now; Wave 3 gates on SUB001/CHAITANY data migration (or
freeze); Wave 4 gates on porting auth-trigger handling into sdk-v1.

---

## 1. Verdict table — all 244 deployed functions

Verdicts: **KEEP** · **DELETE-NOW** (wave-ordered, no client rewire needed) ·
**DELETE-AFTER-REWIRE** (client seam must move to v1 first) ·
**KEEP-UNTIL-MIGRATED** (operates on real unprefixed data; delete after
migration/freeze).

### 1.1 KEEP — 165 `v1-*` functions (all of them)

All 165 map 1:1 to `functions/sdk-v1` source (doc 01 §Key-findings-1, zero
drift); the 140 callables are 140/140 contract-pinned (doc 02 §3), and the 25
non-callables are the intended end-state runtime (doc 03 §B3). Grouped rather
than row-per-function; the row-level source map is doc 01 rows #78–#242.

| Module       | Count | Functions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Reason                                             |
| ------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| v1-identity  | 68    | 60 callables (`v1-identity-{bulkApplyTenantFeatures, bulkImportStudents, bulkImportTeachers, bulkUpdateStatus, changeMembershipRole, createOrgUser, deactivateTenant, deleteConsumerAccount, endImpersonation, estimateAudience, exportTenantData, getClass, getMe, getNotificationBadge, getNotificationPreferences, getPlatformConfig, getStudent, getTeacher, getTenant, joinTenant, listAcademicSessions, listAnnouncements, listClasses, listExportJobs, listGlobalEvaluationPresets, listNotifications, listParents, listStaff, listStudents, listTeachers, listTenants, lookupTenantByCode, markAnnouncementRead, markNotificationRead, reactivateTenant, registerDeviceToken, rolloverSession, saveAcademicSession, saveAnnouncement, saveClass, saveGlobalEvaluationPreset, saveNotificationPreferences, saveParent, savePlatformConfig, saveStaff, saveStudent, saveTeacher, saveTenant, saveTenantFeatures, saveTenantSettings, searchUsers, sendDirectMessage, sendPasswordReset, setUserStatus, startImpersonation, switchActiveTenant, unregisterDeviceToken, updateMyProfile, uploadTenantAsset, uploadUserAsset}`) + 5 triggers (`onMembershipWritten, onStudentArchived, onClassArchived, onTenantDeactivated, onAnnouncementPublished`) + 3 scheduled (`tenantLifecycleCheck, monthlyUsageReset, cleanupExpiredExports`) | Canonical v1 surface (doc 01 #124–#191, doc 03 B3) |
| v1-levelup   | 51    | 49 callables (`v1-levelup-{assignContent, dismissInsight, evaluateAnswer, generateContent, getChatSession, getGamificationSummary, getItemForEdit, getLeaderboard, getSpace, getSpaceProgress, getStoreSpace, getStoryPoint, getStoryPointProgress, getStudentLevel, getTestSession, importFromBank, listAchievements, listAgents, listChatSessions, listItems, listLearningInsights, listQuestionBank, listRubricPresets, listSpaceProgressForUser, listSpaceReviews, listSpaces, listStoreSpaces, listStoryPoints, listStudentAchievements, listStudyGoals, listStudySessions, listTestSessions, listVersions, markAchievementsSeen, purchaseSpace, recordItemAttempt, saveAchievementDefinition, saveAgent, saveItem, saveQuestionBankItem, saveRubricPreset, saveSpace, saveSpaceReview, saveStoryPoint, saveStudyGoal, saveTestAnswer, sendChatMessage, startTestSession, submitTestSession}`) + 2 scheduled (`expireTestSessions, cleanupStaleSessions`)                                                                                                                                                                                                                                                                                                                                                                             | Canonical v1 surface (doc 01 #192–#242)            |
| v1-autograde | 26    | 18 callables (`v1-autograde-{extractQuestions, getExam, getExamAnalytics, getSubmission, getSubmissionForExam, gradeQuestion, listDeadLetter, listEvaluationSettings, listExams, listQuestionSubmissions, listQuestions, listSubmissions, releaseResults, requestUploadUrl, resolveDeadLetter, saveEvaluationSettings, saveExam, uploadAnswerSheets}`) + 6 triggers (`onSubmissionCreated, onSubmissionUpdated, onQuestionSubmissionUpdated, onExamPublished, onResultsReleased, onExamDeleted`) + 1 taskQueue (`advancePipeline`) + 1 scheduled (`staleSubmissionWatchdog`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Canonical v1 surface (doc 01 #98–#123)             |
| v1-analytics | 20    | 13 callables (`v1-analytics-{dismissInsight, generateReport, getAssignmentMatrix, getChildSummary, getCostSummary, getExamAnalytics, getLeaderboard, getPerformanceTrends, getSummary, listInsights, listLinkedChildren, listParentAlerts, listPlatformActivity}`) + 3 triggers (`onExamResultsReleased, onSpaceProgressUpdated, onSubmissionGraded`) + 1 taskQueue (`recomputeStudentRollup`) + 3 scheduled (`dailyCostAggregation, generateInsights, nightlyAtRiskDetection`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Canonical v1 surface (doc 01 #78–#97)              |

**Plus 2 to be ADDED in Wave 0** (contract-declared, source-defined, not yet
deployed — doc 01 §Defined-but-not-deployed, doc 02 §1):
`v1-levelup-duplicateSpace` (live caller broken today),
`v1-autograde-saveExamQuestion` (hook wired, no caller yet).

### 1.2 DELETE-AFTER-REWIRE — 6 legacy callables (live client seams)

Each has a deployed v1 twin. Delete in Wave 2, after Wave 0 rewires ship and
hosting is redeployed.

| Function               | Live seam (doc 02 §5.1)                                                                                                                                                                         | v1 replacement (deployed)         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `switchActiveTenant`   | `packages/shared-stores/src/auth-store.ts:206,266` via `shared-services` `callSwitchActiveTenant` — **fires on every school-code login + tenant switch** (parent-web, student-web, super-admin) | `v1-identity-switchActiveTenant`  |
| `generateReport`       | `shared-services/src/reports/pdf-callables.ts:31` → parent-web `ChildProgressPage.tsx:108`, `ExamResultsPage.tsx:363`; teacher-web `ExamDetailPage.tsx:626`                                     | `v1-analytics-generateReport`     |
| `getSummary`           | `pdf-callables.ts:38` → super-admin `reads-platform.ts:248` (scope:'health'; known 403 P2)                                                                                                      | `v1-analytics-getSummary`         |
| `saveTenant`           | super-admin `reads-platform.ts:185` — intentionally-failing health probe only (real saves already on SDK `useSaveTenant`)                                                                       | v1-based probe (see §2.4)         |
| `uploadTenantAsset`    | `auth-callables.ts:330` → teacher-web `SpaceSettingsPanel.tsx:223`, admin-web `LogoUploader.tsx:46`, student-web `ProfilePage.tsx:140`                                                          | `v1-identity-uploadTenantAsset`   |
| `saveQuestionBankItem` | `content-callables.ts:130` → teacher-web `QuestionBankEditor.tsx:379`                                                                                                                           | `v1-levelup-saveQuestionBankItem` |

### 1.3 KEEP-UNTIL-MIGRATED — 7 legacy functions (real-unprefixed-data load-bearing)

The real production data (SUB001 `tenants/tenant_subhang` 12 spaces/3,569
items + CHAITANY) still lives unprefixed. These preserve its integrity (doc 03
§B2, §B4).

| Function              | Codebase  | Why it stays (doc 03)                                                                                          | Delete in                       |
| --------------------- | --------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `onUserCreated`       | identity  | Gen-1 Auth trigger; **only signup-time `/users/{uid}` profile writer — sdk-v1 has NO auth-trigger equivalent** | Wave 4 (after port)             |
| `onUserDeleted`       | identity  | Same; soft-deletes `/users`, deactivates `userMemberships`                                                     | Wave 4 (after port)             |
| `onClassArchived`     | identity  | Referential integrity for real unprefixed rosters (strips classIds)                                            | Wave 3                          |
| `onStudentArchived`   | identity  | Same for students↔parents/classes                                                                              | Wave 3                          |
| `onTenantDeactivated` | identity  | Suspends real `userMemberships` on real tenant status flips                                                    | Wave 3                          |
| `onExamDeleted`       | autograde | Cascade delete for real unprefixed exams (questions/submissions/analytics)                                     | Wave 3 (cascade decision, §5.2) |
| `onSpaceDeleted`      | levelup   | Cascade delete for the real 12 SUB001 spaces (deep subcollections + RTDB)                                      | Wave 3 (cascade decision, §5.2) |

### 1.4 DELETE-NOW — 66 legacy functions

**(a) Wave-1 hazards — 6** (doc 03 §B1, §B4-ordering-1):

| Function                | Reason                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onAnswerSheetUpload`   | Storage trigger matches v1 upload paths exactly (`request-upload-url.ts:87`) — fires on every v1 upload; phantom unprefixed submissions can wake the legacy 4GiB AI pipeline (doc 03 B1) |
| `onQuestionPaperUpload` | Same collision on question-paper paths (doc 03 B1)                                                                                                                                       |
| `onClassDeleted`        | Orphan https stub, no source anywhere in repo (doc 01 finding 3)                                                                                                                         |
| `onStudentDeleted`      | Orphan https stub, no source (doc 01 finding 3)                                                                                                                                          |
| `tenantLifecycleCheck`  | Still mutates REAL unprefixed tenant docs daily (status flips on unmigrated source-of-truth); superseded by `v1-identity-tenantLifecycleCheck` (doc 03 B2)                               |
| `monthlyUsageReset`     | Writes monthly to real unprefixed tenant docs; superseded by `v1-identity-monthlyUsageReset` (doc 03 B2)                                                                                 |

**(b) Wave-2 legacy callables, zero live callers — 39** (doc 02 §5.2
dead-wrapper-only 38 + §5.3 `extractQuestions`; every one superseded by a
deployed `v1-*` callable per doc 01):

`bulkImportStudents, bulkImportTeachers, bulkUpdateStatus, createOrgUser, deactivateTenant, evaluateAnswer, exportTenantData, extractQuestions, gradeQuestion, importFromBank, joinTenant, listAnnouncements, listQuestionBank, listStoreSpaces, listVersions, manageNotifications, purchaseSpace, reactivateTenant, recordItemAttempt, rolloverSession, saveAcademicSession, saveAnnouncement, saveClass, saveExam, saveGlobalEvaluationPreset, saveItem, saveParent, saveRubricPreset, saveSpace, saveSpaceReview, saveStaff, saveStoryPoint, saveStudent, saveTeacher, searchUsers, sendChatMessage, startTestSession, submitTestSession, uploadAnswerSheets`

— reason per function: referenced only by dead wrapper modules no live app
imports (doc 02 §5.2 has the wrapper file:line for each), or unreferenced
entirely (`extractQuestions`, doc 02 §5.3). `manageNotifications` additionally
resolves the dual-codebase export conflict by deletion (§2.5).

**(c) Wave-2 superseded/safe non-callables — 21** (doc 03 §B2):

| Function                        | Reason                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `cleanupExpiredExports`         | Superseded by `v1-identity-cleanupExpiredExports` — ⚠ gate: verify v1 twin deletes Storage `exports/` objects first                      |
| `cleanupStaleSessions`          | Superseded by `v1-levelup-cleanupStaleSessions`                                                                                          |
| `dailyCostAggregation`          | Superseded; unprefixed `llmCallLogs` no longer grow                                                                                      |
| `generateInsights`              | Superseded by `v1-analytics-generateInsights`                                                                                            |
| `nightlyAtRiskDetection`        | Superseded by `v1-analytics-nightlyAtRiskDetection`                                                                                      |
| `onTestSessionExpired`          | Superseded by `v1-levelup-expireTestSessions` — gate: confirm zero unprefixed in_progress `digitalTestSessions` (or run one final sweep) |
| `staleSubmissionWatchdog`       | Superseded by `v1-autograde-staleSubmissionWatchdog`                                                                                     |
| `cleanupInactiveChats`          | SAFE-TO-DELETE; legacy chat data static — ⚠ no v1 twin exists; port decision in §5.4                                                     |
| `onExamPublished`               | Superseded by `v1-autograde-onExamPublished`; no new unprefixed publishes once legacy callables gone                                     |
| `onExamResultsReleased`         | Superseded by `v1-analytics-onExamResultsReleased`                                                                                       |
| `onProgressMilestone`           | SAFE-TO-DELETE — notification-only, downstream of legacy rollup chain only                                                               |
| `onQuestionSubmissionUpdatedV2` | Superseded by `v1-autograde-onQuestionSubmissionUpdated` (dead once B1 storage triggers + legacy callables are gone)                     |
| `onResultsReleased`             | Superseded by `v1-autograde-onResultsReleased`                                                                                           |
| `onSpaceProgressUpdated`        | Superseded by `v1-analytics-onSpaceProgressUpdated`                                                                                      |
| `onSpacePublished`              | Superseded — v1 emits publish notifications at service level (outbox)                                                                    |
| `onStudentSummaryUpdated`       | Superseded — collapsed into v1 `student-rollup` taskQueue                                                                                |
| `onSubmissionCreated`           | Superseded by `v1-autograde-onSubmissionCreated` + Cloud Tasks pipeline; event sources removed in Waves 1–2                              |
| `onSubmissionUpdated`           | Superseded — v1 `grading-pipeline` taskQueue reducer replaces trigger-chained stages                                                     |
| `onSubmissionGraded`            | Superseded by `v1-analytics-onSubmissionGraded`                                                                                          |
| `onUserStoryPointProgressWrite` | Superseded — v1 RTDB projections cover leaderboards; apps read v1 roots                                                                  |
| `updateLeaderboard`             | Superseded — same                                                                                                                        |

Reconciliation: 165 KEEP + 6 DELETE-AFTER-REWIRE + 7 KEEP-UNTIL-MIGRATED +
(6+39+21) DELETE-NOW = **244 ✔**

---

## 2. Wave 0 — Prerequisite code fixes (BEFORE any deletion)

All client-side. No function deletion until every item here ships and the gate
passes.

### 2.1 Rewire the 6 live legacy seams to v1

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Files |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | `switchActiveTenant` → contract `v1.identity.switchActiveTenant`. Rewire at the wrapper (`packages/shared-services/src/auth/auth-callables.ts` `callSwitchActiveTenant`) so both auth-store call sites (`packages/shared-stores/src/auth-store.ts:206,266`) move at once. **Highest-risk seam — fires on every school-code login**; verify claims refresh (`getIdToken(true)`) still picks up re-minted claims. Precedent: teacher-web already dropped shared-stores entirely (web-SDK-migration) — that is the better end-state for the remaining apps, but the wrapper rewire is the minimal safe move for this cleanup. |
| 2   | `generateReport` → `v1.analytics.generateReport` in `shared-services/src/reports/pdf-callables.ts:31` (callers: parent-web `ChildProgressPage.tsx:108`, `ExamResultsPage.tsx:363`; teacher-web `ExamDetailPage.tsx:626`)                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3   | `getSummary` → `v1.analytics.getSummary` in `pdf-callables.ts:38` (caller: super-admin `reads-platform.ts:248`). Must resolve the known **getSummary-403 P2** as part of this — verify the v1 callable authorizes the super-admin `scope:'health'` read; if not, fix authz in `packages/services` first.                                                                                                                                                                                                                                                                                                                   |
| 4   | Replace super-admin functions-health probe (`reads-platform.ts:185`, intentionally-failing `saveTenant` call) with a v1-based probe — recommended: invalid-args call to `v1-identity-saveTenant`; the strict contract schema rejects with INVALID_ARGUMENT, preserving the "error = operational" semantic.                                                                                                                                                                                                                                                                                                                 |
| 5   | `uploadTenantAsset` → `v1.identity.uploadTenantAsset` in `auth-callables.ts:330` (callers: teacher-web `SpaceSettingsPanel.tsx:223`, admin-web `LogoUploader.tsx:46`, student-web `ProfilePage.tsx:140`). Note admin-web LogoUploader asset-upload gap flagged in web-admin migration — confirm payload shape against the strict contract schema.                                                                                                                                                                                                                                                                          |
| 6   | `saveQuestionBankItem` → `v1.levelup.saveQuestionBankItem` in `content-callables.ts:130` (caller: teacher-web `QuestionBankEditor.tsx:379`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### 2.2 Fix the 2 live runtime breaks

- **Deploy `v1-levelup-duplicateSpace` + `v1-autograde-saveExamQuestion`** (both
  contract-declared + source-defined at `functions/sdk-v1/src/levelup.ts:125` /
  `autograde.ts:59`):
  `firebase deploy --only functions:sdk-v1 --project lvlup-ff6fa` with pinned
  CLI (§3.0). This heals teacher-web Duplicate Space (`SpaceListPage.tsx:98` →
  NOT_FOUND today).
- **Rewire ItemEditor**
  `apps/teacher-web/src/components/spaces/ItemEditor.tsx:470` off
  `callGetItemForEdit` (unprefixed `getItemForEdit` — never deployed) → contract
  `v1.levelup.getItemForEdit` (deployed) via the SDK hook (`@levelup/query`),
  matching the `useDuplicateSpace` deep-copy pattern already in teacher-web.

### 2.3 Trim the dead bypass layer (anti-resurrection)

In the same change set: delete/trim
`packages/shared-services/src/**/*-callables.ts` unused exports (26-wrapper
auth-callables + assessment/chat/store/content callables) and the dead
`packages/shared-hooks/src/queries/*` callable hooks (doc 02 §4.2). Keep
`useTenantBranding` (only live shared-hooks import). This prevents a future
import from silently resurrecting a legacy dependency after the functions are
gone.

### 2.4 Deploy clients

Rebuild + redeploy the affected hosting targets (parent-web, student-web,
super-admin, teacher-web, admin-web). Per APP-1: hosting flips AFTER the sdk-v1
redeploy of §2.2.

### 2.5 Resolve `manageNotifications` ownership — by deletion

Doc 01 finding 4: exported by BOTH `functions/identity` and `functions/levelup`.
Doc 02 §5.2: dead — wrapper `auth-callables.ts:160`, zero live imports.
**Decision: no owner needed; delete the deployed function in Wave 2 via
`functions:delete` (codebase-agnostic) and remove the export from BOTH legacy
`index.ts` files in the same commit.** Gate: confirm zero invocations in the
last 30 days before deleting (§3, standard gate).

### Wave 0 verification gate

1. `grep -rn "callSwitchActiveTenant\|callGenerateReport\|callGetPlatformSummary\|callSaveTenant\|callUploadTenantAsset\|callSaveQuestionBankItem\|callGetItemForEdit" apps/ packages/ --include='*.ts*' | grep -v old-deprecated`
   → only v1-backed implementations remain (or zero hits after trim).
2. `firebase functions:list --project lvlup-ff6fa` shows 246 functions incl.
   `v1-levelup-duplicateSpace`, `v1-autograde-saveExamQuestion`;
   contract↔deployed parity 142/142 (`node -e "…CALLABLE_NAMES…"` diff, doc 02
   §3).
3. Smoke (deployed apps): school-code login on student-web + parent-web +
   super-admin (switchActiveTenant seam); duplicate a space in teacher-web; open
   timed-test item in ItemEditor; generate a PDF report (parent-web); upload a
   logo (admin-web); save a question-bank item (teacher-web); super-admin health
   panel renders (both probes).
4. Cloud Logging: zero invocations of the 6 legacy names by the new clients (old
   cached bundles may still call for a TTL window — see Wave 2 gate).

**Rollback:** pure client/deploy changes — revert commits + redeploy hosting;
redeploying sdk-v1 with 2 extra functions is additive and needs no rollback.

---

## 3. Deletion waves

### 3.0 Standing rules (apply to every wave)

- **Pinned CLI only:** `npx firebase-tools@13.35.1` (DEP-1). Deploys of legacy
  codebases have the `package.json.bak` manual-restore gotcha (postdeploy
  `prepare-functions-deploy.ts cleanup` — verify the workspace rewrite was
  restored after any deploy).
- **Delete via `functions:delete`, not via codebase deploy.** Codebase-scoped
  deploys only manage their own codebase's functions; explicit delete is
  codebase-agnostic and avoids ownership fights (incl. the `manageNotifications`
  conflict).
- **Same-commit source trim.** After each wave's deletes, remove the
  corresponding exports from the legacy codebase `src/index.ts` in the same PR —
  otherwise any later `firebase deploy --only functions:<legacy>` resurrects
  deleted functions.
- **Pre-delete invocation check (standard gate):** for every function in the
  wave, confirm expected-zero traffic:
  `gcloud logging read 'resource.type="cloud_function" resource.labels.function_name="<fn>"' --project lvlup-ff6fa --freshness=30d --limit=5`
  (schedulers will show their own scheduled runs — expected; callables must be
  silent).
- **Trigger-type gotcha:** if a name is ever redeployed with a different trigger
  type, delete-first is mandatory (the https-stub orphans are the fossil of
  this). Re-created callables do NOT get `allUsers` invoker automatically —
  rollback redeploys must re-grant invoker perms (DEP-1).

### Wave 1 — Hazard removal (6 functions) — executable immediately, does NOT wait for Wave 0

The storage-trigger collision and the unprefixed-mutating schedulers are live
hazards independent of any client rewire (doc 03 B1/B2). The orphan https stubs
ride along.

```bash
npx firebase-tools@13.35.1 functions:delete \
  onAnswerSheetUpload onQuestionPaperUpload \
  onClassDeleted onStudentDeleted \
  tenantLifecycleCheck monthlyUsageReset \
  --project lvlup-ff6fa --region asia-south1 --force
```

Source trim (same PR): remove `onAnswerSheetUpload`/`onQuestionPaperUpload`
exports from `functions/autograde/src/index.ts`; remove
`tenantLifecycleCheck`/`monthlyUsageReset` exports from
`functions/identity/src/index.ts`. (The https stubs have no source — nothing to
trim.)

**Verification gate:**

1. `functions:list` count 244 → 238 (or 240 → 246−6 if Wave 0's +2 deploy landed
   first — either order is safe).
2. **v1 upload E2E** (the whole point): `v1-autograde-requestUploadUrl` → PUT an
   answer-sheet image → confirm `v1-autograde-onSubmissionCreated` path still
   runs (v2\_ submission advances) AND no new **unprefixed**
   `tenants/*/submissions` doc appears.
3. After the next daily 00:00 UTC window: no writes to unprefixed `tenants/{t}`
   status/usage fields (audit `auditLog`/`platformActivityLog` for the
   scheduler's fingerprints).

**Rollback:** schedulers/storage triggers — `git revert` the trim +
`firebase deploy --only functions:autograde,functions:identity` (pinned CLI;
package.json.bak check). Do NOT restore the https stubs (orphans by design).

### Wave 2 — Legacy callable purge + superseded non-callables (66 functions) — after Wave 0 gate passes

Requires: Wave 0 complete + verified, and a **cached-client soak** (recommend 7
days after hosting flip, so stale SPA bundles calling legacy names drain — watch
Cloud Logging for residual legacy-callable traffic; proceed when a full day
shows zero non-probe invocations).

Pre-wave sub-gates (doc 03 B2 caveats):

- Verify `v1-identity-cleanupExpiredExports` deletes Storage `exports/`
  **objects** (not just job docs) — shared unprefixed Storage namespace.
- Confirm zero unprefixed `digitalTestSessions` with status in_progress (or let
  legacy `onTestSessionExpired` run one final sweep first).
- §5.4 decision recorded for `cleanupInactiveChats` (port or accept gap).

```bash
# 45 legacy callables (39 dead + 6 rewired in Wave 0)
npx firebase-tools@13.35.1 functions:delete \
  bulkImportStudents bulkImportTeachers bulkUpdateStatus createOrgUser deactivateTenant \
  evaluateAnswer exportTenantData extractQuestions generateReport getSummary gradeQuestion \
  importFromBank joinTenant listAnnouncements listQuestionBank listStoreSpaces listVersions \
  manageNotifications purchaseSpace reactivateTenant recordItemAttempt rolloverSession \
  saveAcademicSession saveAnnouncement saveClass saveExam saveGlobalEvaluationPreset saveItem \
  saveParent saveQuestionBankItem saveRubricPreset saveSpace saveSpaceReview saveStaff \
  saveStoryPoint saveStudent saveTeacher saveTenant searchUsers sendChatMessage \
  startTestSession submitTestSession switchActiveTenant uploadAnswerSheets uploadTenantAsset \
  --project lvlup-ff6fa --region asia-south1 --force

# 21 superseded/safe non-callables
npx firebase-tools@13.35.1 functions:delete \
  cleanupExpiredExports cleanupInactiveChats cleanupStaleSessions dailyCostAggregation \
  generateInsights nightlyAtRiskDetection onTestSessionExpired staleSubmissionWatchdog \
  onExamPublished onExamResultsReleased onProgressMilestone onQuestionSubmissionUpdatedV2 \
  onResultsReleased onSpaceProgressUpdated onSpacePublished onStudentSummaryUpdated \
  onSubmissionCreated onSubmissionUpdated onSubmissionGraded onUserStoryPointProgressWrite \
  updateLeaderboard \
  --project lvlup-ff6fa --region asia-south1 --force
```

Source trim (same PR): remove all deleted exports from the four legacy
`src/index.ts` files (`manageNotifications` from BOTH identity and levelup).
After this wave the **analytics codebase is empty → remove the `analytics` entry
from `firebase.json`** and archive `functions/analytics` to `old-deprecated/`.
Remaining legacy surface: identity keeps 5 (`onClassArchived`,
`onStudentArchived`, `onTenantDeactivated`, `onUserCreated`, `onUserDeleted`),
autograde keeps 1 (`onExamDeleted`), levelup keeps 1 (`onSpaceDeleted`).

**Verification gate:**

1. `functions:list` count → 174 (167 v1 + 7 legacy).
2. Full app smoke re-run (Wave 0 gate item 3) against production — every flow
   that used to touch a legacy name.
3. Cloud Logging over 48h: zero NOT_FOUND callable errors from clients (would
   indicate a missed seam or an undrained cached bundle).
4. v1 schedulers all green in their next windows
   (`v1-identity-cleanupExpiredExports`,
   `v1-levelup-{expireTestSessions,cleanupStaleSessions}`,
   `v1-autograde-staleSubmissionWatchdog`,
   `v1-analytics-{dailyCostAggregation,nightlyAtRiskDetection,generateInsights}`).

**Rollback:** per-function — revert the trim commit for the affected codebase
and `firebase deploy --only functions:<codebase>`; then **re-grant `allUsers`
invoker** on any re-created callable (DEP-1: updates don't set it; fresh creates
via this CLI path need explicit `gcloud functions add-invoker-policy-binding` or
console grant). Clients are already on v1, so rollback here is precautionary
only.

### Wave 3 — Legacy-data load-bearing Firestore triggers (5 functions) — after SUB001/CHAITANY migration or freeze

Gate to open this wave: unprefixed tenant data is either migrated to v2\_
(Option A transform-migration, `migrate-subhang-to-v2.mjs`) or formally frozen
read-only. Owner decision §5.2 (cascade-during-purge) must be recorded first.

```bash
npx firebase-tools@13.35.1 functions:delete \
  onClassArchived onStudentArchived onTenantDeactivated \
  --project lvlup-ff6fa --region asia-south1 --force
# onExamDeleted / onSpaceDeleted: timing per §5.2 —
#   Option 1 (recommended): keep BOTH alive during the legacy-data purge (auto-cascade), delete them last:
npx firebase-tools@13.35.1 functions:delete onExamDeleted onSpaceDeleted \
  --project lvlup-ff6fa --region asia-south1 --force
#   Option 2: delete first and purge with a manual recursive delete (firebase firestore:delete -r).
```

Source trim: remove the 3 identity trigger exports; if Option 1, trim
`onExamDeleted`/`onSpaceDeleted` after the purge completes. After this wave,
**autograde and levelup codebases are empty → remove from `firebase.json`**,
archive to `old-deprecated/`.

**Verification gate:** `functions:list` → 169; if data was purged, spot-check
zero orphan subcollections (`questions`, `submissions`, `storyPoints`, `items`,
`answerKeys`, `spaceProgress` under deleted parents); RTDB legacy leaderboard
roots cleaned.

**Rollback:** revert trim + redeploy the owning codebase
(identity/autograde/levelup) — only meaningful while unprefixed data still
exists.

### Wave 4 — Auth triggers (2 functions) — LAST, after porting to sdk-v1

Gate: signup/delete handling ported per §5.1 owner decision, deployed in sdk-v1,
and verified (create a test user → profile doc appears via the NEW path; delete
→ soft-delete + membership deactivation).

```bash
npx firebase-tools@13.35.1 functions:delete onUserCreated onUserDeleted \
  --project lvlup-ff6fa --region asia-south1 --force
```

⚠ Sequencing: deploy the sdk-v1 replacement BEFORE deleting — a gap here means
new signups get NO user profile doc (login-breaking). If the replacement uses a
different trigger mechanism under the same semantics there is no name conflict
(`v1-identity-*` prefix), so no delete-first dance is needed.

Source trim: remove both exports; **identity codebase now empty → remove from
`firebase.json`**, archive `functions/identity` to `old-deprecated/`.
`firebase.json` now declares **only `sdk-v1`**.

**Verification gate:** `functions:list` → 167 (+ ports), all `v1-*`; new-user
signup E2E on student-web (school code + consumer); account deletion E2E;
`firebase.json` single codebase; full-project `firebase deploy --only functions`
manages exactly the sdk-v1 set.

**Rollback:** revert + `firebase deploy --only functions:identity` restores the
gen-1 pair (auth triggers keep their type — no delete-first needed).

---

## 4. End state

- **`firebase.json`:** one functions codebase — `sdk-v1` (`functions/sdk-v1`).
  Legacy `identity`/`autograde`/`levelup`/`analytics` entries removed
  (progressively: analytics after Wave 2, autograde+levelup after Wave 3,
  identity after Wave 4); their source archived to `old-deprecated/`.
- **Function count: 167** = 142 contract callables (140 today +
  `duplicateSpace` + `saveExamQuestion`) + 25 non-callables (14 v2\_-path
  Firestore triggers, 9 schedulers, 2 taskQueue handlers). Optional ports add up
  to 3: sdk-v1 auth handling for user create/delete (§5.1) and a
  `v1-levelup-cleanupInactiveChats` sweep (§5.4).
- **API structure (the statement of record):** every client operation is a
  contract callable `v1.<module>.<op>` in `packages/api-contract` (`.strict()`
  zod schemas, authMode, rateTier), invoked through `@levelup/query` →
  `@levelup/repositories` → `@levelup/api-client` → transport dot→dash mapping →
  deployed id **`v1-<module>-<op>`**. All business logic in `packages/services`;
  `functions/sdk-v1` stays a thin wire()/call() shell; Firestore access only via
  `repo-admin` on `v2_`-prefixed roots. No client bypasses: the last direct
  `httpsCallable` string (`v1-identity-lookupTenantByCode` in
  `shared-services/src/auth/tenant-lookup.ts:20`) should be folded into the
  contract path during the Wave 0 trim (it targets a v1 function, so it is not
  deletion-blocking).
- **What must remain and why:** nothing legacy. The only capability that
  survives by porting rather than deletion is auth user-create/delete handling
  (no v1 equivalent exists today — doc 03 B2-auth); until Wave 4 completes,
  `functions/identity` remains registered solely for the gen-1 auth-trigger pair
  (+ the Wave-3 rosters/cascade triggers until data migration).

---

## 5. Open decisions for the owner

| #   | Decision                                                                                                                                                                                                                                | Options / recommendation                                                                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | **Auth triggers: keep vs migrate — and `/users` writer semantics.** sdk-v1 has no auth-trigger equivalent; `onUserCreated` writes UNPREFIXED `/users`, so new signups get no `v2_users` doc from it today (doc 03 B2).                  | Recommend: port both into sdk-v1 (gen-1 auth triggers or v2 blocking functions) writing **`v2_users`**, plus verify/keep the v1 lazy-create fallback. Decide whether unprefixed `/users` writes continue during the transition (dual-write) or stop at cutover. Blocks Wave 4.                                    |
| 5.2 | **Legacy cascade triggers vs migration timing.** Should `onExamDeleted`/`onSpaceDeleted` stay live DURING the legacy-data purge (auto-cascade per delete) or be removed first with a manual recursive delete? (doc 03 B2/B4-ordering-3) | Recommend: keep them alive during the purge (Option 1) — automatic subcollection + RTDB cleanup, battle-tested paths; manual recursive delete risks missing `answerKeys`/RTDB roots. Blocks the tail of Wave 3.                                                                                                   |
| 5.3 | **`manageNotifications` owner.** Dual-exported by identity + levelup (doc 01 finding 4); zero live client usage (doc 02 §5.2).                                                                                                          | Recommend (decided in this plan unless overridden): no owner — delete in Wave 2, remove BOTH source exports. Only re-open if the 30-day invocation check shows external traffic.                                                                                                                                  |
| 5.4 | **`cleanupInactiveChats` replacement.** `v2_` chatSessions currently have NO inactivity sweep (doc 03 B2).                                                                                                                              | Options: (a) port a `v1-levelup-cleanupInactiveChats` scheduler to sdk-v1 (small: collectionGroup sweep, deactivate >7d-inactive), or (b) accept no sweep (chat UX may accumulate stale "active" sessions). Recommend (a), can land any time — does not block deletion of the legacy one (legacy data is static). |
| 5.5 | **SUB001/CHAITANY migration vs freeze timing.** Wave 3 (and transitively Wave 4's comfort) gates on it.                                                                                                                                 | Recommend: run the Option-A transform-migration (`migrate-subhang-to-v2.mjs`) before Wave 3; note the id-preserving migration is exactly why the Wave-1 storage-trigger deletion cannot wait.                                                                                                                     |
| 5.6 | **Cached-client soak length before Wave 2.**                                                                                                                                                                                            | Recommend 7 days after the Wave 0 hosting flip, with the Cloud Logging zero-legacy-traffic check as the actual gate (calendar time is a proxy).                                                                                                                                                                   |

---

## 6. Wave/count ledger

| Step   | Action                                                                                                 | Deployed count after               |
| ------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Today  | —                                                                                                      | 244                                |
| Wave 0 | deploy `v1-levelup-duplicateSpace`, `v1-autograde-saveExamQuestion` (+2); client rewires; no deletions | 246                                |
| Wave 1 | −6 (storage-trigger collision, https orphans, hazard schedulers)                                       | 240                                |
| Wave 2 | −66 (45 legacy callables + 21 superseded non-callables); drop `analytics` codebase                     | 174                                |
| Wave 3 | −5 (legacy-data triggers, post-migration); drop `autograde`+`levelup` codebases                        | 169                                |
| Wave 4 | −2 (auth triggers, post-port); drop `identity` codebase → sdk-v1 only                                  | **167** (+ up to 3 optional ports) |
