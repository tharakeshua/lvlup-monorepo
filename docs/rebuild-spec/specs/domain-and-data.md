# Domain Model & Data Architecture — Fresh-Build Spec

> Part of the Auto-LevelUp fresh-build specification. Scope: canonical domain
> model, branded IDs, the persisted data model (collections/tables),
> multi-tenant isolation, and the role-based access/permission model.
> Source-of-truth references: `packages/shared-types/src/**`, `firestore.rules`,
> `firestore.indexes.json`, `docs/DOMAIN_SQL_MODEL.md`, and the status reports
> `status/domain-model.md`, `status/auth-access.md`, `status/be-identity.md`.

---

## 0. Goals & non-negotiables

This section defines the single domain layer shared by **every** consumer: the 5
web apps (teacher / student / admin / super-admin / parent), the planned
**scanner** app, all Cloud Functions, and **future React Native apps**. The
domain package is the contract between them all.

**Hard requirements carried into the rebuild:**

1. **Preserve every core concept** from the current system (enumerated in §1).
   Nothing is dropped; the work is structural cleanup, validation hygiene, and
   transport-neutrality — not re-conceptualization.
2. **One canonical domain package** (`@levelup/domain`, formerly `shared-types`)
   that is **pure TypeScript with zero Firebase/runtime coupling** so RN, web,
   and functions import identical types.
3. **Zod schemas are the source of truth**; TS types are derived via `z.infer`.
   This structurally eliminates the schema-vs-interface drift class that the
   current `extends`-assertion harness misses (see status §4.A).
4. **Transport-neutral primitives** — no `FirestoreTimestamp` in the domain;
   ISO-8601 strings on the wire. Mandatory for a REST/JSON API and RN.
5. **One API contract** derivable from the domain package (consumed by the
   API-layer spec): the consolidated `save*` upsert pattern + unified error
   model survive verbatim.
6. **Defense-in-depth access model**: server-side authorization is
   authoritative; Firestore/Storage rules are a second wall generated from the
   same policy source.

---

## 1. Core concepts preserved (the conceptual inventory)

Every concept below exists today and **must survive** the rebuild. Improvements
are structural only.

### 1.1 Identity & multi-tenancy

- **Three-layer identity spine**: global `UnifiedUser` (`/users/{uid}`) →
  per-tenant `UserMembership` (one role per `(user, tenant)`) → cached **custom
  JWT claims** (`PlatformClaims`) read on the rules hot path.
- **Seven roles** (`TenantRole`):
  `superAdmin | tenantAdmin | teacher | student | parent | scanner | staff`.
- **Minimal claims with overflow fallback**: `MAX_CLAIM_CLASS_IDS = 15` +
  `classIdsOverflow` flag degrading to a membership-doc read, to stay under the
  ~1 KB JWT cap.
- **Multi-tenant context switching**: one active tenant in the JWT at a time
  (`switchActiveTenant` + forced token refresh).
- **Granular permission maps**: `TeacherPermissions` (8 booleans +
  `managedSpaceIds`/`managedClassIds`) and `StaffPermissions` (6 booleans).
- **Tenant code** uniqueness index for pre-auth school-code login + self-join
  (`joinTenant`).
- **B2C consumer profile** coexisting on the same `UnifiedUser` as B2B tenant
  memberships.

### 1.2 Unified content core (the platform's best idea — keep and double down)

- **`UnifiedItem`**: one content atom — **7 top-level types**
  (`question | material | interactive | assessment | discussion | project | checkpoint`),
  **15 question subtypes**, **7 material subtypes** — with a discriminated
  `payload`. `AUTO_EVALUATABLE_TYPES` (9) vs `AI_EVALUATABLE_TYPES` (6)
  partition.
- **`UnifiedRubric`**: 4 scoring modes
  (`criteria_based | dimension_based | holistic | hybrid`) with a
  resolution/inheritance chain `tenant → space → storyPoint → item` (LevelUp)
  and `tenant → exam → question` (AutoGrade).
- **`UnifiedEvaluationResult`**: the single grading-output shape shared by
  AutoGrade `QuestionSubmission.evaluation` **and** LevelUp
  `DigitalTestSession`.
- **Cross-domain linkage**:
  `UnifiedItem.linkedQuestionId ↔ ExamQuestion.linkedItemId`;
  `Exam.linkedSpaceId / linkedStoryPointId`.

### 1.3 LevelUp (digital learning)

- Hierarchy **Space → StoryPoint → UnifiedItem**, with `sections`, Bloom's
  levels, topics/labels.
- **AssessmentConfig** (adaptive selection, schedule, retry/cooldown,
  lock-after-passing).
- **Server-authoritative `DigitalTestSession`** with deadline, 5-state question
  taxonomy, shuffle/adaptive ordering, max-attempts/one-attempt enforcement,
  per-question time tracking.
- **Two-tier progress** (space-level summary + per-story-point doc + per-item
  attempts).
- **Agent** personas (tutor/evaluator), **ChatSession** AI tutoring,
  **QuestionBank**, **server-only AnswerKey** subcollection (invisible to
  clients), **SpaceReview** + rating aggregate, **ContentVersion** history,
  **RubricPreset**.
- **B2C store**: `platform_public` tenant mirror, `accessType: public_store`,
  `purchaseSpace`.
- **Gamification**: levels/XP/streaks, achievements, study goals/sessions,
  leaderboards (RTDB).

### 1.4 AutoGrade (physical-exam grading)

- Hierarchy **Exam → ExamQuestion** (+ `SubQuestion`); **Submission →
  QuestionSubmission**.
- **Two-stage AI pipeline**: Panopticon page→question scouting then RELMS
  per-question grading.
- **15-state submission pipeline** + **7-state question grading** + **8-state
  exam lifecycle**.
- **Confidence-based human-in-the-loop** routing (needs-review / auto-approve /
  review-suggested) + `ManualOverride`.
- **EvaluationSettings** (enabled dimensions, confidence config, usage quota),
  **GradingDeadLetterEntry** DLQ, **ExamAnalytics**.

### 1.5 Cross-system progress & analytics

- **`StudentProgressSummary`** / **`ClassProgressSummary`** merging AutoGrade +
  LevelUp metrics, at-risk detection, `LearningInsight` engine.
- **LLM cost/usage** (`DailyCostSummary`, `LLMCallLog`), platform activity log,
  health snapshots.

### 1.6 Cross-cutting contracts

- **17 branded ID types** + `Brand<T,B>`.
- **`as const` enums** (`SUBMISSION_PIPELINE_STATUSES`,
  `QUESTION_GRADING_STATUSES`, `EXAM_STATUSES`, `BLOOMS_LEVELS`,
  `GRADE_THRESHOLDS`).
- **Consolidated `save*` upsert API** (id absent = create, id present = update).
- **Unified error model**: `AppErrorCode` ↔ HTTP maps, `ERROR_MESSAGES`,
  `ERROR_RECOVERY_HINTS`, `RATE_LIMITS` tiers (WRITE/READ/AI/AUTH/REPORT).
- **Notifications**: in-app doc + RTDB badge state + `Announcement`
  (platform|tenant scope).

---

## 2. Package & layering decisions

### 2.1 `@levelup/domain` (the canonical package, replaces `shared-types`)

```
packages/domain/src/
  branded.ts                 # 17 branded IDs + Brand<T,B> + ALL factory exports
  primitives.ts              # transport-neutral Timestamp, money, pagination, audit fields
  enums/                     # as-const arrays + derived unions (grades, statuses, blooms)
  identity/                  # UnifiedUser, Tenant(+subdocs), UserMembership, PlatformClaims, TenantCode
  tenant/                    # Class, Student, Teacher, Parent, Staff, Scanner, AcademicSession
  content/                   # UnifiedItem (+15 q-types, +7 mat-types), UnifiedRubric, UnifiedEvaluationResult, ItemMetadata, RubricPreset
  levelup/                   # Space, StoryPoint, Agent, DigitalTestSession, SpaceProgress*, ChatSession, QuestionBank, AnswerKey, SpaceReview, ContentVersion
  autograde/                 # Exam, ExamQuestion, Submission, QuestionSubmission, EvaluationSettings, GradingDeadLetter, ExamAnalytics
  progress/                  # StudentProgressSummary, ClassProgressSummary, LearningInsight, at-risk
  gamification/              # Achievement, StudentLevel, StudyGoal, StudySession
  notification/              # Notification, NotificationPreferences, Announcement, NotificationRTDBState
  analytics/                 # LLMCallLog, PlatformActivityLog, HealthSnapshot, DailyCostSummary
  error-types.ts             # AppErrorCode + maps + RATE_LIMITS
  index.ts                   # barrel
```

**Authoring rule (the inversion).** Every file authors a **Zod schema first**,
then derives the type:

```ts
// content/rubric.ts  (illustrative)
export const RubricCriterionSchema = z.object({
  id: z.string(),
  label: z.string(),
  points: z.number() /* … */,
});
export const UnifiedRubricSchema = z
  .object({
    scoringMode: z.enum([
      "criteria_based",
      "dimension_based",
      "holistic",
      "hybrid",
    ]),
    criteria: z.array(RubricCriterionSchema).optional(),
    dimensions: z.array(EvaluationDimensionSchema).optional(),
    totalPoints: z.number(),
  })
  .strict(); // .strict() — NOT .passthrough() (kills silent drift)
export type UnifiedRubric = z.infer<typeof UnifiedRubricSchema>;
```

This deletes the entire `type _Assert = Interface extends Schema ? true : never`
block and the duplicate hand-written interfaces. A schema and its type
**cannot** disagree.

### 2.2 `@levelup/api-contract` (derived, consumed by API-layer spec)

Re-exports request/response Zod schemas (`save*Request`, `gradeQuestion`,
`getSummary`, …), `AppErrorCode`/error maps, `RATE_LIMITS`, and the
`ALLOWED_TRANSITIONS` state machines. This is the shared dependency for web, RN,
Cloud Functions, and a future REST/RPC gateway. (Full surface is defined in the
API-layer spec; this spec owns only the **entity contracts** it depends on.)

### 2.3 Transport-neutral primitives (`primitives.ts`)

```ts
/** ISO-8601 UTC string, e.g. "2026-06-19T12:34:56.000Z". The ONLY timestamp type in the domain. */
export type Timestamp = string & Brand<string, "IsoTimestamp">;
export const TimestampSchema = z.string().datetime();

/** Standard audit envelope mixed into every persisted entity. */
export interface AuditFields {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: UserId; // uid of the actor
  updatedBy?: UserId;
  archivedAt?: Timestamp | null; // soft-delete (single convention — see §6)
}

/** Cursor pagination contract (one shape platform-wide). */
export interface Page<T> {
  items: T[];
  nextCursor?: string;
}
```

The storage edge (Firestore adapter or SQL repo) is the **only** place that
converts between `Timestamp` (ISO string) and the engine's native form
(`Firestore.Timestamp` / `TIMESTAMPTZ`). Progress entities' current epoch-millis
`number` fields are normalized to this one convention.

---

## 3. Branded IDs

Keep all 17 and add the missing ones, **export every factory from the root**
(today `asNotificationId`/`asQuestionBankItemId` factories are unexported —
close that gap).

```ts
export type Brand<T, B> = T & { readonly __brand: B };

export type TenantId = Brand<string, "TenantId">;
export type UserId = Brand<string, "UserId">; // Firebase Auth uid
export type ClassId = Brand<string, "ClassId">;
export type StudentId = Brand<string, "StudentId">;
export type TeacherId = Brand<string, "TeacherId">;
export type ParentId = Brand<string, "ParentId">;
export type StaffId = Brand<string, "StaffId">; // NEW (staff had no type)
export type ScannerId = Brand<string, "ScannerId">; // NEW (scanner had no type)
export type SpaceId = Brand<string, "SpaceId">;
export type StoryPointId = Brand<string, "StoryPointId">;
export type ItemId = Brand<string, "ItemId">;
export type ExamId = Brand<string, "ExamId">;
export type ExamQuestionId = Brand<string, "ExamQuestionId">; // NEW
export type SubmissionId = Brand<string, "SubmissionId">;
export type SessionId = Brand<string, "SessionId">;
export type AgentId = Brand<string, "AgentId">;
export type AcademicSessionId = Brand<string, "AcademicSessionId">;
export type NotificationId = Brand<string, "NotificationId">;
export type QuestionBankItemId = Brand<string, "QuestionBankItemId">;
```

**Improvement over today:** persisted ID fields are typed with their brand (e.g.
`Space.tenantId: TenantId`, `UnifiedItem.spaceId: SpaceId`), not bare `string`.
The branding no longer "evaporates inside the model" (status §4.J). At
Firestore-adapter boundaries, branded IDs serialize as plain strings (Zod treats
them as `z.string()`), so wire compatibility is unaffected.

**ID generation:** UUID v7 (time-sortable) for all surrogate IDs. This is
forward-compatible with the SQL target model (`docs/DOMAIN_SQL_MODEL.md` §0) and
avoids Firestore-auto-id lock-in.

---

## 4. Persisted data model

### 4.1 Strategy: Firestore now, SQL-ready later

The fresh build **stays on Firestore** for v1 (real-time test sessions, chat,
notification badges, and grading status all rely on live listeners — see status
§5.11), but the document model is restructured so the existing
`docs/DOMAIN_SQL_MODEL.md` (53 normalized tables, ERD, junction tables) is a
**drop-in migration target**. Two rules make both work:

1. **No `Record<string,X>` maps used as relations.** Replace with subcollections
   (Firestore) / child tables (SQL). This fixes unbounded-doc growth, the 1 MB
   cap risk, and unqueryability (status §4.D).
2. **No dual-write FK arrays as the source of truth.** Membership relationships
   move to **junction subcollections/collection-groups**; denormalized arrays
   (if kept for read speed) are trigger-maintained projections, never
   authoritative (status §4.C).

### 4.2 Canonical collection tree (Firestore, post-cleanup)

```
/users/{uid}                                   UnifiedUser
/userMemberships/{uid}_{tenantId}              UserMembership          (Admin-SDK write only)
/tenantCodes/{CODE}                            TenantCodeIndex         (CF only)
/platformActivityLog/{id}                      PlatformActivityLog     (CF only)
/globalEvaluationPresets/{id}                  EvaluationSettings preset (superAdmin write)
/platformAnnouncements/{id}                    Announcement(scope=platform)
/platformHealthSnapshots/{date}                HealthSnapshot

/tenants/{tenantId}                            Tenant
  /students/{studentId}                        Student
  /teachers/{teacherId}                        Teacher
  /parents/{parentId}                          Parent
  /staff/{staffId}                             Staff      (NEW shared type)
  /scanners/{scannerId}                        Scanner    (NEW shared type — unified, see §7.4)
  /classes/{classId}                           Class
    /classStudents/{studentId}                 ClassStudentLink   (junction — replaces FK arrays)
    /classTeachers/{teacherId}                 ClassTeacherLink   (junction)
  /academicSessions/{id}                       AcademicSession
  /spaces/{spaceId}                            Space
    /storyPoints/{storyPointId}                StoryPoint
      /items/{itemId}                          UnifiedItem            (CANONICAL — single path)
        /answerKeys/{itemId}                   AnswerKey              (deny-all client reads)
    /spaceClasses/{classId}                    SpaceClassLink         (junction)
    /agents/{agentId}                          Agent
    /versions/{versionId}                      ContentVersion
    /reviews/{userId}                          SpaceReview
  /exams/{examId}                              Exam
    /questions/{questionId}                    ExamQuestion
  /submissions/{submissionId}                  Submission
    /questionSubmissions/{questionId}          QuestionSubmission
  /digitalTestSessions/{sessionId}             DigitalTestSession
    /questionStates/{questionId}               TestQuestionState      (replaces Record maps)
    /testSubmissions/{itemId}                  TestSubmission         (replaces submissions map)
  /spaceProgress/{uid}_{spaceId}               SpaceProgress (summary only)
    /storyPointProgress/{storyPointId}         StoryPointProgressDoc
      /itemProgress/{itemId}                   ItemProgressEntry      (replaces items map)
  /chatSessions/{sessionId}                    ChatSession
    /messages/{messageId}                      ChatMessage            (subcollection, not embedded)
  /questionBank/{itemId}                       QuestionBankItem
  /rubricPresets/{presetId}                    RubricPreset
  /evaluationSettings/{id}                     EvaluationSettings
  /examAnalytics/{examId}                      ExamAnalytics
  /studentProgressSummaries/{studentId}        StudentProgressSummary
  /classProgressSummaries/{classId}            ClassProgressSummary
  /insights/{insightId}                        LearningInsight
  /gradingDeadLetter/{id}                      GradingDeadLetterEntry
  /llmCallLogs/{id}                            LLMCallLog              (CF only)
  /costSummaries/{period}/{key}                DailyCostSummary        (ONE consistent path — see status be-analytics)
  /notifications/{id}                          Notification
  /notificationPreferences/{userId}            NotificationPreferences
  /announcements/{id}                          Announcement(scope=tenant)
  /achievements/{id}, /studentAchievements/{id}, /studentLevels/{uid}, /studyGoals/{id}
  /auditLogs/{id}                              tenant audit (ONE name — was auditLogs vs auditLog)

/tenants/platform_public/spaces/{spaceId}      Space (B2C store mirror)

RTDB:
  /leaderboards/{tenantId}/{spaceId}/{uid}     live leaderboard
  /notifications/{tenantId}/{uid}              NotificationRTDBState (unreadCount, latest)
  /practice/{uid}/{spaceId}                    practice cache
  /serverTimeOffset                            test clock-skew correction
```

**Retired/deleted paths** (status §4.B): the legacy `/spaces/{id}/items` flat
path, `/testSessions`, and `/progress` collection groups are removed (and their
`firestore.indexes.json` entries deleted) after the one-time migration in §8.
There is exactly **one** items path and one progress path.

### 4.3 Selected entity contracts (the load-bearing shapes)

#### UnifiedUser (`/users/{uid}`)

```ts
export interface UnifiedUser extends AuditFields {
  uid: UserId;
  email?: string;
  phone?: string;
  displayName?: string;
  photoURL?: string;
  authProviders: AuthProvider[]; // ALWAYS array (status be-identity §4.4 — drop singular authProvider)
  isSuperAdmin: boolean; // platform flag; also mirrored to a claim (see §9)
  status: "active" | "suspended" | "deleted";
  activeTenantId?: TenantId; // current JWT tenant context
  consumerProfile?: ConsumerProfile; // B2C — coexists with B2B memberships
  lastLoginAt?: Timestamp;
}
```

#### UserMembership (`/userMemberships/{uid}_{tenantId}`)

```ts
export interface UserMembership extends AuditFields {
  id: string; // `${uid}_${tenantId}`
  uid: UserId;
  tenantId: TenantId;
  tenantCode: string;
  role: TenantRole;
  status: "active" | "inactive" | "suspended";
  joinSource:
    | "admin_created"
    | "bulk_import"
    | "invite_code"
    | "self_register"
    | "migration"
    | "tenant_code";
  // EXACTLY ONE entity link, by role:
  teacherId?: TeacherId;
  studentId?: StudentId;
  parentId?: ParentId;
  staffId?: StaffId;
  scannerId?: ScannerId;
  permissions?: TeacherPermissions; // teacher
  staffPermissions?: StaffPermissions; // staff
  parentLinkedStudentIds?: StudentId[]; // parent (authoritative parent→child link, see §7.3)
  lastActive?: Timestamp;
}
```

> **Single provisioning factory.**
> `provisionMembership({ role, links, permissions, joinSource })` is the only
> code path that creates memberships (replaces the 3 divergent paths today —
> `createOrgUser`, `save* create`, `joinTenant`). Every role gets — or
> explicitly lacks — a backing entity doc; `joinTenant` students get a
> lazily-created `/students/{id}` profile.

#### Tenant entity base (NEW — `TenantEntity`)

All people/scanner docs extend one base; `authUid` is the **single** Auth-link
field (kill the `uid` vs `authUid` schism, status be-identity §4.1):

```ts
export interface TenantEntity extends AuditFields {
  id: string;
  tenantId: TenantId;
  authUid?: UserId; // links to /users/{uid}; ONLY this field (no `uid`)
  status: "active" | "archived";
}
export interface Teacher extends TenantEntity {
  firstName: string;
  lastName: string;
  subjects?: string[]; /* … */
}
export interface Student extends TenantEntity {
  rollNumber?: string;
  firstName: string;
  lastName: string; /* … */
}
export interface Parent extends TenantEntity {
  firstName: string;
  lastName: string; /* … */
}
export interface Staff extends TenantEntity {
  firstName: string;
  lastName: string;
} // NEW typed
export interface Scanner extends TenantEntity {
  deviceLabel?: string;
} // NEW typed
```

#### UnifiedItem (`/tenants/{t}/spaces/{s}/storyPoints/{sp}/items/{id}`)

```ts
export interface UnifiedItem extends AuditFields {
  id: ItemId;
  tenantId: TenantId;
  spaceId: SpaceId;
  storyPointId: StoryPointId;
  type: ItemType; // 7 top-level
  payload: ItemPayload; // z.discriminatedUnion on type/questionType — VALIDATED at write
  rubricId?: string; // resolved rubric stored on item at save time (§6)
  metadata?: ItemMetadata;
  order: number;
  linkedQuestionId?: ExamQuestionId; // cross-domain link to AutoGrade
}
```

> **Payload is a real discriminated union**, not `z.record(unknown)`.
> `ItemPayloadSchema = z.discriminatedUnion('type', [QuestionItemSchema, MaterialItemSchema, …])`
> and the question variant further discriminates on `questionType` across the 15
> subtypes. Bad payloads are rejected at write time (status be-levelup; domain
> §4.A).

### 4.4 SQL target alignment (informational)

`docs/DOMAIN_SQL_MODEL.md` is the authoritative SQL mapping and is kept in
lockstep with this spec. Key transforms it already encodes — adopt them as the
conceptual model behind the Firestore layout:

| Firestore-ism (today)                                                      | SQL target                                                 | Firestore-rebuild equivalent                                                |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| FK arrays (`Class.studentIds` ↔ `Student.classIds`)                        | junction tables (`class_students`)                         | junction subcollections (`/classes/{id}/classStudents`)                     |
| `Record<string,X>` maps (progress, test submissions, analytics breakdowns) | child tables (`item_progress`, `test_session_submissions`) | subcollections (`/itemProgress`, `/testSubmissions`)                        |
| composite-key docs (`{uid}_{tenantId}`)                                    | surrogate PK + unique constraint                           | keep composite key + add explicit `uid`/`tenantId` fields (already present) |
| `status: active                                                            | archived`+`deleted:boolean`+`'deleted'` status             | `archived_at TIMESTAMPTZ NULL`                                              | single `archivedAt: Timestamp \| null` (§6) |
| `FirestoreTimestamp`                                                       | `TIMESTAMPTZ`                                              | ISO-8601 `Timestamp` string (§2.3)                                          |

---

## 5. Multi-tenant isolation

### 5.1 The isolation model

- **Path-scoped isolation**: every tenant-owned document lives under
  `/tenants/{tenantId}/…`. The `tenantId` in the path is the partition key.
- **Claim-scoped enforcement**: `request.auth.token.tenantId` must equal the
  path `tenantId` for any tenant-scoped read/write. One tenant in the JWT at a
  time; cross-tenant access requires `switchActiveTenant` (re-stamps claims).
- **Repository-layer guard (NEW)**: the shared data/repository layer validates
  `tenantId` scoping **before** any read/write — isolation no longer depends
  solely on Firestore rules (status shared-packages rebuild note). Rules remain
  as defense-in-depth.
- **Root collections** (`/users`, `/userMemberships`, `/tenantCodes`,
  `/platformActivityLog`, `/globalEvaluationPresets`) are platform-level and
  gated by `isSuperAdmin` or owner-self.

### 5.2 B2B / B2C coexistence

- B2C consumers have **no membership**; they are served from the synthetic
  `platform_public` tenant.
- A consumer's purchases live on `UnifiedUser.consumerProfile.enrolledSpaceIds`
  and may only be mutated by the `purchaseSpace` Cloud Function (rules block
  client self-edit).
- A single human can simultaneously be a B2C consumer **and** hold B2B
  memberships in multiple tenants — all on one `UnifiedUser`.

---

## 6. Lifecycle, soft-delete & denormalization conventions

1. **One delete convention.** `archivedAt: Timestamp | null` on every entity
   (`AuditFields`). Remove the `deleted: boolean` request flag and the stray
   `'deleted'` status value in `SaveClassRequest` (status §4.F). `save*`
   requests carry `archived?: boolean`; the server sets `archivedAt`
   accordingly. Lists default to `archivedAt == null`.
2. **No deprecated field names at the contract boundary** (status §4.G):
   `authUid` only (never `uid`), `parentLinkedStudentIds` only (never
   `childStudentIds`), `branding.*` only (never top-level
   `logoUrl`/`bannerUrl`). The rebuilt API never exposes the deprecated names.
3. **Denormalized aggregates are derived, never authoritative.**
   `Tenant.stats`/`usage`, `Space.stats`, `Space.ratingAggregate`, and the
   summary collections are maintained by Cloud Function triggers (materialized
   state) and can be recomputed. A single `adjustTenantCounters(delta)` helper
   is called from every create/delete/join/leave path (fixes the stats-vs-usage
   drift in status be-identity §4.6).
4. **Rubric resolution stored at write time.** Resolve
   `tenant→space→storyPoint→item` once on save and persist the effective rubric
   on the item/question, removing the 4-sequential-read resolution at grade time
   (status be-levelup).

---

## 7. Relationship cleanup details

### 7.1 Class ↔ Student / Teacher

- Authoritative links: `/classes/{classId}/classStudents/{studentId}` and
  `…/classTeachers/{teacherId}` junction docs (each carries `tenantId`,
  `classId`, `studentId|teacherId`, `addedAt`).
- Read-optimization arrays (`Class.studentIds`, `Student.classIds`) remain as
  **trigger-maintained projections** for fast roster reads, but writes go
  through the junction; a reconciler trigger keeps arrays consistent.

### 7.2 Space ↔ Class

- `/spaces/{spaceId}/spaceClasses/{classId}` junction is authoritative for
  `accessType:class_assigned`.

### 7.3 Parent ↔ Child (fix the linkage bug — status parent-web)

- The **parent's own membership** `parentLinkedStudentIds` (and the claim
  `studentIds[]`) is the authoritative parent→child link. Parents resolve
  children from their own membership/claims — they **never** query child
  membership docs by an undocumented `parentId` field (which rules deny).
- Security rule gap to close: add a read rule on
  `/tenants/{t}/studentProgressSummaries/{studentId}` allowing parents via
  `token.studentIds.hasAny([studentId])`, and extend the `questionSubmissions`
  read rule to include parents (gated on student membership +
  `resultsReleased`).

### 7.4 Scanner (unify the half-orphaned model — status auth-access §4.3)

- One canonical location: `/tenants/{tenantId}/scanners/{scannerId}` with
  `authUid` + `tenantId` set.
- Add matching rule `match /tenants/{t}/scanners/{id}` allowing read by own
  `authUid`; writes CF-only.
- Drop the contradictory top-level `/scanners/{id}` rule, or keep it only if
  scanners are device-level (pick one — this spec chooses tenant-scoped).

---

## 8. Access & permission model by role

### 8.1 Role → capability matrix (authoritative)

| Capability                             | superAdmin | tenantAdmin | teacher                                          | staff\*                            | student | parent     | scanner          |
| -------------------------------------- | ---------- | ----------- | ------------------------------------------------ | ---------------------------------- | ------- | ---------- | ---------------- |
| Manage tenants / platform config       | ✓          | —           | —                                                | —                                  | —       | —          | —                |
| Manage tenant users/classes            | ✓          | ✓           | —                                                | `canManageUsers/Classes`           | —       | —          | —                |
| Create/edit spaces & content           | ✓          | ✓           | `canCreateSpaces/canManageContent` (own/managed) | —                                  | —       | —          | —                |
| Create/edit exams                      | ✓          | ✓           | `canCreateExams` (own/managed)                   | —                                  | —       | —          | —                |
| Edit rubrics / configure agents        | ✓          | ✓           | `canEditRubrics`/`canConfigureAgents`            | —                                  | —       | —          | —                |
| Grade / override submissions           | ✓          | ✓           | `canManuallyGrade` (by class)                    | —                                  | —       | —          | —                |
| Release exam results                   | ✓          | ✓           | (gated)                                          | —                                  | —       | —          | —                |
| Upload answer sheets                   | ✓          | ✓           | ✓ (own classes)                                  | —                                  | —       | —          | ✓ (allowScanner) |
| Attempt items / take tests             | —          | —           | —                                                | —                                  | ✓ (own) | —          | —                |
| Read own progress/results              | —          | —           | —                                                | —                                  | ✓       | —          | —                |
| Read child progress/results (released) | —          | —           | —                                                | —                                  | —       | ✓ (linked) | —                |
| View analytics                         | ✓          | ✓           | `canViewAnalytics`                               | `canViewAnalytics`                 | —       | —          | —                |
| Export data / manage billing           | ✓          | ✓           | —                                                | `canExportData`/`canManageBilling` | —       | —          | —                |

\* Staff capabilities are entirely gated by `StaffPermissions` flags; staff has
no implicit access.

### 8.2 Canonical permission keys (kill stringly-typed maps — status auth-access §4.8)

Export a single typed enum of permission keys consumed by **both** TS and a
generated rules fragment:

```ts
export const TEACHER_PERMISSION_KEYS = [
  "canCreateExams",
  "canEditRubrics",
  "canManuallyGrade",
  "canViewAllExams",
  "canCreateSpaces",
  "canManageContent",
  "canViewAnalytics",
  "canConfigureAgents",
] as const;
export type TeacherPermissionKey = (typeof TEACHER_PERMISSION_KEYS)[number];

export const STAFF_PERMISSION_KEYS = [
  "canManageUsers",
  "canManageClasses",
  "canManageBilling",
  "canViewAnalytics",
  "canManageSettings",
  "canExportData",
] as const;
export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];
```

Claim permissions are typed as `Partial<Record<TeacherPermissionKey, boolean>>`
(not `Record<string, boolean>`), so rules-generation and callers are
type-checked (status be-identity §4.14).

### 8.3 Custom claims (`PlatformClaims`) — the hot path

```ts
export interface PlatformClaims {
  role: TenantRole;
  tenantId: TenantId;
  tenantCode: string;
  isSuperAdmin?: boolean; // NEW: super-admin is a CLAIM (no get() in rules — status §4.5)
  teacherId?: TeacherId;
  studentId?: StudentId;
  parentId?: ParentId;
  staffId?: StaffId;
  scannerId?: ScannerId;
  classIds?: ClassId[]; // capped at MAX_CLAIM_CLASS_IDS = 15
  classIdsOverflow?: boolean; // → rules fall back to membership-doc read
  studentIds?: StudentId[]; // parent → children
  permissions?: Partial<Record<TeacherPermissionKey, boolean>>;
  staffPermissions?: Partial<Record<StaffPermissionKey, boolean>>;
}
```

### 8.4 Claims-sync primitive (fix drift — status auth-access §4.2)

Every callable that changes role, status, class membership, or permissions calls
**one** `syncMembershipClaims(uid, tenantId)` that re-derives `managedClassIds`
from authoritative class/teacher/student docs and rewrites claims. Wire it into
the `saveStudent`/`saveTeacher` class-reassignment branches (currently missing).
Back it with a Firestore trigger on `/userMemberships` so callables cannot
forget.

### 8.5 Token revocation on lifecycle events

On membership suspend / tenant deactivate / role change, call
`admin.auth().revokeRefreshTokens(uid)` and have rules honor
`auth.token.auth_time` to close the ~1h stale-claims window (status auth-access
§4.4).

### 8.6 Generated, layered enforcement

- **Authoritative**: a single `@levelup/access` policy module —
  `authorize(caller, action, resource)` — imported by every Cloud Function/API
  handler. Replaces the triplicated authorization logic (rules + identity
  asserts + autograde asserts).
- **Defense-in-depth (generated artifacts)**: `firestore.rules`,
  `database.rules.json`, and `storage.rules` are **build outputs** compiled from
  the same policy + permission-key enums so the three layers can't drift.
- **Storage lockdown (top current risk)**: replace blanket
  `if request.auth != null` with per-path tenant + role + ownership scoping
  (answer sheets writable only by owning student/scanner; exports admin-only)
  mirroring the Firestore RLS model (status auth-access §4.1).
- **Reduce rules `get()` depth**: denormalize `accessType` + `classIds` onto
  child docs (storyPoints/items/questions) at write time so child read rules
  don't re-`get()` the parent (status auth-access §4.9).
- **Pre-auth tenant lookup**: move school-code → tenant resolution into a
  dedicated unauthenticated callable returning only
  `{tenantId, name, status, branding}`, then require auth on `/tenants/{t}`
  `get` to stop ID-enumeration leaks (status auth-access §4.7).

---

## 9. Diagram-as-text: entity relationships

```
                         ┌───────────────┐
                         │  UnifiedUser  │  /users/{uid}   (isSuperAdmin, consumerProfile)
                         └───────┬───────┘
                                 │ 1..*  (one role per tenant)
                         ┌───────▼────────────┐      claims projection      ┌──────────────┐
                         │  UserMembership    │ ───────────────────────────▶│ PlatformClaims│ (JWT)
                         │ {uid}_{tenantId}   │                              └──────────────┘
                         └───────┬────────────┘
                                 │ links (exactly one)
        ┌──────────┬─────────────┼─────────────┬──────────┬──────────┐
        ▼          ▼             ▼             ▼          ▼          ▼
     Teacher    Student       Parent         Staff     Scanner   (tenantAdmin: none)
        │          │             │
        │ junctions│             │ parentLinkedStudentIds (authoritative)
   classTeachers  classStudents  └────────────────────────────▶ Student

  Tenant /tenants/{t}
    ├── LevelUp:  Space ──< StoryPoint ──< UnifiedItem ──< AnswerKey(server-only)
    │                │           │                │
    │           spaceClasses  Agent/Version   linkedQuestionId ─┐
    │                                                            │ (cross-domain)
    │            SpaceProgress ──< StoryPointProgress ──< ItemProgress
    │            DigitalTestSession ──< QuestionState / TestSubmission
    │            ChatSession ──< ChatMessage ;  QuestionBank ; RubricPreset ; SpaceReview
    │
    └── AutoGrade: Exam ──< ExamQuestion ◀────────────────────────┘ (linkedItemId)
                     │
                  Submission ──< QuestionSubmission (UnifiedEvaluationResult, ManualOverride)
                  EvaluationSettings ; ExamAnalytics ; GradingDeadLetter

  Shared core (content/):  UnifiedRubric ── resolved chain (tenant→space→storyPoint→item / tenant→exam→question)
                           UnifiedEvaluationResult ── used by both QuestionSubmission and DigitalTestSession
```

---

## 10. Validation, status enums & integrity

1. **Complete Zod coverage.** Every persisted entity has a schema derived to its
   type — including the ones with no schema today (`RubricPreset`,
   `ContentVersion`, gamification entities, `Announcement`, analytics logs)
   (status §4.K).
2. **`.strict()` not `.passthrough()`.** Unknown fields are rejected, not
   silently kept, killing the drift class (status §4.A).
3. **Status taxonomies preserved as `as const`** (`SUBMISSION_PIPELINE_STATUSES`
   15, `QUESTION_GRADING_STATUSES` 7, `EXAM_STATUSES` 8) with a **build-time
   check** that transition tables (`ALLOWED_TRANSITIONS`) reference only valid
   union members. Drop the vestigial `ocr_*` statuses and the unreachable exam
   `'completed'` state flagged in status be-autograde.
4. **Cross-domain referential integrity.**
   `linkedItemId`/`linkedSpaceId`/`linkedStoryPointId` are typed branded
   references validated at write time (existence check), not implicit free-text
   strings.

---

## 11. Migration note (from current code)

The rebuild is structural, not a data-model reinvention — the migration is
mechanical:

1. **Invert types→schemas.** For each file, author the Zod schema and replace
   the hand-written interface with `z.infer`. Delete
   `schemas/index.ts:1319-1407` assertion block. Fix the known drifts in the
   process (`ChatMessage.timestamp/tokensUsed`,
   `Agent.rules/systemPrompt/isActive`, `DigitalTestSession.type/deadline`,
   `Notification.recipientUid`, `Submission.uploadSource`).
2. **Normalize timestamps.** Backfill a migration that converts every
   `FirestoreTimestamp` and epoch-millis field to ISO-8601 strings; install a
   Firestore adapter that (de)serializes at the edge.
3. **Collapse legacy paths.** Migrate `/spaces/{id}/items` (flat) → nested
   `/storyPoints/{sp}/items`; `/testSessions` → `/digitalTestSessions`;
   `/progress` → `/spaceProgress`. Delete the legacy `firestore.indexes.json`
   entries afterward.
4. **Explode `Record<string,X>` maps** into subcollections (`itemProgress`,
   `testSubmissions`, `questionStates`, chat `messages`) with a one-time
   backfill writer.
5. **Build junctions.** Derive `classStudents`/`classTeachers`/`spaceClasses`
   junction docs from the existing FK arrays; keep arrays as trigger-maintained
   projections.
6. **Unify fields.** Rename every entity's `uid` → `authUid`;
   `Parent.childStudentIds` → `parentLinkedStudentIds`;
   `Tenant.logoUrl/bannerUrl` → `branding.*`. Single audit-log collection name
   (`auditLogs`).
7. **Add `StaffId`/`ScannerId`/`ExamQuestionId` brands** and the
   `Staff`/`Scanner` shared types; replace ad-hoc inline doc construction in
   `createOrgUser`.
8. **Promote `isSuperAdmin` to a claim**; generate the rules/RTDB/storage files
   from `@levelup/access`; add the missing
   `studentProgressSummaries`/`questionSubmissions`-for-parent rules and
   composite indexes; lock down `storage.rules`.

Each step is independently shippable behind the dual-write window (write new
shape, read both, then cut over and delete legacy), matching the SQL migration
sketch in `docs/DOMAIN_SQL_MODEL.md` §11.
