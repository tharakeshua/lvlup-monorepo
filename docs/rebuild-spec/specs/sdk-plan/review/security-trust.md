# Security & Trust-Boundary Review — FROZEN-CANDIDATE SDK Rebuild Plan

**Perspective:** Security & trust-boundary. **Question set:** Do all 13 ⚷
authority items stay server-only? Is `tenantId` claim-only? Is
no-direct-Firestore airtight? Storage path scoping (C1/C22)? Impersonation
(C28)? Token revocation on lifecycle? Pre-auth minimal projection? Optimistic
allow-list excludes every authority write?

Findings are ordered by severity. Each is a self-contained section.

---

## SEC-01 — Realtime read path bypasses server projection and leaks grading outputs pre-release

- **Severity:** BLOCKER
- **Where:** `transport-realtime.md` §`SUBSCRIPTION_SOURCES`
  (`v1.autograde.gradingStatus`, `v1.autograde.examGrading`,
  `v1.levelup.spaceProgressLive`); `autograde.md` line 190-191
  (`SubmissionStatusSchema` payload =
  `{ pipelineStatus, retryCount, gradingProgress, summary, updatedAt }`);
  `common-api.md` §1 Non-Goals (rules rewrite is OUT of scope);
  `SDK-LAYERS-PLAN.md` §3.3 SUBSCRIPTIONS.

- **Problem.** The realtime subscriptions read **raw Firestore documents
  directly on the client** (`subscribeViaFirestore` →
  `onSnapshot(doc(`tenants/{t}/submissions/{submissionId}`))`). Unlike every
  callable read (`getSubmission`, `listQuestionSubmissions`), the realtime path
  has **no server-side `authorize()` and no role-aware projection** —
  `transport-realtime.md` §1 explicitly states "No domain logic, no shaping ...
  live here." Its only gate is `validatePayload` (a shape parse), not an
  authority check.

  Two of the 13 ⚷ items are therefore exposed on a path the plan does not
  protect:
  1. **Grading outputs (⚷ §6.5) / resultsReleased gate (⚷ §6.10).** The
     `gradingStatus` payload schema includes `summary` =
     `SubmissionSummary { totalScore, maxScore, percentage, grade }`
     (autograde.md:129). A student/parent who subscribes to
     `gradingStatus{submissionId}` receives the **score the moment grading
     completes — before `resultsReleased` is set**. The callable path enforces
     this gate (`listSubmissionsService`/`getSubmissionService` "enforces
     `resultsReleased` gate for student/parent", autograde.md:359); the realtime
     path silently does not. This defeats the headline §6.10 visibility gate.
  2. **Progress (⚷ §6.9).** `spaceProgressLive{spaceId,userId}` lets any
     authenticated user pass an arbitrary `userId` param and read another
     student's live progress doc, with no server check that
     `userId ∈ ctx.studentIds`/self.

  The plan's _only_ stated mitigation for these client-direct reads is "deny-all
  rules as defense-in-depth" (SDK-SERVER §7.2) — but the **Firestore rules
  rewrite is explicitly a Non-Goal** (common-api.md §1) and is described as
  "rules remain _defense-in-depth_ behind this API." So the realtime read path's
  authority enforcement is delegated to a rules layer that this plan does not
  own, does not specify, and the data-model review (REVIEW D13, §6.10/§6.12)
  documents as **currently broken** (missing/over-permissive rules on
  `submissions`, summaries, etc.). There is no contract test, no `authorize()`,
  and no projection on the realtime read path.

- **Resolution.** Make the realtime read path authority-equivalent to the
  callable read path. Concretely: (a) point
  `gradingStatus`/`examGrading`/`spaceProgressLive` at a **server-maintained
  projection document** that contains only release-gated, role-safe fields (e.g.
  a `submissions/{id}/public` mirror that omits `summary.totalScore` until
  `resultsReleased`, written by
  `advancePipelineService`/`releaseResultsService`); the live listener reads
  only the projection, never the authoritative doc. (b) Drop `summary` (and any
  score/percentage/grade) from `SubmissionStatusSchema` — keep only
  `{ pipelineStatus, gradingProgress, updatedAt }`; the score arrives via
  `getSubmission` which enforces the gate. (c) Add a hard
  requirement+owning-spec that the realtime-backing docs/nodes have
  **deny-by-default rules with explicit per-path role/ownership/release
  predicates**, and a contract/emulator test that a non-released submission's
  score is unreadable by a student subscriber. (d) Promote the firestore.rules
  rewrite from Non-Goal to an in-scope deliverable of this rebuild, since the
  entire client-direct read/subscribe surface depends on it being correct.

---

## SEC-02 — Firestore security rules are out of scope, yet every client-direct read/subscribe depends on them

- **Severity:** BLOCKER
- **Where:** `common-api.md` §1 Non-Goals ("The Firestore security-rules rewrite
  ... — rules remain _defense-in-depth_"); `SDK-LAYERS-PLAN.md` (no rules
  section); `lint-boundaries.md` R8 (Firestore confined to admin adapter on the
  _client SDK_ side only); REVIEW §6 #12/#13, D13.

- **Problem.** The plan's authority model assumes that callables are the _only_
  read/write path, so server `authorize()` + projections are the enforcement
  point. That holds for callable reads — but **two client-direct Firestore
  surfaces remain**: (1) all realtime subscriptions (SEC-01), and (2) Storage
  object reads/writes (SEC-03). For both, the only authority boundary is
  **Firestore/Storage security rules**, which the plan declares out of scope.
  The REVIEW this plan is built on lists the _current_ rules as materially
  broken: pre-auth tenant enumeration (#12), blanket Storage
  `if request.auth != null` (#13), missing rules on materialized analytics
  (D13), `studentProgressSummaries` unreadable by rules while parent app needs
  them (§5). A rebuild whose security rests on a layer it explicitly does not
  redesign, while that layer is documented as broken, is unsound.
  "Defense-in-depth" only works when the primary defense exists; here the rules
  ARE the primary defense for the subscribe/Storage paths.

- **Resolution.** Add a first-class **Security Rules + Storage Rules layer
  plan** to the rebuild (a `layers/security-rules.md` peer of
  `lint-boundaries.md`), generated from the same key registries the plan already
  centralizes (`TENANT_ROLES`, `TEACHER_PERMISSION_KEYS`, `ALLOWED_TRANSITIONS`,
  the §6 authority list). Make rules-gen consume the access-policy table so
  rules and `@levelup/access` cannot drift. Require: deny-by-default on every
  collection; explicit predicates for the exact docs/nodes any subscription
  reads; AnswerKey/answer-key subcollection `read,write:if false` under the
  single canonical path; emulator rules tests as a required CI gate. Until this
  lands the plan is not shippable from a trust standpoint.

---

## SEC-03 — Storage path scoping (C1/C22) under-specified; ownership/role predicate and read-side scoping not pinned

- **Severity:** MAJOR
- **Where:** `SDK-LAYERS-PLAN.md` §9.1 C1 (`requestUploadUrl`), §9.2 C22
  (`uploadUserAsset`), §6 row §6.13; identity.md
  `exportTenantData`/`uploadTenantAsset`; REVIEW #13.

- **Problem.** C1 says the signed-PUT path "⊂ `tenants/{ctx.tenantId}/…`;
  tenant+role+ownership scoped per §6.13" and the service "validates path scope"
  — but the _predicate_ is never specified. Open gaps: (a) **Read scoping is
  absent.** C1/§6.13 cover write (signed PUT) and `exportTenantData` returns a
  `downloadUrl`, but nothing specifies who may _read_ an existing
  answer-sheet/question-paper object. The signed download URL is a bearer
  capability — if `exportTenantData`/`getSubmission` hands a student a URL into
  another student's answer sheet, tenant-path scoping does not help. REVIEW #13
  flags exactly this (blanket `auth != null` read today) and the plan does not
  state the per-object read predicate. (b) **Ownership for scanner/teacher.** A
  scanner role uploading an answer-sheet must be constrained to its tenant _and_
  the exam/class it is authorized for; "role+ownership scoped" is asserted but
  the rule (e.g. `studentId`/`classId ∈ ctx.classIds`) is not written. (c) **C22
  avatar** writes `photoURL`/`consumerProfile` — confirm the object path is
  `users/{ctx.uid}/...` and cannot be aimed at another uid. (d) Signed-URL **TTL
  and content-type/size enforcement** are unstated (an over-long TTL is a
  standing exfil capability).

- **Resolution.** Specify in the autograde/identity domain plans the exact
  Storage path grammar and the read+write predicate per `kind`: answer-sheet
  `tenants/{t}/exams/{examId}/submissions/{submissionId}/...` readable only by
  teacher-of-class / owning-student-after-release / super-admin; avatar
  `tenants/{t}/users/{uid}/avatar` writable only by `uid`. Make
  `requestUploadUrlService` validate `studentId/classId ∈ ctx` (scanner) and
  `uid === ctx.uid` (avatar) before signing. Pin signed-URL TTL (short, e.g. ≤10
  min) and enforce `contentType`/max-bytes at sign time. Add the Storage rules
  to the SEC-02 rules layer with emulator tests for cross-tenant and cross-owner
  denial.

---

## SEC-04 — `startImpersonation` (C28) mints a session token: audit/constraint/revocation under-specified, and it punches a hole in the claim-only tenant boundary

- **Severity:** MAJOR
- **Where:** `SDK-LAYERS-PLAN.md` §9.3 C28; coverage `web-super-admin.md` G4;
  identity.md (C28 is NOT present in the identity domain plan — confirmed absent
  from §entities/§services).

- **Problem.** C28 `startImpersonation {targetUid, tenantId, reason}` →
  `{sessionToken, expiresAt}` is described only as "time-boxed, fully audited,
  constrained claims." This is the single most dangerous capability in the
  system (a super-admin assumes another user's identity), and it is
  under-specified on every axis that matters:
  1. **The `tenantId` is taken from the request body.** This is the one place a
     `tenantId` field legitimately appears in a request, but the plan's blanket
     rule ("`tenantId` claim-derived, never in body; super-admin
     `tenantOverride` only") and the `no-tenant-id-field` lint/contract test
     (R11) will either (a) reject this schema, or (b) be weakened to whitelist
     it — and the whitelist mechanism (`allowsTenantOverride`) names the field
     `tenantOverride`, not `tenantId`. C28 uses `tenantId`. The plan does not
     reconcile C28 against R11; left as-is it is either a build failure or a
     silent precedent that re-opens the body-tenantId class.
  2. **No audit record shape.** "fully audited" is asserted but `writeAudit` is
     best-effort/non-blocking (server-shared §2.10). For impersonation, the
     audit write must be **synchronous and transactional with token mint**
     (fail-closed): if the audit write fails, no token is issued. This is not
     stated.
  3. **"Constrained claims" are undefined.** What is removed? An impersonation
     session must not itself be able to start a further impersonation, mint
     claims, or perform super-admin platform writes. The constraint set is the
     whole point and is left as a TODO.
  4. **No revocation / no session ledger.** A minted custom token, once handed
     out, is valid until the underlying user's tokens are revoked. There is no
     `endImpersonation`, no impersonation-session doc, and no statement that the
     session is revoked at `expiresAt`. `expiresAt` on the _token_ is not the
     same as revoking the _refresh token_ it produces.

- **Resolution.** Give C28 a full sub-spec in identity.md: (a) Use a dedicated
  `tenantOverride` (not `tenantId`) field and add the def to the R11 super-admin
  whitelist explicitly, OR carry the target tenant out-of-band; document the
  reconciliation. (b) Make audit synchronous+transactional with mint
  (fail-closed) and define the `ImpersonationAudit` record (actor uid, target
  uid, tenant, reason, issuedAt, expiresAt, sessionId). (c) Define the
  constrained claim set explicitly: an `impersonating:true` + `impersonatorUid`
  claim, with `isSuperAdmin` forced false and `authorize()` denying
  `claims.sync`, `membership.write`, all `tenant.*` platform ops, and nested
  impersonation while that claim is present. (d) Add an impersonation-session
  ledger doc and an `endImpersonation`/auto-expiry that calls
  `revokeRefreshTokens(targetUid)`; short TTL (minutes).

---

## SEC-05 — Token revocation on lifecycle/role change is asserted but not mechanically guaranteed

- **Severity:** MAJOR
- **Where:** identity.md §services (`syncMembershipClaimsService`
  "revokeRefreshTokens on role/status change"), `onTenantDeactivated` outbox;
  server-shared §5.2 `ClaimsRepo.revokeRefreshTokens`; C26 `setUserStatus`;
  REVIEW #8 (suspended/role-changed users keep valid claims ~1h).

- **Problem.** REVIEW #8 is a named current bug: without revocation, a suspended
  or role-downgraded user keeps a valid JWT (and thus valid claims, valid rules
  access) for up to ~1 hour. The plan correctly adds `revokeRefreshTokens`, but
  enforcement is **by convention, not by mechanism**:
  - The contract test inventory (server-shared §8 test #11) asserts every
    role/status/class/permission-changing service **calls
    `syncMembershipClaims`** — but it does _not_ assert that
    `syncMembershipClaims` (or the service) **calls `revokeRefreshTokens`** when
    role/status changes. A service can sync claims (mint new ones) without
    revoking the old token, leaving the user authenticated on the _stale_ token
    until natural expiry.
  - `revokeRefreshTokens` only invalidates sessions if the server **also checks
    token issue-time** (`auth.token.auth_time` / `tokensValidAfterTime`).
    Firestore rules do not do this automatically, and the realtime/Storage
    client-direct paths (SEC-01/03) read with whatever token the client holds.
    Revoking refresh tokens does not retroactively kill an already-issued ID
    token's ~1h validity unless rules/checks enforce `auth_time`. The plan never
    states this check.
  - `setUserStatus` (C26) and `deactivateTenant` list "revoke tokens" but the
    fan-out is via outbox (eventually-consistent) — there is a revocation _lag
    window_ during which a just-disabled user is still fully authorized on the
    client-direct paths.

- **Resolution.** (a) Strengthen test #11 to assert: any service that changes
  `role`/`status`/`isSuperAdmin`/permissions calls `revokeRefreshTokens(uid)` in
  the same transaction/outbox unit as the claim rewrite (static + emulator). (b)
  Document and enforce a server-side `auth_time`/`tokensValidAfterTime` check on
  every authority-sensitive callable and in the Firestore/Storage rules
  (SEC-02), so a revoked user is locked out within the rules layer, not only
  after 1h token expiry. (c) State the acceptable revocation-lag SLO for the
  outbox fan-out and gate the _most_ sensitive actions (super-admin disable,
  tenant deactivate) on a synchronous revoke before returning success.

---

## SEC-06 — Pre-auth `lookupTenantByCode` is rate-limited as `auth` tier but still enables tenant-code enumeration

- **Severity:** MINOR
- **Where:** identity.md `lookupTenantByCode` (`authMode: public`,
  `rateTier: auth`); REVIEW #12; `SDK-LAYERS-PLAN.md` §2.1.

- **Problem.** The plan correctly closes the _direct Firestore_ enumeration leak
  (REVIEW #12) by removing the pre-auth `get` on `/tenants` and `/tenantCodes`
  and routing through a callable that returns only
  `TenantPublicView {tenantId,name,status,branding}`. Good. But the public
  callable still answers "does tenant code X exist (and here's its
  name/branding)" to an **unauthenticated** caller, throttled only by the `auth`
  rate tier. An attacker can still enumerate valid tenant codes and harvest
  tenant names/branding at the tier's rate. The projection is minimal (no PII),
  so this is low-impact, but it is still an unauthenticated existence+branding
  oracle, and the plan presents §6.12 as "closed."

- **Resolution.** Accept-and-document the residual oracle as an intentional
  trade-off (school-code login UX requires it), but (a) ensure the public rate
  tier is **per-IP**, not per-uid (there is no uid pre-auth), with a low ceiling
  and exponential backoff on repeated misses; (b) return an identical response
  shape/time for hit vs miss where feasible to avoid a timing oracle; (c)
  consider returning `404`-equivalent (not "found vs not found" distinguishable)
  until a valid code+second factor. Re-label §6.12 as "minimized, residual
  enumeration accepted" rather than "closed."

---

## SEC-07 — `super-admin tenantOverride` is honored but the audit is best-effort and the override-field whitelist is fragile

- **Severity:** MINOR
- **Where:** server-shared §2.2 `buildAuthContext` (step 8: "sets a flag the
  onCall adapter reads to `writeAudit('tenantOverride', ...)`"), §2.10
  (`writeAudit` best-effort/non-blocking); §8 test #7 (whitelist of defs
  carrying `tenantOverride`); SDK-SERVER §3.2.

- **Problem.** Cross-tenant super-admin operations are the highest-trust writes
  in the system (they mutate another tenant's data). Two weaknesses: (1) the
  audit of an override is **best-effort, non-blocking** — a cross-tenant write
  can succeed with no durable audit trail if the audit write drops. (2) The
  "only super-admin defs declare `tenantOverride`" guarantee rests on test #7
  maintaining a **hand-maintained whitelist**. A new cross-tenant callable that
  forgets to register, or a typo, silently either fails closed (acceptable) or —
  if the override extraction is permissive — could honor an override on a
  non-whitelisted def. The plan's
  `extractTenantOverride(request.data, /*isSuperAdmin gate inside*/)`
  (on-call.ts) is the single choke point but its exact gating ("honored ONLY if
  isSuperAdmin") is correct only if every def's schema actually forbids the
  field for non-super-admin defs.

- **Resolution.** (a) Make the tenant-override audit **synchronous and
  fail-closed** for any write performed under override (no audit → no write).
  (b) Derive the override-whitelist from a declarative
  `allowsTenantOverride: true` flag on `CallableDef` (data, not a separate test
  list) and have R11's contract test assert the biconditional: a def has a
  `tenantOverride` field **iff** `allowsTenantOverride === true` **iff** its
  access rule is `super-admin-only`. This collapses three
  independently-maintained lists into one and removes the drift surface.

---

## SEC-08 — Optimistic allow-list is well-guarded, but `markNotificationRead`/badge-decrement touches a ⚷ counter

- **Severity:** MINOR
- **Where:** `SDK-LAYERS-PLAN.md` §4.4 (optimistic allow-list includes
  `markNotificationRead` "flip isRead + decrement badge", `markAchievementsSeen`
  "decrement unseenCount"); §6 §6.9 (notification badge `unreadCount`,
  `StudyGoal.currentCount` are ⚷ denormalized counters); query-infra §4.x
  authority guard.

- **Problem.** The plan does an excellent job mechanizing "never optimistic on
  authority-sensitive writes" (R10 lint + `authoritySensitive` flag + runtime
  guard). But the allow-list permits **client-side decrement of denormalized
  counters** that §6.9 lists as ⚷ server-only (`unreadCount`, `unseenCount`).
  This is benign for correctness (reconciled against the server response), but
  it means the optimistic recipe _writes a ⚷ counter into the cache_, and the
  conceptual line "SDK reads counters, never writes" (§6.9, SDK-SERVER §4) is
  crossed in the cache layer. The risk is not the cache value itself but
  precedent: the allow-list rationale ("low-risk/high-frequency, reconciled") is
  sound, yet it is now the one place a ⚷ counter is client-mutated, and a future
  author may cite it to justify optimistic on a more sensitive counter (e.g.
  progress points, leaderboard rank).

- **Resolution.** Keep the behavior (it is genuinely low-risk) but tighten the
  contract: explicitly document that the optimistic-allowed counter patches are
  **UI-affordance counters only** (`unreadCount`, `unseenCount`) and add them to
  a named, closed `OPTIMISTIC_COUNTER_ALLOWLIST` distinct from the general
  allow-list, with a test asserting no progress/score/points/rank/purchase
  counter is ever in it. This prevents the precedent from drifting onto a real
  authority counter.

---

## SEC-09 — `saveTenant` carries `geminiApiKey` in the request body; key-handling path not pinned to write-only

- **Severity:** MAJOR
- **Where:** identity.md `saveTenant`
  (`data: { ..., geminiApiKey?(→Secret Manager) }`); §entities Tenant
  (`settings.geminiKeyRef` "never the key value"); C31
  `Tenant.subscription.aiBudgetUsd`; server-shared §4.4 secrets; REVIEW #6/AI.

- **Problem.** The plan is correct that the Gemini key lives in Secret Manager
  and `geminiKeyRef` (never the value) is the only thing persisted/returned. But
  the **inbound** path — accepting the raw `geminiApiKey` in the `saveTenant`
  request body — needs explicit handling guarantees that are not stated: (a) the
  key must be written **straight to Secret Manager and never to Firestore** (not
  even transiently), and the `saveTenantService` must strip it before any
  `ctx.repos.tenants.upsert`; (b) the key must **never appear in
  `getTenant`/`listTenants` responses, audit logs, or LLM logs**; (c)
  `saveTenant` is super-admin-only today, but C11 ("tenant-admin `saveTenant`
  write split ... branding/contact/features/geminiApiKey only") would let a
  **tenant-admin set their own tenant's Gemini key** — that is a
  privilege/cost-attack surface (a tenant-admin could point billing at an
  attacker-controlled key or exfiltrate via a key they control) that needs its
  own authorize gate and audit. None of these are pinned.

- **Resolution.** In identity.md `saveTenantService`: (a) document that
  `geminiApiKey` is consumed → `secretManager.put(secretNameFor(tenantId))` →
  field deleted from `input.data` before any repo write, with a test that no
  Firestore tenant doc/audit/LLM log ever contains a value matching the key. (b)
  Add `responseSchema` assertions/tests that `geminiKeyRef`-only (never
  `geminiApiKey`) is returned. (c) If C11 lands, gate `geminiApiKey` writes
  behind a distinct `tenant.ai.key.write` action that tenant-admins get only
  with explicit policy + mandatory audit, and confirm cost/quota is still
  enforced server-side regardless of whose key it is.

---

## SEC-10 — `getItemForEdit` answer-key re-merge: client cache isolation is solid, but no authority check is specified on the realtime/offline replay path

- **Severity:** MINOR
- **Where:** query-infra §4.3 (`EDIT_ITEM_SCOPE`, `isSensitiveKey`,
  `gcTime:0/staleTime:0`, excluded from persist); access §1.4
  (`item.readForEdit` authoring-only); REVIEW §6.4/§6.7, open-Q 7.1.3.

- **Problem.** The answer-key cache isolation is one of the strongest parts of
  the plan (non-persisted scope, sensitive-key predicate, contract test that the
  offline persister rejects `isSensitiveKey`). Two residual gaps: (1) the
  isolation is enforced for the **persisted/offline** store, but nothing states
  the in-memory `gcTime:0` item is purged on **logout / tenant switch** —
  `resetForTenantSwitch` does `qc.clear()` (good for switch), but a plain logout
  path is not mentioned, and an answer-bearing item left in memory after a
  role/session change is a leak window. (2) `item.readForEdit` is authoring-only
  on the **callable** path; confirm there is no realtime subscription or Storage
  object that re-exposes `evaluatorGuidance`/`modelAnswer` outside that gate
  (the rubric snapshot on `ExamQuestion`/`UnifiedItem` is read by
  `listQuestions`/`listItems` which strip guidance — good — but the editor's
  re-merged item must never become a subscription payload).

- **Resolution.** (a) Add logout to the `qc.clear()` contract (clear on any
  auth-state transition, not only tenant switch) and test that no
  `EDIT_ITEM_SCOPE` key survives sign-out. (b) Add an explicit invariant + test:
  no `SUBSCRIPTIONS` payload and no Storage object ever contains
  answer-key/guidance fields; the only re-merge site is `getItemForEditService`
  gated by `item.readForEdit`.

---

## Summary

The core trust architecture is strong: `tenantId` is structurally claim-only (no
request field; R11 lint + contract test), the
no-direct-Firestore-on-the-client-SDK boundary is mechanically enforced (R8 +
RN-purity bundle gate), services are `fn(input,ctx)` with a single `authorize()`
policy, the optimistic allow-list excludes grading/publish/lifecycle/purchases
with a lint guard, and the callable read path applies role-aware projections
(released-gate, guidance-strip, answer-key strip).

The serious gaps are all on the paths the plan does **not** treat as
first-class: (1) the **realtime subscribe path** reads raw Firestore docs with
no server authorize/projection and leaks grading scores pre-release (SEC-01);
(2) **Firestore/Storage security rules** — the sole enforcement for subscribe +
Storage — are declared out of scope while the REVIEW documents them as broken
(SEC-02); (3) **Storage path scoping** lacks a read-side/ownership predicate
(SEC-03); (4) **impersonation** (SEC-04) and **token revocation** (SEC-05) are
asserted but not mechanically guaranteed; and (5) the **inbound Gemini key**
handling is unpinned (SEC-09). SEC-01 and SEC-02 are blockers because they let
two of the 13 ⚷ items (grading outputs, progress) reach an untrusted client on a
path with no server authority check.
