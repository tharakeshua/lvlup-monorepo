# SDK Review R2 — FOUNDATION audit (domain + api-contract + types + v2\_/timestamps)

**Scope:** `@levelup/{domain, api-contract}` as the SSOT, plus the v2\_-prefix
and timestamp seams that cross into `services/repo-admin`, `seed`, and
`transport-firebase`. **READ-ONLY** — no code changed. **Branch:** `staging`
**Date:** 2026-06-27 **Reviewer:** be-data-seed (🌱)

Intended architecture (for reference):
`apps → @levelup/query → repositories → api-client → api-contract → domain`;
server = thin shells over `@levelup/services`; transport split
`transport-firebase`/`transport-http`; **no direct Firestore** (callable SDK
only); `v2_` prefix centralized in `packages/services/src/repo-admin/paths.ts`
(+ `packages/seed/src/engine/paths.ts`); timestamps = ISO strings at rest /
`Date` in memory.

---

## Summary

| Severity | Count |
| :------- | :---- |
| P0       | 0     |
| P1       | 3     |
| P2       | 7     |
| P3       | 4     |

**Overall:** the foundation is _strong_. `@levelup/domain` is disciplined —
mandatory `.strict()` via `zObject`, a clean branded-id system, real
discriminated unions for every polymorphic payload, a single canonical timestamp
adapter (`toTimestamp`), and exhaustiveness-checked error/enum mirrors. The
_domain_ layer has essentially no defects. **All material findings live at the
boundaries**: (1) the `api-contract` wire schemas do **not** consistently reuse
`domain`'s `zTimestamp`/branded ids — they drift to bare `z.string()` — so the
SSOT under-specifies exactly the field families (timestamps, ids) it exists to
pin; and (2) the `v2_` prefix is centralized **only for the server + seed** —
the **client `transport-firebase` subscription paths apply no prefix at all**,
which is a latent split-brain if `LVLUP_COLLECTION_PREFIX` is ever set in a
client-facing deploy.

### Top 3 (fix first)

1. **F-NS-01 (P1)** — `transport-firebase` realtime subscription paths are
   hardcoded `tenants/${T}/…` with **zero** prefix awareness → in a `v2_`
   deployment, live subscriptions read unprefixed collections while writes land
   in `v2_…`. Split-brain.
2. **F-TS-01 (P1)** — Wire timestamp drift: ~20 `*At`/deadline fields across
   `identity`, `levelup`, `subscriptions` use bare `z.string()` (and one
   `z.string().datetime()`), bypassing the canonical `zTimestamp` that `domain`
   and the `autograde` contract already use. The SSOT does not enforce
   ISO-8601-UTC at the wire.
3. **F-SSOT-04 (P1)** — The single most security-relevant wire field — the
   student `answer` — is `z.unknown()` at the contract seam (4 callables).
   Server MUST re-validate per question type; the contract gives no guard.

---

## A. `@levelup/domain` Zod schemas

### Positives (verified, keep)

- `authoring/strict.ts:8` — `zObject = z.object(shape).strict()` is the single
  authoring helper; a lint test (`__tests__/strict-authoring.lint.test.ts`)
  forbids raw `z.object(` in `src/entities/**`. The D12 drift-killer holds: **no
  `.passthrough()`/`.catchall()`/`.nonstrict()` anywhere in domain.**
- Branded ids: `primitives/brand.ts` + `branded-id.zod.ts` — every id is a
  `Brand<string, …>` with a `zXxxId` schema and an `asXxxId` caster. ~45 ids.
- Discriminated unions used for **every** polymorphic payload (not weak
  `z.union`): `entities/content/item-payload.ts:49` (`MaterialDataSchema`, 7
  types), `:102` (`ItemPayloadSchema`, 7 types),
  `entities/content/question-payload.ts:134` (`QuestionTypeDataSchema`, 15
  types).
- `withAudit` mixin (`primitives/audit.zod.ts:9-24`) appends
  `createdAt/updatedAt/createdBy/updatedBy` (`zTimestamp`) + `archivedAt`
  (`zTimestamp.nullable()`) uniformly — one audit shape for all entities.

| id          | concern               | sev | location                                                                                                                                                   | issue                                                                                                                                                                                                                                                | recommendation                                                                                                                                                                                                                                          |
| ----------- | --------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-DM-01** | Loose escapes         | P2  | `entities/content/answer-key.ts:16-17`, `item-payload.ts:46,68`, `progress/progress.ts:38,61`, `levelup/test-session.ts:104`, `analytics/analytics.ts:154` | 8 `z.unknown()` / `z.record(string, unknown)` escapes for polymorphic answer/blocks/config/metadata payloads. All are **deliberate and commented** (answer shape is question-type-specific).                                                         | Acceptable. Where the discriminant is already in scope (the item's `questionType`), consider a `z.discriminatedUnion` answer schema so the _stored_ answer is validated, not just the question. Otherwise leave + ensure the server validates per type. |
| **F-DM-02** | Strictness via helper | P3  | `entities/content/question-payload.ts:63`, `analytics/analytics.ts:55,142`, `content/item-payload.ts:42`                                                   | 4 inline `z.object({…}).strict()` instead of `zObject({…})`. They **do** carry `.strict()` so behaviour is correct, but they bypass the `zObject` helper the lint keys on (the lint only fires on bare `z.object(` _without_ strict, so these pass). | Swap to `zObject(…)` for one-way-to-author consistency; purely cosmetic.                                                                                                                                                                                |
| **F-DM-03** | Timestamp exception   | P3  | `entities/notification/notification.ts:61`                                                                                                                 | `NotificationBadgeStateSchema.latest.createdAt = z.number().int()` (epoch-ms) — a **deliberate, fenced RTDB exception** (comment lines 50-53: RTDB has no Timestamp type).                                                                           | Acceptable. The fence is convention-only (no lint guards it). Add a test/lint asserting `z.number()` time fields appear **only** in RTDB-projection schemas so the trichotomy can't leak back.                                                          |

> Domain `required-vs-nullable`, enum usage, and defaults were reviewed across
> all 30 entity files and are **consistent** — nullable temporal/reference
> fields (`completedAt`, `publishedAt`, `tenantRank`, `archivedAt`) follow one
> pattern; enums always reference `src/enums/*` (no free `z.string()` where an
> enum exists); counters/arrays/flags default sensibly (`.default(0/[]/false)`).
> No finding.

---

## B. `@levelup/api-contract` — the Frontend↔Backend SSOT

### Positives (verified, keep)

- `callable-def.ts` + `registry.ts` — every callable is a `CallableDef` with a
  **real** `requestSchema` + `responseSchema` (no blanket `z.any()` request).
  `CALLABLES` is one flat `as const` literal → `CallableName` is a literal
  union; `ReqOf/ResOf` are `z.infer`-derived (single source).
  `AUTHORITY_CALLABLES` is **regenerated** from the `authoritySensitive` flag
  (`registry.ts:79`), never hand-listed.
- `errors.ts` — `AppErrorCode` union has a compile-time both-directions
  exhaustiveness check (`:56-58`) and total `Record<AppErrorCode, …>` maps
  (retryable/https/messages/hints). Excellent.
- `pagination.ts` — one unified `pageResponse`/`withPaging`/`PageRequest` (limit
  default 20, max 100, opaque cursor). Correct envelope design.
- **No `tenantId` leak**: no request schema carries a `tenantId` field (D2
  honored). The only id-in-request escape hatch is the documented
  `allowsTenantOverride` super-admin path.

| id            | concern                                    | sev | location                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | issue                                                                                                                                                                                                                                                                                                                                                | recommendation                                                                                                                                                                                                                                                                   |
| ------------- | ------------------------------------------ | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-SSOT-04** | Under-specified seam (answers)             | P1  | `callables/levelup/evaluate-answer.ts:17`, `save-test-answer.ts:14`, `record-item-attempt.ts:21`, `levelup/_shared.ts:96`, `identity/platform.ts:155,170` (`rubricSnapshot`), `levelup/gamification.ts:131,197` (`data`)                                                                                                                                                                                                                                                                                                           | The wire SSOT leaves the student `answer` (and a few payloads) as `z.unknown()`. This is the most security-relevant field and the contract validates nothing.                                                                                                                                                                                        | Acceptable given 15 polymorphic answer types, **but** make it explicit: (a) document that the server re-validates `answer` against the resolved `questionType`; (b) consider a shared `AnswerPayloadSchema` discriminated union reused by domain + contract so both sides agree. |
| **F-SSOT-01** | Branded ids not used at the seam           | P2  | `callables/levelup/{evaluate-answer.ts:14-16, list-story-points.ts:8, list-items.ts:12, get-space-progress.ts:10, save-agent.ts:32-33, list-agents.ts:9, save-space.ts:24-43}`, `levelup/gamification.ts:{29,46,83,157-160,245,264}`, `levelup/assign-content.ts:{20,21}`, `levelup/list-spaces.ts:{15,17}`, `subscriptions/*` (`grading-status.ts:30`, `exam-grading.ts:18,29`, `test-session-deadline.ts:24`, `chat-stream.ts:15`, `leaderboard-live.ts:30-31`, `space-progress-live.ts:20,32-45`), `autograde/fold.ts:19-21,46` | `spaceId`/`storyPointId`/`itemId`/`userId`/`examId`/`submissionId` are bare `z.string()` in requests. **The `autograde/_shared.ts` module is the counter-example** — it imports and uses the full branded-id set (`zExamId`, `zSpaceId`, …). So the SSOT is _internally inconsistent_: one module brands ids, three don't.                           | Standardize on branded ids in request schemas (follow `autograde`). Low runtime risk (brands are structural strings) but it removes the compile-time guard against swapping `spaceId`/`storyPointId` and weakens the "single source of types" promise.                           |
| **F-SSOT-02** | Non-paginated list envelope drift          | P2  | `callables/levelup/list-story-points.ts:11-13`, `list-agents.ts:~12`, `list-rubric-presets.ts:~17`                                                                                                                                                                                                                                                                                                                                                                                                                                 | These `list*` endpoints hand-roll `{ items: z.array(...) }` instead of `pageResponse(item)`, so they have **no `nextCursor`/`total`**. They are deliberately bounded ("all story points for a space"), but bypass the shared helper — adding pagination later is a breaking contract change, and the envelope diverges from every paginated `list*`. | Either (a) use `pageResponse(item)` and return `nextCursor: null` for bounded lists, or (b) introduce + document an explicit `boundedListResponse(item)` helper so "no cursor" is a deliberate, greppable contract, not an omission.                                             |
| **F-SSOT-03** | Wire view schemas re-declare entity fields | P2  | `callables/identity/tenant.ts:39,162-164`, `identity/platform.ts:156-157`, `identity/notifications.ts:82-83`, `autograde/extract-questions.ts:25`                                                                                                                                                                                                                                                                                                                                                                                  | Read-projection schemas hand-redefine `createdAt/updatedAt/expiresAt/…` as bare `z.string()` rather than deriving from the domain entity (`.pick()`/`.partial()`). This re-declaration is the _mechanism_ by which F-TS-01 (timestamp drift) creeps in — duplicated shapes drift from `domain`.                                                      | Derive projection schemas from the domain entity schema where the projection is a subset; reuse `zTimestamp` for the rest.                                                                                                                                                       |

---

## C. Type-safety & inference quality

- **Good:** types are `z.infer`-derived throughout (`ReqOf`/`ResOf`,
  `PageRequestParsed`, every `export type X = z.infer<typeof XSchema>`), not
  hand-duplicated. `authoring/infer.ts` exposes `Infer`/`InferIn` to keep
  input-vs-output (pre/post-transform brand) explicit.
- **`as` casts are bounded:** the only `as` casts in domain/api-contract are (a)
  brand transforms inside `*.zod.ts` primitives (`branded-id.zod.ts:15`,
  `timestamp.zod.ts:14`) — the _correct, fenced_ place to assert a brand — and
  (b) the `withAudit` intersection cast (`audit.zod.ts:22`). No `as any`, no
  inference-collapsing casts found.
- **One `z.any()`** in scope: `errors.ts:109`
  `meta: z.record(z.string(), z.any())` — acceptable (arbitrary error metadata),
  already `.optional()`.

No standalone finding beyond F-SSOT-01/04 (the inference weakening _is_ the bare
`z.string()`/`z.unknown()` at the seam).

---

## D. v2\_ prefix / namespace handling

### Positives (verified)

- **Centralized for server:** `services/src/repo-admin/paths.ts:30-37` —
  `collectionPrefix()` reads `LVLUP_COLLECTION_PREFIX`; `topLevel()` prefixes
  the first segment only; tenant subcollections inherit via the prefixed
  `tenantsRoot()` (no double-prefix). **No hardcoded `v2_` literal anywhere in
  the scoped packages.**
- **Mirror exists + is tested:** `seed/src/engine/paths.ts:20-23` mirrors the
  same `PFX()`/`top()` logic; `services/src/repo-admin/paths.prefix.test.ts`
  asserts (a) no-env == baseline, (b) `v2_` prefixes top-level only, **(c) the
  repo-admin builders === seed `Paths` for the same logical collection** (seeded
  data lands where callables read). Strong.

| id          | concern                            | sev    | location                                                                                                                                            | issue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | recommendation                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ---------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **F-NS-01** | Prefix bypass — client realtime    | **P1** | `transport-firebase/src/subscribe/subscription-sources.ts:87,94,102,109,116,127,134` (+ `subscribe/path-context.ts`)                                | Subscription source paths are built as hardcoded `tenants/${T}/…` template literals. `transport-firebase` imports **no** `collectionPrefix`/`topLevel` and applies the prefix **nowhere** (grep: zero hits in the whole package). If `LVLUP_COLLECTION_PREFIX=v2_` is active for a client-facing build, **writes go to `v2_tenants/…` but live subscriptions read `tenants/…`** → realtime silently reads the wrong (empty/legacy) namespace. The mirror test (D.c) covers repo-admin↔seed but **not** transport-firebase, so this gap is untested. | Decide the contract: either (a) the `v2_` prefix is server-only and the client always reads unprefixed (then document it loudly and assert it in a test), or (b) plumb the prefix into `PathContext` so subscription paths are prefixed identically to repo-admin. Given the migration plan deploys with `v2_`, (b) is the safe default. **Resolve before any `v2_` client deploy.** |
| **F-NS-02** | Hardcoded `tenants/` storage paths | P2     | `services/src/autograde/request-upload-url.ts:68,71`, `autograde/upload-answer-sheets.ts:99` (`TENANT_PREFIX="tenants/"`), `identity/tenant.ts:162` | Cloud-Storage object paths are hardcoded `tenants/…`, not routed through a path helper. Storage is a separate namespace from Firestore, so the `v2_` Firestore prefix arguably should _not_ apply — but the literal is duplicated and untested, and the intent ("storage is never prefixed") is implicit.                                                                                                                                                                                                                                           | Confirm + document that Storage paths are intentionally prefix-exempt; centralize the `tenants/` storage prefix in one helper so the decision is greppable.                                                                                                                                                                                                                          |

---

## E. Timestamp conventions (ISO-at-rest vs Date-in-memory) — the KNOWN sharp edge

### Positives (verified)

- **One canonical type + one edge adapter:** `primitives/timestamp.ts` —
  `Timestamp = Brand<string,"Timestamp">`, strict `ISO_8601_UTC` regex
  (`\.\d{3}Z` required), and `toTimestamp()` (`:95-100`) is the _single_ place
  the live trichotomy (FirestoreTimestamp / epoch-ms / ISO / `Date` / serialized
  `{_seconds}` / `{toMillis()}`) collapses to canonical ISO. No `firebase`
  import (duck-typed). `toMillis`/`toDateObj` are the reverse edges for math/UI.
  This is exactly right.
- `zTimestamp` (strict, canonical) vs `zTimestampInput` (lenient, edge-only,
  preprocess→`toTimestamp`) split is well-designed
  (`primitives/timestamp.zod.ts`). `withAudit` uses `zTimestamp` everywhere.
- **No `z.date()` anywhere** in domain/api-contract (grep clean) — the
  ISO-string-at-rest convention is held in domain.

| id          | concern                                | sev    | location                                                                                                                                                                                                                                                                                                                              | issue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | recommendation                                                                                                                                                                                                                                                                                                                                      |
| ----------- | -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-TS-01** | Wire timestamp drift                   | **P1** | `identity/tenant.ts:39,142,162-164`; `identity/platform.ts:156-157,260`; `identity/notifications.ts:51,82-83,217`; `subscriptions/{grading-status.ts:26, space-progress-live.ts:39, exam-grading.ts:25, test-session-deadline.ts:19}`; `autograde/fold.ts:27`, `autograde/extract-questions.ts:25`; `levelup/gamification.ts:217-218` | ~20 timestamp fields (`createdAt/updatedAt/expiresAt/publishedAt/requestedAt/completedAt/muteUntil/serverDeadline/extractedAt/fromDate/toDate`) are bare `z.string()`, **not** `zTimestamp`. So the wire SSOT accepts any string — no ISO-8601-UTC guarantee — for the exact fields the canonical type exists to pin. **`autograde/_shared.ts` proves the correct pattern** (it imports `zTimestamp` and uses it for `examDate/createdAt/updatedAt`), making the rest demonstrably inconsistent. The header of `timestamp.zod.ts` even _claims_ `zTimestamp` is "used in entities + wire response schemas" — **doc-vs-reality drift**. | Replace bare `z.string()` timestamp fields with `zTimestamp` (request inputs that come from clients may use `zTimestampInput` if a non-canonical string is expected, but responses should be `zTimestamp`). This is the single highest-leverage timestamp fix and removes a whole class of "string that isn't really a timestamp" bugs at the seam. |
| **F-TS-02** | Third timestamp representation         | P2     | `levelup/assign-content.ts:12-13`                                                                                                                                                                                                                                                                                                     | `startAt`/`dueAt` use `z.string().datetime()` — a **third** flavor. Zod's `.datetime()` permits offsets and optional fractional seconds, i.e. it accepts strings the canonical `ISO_8601_UTC` regex (`\.\d{3}Z`) would reject. Two callables modeling time three different ways (`zTimestamp`, bare `z.string()`, `.datetime()`).                                                                                                                                                                                                                                                                                                      | Use `zTimestamp` (or `zTimestampInput` for lenient client input) so all time fields share one validator and one accepted format.                                                                                                                                                                                                                    |
| **F-TS-03** | RTDB epoch-ms fence is convention-only | P3     | `domain/.../notification.ts:61` (see F-DM-03)                                                                                                                                                                                                                                                                                         | `createdAt: z.number()` is a legitimate RTDB exception, but nothing _enforces_ that `z.number()` time fields stay confined to RTDB-projection schemas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Add a lint/test asserting numeric time fields only in named RTDB schemas.                                                                                                                                                                                                                                                                           |

---

## Prioritized improvement list (FOUNDATION)

1. **F-NS-01 (P1)** — Decide & enforce the `v2_` prefix contract for client
   `transport-firebase` subscriptions (plumb prefix into `PathContext` **or**
   document server-only + test the assumption). Blocks any `v2_` client deploy.
2. **F-TS-01 (P1)** — Sweep the ~20 bare-`z.string()` timestamp wire fields to
   `zTimestamp`/`zTimestampInput`; align `assign-content` (F-TS-02) in the same
   pass. Update the `timestamp.zod.ts` header once reality matches.
3. **F-SSOT-04 (P1)** — Document/strengthen the `z.unknown()` `answer` seam:
   assert server-side re-validation per `questionType`; consider a shared
   discriminated `AnswerPayloadSchema`.
4. **F-SSOT-03 (P2)** — Derive read-projection schemas from domain entities
   (`.pick()`/`.partial()`) instead of re-declaring fields — kills the drift
   source behind F-TS-01.
5. **F-SSOT-01 (P2)** — Adopt branded ids in request schemas across
   `levelup`/`identity`/`subscriptions` (match `autograde`).
6. **F-SSOT-02 (P2)** — Make bounded (cursorless) lists an explicit, greppable
   contract (`boundedListResponse` or `nextCursor:null` via `pageResponse`).
7. **F-NS-02 (P2)** — Centralize + document the Storage `tenants/` prefix as
   intentionally Firestore-prefix-exempt.
8. **F-DM-02 / F-DM-03 / F-TS-03 (P3)** — Cosmetic/guard hardening: route inline
   `z.object().strict()` through `zObject`; add a lint fencing numeric time
   fields to RTDB schemas.
