# UI-Coverage Completeness Review — FROZEN-CANDIDATE SDK Plan

> **Perspective:** UI-coverage completeness. Re-audit of the "100% coverage →
> PASS on §9" claim across all 8 apps. **Inputs read:** `SDK-LAYERS-PLAN.md`
> (incl. §9 C1–C31), `SDK-UI-COVERAGE-MATRIX.md`, `common-api.md`,
> `REVIEW-domain-data-model.md`, all 8 `coverage/*.md`,
> `domains/{identity,levelup-content,autograde}.md`,
> `layers/{query-infra,transport-realtime}.md`. **Bottom line:** Read-path
> coverage is genuinely strong and the answer-key cache-scope rule is correctly
> specified. BUT the headline "100%-covering" claim is **not realized** — the 31
> closure capabilities (C1–C31) live ONLY in §9 and the matrix; none are
> propagated into the per-domain/per-layer plans the build sessions consume. C1
> (Storage) and C2 (notif-prefs) are NOT fully resolved as claimed. Several
> tallies are arithmetically inconsistent, and the auth seam (C3) is
> mis-severitied: it hard-blocks login on parent/scanner.

---

## UC-1 — §9 C1–C31 are orphaned: not propagated into any per-domain or per-layer plan

**Severity:** BLOCKER **Where:** `SDK-LAYERS-PLAN.md §9` vs
`domains/{identity,levelup-content,autograde,analytics,notification,...}.md`,
`layers/{transport-realtime,query-infra,api-contract-core,server-shared}.md`;
cross-checked against master §3.2/§4.1/§4.2/§4.3/§5.4. **Problem:** The plan
declares "With all 31 (C1–C31) added to §9 … the plan becomes 100%-covering" and
the matrix verdict flips CONDITIONAL-PASS→PASS on that basis. But C1–C31 are
present in exactly TWO files (master §9 + the matrix). Grep confirms ZERO of the
24 new callables / repos / hooks appear in:

- the master plan's own **§3.2 CALLABLES map** (the canonical "~90 callable"
  registry) — e.g. `requestUploadUrl`, `saveTestAnswer`, `getStoryPoint`,
  `saveExamQuestion`, `getSubmissionForExam`, `listSpaceProgressForUser`,
  `listParentAlerts`, `listPlatformActivity`, `setUserStatus`,
  `startImpersonation`, `getPlatformConfig`, `registerDeviceToken`,
  `assignContent`, `generateContent`, `estimateAudience`, `listExportJobs`,
  `uploadUserAsset`, `deleteConsumerAccount`, `updateMyProfile`,
  `saveTenantFeatures` are all absent.
- **§4.1/§4.2** repos & key-factories (no `storageRepo`, `deviceRepo`,
  `assignmentRepo`, `aiGenerationRepo`, `messageRepo`,
  `notificationPreferenceRepo`, `platformConfigRepo`, `activityRepo`,
  `presetRepo` list).
- **§4.3 INVALIDATION_GRAPH** and **§5.4 ACCESS_RULES** action list (none of the
  ~24 new mutating callables have an invalidation entry or an `authorize()`
  action).
- The **per-domain plans**: `domains/autograde.md` has no
  `requestUploadUrl`/`saveExamQuestion`/`getSubmissionForExam`/`uploadedBy`/`confidenceSummary`;
  `domains/identity.md` has no
  `registerDeviceToken`/`estimateAudience`/`setUserStatus`/`startImpersonation`/`getPlatformConfig`/`updateMyProfile`/`uploadUserAsset`/`deleteConsumerAccount`/`authRepo`/`Class.schedule`/`listExportJobs`/notif-prefs
  callables; `domains/levelup-content.md` has no
  `assignContent`/`generateContent`/`saveTestAnswer`/`getStoryPoint`/`listSpaceProgressForUser`.
- The **transport layer** (`transport-realtime.md`) has NO Storage adapter at
  all (the only client Storage site C1 requires).

§9 itself admits the work is undone ("C1–C31 add ~24 callables … each mutating
callable **needs** an INVALIDATION_GRAPH entry and a … ACCESS_RULES action"). So
"100%-covering" is a forward-looking promise, not a realized state. A build
session consuming the per-domain plans (the stated consumers) will build none of
these, and the contract-integrity tests (`registry-integrity`, ACCESS_RULES
completeness, INVALIDATION_GRAPH totality) will be green against a registry that
silently omits every gap-closing capability — masking the omission.
**Resolution:** Treat §9 as a worklist, not a closure. Before declaring PASS:
(a) fold every C1–C31 callable into the master §3.2 CALLABLES map with its
`CallableDef` (authMode/rateTier/idempotent/invalidates/authoritySensitive); (b)
add each repo/hook to §4.1/§4.2 and each mutating callable to §4.3
INVALIDATION_GRAPH and §5.4 ACCESS_RULES; (c) write each into its owning
per-domain plan's entity/callable/repo/hook/service tables; (d) add the Storage
adapter to `transport-realtime.md` (or a new `transport-storage` section). Until
(a)–(d) land, the verdict is CONDITIONAL-PASS, not PASS.

---

## UC-2 — C1 (Storage byte-upload) is named but under-specified across the design; not a complete fix

**Severity:** BLOCKER **Where:** `SDK-LAYERS-PLAN.md §9.1 C1`, §6.13;
`domains/autograde.md`; `layers/transport-realtime.md`; `SDK-SERVER-DESIGN.md`.
**Problem:** C1 is the single most important missing write (blocks the scanner's
entire capture→submit path per `coverage/mobile-scanner.md` G1, and web-teacher
#44/#49). The §9 entry names a callable + repo + hook + "transport-firebase adds
the typed Storage adapter," but this is a one-line stub:

- No client-side Storage adapter exists anywhere in `transport-realtime.md` (the
  file that owns the only client firebase site for invoke/subscribe). The
  Transport interface in §3.1/§3.3 has
  `invoke`/`subscribe`/`serverTimeOffset`/`refreshToken` — no
  `upload`/`requestUploadUrl`. Adding a 4th transport capability is an
  architectural change to the `Transport` contract, not a leaf addition, and is
  unscoped.
- The signed-PUT-vs-direct-putFile decision is left open ("Either (a) signed PUT
  URL … or (b) a typed Storage adapter") — these have different security models
  (§6.13 path-scoping enforcement differs: signed URL enforces at mint time
  server-side; direct putFile relies on Storage Security Rules which are
  explicitly flagged as a TODO in `REVIEW §6.13`/risk #2 "blanket
  `if request.auth != null`"). The plan never picks one and never specifies the
  hardened Storage rules.
- The upload→`uploadAnswerSheets` two-step ordering, idempotency across the
  byte-upload + the callable, and partial-failure (bytes uploaded but callable
  fails / vice-versa) are unspecified. **Resolution:** Promote C1 to a
  fully-designed seam before PASS: (1) extend the `Transport` interface in
  api-contract with an explicit `requestUploadUrl`/`upload` capability (or a
  separate `StorageTransport` seam) and document it in `transport-realtime.md`;
  (2) pick signed-PUT-URL (REST-ready, server-enforced path scope) as the
  canonical mechanism and write the corresponding hardened Storage rules (close
  `REVIEW §6.13` risk #2 in the same change); (3) specify the
  byte-upload↔callable ordering, the shared `idempotencyKey`, and the
  orphan-path cleanup. Without this, C1 "resolved" is overstated and the scanner
  remains hard-blocked.

---

## UC-3 — C2 (notification-preferences) claimed "fully resolved" but common-api.md was never reconciled

**Severity:** MAJOR **Where:** `SDK-UI-COVERAGE-MATRIX.md` C2 ("RECONCILE … then
it is closed"), `SDK-LAYERS-PLAN.md §9.1 C2`; `common-api.md §3.3` (lines 127,
334). **Problem:** C2's resolution is explicitly conditional on reconciling the
prefs callables "into `common-api §3.3` + the identity domain plan." Grep of
`common-api.md` shows it STILL exposes only `manageNotifications` (action:
`'list' | 'markRead'`) — there is NO
`getNotificationPreferences`/`saveNotificationPreferences` in the canonical
callable inventory. And `domains/identity.md` has no notif-prefs
callable/repo/hook (UC-1). So both halves of the stated reconcile are undone.
The master plan §2.1/§2.7 list the names, but the canonical wire inventory
(`common-api.md`, the SSOT the matrix points to as authoritative) contradicts
them. This is exactly the "schema↔interface schism" (REVIEW D12) the rebuild is
meant to kill, reintroduced at the plan level. The matrix counts
`web-parent #/settings` and `web-student #20` as closed on a reconcile that did
not happen. **Resolution:** Actually perform the reconcile: add
`getNotificationPreferences`/`saveNotificationPreferences` to
`common-api.md §3.3` (and retire/clarify `manageNotifications` as a facade per
the §8 "carried open question"), and add the callable/repo/hook/service to
`domains/identity.md`. Add a contract test asserting every callable in master
§3.2 CALLABLES is present in `common-api.md` and vice-versa, so this class of
drift cannot recur silently.

---

## UC-4 — C3 (auth seam) mis-severitied as ENRICH; it hard-blocks login on web-parent and mobile-scanner, and the apps disagree on whether it is a gap

**Severity:** MAJOR **Where:** `SDK-LAYERS-PLAN.md §9.2 C3` (listed ENRICH),
`SDK-UI-COVERAGE-MATRIX.md` row C3 (ENRICH); `coverage/web-parent.md` G2 (login
step-2 PARTIAL, `#/login` is the app's only entry), `coverage/mobile-scanner.md`
G2 (`#/login`), vs `coverage/mobile-family.md` ("Firebase email/password sign-in
is the transport's auth, not a callable … deliberately confirmed non-gap").
**Problem:** Two inconsistencies. (1) **Severity:** C3 is classed ENRICH
("working primary path exists"), but for `web-parent #1` and `mobile-scanner #1`
the login screen is the app's ONLY entry point and its primary write (sign-in)
maps to NO named SDK capability — apps would import `firebase/auth` directly,
which violates R7 (the hard lint boundary). A screen whose sole write violates a
non-negotiable boundary unless a seam is added is not "enrich," it is a
boundary-blocker. (2) **Cross-app disagreement:** `mobile-family.md` explicitly
declares the same Firebase-auth seam a "deliberately confirmed non-gap," while
`web-parent.md`/`mobile-scanner.md` flag it as gap G2. The consolidated matrix
inherited only the parent/scanner framing and never reconciled family's
contradictory "non-gap" verdict. This means the per-app audits used different
coverage criteria for the same capability. **Resolution:** Reclassify C3 from
ENRICH to a hard boundary requirement (it is the only way to keep apps off
direct `firebase/auth` under R7). Add `authRepo` to `domains/identity.md` and
the transport layer explicitly. Reconcile `mobile-family.md` to mark its auth
rows ⚠️/gap (consistent with parent/scanner) so all 8 audits apply one rule.
State the R7 consequence so the build session does not skip it as "merely
enrich."

---

## UC-5 — Consolidated tally arithmetic is internally inconsistent (shells double-counted; the "271 nodes / 204 covered" headline is unreliable)

**Severity:** MAJOR **Where:** `SDK-UI-COVERAGE-MATRIX.md` per-app table (lines
13–20) vs Totals (lines 24–27) vs each `coverage/*.md` "Coverage tally".
**Problem:** The header table and the totals row mix "with-shell" and
"without-shell" counts incoherently:

- web-admin: header "25 (+5 shell)"; totals row uses **30** ("15 (+5 shell)"
  covered). But `coverage/web-admin.md` tally says "25 screen rows + 5 shell"
  and "Net 25/25 screen rows." The +5 shell is folded into the 30 only
  sometimes.
- web-parent: header "13 (+4 shell)"; totals row uses **17**.
  `coverage/web-parent.md` audits **13 route nodes** and 4 shell rows
  separately; the matrix's "11 (+4 shell)" covered conflates them (the shell
  rows are not route nodes).
- mobile-staff: header "41 (+6 shell)"; totals uses **47**;
  `coverage/mobile-staff.md` = "41 screen rows + 6 shell."
- mobile-scanner: header "9 (+6 aux)"; totals uses **15**.
- web-super-admin: header "30 … 19 (+5 PARTIAL)"; but
  `coverage/web-super-admin.md` tally says "**24/30** fully covered" (19 full +
  5 partial counted as covered for the screen, with 6 uncovered). The matrix
  records super-admin's 6 ❌ but its "fully covered" cell (19) silently drops
  the 5 PARTIALs that the per-app doc counts toward the 24.

The sum `27+65+30+30+17+40+47+15 = 271` therefore adds shells for some apps and
not others, and the "204 fully covered" likewise double-counts shells (web-admin
"+5 shell," web-parent "+4 shell," mobile-staff "+6 shell" are added into the
covered column though they are cross-cutting elements, not route nodes). The
precise "271 / 204 / 67 / 31 / 2" figures look authoritative but are not
reproducible from the source specs. **Resolution:** Define one counting unit
(route nodes only, OR route nodes + aux + shell — pick one) and re-tally all 8
apps identically. Separate "route node coverage" from "shell-element coverage"
in distinct columns. Re-derive the headline so 271/204/67 reconcile exactly with
the eight per-app docs. The PASS/CONDITIONAL-PASS verdict should not rest on
figures that do not add up.

---

## UC-6 — C16 (getSubmissionForExam) parent authorization is under-specified for the released-gate + ownership intersection

**Severity:** MAJOR **Where:** `SDK-LAYERS-PLAN.md §9.2 C16`;
`coverage/mobile-family.md` GAP-2; `coverage/web-parent.md` #8. **Problem:** C16
serves released-result detail routes keyed by `examId` for both the student
(self) and the **parent** (child). The spec says `studentId` "defaults to self /
must be in `ctx.studentIds` for parent" and is "released-gated." But the parent
path crosses two authority boundaries simultaneously — (a)
`studentId ∈ ctx.studentIds` (REVIEW §6 / D10 parent-link) AND (b)
`resultsReleased === true` for that exam/class — and the plan does not state the
precedence or the failure mode when (a) passes but (b) fails (does it return
`null`, NOT_FOUND, or PERMISSION_DENIED?). REVIEW §5/§7.3 specifically flags
that today parents cannot read child submissions through rules
(`questionSubmissions` read rule excludes parents). C16 is callable-only
(materialized/projection reads are callable-gated per D13), so the service must
enforce both gates itself; leaving the intersection vague risks either a leak
(released-gate skipped when ownership passes) or a dead screen (over-strict).
Same ambiguity affects C17 `listSpaceProgressForUser` (parent gated
`progress.readOther` + `studentId∈ctx.studentIds`) and C18 `listParentAlerts`.
**Resolution:** Specify for C16/C17/C18 the exact `authorize()` action + the
ownership predicate + the released/visibility predicate as an explicit
conjunction, the projection (answer-key/guidance strip for parent role), and the
canonical not-authorized vs not-found vs not-released response. Add ACCESS_RULES
entries (`submission.readReleased` already exists in §5.4; confirm it carries
the parent ownership check) and a contract test for the parent-ownership
intersection.

---

## UC-7 — C21 (saveTestAnswer) added but not reflected in the test-session realtime/optimistic/idempotency model

**Severity:** MAJOR **Where:** `SDK-LAYERS-PLAN.md §9.2 C21`; §2.3 (testsession
callables/hooks), §4.4 (optimistic allow-list), §6.6 (test-session authority),
`domains/testsession-progress.md`. **Problem:** C21 introduces per-answer
write-through to the `submissions/{itemId}` subcollection (crash-resume),
"idempotent, server-authoritative, never optimistic." This is a genuinely new
in-session write but it is bolted on without integrating into the test-session
model: (a) §2.3's testsession callable list and hook list
(`useStartTestSession`/`useSubmitTestSession`/…) do not include
`saveTestAnswer`/`useSaveTestAnswer`; (b) §6.6 lists the test-session authority
fields owned by start/submit but does not mention per-answer persistence as a
server-write; (c) there is no idempotency key scheme stated for the
high-frequency per-keystroke/per-answer writes (rate-tier `write`? debounced?
`(sessionId,itemId,revision)`?), and §6.6's `serverDeadline` interaction (can
you save after deadline?) is unspecified; (d) the `submissions/{itemId}`
subcollection is also the read-model for `submitTestSession`'s batched
answer-key grading — concurrent write-through + submit needs a single-writer
story (REVIEW risk #10, D6). A per-answer write at test scale without a
rate/idempotency/deadline contract is an operational and correctness risk.
**Resolution:** Integrate C21 into `domains/testsession-progress.md`: add the
callable/hook to the inventory, define the idempotency key
(`(sessionId,itemId,clientRevision)`), the rate tier and client debounce, the
post-deadline rejection (`INVALID_TRANSITION`/`PRECONDITION_FAILED`), and
confirm it shares the single-writer path with submit so a late write-through
cannot clobber a submitted/graded answer. Keep it on the NEVER-optimistic list
(already stated) and add it to §4.4's never-optimistic enumeration.

---

## UC-8 — C13 (AI generate-items) and C12 (assignContent) introduce new authority/AI-gateway and assignment-entity surfaces with no entity/quota/access design

**Severity:** MAJOR **Where:** `SDK-LAYERS-PLAN.md §9.2 C12/C13`;
`domains/levelup-content.md`; §6 (AI authority), §5.4 ACCESS_RULES. **Problem:**
(1) **C13 `generateContent`** routes through the AI gateway
(cost/quota/moderation) and is a net-new AI callable, but it is absent from
`domains/levelup-content.md`'s AI-callable set (which has `sendChatMessage`,
`evaluateAnswer`) and from the §6 AI authority row; no quota class, no
per-tenant cost accounting, no moderation contract, and no `aiGenerationRepo`
are specified. Adding an unbounded "draft N items from a PDF" AI path without a
quota/cost contract is a cost-control risk the FROZEN plan's §6.AI row is
specifically meant to prevent. (2) **C12 `assignContent`** proposes a
content↔class assignment with `assignedAt`/`dueDate`/visibility/window fields,
and the matrix even floats "an `Assignment` domain entity the tracker reads."
Whether assignment is a new entity (with its own status machine,
ALLOWED_TRANSITIONS, junction, indexes) or denormalized fields on Space/Exam is
left undecided — a non-trivial data-model decision that REVIEW §7 (junctions vs
FK arrays, D7) explicitly governs. The assignment-tracker (web-teacher #12,
mobile-staff) reads these fields, so the shape must be fixed, not "either/or."
**Resolution:** For C13: add `generateContent` to `domains/levelup-content.md`
with an explicit AI quota class, cost-logging, moderation gate, and
`aiGenerationRepo` (no auto-persist), and add it to §6.AI. For C12: decide
assignment = denormalized fields on existing entities vs a first-class
`Assignment` junction entity (respecting D7), specify the fields/status/indexes,
and reflect it once in domain + indexes + ACCESS_RULES. Do not ship "either/or"
— the tracker columns depend on the chosen shape.

---

## UC-9 — Scanner offline durable queue (G3) deferred, but Queue/Settings-storage screens are counted as covered ("shell") on a seam that does nothing in v1

**Severity:** MINOR **Where:** `SDK-LAYERS-PLAN.md §9.4`;
`coverage/mobile-scanner.md` #7/#9, G3; §1.1 (`offline` = `NoopOfflineQueue`
seam only). **Problem:** The matrix treats scanner rows #7 (`upload-queue`) and
#9 (`scanner-settings` storage stats) as ⚠️ "covered-with-caveat," and the
deferral decision (§9.4) is "record a decision (a) minimal SQLite/MMKV impl or
(b) app-local state." But the decision is still NOT made — §9.4 restates the two
options without choosing. `mobile-rn.md §5` states the durable queue is "the
stated reason scanner is native." With `NoopOfflineQueue`, the Queue tab and
offline-submit have no SDK-backed store at all; rows #5/#6/#7/#9 all depend on
it. Calling these "covered (online happy path)" understates that the app's
headline differentiator is unbuilt. This is correctly out of GATE-1's hard-block
set (online path works once C1 lands), but it should be an explicit recorded
decision, not an open either/or in a FROZEN candidate. **Resolution:** Make the
§9.4 decision now: choose (a) a minimal v1 `OfflineQueue` impl scoped to
`mobile-scanner` replaying `useUploadAnswerSheets` with the existing
`idempotencyKey`, or (b) explicitly scope the queue as `mobile-scanner`
app-local state (not an SDK capability) and mark `coverage/mobile-scanner.md`
rows #7/#9 as "app-local, not SDK-covered" rather than ⚠️. Record which, so the
scanner build session is unambiguous.

---

## UC-10 — C4 (registerDeviceToken) module ownership unresolved (identity vs notification), leaving the producer fan-out unwired

**Severity:** MINOR **Where:** `SDK-LAYERS-PLAN.md §9.2 C4` ("`identity` (or
`notification`)"); `coverage/mobile-family.md` GAP-1,
`coverage/mobile-scanner.md` G5; `domains/{identity,notification}.md` (neither
defines it). **Problem:** C4 is required by `mobile-rn.md §7.1` and blocks all
mobile push (family GAP-1 marked HIGH — "the core RN value-add"). The §9 entry
hedges module ownership "`identity` (or `notification`)," and grep confirms
NEITHER `domains/identity.md` NOR `domains/notification.md` defines
`registerDeviceToken`/`deviceRepo`. The §9 contract test asserts
`CALLABLES[name].module` equals the codebase the callable is wired in (master
§5.1) — an unresolved module assignment will fail that test or be wired
arbitrarily. Also the "extend `emitNotificationService` fan-out to Expo/FCM
push" half is a producer-side change with no design (token storage shape
`tenants/{t}/users/{uid}/devices/{token}`, dedup, stale-token pruning,
multi-device). **Resolution:** Assign C4 to a single module (recommend
`identity`, since the device doc lives under `users/{uid}` and
ownership/lifecycle is identity-scoped), define
`deviceRepo.register/unregister` + hooks in that domain plan, and specify the
`emitNotificationService` push fan-out (FCM/Expo token resolution, dedup,
prune-on-unregister, per-platform). Without an owner, family/scanner push
remains unbuildable.

---

## UC-11 — Answer-key re-merge (getItemForEdit) cache scope is correctly specified — no leak (positive control, no finding)

**Severity:** MINOR **Where:** `layers/query-infra.md §4.3`
(`EDIT_ITEM_SCOPE`/`editItemKey`/`isSensitiveKey`), §4.4;
`domains/levelup-content.md` (`itemRepo.getForEdit`, `getItemForEditService`);
master §4.2. **Problem:** The prompt asks whether the editor answer-key re-merge
has a cache-scope rule so keys do not leak. It DOES, and it is well-specified:
`getItemForEdit` keys are minted under a separate `EDIT_ITEM_SCOPE` root
(`['items:edit', itemId]`), deliberately NOT under the `items` root so they are
never bulk-invalidated or reachable from list invalidation; hooks set
`gcTime:0`/`staleTime:0`; `isSensitiveKey` is the predicate the offline
persister's `dehydrate` filter rejects, enforced by
`key-registry.contract.test.ts`; `getItemForEditService` is
`item.edit`-authorized (authoring roles only) and the read projection strips
answer-bearing fields from all non-edit reads (`listItems`/`getItem`). This
satisfies REVIEW §6.4/§6.7. The ONE residual nit: the rule lives in
`query-infra.md §4.3` and `levelup-content.md §216` open-Q ("confirm
non-persisted … so answer keys never leak") is still phrased as a confirmation
TODO rather than a closed contract. **Resolution:** None required for the leak
risk itself. Optionally, flip the `levelup-content.md §216` open-question to a
closed statement referencing `query-infra §4.3` + the contract test, so it is
not re-litigated. No leak path found.

---

## UC-12 — Platform (C25–C31) capabilities counted toward "100% coverage" though they are net-new and entirely undesigned in the domain plans

**Severity:** MINOR **Where:** `SDK-LAYERS-PLAN.md §9.3 C25–C31`;
`coverage/web-super-admin.md` (6 ❌ rows); `domains/{identity,analytics}.md`.
**Problem:** The super-admin app has the worst real coverage (6 hard-UNCOVERED
rows: `setUserStatus`, `sendPasswordReset`, `startImpersonation`,
`saveTenantFeatures`+bulk, `getPlatformConfig`/`savePlatformConfig`). The matrix
correctly labels these PLATFORM/net-new, but the verdict rolls them into
"100%-covering on adding §9" alongside trivial field enrichments — flattening
severity. Several are high-authority, audited, token-revoking operations
(`setUserStatus` revokes refresh tokens; `startImpersonation` mints a
constrained claim set; `savePlatformConfig` flips a maintenance kill-switch).
None appear in `domains/identity.md`/`domains/analytics.md`, none have
ACCESS_RULES actions or audit-event contracts, and `startImpersonation`'s
"constrained claim set / time-boxed session token" is a security-sensitive
design with zero specification (how is the impersonation token scoped, how is it
revoked, how is the audit trail tamper-evident). Counting these as "closed by
addition" understates that 6 of super-admin's screens currently have no path AND
the additions carry real security design debt. **Resolution:** Keep C25–C31 as
their own severity tier in the verdict (do not average them with field-enrich).
Before PASS, at minimum design `startImpersonation` (claim scope, expiry,
revocation, audit) and `setUserStatus`/`savePlatformConfig` (token revocation,
maintenance-mode enforcement points) in `domains/identity.md`, with
ACCESS_RULES + audit-event entries. Acknowledge in the verdict that
web-super-admin is at 24/30 today, not 100%.

---

## Summary

| Finding | Severity | Theme                                                                                                             |
| ------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| UC-1    | BLOCKER  | §9 C1–C31 orphaned — absent from every per-domain/per-layer plan, CALLABLES map, INVALIDATION_GRAPH, ACCESS_RULES |
| UC-2    | BLOCKER  | C1 Storage seam under-specified (Transport contract change, signed-URL-vs-putFile undecided, rules unhardened)    |
| UC-3    | MAJOR    | C2 notif-prefs "reconcile" never done in common-api.md / identity domain plan                                     |
| UC-4    | MAJOR    | C3 auth seam mis-severitied (hard-blocks parent/scanner login under R7); apps disagree                            |
| UC-5    | MAJOR    | Tally arithmetic inconsistent — shells double-counted; 271/204 not reproducible                                   |
| UC-6    | MAJOR    | C16/C17/C18 parent ownership × released-gate intersection unspecified                                             |
| UC-7    | MAJOR    | C21 saveTestAnswer not integrated into test-session idempotency/single-writer/deadline model                      |
| UC-8    | MAJOR    | C13 AI-generate no quota/cost; C12 assignContent entity-shape undecided                                           |
| UC-9    | MINOR    | Scanner offline queue decision still open in a FROZEN candidate                                                   |
| UC-10   | MINOR    | C4 device-token module ownership unresolved; push fan-out unwired                                                 |
| UC-11   | MINOR    | Answer-key cache scope correctly specified — no leak (positive control)                                           |
| UC-12   | MINOR    | Platform C25–C31 net-new + undesigned; super-admin truly at 24/30                                                 |

**Verdict:** Read-path coverage is real and the answer-key isolation is sound,
but the "100%-covering → PASS" claim is premature: the closure set C1–C31 is
declared, not delivered, into the plans the build consumes, the two named
hard-blockers (C1, C2) are not actually resolved, and the supporting tallies do
not reconcile.
