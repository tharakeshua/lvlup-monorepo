# Review — Correctness & Data-Model Fidelity

**Perspective:** Correctness & data-model fidelity (does the plan faithfully
resolve D1–D14, are the discriminated union / effectiveRubric /
ALLOWED_TRANSITIONS real and internally consistent, and do any contracts
contradict the domain model).

**Files reviewed:** `SDK-LAYERS-PLAN.md` (master, all 9 §),
`SDK-SERVER-DESIGN.md`, `common-api.md`, `status/REVIEW-domain-data-model.md`,
`sdk-plan/layers/domain-core.md`, `sdk-plan/layers/api-client-core.md`,
`sdk-plan/domains/levelup-content.md`, `sdk-plan/domains/identity.md`,
`sdk-plan/domains/autograde.md`, `sdk-plan/domains/testsession-progress.md`,
`sdk-plan/domains/notification.md`.

**Bottom line.** The drift table (D1–D14) is conceptually resolved and the
_direction_ of every fix is right. But the plan is **internally inconsistent on
several load-bearing data-model facts** — the same entity is given different
status enums, different transition targets, different request/response shapes,
and different field names across the master plan, the layer plans, and the
domain plans. Because the plan explicitly leans on **build-time
`satisfies TransitionMap<S>`** and **`.strict()`** as its safety net, these
inconsistencies are not cosmetic: several of them will _fail `tsc`_ exactly
where the plan claims the compiler will catch drift, and at least one leaks an
authority-sensitive field (`costUsd`). The single most important content-core
artifact — the `UnifiedItem.payload` real discriminated union and all per-entity
field design — is deferred to a `domain-entities.md` plan **that does not
exist**.

---

## CD1 — testSession status enum and its transition targets contradict each other (build will fail)

**Severity:** BLOCKER **Where:** `domain-core.md` §7.2 (line 511) vs
`levelup-content.md` (entity line 33) vs `SDK-LAYERS-PLAN.md` §3.6 (line 253);
`domain-core.md` §7.4/§7.5
`TEST_SESSION_TRANSITIONS satisfies TransitionMap<TestSessionStatus>`.

**Problem.** `TestSessionStatus` is defined three different ways:

- `domain-core.md` §7.2: `'in_progress' | 'submitted' | 'expired' | 'graded'`.
- `levelup-content.md` entity + §3.6 master:
  `in_progress | completed | expired | abandoned`.
- The `testSession` transition table (master §3.6, levelup entity) targets
  `completed`, `expired`, `abandoned`.

The transition machine is authored
`as const satisfies TransitionMap<TestSessionStatus>`, whose key type is
`[From in S]`. If `TestSessionStatus` is the domain-core tuple
(`submitted`/`graded`), then `completed` and `abandoned` are **not members of
S**, so the `satisfies` assertion fails to compile — the exact build-time check
the plan advertises (top-risk #5). Conversely the domain-core enum omits
`completed`/ `abandoned` that every downstream consumer uses. There is no single
canonical `TEST_SESSION_STATUSES`.

**Resolution.** Pick ONE canonical tuple in
`domain-core.md/enums/test-session.ts` and make every other doc cite it. Given
the live writer and the transition table, the canonical set is
`['in_progress','completed','expired','abandoned'] as const` (drop
`submitted`/`graded`, which are not referenced by any transition or by the
`submitTestSessionService` flow). Update domain-core §7.2 line 511. Add a
contract test that the `satisfies` actually compiles (it is currently asserted
only in prose).

---

## CD2 — Tenant status enum (3 members) cannot satisfy the tenant transition map (5 states)

**Severity:** BLOCKER **Where:** `domain-core.md` §7.2 (line 512) vs
`identity.md` (line 21, §60 line 62) vs `SDK-LAYERS-PLAN.md` §3.6 (line 254).

**Problem.** `domain-core.md` §7.2 declares
`TENANT_STATUSES = 'active' | 'suspended' | 'deactivated'` (3 members). But
`identity.md` line 21 declares
`TenantStatus = active | suspended | trial | expired | deactivated` (5), and the
`ALLOWED_TRANSITIONS.tenant` table (identity §62, master §3.6) uses `trial` and
`expired` as both **keys** and **targets**
(`trial → {active,expired,suspended,deactivated}`, `active → {...,expired}`,
`expired → {active,deactivated}`). A
`TENANT_TRANSITIONS satisfies TransitionMap<TenantStatus>` with the 3-member
domain-core enum fails to compile (missing keys `trial`, `expired`; invalid
targets). It also breaks `tenantLifecycleCheck`'s `trial→expired` transition
(identity §304). Note further that `TenantPlan` also contains `trial` (identity
line 22) — `trial` as both a plan and a status is a separate modeling smell to
resolve, but the enum contradiction is the blocker.

**Resolution.** Canonicalize
`TENANT_STATUSES = ['trial','active','suspended','expired','deactivated']` in
domain-core §7.2 to match `identity.md` and the transition table; or, if the
lifecycle truly only has 3 states, strip `trial`/`expired` from the transition
table and from `tenantLifecycleService`. The former matches the live model and
the documented lifecycle, so prefer it. Make domain-core the single source.

---

## CD3 — Five of the nine declared transition tables are not in the domain-core aggregate

**Severity:** BLOCKER **Where:** `SDK-LAYERS-PLAN.md` §3.6 (lines 249–257, nine
tables) vs `domain-core.md` §1 `transitions/` dir (lines 74–80) + §7.5
`ALLOWED_TRANSITIONS` aggregate (lines 569–576, four members).

**Problem.** Master §3.6 enumerates **nine** transition tables: space, exam,
submission, **questionGrading**, testSession, **tenant**, **membership**,
**announcement**, **entityStatus**. The domain-core layer plan — the package
that actually owns `ALLOWED_TRANSITIONS` — only declares files and aggregate
members for **four**: `space`, `exam`, `submission`, `testSession`. Missing
entirely from domain-core: `questionGrading` (used by the whole autograde
grading pipeline, autograde §105
`assertTransition(ALLOWED_TRANSITIONS.questionGrading)`), `tenant` and
`membership` (identity §62–63, used by lifecycle/claims services),
`announcement` (identity §64), and `entityStatus` (identity §65, the
student/teacher/parent/staff/scanner/class/session active↔archived machine). Any
service calling `assertTransition('questionGrading', …)` or
`ALLOWED_TRANSITIONS.tenant` will reference a non-existent member. The
`canTransition`/`assertTransition` signatures in domain-core §7.5 are also typed
`D extends TransitionDomain` where
`TransitionDomain = keyof typeof ALLOWED_TRANSITIONS` — i.e. only the 4, so the
identity/autograde call sites won't even type-check.

**Resolution.** Add the five missing machines to `domain-core/transitions/`
(`question-grading.ts`, `tenant.ts`, `membership.ts`, `announcement.ts`,
`entity-status.ts`), each `satisfies TransitionMap<…>`, and include them in the
`ALLOWED_TRANSITIONS` aggregate. Update the `domain-core.md` §1 file tree and
§7.5 aggregate. Add the corresponding enums (`QUESTION_GRADING_STATUSES`,
`MEMBERSHIP_STATUSES`, `ANNOUNCEMENT_STATUSES`, `ENTITY_STATUSES`) explicitly.
The `transitions.assertion.test.ts` (domain-core §9) must iterate all nine, not
four.

---

## CD4 — `evaluateAnswer` response leaks the authority-sensitive `UnifiedEvaluationResult` (cost/internal)

**Severity:** BLOCKER **Where:** `levelup-content.md` API table (line 60) vs
`SDK-LAYERS-PLAN.md` §3.2 (line 206) vs `testsession-progress.md` (lines
138, 261) vs authority boundary §6.5.

**Problem.** `levelup-content.md` line 60 declares `v1.levelup.evaluateAnswer`
response as `{evaluation: UnifiedEvaluationResult, progressUpdated}`. But the
master plan §3.2 and `testsession-progress.md` §138/§261 both say the response
is the **compact `StoredEvaluation`**, with `UnifiedEvaluationResult` explicitly
NOT returned because it carries `costUsd` and internal fields. Per the authority
boundary (§6.5, and `UnifiedEvaluationResultSchema.costUsd? (⚷)` in
levelup-content §20), `costUsd` / cost telemetry is server-only and must never
reach a client. The levelup-content response contract therefore directly
contradicts the authority boundary it is supposed to uphold — and because the
response schema is `.strict()` and validated in dev, whichever shape ships is
load-bearing. This is a contract that contradicts the domain model AND the
security column.

**Resolution.** Make `evaluateAnswer` (and `submitTestSession`'s per-item
evaluation projection) return `StoredEvaluation` everywhere; delete the
`UnifiedEvaluationResult` response in levelup-content line 60. Define
`StoredEvaluationSchema` as the answer-stripped, cost-stripped projection in
`@levelup/domain`, and add a contract test asserting no client-facing response
schema embeds `UnifiedEvaluationResultSchema` (parallel to the no-answer-key
test).

---

## CD5 — `submitTestSession` request shape contradicts itself (carries answers vs not)

**Severity:** MAJOR **Where:** `SDK-LAYERS-PLAN.md` §3.2 (line 206:
`{sessionId,autoSubmitted?}`) vs `levelup-content.md` (line 59:
`{sessionId, submissions: Record<itemId,{answer,timeSpentSeconds}>, idempotencyKey}`)
vs C21 `saveTestAnswer` (§9.2 line 428).

**Problem.** The master plan's `submitTestSession` request is
`{sessionId, autoSubmitted?}` — i.e. answers were already persisted server-side
via the new `v1.levelup.saveTestAnswer` write-through (C21), so submit just
finalizes. The levelup-content domain plan's request is
`{sessionId, submissions: Record<…>, idempotencyKey}` — i.e. the client uploads
the **entire answer map at submit time**, the legacy model. These are mutually
exclusive runtime designs. If C21 (write-through to `submissions/{itemId}`) is
the intended model, then submit must NOT also accept a full submissions map
(that would create two answer-authority paths and an N+1 vs single-doc
inconsistency); if the bulk-submit model is intended, C21 is redundant. The plan
ships both, unreconciled.

**Resolution.** Choose the write-through model (it is the one that supports the
realtime deadline and the `submissions/{itemId}` subcollection explosion in D6):
`saveTestAnswer` persists each answer; `submitTestSession` request is
`{sessionId, autoSubmitted?}` and the server reads the subcollection. Remove the
`submissions` map from the levelup-content `submitTestSession` request. If a
one-shot fallback is needed for offline/scanner, model it explicitly as a
separate flag, not the default.

---

## CD6 — `idempotencyKey` declared as a request-body field contradicts the envelope-injection model

**Severity:** MAJOR **Where:** `levelup-content.md` (lines 59, 60, 61, 64) and
other domain tables vs `api-client-core.md` (§ lines 6, 20, 45:
`__idempotencyKey` envelope) vs `SDK-SERVER-DESIGN.md` §5.4.

**Problem.** `api-client-core.md` (and SDK-SERVER §5.4) specify that the
idempotency key is **generated by the api-client (UUID v7) and injected as an
`__idempotencyKey` envelope field**, stable across retries, deduped server-side
on `(uid, key)`. But the levelup-content (and autograde) per-callable request
tables list `idempotencyKey` as an explicit field _in the request schema_
(`submitTestSession … idempotencyKey`, `recordItemAttempt … idempotencyKey`,
`purchaseSpace … idempotencyKey`). Since all request schemas are `.strict()`, a
stray top-level `idempotencyKey` either (a) must be declared as a schema field —
which contradicts "generated by client, envelope-injected" and re-opens
client-supplied/forgeable keys — or (b) gets rejected by `.strict()` at parse
time. The two layers disagree on where the key lives.

**Resolution.** Remove `idempotencyKey` from every request _schema_; mark those
callables `idempotent: true` in `CallableDef`; rely on the api-client
`__idempotencyKey` envelope (api-client-core §4). Update all domain contract
tables to drop the field and instead annotate the `idempotent` column. Add a
contract test that no `.strict()` request schema declares `idempotencyKey`
(mirror of the `no-tenant-id` test).

---

## CD7 — `effectiveRubric` naming is inconsistent (snapshot field never actually named `effectiveRubric`)

**Severity:** MAJOR **Where:** `SDK-LAYERS-PLAN.md` §8 (line 388 "store both
resolved `effectiveRubric` snapshot and source
`rubricId`/`evaluationSettingsId`") and `levelup-content.md` §142 service
("resolve+store `effectiveRubric` + `rubricId`") vs the actual entity fields:
`UnifiedItem.rubric?` (levelup-content line 27),
`Space.defaultRubric?`/`StoryPoint.defaultRubric?` (lines 24, 26), autograde
question `effectiveRubric` (autograde §454).

**Problem.** The locked decision (SDK-SERVER §0, master §8) is "store the
resolved `effectiveRubric` snapshot + source `rubricId`". But no levelup entity
actually has a field named `effectiveRubric`: the item field is
`rubric?: UnifiedRubric` ("resolved snapshot"), Space/StoryPoint use
`defaultRubric?`, and only the autograde ExamQuestion is described as storing
`effectiveRubric`. So the same concept ("the resolved snapshot persisted at
write time") is named `rubric`, `defaultRubric`, and `effectiveRubric` across
three entities. A reader cannot tell whether `UnifiedItem.rubric` is the
_source_ rubric or the _resolved snapshot_ — the field name `rubric` is
ambiguous precisely where the review (D-content, §2) flagged the
embed-vs-reference ambiguity. The `rubricId` companion is present, but the
snapshot field's name is not canonical.

**Resolution.** Standardize the snapshot field name to
`effectiveRubric?: UnifiedRubric` on every entity that persists a resolved
rubric (`UnifiedItem`, `StoryPoint`, `Space` default, `ExamQuestion`), each
paired with `rubricId?`/`evaluationSettingsId?` source ref. Reserve the bare
name `rubric` only for the `RubricPreset.rubric` authored source. Update
levelup-content lines 24/26/27 and the saveItem contract (line 53 currently
sends `rubricId?` only — confirm the server resolves and writes
`effectiveRubric`, and that the read projection returns `effectiveRubric` not
`rubric`).

---

## CD8 — Announcement entity keeps `readBy: UserId[]`, contradicting the D6/D7 subcollection fix

**Severity:** MAJOR **Where:** `identity.md` Announcement entity (line 54:
`readBy: UserId[]`) vs `notification.md` (lines 110, 306, 416 — `readBy` →
`/announcements/{id}/reads/{uid}` subcollection) vs `SDK-LAYERS-PLAN.md` §2.7
(line 170) / D6 (line 380) / D7 (line 381).

**Problem.** The master plan, the notification domain plan, and the D6/D7
reconciliation all state the `Announcement.readBy` array is replaced by a
`/reads/{uid}` subcollection (the array is the exact "record-as-relation /
unbounded FK-array rewritten per read" anti-pattern D6/D7 are meant to kill, and
is client-mutable which violates the authority boundary). But the canonical
`AnnouncementSchema` in `identity.md` line 54 still declares `readBy: UserId[]`
as a persisted field. The authoritative entity schema therefore re-introduces
the very drift the plan claims to have resolved, and because identity owns the
Announcement entity, this is the binding definition.

**Resolution.** Remove `readBy: UserId[]` from `AnnouncementSchema`; the read
state lives only in the `/reads/{uid}` subcollection and is surfaced as the
derived `isReadByMe: boolean` on the list/detail view (per notification §110).
Update identity.md line 54. If a transition-period dual-read is needed, scope it
to the server admin adapter, never the domain entity.

---

## CD9 — Announcement transition table differs between master plan and identity domain

**Severity:** MAJOR **Where:** `SDK-LAYERS-PLAN.md` §3.6 (line 256:
`archived→[]`) vs `identity.md` §64 (line 64: `archived → {draft}`).

**Problem.** The master plan's announcement machine makes `archived` terminal
(`archived→[]`). The identity domain plan makes `archived → {draft}` (un-archive
back to draft). The
`ANNOUNCEMENT_TRANSITIONS satisfies TransitionMap<AnnouncementStatus>` will
encode one or the other, and the SDK pre-check + server enforcement read the
same table — so the UX (whether the "un-archive" button is enabled) and the
server's accepted transitions disagree depending on which doc the implementer
follows. Also note D5 says announcements "truly delete" (master D5, line 379)
rather than archive, which further muddies whether `archived` is even a state
announcements reach via `saveAnnouncement{delete}`.

**Resolution.** Pick one. Recommend `archived → [draft]` (matches the
entity-status active↔archived reversibility and gives admins an undo); update
master §3.6 line 256. Separately, reconcile D5's "announcements truly delete"
with the existence of an `archived` status + `archivedAt` field on the entity
(identity line 54) — decide whether `delete?=true` archives or hard-deletes an
announcement, and state it once.

---

## CD10 — The discriminated payload union has no single shared discriminant; `z.discriminatedUnion` as specified cannot bind

**Severity:** MAJOR **Where:** `levelup-content.md` (line 27, UnifiedItemSchema)
vs `common-api.md` (line 338, `z.discriminatedUnion('questionType', …)`) vs
review D-content/risk #3.

**Problem.** The review's core finding (D-content, top-risk #3) is that
`UnifiedItem.payload` is "NOT a true discriminated union … no shared
discriminant key (each member tags differently: `questionType`, `materialType`,
…)". The plan's fix description **reproduces that same structural problem**:
levelup-content line 27 says "Top-level discriminant `type`; nested
`payload.questionType` (15) / `payload.materialType` (7) / `interactiveType` /
`assessmentType`". A Zod `z.discriminatedUnion(key, members)` requires **one
literal discriminant key present on every member**. There is no single key here
— `type` lives on the item, the sub-tag lives inside `payload` and is named
differently per branch. Meanwhile common-api line 338 says the union
discriminates on `'questionType'` (which only exists for question items, not
material/interactive/ assessment). So the three sources disagree on the
discriminant, and none of them describes a shape Zod's `discriminatedUnion` can
actually validate as written. This is the single most important content-core fix
and it is under-specified to the point of being unbuildable as described.

**Resolution.** Specify the real structure: either (a) a top-level
`z.discriminatedUnion('type', [...])` over the 7 `ItemType`s, where each
member's `payload` is itself a nested
`z.discriminatedUnion('questionType'|'materialType'|…, [...])`, i.e. a two-level
nested discriminated union; or (b) flatten so each payload member carries a
single normalized `kind` literal. Write the concrete schema (at least the
question branch with its 15 members) in the missing `domain-entities.md` (see
CD11). Until the discriminant strategy is pinned, the "validate payload on
write" guarantee (saveItemService §142) is not implementable.

---

## CD11 — The `domain-entities.md` plan that owns the discriminated union and every per-entity field design does not exist

**Severity:** BLOCKER **Where:** `domain-core.md` §0 (line 15), §1 (line 86
`entities/ … detailed in sibling domain-entities.md`), §10 (line 663–666), §9 —
repeatedly defers entity field design and the `UnifiedItem.payload` real
`z.discriminatedUnion` to "the sibling `domain-entities.md` plan".

**Problem.** `domain-core.md` defers all per-entity field-by-field design —
including the single most important content-core artifact, the
`UnifiedItem.payload` discriminated union, the `effectiveRubric` snapshot shape,
`StoredEvaluation`, and every entity's branded-ID/timestamp authoring — to a
sibling `domain-entities.md`. That file **does not exist** (`ls` confirms; no
other spec references it). The domain plans (`levelup-content.md` etc.) describe
entities in prose tables but are not the authoritative schema-level spec
domain-core points to, and they themselves disagree with each other (CD1, CD4,
CD7, CD8). So the authoritative entity-schema layer — the bottom of the trust
cake that "unblocks everything" — has a hole exactly where correctness is
hardest (discriminated union, answer-key strip boundary, rubric snapshot). The
strict-authoring lint test (domain-core §9) iterates `entities/**` that is
unspecified.

**Resolution.** Author `domain-entities.md` before freeze, with the concrete
`.strict()` Zod for at least: the two-level `UnifiedItemSchema.payload`
discriminated union (all 15 question + 7 material members), the answer-bearing
fields that get stripped to `AnswerKeySchema`, `effectiveRubric`/`rubricId`,
`StoredEvaluationSchema` (the cost-stripped projection from CD4), and
`DigitalTestSessionSchema` with the `submissions/{itemId}` subcollection
boundary. Reconcile its enums against domain-core (CD1, CD2) so the `satisfies`
assertions compile.

---

## CD12 — Autograde drops `tenantId` from the entity shape, contradicting domain-core `TenantScoped` + collection-group queries

**Severity:** MINOR **Where:** `autograde.md` Exam entity (line 120: "`tenantId`
**removed from the entity shape** … kept only as a server-side annotation") vs
`domain-core.md` §4 `TenantScoped { tenantId: TenantId }` (line 316, "most
tenant docs carry their tenantId for collection-group queries +
defense-in-depth").

**Problem.** Autograde says it removes `tenantId` from the persisted Exam (and
presumably Submission) entity shape because the path is tenant-scoped. But (a)
domain-core §4 explicitly provides a `TenantScoped` mixin precisely so tenant
docs carry `tenantId` for **collection-group queries** and defense-in-depth, and
(b) the autograde watchdog scheduler is a **collection-group** query over
submissions (master §2.5 `staleSubmissionWatchdog (15 min, collection-group)`;
autograde) — a collection-group query cannot filter by tenant path and therefore
needs the `tenantId` field on the doc. Removing `tenantId` from the shape breaks
tenant-safe collection-group scans and diverges from the domain-core convention
every other entity follows. This is a real correctness/consistency gap, though
narrower than the enum/contract blockers.

**Resolution.** Keep `tenantId: TenantId` (via the `TenantScoped` mixin) on
persisted Exam/Submission/ QuestionSubmission docs as a server-written field (D2
only forbids it in the _request body_, not on the _stored entity_). Reconcile
autograde line 120 with domain-core §4. Confirm `staleSubmissionWatchdog`
filters collection-group results by `tenantId`.

---

## CD13 — `recordItemAttempt` request/response shapes disagree across master and domain plans

**Severity:** MINOR **Where:** `SDK-LAYERS-PLAN.md` §3.2 (line 206: req
`{…,score,maxScore,correct,…}` → `{progress,completed}`) vs `levelup-content.md`
(line 61: req `{…,answer,evaluationData?,timeSpent?,idempotencyKey}` →
`{progress: ItemProgressView}`) vs `testsession-progress.md` (line 143: req
`{…,itemType,score,maxScore,correct,timeSpent?,feedback?,answer?,evaluationData?}`).

**Problem.** Three different request field lists for the same callable
(`score/maxScore/correct` in master; `answer/evaluationData` in levelup-content;
the union of both plus `itemType/feedback` in testsession-progress), and two
different response shapes (`{progress,completed}` vs
`{progress: ItemProgressView}`). Since the request schema is `.strict()`, the
field list is binding — a client built against one table will be rejected by
another. The review (§5/§6.5) also notes the client-supplied `score` must be
re-validated server-side, which only matters if `score` is actually in the
schema (master/testsession say yes, levelup-content says no — it sends `answer`
instead).

**Resolution.** Converge on one request schema in `domain-entities.md`. Decide
whether the practice path sends a client-computed `score` (then server
re-validates, per §6.5) or sends the raw `answer` and the server scores it
(cleaner authority boundary). Recommend the latter for consistency with
`evaluateAnswer`; then drop `score/maxScore/correct` from the request. Pin one
response shape (`{progress: ItemProgressView, completed: boolean}`).

---

## CD14 — D6 reconciliation keeps `Record<>` relation maps it elsewhere says to explode (internal hedging)

**Severity:** MINOR **Where:** `SDK-LAYERS-PLAN.md` D6 (line 380) and
`levelup-content.md` §35 / §205 vs the D6 principle ("record-maps →
subcollections").

**Problem.** D6 is stated as "record-maps → subcollections", but the
reconciliation hedges: `SpaceProgress. storyPoints: Record<>` is "kept",
`StoryPointProgressDoc.items: Record<ItemId, ...>` is "kept but flagged for
per-item docs if large", and the session `submissions` subcollection cutover is
itself an open question (levelup-content open-Q #4, line 218 — "decide whether
v1 ships the subcollection explosion or defers"). So the D6 fix that the plan
reports as resolved is, for progress docs, explicitly _not_ resolved — the 1
MB-doc risk the review flagged (risk #10) for `StoryPointProgressDoc.items` on
large tests remains, gated behind a "if large" judgement call with no threshold.
This is honest but means D6 is partially open, not closed, and the status table
presenting it as reconciled is optimistic.

**Resolution.** State an explicit rule: keep `SpaceProgress.storyPoints` as a
bounded summary map (story points per space are few — acceptable), but commit
`StoryPointProgressDoc.items` and `DigitalTestSession.submissions` to
subcollections in v1 (items/submissions per story point are unbounded — the
actual 1 MB risk). Either way, set a concrete element-count or byte threshold
rather than "if large", and close levelup-content open-Q #4 before freeze.

---

## CD15 — `SDK-SERVER-DESIGN.md` still says 17 brands; `getMe`/`AuthContext` field names drift across specs

**Severity:** MINOR **Where:** `SDK-SERVER-DESIGN.md` §1.1 (line 88 "17 branded
IDs") and §3.2 `AuthContext` vs `domain-core.md` §2 (19 brands,
`BRAND_TAGS.length===19`) vs `common-api.md` §4.3 `AuthContext`
(`activeTenantId`) vs `SDK-SERVER-DESIGN.md` §3.2 (`tenantId`).

**Problem.** Minor but real drift in supposedly-canonical artifacts: (a)
SDK-SERVER §1.1 ascii still says "17 branded IDs" while the frozen count is 19
(domain-core §10 line 644 flags it as stale but it is not fixed in the source
doc). (b) `AuthContext.tenantId` (SDK-SERVER §3.2) vs
`AuthContext.activeTenantId` (common-api §4.3) — two names for the claim-derived
active tenant; services read `ctx.tenantId` (SDK-SERVER §5.2) so common-api is
the stale one. These are the kind of small schisms the rebuild exists to
eliminate, appearing inside the rebuild's own spec set.

**Resolution.** Fix SDK-SERVER §1.1 to "19". Canonicalize `AuthContext.tenantId`
(drop `activeTenantId`) and update common-api §4.3. Cheap edits; worth doing so
the frozen spec doesn't seed the next drift cycle.

---

## Notes on what IS faithfully resolved (for calibration, not praise)

- D2 (tenantId from claims, never body) is structurally enforced
  (`no-tenant-id-in-request.test.ts`, `allowsTenantOverride` flag, super-admin
  `tenantOverride` only) — consistent across all reviewed docs.
- D3 (authUid, drop uid), D10 (parentLinkedStudentIds/studentIds, drop
  childStudentIds), D11 (scanner tenant-scoped + authUid) are consistently
  specified in identity.md and the master D-table.
- D4 (ISO Timestamp + `toTimestamp` edge adapter, RTDB epoch-ms as the one
  fenced exception, `zTimestamp` vs `zTimestampInput` with lint containment) is
  well-specified in domain-core §3.
- D8 (19 brands authored _into_ schemas via `zBrandedId` + `z.infer`,
  `BRAND_TAGS.length===19`) is consistent (modulo the stale "17" in SDK-SERVER,
  CD15).
- D9 (`zObject()`=`.strict()` only factory, types via `z.infer`, lint bans raw
  `z.object`) is sound.
- The branded-ID and timestamp contract tests are concretely specified. These
  are not at issue; the issues are the enum/transition/contract _inconsistencies
  between documents_ above.
