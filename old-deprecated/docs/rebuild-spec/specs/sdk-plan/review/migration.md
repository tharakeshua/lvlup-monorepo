# Migration Review — FROZEN-CANDIDATE SDK Rebuild

**Perspective:** Migration from the current live code. Is the path realistic,
incremental, and non-big-bang? Do versioned `v1.*` names actually permit
dual-run/alias during cutover? Does the server truly absorb the migration so the
SDK only ever sees the clean contract? Is the order of operations sound? Are the
~30 direct-Firestore hook sites + duplicated `getCallable` factories accounted
for? Does `shared-types → @levelup/domain` preserve what works?

Grounded against the live tree: `packages/shared-types/src/**`,
`packages/shared-hooks/src/queries/**` (32 files import `firebase/firestore`),
`packages/shared-services/src/**/*-callables.ts` (7
`getCallable`/`httpsCallable` factory files),
`packages/shared-stores/src/{auth,tenant}-store.ts`,
`functions/{identity,levelup,autograde,analytics}/src/index.ts` (live callables
deployed under **bare** names).

---

## M1 — Live callable names are bare; the "old names alias to v1 during cutover" claim has no deploy mechanism

- **Severity:** BLOCKER
- **Where:** common-api.md §11 step 5 ("Dual-run is unnecessary because names
  are versioned (`v1.*`); old function names can alias to v1 during cutover");
  SDK-LAYERS-PLAN §3.1 / api-contract-core.md:641; live
  `functions/levelup/src/index.ts` (`export { saveSpace }`, `submitTestSession`,
  etc.).
- **Problem:** The entire incremental story rests on the assertion that you can
  run old and new in parallel and alias. But Firebase Callable function names
  ARE the deployed function identifiers — the live functions deploy as
  `saveSpace`, `submitTestSession`, `gradeQuestion`, `getSummary` (bare),
  whereas the rebuild deploys `v1.levelup.saveSpace`,
  `v1.levelup.submitTestSession`, etc. A client calling
  `httpsCallable(functions, 'v1.levelup.saveSpace')` will get NOT*FOUND unless a
  function with that exact deployed name exists. "Aliasing" a bare `saveSpace`
  to `v1.levelup.saveSpace` is not a code-level rename — it requires **deploying
  both functions simultaneously** (double the cold-start surface, double the
  deploy quota, and the new service brain wired under both names), or accepting
  a hard cutover where every app must ship the v1 client in the same release as
  the v1 functions deploy. The plan never specifies which. As written, the
  apparent "dual-run via versioning" is a hard big-bang per codebase: the moment
  `functions/levelup` is redeployed with `v1.*` names, every live app that still
  calls bare `saveSpace` breaks, and vice-versa. The `apiVersion`/`v2` dual-run
  note (api-contract-core.md:641) addresses a \_future* v1→v2, not the _current_
  live→v1 cutover, which is the only migration that actually happens now.
- **Resolution:** Make the live→v1 cutover mechanism explicit and pick one of:
  (a) **export each service under BOTH the bare legacy name and the `v1.*` name
  from the same `functions/*` index for one release**
  (`export const saveSpace = makeCallable('v1.levelup.saveSpace', S.saveSpace); export const ['v1.levelup.saveSpace'] = saveSpace`)
  so old and new clients both resolve while apps roll forward, then drop bare
  names in a later release; OR (b) declare an explicit **coordinated
  per-codebase atomic cutover** (deploy v1 functions + ship v1 client of all 8
  apps in lockstep) and remove the "dual-run is unnecessary / alias" language
  that implies it is gradual. Add a contract test that the legacy-alias map is
  exhaustive over the live deployed-name list for the duration of the
  dual-export window.

---

## M2 — The 4 functions codebases are bounded contexts; you cannot cut over one app incrementally, only one codebase at a time, and the plan never sequences it

- **Severity:** MAJOR
- **Where:** SDK-LAYERS-PLAN §7 build order (single linear list, ends at "10.
  Wire apps — 5 web + 3 RN"); §5.1 (4 deploy-independent codebases).
- **Problem:** The build order is dependency-respecting for _packages_ but says
  nothing about the _temporal_ migration unit. A single app (e.g. teacher-web)
  reads spaces (`functions/levelup`), exams (`functions/autograde`), students
  (`functions/identity`), and summaries (`functions/analytics`). To move
  teacher-web to the v1 client you need all four codebases redeployed with the
  read endpoints + service extraction done — i.e. the server lift (step 5) must
  be 100% complete across all four codebases before the _first_ app can be cut
  over. Combined with M1's lack of dual-export, this collapses the "web first,
  then RN" sequencing into a single flag day: all server work, all client
  packages, then every app at once. The plan presents step 10 as if apps can be
  wired one at a time, but nothing makes that true. The migration unit is the
  (codebase × all-its-callers) pair, which is never enumerated.
- **Resolution:** Add a migration-sequencing section that names the cutover unit
  explicitly. Recommended incremental seam: combine with M1's dual-export so
  that **per-callable** the v1 service can be live while clients migrate
  hook-by-hook. Then sequence by _callable group_ (e.g. identity reads →
  identity writes → levelup reads → …), each protected by the dual-export
  window, so an app can adopt v1 hooks one query at a time. Without dual-export,
  state plainly that the migration is a coordinated big-bang and budget/risk it
  as such (rollback = redeploy old functions + revert all app bundles together).

---

## M3 — `shared-stores` (auth-store + tenant-store) read Firestore via live `onSnapshot` and are absent from the entire plan; `getMe` is a one-shot read, not a behavioral replacement

- **Severity:** BLOCKER
- **Where:** Live `packages/shared-stores/src/auth-store.ts:114`
  (`onSnapshot(doc(db,'users',uid))`), `tenant-store.ts:46` (`onSnapshot`);
  identity.md:156 ("collapses the live `auth-store` + `useAuth` double-source");
  SDK-LAYERS-PLAN §3.3 SUBSCRIPTIONS (9 entries — none for the
  user/claims/active-tenant doc). `shared-stores` appears in ZERO spec files
  under `docs/rebuild-spec/specs/`.
- **Problem:** Two of the most foundational live pieces — the Zustand
  `auth-store` and `tenant-store` — are nowhere in the master plan, the design,
  the domain plans, or the coverage matrix. They are not "~30 hooks"; they are
  app-root singletons that (a) hold `activeTenantId`, which **every single
  migrated hook signature currently takes as its first argument**
  (`useSpaces(tenantId, ...)`), and (b) maintain a **live `onSnapshot` on
  `/users/{uid}`** so that a server-side claim/role/active-tenant change (e.g.
  an admin suspends the user, or `switchActiveTenant` re-stamps) propagates
  without a page reload. The plan's `getMe` callable (identity.md:126) is a
  **one-shot RPC read** with no subscription backing it — there is no
  `v1.identity.meLive` in the SUBSCRIPTIONS registry. So the migration silently
  drops the live-revocation/live-active-tenant behavior the auth-store provides
  today. This is both a migration-coverage gap (the stores aren't planned) and a
  functional regression (loss of reactive auth state). The "double-source"
  framing understates it: the store is the source of _liveness_, `useAuth` is
  the consumer.
- **Resolution:** (1) Add `shared-stores` to the migration inventory explicitly:
  state what replaces `auth-store`/`tenant-store` (an `ApiProvider`-level
  `useMe()` + a session context). (2) Either add a `v1.identity.meLive`
  subscription (firestore-doc on `/users/{uid}` projecting
  `{activeTenantId, status, claimsVersion}`) to the SUBSCRIPTIONS registry so
  reactive revocation/active-tenant survives, OR explicitly document that live
  auth-state is dropped in v1 and replaced by `getMe` refetch on
  `switchActiveTenant` + token-expiry only (acceptable only if the security team
  signs off that ~1h stale claims after suspension is tolerable — REVIEW
  §6.2/risk #8 flagged exactly this as a current bug). (3) Define how
  `activeTenantId` flows to hooks once the store is gone, since the plan removes
  `tenantId` from every hook signature (query root is "tenant-implicit, full
  `qc.clear()` on switch" per §4.2) — confirm the app no longer threads
  `tenantId` and that every one of the 39 teacher-web call sites is updated.

---

## M4 — "Server absorbs the migration, SDK only sees the clean contract" is asserted but several live-coupled behaviors must be reimplemented server-side first, and that work is under-specified

- **Severity:** MAJOR
- **Where:** SDK-SERVER-DESIGN §7.2 last risk row ("invisible to the SDK behind
  `list*`/`get*` + `save*`; server absorbs the migration"); D1 reconciliation
  (SDK-LAYERS-PLAN §8); live `useSpaces.ts` (client does `array-contains-any` on
  `classIds`, composite-index avoidance, client-side `.toMillis()` sort).
- **Problem:** The read hooks today are not dumb passthroughs — they encode
  Firestore-specific access logic: `useSpaces` adds
  `where('classIds','array-contains-any', classIds)` **specifically so Firestore
  security rules can verify per-document access**, and it deliberately skips
  server `orderBy` to avoid needing a 3-field composite index, sorting
  client-side instead. When this read moves behind `v1.levelup.listSpaces`, the
  server must reproduce (a) the class-scoped filtering as an authorization
  concern (now `authorize()` + `ctx.classIds`), (b) the ordering/pagination that
  the client used to fudge, and (c) the exact result set a student is allowed to
  see. The plan says the server "wraps the same documents the hooks read today"
  (common-api §3.3) but does not enumerate, per read endpoint, the per-row
  access predicate that the Firestore rules + the client query jointly enforced
  today. If the server projection's access predicate differs even slightly from
  the live rule+query combination, the migration silently changes what a
  student/parent can see — a security-relevant behavior change disguised as a
  refactor. This is the highest-risk part of "the server absorbs it," and it is
  exactly where the spec is thinnest (common-api §3.3 lists endpoint names; no
  per-endpoint access predicate).
- **Resolution:** For every new `list*`/`get*` read endpoint that replaces a
  direct-Firestore hook, add a row mapping: live hook → live Firestore query
  constraints → live security-rule predicate → new server `authorize` action +
  projection + sort/pagination, and a parity assertion. Make this a hard gate
  before deleting the corresponding hook (M6). At minimum cover the role-scoped
  reads (`listSpaces`, `listItems`, `listSubmissions`, `getStoryPointProgress`,
  parent reads) where the live class/student-id filtering is load-bearing for
  access, not just ergonomics.

---

## M5 — The dual item-path (D1) "one-time migration" is named but not designed; it is a data-layer migration with no backfill/rollback plan and gates `listItems`/`saveItem` correctness

- **Severity:** MAJOR
- **Where:** SDK-LAYERS-PLAN §8 D1 ("Single canonical nested … flat path +
  fallback branches deleted; one-time migration; orphan-on-delete fixed");
  levelup-content.md:218 open question (subcollection cutover "decide whether v1
  ships … or defers"); live `save-space.ts:300-304` writes FLAT
  `/spaces/{s}/items`, rules carry both flat and nested blocks.
- **Problem:** D1 is framed as "invisible to the SDK," which is true for the
  _read shape_ but not for the _data_. Today items live at the FLAT path
  `/spaces/{s}/items` (and orphaned nested items may also exist per REVIEW D1).
  Canonicalizing to nested `/spaces/{s}/storyPoints/{sp}/items/{id}` requires a
  real **data backfill** (copy every flat item to its nested location, with its
  `answerKeys` subcollection, validated, idempotent, reversible) executed
  against production data — plus a window where the server must read from BOTH
  locations (the live fallback) until backfill completes, then flip. The plan
  deletes the fallback branches ("flat path + fallback branches deleted") as if
  it were pure code, but you cannot delete the fallback read until the backfill
  is verified-complete, and you cannot run the backfill safely without an
  idempotency + rollback design. None of that is specified; it is downgraded to
  an open question (levelup-content.md:218) about the _session-submissions_
  explosion, conflating two separate migrations. Answer-key reads halving is
  cited as the _benefit_ but the migration that achieves it is the riskiest data
  operation in the rebuild and has no plan.
- **Resolution:** Promote D1 from a one-line reconciliation to a named
  data-migration runbook in the server/repository-admin scope: (1) dual-read in
  `repository-admin/paths.ts` (nested-first, flat-fallback) shipped first; (2)
  idempotent backfill job (Cloud Task or admin script using `@levelup/seed`
  BatchWriter) copying flat→nested incl. `answerKeys`, with a per-item migration
  marker; (3) verification pass (counts + spot-check); (4) flip writes to
  nested-only; (5) only then delete the flat fallback and flat rules. Add
  rollback (keep flat docs until N days post-flip). Separate this from the D6
  session-submissions subcollection decision, which is independent.

---

## M6 — The 32 Firestore-reading hooks must be deleted, but deletion is gated on the full read-endpoint set existing AND being parity-verified; the plan orders this as one step with no per-hook gate

- **Severity:** MAJOR
- **Where:** common-api §11 step 5 ("Migrate hooks: rewrite … delete direct
  `firebase/firestore` reads"); SDK-LAYERS-PLAN §7 step 7 (per-domain hooks);
  live count: 32 files in `shared-hooks/src/queries` import `firebase/firestore`
  (plan says "~30" — accurate).
- **Problem:** Each of the 32 hooks corresponds to a read whose server endpoint
  must (a) exist, (b) have a `@levelup/access` rule, (c) have an
  `INVALIDATION_GRAPH` entry for its mutations, and (d) pass M4's access-parity
  check — before the hook can be deleted without losing capability. The plan
  treats hook migration as a single bulk step. But because each hook is a
  separate surface and the new endpoints land incrementally with the server
  lift, there is a long window where some hooks are migrated (call api-client)
  and some still read Firestore directly. During that window an app's
  `ApiProvider` must coexist with direct `firebase/firestore` imports — which
  the R7 lint rule (apps import ONLY query/realtime/offline/domain) **forbids**.
  So the lint boundary that is supposed to _enforce_ the migration actually
  _blocks the incremental state_: you cannot land the boundary lint until the
  last hook is migrated, and you cannot safely migrate without the lint catching
  regressions. This is a chicken-and-egg the plan does not resolve.
- **Resolution:** Sequence the R7/R8 boundary lint as a **ratchet**, not a flag:
  introduce it as `warn` (or an allowlist of not-yet-migrated files) during the
  migration window, flip to `error` only when the last Firestore hook is
  deleted. Add a per-hook migration checklist (endpoint exists → access rule →
  invalidation entry → access-parity test → delete hook → remove from lint
  allowlist) so the 32 hooks migrate one at a time with a green build at each
  step. Track the allowlist shrinking to zero as the migration's burn-down
  metric.

---

## M7 — `shared-types → @levelup/domain` inverts ~38 schemas from `.passthrough()` to `.strict()` against LIVE production documents that contain the very drift fields strict mode will now reject

- **Severity:** MAJOR
- **Where:** SDK-LAYERS-PLAN §8 D9 ("`zObject()` … always `.strict()` … Kills
  `.passthrough()`"); domain-core.md (replaces `shared-types`); REVIEW §4 (all
  ~38 live schemas are `.passthrough()`, which "silently keeps unknown/renamed
  fields"); D3/D10/D12 schisms (`uid` vs `authUid`, `childStudentIds` vs
  `parentLinkedStudentIds`, `recipientId` vs `recipientUid`,
  `ChatMessage.timestamp` string vs Timestamp).
- **Problem:** The live data is full of the drift fields that `.passthrough()`
  tolerated: documents have bare `uid` AND `authUid`, `childStudentIds`,
  `recipientId`, epoch-millis timestamps, `'gcs'` uploadSource, `order` and
  `orderIndex`, etc. The moment a `getMe`/`listStudents`/read endpoint pipes a
  live document through a `.strict()` response schema (and dev-mode response
  validation is ON), `.strict()` will **throw on every unmigrated production
  document** that still carries a dropped/renamed field. The plan's "edge
  adapter" handles the _timestamp_ trichotomy (D4 → `toTimestamp`) but says
  nothing about field-name drift on read: `.strict()` rejects an _extra_
  `childStudentIds` field, it does not silently map it to
  `parentLinkedStudentIds`. So either (a) response validation must be off until
  a full data backfill renames every drifted field across the live corpus, or
  (b) the read projections in `repository-admin` must explicitly
  normalize-and-drop legacy fields before they hit the strict response schema.
  The plan asserts the inversion is "non-behavioral" (step 1 "unblocks
  everything") — it is non-behavioral for _new_ writes but actively breaking for
  _reads of legacy data_.
- **Resolution:** Make the read-path normalization explicit: `repository-admin`
  read converters must map every D3/D10/D12 legacy field to canonical before the
  strict response schema runs (this is the actual "server absorbs the migration"
  work for field drift), and add backfill jobs (paired with M5) to rename them
  at rest. Gate dev-mode `validateResponses` so it does not crash on legacy docs
  until normalization is proven, OR run it in report-only mode during migration.
  Add a migration test corpus of real legacy-shaped docs that must pass through
  the read converters into the strict schemas.

---

## M8 — `UnifiedItem`/`Rubric`/`Evaluation` shared core is preserved, but the `payload` becomes a real `z.discriminatedUnion` validated on write — against a corpus written under `z.record(unknown)` that was NEVER validated

- **Severity:** MAJOR
- **Where:** SDK-LAYERS-PLAN §8 (D9, `UnifiedItem.payload` real
  `z.discriminatedUnion`); REVIEW §2/§3 risk #3 (live
  `SaveItemRequest.data.payload = z.record(z.string(), z.unknown())`, "bad
  payloads currently persist silently"); REVIEW §2 (the shared core is "the
  platform's best-built part").
- **Problem:** The plan correctly preserves the shared
  `UnifiedEvaluationResult`/`UnifiedRubric`/`UnifiedItem` core (good — this is
  what works). But it simultaneously tightens `payload` from an unvalidated
  `z.record(unknown)` to a `.strict()` discriminated union validated on write
  AND, implicitly, on read. Because the live data was never write-validated, the
  production `items` corpus is guaranteed to contain payloads that do not
  satisfy the new discriminated union (missing discriminant keys — REVIEW §2
  notes each member tags differently: `questionType` vs `materialType`, with "no
  shared discriminant key"). The plan's discriminator is
  `z.discriminatedUnion('questionType', …)` per common-api §8, but
  material/story-point items don't have `questionType`. So (a) the discriminant
  choice itself is unresolved for non-question item types, and (b)
  `getItemForEdit`/`listItems` reading legacy items through the strict union
  will throw. This is the same class as M7 but worse because the field is
  structured and was never constrained.
- **Resolution:** (1) Resolve the discriminant: introduce a single shared
  `kind`/`payloadType` discriminant across all `UnifiedItem.payload` members
  (the REVIEW explicitly flags the absence of a shared tag), and backfill it
  onto legacy items. (2) Add a one-time validation/repair pass over the `items`
  corpus that reports (and quarantines or repairs) payloads that fail the new
  union BEFORE the strict read path goes live. (3) Decide read-path leniency:
  legacy items that fail validation should surface as a typed "needs-migration"
  state, not crash the editor. (4) Keep the shared `Evaluation`/`Rubric` core
  schemas exactly as-is (no discriminant churn) — only `payload` needs this
  treatment.

---

## M9 — The `getCallable`/`httpsCallable` factory duplication is correctly identified, but `shared-services` also holds the live SERVER business logic and the inline request types; "delete and replace" conflates client SDK removal with server-logic relocation

- **Severity:** MINOR
- **Where:** SDK-SERVER-DESIGN §5.2 ("removes the duplicated `getCallable`
  factory copy-pasted into every `*-callables.ts`"); common-api §8 mapping
  table; live
  `packages/shared-services/src/{levelup,autograde,auth,reports,evaluator}/*-callables.ts`
  (7 factory files) AND `shared-services/src/{ai,firestore,storage,realtime-db}`
  (actual service impls).
- **Problem:** The plan treats `shared-services` as a client-side
  callable-wrapper layer to delete. But `shared-services` is doing double duty
  in the live tree: it contains both the **client** callable factories (the
  `*-callables.ts` with `httpsCallable` + inline `*Request` interfaces) AND
  substantial **service/util code** (`ai`, `firestore`, `storage`,
  `realtime-db`, reports). The migration maps the client factories cleanly to
  `api-client`, and the inline request types (`StartTestSessionRequest`, etc.,
  per common-api §8) to `api-contract`. But where the non-callable
  `shared-services` code goes (it splits across `@levelup/transport-firebase`
  for the Firebase plumbing, `@levelup/ai` for LLM, server `@levelup/services`
  for logic that's actually server-side) is not enumerated. Some of
  `shared-services/firestore` and `realtime-db` is the live RTDB/leaderboard
  wiring that must land in `transport-firebase` (subscription sources) — not
  deleted. The plan's "delete the duplicated factories" is right but the package
  is not a clean delete; its decomposition target is unlisted.
- **Resolution:** Add a `shared-services` decomposition map to the migration
  note: each subdir (`auth`→authRepo/C3 transport-auth seam,
  `firestore`→transport-firebase + repository-admin, `storage`→C1
  storageRepo/transport-storage, `realtime-db`→transport-firebase subscription
  sources, `ai`→`@levelup/ai`, `reports`→`@levelup/services` report service,
  `*-callables.ts`→delete, inline `*Request` types→`@levelup/api-contract`).
  Confirm nothing live (RTDB leaderboard, chat stream wiring) is lost in the
  "delete."

---

## M10 — Build order step 5 (server lift) is one bullet for the single largest and riskiest migration phase, with no per-callable extraction strategy or correctness gate

- **Severity:** MAJOR
- **Where:** SDK-LAYERS-PLAN §7 step 5; SDK-SERVER-DESIGN §8 step 5 ("lift each
  `onCall` body into `fn(input, ctx)`"); live `functions/*/src/callable/*.ts`
  (each callable's logic) + `functions/*/src/triggers/*`.
- **Problem:** Step 5 collapses the riskiest behavioral migration — relocating
  every live `onCall` body into `@levelup/services` `fn(input,ctx)`, plus
  rewriting triggers/schedulers as thin shells, plus introducing
  single-writer/outbox/Cloud-Tasks invariants that **do not exist today**
  (REVIEW §1: "no transactional integrity / no idempotency keys"; live triggers
  are not single-writer) — into a single step. This is not a refactor; it's a
  rewrite of the async/consistency model (outbox, Cloud Tasks fan-out,
  `recomputeOrchestrator` collapsing a 4-writer fan-out,
  `emitNotificationService` consolidating 4 duplicated senders). Each of these
  changes observable async behavior (delivery timing, retry semantics,
  double-fire windows). The plan provides the target topology (§5.3) but no
  migration strategy: do you lift logic verbatim first (behavior-preserving) and
  add invariants second, or both at once? Lifting `tenantId`-from-body to
  `tenantId`-from-claims (D2) alone changes the authorization surface of every
  write callable simultaneously. There is no per-callable "old behavior == new
  behavior" gate.
- **Resolution:** Split step 5 into ordered sub-phases with gates: (5a) extract
  `onCall` body → `fn(input,ctx)` behavior-preserving, `tenantId` still from
  body but read via `ctx` shim, emulator test asserts identical output; (5b)
  flip `tenantId` to claims-derived per callable, behind the dual-export window
  (M1); (5c) introduce single-writer/outbox/Cloud-Tasks invariants per derived
  value, each with an idempotency/double-fire test; (5d) consolidate the 4
  notification senders + 4-writer recompute fan-out. Require the emulator
  contract-test suite (authorize coverage, assertTransition, idempotency, outbox
  atomicity) to be green per callable before that callable's legacy alias (M1)
  is dropped.

---

## M11 — No production data backfill / migration-script inventory exists; multiple "one-time migrations" are named in passing but never collected, owned, or sequenced relative to deploys

- **Severity:** MAJOR
- **Where:** Scattered: D1 (item path backfill), D3 (`uid`→`authUid`), D5
  (`archivedAt`), D10 (`childStudentIds`→`parentLinkedStudentIds`), D11 (scanner
  relocation `/scanners`→`/tenants/{t}/scanners`), D6 (session submissions →
  subcollection), D8 (brand fields), `isSuperAdmin` claim promotion (REVIEW §1),
  `Announcement.readBy[]`→`/reads/{uid}`. No single migration-script section
  anywhere in the plan.
- **Problem:** The rebuild names at least eight separate data-at-rest migrations
  as side-notes in the drift table, but there is no consolidated
  migration-script inventory, no ordering relative to function deploys, no
  idempotency/rollback discipline, and no owner. Several are
  **ordering-sensitive**: `isSuperAdmin` must become a claim BEFORE the rules
  stop doing the `get()` (REVIEW §6.2/risk #8), or super-admin access breaks;
  the scanner relocation (D11) must move docs before the old top-level rule is
  deleted, or scanners lose access; the item-path backfill (M5) must complete
  before flat-read deletion. Doing these as ad-hoc scripts during the package
  build (steps 1-10) risks running a backfill against a schema the functions
  haven't been redeployed to handle yet, or vice-versa. The `@levelup/seed`
  package is cited for _seeding_, not _migrating_ live tenants.
- **Resolution:** Add a dedicated migration-scripts inventory and runbook:
  enumerate each data migration (D1/D3/D5/D6/D8/D10/D11, `isSuperAdmin` claim,
  announcement reads), its idempotency key, its rollback, and its hard ordering
  constraint relative to (functions deploy, rules deploy, client deploy). Assign
  each to a phase in the migration timeline. Mandate dual-read tolerance (server
  reads both old+new shape) for the duration of each backfill, and make "delete
  the legacy path/rule/field" a separate, post-verification step — never bundled
  with the package that introduces the new shape.

---

## M12 — Coverage additions C1–C31 add ~24 net-new callables that have no live equivalent, conflating "migration of existing surface" with "net-new build" under one frozen plan

- **Severity:** MINOR
- **Where:** SDK-LAYERS-PLAN §9 (C1–C31, "~24 callables"); common-api §3 ("we
  keep the deployed ~47-callable surface"); §9 self-classifies C1/C21 (storage
  upload, in-session answer persistence) as HARD blockers with no current path.
- **Problem:** From a migration standpoint, C1–C31 are not migration — they are
  greenfield endpoints (`requestUploadUrl`, `saveTestAnswer`,
  `registerDeviceToken`, `startImpersonation`, `listPlatformActivity`,
  `assignContent`, etc.) with no live code to lift, no existing data, and no
  behavior-parity baseline. Folding ~24 new callables into the _same_ frozen
  plan as the migration of ~47 existing ones means the migration's "is it
  behavior-preserving?" gate (M4/M10) does not apply to ~one-third of the
  surface, and the risk profile is different (new = correctness-from-scratch,
  migration = parity). C1 (storage byte-upload) and C21 (in-session save) are
  flagged HARD — meaning scanner-rn and the test-runner have _no working path_
  until net-new server+transport+repo+hook all land, which is not "incremental
  migration" at all for those screens. The plan acknowledges this (§9.1) but
  does not separate the build track.
- **Resolution:** Tag every callable in `CALLABLES` with a migration class
  (`migrated` | `net-new`) and route them differently: `migrated` callables go
  through the behavior-parity gate (M4/M10); `net-new` (C1–C31) go through a
  from-scratch correctness gate. Sequence the HARD net-new ones (C1, C21, C2)
  into the build order explicitly (they block scanner + test-runner screens)
  rather than leaving them implicit at "step 10 wire apps." Confirm no app
  screen's _only_ path depends on a net-new callable that lands after that app
  is cut over.

---

## M13 — `evaluateAnswer` now persists progress server-side, eliminating the client `recordItemAttempt` follow-up — a contract+behavior change that breaks any client mid-migration calling the old two-call sequence

- **Severity:** MINOR
- **Where:** common-api §3.3 levelup ("`evaluateAnswer` … in the rebuild it
  **persists progress server-side** … so clients no longer make a second
  `recordItemAttempt` call"); levelup-content.md (evaluateAnswer persists, idem
  key `sessionId+itemId+attempt`).
- **Problem:** This is a semantic change to a migrated callable, not just a
  rename. Today the client calls `evaluateAnswer` then `recordItemAttempt`. The
  rebuild makes `evaluateAnswer` write progress itself. During the dual-export
  window (M1), an old client that still issues both calls against the new
  `evaluateAnswer` will **double-write progress** (once inside the new
  `evaluateAnswer`, once via its own `recordItemAttempt`) unless the new
  behavior is gated by name/version. Because the bare-name alias (M1) points old
  `evaluateAnswer` calls at the new service, the old client gets the new side
  effect it doesn't expect. The idempotency key helps within a call but not
  across the two distinct callables.
- **Resolution:** Keep the legacy bare `evaluateAnswer` alias pointing at a
  **behavior-preserving** (no progress write) shim during the dual-export
  window, and only the `v1.levelup.evaluateAnswer` name carries the
  progress-writing behavior — i.e. do NOT alias semantically-changed callables;
  treat them as new-name-only and force the client to adopt v1 atomically for
  that one operation. Document the small set of callables with changed semantics
  (evaluateAnswer, anything moving `tenantId` to claims with different authz) as
  "no legacy alias — atomic client adoption required."

---

## Summary

The package-layering and contract design are coherent, but the **migration story
is the plan's weakest dimension**. The headline claim — that versioned `v1.*`
names make the cutover incremental/dual-run — has no deploy mechanism for the
live→v1 transition (M1) and, combined with the 4-codebase bounded contexts (M2),
the realistic shape is a coordinated big-bang unless a dual-export window is
added. Two foundational live pieces (`shared-stores` and its `onSnapshot`
reactive auth, M3) are entirely unplanned. The "server absorbs the migration"
promise is sound in principle but under-specified exactly where it is riskiest:
per-endpoint access-predicate parity (M4), the dual item-path data backfill
(M5), the `.passthrough()`→`.strict()` inversion against drifted live data (M7),
and the unvalidated `payload` corpus (M8). There is no consolidated,
ordering-aware data-migration runbook (M11), and the single largest phase
(server lift, M10) is one bullet. The shared `UnifiedItem`/`Rubric`/`Evaluation`
core IS correctly preserved (the right call), but the surrounding migration
scaffolding to get there safely is missing.
