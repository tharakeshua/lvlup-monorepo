# Auto-LevelUp — Complete Fresh-Build Specification

> **Master document.** This is the single, cohesive specification for rebuilding
> the Auto-LevelUp platform from scratch while preserving every core domain
> concept. It is self-sufficient as a read, but cross-references the detailed
> section files under `docs/rebuild-spec/specs/` for full code sketches, tables,
> and migration steps. Each numbered section below corresponds to one detailed
> spec.
>
> **Detailed section files (authoritative for their domain):**
>
> - Domain Model & Data Architecture →
>   [`specs/domain-and-data.md`](./specs/domain-and-data.md)
> - Common API Layer → [`specs/common-api.md`](./specs/common-api.md)
> - Backend Services & Cloud Functions →
>   [`specs/backend-services.md`](./specs/backend-services.md)
> - AI Features → [`specs/ai-spec.md`](./specs/ai-spec.md)
> - Web Apps & Design System →
>   [`specs/webapps-design.md`](./specs/webapps-design.md)
> - React Native Apps → [`specs/mobile-rn.md`](./specs/mobile-rn.md)
> - Platform, Auth, Roles & Infra →
>   [`specs/platform-infra.md`](./specs/platform-infra.md)
>
> **Current-state evidence (the audit):** the per-area status reports under
> [`docs/rebuild-spec/status/`](./status/) (`app-*`, `be-*`, `domain-model.md`,
> `auth-access.md`, `api-layer.md`, `shared-packages.md`, `routing-appmgmt.md`,
> `testing-infra.md`, `ai-features.md`).

---

## 0. Scope & Locked Decisions

This is an **entirely-from-scratch (greenfield) rebuild** — a brand-new
monorepo, all code written fresh. The existing repo is reference-only (for
domain concepts and behavior); nothing is migrated file-by-file. Four build
tracks, all from zero:

- **Firebase** — Cloud Functions (`identity` / `levelup` / `autograde` /
  `analytics`), Firestore data model + generated security rules, Storage, Auth.
- **API** — the typed callable SDK that every client speaks.
- **UI** — the design system (tokens → Tailwind + NativeWind) and component
  libraries (`shared-ui` web / `ui-native` mobile).
- **Apps** — 5 web shells (rebuilt) + 3 mobile shells (new).

The only thing that carries over from the old system is **the domain model and
core concepts** (and, at the very end, a one-time **data import** from the old
Firebase into the new one). Decisions locked with the team:

- **API:** Firebase Cloud Functions callables behind a single typed SDK
  (`@levelup/api`). No client touches Firestore directly. A REST/tRPC gateway is
  explicitly **deferred** — but transport is pluggable
  (`@levelup/shared-firebase` adapter), so a gateway can be added later as
  another transport without changing any client.
- **Mobile stack:** **Expo / React Native**, sharing the domain model, API SDK,
  headless logic, and design tokens with web (~80–90% code reuse).
- **App inventory — 8 thin shells over the shared spine:**
  - **Web (5, rebuilt):** `super-admin`, `admin`, `teacher`, `student`, `parent`
    — one per role.
  - **Mobile (3, new):** **`family`** (student + parent), **`staff`** (teacher +
    admin), **`scanner`** (standalone — native camera + offline capture queue).
  - Merged mobile apps render the right surface from the logged-in user's
    **active membership role**; a multi-role user gets a **role switcher** — no
    new backend concept needed (`UserMembership` one-role-per-tenant +
    `switchActiveTenant` already support it).
  - `scanner` stays **mobile-only**; `super-admin` stays **web-only**.

This **supersedes** the per-role mobile split in §10 (`mobile-student` /
`mobile-teacher`): §10's shared-logic, offline-queue, and push-notification
designs all still apply — just repackaged into `family` / `staff` / `scanner`.

---

## 1. Executive Summary

### What the platform is

Auto-LevelUp is a **multi-tenant, AI-assisted education platform** spanning two
complementary product surfaces on one shared domain core:

- **LevelUp (digital learning):** a content + practice + assessment engine.
  Teachers author a `Space → StoryPoint → UnifiedItem` hierarchy (one content
  atom supporting 7 top-level types, 15 question subtypes, 7 material subtypes),
  students learn and take **server-authoritative timed tests**, an **AI tutor**
  chats Socratically, and progress + gamification (XP, streaks, leaderboards)
  are tracked.
- **AutoGrade (physical-exam grading):** teachers create exams; scanned answer
  sheets flow through a **two-stage AI pipeline** (Panopticon page→question
  scouting, then RELMS per-question rubric grading) with **confidence-routed
  human-in-the-loop** review and override.
- **Cross-system analytics:** materialized per-student / per-class summaries,
  at-risk detection, learning insights, and LLM cost governance unify both
  surfaces.

It serves **B2B tenants** (schools/academies, with admins, teachers, students,
parents, staff, scanner devices) and **B2C consumers** (a public store of
purchasable spaces), all on one `UnifiedUser`. The identity backbone is a
**three-layer model**: global `UnifiedUser` → per-tenant `UserMembership` (one
role per user/tenant) → cached custom-JWT `PlatformClaims` read on the rules hot
path.

Today it ships as a monorepo: 5 Vite/React web apps (`teacher-web`,
`student-web`, `admin-web`, `super-admin`, `parent-web`), 4 Firebase Cloud
Functions codebases (`identity`, `levelup`, `autograde`, `analytics`), shared
TypeScript packages, Firestore + RTDB + Storage, with a legacy standalone
`LevelUp-App/` and an `autograde/` POC sub-tree.

### Current state in one page

The **domain concepts are strong and worth preserving wholesale**: the unified
content/rubric/evaluation core, the identity triad, the consolidated `save*`
upsert pattern, server-validated status state machines, the transactional
progress-updater, answer-key isolation, the two-stage grading pipeline,
per-tenant Secret Manager keys, and a layered test pyramid with a crown-jewel
security-rules suite.

The **structural debt** is consistent across the audit:

- **No single API layer.** ~30 hook files read Firestore directly; callable
  names are stringly-typed in 3+ places; a `getCallable` factory is copy-pasted;
  request types are scattered/inline and drift from their Zod schemas. This
  blocks React Native, a REST gateway, and server-side aggregation.
- **Schema drift.** Hand-written interfaces drift from Zod schemas; `payload` is
  `z.record(unknown)`; `.passthrough()` hides drift.
- **Authorization triplicated** (rules + identity asserts + autograde asserts);
  claims drift (`saveStudent`/`saveTeacher` don't re-sync); **storage rules are
  wide open** (`if request.auth != null`); no token revocation.
- **Pipeline races** in autograde (inline-trigger worker + a second
  status-recompute trigger); analytics trigger fan-out double-notifies.
- **Path/field schisms:** dual flat/nested item paths, `uid` vs `authUid`, three
  disagreeing `costSummaries` layouts, `auditLog` vs `auditLogs`.
- **Frontend duplication:** 5 hand-copied
  `RequireAuth`/`AppLayout`/`AuthLayout`; a lossy dual content-rendering system
  (TipTap-HTML vs Markdown+KaTeX); zero frontend unit tests.
- **AI debt:** provider lock-in, `require()` LLM wrapper in autograde,
  prose-JSON contracts, in-memory circuit breaker/abuse state, unsurfaced chat
  learning signals, a leaked legacy Gemini key, stranded content generation.

### The rebuild vision

A **structural rebuild, not a re-conceptualization.** Every core concept
survives verbatim. The work is:

1. **One canonical domain package** (`@levelup/domain`, replacing
   `shared-types`): pure TS, Zod-schema-first (types via `z.infer`),
   transport-neutral (ISO-8601 timestamps), zero Firebase coupling — imported
   identically by web, RN, and functions.
2. **One common API layer**: a single typed contract (`api-contract`) +
   injectable-transport client (`api-client`) + Firebase adapter
   (`shared-firebase`). Every read and write in every client goes through it. No
   app touches Firestore or `httpsCallable` directly. This is the seam that
   makes **web + new React Native apps share verbatim**.
3. **Transport-agnostic backend services** behind thin `onCall` adapters, taking
   `(input, ctx: AuthContext)`, ready for a future REST/tRPC gateway.
4. **One authorization policy** (`@levelup/access`) generating
   Firestore/RTDB/Storage rules as build artifacts; claims kept fresh by one
   `syncMembershipClaims` primitive + trigger; token revocation on lifecycle
   events.
5. **One design system** (framework-neutral `design-tokens` → Tailwind +
   NativeWind), one `PlatformLayout`, one config-driven `RequireAuth`,
   navigation derived from a typed route manifest, one canonical
   `ContentRenderer`.
6. **New React Native apps** (student, scanner, teacher) as additive surface —
   same API, domain model, tokens, and server invariants.

---

## 2. Current-State Status Overview

Concise per-area state, linking to the full status reports.

### Web apps

- **teacher-web** ([`status/app-teacher-web.md`](./status/app-teacher-web.md)):
  rich authoring + grading review; god components (`ItemEditor` ~2700,
  `GradingReviewPage` ~1330); direct client `writeBatch`/`updateDoc` bypass
  callables (bulk-approve, reorder, settings, exam edits); dual content system;
  the active `feat/teacher-portal-latex-rendering` branch papers over lossy
  LaTeX round-tripping.
- **student-web** ([`status/app-student-web.md`](./status/app-student-web.md)):
  "two products in one app" (B2B vs B2C split by path prefix, duplicate routes);
  duplicate local hooks vs shared; evaluation contract duplicated client/server
  (scoring-drift risk); dead/unrouted pages (`/achievements`, `/progress`); god
  components (`TimedTestPage` ~1340).
- **admin-web** ([`status/app-admin-web.md`](./status/app-admin-web.md)): inline
  Firestore reads in Settings/Staff/AIUsage/layout; duplicate
  `/spaces`+`/courses`; ad-hoc table plumbing and `useState` forms; coarse cache
  invalidation.
- **super-admin** ([`status/app-super-admin.md`](./status/app-super-admin.md)):
  client full-collection scans; LLMUsage N+1 per-tenant queries; 3 divergent
  feature-flag copies; un-validated `platform/config` client writes.
- **parent-web** ([`status/app-parent-web.md`](./status/app-parent-web.md)):
  client aggregates raw submissions; relies on undocumented `parentId` queries
  (rules deny); missing rules for `studentProgressSummaries`/parent
  `questionSubmissions`; errors render as empty states; `?student=` query-string
  nav.

### Backend (Cloud Functions)

- **identity** ([`status/be-identity.md`](./status/be-identity.md)): solid
  triad + counters, but 3 divergent membership-creation paths; `uid`/`authUid`
  schism; missing claim-sync on class reassignment; Gen-1 Auth trigger race;
  counter drift (`stats` vs `usage`); `auditLog` name drift.
- **levelup** ([`status/be-levelup.md`](./status/be-levelup.md)): excellent
  `progress-updater` + answer-key isolation; dual flat/nested item path
  (orphan-on-delete); `payload: z.record(unknown)`; second `recordItemAttempt`
  round-trip; multimodal eval unfinished; in-memory chat abuse map; stub
  `purchaseSpace`.
- **autograde** ([`status/be-autograde.md`](./status/be-autograde.md)): strong
  two-stage pipeline + DLQ + confidence routing, but racy inline-trigger
  orchestration with duplicated status math; two ingestion paths
  (`uploadAnswerSheets` vs GCS trigger); prose-JSON parsing; vestigial
  `ocr_*`/unreachable `completed` states; `require()` LLM wrapper.
- **analytics** ([`status/be-analytics.md`](./status/be-analytics.md)): good
  precompute-on-write + pure rule engines, but trigger fan-out
  races/double-notify; membership-model mismatch (`memberships` keyed on
  `schoolId` vs `userMemberships`); O(N) UID lookups; budget alert only
  `console.warn`s; insight cap math wrong; `costSummaries` path schism; stubbed
  metrics.

### Domain, access, and cross-cutting

- **domain-model** ([`status/domain-model.md`](./status/domain-model.md)): the
  conceptual inventory; schema-vs-interface drift, branding evaporation,
  `Record<string,X>` relation maps, FK-array dual writes, mixed timestamp
  conventions.
- **auth-access** ([`status/auth-access.md`](./status/auth-access.md)):
  wide-open storage rules (top risk); triplicated authz; claim drift;
  super-admin `get()` on hot path; tenant-enumeration leak; deep rules `get()`
  chains; half-orphaned scanner model.
- **api-layer** ([`status/api-layer.md`](./status/api-layer.md)): ~47 callables;
  two consumption paths; stringly-typed names; partial validation; inconsistent
  pagination/errors; no versioning.
- **shared-packages**
  ([`status/shared-packages.md`](./status/shared-packages.md)): dead
  `organizations/{orgId}` generic service; stub `MetricsService`; mixed
  build/export; hand-maintained Tailwind safelist.
- **ai-features** ([`status/ai-features.md`](./status/ai-features.md)): single
  gateway exists but provider-locked; `require()` re-declaration; prose-JSON;
  in-memory state; leaked key; stranded generation; unsurfaced signals.
- **testing-infra** ([`status/testing-infra.md`](./status/testing-infra.md)):
  crown-jewel security-rules suite; but un-runnable e2e (no `webServer`),
  integration island (private lockfile, project-id mismatch), 30+ hand-rolled
  admin mocks, fragile `bc` coverage gate, committed `lib/` + service-account
  JSON.
- **routing-appmgmt**
  ([`status/routing-appmgmt.md`](./status/routing-appmgmt.md)): 5 drifted
  guards/layouts; three-way nav duplication; `start.sh` points dev at
  production; port/firebase.json drift.
- **legacy-and-scanner**
  ([`status/app-legacy-and-scanner.md`](./status/app-legacy-and-scanner.md)):
  legacy `LevelUp-App/` holds content-generation + gamification economy to port;
  planned scanner app — backend pre-wired, requirements doc stale vs live
  backend; PWA plan's in-memory queue is the weakness native solves.

---

## 3. Core Concepts To Preserve (non-negotiable)

These exist today and **must survive**. Improvements are structural only.

**Identity & multi-tenancy**

- Three-layer identity spine: `UnifiedUser` → `UserMembership` (one role per
  user/tenant, composite `{uid}_{tenantId}` key) → cached `PlatformClaims`.
- Seven roles:
  `superAdmin | tenantAdmin | teacher | student | parent | scanner | staff`.
- Minimal claims with `MAX_CLAIM_CLASS_IDS=15` + `classIdsOverflow` fallback
  (JWT ~1KB budget).
- One active tenant in the JWT at a time; `switchActiveTenant` rebuilds claims +
  forces token refresh.
- Granular `TeacherPermissions` / `StaffPermissions`; tenant-code uniqueness for
  school-code login + self-join.
- B2C consumer profile coexisting with B2B memberships on one `UnifiedUser`.

**Unified content core (the platform's best idea)**

- `UnifiedItem`: one atom, 7 top-level types / 15 question subtypes / 7 material
  subtypes, discriminated payload; `AUTO_EVALUATABLE_TYPES` (9) vs
  `AI_EVALUATABLE_TYPES` (6).
- `UnifiedRubric`: 4 scoring modes with the resolution/inheritance chain
  (`tenant→space→storyPoint→item` for LevelUp; `tenant→exam→question` for
  AutoGrade).
- `UnifiedEvaluationResult`: the single grading-output shape shared by AutoGrade
  and LevelUp.
- Cross-domain linkage
  (`UnifiedItem.linkedQuestionId ↔ ExamQuestion.linkedItemId`;
  `Exam.linkedSpaceId/linkedStoryPointId`).

**LevelUp**

- `Space → StoryPoint → UnifiedItem` hierarchy; `AssessmentConfig`;
  **server-authoritative `DigitalTestSession`** (deadline, 5-state question
  taxonomy, shuffle/adaptive, max-attempts, per-question timing).
- Two-tier progress; Agent personas (tutor/evaluator); ChatSession AI tutoring;
  QuestionBank; **server-only AnswerKey** subcollection; SpaceReview;
  ContentVersion; RubricPreset.
- B2C store (`platform_public` mirror, `purchaseSpace`); gamification
  (XP/streaks/achievements/goals/leaderboards).

**AutoGrade**

- `Exam → ExamQuestion (+SubQuestion)`; `Submission → QuestionSubmission`.
- Two-stage AI pipeline; the status taxonomies (15-state submission / 7-state
  question / 8-state exam); confidence-based HITL routing + `ManualOverride`;
  `EvaluationSettings`; `GradingDeadLetterEntry` DLQ; `ExamAnalytics`.

**Cross-system & cross-cutting**

- `StudentProgressSummary` / `ClassProgressSummary` (60% autograde / 40% levelup
  overall score), at-risk detection, `LearningInsight` engine.
- LLM cost/usage logging, single typed LLM gateway, per-tenant Secret Manager
  keys.
- 17 branded ID types + `Brand<T,B>`; `as const` enums + `ALLOWED_TRANSITIONS`
  state machines; consolidated `save*` upsert; unified error model
  (`AppErrorCode` + maps + `RATE_LIMITS`); notifications (Firestore doc + RTDB
  badge + `Announcement`).
- The auth→validate→authorize→rate-limit→mutate→side-effect pipeline;
  Zod-at-the-boundary; defense-in-depth.

---

## 4. Target Architecture

### 4.1 Monorepo topology

```
apps/
  web-super-admin/ web-admin/ web-teacher/ web-student/ web-parent/  (web, rebuilt)
  mobile-family/   (student + parent)                                (Expo/RN, new)
  mobile-staff/    (teacher + admin)                                 (Expo/RN, new)
  mobile-scanner/  (standalone, camera + offline queue)              (Expo/RN, new)
packages/
  domain/        (was shared-types) — Zod-first, transport-neutral domain model
  api-contract/  (NEW) — per-callable Zod req/res + z.infer + CALLABLES registry +
                          error model + pagination fragment + ALLOWED_TRANSITIONS
  api-client/    (NEW) — createApiClient(transport) + repositories
  shared-firebase/ (NEW) — Firebase client transport adapter (invokeViaCallable)
  access/        (NEW) — authorize() policy + permission-key registry + rules codegen
  auth-client/   (NEW) — single Zustand auth/membership/tenant/claims store (web+RN)
  shared-routing/(NEW) — RequireAuth, route-manifest types, PlatformLayout, gates
  ai/            (NEW, compiled .d.ts) — LLMProvider seam + gateway + prompt registry
  design-tokens/ (NEW) — framework-neutral tokens → Tailwind + NativeWind
  learner-core/ teacher-core/ evaluation-engine/ (NEW) — headless logic, RN-reusable
  shared-hooks-core / shared-hooks-web (split) — headless (RN) vs DOM hooks
  shared-ui/ (web presentational) + ui-native/ (NEW, RN, 1:1 names)
  shared-stores/ shared-utils/ tailwind-config/ eslint-config/
  seed/          (NEW) — config-driven, idempotent, claims-aware seed engine
functions/  identity/ levelup/ autograde/ analytics/  + shared core
firestore.rules / database.rules.json / storage.rules  (GENERATED from @levelup/access)
```

Detail: [`specs/platform-infra.md`](./specs/platform-infra.md) §7,
[`specs/webapps-design.md`](./specs/webapps-design.md) §1,
[`specs/mobile-rn.md`](./specs/mobile-rn.md) §2.

### 4.2 Common API layer (the load-bearing change)

```
WEB (5 apps)              MOBILE (3 Expo apps)
   │ same headless logic (learner-core / teacher-core / evaluation-engine)
   ▼                          ▼
shared-hooks-core (React Query — platform-neutral)
   │ calls only ▼ (never firebase/* directly)
@levelup/api-client (typed SDK + repositories over a callable REGISTRY)
   │ depends on ▼
@levelup/api-contract (SINGLE SOURCE OF TRUTH: Zod schema + z.infer + registry
                       + error model + pagination + state machines)
   │ shared by ▼                            ▲ also imported by
@levelup/shared-firebase                   functions/{identity,levelup,autograde,analytics}
 (Transport: invokeViaCallable)             thin onCall adapters → services(input, ctx)
        │ web=httpsCallable  RN=rnfirebase/functions (or REST gateway later)
        ▼
Cloud Functions (asia-south1): auth → parseRequest(Zod) → authorize → rate-limit → mutate → side-effects
        ▼ Firestore (tenant-scoped) + RTDB + Storage + Secret Manager
firestore/storage/database rules (defense-in-depth only)
```

The only platform difference between web and RN is the injected transport.
Detail: [`specs/common-api.md`](./specs/common-api.md),
[`specs/mobile-rn.md`](./specs/mobile-rn.md) §3, §11.

### 4.3 Backend services

Four-codebase split kept (bounded contexts, deploy independence):
**identity-fn**, **levelup-fn**, **autograde-fn**, **analytics-fn**, beneath a
shared `@levelup/services` (transport-agnostic use-cases), `@levelup/ai`, and
`@levelup/functions-shared` (parseRequest, rate-limit, config). A future
`gateway-fn` is just another adapter. Detail:
[`specs/backend-services.md`](./specs/backend-services.md) §1.

### 4.4 Data model

Firestore now, **SQL-ready later** (`docs/DOMAIN_SQL_MODEL.md` is a drop-in
target). Two rules: no `Record<string,X>` maps as relations (→ subcollections),
no FK-array dual writes as truth (→ junction subcollections, arrays as
trigger-maintained projections). Canonical collection tree under
`/tenants/{tenantId}/...`. Detail: §5 below and
[`specs/domain-and-data.md`](./specs/domain-and-data.md) §4.

### 4.5 Multi-tenant + roles/permissions matrix

Path-scoped isolation (`/tenants/{tenantId}/...`) + claim-scoped enforcement
(`token.tenantId == path tenantId`) + a NEW repository-layer guard. One
`authorize(caller, action, resource)` seam. Full role × capability matrix:

| Capability                                 | superAdmin | tenantAdmin |                        teacher                         |              staff\*               |    student    |    parent    |      scanner       |
| ------------------------------------------ | :--------: | :---------: | :----------------------------------------------------: | :--------------------------------: | :-----------: | :----------: | :----------------: |
| Provision/manage tenants & platform config |     ✓      |      —      |                           —                            |                 —                  |       —       |      —       |         —          |
| Manage tenant users / classes / sessions   |     ✓      |      ✓      |                           —                            |      `canManageUsers/Classes`      |       —       |      —       |         —          |
| Author spaces & content                    |  ✓ (read)  |      ✓      |   `canCreateSpaces`+`canManageContent` (own/managed)   |                 —                  |       —       |      —       |         —          |
| Create exams / rubrics / configure agents  |  ✓ (read)  |      ✓      | `canCreateExams`/`canEditRubrics`/`canConfigureAgents` |                 —                  |       —       |      —       |         —          |
| Grade / override submissions               |  ✓ (read)  |      ✓      |             `canManuallyGrade` (own class)             |                 —                  |       —       |      —       |         —          |
| Upload answer sheets                       |     —      |      ✓      |                    ✓ (own classes)                     |                 —                  |       —       |      —       | ✓ (`allowScanner`) |
| Take tests / practice / chat tutor         |     —      |      —      |                           —                            |                 —                  | ✓ (own scope) |      —       |         —          |
| Read own progress/results                  |     —      |      —      |                           —                            |                 —                  |       ✓       |      —       |         —          |
| Read child progress/results (released)     |     —      |  ✓ (read)   |                           —                            |                 —                  |       —       |  ✓ (linked)  |         —          |
| View analytics                             |     ✓      |      ✓      |                   `canViewAnalytics`                   |         `canViewAnalytics`         |      own      | own children |         —          |
| Export data / manage billing               |     ✓      |      ✓      |                           —                            | `canExportData`/`canManageBilling` |       —       |      —       |         —          |

\* Staff has no implicit access; everything is gated by `StaffPermissions`
flags. Scope qualifiers (`own class`, `managed`, `linked children`) enforced via
`classIds`/`studentIds` claims with overflow fallback. Detail:
[`specs/platform-infra.md`](./specs/platform-infra.md) §4,
[`specs/domain-and-data.md`](./specs/domain-and-data.md) §8.

---

## 5. Domain Model & Data Architecture

**Full spec: [`specs/domain-and-data.md`](./specs/domain-and-data.md).**

**Canonical package** `@levelup/domain` (replaces `shared-types`): pure TS, zero
Firebase coupling, **Zod-schema-first** (`z.infer` derives types — deletes the
`extends`-assertion harness and the schema-vs-interface drift class),
`.strict()` not `.passthrough()`. Transport-neutral primitives: ISO-8601
`Timestamp` strings only (the storage adapter is the one place converting to
`Firestore.Timestamp`/`TIMESTAMPTZ`); standard `AuditFields` with a **single
soft-delete convention** (`archivedAt: Timestamp | null`).

**Branded IDs:** keep all 17, add `StaffId`/`ScannerId`/`ExamQuestionId`, export
every factory, type persisted ID fields with their brand (branding no longer
evaporates). UUID v7 for surrogate IDs (SQL-forward, time-sortable).

**Persisted model:** Firestore now, SQL-ready. Canonical collection tree under
`/tenants/{tenantId}/...` with:

- **One items path** (`spaces/{s}/storyPoints/{sp}/items/{id}`) + server-only
  `answerKeys` subcollection; the legacy flat path and
  `/testSessions`/`/progress` collection groups are retired (with their index
  entries).
- **Junction subcollections** (`classStudents`, `classTeachers`, `spaceClasses`)
  authoritative; FK arrays become trigger-maintained projections.
- **Record-map relations exploded** into subcollections (`itemProgress`,
  `testSubmissions`, `questionStates`, chat `messages`).
- New shared `Staff`/`Scanner` types on a `TenantEntity` base (`authUid` only —
  kills the `uid`/`authUid` schism).
- `UnifiedItem.payload` is a **real discriminated union** validated at write
  time (not `z.record(unknown)`).

**Multi-tenant isolation:** path-scoped + claim-scoped + repository-layer
guard + rules defense-in-depth. B2B/B2C coexistence via `platform_public`
synthetic tenant; consumer purchases mutable only by `purchaseSpace`.

**Lifecycle/denormalization conventions:** one delete convention; no deprecated
field names at the boundary (`authUid`, `parentLinkedStudentIds`, `branding.*`);
denormalized aggregates derived via triggers (one
`adjustTenantCounters(delta)`); rubric resolved + stored at write time.

**Relationship fixes:** class↔student/teacher junctions; space↔class junction;
parent↔child via the parent's own `parentLinkedStudentIds`/claims (never
undocumented `parentId` queries) + the missing
`studentProgressSummaries`/parent-`questionSubmissions` read rules; unified
tenant-scoped scanner.

**Validation/integrity:** complete Zod coverage (incl. entities with no schema
today); preserved `as const` status taxonomies with build-time transition-table
checks; drop vestigial `ocr_*` + unreachable `completed`; typed cross-domain
references validated at write.

Open question carried: final persistence target and realtime strategy.

---

## 6. Common API Layer

**Full spec: [`specs/common-api.md`](./specs/common-api.md).**

A single typed RPC-style callable surface consumed identically by all 5 web apps
and the RN apps. Three new packages:

- **`api-contract`** — the single source of truth. Per-callable `CallableDef`
  (`name`, `module`, `requestSchema`, `responseSchema`, `authMode`, `rateTier`),
  one `CALLABLES` registry, types via `z.infer`. Carries the error model, the
  single pagination fragment, and the `ALLOWED_TRANSITIONS` state machines (so
  clients can pre-validate transitions). Kills `callable-types.ts` interfaces
  and the two-source schema/type split.
- **`api-client`** — `createApiClient(transport, { validateResponses })`:
  namespaced methods (`api.levelup.saveSpace`), request validated pre-flight,
  response validated in dev. Removes the copy-pasted `getCallable` factory and
  stringly-typed names.
- **`shared-firebase`** — the Firebase client `Transport` adapter
  (`invokeViaCallable` over `httpsCallable`, region from config).

**Naming/versioning:** `v1.<module>.<operation>` with `apiVersion` for dual-run
migrations. **`save*` upsert** convention kept; **combined-mode discriminators
kept** (`gradeQuestion.mode`, `getSummary.scope`, `generateReport.type`,
`manageNotifications.action`).

**Key shift:** reads no longer hit Firestore from the browser. ~30 hooks +
stores move behind `v1.<module>.list*/get*` read endpoints — the prerequisite
for RN, a REST gateway, and server-side aggregation (kills super-admin/parent
N+1 fan-outs). The full ~47-callable inventory plus the NEW read/aggregation
endpoints is enumerated in the spec (§3.3).

**Auth flow:** identity model kept verbatim; a server-side `AuthContext` is
built from `request.auth`; **`tenantId` is derived from claims, not the request
body** (`tenantOverride` only for super-admin). Every service is `(input, ctx)`
so a future REST gateway reuses it.

**Error model:** every `HttpsError.details` always carries
`{ code: AppErrorCode, message, validationErrors?, retryable? }`; `fail()`
helper + `parseRequest` map Zod failures; `useApiError` reads `details.code`
first.

**Pagination:** one opaque-cursor fragment
(`{ cursor?, limit? } → { items, nextCursor, total? }`).

**Cross-cutting:** declared `rateTier` per callable; reliable side effects via
triggers/outbox (no fire-and-forget); optional `idempotencyKey` on creating
callables; one audit-log collection.

**Realtime** (test-session deadline, chat streaming, notification badges,
grading status) is a parallel concern kept behind a typed
`subscribe(name, params, cb)` seam — flagged, not designed here.

Open questions: realtime seam vs SSE/WebSocket if Firestore is dropped; build
the REST gateway in v1 or callable-only; OpenAPI/codegen vs TS-package-only;
idempotency-key storage/TTL; the `v1.*` rename/alias cutover plan.

---

## 7. Backend Services & Cloud Functions

**Full spec: [`specs/backend-services.md`](./specs/backend-services.md).**

Eight guiding principles: transport-agnostic service core; one
`@levelup/api-contract`; validate-in/validate-out; tenantId-from-claims;
idempotency by default; event-sourced side effects; one source of truth for
status/counters/timestamps; centralized region+config.

**identity-fn** — _Keep_ the triad, composite key, minimal claims + overflow,
`save*`, defense-in-depth, atomic counters. _Fix:_ one `provisionMembership`
factory (replaces 3 paths); normalize to `authUid` + typed `TenantEntity`;
**claim sync as an `onMembershipWritten` trigger** (callables can't forget);
Gen-2 blocking Auth functions; transactional/saga multi-write; unified
`adjustTenantCounters`; typed claim permissions; `auditLogs` name, `tenantCode`
auto-suffix, batched `searchUsers`.

**levelup-fn** — _Keep_ the `UnifiedItem` core, `save*`, the **transactional
`progress-updater`** (the strongest piece), answer-key isolation, deterministic
auto-grading, server-authoritative timing. _Fix:_ single canonical item path
(delete flat); validate `payload` discriminated union; collapse `StoryPointType`
(`test`→`timed_test`); unify points model; one publish-notification path;
**`evaluateAnswer` persists progress in one call**; batch answer-key reads +
precompute rubric; real multimodal eval; shared Firestore/Redis chat abuse
limiter; centralized cascade-delete; real `purchaseSpace` payment adapter.

**autograde-fn** (the headline rework) — _Keep_ two-stage Panopticon→RELMS,
rubric resolution chain, confidence-routed HITL, DLQ/degradation/watchdog,
per-tenant secret/quota, `saveExam` transitions. _Fix:_ **one durable
`advancePipeline(submissionId)` reducer** (Cloud Tasks per stage) computing
status in exactly one place (deletes duplicated counting); single canonical
`uploadAnswerSheets` ingestion (demote the GCS trigger); provider structured
output (Zod `responseSchema`, no fence-stripping); clean status taxonomy; stable
`@levelup/ai` import (no `require()`); collection-group watchdog + image-once
handling; typed cross-domain links; hard typed quota gate.

**analytics-fn** — _Keep_ precompute-on-write summaries, pure rule engines
(at-risk 4 rules, insights 6 rules), per-exam `ExamAnalytics`, consolidated
`getSummary`/`generateReport`, 60/40 overall score, dual Firestore+RTDB fan-out.
_Fix:_ collapse trigger fan-out into one debounced `recomputeStudentRollup`
orchestrator; `onProgressMilestone` the single at-risk notifier; standardize on
`userMemberships`; wire `ai_budget_alert`; fix insight cap math + correlation
stub; replace expensive count queries; implement-or-omit
`streakDays`/`discriminationIndex`/`topicPerformance`; fix `costSummaries` path;
`workspace:*` for shared-types; rules for materialized collections.

**AI/cost layer** and the **cost-summary canonical layout** are detailed in §8 /
the AI spec. Reliability + security: Cloud Tasks + DLQ + idempotent reducers;
rules for materialized analytics collections; claims-sync trigger +
`revokeRefreshTokens`; `firestore.rules` as generated defense-in-depth from
`@levelup/access`.

Open questions: pipeline substrate (Cloud Tasks vs Workflows vs Pub/Sub);
REST/tRPC gateway vs callable-only; access model for materialized collections
(rules vs callable-only); realtime strategy off Firestore; payment provider for
`purchaseSpace`; implement-or-remove the stubbed metrics.

---

## 8. AI Features

**Full spec: [`specs/ai-spec.md`](./specs/ai-spec.md).**

Six principles: one AI gateway (`@levelup/ai`, compiled `.d.ts`);
provider-agnostic; schema-enforced I/O; transport-agnostic services; cost/safety
are gateway concerns; server-only keys.

**Capability map (C1–C11):** extraction (C1), page→question mapping (C2),
per-question grading (C3), LevelUp answer eval (C4), tutor chat (C5),
summarization (C6), chat signal extraction (C7), content/question generation
(C8), at-risk (C9, pure rules), insights (C10, hybrid rules + C7 signals),
moderation (C11, new). C1–C8/C11 live in `@levelup/ai`; C9 is pure rules; C10
closes the loop by surfacing the chat signals the current system writes but
never uses.

**Infrastructure:** a real `LLMProvider` interface (`GeminiProvider` today +
`ClaudeProvider` drop-in) with provider-owned pricing + streaming; a single
`callLLM` gateway with a 10-step pipeline (resolveProvider → enforceQuota →
circuit → moderate → renderPrompt → zodToJsonSchema → generate → Zod-parse →
cost → log). Model/tier/maxTokens/temperatures are **tenant-configurable**
(default latest Gemini Flash, Claude swappable). Durable Firestore/Redis circuit
breaker + abuse limiter (no in-memory `Map`s). Per-tenant Secret Manager keys
only — the leaked legacy key is revoked.

**Prompts:** versioned named registry (`evaluator.v2`, `tutor.v1`,
`panopticon.v1`, `relms.v2`, `extraction.v1`, `generation.v1`, …); prompt
version logged on every `llmCallLog`; tagged user input + ignore-directives; Zod
schema as the output contract (no prose JSON, no snake/camel re-mapping).

**Canonical schemas** in shared-types (Evaluation, Extraction, Mapping,
Generation) used as both `responseSchema` and persisted shape; the model returns
only semantic fields, the service attaches `costUsd`/`tokens`/`gradedAt`.

**Per-capability:** autograde keeps two-stage + confidence routing + single
`advancePipeline` writer + structured output + image-once; LevelUp eval finishes
multimodal + persists in one call; tutor chat streams + extracts signals feeding
C10; content generation is a first-class server feature emitting validated
discriminated-union payloads as drafts; at-risk pure rules with fixed UID
resolution + single notifier; insights hybrid with corrected cap math;
moderation explicit (regex + model, verdict persisted).

**Common API:** AI capabilities are transport-neutral services with identical
web/RN DTOs; tutor streaming over SSE.

**Cost-summary canonical layout** (resolves the three-way schism):
`/tenants/{t}/costSummaries/daily/{YYYY-MM-DD}` + `/monthly/{YYYY-MM}`, one
`costSummaryRef` helper used by logger, quota check, and aggregator.

Open questions: platform default Claude vs Gemini; pipeline substrate;
circuit-breaker store (Firestore vs Redis); PDF ingestion at launch for C8;
implement-or-remove stubbed metrics; confidence thresholds (0.7/0.9)
tunability + per-question-type overrides.

---

## 9. Web Apps & Design System

**Full spec: [`specs/webapps-design.md`](./specs/webapps-design.md).**

Five principles: one source per concern; apps are configuration not code; UI
never touches Firebase; headless logic separate from presentation; keep the
strong UX wholesale (lazy routes + prefetch, PWA, error boundaries, a11y,
keyboard grading, confidence surfacing, timed tests, tenant switching, B2B/B2C,
answer-key guard).

**Package topology:** NEW `shared-tokens` (framework-neutral), NEW `shared-api`
(transport-agnostic repositories + registry, standardized on
`tenants/{tenantId}` — kills the dead `organizations/{orgId}` service), NEW
`shared-routing`, `shared-hooks` split headless/web. All packages ship `dist`
consistently.

**Design system:** semantic HSL token schema with domain status/confidence/grade
colors; generated Tailwind safelist; tenant branding as a shell feature flag.
Component library reorganized into tree-shakeable subpath entrypoints
(primitives/layout/auth/data/charts/gamification/editor/markdown/feedback) with
a NEW shared `DataTable`. **One canonical `ContentRenderer`** over portable
Markdown-with-math (eliminates the lossy TipTap-HTML vs KaTeX dual system;
`preprocessMath` demoted to a one-time migration shim — retires the
`feat/teacher-portal-latex-rendering` churn). WCAG AA primitives on every app
via `PlatformLayout`.

**App shell:** one configured `PlatformLayout` replaces five ~250-line
`AppLayout.tsx`; navigation **derived as data** from a typed per-app route
manifest (eliminates the three-way App.tsx/nav/prefetch duplication and
inconsistent `isActive`). RN consumes the same manifest via a `react-navigation`
renderer.

**Routing & guards:** one config-driven `RequireAuth` folding in the strongest
behaviors as opt-in flags (`requireTenantMatch`, `requireSuperAdminClaim`,
`onMissingMembership: 'consumerRedirect'`, composable `gates`); typed
`RouteManifest` with role + permission-gated `navMeta`; `auth-store` as single
source of truth; `createBrowserRouter` recommended.

**Per-app page inventories** map every route to common-API repo reads / callable
writes, including NEW callables (`reorderItems`, `moveItems`,
`saveEvaluationSettings`, `saveTenantFeatures`, `savePlatformConfig`,
`listTenantStaff`, parent read callables, server-aggregated `getPlatformSummary`
scopes, server-side bulk-approve). A 24-row inconsistencies-to-eliminate
checklist and an 8-step migration note close the spec.

Open questions: `createBrowserRouter` data-router vs declarative `<Routes>`;
single student app with `LearnerContext` vs split B2B/B2C; `/billing` scope
(full Razorpay vs governance-only); response-side Zod always-on vs dev-only;
epoch-millis vs ISO timestamps at the repo edge; fate of the `autograde/`
sub-monorepo + scanner hosting.

---

## 10. New React Native Apps (student, teacher, scanner)

**Full spec: [`specs/mobile-rn.md`](./specs/mobile-rn.md).**

Net-new mobile clients, first-class consumers of the **same** `api-contract` +
typed callable client + repositories. No mobile app touches Firestore directly;
the only platform difference from web is the injected transport.

**Which apps get built** (per the §0 locked decision — merged family+staff, not
per-role): **`mobile-family`** (student + parent; B2B + B2C learner +
child-progress) and **`mobile-scanner`** (native camera + on-device
compression + **offline-durable capture queue**, the killer reason) ship P0;
**`mobile-staff`** (teacher + admin — review/grade/monitor + light
edits/approvals; heavy authoring stays web-first) ships P1. Each merged app
renders by the active membership role and offers a role switcher for multi-role
users. `super-admin` stays web-only.

**Stack:** Expo SDK (managed, EAS Build) + Expo Router (typed routes) + TanStack
Query v5 + Zustand 5 via `shared-stores` + `@react-native-firebase/*` transport
(region `asia-south1`) + NativeWind fed by `design-tokens` +
`expo-camera`/`image-manipulator`/SQLite/MMKV/`secure-store`/`notifications`/`netinfo`.

**Shared-logic reuse:** `learner-core` (test-runner SM, timer with clock-skew,
adaptive engine, progress aggregation), `teacher-core` (grading-review SM,
item-validation registry), `evaluation-engine` (single deterministic
auto-evaluator imported by client AND functions — kills scoring drift),
`ui-native` (1:1 names with `shared-ui`). Question answerers dispatch on
`payload.questionType` (15 types) over a shared `useAnswerState` hook.

**mobile-scanner** (highest native value): linear Login → Select Exam → Select
Student → Capture/Upload → Submit. Capture → `expo-image-manipulator` compress →
persist to FileSystem + enqueue in SQLite (durable, survives app kill) → on
connectivity, upload to tenant-scoped Storage → call
`uploadAnswerSheets({ uploadSource: 'scanner' })`. **Never writes the submission
doc or generates IDs** (server responsibilities); idempotency via the server
`already-exists` guard + optional key; background sync via `expo-task-manager`.

**Push notifications** (cross-app): the analytics `notification-sender` adds a
third fan-out step (Expo Push/FCM) alongside the existing Firestore doc + RTDB
badge; `registerDeviceToken` callable; FCM data messages with a `route` field
deep-link via Expo Router. Wires the currently-`console.warn`-only
`ai_budget_alert`/at-risk notifications into actionable push.

**What stays server-authoritative** (mobile honors identically): answer-key
isolation, submission creation, grading recompute via `gradeQuestion`,
timed-test deadline + scoring (local scoring is optimistic preview only). Timed
tests are online-only by design; practice attempts queue offline.

**Mobile is the forcing function** for the auth/storage prerequisites: harden
`storage.rules` (scanner uploads writable only by owning scanner), unify the
scanner role, derive `tenantId` from claims, add token revocation.

Open questions: RN-Firebase callables vs REST gateway; Expo managed vs bare for
push; RN math (WebView KaTeX vs native); parent app full-Expo vs WebView;
scanner role unification before storage scoping; tenantId from claims vs body;
timed-test offline policy.

---

## 11. Platform, Auth, Roles & Infra

**Full spec: [`specs/platform-infra.md`](./specs/platform-infra.md).**

Six goals: one authorization policy across all enforcement layers; one client
identity store; claims never drift; lifecycle-safe sessions; deterministic
infra; RN-ready foundations.

**Identity (keep, harden):** the three-layer spine verbatim. Changes:
`superAdmin` becomes a real `platformRole` claim (no rules `get()`;
`isSuperAdmin` on `/users` stays as the durable seed); typed claim permissions;
`authUid` everywhere on `TenantEntity`; one `provisionMembership` factory;
unified scanner; `syncMembershipClaims` + trigger; token revocation.

**Authentication & session:** Firebase Auth (`email`/`phone`/`google`/`apple`,
`authProviders[]` array); Gen-2 `beforeUserCreated` blocking function (kills the
user-doc race); roll-number synthetic-email centralized in one
`deriveStudentEmail`; four login modalities (incl. secured pre-auth
`resolveTenantByCode` closing the enumeration leak); one `@levelup/auth-client`
Zustand store (collapses the dual `useAuthStore` + React-Query `useAuth`) with
`useCan(permission)`; **token revocation** via `revokeRefreshTokens` + an
`isTokenFresh()` rules helper on `auth_time`.

**Roles/permissions/claims:** canonical 7-role set; one typed permission-key
registry (kills stringly-typed `permissions[perm]`); the role×capability matrix
(§4.5); per-role claims projection; **one `authorize(caller, action, resource)`
seam** replacing the triplicated logic; RLS rules **generated** from
`@levelup/access` with the **storage lockdown** (per-path
tenant+role+ownership), denormalized `accessType`/`classIds` to cut `get()`
chains, claim-based super-admin, and token-freshness checks.

**Tenant provisioning & lifecycle:** transactional idempotent `saveTenant` with
auto-suffix `tenantCode` + default features from one registry;
`provisionMembership` + `syncMembershipClaims` primitive (+ trigger safety net);
unified `adjustTenantCounters` (+ nightly reconciler);
deactivate-with-`revokeRefreshTokens`; single `auditLogs` name; CSV header fix.

**Routing/build/CI/testing/environments:** one config-driven `RequireAuth` +
typed manifest + single `PlatformLayout`; pnpm + Turbo workspace cleanup (delete
the vestigial npm `workspaces` field, retire `LevelUp-App/`/`autograde/` from
the active tree); esbuild/tsup functions bundling (replace the `.local-deps`
dance); stop committing `lib/`/`dist` + rotate the committed service-account
JSON; fast required PR gate (lint→typecheck→build→unit→integration→contract) vs
nightly e2e/visual/lighthouse; the layered test pyramid made runnable (real e2e
`webServer`, unified `demo-levelup` project id, folded integration island, NEW
contract gate, frontend unit tests, `packages/seed` engine); local/staging/prod
environments with **emulator-first local dev** (fix `start.sh` defaulting dev to
production).

Open questions: `autograde/` fate (fold vs separate product); is `lvlup-staging`
budgeted; token-revocation strictness (hard-deny on `auth_time` vs
suspend-only); super-admin as a real membership row vs claim-only; storage.rules
lockdown migration ordering (audit cross-tenant files first).

---

## 12. Migration / Build Roadmap

A **greenfield build order** — a brand-new monorepo, nothing migrated
file-by-file. The phases below were originally written in migration language
(because the old repo exists as reference); for the from-scratch build, read
every "introduce X alongside Y, then remove Y" step as simply **"build X"** —
there is no old code in the new repo to run alongside. The dependency order
still holds (domain → contract/API → backend → first vertical slice → web →
mobile → hardening), and the old system stays live as reference until a
**one-time data import** at the very end.

**Greenfield phase summary (canonical order):** 0. **Spine** — new monorepo
(pnpm+Turbo), Firebase projects (dev/staging/prod, emulator-first),
`@levelup/domain`, `api-contract`, `api` client + `shared-firebase` transport,
`design-tokens`, `@levelup/access`.

1. **Firebase backend** — `functions-shared`, then `identity` → `levelup` →
   `autograde` → `analytics` services as `(input, ctx)` behind thin `onCall`
   adapters; `@levelup/ai` gateway; rules generated from `@levelup/access`; seed
   engine.
2. **First vertical slice** — one end-to-end path (teacher authors
   Space→StoryPoint→Item → student takes a timed test → autograde returns a
   result) through _every_ layer, to prove the architecture before fanning out.
3. **Web + UI** — `shared-ui` + `ContentRenderer` + `DataTable`,
   `shared-routing` + `PlatformLayout` + `auth-client`; then the 5 web shells
   (student → teacher → admin → parent → super-admin).
4. **Mobile apps** — `ui-native` + headless cores
   (`learner-core`/`teacher-core`/`evaluation-engine`); `mobile-family` (P0) +
   `mobile-scanner` (P0) with Expo Router + EAS + offline queue; push
   notifications; `mobile-staff` (P1).
5. **Hardening + data import + cutover** — contract tests per callable, e2e
   `webServer`, security-rules matrix, frontend unit tests; one-time import old
   Firebase → new (users/memberships/content/exams/submissions/progress, mapped
   to new schema); cut over; retire old repo.

The detailed dependency-ordered steps follow (migration framing; same order
applies to the greenfield build):

**Phase 0 — Foundations (non-behavioral, unblocks everything)**

1. Invert types→schemas in `@levelup/domain`; delete the assertion block; fix
   known drifts; `.strict()`.
2. Extract `design-tokens` from `tailwind-config/theme.js`; generate the
   Tailwind safelist; standardize all packages on `dist` builds.
3. Stand up `api-contract` (move every Zod schema + inline request type into
   one-file-per-callable defs; registry; error model; pagination;
   `ALLOWED_TRANSITIONS`), `api-client` (`createApiClient`), and
   `shared-firebase` (`invokeViaCallable` + region config).
4. Infra hygiene: pnpm-only workspace, delete npm `workspaces` field,
   gitignore + remove tracked `lib/`, rotate + remove the committed
   service-account JSON, unify integration project id to `demo-levelup`, create
   `lvlup-staging`.

**Phase 1 — Backend service extraction (behavior-preserving)** 5. Lift each
`onCall` body into a `@levelup/services` function taking `(input, ctx)`; handler
becomes parse → build `ctx` → service. Add response schemas; validate `payload`
discriminated union; derive `tenantId` from claims. 6. Build `@levelup/ai`
(compiled `.d.ts`) from `shared-services/ai`; delete the autograde `require()`
shim; wrap Gemini as `GeminiProvider` + add `ClaudeProvider`; promote prompts
into the versioned registry; revoke the leaked key. 7. Add the `list*`/`get*`
read endpoints + new callables (`reorderItems`, `moveItems`,
`saveEvaluationSettings`, `saveTenantFeatures`, `savePlatformConfig`,
`listTenantStaff`, parent read callables, `getPlatformSummary` scopes,
server-side bulk-approve).

**Phase 2 — Data + access normalization** 8. levelup item-path migration
(flat→nested), delete fallbacks + flat-path indexes; explode `Record<string,X>`
maps into subcollections; build junctions from FK arrays. 9. Unify fields
(`uid`→`authUid`, `parentLinkedStudentIds`, `branding.*`, `auditLogs`); add
`Staff`/`Scanner` types + brands; one `provisionMembership` +
`adjustTenantCounters`; normalize timestamps to ISO + install the Firestore
adapter. 10. Identity hardening: `onMembershipWritten` claim-sync trigger; Gen-2
blocking Auth functions; idempotency keys; `tenantCode` auto-suffix. 11. Access
pass: promote `superAdmin` to a claim; generate rules from `@levelup/access`;
add missing `studentProgressSummaries`/parent-`questionSubmissions` rules +
composite indexes; **lock down `storage.rules`** (audit cross-tenant files
first); add `revokeRefreshTokens` + `isTokenFresh()`; unify scanner role.

**Phase 3 — Pipeline + analytics reliability** 12. autograde: introduce Cloud
Tasks + the `advancePipeline` reducer alongside existing triggers, then remove
the inline-trigger worker + duplicated status; make `uploadAnswerSheets` the
single ingestion (demote the GCS trigger); clean + build-time-validate the
status taxonomy. 13. analytics: add the `recompute` marker + single
`recomputeStudentRollup` queue worker; merge the `spaceProgress` triggers; make
`onProgressMilestone` the only notifier; wire `ai_budget_alert`; migrate
`costSummaries` to the canonical layout; standardize on `userMemberships`. 14.
Finish multimodal eval + persist-in-one-call; move circuit breaker + chat abuse
to durable storage; surface chat signals into insights (C10←C7); fix insight cap
math / at-risk UID resolution / enum drift / stubbed metrics.

**Phase 4 — Frontend rebuild** 15. Stand up `shared-api` repositories; migrate
hooks app-by-app to call repos/registry; delete dead `organizations/` service +
inline path strings; add Zod validation + timestamp normalization at the repo
edge; centralize query-key factories. 16. Introduce `shared-routing`: per-app
route manifests, single `RequireAuth`, `PlatformLayout`, gate predicates; delete
the 5 `RequireAuth`/`AppLayout`/`AuthLayout` copies; collapse `useAuth` +
`useAuthStore` into `@levelup/auth-client`; optionally adopt
`createBrowserRouter`. 17. Unify content rendering (single `ContentRenderer`,
`RichTextEditor` emits Markdown, run `preprocessMath` migration once then
remove); decompose god components into headless hooks + thin views (first
frontend unit tests land here). 18. Per-app cleanups: merge admin
`/spaces`+`/courses`; wire/remove student dead routes + `LearnerContext`; parent
route-params; `DataTable` + RHF across tables/forms; gate nav on `useCan`.

**Phase 5 — React Native (additive)** 19. Split `shared-hooks` (headless/web);
extract `learner-core`/`teacher-core`/`evaluation-engine`; stand up
`ui-native`. 20. Scaffold `mobile-student` (P0) + `mobile-scanner` (P0) with
Expo Router + EAS; reconcile the stale scanner requirements against the live
backend; build the durable offline capture queue. 21. Wire push
(`registerDeviceToken`, extend `notification-sender`, deep links); ship
`mobile-teacher` (P1).

**Phase 6 — Testing + retirement** 22. Make the pyramid runnable: e2e
`webServer`, frontend unit tests, the NEW contract gate per callable,
`packages/seed` engine, security-rules matrix expanded with
stale-claim/post-revocation cases; reusable page objects for future
Detox/Maestro. 23. Retire dead code: archive `LevelUp-App/` (after porting
content generation + gamification economy) and decide the `autograde/` POC fate;
delete legacy indexes/paths after cutover.

---

## 13. Open Questions & Risks

Consolidated from all sections — decisions to make before/during the build.

**Architecture & transport**

- Build the REST/tRPC gateway in v1 or stay Firebase-callable-only (affects
  auth, tutor streaming, scanner device)? Emit OpenAPI/codegen or rely on the
  shared TS package?
- Realtime strategy: keep Firestore/RTDB listeners behind a `subscribe()` seam,
  or move to SSE/WebSocket — especially if Firestore is ever dropped (test
  deadline, chat streaming, notification badges, grading status).
- Final persistence target (Firestore vs the SQL model) and when to migrate.

**Backend & AI**

- Autograde pipeline substrate: Cloud Tasks (recommended) vs Cloud Workflows vs
  Pub/Sub, given the original emulator-friendly trigger choice.
- Platform default model: latest Gemini Flash (current prod, recommended
  default) vs Claude — affects per-tenant Secret Manager provisioning + cost
  tables.
- Durable circuit-breaker/abuse store: Firestore (emulator-friendly) vs
  Memorystore/Redis.
- Content generation (C8): PDF ingestion at launch vs topic-only first.
- Confidence thresholds (0.7/0.9) tenant-tunability + per-question-type
  overrides.
- Implement-or-remove the stubbed metrics (`streakDays`, `discriminationIndex`,
  `topicPerformance`, exam↔space correlation) — don't ship zeros as truth.
- Payment provider for `purchaseSpace` (Razorpay present but unused) +
  `/billing` scope (full integration vs governance-only).
- Idempotency-key storage/TTL strategy (dedicated collection vs piggyback on
  entity docs).

**Access & identity**

- Access model for materialized analytics collections: tenant/role-scoped rules
  for direct reads vs callable-only via `getSummary`.
- Token-revocation strictness: hard-deny on `auth_time < tokensValidAfter` (more
  secure, more friction) vs suspend/deactivate only.
- super-admin as a real membership row (cross-tenant audit attribution) vs
  claim-only with `isSuperAdmin` as the durable source.
- storage.rules lockdown ordering depends on auditing/relocating existing
  cross-tenant Storage files first.

**Frontend & mobile**

- `createBrowserRouter` data router (loaders calling repos — RN can't reuse) vs
  declarative `<Routes>` + centralized manifest.
- student-web: single app with `LearnerContext` (recommended) vs split B2B/B2C
  deployables.
- Response-side Zod validation: dev-only `safeParse` (assumed) vs always-on.
- Timestamp convention: epoch-millis vs ISO-8601 at the repo edge — must align
  across domain/API specs.
- RN transport (`react-native-firebase` vs REST); Expo managed vs bare for push;
  RN math rendering (WebView KaTeX vs native); parent mobile app (full Expo vs
  WebView wrapper); timed-test offline policy.

**Workspace & infra**

- `autograde/` sub-monorepo fate: fold into the primary platform (recommended)
  vs formally separate product.
- Is a dedicated `lvlup-staging` Firebase project budgeted/approved?
- Cutover/aliasing plan for renaming deployed function names to `v1.*` (validate
  against Firebase deploy constraints).

**Key risks**

- The common API layer is the critical-path dependency for RN, the gateway, and
  server-side aggregation — slipping it blocks everything downstream. It must
  land in Phase 0–1.
- Storage-rules lockdown and scanner-role unification are security-critical and
  gate the scanner app; they require a data audit before flipping rules to deny.
- The autograde pipeline cutover (dual-run reducer + triggers) is the
  highest-complexity backend change; the duplicated-status race must be
  eliminated, not duplicated.
- Content-format migration (TipTap-HTML → Markdown) is one-way and lossy if the
  `preprocessMath` shim misconverts — validate against real content before
  deleting the runtime path.
