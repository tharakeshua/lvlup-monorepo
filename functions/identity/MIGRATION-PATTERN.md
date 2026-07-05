# U3.x MIGRATION PATTERN — legacy Cloud Functions → @levelup/domain

Established in U3.1 (`functions/identity`, 2026-07-04). **Binding for U3.2
(levelup), U3.3 (analytics), U3.4 (autograde).** Grounding:
DATA-MODEL-FIX-PLAN.md §3 (SSOT decision), §6 U3.x, §7 (B8 timestamp risk), §10
ADRs (AD-4, AD-10).

## Goal per package

`grep -rn "@levelup/shared-types" src` → **0 hits**, package typechecks, tests
green (no NEW failures vs the recorded baseline), deployable wire-compatible.

## The five rules

### 1. Domain is the vocabulary source — never redefine what domain already has

Enums, roles, primitives, claims, constants come from `@levelup/domain`:
`TenantRole`, `AuthProvider`, `PlatformActivityAction`, `PlatformClaims`,
`MAX_CLAIM_CLASS_IDS`, `toTimestamp()`, `isoNow()`, `zLegacy*Read` adapters.
Values were verified identical before swapping (do this per package — don't
assume). Where legacy docs can carry dropped enum values, parse reads through
`packages/domain/src/enums/legacy.ts` `zLegacy*Read` (AD-4). **Never widen a
write** — writes use strict canonical enums.

### 2. Legacy doc shapes get honest LOCAL types — never cast legacy docs to domain entities

Docs at rest in the unprefixed collections carry legacy field vocabularies
(9-flag `features`, legacy permission keys, pre-B8 Timestamp objects). Casting
them to domain entity types is a lie. Port the doc interfaces from shared-types
into `src/contracts/legacy-docs.ts`, with every timestamp field typed
`LegacyTimestamp` (= domain `TimestampInput`) and enums/roles imported from
domain. If U3.2–U3.4 need the same doc types, promote them to a shared home via
the coordinator instead of copy #3.

### 3. B8 timestamps: `toTimestamp()` in, `isoNow()` out

- **Reads**: a timestamp field from a legacy doc may be a Firestore `Timestamp`
  object OR an ISO string. Collapse at the point of use with domain
  `toTimestamp(v)` (returns branded ISO) / `toMillis(toTimestamp(v))` for math.
  Never call `.toDate()` on a doc field directly.
- **Writes**: every `FieldValue.serverTimestamp()` becomes `isoNow()` — ISO
  strings are canonical at rest. `FieldValue.increment()`/`delete()` stay.
- **Responses**: timestamps out over the wire are ISO strings, never
  `{_seconds,_nanoseconds}` serializations.
- Migrate **per-handler**, tests green after each — no big-bang.

### 4. Wire compatibility: request/response shapes DO NOT change

The v1 api-contract renamed request fields (`tenantId`→`tenantOverride`,
`students`→`rows`, …). This package serves the deployed legacy wire — port the
request schemas verbatim from shared-types into `src/contracts/wire.ts` (zod,
same field names/limits), and annotate each with its v1 successor. The v1 shapes
already live in `functions/sdk-v1` + `packages/api-contract`; the legacy wire
dies with the legacy stack, not mid-migration. Response _types_ are local too
(with B8 ISO timestamps).

### 5. Claim minting is CONVERGED (RR-T2-A) — one claims shape platform-wide

`buildClaimsForMembership` now produces the SAME shape as the v1 mint
(`packages/services/src/identity/sync-membership-claims.ts`):

- flat per-role id fields (whatever the membership doc carries — no role
  switch),
- `classIds` widen-on-read: top-level `classIds` (v1 docs) ?? legacy
  `permissions.managedClassIds` ?? `[]`, capped at `MAX_CLAIM_CLASS_IDS`,
- `classIdsOverflow`/`isSuperAdmin`: present-or-absent, never `false`,
- permissions/staffPermissions: **boolean entries passed through with keys
  UNTRANSLATED** (the legacy↔domain key vocabulary conflict is RR-T2-B, blocked
  on a product decision — do NOT translate keys in a migration unit),
- every `undefined` key dropped (compact JWT).

**DEP-1 bug class killed**: call sites that REPLACE claims on a possibly-
super-admin user (`joinTenant`, `switchActiveTenant`, `saveTenant` create,
`saveStaff`) must pass `{ isSuperAdmin: user?.isSuperAdmin === true }` so the
claim survives re-mints. Sites that merge (`{...existing, ...claims}`) keep it
implicitly. Test: parse builder output with domain `PlatformClaimsSchema`.

## Test rules

- Record the failing-test baseline BEFORE touching anything; the gate is **no
  NEW failures**, not absolute green (identity baseline: 29 pre-existing).
- serverTimestamp-sentinel assertions become ISO assertions:
  `expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)`.
  (Most of identity's 29 pre-existing failures were exactly this mock-drift and
  get fixed by the flip.)
- Minimum new coverage per package: claim-shape parse test (identity only) + one
  timestamp round-trip (`Timestamp`-object in → ISO out) per migrated read path.
- Fix a pre-existing failure only when it's expectation drift; never change
  handler behavior to satisfy a stale test — flag it instead.

## Known seams found in U3.1 (escalated, do not work around silently)

- **Domain `PlatformClaimsSchema` / `TeacherPermissionsSchema` use zod4
  `z.record(zEnumKey, z.boolean())`, which requires EXHAUSTIVE keys** — the v1
  mint's own partial-record output fails the schema. Domain owners should flip
  to `z.partialRecord` (available in zod 4.3.6). Tracked via coordinator.
- Legacy↔domain permission KEY vocabularies conflict (RR-T2-B) — blocked on
  product; claims pass keys through untranslated meanwhile.

## Fences (unchanged from directive)

No edits to `packages/*` (domain/api-contract/services), `firestore.rules`,
lockfile, `package.json` (deps were added by the coordinator). Deploy rides a
separate train.

## U3.2 addendum (levelup, 2026-07-05) — binding for U3.3/U3.4 where applicable

- **Entity-timing exception to rule 3 (per coordinator ruling):**
  `FieldValue.serverTimestamp()` flips to `isoNow()` for AUDIT fields only
  (`createdAt`/`updatedAt`/`changedAt`/`publishedAt`/`archivedAt`/`readAt`/
  `deactivatedAt`/`lastUsedAt`/progress `startedAt`/`completedAt`). Fields
  written via `Timestamp.now()`/`fromMillis()` and consumed with `.toMillis()`
  math or by deployed legacy clients — DigitalTestSession `startedAt`/`endedAt`/
  `serverDeadline`/`submittedAt` and evaluation `gradedAt` — stay Firestore
  Timestamps at rest (flagged, flip deferred to U3.5). One field, one
  representation: expire/abandon paths that used `serverTimestamp()` for
  `endedAt` now write `Timestamp.now()` to keep the field Timestamp-typed.
- **Range queries on flipped fields need DUAL queries.** Firestore range filters
  only match values of the operand's type, so a `where(field, "<", ts)` silently
  drops post-flip ISO docs. Every scheduler/trigger range-querying a flipped
  audit field runs the query twice — once with the Timestamp threshold, once
  with the ISO threshold (`toTimestamp(threshold)`) — and merges. Done in
  `cleanup-stale-sessions` (createdAt) + `cleanup-inactive-chats` (updatedAt).
  `orderBy` on a mixed field is safe by the point-in-time argument (all ISO docs
  are newer than all Timestamp docs; each group is internally ordered).
- **Doc-parse schemas: lenient, NON-transforming timestamps.** Local
  `zLegacyTimestampRead` is a `z.custom` VALIDATOR (Timestamp duck | ISO |
  millis | Date) that never transforms — `.passthrough()` fields keep their
  Timestamp prototypes so downstream `.toMillis()` still works. Never swap in a
  transforming schema for doc parses; collapse at the point of use instead.
- **At-rest legacy enum values are NOT normalized by doc parses** where handlers
  deliberately branch on them: storyPoint `type` keeps `'test'`
  (`StoryPointDocSchema` widens; handlers check both `'timed_test' || 'test'`).
  Normalizing on read would silently change write-side behavior (answer-key
  extraction, session typing) mid-migration.
- **Doc-schema bug found while porting (do not re-port blindly):** shared-types
  `DigitalTestSessionSchema` required a `type` field session docs never carry
  (writer emits `sessionType`) — every parse of a freshly-written session doc
  would fail. The local `DigitalTestSessionDocSchema` drops `type`
  (`sessionType` passes through). Check ported doc schemas against the WRITER,
  not just the old schema.
- **isoNow() fixed a latent bug:** `purchaseSpace` put
  `FieldValue.serverTimestamp()` inside `FieldValue.arrayUnion(...)` — Firestore
  rejects sentinel values inside array elements, so every purchase write failed.
  ISO strings are inert values; the flip makes purchase records writable.
- **UserMembership local type is a MINIMAL projection** (`role`/`status` + index
  signature), not a third full copy — the full legacy doc type lives in
  functions/identity/src/contracts/legacy-docs.ts. If U3.3/U3.4 need the full
  shape, promote via coordinator (rule 2).
- **Test-fix classes seen here (all pre-existing, all expectation/mock drift):**
  missing `vi.mock('../../utils/rate-limit')` (the U3.1 submodule-mock class),
  zod-message drift (`'Invalid request: <field>: …'`), fixtures sending
  pre-wire-schema payloads (flat instead of `data:{}` envelope, dropped enum
  values like `'learn'`, sections without `orderIndex`), QuerySnapshot mocks
  without `.empty`, and `'SERVER_TIMESTAMP'` sentinel assertions → ISO regex.
