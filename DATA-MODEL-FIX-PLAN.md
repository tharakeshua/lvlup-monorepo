# DATA-MODEL-FIX-PLAN — The Authoritative Foundation Plan

**Author:** data-model-scoper (sess_1783164953381_tddf75qnp) **Date:**
2026-07-04 **Mode:** Analysis + planning only. **No code changed in this
session.** **Purpose:** The single authoritative plan to fully fix the data
model — domain entity types, the Firestore "tables"
(collections/subcollections + doc shapes), and the relations between entities —
that the whole Fable build sits on.

> **Ground truth sources:** `packages/domain/src/**` (Zod SSOT),
> `packages/shared-types/src/**` (legacy TS), `firestore.rules`,
> `firestore.indexes.json`, `packages/repositories/src/**`,
> `packages/functions-shared/src/context/ports.ts` (path map), plus the three
> sibling analysis briefs: `functions/autograde/AUTOGRADE_ANALYSIS.md`,
> `functions/autograde/CONTRACT_REPORT.md`, `CORE-STUDENT-QA-FLOW-BRIEF.md`.

---

## 0. TL;DR — The Five Decisions

1. **SSOT = `packages/domain` (Zod-first).** Every new SDK layer (`api-contract`
   58/0, `repositories` 51/0, `services` 9/0, `query` 7/0 — domain/shared-types
   file counts) is already 100% domain. `shared-types` is legacy and must be
   retired, but it is **still load-bearing** for the four legacy Cloud Functions
   (`functions/{identity,levelup,analytics,autograde}` ≈ 108 imports) and the
   `shared-*` runtime packages. **Converge onto domain; retire shared-types
   last, after the functions migrate to `functions/sdk-v1`.**

2. **Reconcile 8 enum/field drifts by adopting domain's decisions wholesale** —
   domain is the deliberately-curated superset with explicit
   `// DROPPED`/`// D12` reconciliation notes.

3. **Standardize timestamps on ISO-8601 strings at rest** (domain's
   `zTimestamp`). This is the single highest-risk interop item and gets a
   dedicated boundary adapter during transition.

4. **Fix the question-type vocabulary gap** — `group-options` (an auto-graded
   type) is in no normalization mapping and silently falls through to the AI
   grader. This is a live correctness bug.

5. **Fix the concrete Firestore-rules divergences** — `scanners` path (root vs
   tenant-scoped), dual `items` paths, root-level `storyPointProgress`, and the
   `v2_`-prefix rules blind spot.

---

## 1. ENTITY-RELATIONSHIP MAP (ERD)

**48 entities across 8 domains; 42 branded ID types** (all in
`packages/domain/src/primitives/branded-id.zod.ts`).

### 1.1 Core relations (mermaid)

```mermaid
erDiagram
    TENANT ||--o{ USER_MEMBERSHIP : "has members"
    USER   ||--o{ USER_MEMBERSHIP : "belongs via"
    USER_MEMBERSHIP }o--|| TENANT  : "scopes role in"
    USER_MEMBERSHIP ||..|| STUDENT : "role→ (idField)"
    USER_MEMBERSHIP ||..|| TEACHER : "role→ (idField)"
    USER_MEMBERSHIP ||..|| PARENT  : "role→ (idField)"
    USER_MEMBERSHIP ||..|| STAFF   : "role→ (idField)"

    TENANT ||--o{ CLASS : owns
    TENANT ||--o{ ACADEMIC_SESSION : owns
    CLASS  }o--|| ACADEMIC_SESSION : "in"
    CLASS  }o--o{ STUDENT : "studentIds[]"
    CLASS  }o--o{ TEACHER : "teacherIds[]"
    PARENT }o--o{ STUDENT : "childStudentIds[]"

    TENANT ||--o{ SPACE : owns
    SPACE  ||--o{ STORY_POINT : contains
    STORY_POINT ||--o{ ITEM : contains
    ITEM   ||--|| ANSWER_KEY : "server-only key"
    ITEM   }o--o| RUBRIC_PRESET : "rubricId (+ embedded snapshot)"
    SPACE  ||--o{ AGENT : "AI agents"
    SPACE  ||--o{ SPACE_REVIEW : "reviews/{uid}"
    SPACE  }o--o{ CLASS : "classIds[] (class_scoped)"

    USER ||--o{ SPACE_PROGRESS : "progresses"
    SPACE_PROGRESS ||--o{ STORY_POINT_PROGRESS : subcollection
    USER ||--o{ DIGITAL_TEST_SESSION : takes
    DIGITAL_TEST_SESSION ||--o{ TEST_SUBMISSION : "submissions/{itemId}"
    USER ||--o{ CHAT_SESSION : owns
    CHAT_SESSION ||--o{ CHAT_MESSAGE : "messages/ (server-only write)"

    TENANT ||--o{ EXAM : owns
    EXAM   ||--o{ EXAM_QUESTION : "questions/"
    EXAM   ||--o{ SUBMISSION : "submissions (by examId)"
    SUBMISSION ||--o{ QUESTION_SUBMISSION : "questionSubmissions/"
    EXAM   }o--o{ CLASS : "classIds[]"
    SUBMISSION }o--|| STUDENT : "studentId"
    EXAM   }o--o| EVALUATION_SETTINGS : "evaluationSettingsId"
    EXAM   ||--o| EXAM_ANALYTICS : "examAnalytics/{examId}"

    TENANT ||--o{ ACHIEVEMENT : defines
    STUDENT ||--o{ STUDENT_ACHIEVEMENT : earns
    STUDENT ||--|| STUDENT_LEVEL : "level/current"
    STUDENT ||--o{ STUDY_GOAL : sets
    STUDENT ||--o{ STUDY_SESSION : logs
```

### 1.2 Foreign-key adjacency (authoritative — build ERD from this)

| Entity                           | References (FK / owner)                                                                                                                                         | Cardinality note                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **UserMembership** (junction)    | `uid`→User, `tenantId`→Tenant, `classIds[]`, per-role `studentId`/`teacherId`/…                                                                                 | Doc id = `{uid}_{tenantId}`              |
| **Student/Teacher/Parent/Staff** | `tenantId`; Student.`classIds[]`,`parentIds[]`; Teacher.`classIds[]`; Parent.`childStudentIds[]`                                                                | tenant-scoped role docs                  |
| **Class**                        | `tenantId`, `academicSessionId`, `studentIds[]`, `teacherIds[]`                                                                                                 | many-to-many via arrays                  |
| **Space**                        | `tenantId`, `createdBy`→User, `teacherIds[]` (⚠ typed `UserId[]` — should be `TeacherId[]`), `classIds[]`                                                       |                                          |
| **StoryPoint**                   | `spaceId`, `tenantId`                                                                                                                                           | ordered spine                            |
| **Item**                         | `storyPointId`, `spaceId`, `tenantId`, `rubricId`→RubricPreset (+ embedded `rubric` snapshot)                                                                   |                                          |
| **AnswerKey**                    | `itemId`                                                                                                                                                        | **server-only, deny-all**                |
| **Exam**                         | `tenantId`, `createdBy`, `classIds[]`, `evaluationSettingsId` (⚠ also `gradingConfig.evaluationSettingsId` — dual ref), `linkedSpaceId?`, `linkedStoryPointId?` |                                          |
| **ExamQuestion**                 | `examId` (subcollection)                                                                                                                                        |                                          |
| **Submission**                   | `examId`, `studentId`, `classId`, `tenantId` (domain drops tenantId — path-scoped)                                                                              | one per (examId, studentId)              |
| **QuestionSubmission**           | `submissionId`, `questionId`, `examId`                                                                                                                          | mapping.imageUrls invariant              |
| **SpaceProgress**                | `userId`, `spaceId`, `tenantId` — doc id `{userId}_{spaceId}`                                                                                                   |                                          |
| **StoryPointProgress**           | nested under SpaceProgress                                                                                                                                      | ⚠ paths.ts also declares root-level form |
| **DigitalTestSession**           | `userId`, `spaceId`, `storyPointId`                                                                                                                             | keyed on `userId` NOT `studentId`        |
| **ChatSession**                  | `userId`, `spaceId?`, `itemId?`                                                                                                                                 | keyed on `userId` NOT `studentId`        |
| **EvaluationSettings**           | `tenantId`, `scope`+`scopeId`                                                                                                                                   |                                          |
| **StudentAchievement**           | `userId`, `achievementId`                                                                                                                                       | subcollection of student                 |
| **Announcement**                 | `tenantId` **nullable** (platform-scope)                                                                                                                        | unique                                   |

**Cross-domain shared value objects (NOT standalone tables):** `UnifiedRubric`
(Space, StoryPoint, Item, ExamQuestion), `UnifiedEvaluationResult` /
`StoredEvaluation` (TestSubmission, QuestionSubmission), `ItemPayload`
(7-variant discriminated union → 15 question subtypes).

---

## 2. THE FIRESTORE "TABLES" (collection/subcollection tree)

Legend: 🌐 root-level · 🏢 tenant-scoped (`tenants/{tenantId}/…`, inherits
`${LVLUP_COLLECTION_PREFIX}`) · 🔒 server-only (deny-all / not in rules) · 👤
owner/self · 🎓 role-gated.

```
🌐 users/{uid}                                    👤 self read/write (guarded fields blocked)
🌐 userMemberships/{uid}_{tenantId}               👤 self read · 🔒 write deny-all (Admin SDK)
🌐 tenants/{tenantId}                             public get · superAdmin write   ← PREFIX ROOT (v2_)
🌐 tenantCodes/{code}                             public get (pre-auth) · 🔒 write deny-all
🌐 globalEvaluationPresets/{id}                   auth read · superAdmin write
🌐 scanners/{scannerId}                           ⚠ rules root-level; paths.ts tenant-scoped (DIVERGENCE)
🌐 platformActivityLog/{id}                       🔒 not in rules

🏢 tenants/{t}/users/{uid}/devices/{token}        🔒
🏢 tenants/{t}/students/{studentId}               🎓 admin/teacher/staff/self/parent
     └ achievements/{id}, level/current, studyGoals/{id}, studySessions/{id}   🔒 (gamification)
🏢 tenants/{t}/teachers/{teacherId}               🎓
🏢 tenants/{t}/parents/{parentId}                 🎓 admin / self
🏢 tenants/{t}/staff/{staffId}                    🎓 admin / self
🏢 tenants/{t}/classes/{classId}                  🎓 admin / staff(canManageClasses)
🏢 tenants/{t}/academicSessions/{id}              🎓 admin
🏢 tenants/{t}/announcements/{id}/reads/{uid}     🔒 not in rules
🏢 tenants/{t}/notifications/{id}                 👤 recipient read/update · 🔒 create/delete deny-all
🏢 tenants/{t}/notificationPreferences/{userId}   👤 self

🏢 tenants/{t}/spaces/{spaceId}                    🎓 canAccessSpace / teacher owner
     ├ storyPoints/{spId}/items/{itemId}          🎓
     │    └ answerKeys/{keyId}                     🔒🔒 DENY-ALL (correct answers)
     ├ items/{itemId}/answerKeys/{keyId}           ⚠ PARALLEL flat path still in rules (D1 says deleted)
     ├ reviews/{uid}                               🔒 not in rules
     └ agents/{agentId}                            🔒 not in rules
🏢 tenants/{t}/chatSessions/{id}/messages/{id}     👤 owner read · 🔒 write deny-all
🏢 tenants/{t}/rubricPresets/{id}                  🔒 not in rules
🏢 tenants/{t}/questionBank/{id}                   🔒 not in rules

🏢 tenants/{t}/exams/{examId}/questions/{qId}      🎓 status-gated (students: published+)
🏢 tenants/{t}/submissions/{id}/questionSubmissions/{qsId}  🎓 self/teacher; parent on resultsReleased
🏢 tenants/{t}/evaluationSettings/{id}             🎓 admin write / teacher read
🏢 tenants/{t}/gradingDeadLetter/{id}              🔒
🏢 tenants/{t}/examAnalytics/{examId}              🔒
🏢 tenants/{t}/llmCallLogs/{id} · auditLogs/{id}   🎓 read / 🔒 write deny-all
🏢 tenants/{t}/costSummaries/{daily|monthly_id}    🔒
🏢 tenants/{t}/insights/{id}                       🔒
🏢 tenants/{t}/{student,class}ProgressSummaries/{id} 🔒

🏢 tenants/{t}/progress/{id}                       🎓  (legacy exam-progress summary)
🏢 tenants/{t}/spaceProgress/{userId}_{spaceId}    🎓 self
     ├ storyPointProgress/{id}                     🎓 self  (nested — the rule-blessed form)
     └ live/current                                🔒
🏢 tenants/{t}/storyPointProgress/{userId}_{spId}  ⚠ paths.ts root-level form — NOT in rules
🏢 tenants/{t}/testSessions/{id}                   🎓 self  (physical/offline scans)
🏢 tenants/{t}/digitalTestSessions/{id}            🎓 self  (keyed userId)
     ├ submissions/{itemId}                        🔒
     └ live/current                                🔒
🏢 tenants/{t}/achievements/{id}                   🔒 (tenant definitions)

🌐 tenants/platform_public/spaces/{id}             auth read iff accessType=='public_store'
```

**Server-only / deny-all (never leaks to client):** `answerKeys` (both paths),
`userMemberships` writes, `tenantCodes` writes, notifications create/delete,
`chatSessions/messages` writes, `llmCallLogs`, `auditLogs`, `scanners`. **~20
paths are `server-only-by-absence`** (present in `ports.ts` path map, absent
from rules) — acceptable if Admin-SDK-only, but each is unprotected if ever
exposed via a client-callable escape hatch.

**Indexes:** 57 composite indexes + 1 field override (`answerKeys.itemId` on
COLLECTION & COLLECTION_GROUP). Heaviest: `exams` (10), `submissions` (10),
`items` (6), `spaces` (5).

**Cascade behavior (verified in triggers):**

- `onSpaceDeleted` → deletes storyPoints, items(+answerKeys), agents,
  digitalTestSessions, spaceProgress(+storyPointProgress),
  chatSessions(+messages), RTDB leaderboard; decrements
  `tenant.stats.totalSpaces`. **Does NOT touch exam submissions** (linked by
  classIds).
- `onExamDeleted` → deletes questions, submissions(+questionSubmissions),
  examAnalytics; decrements `tenant.stats.totalExams`.
- `onTenantDeactivated` → **suspends** memberships (no delete;
  audit-preserving).
- `onClassDeleted` / `onStudentDeleted` → **array cleanup** (no delete; refs
  pruned).

---

## 3. THE BIG DECISION — domain vs shared-types convergence

### 3.1 The finding

Two parallel type systems, mid-migration:

- **`packages/domain`** — Zod-first, ISO-string timestamps, registry-derived,
  curated superset with explicit drift notes. **Intended SSOT.**
- **`packages/shared-types`** — hand-written TS interfaces + Firestore-object
  timestamps + a parallel Zod callable-schema set. **Legacy.**

**Per-layer SSOT (domain / shared-types file-import counts):**

| Layer                                                      | domain   | shared-types | Verdict                |
| ---------------------------------------------------------- | -------- | ------------ | ---------------------- |
| api-contract                                               | 58       | 0            | ✅ domain              |
| repositories                                               | 51       | 0            | ✅ domain              |
| services                                                   | 9        | 0            | ✅ domain              |
| query                                                      | 7        | 0            | ✅ domain              |
| functions/sdk-v1                                           | 1        | 0            | ✅ domain (nascent)    |
| functions/identity                                         | 0        | 40           | ❌ shared-types        |
| functions/levelup                                          | 0        | 25           | ❌ shared-types        |
| functions/analytics                                        | 0        | 15           | ❌ shared-types        |
| functions/autograde                                        | 0        | 8            | ❌ shared-types        |
| shared-hooks / shared-services / shared-ui / shared-stores | —        | 35/20/7/2    | ❌ shared-types        |
| web apps (student/teacher/admin/parent)                    | 13/6/1/6 | 45/33/21/15  | ⚠ BOTH (mid-migration) |
| mobile apps                                                | ✅       | 0            | ✅ domain-only         |

### 3.2 The decision

**Target SSOT = `packages/domain`. Retire `packages/shared-types`.** The whole
new SDK spine is already domain-pure; mobile is domain-only; domain is the
richer, self-validating model.

**What blocks retirement (dependency order to unblock):**

1. **The four legacy Cloud Functions** (~108 shared-types imports) must move
   onto `functions/sdk-v1` + `@levelup/domain`/`api-contract`. **This is the
   hard blocker.**
2. The `shared-*` runtime packages (web substrate).
3. Residual `shared-types` imports in the four web apps.

Only after imports hit zero can `packages/shared-types` be deleted.

---

## 4. CONSOLIDATED DIVERGENCE CATALOG (verify & fold in)

| #      | Divergence                                              | shared-types                                                                           | domain                                                                   | Resolution                                                                                               |
| ------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **A**  | **Two parallel type systems**                           | legacy                                                                                 | intended SSOT                                                            | Converge → domain (§3)                                                                                   |
| **B1** | Exam status `completed`                                 | has it (`constants/grades.ts:64-73`)                                                   | dropped (`enums/exam.ts:4-12`)                                           | Adopt domain; add read-adapter for legacy docs                                                           |
| **B2** | Submission pipelineStatus `ocr_processing`/`ocr_failed` | has both (`grades.ts:30-46`)                                                           | dropped (`enums/submission.ts:4-18`)                                     | Adopt domain; migrate/backfill legacy docs                                                               |
| **B3** | Grading step `ocr`                                      | DLQ has it (`autograde/dead-letter.ts:9`)                                              | only scouting/grading (`evaluation-settings.ts:54`)                      | Adopt domain; DLQ read-adapter                                                                           |
| **B4** | Upload source `rn`                                      | missing (`autograde/submission.ts:14`); schema even has `gcs` (`schemas/index.ts:282`) | has `web/scanner/rn` (`enums/misc.ts:11`)                                | Adopt domain (`rn` used by mobile); drop `gcs`                                                           |
| **B5** | Grade letters `C+`                                      | 7 letters (`grades.ts:6-16`)                                                           | 8 incl. C+ (`enums/grading.ts:3`); field `{letter,min}` vs `{min,grade}` | Adopt domain 8-letter + `{letter,min}`                                                                   |
| **B6** | StoryPointType `test` synonym                           | 5 values (`levelup/story-point.ts:10-15`)                                              | 4 (`enums/content.ts:54`)                                                | Adopt domain; map `test`→`timed_test` on read                                                            |
| **B7** | Submission `grade` type                                 | `string`                                                                               | `zGradeLetter` enum                                                      | Adopt domain typed enum                                                                                  |
| **B8** | **Timestamp representation**                            | object `{seconds,nanoseconds,toDate()}`                                                | ISO-8601 string (`primitives/timestamp.zod.ts`)                          | **ISO strings at rest**; boundary adapter (highest risk)                                                 |
| **C**  | **Question-type vocabulary**                            | backend `DETERMINISTIC_TYPES` uses `multiple_choice/multi_select/…`                    | registry uses `mcq/mcaq/true-false/…`                                    | bridged by `normalizeQuestionType` — **see §5, has a live gap**                                          |
| **D**  | Stale shared-types dist                                 | —                                                                                      | —                                                                        | dist is gitignored & currently **in sync**; risk is only local stale builds → enforce `pnpm build` in CI |
| **E**  | DP-3: answer-bearing fields client-side                 | —                                                                                      | prompt schemas still carry `isCorrect/correctAnswer/modelAnswer`         | Deferred; strip into server-only AnswerKey                                                               |
| **F**  | Seed/v2 drift                                           | deployed-seed drifts from canonical Zod                                                | —                                                                        | Transform-migration; validate seed against domain Zod                                                    |

**Additional (from entity map):** `Space.teacherIds: UserId[]` should be
`TeacherId[]`; `Exam` dual `evaluationSettingsId` (top-level + `gradingConfig`);
`uid`/`userId`/`authUid` naming inconsistency; `TestSessionId` vs `SessionId`
both defined (canonical unclear).

---

## 5. THE QUESTION-TYPE GAP (live correctness bug)

Registry auto-graded keys → `normalizeQuestionType`
(`services/src/levelup/practice.ts:31-47`) → `DETERMINISTIC_TYPES`
(`services/src/levelup/grading.ts:15-24`):

| Registry key      | maps to                          | in DETERMINISTIC_TYPES? |
| ----------------- | -------------------------------- | ----------------------- |
| mcq               | mcq                              | ✅                      |
| mcaq              | multi_select                     | ✅                      |
| true-false        | true_false                       | ✅                      |
| numerical         | numeric                          | ✅                      |
| fill-blanks       | fill_blank                       | ✅                      |
| fill-blanks-dd    | fill_blank                       | ✅                      |
| matching          | matching                         | ✅                      |
| jumbled           | ordering                         | ✅                      |
| **group-options** | _(no mapping)_ → `group-options` | ❌ **NOT in set**       |

**`group-options` silently falls through to the AI grader** (or scores 0) — no
mapping entry, not in `DETERMINISTIC_TYPES`, and `autoEvaluateDeterministic` has
no `group-options`/`grouping` branch. This is a real bug for any content using
that type. (Also: `short_answer`/`long_answer` are intentionally NOT in the set
— handled by the separate text-compare branch in `scoreOne`.)

---

## 6. PHASED, FABLE-SIZED WORK UNITS

Ordered so foundational fixes land before dependents. Each unit is surgical and
independently shippable. **Phases 0–2 are safe/low-risk; Phase 3 is the heavy
functions migration; Phase 4 is polish/deferred.**

### PHASE 0 — Zero-risk hardening (do first, unblocks confidence)

**U0.1 — Question-type normalization fix + test** ★ highest value

- Scope: add `group-options` (and any alias) to `QT_TO_GRADING` or
  `DETERMINISTIC_TYPES`; implement the `group-options` branch in
  `autoEvaluateDeterministic`.
- Files: `packages/services/src/levelup/grading.ts`, `practice.ts`.
- Accept: a `group-options` question grades deterministically; unit test covers
  all 9 registry auto-keys → correct scorer (no fall-through to AI).
- Deps: none.

**U0.2 — CI build gate for shared-types dist**

- Scope: ensure `pnpm --filter @levelup/shared-types build` runs in CI so no
  consumer loads a stale dist (the `questionPaperImages .url()` class of bug).
- Files: CI workflow (`.github/workflows/*`), maybe `turbo.json`.
- Accept: CI fails if dist is stale vs src.
- Deps: none.

**U0.3 — AI-seam adapter regression test**

- Scope: pin the `res.data`→`json` adapter in
  `functions/sdk-v1/src/bootstrap.ts` (the `as unknown` cast has no compile
  guard) + the answerKey-prefix fix.
- Accept: test fails if the adapter mapping regresses.
- Deps: none.

### PHASE 1 — Enum/field reconciliation (domain is authoritative)

**U1.1 — Autograde enum convergence (B1–B4, B6, B7)**

- Scope: make domain the source; add legacy-doc **read-adapters** (map
  `completed`→terminal state, `ocr_*`→`scouting`/failed, `ocr`→`scouting`,
  `gcs`→`scanner`, `test`→`timed_test`). Do NOT drop values from a schema that
  must still _read_ legacy docs — widen-on-read, narrow-on-write.
- Files: `packages/domain/src/enums/{exam,submission,grading,misc,content}.ts`
  (confirm), new adapter in `packages/repositories` or `functions-shared`.
- Accept: legacy seeded docs parse; new writes use canonical values; unit tests
  per enum.
- Deps: U0 done.

**U1.2 — Grade-letter unification (B5)**

- Scope: adopt domain 8-letter + `{letter,min}`; migrate any `{min,grade}`
  readers.
- Accept: `C+` grade round-trips; boundary table matches `calculateGrade`.
- Deps: U1.1.

**U1.3 — ID/field naming cleanup**

- Scope: `Space.teacherIds` → `TeacherId[]`; resolve `Exam` dual
  `evaluationSettingsId` (pick top-level, deprecate the nested); document
  `uid`/`userId`/`authUid` canonical usage; resolve `TestSessionId` vs
  `SessionId`.
- Accept: types compile; no behavior change; a short ID-conventions note added.
- Deps: U1.1.

### PHASE 2 — Firestore rules & path corrections

**U2.1 — Scanners path fix** (HIGH risk if unaddressed)

- Scope: align rules to tenant-scoped `tenants/{t}/scanners/{id}` (or confirm
  root is dead).
- Files: `firestore.rules:224-231`.
- Accept: scanner reads/writes succeed on the path repos actually use.
- Deps: none.

**U2.2 — storyPointProgress path unification**

- Scope: decide nested-only (rule-blessed) vs root-level (`ports.ts`); make
  code + rules agree.
- Files: `firestore.rules:438-471`,
  `packages/functions-shared/src/context/ports.ts`, repos.
- Accept: no unprotected root-level writes; rules cover the used path.
- Deps: none.

**U2.3 — Remove dead flat `items` path + rules tidy**

- Scope: delete the parallel `spaces/{s}/items/{id}` rule block (D1 says flat is
  gone), after confirming no repo uses it.
- Files: `firestore.rules:320-342`.
- Deps: verify repos.

**U2.4 — `v2_` prefix rules strategy**

- Scope: rules are static and don't know `LVLUP_COLLECTION_PREFIX`; document +
  template the rules so a prefixed deploy is generated (or hardcode when a
  prefixed env goes live).
- Accept: a `v2_`-prefixed deploy has matching rules.
- Deps: none.

**U2.5 — Explicit deny-all for the ~20 server-only paths**

- Scope: add `allow read, write: if false;` blocks for the server-only
  collections currently protected only by absence (gamification, analytics, cost
  summaries, dead-letter, devices, announcements/reads, rubricPresets,
  questionBank, reviews, agents).
- Accept: defense-in-depth; no functional change (Admin SDK bypasses rules).
- Deps: none.

### PHASE 3 — Functions migration onto domain (the SSOT-retirement blocker)

**U3.x — Port legacy functions to `functions/sdk-v1` + `@levelup/domain`**
(split per domain)

- U3.1 identity · U3.2 levelup · U3.3 analytics · U3.4 autograde.
- Scope (each): move handlers off `@levelup/shared-types` onto
  domain/api-contract; the **timestamp boundary adapter (B8)** lands here — read
  Firestore Timestamps, serialize ISO strings out. Largest/riskiest unit; keep
  per-domain and behind the existing test suites (autograde e2e is green — use
  it as the guard).
- Accept: each function package has 0 shared-types imports, tests green,
  deployed.
- Deps: Phases 0–2. **This is where most tokens go — split aggressively.**

**U3.5 — Migrate `shared-*` packages + residual web-app shared-types imports**

- Scope: onto `@levelup/query`/domain; then delete `packages/shared-types`.
- Accept: repo-wide `shared-types` import count = 0; package removed.
- Deps: U3.1–U3.4.

### PHASE 4 — Deferred / polish

**U4.1 — DP-3: strip answer-bearing fields (E)** — remove
`isCorrect/correctAnswer/modelAnswer` from client-facing prompt schemas; verify
only server-only AnswerKey carries them. **U4.2 — Seed/v2 canonical validation
(F)** — validate all seed output against domain Zod; transform-migrate
`tenants/tenant_subhang` (SUB001) drift. **U4.3 — Media-lift unification** — one
explicit `mediaUrls` contract across all runners (remove reliance on server
`answer.mediaUrls` unwrap). **U4.4 — Watchdog pagination** — beyond
`.limit(50)`/tenant; emit metric on cap hit.

---

## 7. RISK CALLOUTS — what breaks existing data / deployed functions

| Risk                                     | Impact                                                                                             | Safe migration                                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dropping enum values (B1–B4, B6)**     | Legacy seeded docs (SUB001, deployed) with `completed`/`ocr_*`/`gcs`/`test` fail domain `.parse()` | **Widen-on-read, narrow-on-write:** keep a lenient read schema that maps legacy→canonical; only writes use the narrow set. Never deploy a narrowed read schema against un-migrated data. |
| **Timestamp switch (B8)**                | Every entity's `createdAt`/`updatedAt`; object-vs-ISO mismatch at every function↔SDK boundary      | Dedicated boundary adapter in Phase 3; migrate per-function, not big-bang; the autograde e2e suite pins hand-off shapes.                                                                 |
| **Scanners path change (U2.1)**          | Wrong path → scanner writes rejected (or currently silently unprotected)                           | Confirm repo path first; deploy rules + code together.                                                                                                                                   |
| **storyPointProgress divergence (U2.2)** | Root-level writes are currently **unprotected by rules**                                           | Verify actual repo usage before touching; align in one change.                                                                                                                           |
| **Deleting shared-types (U3.5)**         | Any missed import breaks build/deploy of legacy functions                                          | Gate on repo-wide import count = 0; do it strictly last.                                                                                                                                 |
| **`v2_` prefix (U2.4)**                  | Prefixed deploy with static rules → all writes fail                                                | Generate/template rules per prefix before enabling.                                                                                                                                      |
| **DP-3 strip (U4.1)**                    | Over-strip could hide fields authoring UIs need                                                    | Gate on authoring-role reads; keep `getItemForEdit` path intact.                                                                                                                         |
| **Cascade gaps**                         | `onSpaceDeleted` doesn't clean exam submissions; watchdog `.limit(50)` silent cap                  | Document; add coverage; not blocking Fable foundation.                                                                                                                                   |

---

## 8. ID SYSTEM (appendix)

- **42 branded IDs** — one factory `zBrandedId(brand)` + per-ID exports in
  `packages/domain/src/primitives/branded-id.zod.ts` (Firestore id constraint:
  1..1500 chars, no `/`). `z.infer<typeof zSpaceId>` = `SpaceId`.
- **`QUESTION_TYPE_REGISTRY`** (`entities/content/question-types/registry.ts`) —
  SSOT for 15 question types; the `QuestionType` enum, `zQuestionType`, 3
  discriminated unions, AUTO/AI arrays, and test fixtures all DERIVE from it.
  Adding a 16th type = one entry (compile-checked via `satisfies`). DP-3
  deferral: prompt schemas still carry answer fields (re-homed only).
- **`ROLE_DESCRIPTORS`** (`entities/identity/role-registry.ts`) — SSOT for
  tenant roles; `TENANT_ROLES`, `ROLE_RANK`, `isAuthoringRole`, `EntityIds`,
  `repoKeyForRole`/`idFieldForRole`, and per-role id fields on claims/membership
  all derive from it. `profileSchema` intentionally omitted (cycle avoidance).
  `ACCESS_RULES` stay manual (security decision).
- **Open:** `TestSessionId` vs `SessionId` both defined — pick canonical (U1.3).

---

## 9. Recommended execution order for Fable

`U0.1 → U0.2 → U0.3` (safe wins, live bug) → `U1.1 → U1.2 → U1.3` (enum SSOT) →
`U2.1 → U2.2 → U2.3 → U2.5 → U2.4` (rules) → `U3.1 → U3.2 → U3.3 → U3.4 → U3.5`
(functions migration + timestamp adapter, split hard) →
`U4.1 → U4.2 → U4.3 → U4.4` (deferred).

Foundational SSOT convergence (Phases 0–2) is small, surgical, and low-risk —
land it first. The functions migration (Phase 3) is the bulk of the work and the
true blocker for retiring `shared-types`; split it per-domain and lean on the
existing green test suites as guards.

---

## 10. FABLE ARCHITECTURAL DECISIONS (owner: Fable coordinator, 2026-07-04)

Binding decisions made by the data-model owner, grounded in first-hand code
reads. Workers execute these; they do not re-litigate them.

**AD-1 — Canonical test-session ID = `TestSessionId`.** `zSessionId`
(`primitives/branded-id.zod.ts:28`) is dead weight — used only by `brand.ts`
re-exports and the brand contract test, while `zTestSessionId` (`:42`) is
load-bearing in `entities/levelup/test-session.ts` and
`repositories/testsession-progress/*`. Action (U1.3): mark
`zSessionId`/`SessionId` `@deprecated` aliasing `TestSessionId`; no new usage.

**AD-2 — `Exam.evaluationSettingsId` (top-level,
`entities/autograde/exam.ts:68`) is canonical.**
`gradingConfig.evaluationSettingsId` (`exam.ts:37`, inside
`ExamGradingConfigSchema`) is `@deprecated`: still readable (legacy docs), never
written by new code; readers resolve top-level ?? nested.

**AD-3 — `Space.teacherIds` (`entities/levelup/space.ts:50`) becomes
`z.array(zTeacherId)`.** Types-only change; IDs are strings at rest so zero data
migration.

**AD-4 — Legacy enum read-adapters live in `packages/domain`** (e.g.
`src/enums/legacy.ts` or `src/legacy/`), NOT in repositories/functions-shared.
Precedent: domain already hosts the edge adapter for timestamps
(`primitives/timestamp.ts` `toTimestamp()` — canonical type + boundary collapse
in one place). Both `repositories` and the Phase-3 function migrations consume
the same widen-on-read schemas; duplicating them per-consumer is how drift
restarts. Shape: for each drifted enum export a `zLegacyX` lenient schema +
`normalizeX()` that maps legacy→canonical (`completed`→terminal,
`ocr_processing`→`scouting`, `ocr_failed`→ `scouting_failed`, `ocr`→`scouting`,
`gcs`→`scanner`, `test`→`timed_test`). Writes keep using the strict canonical
`zX`.

**AD-5 — The three question-type vocabularies stay SEPARATE.** (1) registry
canonical keys (`mcq/mcaq/true-false/…/group-options`), (2) grading tokens
(`DETERMINISTIC_TYPES`: `mcq/multi_select/…/grouping` — scorers branch on
these), (3) the legacy authoring map in `enums/content.ts`. Do NOT collapse
them. The binding invariant (locked by
`services/src/__tests__/grading.unit.test.ts`, U0.1): every
`AUTO_EVALUATABLE_TYPES` key must normalize into `DETERMINISTIC_TYPES`. Adding
an auto type = registry entry + `QT_TO_GRADING` entry + grading token + scorer
branch, and the test catches any gap.

**AD-6 — Domain enums are ALREADY canonical (verified 2026-07-04):** `exam.ts`
has no `completed`, `submission.ts` has no `ocr_*`, `grading.ts` has the
8-letter `{letter,min}` scale incl. `C+`, `misc.ts` has `web/scanner/rn`.
Therefore U1.1 = adapters + tests only (no enum edits), and U1.2 = migrating
`{min,grade}` READERS, not the scale itself.

**AD-7 — U1.2 scope = the new spine only** (`packages/repositories`
`autograde/dead-letter.ts`, `views/exam-analytics.ts`, `packages/services`).
`functions/autograde/src/utils/grading-helpers.ts` and shared-types' 7-letter
`GRADE_SCALE` stay untouched until U3.4/U3.5 — they are shared-types consumers
and migrate with their package.

**AD-8 — CI gate finding (U0.2):** `apps/admin-web` and `apps/parent-web` import
`@levelup/shared-types` type-only WITHOUT declaring the workspace dep — a real
turbo-graph bypass. Fix = declare the dep (so `^build` ordering applies) as part
of U0.2; the undeclared- import count must be zero before U3.5 can delete the
package.

**AD-14 — `tenants/{t}/assignments` collection (ratified post-hoc from LVL-2).**
No canonical field existed for assignment windows/visibility, so `assignContent`
writes BOTH the legacy classIds union on the space/exam AND a row at
`tenants/{t}/assignments/{type}_{contentId}_{classId}` (deterministic id ⇒
idempotent). Server-written via prefix-aware repos (lands under `v2_`, covered
by the AD-11 deny-all wildcards — no rules change needed); clients read ONLY
through the `getAssignmentMatrix` callable projection. Composite indexes added
in `firestore.indexes.json` (assignments-adjacent: platformActivityLog ×2,
versions) — deploy indexes BEFORE traffic on the LVL-2 train.

**AD-13 — Permission records are `z.partialRecord` (sparse-valid), not
exhaustive `z.record`.** Fixed by the domain owner 2026-07-04 (U3.1 escalation):
zod-4 `z.record(enumKeys, bool)` REQUIRES every enum key, so the v1 claim mint's
own sparse output (deliberate — Firebase's 1000-byte custom-claims budget)
failed `PlatformClaimsSchema.parse`. Flipped at 4 sites (`claims.ts`
permissions/staffPermissions, `membership.ts`
TeacherPermissions/staffPermissions) to `z.partialRecord`. Docs MAY still be
written exhaustive (SEED-1 does; partialRecord accepts both). Absent key
semantics = "no grant" — access checks must treat missing as false, never throw
on absence.

**AD-10 — Legacy `completed` exam status maps to `grading` on read (NEVER
`results_released`).** Legacy ordering is
`… grading → completed → results_released` — `completed` means
graded-but-unreleased. Mapping it forward to `results_released` would leak
results through `resultsReleased`-gated access (parents/students); mapping back
to `grading` is safe, self-heals on explicit release, and loses nothing at rest
(adapters never write).

**AD-11 — v2\_ client-rules posture = DENY-ALL (supersedes U2.4's templating
idea).** RUL-1 audit facts (2026-07-04, RUL-1-AUDIT-REPORT.md): the deployed
prefix IS `v2_` (`functions/sdk-v1/.env.lvlup-ff6fa`), so current rules never
match `v2_*` and prod client access is already deny-all — and the v1 stack is
100% callable/Admin-SDK served. Moreover a verbatim prefix-duplication of
today's autograde rules would EXPOSE answer keys: v1 stores examQuestions +
questionSubmissions FLAT in `exams`/`submissions` (via `_kind` discriminator)
and those docs carry answerKey/rubric-guidance/eval-cost, so the legacy
teacher/student/parent read grants must NOT be copied under `v2_`. Therefore
U2.4 is REDEFINED: add EXPLICIT `v2_`-scoped deny-all blocks (defense-in-depth,
merging U2.5's intent for autograde paths) + document the callable-only posture;
keep unprefixed rules serving the legacy stack until Phase 3 retires it. The
nested `exams/{id}/questions` and `submissions/{id}/questionSubmissions` rule
paths are dead in v1. CONSTRAINT: any future client-side Firestore
read/subscription against `v2_*` (e.g. a realtime feature in @levelup/query)
requires a projection design + domain-owner sign-off — never a blanket read
grant. No new composite indexes needed for v1 (equality-where +
orderBy(documentId) reads are auto-served).

**AD-12 — Client realtime = RTDB projections ONLY; firestore-backed client
subscriptions are retired.** Verified 2026-07-04: every firestore-backed entry
in `packages/transport-firebase/src/subscribe/subscription-sources.ts`
(spaceProgressLive, studentLevelLive, achievementUnlock, gradingStatus,
examGrading) hardcodes unprefixed `tenants/` with no prefix handling anywhere in
the package — on the `v2_` env they silently watch dead locations. Per AD-11 the
client Firestore surface on `v2_` stays deny-all, so the fix is NOT prefix-aware
paths + new allow rules; it is converging on the already-working RTDB pattern
(leaderboardLive, notification.badge): server pipeline writes a MINIMAL
projection (status/progress only — never answer keys, rubric guidance, or
unreleased scores) to an RTDB node, and the subscription entry flips to
`backend:"rtdb"`. Autograde pair (gradingStatus, examGrading) = AG-5 (Autograde
tree, signed off); levelup trio (spaceProgressLive, studentLevelLive,
achievementUnlock) = U2.6 in the Platform tree. End state: `transport-firebase`
contains ZERO firestore-backed subscriptions and needs no prefix awareness; the
duplicated client-side Firestore path templates are deleted. _Concrete RTDB
convention (established by AG-5's `gradingProgress` root in
`database.rules.json`, 2026-07-04 — U2.6 tickers inherit verbatim):_ own
top-level root per feature, `{$tenantId}`-scoped, `.write: false` throughout
(Admin-SDK writes only), server-only sibling nodes (e.g. `ownerStudentId`,
`_index`) never granted read, client reads ONLY the payload leaf
(`status`/`agg`), and every read gate includes the
`auth.token.isSuperAdmin === true` bypass plus
`auth.token.tenantId === $tenantId` scoping with role literals
`teacher`/`staff`/`tenantAdmin` (+
`auth.token.studentId === data.parent().child('ownerStudentId').val()` for
owner-scoped student reads). _Fifth sub (found by U2.6, missed by the original
audit):_ `v1.levelup.chatStream` — LANDED via CHAT-1 (2026-07-05) with the
locked **bump-node pattern**: the chat write path (`sendChatMessage` →
`projectChatBump` on the U2.6 `LevelupProjectionPort` seam) bumps a minimal
`chatBump/{t}/{userId}/{sessionId}` = `{rev: increment, lastMessageAt}` node
(uid-in-path owner gate, the `notifications/{t}/{u}` convention — owner-only +
super-admin, NO teacher/staff grants: chat is USER-owned per AD-9); message
CONTENT never duplicates into RTDB; `useChatStream` debounce-invalidates
(~250ms) `chatKeys.detail(sessionId)` so the active `useChatSession` refetches
`getChatSession` (signal-over-RTDB, data-over-callable). **AD-12 END STATE
REACHED:** `transport-firebase` has ZERO firestore-backed subscriptions —
`subscribe-via-firestore.ts`, the `FirestoreSourceDescriptor`/`FirestoreTarget`/
`QueryConstraintSpec` types and the dispatcher's firestore branch are DELETED,
the contract's `SubscriptionSource` union is narrowed to `"rtdb-node"`, and
`FirebaseTransportServices.db` is optional/unread. The sdk-v1 bootstrap now
wires BOTH RTDB projection adapters whenever `FIREBASE_DATABASE_EMULATOR_HOST`
is set (not just prod), so the AD-12 channels are emulator-e2e-testable
(`tests/sdk/integration/identity-levelup/chat-bump-live.test.ts`).

**AD-9 — ID naming convention (to document in U1.3):** `uid` = Firebase Auth UID
(User, UserMembership, claims). `userId` = FK to User on user-owned records
(`SpaceProgress`, `DigitalTestSession`, `ChatSession` — deliberately NOT
`studentId`: learning progress belongs to the user across role changes).
Role-entity IDs (`studentId`, `teacherId`, …) appear only where the ROLE entity
is the subject (Submission.studentId — an exam submission is a student act).
`authUid` is not a canonical field name; migrate on touch.
