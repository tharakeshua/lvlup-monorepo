# Data-Model Review — Auto-LevelUp Rebuild

**Reviewer:** data-model reviewer (sess_1781951879638_7p7y3h7cr) · feeds
SDK+Server design (parent task) **Scope:** review only — no SDK/server redesign.
**Sources verified:** `docs/rebuild-spec/specs/domain-and-data.md`; live
`packages/shared-types/src/**`; `firestore.rules`; `firestore.indexes.json`;
`functions/{levelup,identity,autograde}/src/callable/{save-space,create-org-user,upload-answer-sheets}.ts`;
all 6 `status/*.md`.

**Bottom line:** The _spec_ is coherent and largely correct — it is a faithful,
well-reasoned cleanup of the live model. The _live_ model it targets is
materially behind the spec on almost every axis (no Zod-first, no branding on
persisted shapes, `FirestoreTimestamp`/epoch/ISO timestamp trichotomy,
`.passthrough()` schemas, dual item paths, `Record<X>` relation maps, three
field-name schisms). The single biggest issue for an **untrusted client SDK** is
that `tenantId` is currently taken from the **request body**, not from claims,
in the live callables — the spec fixes this conceptually (§5.1) but the rebuild
must make it non-negotiable.

---

## 1. Identity spine (UnifiedUser → UserMembership → PlatformClaims)

**Coherent? Yes — the 3-layer design is sound and the right shape.** Global user
at `/users/{uid}`, one `UserMembership` per `(user,tenant)` keyed
`{uid}_{tenantId}`, claims as the rules hot-path projection. The "exactly one
entity link by role" rule on membership (spec §4.3) is the correct
normalization.

**Claims projections — correct but with real safety gaps (live vs spec):**

- **`isSuperAdmin` is NOT a claim today.** Live `PlatformClaims`
  (`identity/claims.ts:15-29`) has no `isSuperAdmin`. `firestore.rules:10-13`
  resolves super-admin via a **`get()` on `/users/{uid}`** every evaluation — a
  per-rule document read and a latency/cost hit. Spec §8.3 correctly promotes it
  to a claim; **must** land.
- **`permissions` lose their types.** Live claims use
  `permissions?: Record<string, boolean>` /
  `staffPermissions?: Record<string, boolean>` (`claims.ts:27-28`). Rules index
  these stringly (`firestore.rules:65,77`). Spec §8.2/§8.3
  (`Partial<Record<TeacherPermissionKey,boolean>>` + exported key enums) is
  correct and should be enforced so rules-gen and TS share one key list.
- **`classIds` cap exists as a constant but is not type-enforced.**
  `MAX_CLAIM_CLASS_IDS = 15` + `classIdsOverflow` are present (`claims.ts:9,25`)
  — good — but nothing in the type prevents overflow; depends on the (currently
  drift-prone) sync code.
- **No branded IDs in claims** — `tenantId/teacherId/studentId/classIds` are
  bare `string`/`string[]` (`claims.ts:18-26`). Spec §8.3 brands them.

**Spine integrity risks the spec already flags and I confirm:**

- **Three divergent membership-creation paths** (status be-identity §4.3):
  `createOrgUser` builds membership + entity inline ad-hoc
  (`create-org-user.ts:126-203`), `save*` create, and `joinTenant` (which
  creates a student membership with **no `/students/{id}` doc and no
  `studentId`**). Spec's single `provisionMembership` factory (§4.3) is the
  right fix.
- **`onUserCreated` trigger vs `createOrgUser` write divergent user shapes**
  (be-identity §4.4): trigger writes `authProviders:[]` (matches type);
  `createOrgUser` historically writes singular `authProvider` and omits
  `status`. Live `UnifiedUser` already standardizes on
  `authProviders: AuthProvider[]` (`identity/user.ts:47`) — keep, kill the
  singular.
- **No transactional integrity / no idempotency keys** across the multi-write
  provisioning flow (be-identity §4.5, §4.13). This is a data-integrity concern
  the SDK/server design must own (mutating callables can double-create on
  retry).

---

## 2. Unified content core (UnifiedItem / UnifiedRubric / UnifiedEvaluationResult)

**Genuinely shared — no fork. This is the platform's best-built part and the
spec is right to double down.**

- `QuestionSubmission.evaluation` imports the **shared**
  `UnifiedEvaluationResult` from `content/evaluation.ts`
  (`autograde/question-submission.ts:8,35` — comment "uses SHARED"). LevelUp
  `DigitalTestSession.TestSubmission.evaluation` embeds the same type
  (`levelup/test-session.ts:34`). One grading-output shape, both domains. ✓
- `ExamQuestion.rubric` and `SubQuestion.rubric` import the **shared**
  `UnifiedRubric` from `content/rubric.ts`
  (`autograde/exam-question.ts:8,14,30`). `EvaluationSettings.enabledDimensions`
  reuses shared `EvaluationDimension` (`autograde/evaluation-settings.ts:8`). ✓
- Cross-domain link is **bidirectional and consistent**:
  `ExamQuestion.linkedItemId` (`exam-question.ts:37`) ↔
  `UnifiedItem.linkedQuestionId` (`content/item.ts:387`). Exam→Space/StoryPoint
  links (`exam.ts:54-56`) are one-directional (acceptable).

**Leaks / weaknesses inside the shared core (real, must be addressed):**

- **`UnifiedItem.payload` is NOT a true discriminated union.** It is a plain TS
  union `QuestionPayload | MaterialPayload | …` (`content/item.ts:324-331`) with
  **no shared discriminant key** (each member tags differently: `questionType`,
  `materialType`, …). It does not narrow on a common tag and — critically — **is
  never validated on write**:
  `SaveItemRequestSchema.data.payload = z.record(z.string(), z.unknown())`
  (status be-levelup §4.3). Spec §4.3 (real `z.discriminatedUnion`, validated at
  write) is the single most important content-core fix. Bad payloads currently
  persist silently.
- **Rubric is embedded by value, not referenced.** Live
  `UnifiedItem.rubric?: UnifiedRubric` (`content/item.ts:384`) and
  `RubricPreset.rubric` (`content/rubric-preset.ts:29`) store full rubric
  objects; there is **no `rubricId`** on the item. The spec §4.3 says
  `rubricId?` + "resolved rubric stored on item at save time" (§6.4) — this is a
  **drift the rebuild must reconcile**: decide embed-resolved-copy vs
  id-reference (the spec text is internally slightly ambiguous: §4.3 shows
  `rubricId?: string` while §6.4 says persist the effective rubric). Recommend:
  store both an `effectiveRubric` snapshot **and** the source `rubricId` for
  traceability.
- **`UnifiedRubric` has no resolution-chain field.** The
  `tenant→space→storyPoint→item` chain (`content/rubric.ts:60-62`) is a doc
  comment only; resolution is positional. Live `resolveRubric` does up to 4
  sequential reads at grade time (be-levelup §4.9). Spec §6.4
  (resolve-and-store-at-write) fixes this.
- **No Zod schema for the standalone shared types.** `UnifiedRubric`,
  `UnifiedEvaluationResult`, `ItemMetadata`, `RubricPreset` are pure interfaces;
  the `UnifiedItem` schema exists but `.passthrough()` + payload-as-`z.record`
  (see §4).

---

## 3. Spec-vs-live DRIFT (concrete, with file:line)

| #   | Concern                             | Spec says                                                             | Live reality                                                                                                                                                                                                                                                                                                                                                | Evidence                                     |
| --- | ----------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| D1  | **Items path**                      | ONE canonical nested `/spaces/{s}/storyPoints/{sp}/items/{id}` (§4.2) | **Dual paths.** Writer/reader use **FLAT** `/spaces/{s}/items` filtered by `storyPointId` (`save-space.ts:300-304`). Rules carry **both** flat (`firestore.rules:320-342`) and nested (`:296-317`) blocks. `saveStoryPoint` DELETE only queries flat → **orphans nested items**; `onSpaceDeleted` only iterates flat → incomplete cascade (be-levelup §4.1) | save-space.ts:300; rules:296/320             |
| D2  | **tenantId source**                 | From `request.auth.token.tenantId`, path-scoped (§5.1)                | **From request BODY** in all 3 callables: `save-space.ts:38`, `upload-answer-sheets.ts:24`, `create-org-user.ts`. Authorization then checks body tenantId against caller                                                                                                                                                                                    | save-space.ts:38-44                          |
| D3  | **Auth-link field**                 | `authUid` only, never `uid` (§6.2)                                    | **Schism.** `create-org-user.ts:122` writes `uid`; `Student` type still `uid` (`tenant/student.ts:15`); `Teacher`/`Parent` have `authUid` + `@deprecated uid` (`teacher.ts:11-13`, `parent.ts:11-13`); readers/rules expect `authUid` (`save-space.ts:336`, `rules:227`). Writer↔reader mismatch is live                                                    | tenant/student.ts:15; create-org-user.ts:122 |
| D4  | **Timestamps**                      | ISO-8601 string only (§2.3)                                           | **Trichotomy.** `FirestoreTimestamp` `{seconds,nanoseconds}` for audit (`identity/user.ts:11-16`); **epoch-millis `number`** for progress/attempts (`progress.ts` `lastUpdatedAt`,`AttemptRecord.timestamp`; `test-session.ts:30` `submittedAt`); **ISO string** for chat (`chat.ts:15`). `progress.ts` mixes number + FirestoreTimestamp in one module     | identity/user.ts:11; chat.ts:15              |
| D5  | **Soft-delete**                     | ONE `archivedAt: Timestamp\|null` (§6.1)                              | **Three conventions.** `status:'active'\|'archived'` on entities; `deleted: boolean` on `saveStoryPoint`/`saveItem` requests (`callable-types.ts:350,384`); stray `'deleted'` status in `SaveClassRequest` (`callable-types.ts:79`). No `archivedAt` on most entities                                                                                       | callable-types.ts:79,350,384                 |
| D6  | **Record-maps-as-relations**        | subcollections (§4.1 rule 1)                                          | Live maps: `SpaceProgress.storyPoints`, `StoryPointProgressDoc.items` (`progress.ts:123,149`), `DigitalTestSession.{submissions,visitedQuestions,markedForReview}` (`test-session.ts:88-90`), `ExamAnalytics.questionAnalytics`, `DailyCostSummary.byPurpose/byModel`. 1 MB-doc risk on big tests (be-levelup §4.11)                                        | test-session.ts:88-90; progress.ts:123       |
| D7  | **FK arrays**                       | junction subcollections authoritative (§4.1 rule 2, §7)               | Dual-write FK arrays are the only link: `Space.classIds` (`space.ts:40`), `Class.studentIds↔Student.classIds`, `Student.parentIds↔Parent.studentIds`. No junctions exist                                                                                                                                                                                    | space.ts:40; student.ts:21,23                |
| D8  | **Branded IDs on shapes**           | every persisted ID field branded (§3)                                 | **Zero.** Every ID in every entity is bare `string` (all of content/, levelup/, autograde/, progress/, tenant/, identity/)                                                                                                                                                                                                                                  | content/item.ts:355-359                      |
| D9  | **Zod-first**                       | schema authored first, type `z.infer`, `.strict()` (§2.1, §10.2)      | **Inverted & passthrough.** Interfaces hand-written; schemas separate in `schemas/index.ts`; **all ~38 schemas `.passthrough()`**; one-directional assert `Interface extends SchemaType` at `schemas/index.ts:1319-1407` (catches only missing fields, not extras/wrong-types)                                                                              | schemas/index.ts:57…1407                     |
| D10 | **Parent→child link**               | `parentLinkedStudentIds` only (§6.2, §7.3)                            | **Triple naming:** entity `childStudentIds` (`create-org-user.ts:152`, `parent.ts:21`), membership `parentLinkedStudentIds` (`membership.ts:117`), claim/rules `studentIds` (`rules:165,445`). `SaveParentRequest` still takes `childStudentIds` (`callable-types.ts:136`)                                                                                  | parent.ts:19-21                              |
| D11 | **Scanner location**                | tenant-scoped `/tenants/{t}/scanners/{id}` + matching rule (§7.4)     | Written tenant-scoped (`create-org-user.ts:163`) with field `uid`; **only rule is top-level `/scanners/{id}`** matching `authUid` (`rules:224-231`) → written docs have no matching rule (default-deny)                                                                                                                                                     | rules:224; create-org-user.ts:163            |
| D12 | **Schema↔interface known drifts**   | inversion deletes the drift class (§11.1)                             | Live: `ChatMessage.timestamp` string vs schema `FirestoreTimestamp`; `Agent.rules` single-string vs schema `array`, `Agent.isActive` missing; `DigitalTestSession` `sessionType/serverDeadline` vs schema `type/deadline`; `Notification.recipientId` vs schema `recipientUid`; `Submission` uploadSource `'gcs'` not in union (domain-model §4.A)          | domain-model §4.A                            |
| D13 | **costSummaries / analytics paths** | one consistent path; rules cover them (§4.2)                          | No `costSummaries` index; **no rules** for `studentProgressSummaries`, `classProgressSummaries`, `examAnalytics`, `costSummaries`, `insights` (be-analytics) → default-deny vs frontends that read summaries directly                                                                                                                                       | indexes.json; be-analytics                   |
| D14 | **Legacy collection groups**        | retired after migration (§4.2)                                        | Indexes still cover `items`(flat+nested share name), `testSessions` **and** `digitalTestSessions`, `progress` **and** `spaceProgress`; `order` **and** `orderIndex` both indexed; spaceProgress index keys `studentId` but rule reads `userId`                                                                                                              | indexes.json                                 |

---

## 4. Branded-ID coverage + Zod-schema-first inversion

**Branded IDs:** `branded.ts` defines **16** brands + `Brand<T,B>`. **Missing
the 3 the spec adds:** `StaffId`, `ScannerId`, `ExamQuestionId` (spec §3). Note:
spec §3 claims `asNotificationId`/`asQuestionBankItemId` factories are
_unexported_ — **stale**: they ARE exported today (`branded.ts:90-91`). The real
gap (status §4.J, confirmed) is that brands **evaporate inside persisted
shapes** — every entity field is bare `string`; brands appear only at some
function signatures.

**Zod coverage:**

- Schemas exist for ~38 entities (`schemas/index.ts`): Tenant, Class, Student,
  Teacher, Parent, AcademicSession, Space, StoryPoint, Agent,
  ChatMessage/Session, DigitalTestSession, Exam, Submission, ExamQuestion,
  QuestionSubmission, Notification, UnifiedUser, UserMembership, UnifiedItem,
  SpaceProgress, QuestionBankItem, SpaceReview, AnswerKey, EvaluationSettings,
  GradingDeadLetter, ExamAnalytics, Student/ClassProgressSummary,
  LearningInsight, LLMCallLog, Achievement, StudentAchievement, StudentLevel.
- **Entities with NO schema** (status §4.K, confirmed): `RubricPreset`,
  `ContentVersion`, `StudyGoal`, `StudySession`, `Announcement`,
  `PlatformActivityLog`, `HealthSnapshot`, `NotificationPreferences`, plus
  standalone `UnifiedRubric`/`UnifiedEvaluationResult`/`ItemMetadata` (only
  embedded, never validated independently), `StoryPointProgressDoc` items,
  `DailyCostSummary`.
- **`.strict()` risk inverted today:** every schema is `.passthrough()` (≈40
  occurrences). This **silently keeps** unknown/renamed fields — the exact
  mechanism that lets D12 drifts survive. The assertion block (`:1319-1407`)
  only checks `Interface extends SchemaType` (one direction): a field present in
  the interface but **typed differently** in a passthrough schema is NOT caught.
  Spec §10.2 (`.strict()`) + §2.1 (single source via `z.infer`) is correct and
  is the highest-leverage validation fix.
- **Double source of truth:** `callable-types.ts` (`*Request` interfaces) is
  maintained separately from `schemas/callable-schemas.ts` (749 lines) with
  `_Assert*Compat` shims — same drift risk on the request boundary.

---

## 5. Multi-tenant isolation correctness

- **Path-scoped model is correct** (`/tenants/{tenantId}/…`) and rules enforce
  `request.auth.token.tenantId == tenantId` via `belongsToTenant`
  (`rules:16-19`) — good defense-in-depth wall.
- **BUT the authoritative scoping input is wrong today:** callables derive
  `tenantId` from the **request body** (D2), so isolation rests entirely on the
  per-callable authorization check + rules. Spec §5.1's "repository-layer guard
  validates tenantId scoping before any read/write" is necessary; the rebuild
  must make tenantId **claim-derived, never client-supplied** for tenant-scoped
  ops (a B2C/`switchActiveTenant` exception aside).
- **Junctions vs FK arrays:** live uses FK arrays only (D7); no
  `classStudents`/`classTeachers`/`spaceClasses` junctions exist. Membership
  changes are 2 unsynchronized writes (domain-model §4.C). Spec §7 junction
  model is correct; the denormalized arrays must become trigger-maintained
  projections, not the source of truth.
- **Parent→child linkage** (spec §7.3): rules read `token.studentIds`
  (`rules:445`) but `studentProgressSummaries` has **no rule at all** and
  `questionSubmissions` read rule **excludes parents** (`rules:419-424`). Spec
  §7.3 correctly adds both; this is a present functional gap (parent app can't
  read child progress through rules).
- **Scanner model** is half-orphaned (D11) — the spec §7.4 unification
  (tenant-scoped + matching rule + `authUid`) is correct; pick tenant-scoped and
  delete the top-level rule.
- **Server-only AnswerKeys: correct and verified.** `answer-key.ts` is
  server-write-only; rules deny all client reads/writes under **both** item
  paths (`rules:314-316, 339-341` `allow read, write: if false`). Admin-SDK
  only. ✓ (One stale note: `answer-key.ts` docstring path says
  `storyPoints/{sp}/answerKeys/{itemId}` but live writer stores under
  `items/{itemId}/answerKeys/{keyId}` auto-id — be-levelup §4.6.)
- **Composite keys** (`{uid}_{tenantId}`, `{userId}_{spaceId}`) are fine but
  fragile if IDs ever contain `_`; spec §4.4 keeps them + explicit fields
  (already present) — acceptable.

---

## 6. SECURITY / AUTHORITY boundary for an UNTRUSTED client SDK

Everything below **must remain server-authoritative** — not derivable from,
writable by, or trustable-from the client SDK:

1. **`tenantId` for any tenant-scoped operation** — derive from verified claims,
   never accept from SDK body (fixes D2). This is the #1 boundary.
2. **All of `PlatformClaims`** — role, permissions, `isSuperAdmin`, `classIds`,
   `studentIds`, entity IDs. Minted server-side via Admin SDK only; SDK reads
   them but cannot set/influence them. Token revocation on lifecycle change must
   be server-driven (spec §8.5).
3. **`UserMembership` docs** (`/userMemberships/*`) — Admin-SDK write only; the
   SDK must never create/edit role, status, permissions, or
   `parentLinkedStudentIds`.
4. **`AnswerKey` subcollection** — never readable/writable by clients
   (correct/auto-correct answers, model answers). Keep deny-all (verified §5).
5. **Grading outputs** — `UnifiedEvaluationResult` (score, correctness,
   confidence, cost), `QuestionSubmission.evaluation`, `ManualOverride`,
   `DigitalTestSession.TestSubmission.evaluation`. The SDK submits answers; the
   **server** computes/writes scores. Client must not write its own score or
   read the answer key to self-grade.
6. **`DigitalTestSession` authority fields** — `serverDeadline`, `isLatest`,
   attempt counts, question states, adaptive ordering. Server-authoritative
   session (spec §1.3); deadline/clock from server (`/serverTimeOffset`), never
   client clock.
7. **Rubrics & answer guidance** — `UnifiedRubric.modelAnswer`,
   `evaluatorGuidance`, `EvaluationDimension.promptGuidance`,
   `EvaluationSettings` thresholds. Reading these client-side leaks how to
   score; gate to authoring roles only.
8. **`consumerProfile.enrolledSpaceIds` / purchases** — mutable only by
   `purchaseSpace` CF (spec §5.2); SDK must not self-enroll. (Live
   `purchaseSpace` is a stub — be-levelup §4.12.)
9. **Denormalized counters/aggregates** — `Tenant.stats/usage`,
   `Space.stats/ratingAggregate`, all `*ProgressSummary` docs.
   Trigger-maintained, recomputable; SDK reads, never writes (spec §6.3).
10. **Exam/submission lifecycle status** — `EXAM_STATUSES`,
    `SUBMISSION_PIPELINE_STATUSES`, `resultsReleased`, results-release gating.
    Pipeline transitions server-only; results visibility gated on
    `resultsReleased` server flag.
11. **Cross-domain link integrity** —
    `linkedItemId/linkedQuestionId/linkedSpaceId` existence-validated
    server-side (spec §10.4); SDK can request a link but server validates the
    referent exists in-tenant.
12. **Pre-auth tenant lookup** — today `/tenants/{t}` and `/tenantCodes/{code}`
    allow unauthenticated `get` (`rules:133,149`) → ID-enumeration leak of
    tenant existence/branding. Spec §8.6 moves this behind a dedicated callable
    returning only `{tenantId,name,status,branding}`; the SDK's pre-auth surface
    must expose nothing more.
13. **Storage** (out of firestore.rules but in-boundary): status auth-access
    §4.1 — blanket `if request.auth != null` lets any authed user read/overwrite
    any tenant's answer sheets/exports. Must become per-path
    tenant+role+ownership scoped before an untrusted SDK ships.

---

## 7. Top 10 ranked risks / open questions

1. **`tenantId` from request body, not claims (D2).** Foundational authority bug
   for an untrusted SDK; everything in §6 depends on fixing it. _(Open Q: is
   body-tenantId ever legitimately needed for super-admin cross-tenant ops, and
   how is that special-cased?)_
2. **Storage blanket rule** (auth-access §4.1) — cross-tenant read/overwrite of
   answer sheets & exports. Highest _current_ security exposure.
3. **`payload` never validated on write** (D-content; be-levelup §4.3) —
   `z.record(unknown)` lets malformed/abusive content persist; corrupts grading
   and analytics downstream. Needs real discriminated union + `.strict()`.
4. **Dual item path + orphan-on-delete (D1).** Data-integrity time bomb: deletes
   leave dangling items; cascade is incomplete; two code paths to keep in sync
   forever.
5. **`.passthrough()` everywhere + one-directional asserts (D9).** The drift
   _generator_. Until inverted to Zod-first `.strict()`, every other field-name
   fix can silently regress.
6. **Three field-name schisms** — `uid`/`authUid` (D3),
   `childStudentIds`/`parentLinkedStudentIds`/`studentIds` (D10), and rules vs
   index identity (`studentId` vs `userId` on spaceProgress). Writer↔reader↔rule
   mismatches cause silent access failures _now_.
7. **Missing rules for materialized analytics** (D13) —
   `studentProgressSummaries`/`classProgressSummaries`/`examAnalytics`/`insights`/`costSummaries`
   have no rules; parent can't read child progress (§5). Either a functional gap
   or undocumented callable-only reliance — must be decided explicitly.
8. **`isSuperAdmin` via `get()` + no token revocation** (auth-access §4.4-4.5) —
   per-rule doc read; suspended/role-changed users keep valid claims ~1h.
   Promote to claim + `revokeRefreshTokens`.
9. **Timestamp trichotomy (D4)** — FirestoreTimestamp/epoch/ISO across modules
   (even within `progress.ts`). Blocks the transport-neutral/REST/RN goal and
   complicates the SQL migration target; needs a single ISO convention + edge
   adapter.
10. **Record-map relations & 1 MB doc risk (D6)** —
    `DigitalTestSession`/`SpaceProgress` fat docs rewritten every attempt;
    unbounded growth on large tests. Explode into subcollections (spec §4.1).

**Open questions for the SDK/server design to resolve:**

- Rubric on item: **id-reference vs embedded resolved snapshot** — spec §4.3 vs
  §6.4 are slightly inconsistent. Recommend snapshot + source id.
- Is the **OCR pipeline stage live or dead?** `ocr_*` statuses +
  `DeadLetterPipelineStep='ocr'` persist but no OCR stage exists (be-autograde).
  Drop or wire.
- **`'completed'` exam status** is unreachable (be-autograde) — remove from
  `EXAM_STATUSES` or define its semantics vs `results_released`.
- Should `ALLOWED_TRANSITIONS` state machines be **data** (build-time checked,
  spec §10.3) — none exists today.
- `joinTenant` lazy `/students/{id}` creation (spec §4.3 note) — confirm the SDK
  never assumes an entity doc exists for code-joined students.
