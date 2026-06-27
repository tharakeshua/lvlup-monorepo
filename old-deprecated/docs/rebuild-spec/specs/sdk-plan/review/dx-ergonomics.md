# Review — DX & API Ergonomics (FROZEN-CANDIDATE SDK plan)

Perspective: how a feature author lives in this SDK day-to-day. Are the
repo/hook/callable surfaces ergonomic and consistent? Is naming uniform? Are
combined-mode endpoints clean? Are query-key conventions coherent? Is "add a new
callable end-to-end" a clear, finite recipe? Is the repositories layer a real
win over hooks-call-client-directly, or a god-object risk? Is the
transport/ApiProvider wiring clean for 8 apps? Is error-handling DX good?

Findings only. No praise.

---

## DX-1 — `DomainName` enum is far smaller than the actual key-factory inventory; the registry cannot type-check as specified

**Severity:** BLOCKER

**Where:** `query-infra.md` §4.1 (`DomainName` union, lines 282–289) and §4.2
(`QUERY_KEYS satisfies Record<DomainName, …>`) vs `SDK-LAYERS-PLAN.md` §4.2 (the
enumerated per-domain factories).

**Problem:** The `DomainName` union in the query layer lists ~29 names
(`spaces … evaluationSettings`). But `SDK-LAYERS-PLAN.md` §4.2 enumerates ~45
distinct key factories that the plan says exist: `testSessionKeys`,
`questionKeys`, `questionSubmissionKeys`, `deadLetterKeys`, `examAnalyticsKeys`,
`gradingReviewKeys`, `meKeys`, `userSearchKeys`, `summaryKeys`, `trendKeys`,
`leaderboardKeys`, `gamificationKeys`, `achievementKeys`, `levelKeys`,
`studyGoalKeys`, `studySessionKeys`, `studentSummaryKeys`, `enrollmentKeys`.
None of these correspond to a member of the `DomainName` union as written.
Because `QUERY_KEYS` is declared
`satisfies Record<DomainName, KeyFactory<DomainName>>` and
`KeyRoot = DomainName`, every key root referenced by the invalidation graph must
be a `DomainName`. The invalidation graph already references roots like
`'store'`, `'memberships'`, `'reports'`, `'analytics'`, `'costs'` — some are in
the union, but `gamification`, `achievements`, `leaderboard`, `studyGoals`,
`testSessions`, `questionSubmissions` are roots the domain plans clearly need
and are **absent**. The `key-registry.contract.test.ts` invariant ("every
`DomainName` has a factory; every root ∈ `DomainName`") will fail or, worse, the
missing domains simply have no typed root and their hooks fall back to ad-hoc
string keys — the exact drift this layer is supposed to kill.

**Resolution:** Make `DomainName` the single, exhaustive source and generate the
`QUERY_KEYS` registry + the §4.2 factory list from it (or vice versa). Reconcile
the two lists explicitly in one table in the master plan, add the ~16 missing
names to the union, and add a contract test that asserts
`keyof typeof QUERY_KEYS === DomainName` AND every `INVALIDATION_GRAPH` root ∈
`DomainName` (the plan claims this test exists — it must be made to pass against
the _real_ inventory). Pick this up before freeze; it is a compile error in the
spec as written.

---

## DX-2 — `parentKeys` is defined twice with two different meanings; key-factory namespace has collisions

**Severity:** MAJOR

**Where:** `SDK-LAYERS-PLAN.md` §4.2 — factory list contains `parentKeys` once
for the identity `Parent` entity and again as `parentKeys(children)` for the
analytics parent-dashboard view repo. Also two `examAnalyticsKeys` consumers
(autograde `examAnalyticsRepo` view in §2.5 and analytics `examAnalyticsRepo` in
§2.6), two `getLeaderboard` callables (`v1.levelup.getLeaderboard` and
`v1.analytics.getLeaderboard`), two `getExamAnalytics` (`v1.autograde.*` and
`v1.analytics.*`), and two `dismissInsight` (`v1.levelup.dismissInsight` and
`v1.analytics.dismissInsight`).

**Problem:** A feature author importing `parentKeys` gets one of two
semantically different factories depending on barrel order — a real footgun. The
duplicated callables (`getLeaderboard`/`getExamAnalytics`/`dismissInsight`
across two modules) mean an author must know _which_ module's version to call,
the two can drift in request/response shape, and the invalidation graph has to
disambiguate `dismissInsight` by full `v1.<module>.*` name (it does, but the
optimistic allow-list in §4.4 lists "`v1.levelup.dismissInsight` (also
`v1.analytics.dismissInsight`)" — two entries for one user-visible action). This
is the classic two-doors-to-the-same-room ergonomic problem.

**Resolution:** (a) Rename the analytics parent-children factory to
`childrenKeys` (or `parentDashboardKeys`) so `parentKeys` is unambiguous. (b)
For `getLeaderboard`/`getExamAnalytics`/ `dismissInsight`, pick **one**
canonical owning module and have the other module's UI consume it via the same
callable; if both must exist for codebase-deploy reasons, document the split as
"`analytics.*` is the cross-tenant/rollup read, `levelup.*`/`autograde.*` is the
in-domain read" and give them distinct operation names (`getLeaderboard` vs
`getCrossTenantLeaderboard`) so an author never has to guess. Add a contract
test forbidding two callables that share an operation segment with overlapping
request schemas.

---

## DX-3 — "Add a new callable end-to-end" touches 7+ packages with no single authoring checklist; high friction, easy to get partially wrong

**Severity:** MAJOR

**Where:** cross-cutting — `api-contract-core.md` §2/§3 (`defineCallable`,
module barrel), `query-infra.md` §5 (invalidation graph OVERRIDES), §6
(defineMutation), §6.3 (`authoritySensitive` + `OPTIMISTIC_ALLOWLIST`),
`server-shared.md` (`makeCallable`, `ACCESS_RULES` action), repositories
(per-entity repo method), and the domain key factory.

**Problem:** To add one callable a feature author must, in lockstep: (1) author
the def via `defineCallable` + add it to the right module barrel; (2) set
`idempotent`/`authoritySensitive`/
`invalidates`/`allowsTenantOverride`/`resyncsClaims`/`rateTier` flags correctly;
(3) add a `@levelup/access` `ACCESS_RULES` action; (4) add a repo method (and
decide entity vs view repo); (5) add a key-factory root if new domain; (6) add
an `INVALIDATION_GRAPH` entry (the totality test fails otherwise); (7) author
the `defineMutation`/query hook; (8) wire the server `makeCallable` barrel in
the correct codebase (the `module === codebase` test fails otherwise); (9) add
the service `fn(input,ctx)`. That is nine coordinated edits across seven
packages, several of which are enforced by _separate_ contract tests that fail
independently. The plan documents each layer in isolation but **never gives the
one linear recipe** a developer follows. The contract tests are good guardrails
but they surface as N separate red builds, not one actionable "you forgot step
6" message.

**Resolution:** Add an "Adding a callable end-to-end" runbook section to
`SDK-LAYERS-PLAN.md` (or a `CONTRIBUTING-callable.md`) that lists the ordered
steps with the file path for each, and the test that guards each. Strongly
consider a codegen/scaffold script (`pnpm new:callable v1.levelup.fooBar`) that
stamps the def file, barrel entry, empty access rule, repo method stub, graph
entry, hook stub, and server shell — turning 9 manual edits into 1 command +
fill-in-the-blanks. This is the single biggest day-to-day DX lever in the whole
plan and is currently unspecified.

---

## DX-4 — `manageNotifications` facade vs the canonical split is left as an unresolved "open question" but BOTH appear in the registry

**Severity:** MAJOR

**Where:** `SDK-LAYERS-PLAN.md` §3.2 (`manageNotifications {action,…}` →
"discriminated (facade; canonical split below)" listed alongside
`listNotifications`/`markNotificationRead`/etc.); `api-contract-core.md` §3.2
lists **both** `manageNotifications` AND `listNotifications`/
`getNotificationBadge`/`markNotificationRead`/`getNotificationPreferences`/
`saveNotificationPreferences` in the identity barrel; §8 "carried open
questions" still lists "`manageNotifications` split vs facade"; C2 (§9.1) says
it resolves "on the side of explicit callables".

**Problem:** Shipping both a combined-mode `manageNotifications(action)` facade
and the five split callables is the worst of both worlds for DX: two ways to
mark a notification read, two invalidation paths (the graph has
`'v1.identity.manageNotifications': {roots:['notifications']}` AND would need
entries for `markNotificationRead`), and the optimistic allow-list references
`v1.identity.manageNotifications (action markRead only)` in query-infra §6.2
while the master plan §4.4 references `v1.identity.markNotificationRead`. So the
_optimistic mark-read_ is wired to two different callable names across two spec
documents. A feature author cannot tell which one to call.

**Resolution:** Decide now (C2 already leans explicit-split). Delete
`manageNotifications` from the registry, keep only
`listNotifications`/`getNotificationBadge`/`markNotificationRead`/
`getNotificationPreferences`/`saveNotificationPreferences`, and update
query-infra §6.2 + the optimistic allow-list to reference
`v1.identity.markNotificationRead` consistently. If a facade is genuinely wanted
for a single screen, build it as a _repo view method_
(`notificationCenterRepo`), not a second callable. Then remove the line from §8
open questions.

---

## DX-5 — The `save*` discriminator-overload convention (`{id?, data, delete?}`) is overloaded onto operations that are not really upserts, hurting type ergonomics

**Severity:** MAJOR

**Where:** `common-api.md` §3.1, `SDK-LAYERS-PLAN.md` §3.2 — `saveSpace`,
`saveItem`, `saveTenant`, `saveStudent`, `saveAnnouncement`, `saveStudyGoal`,
`saveExam`, `saveEvaluationSettings`, `saveGlobalEvaluationPreset`,
`saveAchievementDefinition`, plus lifecycle folded into the same call
("lifecycle = field/state-machine transitions").

**Problem:** Folding create + update + soft-delete + **lifecycle transition**
into one `save*` call with `{id?, data, delete?}` means the request schema for,
e.g., `saveSpace` must permit a partial `data` for a status-only publish
(`{id, data:{status:'published'}}`) AND a full create payload. With `.strict()`
schemas, this forces `data` to be a giant all-optional object, which destroys
create-time required-field type-safety — the author gets no compile error for
omitting `title` on create because the same schema must accept a status-only
update. It also makes the optimistic/lint story harder: `saveSpace` is on the
NEVER-optimistic list _because_ it can carry a publish, but a pure metadata edit
(rename) is low-risk and would benefit from optimism — the coarse callable can't
distinguish. The discriminated combined-mode endpoints the plan _praises_
(`gradeQuestion.mode`, `getSummary.scope`) are well-shaped; the `save*` overload
is the opposite — an _implicit_ mode via field presence with no discriminant.

**Resolution:** Either (a) keep `save*` for create/update of metadata only and
split lifecycle into explicit verbs (`publishSpace`, `archiveSpace`,
`releaseResults` already exists, `publishExam`) — this also makes the
`ALLOWED_TRANSITIONS` UX pre-check map 1:1 to a button/callable; or (b) make
`save*` a real `z.discriminatedUnion('op', [Create, Update, Transition])` so
create requires its fields and transitions are typed. Option (a) is cleaner for
both authority-sensitivity tagging and optimistic granularity. At minimum,
document why the publish is fused into `saveSpace` rather than being
`publishSpace`, given the plan elsewhere insists transitions are first-class.

---

## DX-6 — Repositories layer return-shape and method-naming conventions are under-specified; god-object/view-repo boundary is a rule, not a guardrail

**Severity:** MAJOR

**Where:** `SDK-SERVER-DESIGN.md` §2.4, `SDK-LAYERS-PLAN.md` §4.1,
`domains/levelup-content.md` §"repos". There is **no dedicated `repositories`
layer plan** (there are layer plans for domain, api-contract, api-client, query,
transport, server-shared, lint — but none for repositories, the "client brain").

**Problem:** Repositories are declared THE brain and the core justification for
the whole fat-SDK bet, yet they get the least authoring specification of any
layer:

- Method naming is inconsistent across domains: `list`/`get`/`save` (levelup),
  but `getForEdit`, `canPublish`, `isAssessment`, `resolveEffectiveRubric`,
  `remainingMs`, `completionPct`, `canReleaseResults` are derived helpers mixed
  onto the same object with no naming rule (verb? `is*`/`can*` predicate?
  `compute*`?). A consumer can't predict whether the helper is
  `spaceRepo.canPublish(space)` or `spaceRepo.publishable(space)`.
- The boundary "repos may not import each other except declared view repos (R6
  lint)" is stated, but view repos are _defined to compose other repos_ — so the
  lint must allow `src/views/**` to import siblings while forbidding it
  elsewhere. Whether the lint can express "only files under `views/`" is
  asserted, not shown. Without it, the 12 view repos are exactly where the
  god-object grows (`spaceDetailViewRepo` already collapses
  space+storyPoints+items+myProgress — a natural magnet for "just add one more
  field").
- Return shapes: does `spaceRepo.get` return `Space` (domain) or `SpaceView`
  (shaped)? §4.1 says repos compute derived fields "once" and levelup says
  "blend ratingAggregate+stats into SpaceView" — so the repo returns a
  _different_ type than the domain entity, but the View types (`SpaceView`,
  `ClassDetailView`, `DigitalTestSessionView`, `ResultView`) are scattered and
  not centrally owned. Where do they live — `domain`, `api-contract` response
  schemas, or `repositories`? If in `repositories`, then `@levelup/query` hooks
  and the 8 apps import view types from `repositories`, but apps are told to
  import "only `@levelup/query` + `@levelup/domain` types" (SDK-SERVER §1.3 /
  R7). Contradiction.

**Resolution:** Write a `layers/repositories-core.md` that fixes: (1) a
method-naming convention (`list`/`get`/`getMany`/`save`/`paginate` for IO;
`can*`/`is*` for boolean pre-checks; `compute*`/ `resolve*` for derived values;
no other verbs); (2) where View types are declared and how apps reach them
without importing `repositories` (recommend: View response schemas live in
`api-contract` as the response shape of the `get*`/list view callables, so
`domain` re-exports `z.infer` and apps import from `domain` — keeps R7 intact);
(3) an explicit lint config snippet proving the `views/` exception is
path-scoped; (4) a hard cap or review-gate on view-repo field count to prevent
the dumping-ground. This is the highest-risk layer and currently the least
specified.

---

## DX-7 — Hook naming is mostly consistent but has real exceptions that break the `use<Verb><Noun>` mental model

**Severity:** MINOR

**Where:** Hook inventories in `SDK-LAYERS-PLAN.md` §2.1–§2.7.

**Problem:** The convention is `use<Noun>` for reads (`useSpaces`, `useSpace`)
and `use<Verb><Noun>` for writes (`useSaveSpace`). Several hooks break it:
`useNotificationBadge` (read) vs `useMarkNotificationRead` (write) — fine; but
`useGradingReviewBundle`, `useExamGradingOverview`, `useSpaceDetailView`,
`useStudentSummary` are read-views with inconsistent suffixes
(`Bundle`/`Overview`/`View`/none). Live-subscription hooks mix
`useLeaderboardLive` / `useAchievementUnlockStream` / `useStudentLevelLive` /
`useTestSessionDeadline` / `useGradingStatus` / `useExamGradingProgress` — five
different suffix conventions for "this is a subscription" (`Live`, `Stream`,
none, `Deadline`, `Status`, `Progress`). A new author cannot guess whether the
live variant of `useSubmissions` is `useSubmissionsLive` or
`useSubmissionStream`.

**Resolution:** Pick one suffix for the three hook kinds: `use<Noun>` (query),
`use<Verb><Noun>` (mutation), `use<Noun>Live` (subscription) — and one view
suffix (`View`). Apply mechanically: `useGradingReviewView`,
`useExamGradingView`, `useGradingStatusLive`, `useExamGradingLive`,
`useTestSessionDeadlineLive`. Add a lint or doc convention so the per-domain
hook plans conform.

---

## DX-8 — `useApi()` exposes both `api` (raw client) and `repos`, with the escape hatch documented but not gated; the "repos are the brain" invariant is advisory

**Severity:** MAJOR

**Where:** `query-infra.md` §3.1 (`ApiContextValue { api; repos; … }` with
comment "for the rare hook that needs a raw call (reads stay in repos)") and
§3.2 (`useApiClient()` selector exported).

**Problem:** The entire fat-SDK thesis is "hooks call `repos`, repos call `api`,
nothing skips the brain." But the provider hands every hook a `useApiClient()`
selector to the raw typed client, and the only thing stopping a feature author
from writing `useApiClient().levelup.listSpaces(...)` directly in a hook
(bypassing shaping, batching, cursor mgmt, derived fields) is a code-review
convention. There is no lint rule named that forbids `useApiClient()` inside
`src/<domain>/` hook files, the way there _is_ a lint rule for
optimistic-on-authority. Over 8 apps and many authors, this escape hatch will be
used to "just get this one field fast," and the repos layer slowly hollows out —
the exact failure mode that makes a repositories layer not worth its cost.

**Resolution:** Either (a) remove `api` from the default `useApi()` surface and
expose `useApiClient` only from a separate `@levelup/query/unsafe` entrypoint
that an ESLint `no-restricted-imports` forbids in app + domain-hook code (allow
it only in a tiny audited allowlist of files); or (b) add a custom lint rule
`no-raw-api-in-hooks` mirroring `no-optimistic-on-authority`. Document the
_exact_ sanctioned use cases for the raw client (there should be ~0 in steady
state). Without an enforced gate, "repos are the brain" is aspirational.

---

## DX-9 — `fanout` resolvers are untyped (`vars as any`); the precise-invalidation surface is the easiest place to silently mis-invalidate

**Severity:** MAJOR

**Where:** `query-infra.md` §5.1 (`FanoutResolver` takes `vars: unknown`), §5.2,
and §12 open-Q 3 ("`fanout` resolvers cast `vars as any` … deferred — graph
correctness is contract-tested regardless").

**Problem:** The invalidation graph is the one place where getting it wrong
shows up as a stale UI (no error, no test failure visible to the author) rather
than a crash. Every `fanout` reads `(vars as any).spaceId` — a typo (`spaceID`,
`space_id`) or a renamed request field produces `undefined`, which silently
invalidates the wrong (or no) key. The plan acknowledges this and defers the
typed `defineRule<N>` builder, relying on "graph correctness is
contract-tested." But the contract test described in §5.3/§9 only checks that
fanout _returns arrays whose first element ∈ DomainName_ — it does **not** check
that the fanout actually read the right field, because the test feeds a _stub_
`{vars, data}`. So a fanout that reads `vars.spaceId` when the callable's
request field is `vars.id` passes the contract test and ships a stale-cache bug.
This is a DX trap: the author believes the test covers them.

**Resolution:** Promote the typed
`defineRule<N extends CallableName>(name, rule: InvalidationRule<ReqOf<N>>)`
builder from "deferred" to "required" — it is ~30 lines and removes the `as any`
entirely, giving the author compile-time field names. If deferral stands,
strengthen the contract test to drive each fanout with a _real_ `ReqOf<N>`
fixture (one per fanout-having callable) and assert the produced keys reference
fields that exist on the request schema. State explicitly in §12 that the
current contract test does NOT catch wrong-field reads.

---

## DX-10 — Error-handling DX: two surfaces (`useApiError` call-site + `ApiErrorBoundary`) with an unclear "who handles what" contract; default `throwOnError: true` will surprise mutation authors

**Severity:** MINOR

**Where:** `query-infra.md` §3.3 (`throwOnError: shouldThrowOnError` default
true for queries), §6.1 (`defineMutation` onError comment "error surfaced by
useApiError at the call site or the boundary; no toast forced here"), §7.1–§7.3.

**Problem:** The division of labor between the boundary and `useApiError` is
left to the author:

- Queries default to throwing `PERMISSION_DENIED`/`NOT_FOUND`/etc. to the
  boundary, but a query whose data is `undefined` _always_ throws (per
  `shouldThrowOnError`), so a first-load failure of an _optional_ widget (e.g. a
  badge) blows up to the nearest boundary unless the author remembers to pass
  `throwOnError: false`. The plan flags this (§12.4) but leaves it as
  "documented" — every optional-read hook author must remember an opt-out, and
  forgetting it is invisible until a permission edge case in prod.
- Mutations `retry: false` + `onError` does nothing forced; so a failed
  `saveSpace` shows **no feedback** unless the call site wired
  `useApiError().handleError` in its own `onError`. There is no default toast. A
  new author who writes `const {mutate}=useSaveSpace(); mutate(x)` and nothing
  else gets a silent failure. That is a worse default than the status quo.

**Resolution:** (1) Make the "optional read" pattern a first-class hook option
(`useQuery` wrapper `useOptionalQuery` or a `soft: true` flag in the per-domain
read-hook factory) so authors opt _in_ to soft-failure explicitly instead of
opting out of a dangerous default. (2) Give `defineMutation` a default `onError`
that calls the injected `notify.error` (via `useApiError`) unless the spec sets
`silent: true` — so the zero-config mutation surfaces a toast. Document a
one-paragraph "who handles errors" decision tree (boundary = navigational/auth
failures; toast = action failures; inline = validation). Right now the DX is "it
depends, read three sections."

---

## DX-11 — `SaveResponse` shape is inconsistent across the registry; consumers can't write one generic save-result handler

**Severity:** MINOR

**Where:** `SDK-LAYERS-PLAN.md` §3.2 — `saveStudent/...` → `SaveResponse`; but
`saveAnnouncement` → `{id, created?, deleted?}`; `saveSpaceReview` →
`{success, isUpdate}`; `importFromBank` → `{createdItemIds}`; `saveStudyGoal` →
`SaveResponse`; `purchaseSpace` → `{success, transactionId, enrolledSpaceId}`;
`markNotificationRead` → `{unreadCount}`.

**Problem:** The `save*` family is sold as a uniform upsert convention, but the
response shapes are ad hoc: some return `SaveResponse{id,created}`, some
`{success,isUpdate}`, some `{id,created?,deleted?}`. A consumer writing a
generic "after save, toast + invalidate + route to detail(id)" helper can't,
because not every `save*` returns an `id` in the same field (`saveSpaceReview`
returns no id; `markNotificationRead` returns a counter). This forces
per-callable result handling and undercuts the convention's value.

**Resolution:** Define a canonical
`SaveResponse = { id, created: boolean, archived?: boolean }` and make **every**
`save*` return it (reviews include the review id; soft-delete sets `archived`).
Operations that are genuinely not upserts (`markNotificationRead`,
`purchaseSpace`, `importFromBank`) should not be named `save*` (they aren't) —
but the ones that ARE named `save*` must all return `SaveResponse`. Add a
contract test:
`name matches /\.save[A-Z]/ ⇒ responseSchema extends SaveResponseSchema`.

---

## DX-12 — `ApiProvider` ambient-client detection ("detects an ambient client and skips re-wrapping") is hand-wavy and a real wiring footgun for the 8 apps

**Severity:** MINOR

**Where:** `query-infra.md` §3.2 ("Apps that already mount a
`QueryClientProvider` pass their client in via `queryClient` … the provider then
does **not** wrap a second one — it detects an ambient client and skips
re-wrapping; see §3.4"). §3.4 does not actually show the detection.

**Problem:** A provider cannot reliably "detect an ambient
`QueryClientProvider`" — calling `useQueryClient()` inside `ApiProvider` to
detect one would throw if absent, and conditionally rendering a
`QueryClientProvider` based on a hook result is a hooks-rules violation. If some
of the 8 apps already have their own `QueryClientProvider` (likely, given the
existing codebase), this under-specified behavior leads to either a
double-provider (two caches, invalidation hits the wrong one — a subtle, painful
bug) or a runtime throw. The plan asserts a capability that React's model
doesn't cleanly support.

**Resolution:** Drop "auto-detect." Make the contract explicit: `ApiProvider`
**always** owns the `QueryClientProvider`; if the app passes `queryClient`, the
provider uses that instance but still renders the `QueryClientProvider` with it
(single source). Mandate that apps remove their own `QueryClientProvider` during
migration (step 10). Document this as a hard wiring rule with a "do/don't"
snippet, since getting it wrong gives two silently-diverging caches across 8
apps.

---

## DX-13 — Cursor pagination has no typed `Page<T>` ergonomics shown at the hook layer; `infinite` vs `list` split pushes a decision onto every consumer

**Severity:** MINOR

**Where:** `api-client-core.md` §pagination ("Repositories expose
`paginate()`/infinite-query helpers; the UI sees only `Page<T>` +
`fetchNextPage()`"), `query-infra.md` §4.1 (`list` and `infinite` are _separate_
key kinds).

**Problem:** The key factory exposes both `list(filter)` and `infinite(filter)`
as distinct keys "so invalidation can target one without the other." But that
means for every paginated resource the hook author must decide up front whether
a screen uses `useXxx` (page) or `useXxxInfinite`, and the invalidation graph
must invalidate **both** roots-by-kind or risk a stale infinite list after a
mutation. The §5 OVERRIDES invalidate by _root_ (`['spaces']`), which by
prefix-match covers both `list` and `infinite` — good — but then the separate
`infinite` key kind buys nothing for invalidation while adding a fork every
consumer must navigate. Meanwhile `Page<T>` and the `fetchNextPage` ergonomic
surface is asserted but never shown as a concrete hook signature, so an author
doesn't know if `useSpaces()` returns `Page<Space>`, `Space[]`, or an
infinite-query result.

**Resolution:** Show the concrete read-hook signatures in the repositories/query
plan: a single `useSpaces(filter)` that returns
`{ items, fetchNextPage, hasNextPage, isFetchingNextPage }` (infinite by default
for list screens), and reserve a separate `useSpacesPage` only where true offset
paging is needed. If both `list` and `infinite` key kinds are kept, document
that mutations always invalidate at the _root_ (covering both) so the split is
purely a fetch-strategy choice, not an invalidation concern. Removing the
speculative `list` vs `infinite` distinction (until a consumer needs it) would
simplify the most-used surface.

---

## DX-14 — `getMany`/N+1-collapse `where('id','in', chunks of 10)` is baked into every repo as a convention but not provided as a shared primitive; each author re-implements chunking

**Severity:** MINOR

**Where:** `SDK-LAYERS-PLAN.md` §4.1 ("Every repo: owns `paginate()` …
`getMany(ids)` N+1 collapse (`where('id','in',chunks of 10)`)").

**Problem:** `getMany` with 10-id chunking is described as something "every repo
owns," implying each repo author re-implements the chunk-and-merge loop. That is
both repetitive and a correctness hazard (off-by-one on chunk size, ordering not
preserved, dedupe). It also leaks a _Firestore_ detail (`in` 10-id limit) into
the repository layer, which is supposed to be transport-agnostic — the
`in`-chunk-of-10 constraint belongs to `repository-admin` (server) or the
transport, not the client repos. A client repo issuing `getMany` should call a
server `getMany`-style callable, not assemble Firestore `in` queries (the client
has no Firestore access at all per principle 3).

**Resolution:** Clarify that client-side `getMany` is just "call the batched
read callable / view repo," and the 10-id chunking lives **server-side** in
`repository-admin`. Provide one shared `batchGet(ids, fetchChunk)` util in
`repositories` so no repo hand-rolls chunking. Remove the `where('id','in',...)`
Firestore phrasing from the client-repo description — as written it implies
client Firestore access, contradicting principle 3.

---

## DX-15 — Subscription hook keys and the `useSubscription` cache-write seam don't reconcile with the per-domain key factories; live data can land under a key no query reads

**Severity:** MINOR

**Where:** `query-infra.md` §11 (`useSubscription` writes to
`subscriptionKey(name, params)` by default), §4 (per-domain key factories).
`subscriptionKey` is referenced but never defined; it is not one of the
`createKeyFactory` outputs.

**Problem:** The default `useSubscription` behavior is
`qc.setQueryData(subscriptionKey(name, params), payload)`. But the screens that
render this data use the domain key factories (`testSessionKeys.detail(id)`,
`leaderboardKeys.list(scope)`). If `subscriptionKey(name,params)` produces a
_different_ key than the query the UI actually reads, the live payload lands in
a cache slot nothing subscribes to, and the UI never updates — the author must
always pass a custom `onPayload` that writes the _correct_ domain key, making
the "default" useless and a trap. The seam is specified but the key-coherence
between subscription and query is not.

**Resolution:** Define `subscriptionKey` as derived from the matching domain key
(e.g. `testSessionDeadline → testSessionKeys.detail(sessionId)`), or drop the
default cache-write entirely and require an explicit `onPayload` that targets a
domain key, with a documented mapping table (subscription name → query key it
updates) parallel to the invalidation graph. Add a test that every
`SUBSCRIPTIONS` entry has a declared target key factory.
