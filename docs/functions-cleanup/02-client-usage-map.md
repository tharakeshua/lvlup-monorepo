# FNCLEAN-2 — Client → Function Usage Map

**Date:** 2026-07-13 · **Branch:** `staging` · **Project:** `lvlup-ff6fa`
**Inputs:** `docs/functions-cleanup/deployed-functions-raw.txt` (244 deployed
fns: 165 `v1-*`, 79 unprefixed legacy), `packages/api-contract` registry (built
dist), full-source grep of `apps/` + client packages (`old-deprecated/` excluded
everywhere).

---

## 1. Summary

| Metric                                                             | Count                                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract callables in `packages/api-contract`                      | **142**                                                                                                                                     |
| Deployed `v1-*` callables                                          | **140** (all 140 ∈ contract; zero out-of-contract)                                                                                          |
| Contract callables **NOT deployed**                                | **2** — `v1-levelup-duplicateSpace`, `v1-autograde-saveExamQuestion`                                                                        |
| Deployed `v1-*` non-callables (triggers/scheduled/taskQueue)       | 25 (all sdk-v1 runtime; per FNCLEAN-1 all 165 map 1:1 to `functions/sdk-v1`)                                                                |
| Legacy unprefixed functions **USED-BY-LIVE-CODE**                  | **6** — `switchActiveTenant`, `generateReport`, `getSummary`, `saveTenant` (health-probe only), `uploadTenantAsset`, `saveQuestionBankItem` |
| Legacy referenced only by dead code (wrappers no live app imports) | 38                                                                                                                                          |
| Legacy **UNREFERENCED** by any live client code                    | 35 (incl. all 33 non-callable triggers/scheduled/https/auth)                                                                                |
| Direct `httpsCallable` bypasses of the contract SDK, live          | **7 call sites' worth** — 6 legacy names above + 1 v1 name (`v1-identity-lookupTenantByCode`)                                               |

**⚠️ Two live runtime breaks found (calls to functions that do not exist):**

1. **`v1-levelup-duplicateSpace` is invoked but NOT deployed.**
   `apps/teacher-web/src/pages/spaces/SpaceListPage.tsx:98` →
   `useDuplicateSpace` (`packages/query/src/levelup-content/duplicate.ts:13`,
   callable `v1.levelup.duplicateSpace`) → deployed id
   `v1-levelup-duplicateSpace` is absent from the deployed list. "Duplicate
   space" in teacher-web should currently fail NOT_FOUND.
2. **Unprefixed `getItemForEdit` is invoked but was never a deployed legacy
   function.** `apps/teacher-web/src/components/spaces/ItemEditor.tsx:470` →
   `callGetItemForEdit`
   (`packages/shared-services/src/levelup/content-callables.ts:194`,
   `getCallable('getItemForEdit')`). Only `v1-levelup-getItemForEdit` exists.
   This legacy-path call should fail NOT_FOUND; the fix is to rewire ItemEditor
   to the SDK hook.

`v1-autograde-saveExamQuestion` is also contract-declared and hook-wired
(`packages/query/src/autograde/hooks.ts:118`) but not deployed — **no app call
site yet** (teacher-web `ExamDetailPage.tsx:406,433` still carries stale "PARITY
GAP" comments), so it is a deploy gap, not a live break.

**Cleanup implication:** of the 79 legacy functions, only **6** are load-bearing
for current frontends, and each has a v1 equivalent already deployed
(`v1-identity-switchActiveTenant`, `v1-analytics-generateReport`,
`v1-analytics-getSummary`, `v1-identity-saveTenant`,
`v1-identity-uploadTenantAsset`, `v1-levelup-saveQuestionBankItem`). Rewiring 6
call seams (5 files + shared-stores auth-store) unblocks deleting the entire
unprefixed callable surface, from the client side.

---

## 2. Naming convention — contract → deployed

Contract names are `v1.<module>.<op>` (e.g. `v1.levelup.saveSpace`). The
Firebase transport carrier translates dots to dashes at invoke time:

- `packages/transport-firebase/src/invoke/invoke-via-callable.ts:44` —
  `httpsCallable(functions, toDeployedCallableId(name))`; `v1.levelup.saveSpace`
  → **`v1-levelup-saveSpace`** (sdk-v1 codebase exports `v1.<module>.<op>` →
  registered id `v1-<module>-<op>`).

The registry is `CALLABLES` in `packages/api-contract/src/registry.ts` (barrels:
identity, levelup content + gamification fold, autograde + fold, analytics).
`@levelup/query` hooks and `@levelup/repositories` only invoke through this
registry via `@levelup/api-client`, so **every SDK invocation maps 1:1 to a
`v1-<module>-<op>` deployed id**.

---

## 3. (a) Contract callables ↔ deployed `v1-*` mapping

142 contract callables (from built `CALLABLE_NAMES`): **identity 61, levelup 55,
autograde 13 + 6 fold, analytics 13** (module totals per registry barrels). Diff
against the 140 deployed `v1-*` callables:

- **Deployed & in contract: 140/140** — every deployed `v1-*` callable has
  exactly one contract entry (mechanical dot→dash match; zero orphans either
  direction except the two below).
- **In contract, NOT deployed (2):** `v1-levelup-duplicateSpace` (live app
  caller — break #1 above), `v1-autograde-saveExamQuestion` (hook exists, no
  caller).
- **Deployed callable NOT in contract: 0.**

Full 142-name list reproducible via:
`node -e "console.log(require('./packages/api-contract/dist/index.cjs').CALLABLE_NAMES.join('\n'))"`

The 25 non-callable `v1-*` functions (firestore/storage triggers, scheduled,
taskQueue — e.g. `v1-autograde-advancePipeline`,
`v1-analytics-recomputeStudentRollup`, `v1-identity-onMembershipWritten`) are
not client-invocable; FNCLEAN-1 confirmed all map 1:1 to `functions/sdk-v1`
source.

---

## 4. (b) Direct `httpsCallable` / fetch usages bypassing the contract SDK

No app source contains a raw `httpsCallable` call
(`apps/student-web/src/hooks/useTestSession.ts:134` is a comment). All bypasses
live in the two legacy packages, reached from apps via named-symbol imports.
Composition roots (`apps/*/src/sdk/firebase.ts` `getFunctions(...)`) are SDK
wiring, not bypasses.

### 4.1 LIVE bypasses (imported + invoked by current app code)

| Deployed fn invoked                                             | Wrapper (bypass site)                                                             | Live app call sites                                                                                                                                                                                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `switchActiveTenant` (legacy)                                   | `shared-services/src/auth/auth-callables.ts` `callSwitchActiveTenant`             | `packages/shared-stores/src/auth-store.ts:206,266` (login + tenant switch) ← used by **parent-web** (`LoginPage.tsx:22`), **student-web** (`SchoolCredentialsForm.tsx:22`, `ConsumerLoginForm.tsx:14`), **super-admin** (6 files import shared-stores) |
| `generateReport` (legacy)                                       | `shared-services/src/reports/pdf-callables.ts:31` `callGenerateReport`            | `parent-web/src/pages/ChildProgressPage.tsx:108`, `parent-web/src/pages/ExamResultsPage.tsx:363`, `teacher-web/src/pages/exams/ExamDetailPage.tsx:626`                                                                                                 |
| `getSummary` (legacy)                                           | `pdf-callables.ts:38` `callGetPlatformSummary` (scope:'health')                   | `super-admin/src/sdk/reads-platform.ts:248` (health history; the known getSummary-403 P2)                                                                                                                                                              |
| `saveTenant` (legacy)                                           | `auth-callables.ts` `callSaveTenant`                                              | `super-admin/src/sdk/reads-platform.ts:185` — **intentionally-failing functions-health probe only**; real tenant saves use SDK `useSaveTenant` (`FeatureFlagsPage.tsx:57`)                                                                             |
| `uploadTenantAsset` (legacy)                                    | `auth-callables.ts:330` `callUploadTenantAsset`                                   | `teacher-web/src/components/spaces/SpaceSettingsPanel.tsx:223`, `admin-web/src/components/settings/LogoUploader.tsx:46`, `student-web/src/pages/ProfilePage.tsx:140`                                                                                   |
| `saveQuestionBankItem` (legacy)                                 | `shared-services/src/levelup/content-callables.ts:130` `callSaveQuestionBankItem` | `teacher-web/src/components/question-bank/QuestionBankEditor.tsx:379`                                                                                                                                                                                  |
| `getItemForEdit` (**not deployed** — break #2)                  | `content-callables.ts:194` `callGetItemForEdit`                                   | `teacher-web/src/components/spaces/ItemEditor.tsx:470`                                                                                                                                                                                                 |
| `v1-identity-lookupTenantByCode` (**v1**, direct string bypass) | `shared-services/src/auth/tenant-lookup.ts:20`                                    | `parent-web/src/pages/LoginPage.tsx:4`, `student-web/src/components/auth/SchoolCodeForm.tsx:2`, plus `shared-stores/src/auth-store.ts` (login flow)                                                                                                    |

### 4.2 Dead bypass layer (exists in code, no live app imports the module)

- `packages/shared-services/src/auth/auth-callables.ts` — 26 wrappers; only
  `callSwitchActiveTenant`/`callSaveTenant`/`callUploadTenantAsset` are live
  (above).
- `packages/shared-services/src/levelup/{assessment,chat,store,content}-callables.ts`
  — only `callSaveQuestionBankItem` + `callGetItemForEdit` are live.
- `packages/shared-hooks/src/queries/*.ts` — 20+ hooks calling legacy names
  (`saveExam`, `saveSpace`, `saveItem`, `gradeQuestion`, `uploadAnswerSheets`,
  `startTestSession`, …). **The only shared-hooks import from any live app is
  `useTenantBranding`** (`parent-web/src/layouts/AppLayout.tsx:22`), which
  invokes no functions. All callable hooks in shared-hooks are dead from live
  apps.
- Tooling (not shipped): `packages/seed/scripts/live-read-proof.mjs:14` fetches
  `cloudfunctions.net` URLs directly.

**Mobile apps (mobile-student/teacher/admin):** pure fat-SDK — zero direct
callables, zero shared-services/hooks/stores deps. **Website (`apps/website`,
Astro):** zero firebase/functions usage of any kind.

---

## 5. (c) The 79 unprefixed legacy deployed functions — classification

Method: each name grepped as a quoted string across `apps/**` and
`packages/{shared-services,shared-hooks,shared-stores,shared-ui,shared-utils,shared-types}/src`
(excl. `old-deprecated/`, `node_modules`, `dist`, tests); every hit's module
then traced to live-app imports at symbol level.

### 5.1 USED-BY-LIVE-CODE — 6

| Function               | Evidence chain (wrapper → live caller)                                                                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `switchActiveTenant`   | `auth-callables.ts` → `shared-stores/src/auth-store.ts:206,266` → parent-web `LoginPage.tsx:22`; student-web `SchoolCredentialsForm.tsx:22`, `ConsumerLoginForm.tsx:14`; super-admin login. **Fires on every school-code login and tenant switch.** |
| `generateReport`       | `pdf-callables.ts:31` → parent-web `ChildProgressPage.tsx:108`, `ExamResultsPage.tsx:363`; teacher-web `ExamDetailPage.tsx:626`                                                                                                                     |
| `getSummary`           | `pdf-callables.ts:38` → super-admin `reads-platform.ts:248`                                                                                                                                                                                         |
| `saveTenant`           | `auth-callables.ts` → super-admin `reads-platform.ts:185` (health probe; expects an error response as "operational" signal)                                                                                                                         |
| `uploadTenantAsset`    | `auth-callables.ts:330` → teacher-web `SpaceSettingsPanel.tsx:223`; admin-web `LogoUploader.tsx:46`; student-web `ProfilePage.tsx:140`                                                                                                              |
| `saveQuestionBankItem` | `content-callables.ts:130` → teacher-web `QuestionBankEditor.tsx:379`                                                                                                                                                                               |

### 5.2 REFERENCED-BY-DEAD-CODE-ONLY — 38 (wrapper exists; no live app imports it)

Safe to remove from the deployed surface once the dead wrapper modules are
confirmed unshipped (they are exported by package barrels, so verify
tree-shaking or delete the modules in the same change).

| Function                     | Dead wrapper (file:line)                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bulkImportStudents`         | `shared-services/src/auth/auth-callables.ts:168`                                                                                                  |
| `bulkImportTeachers`         | `auth-callables.ts:295`                                                                                                                           |
| `bulkUpdateStatus`           | `auth-callables.ts:305`                                                                                                                           |
| `createOrgUser`              | `auth-callables.ts:116`                                                                                                                           |
| `deactivateTenant`           | `auth-callables.ts:198`                                                                                                                           |
| `exportTenantData`           | `auth-callables.ts:214`                                                                                                                           |
| `joinTenant`                 | `auth-callables.ts:267`                                                                                                                           |
| `listAnnouncements`          | `auth-callables.ts:285`                                                                                                                           |
| `manageNotifications`        | `auth-callables.ts:160` (FNCLEAN-1: exported by BOTH identity & levelup codebases)                                                                |
| `reactivateTenant`           | `auth-callables.ts:206`                                                                                                                           |
| `rolloverSession`            | `auth-callables.ts:315`                                                                                                                           |
| `saveAcademicSession`        | `auth-callables.ts:154`                                                                                                                           |
| `saveAnnouncement`           | `auth-callables.ts:277`                                                                                                                           |
| `saveClass`                  | `auth-callables.ts:130`                                                                                                                           |
| `saveGlobalEvaluationPreset` | `auth-callables.ts:247`                                                                                                                           |
| `saveItem`                   | `auth-callables.ts:188` (+ dead shared-hooks `useItemMutations.ts`)                                                                               |
| `saveParent`                 | `auth-callables.ts:148`                                                                                                                           |
| `saveSpace`                  | `auth-callables.ts:176` (+ dead `useSpaceMutations.ts`)                                                                                           |
| `saveStaff`                  | `auth-callables.ts:323`                                                                                                                           |
| `saveStoryPoint`             | `auth-callables.ts:182` (+ dead `useStoryPoints.ts`)                                                                                              |
| `saveStudent`                | `auth-callables.ts:136`                                                                                                                           |
| `saveTeacher`                | `auth-callables.ts:142`                                                                                                                           |
| `searchUsers`                | `auth-callables.ts:343`                                                                                                                           |
| `evaluateAnswer`             | `shared-services/src/levelup/assessment-callables.ts:103` (+ dead `useChatSessions.ts:90`)                                                        |
| `recordItemAttempt`          | `assessment-callables.ts:111`                                                                                                                     |
| `startTestSession`           | `assessment-callables.ts:87` (+ dead `useTestSessions.ts:47`)                                                                                     |
| `submitTestSession`          | `assessment-callables.ts:95` (+ dead `useTestSessions.ts:77`)                                                                                     |
| `sendChatMessage`            | `shared-services/src/levelup/chat-callables.ts:41` (app hits are comments only: `student-web/useChatTutor.ts:72`, `mobile-student/_types.ts:272`) |
| `purchaseSpace`              | `shared-services/src/levelup/store-callables.ts:69`                                                                                               |
| `listStoreSpaces`            | `store-callables.ts:61`                                                                                                                           |
| `importFromBank`             | `shared-services/src/levelup/content-callables.ts:146`                                                                                            |
| `listQuestionBank`           | `content-callables.ts:138`                                                                                                                        |
| `listVersions`               | `content-callables.ts:170`                                                                                                                        |
| `saveRubricPreset`           | `content-callables.ts:154` (+ dead `useRubricPresets.ts:42`)                                                                                      |
| `saveSpaceReview`            | `content-callables.ts:162` (+ dead `useSpaceReviews.ts`)                                                                                          |
| `saveExam`                   | shared-hooks only: `useSubmissionMutations.ts:60`, `useExamMutations.ts`                                                                          |
| `gradeQuestion`              | shared-hooks only: `useSubmissionMutations.ts:43`                                                                                                 |
| `uploadAnswerSheets`         | shared-hooks only: `useSubmissionMutations.ts:23`                                                                                                 |

### 5.3 UNREFERENCED — 35 (zero live-code references)

Callables (1): `extractQuestions` (only hit:
`apps/teacher-web/AUTOGRADE_FRONTEND_AUDIT.md`, a doc).

Non-callables (34) — not client-invocable by nature; client analysis N/A,
liveness is a backend/data question (FNCLEAN-1/3 scope):

- **Scheduled (10):** `cleanupExpiredExports`, `cleanupInactiveChats`,
  `cleanupStaleSessions`, `dailyCostAggregation`, `generateInsights`,
  `monthlyUsageReset`, `nightlyAtRiskDetection`, `onTestSessionExpired`,
  `staleSubmissionWatchdog`, `tenantLifecycleCheck`
- **HTTPS orphan stubs (2, per FNCLEAN-1 no source):** `onClassDeleted`,
  `onStudentDeleted`
- **Firestore/Storage/Auth triggers (22):** `onAnswerSheetUpload`,
  `onClassArchived`, `onExamDeleted`, `onExamPublished`,
  `onExamResultsReleased`, `onProgressMilestone`, `onQuestionPaperUpload`,
  `onQuestionSubmissionUpdatedV2`, `onResultsReleased`, `onSpaceDeleted`,
  `onSpaceProgressUpdated`, `onSpacePublished`, `onStudentArchived`,
  `onStudentSummaryUpdated`, `onSubmissionCreated`, `onSubmissionGraded`,
  `onSubmissionUpdated`, `onTenantDeactivated`, `onUserStoryPointProgressWrite`,
  `updateLeaderboard`, `onUserCreated`, `onUserDeleted`

(4 of the above names appear only in `.md` docs: `extractQuestions`,
`onAnswerSheetUpload`, `onQuestionPaperUpload`, `onQuestionSubmissionUpdatedV2`
— docs are not live code.)

**Reconciliation: 6 + 38 + 35 = 79 ✔**

---

## 6. (d) Dead `v1-*` surface

**None on the callable side:** all 140 deployed `v1-*` callables are
contract-reachable through `@levelup/api-client`/`@levelup/query` (whether every
hook has a UI caller today is a coverage question, not a dead-function question
— the 140/140 wire-coverage pin test in `@levelup/query` guarantees SDK
reachability). The 25 non-callable `v1-*` functions are sdk-v1
triggers/scheduled/taskQueue with 1:1 source mapping (FNCLEAN-1) — active
runtime, not dead surface.

Inverse gap (contract-deployed drift): `v1-levelup-duplicateSpace` and
`v1-autograde-saveExamQuestion` need a deploy (the former urgently — live
caller).

---

## 7. Recommended follow-ups (for the cleanup plan)

1. **Deploy `v1-levelup-duplicateSpace`** (or hotfix teacher-web) — live
   NOT_FOUND on Duplicate Space.
2. **Rewire ItemEditor** off `callGetItemForEdit` → SDK `getItemForEdit` — live
   NOT_FOUND.
3. **Migrate the 6 live legacy seams to v1 equivalents** (all already deployed):
   auth-store `switchActiveTenant` → `v1-identity-switchActiveTenant`;
   `generateReport`/`getSummary` → `v1-analytics-*`; `uploadTenantAsset` →
   `v1-identity-uploadTenantAsset`; `saveQuestionBankItem` →
   `v1-levelup-saveQuestionBankItem`; replace the super-admin `saveTenant`
   health probe with a v1-based probe.
4. After (3), **all 45 legacy callables are client-safe to delete**; the 34
   legacy triggers/scheduled need only the backend-side verdict (FNCLEAN-1/3).
5. Delete/trim the dead wrapper layer (`shared-services/*-callables.ts` unused
   exports, `shared-hooks/src/queries/*`) in the same change to prevent
   resurrection.
