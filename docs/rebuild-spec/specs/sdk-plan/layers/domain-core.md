# `@levelup/domain` — Core Primitives (Layer Plan)

> **Layer position (strictly downward).** `@levelup/domain` is the **bottom** of
> the trust-layered cake: `domain` ← `api-contract` ← `api-client` ←
> `repositories` ← `query` ← apps. It has **zero** upward dependencies and
> **zero** platform coupling (no `firebase/*`, no DOM, no React, no
> `firebase-admin`, no `firebase-functions`). This purity is _the_ property that
> lets the 5 web apps, 3 RN apps, the 4 Cloud Functions codebases, the seed
> engine, and the test tooling all consume it **verbatim**.
>
> **Scope of THIS document (domain _core primitives_ only).** Branded IDs (all
> 19), the ISO-8601 `Timestamp` type + the edge adapter that ingests
> `FirestoreTimestamp` / epoch-millis / `Date`, the `Page<T>` pagination
> primitive, `AuditFields`, money, the **Zod-first `.strict()` authoring
> convention** + `z.infer` pattern, the shared enums (as-const status unions),
> and the build-time `ALLOWED_TRANSITIONS` data shape with its **compile-time
> assertion** that union members match the as-const status enums. The per-entity
> Zod schemas (Space, Item, Exam, …) are authored in this same package using
> these primitives, but their full field-by-field design lives in a sibling
> `domain-entities.md` plan; here we lock the primitives + the authoring rules
> every entity obeys.

---

## 0. Why this layer exists / what it fixes

Grounded in `status/REVIEW-domain-data-model.md`, this layer eliminates the
**drift class** at its root:

| Live defect (review)                                                                                                                                                                  | Root cause                                          | Fixed here by                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| D4 / risk #9 — timestamp **trichotomy** (`FirestoreTimestamp` `{seconds,nanoseconds}` audit, epoch-millis for progress/attempts, ISO for chat; `progress.ts` mixes two in one module) | no single time type + no edge adapter               | one `Timestamp` (ISO-8601 branded string) + `toTimestamp()` edge adapter (§3)                                   |
| D8 / risk — brands **evaporate inside persisted shapes** (every entity ID is bare `string`)                                                                                           | brands only at some fn signatures, never in schemas | brands authored **into** every schema via `zBrandedId()` (§2, §5)                                               |
| D9 / risk #5 — `.passthrough()` everywhere + one-directional `Interface extends Schema` asserts                                                                                       | schema authored _after_ the interface               | Zod-**first** `.strict()` + `z.infer` is the **only** authoring path (§5)                                       |
| open-Q / top-risk #5 — `ALLOWED_TRANSITIONS` are **data**, union members must match the as-const status enums                                                                         | no machines exist today; nothing checks membership  | `ALLOWED_TRANSITIONS` data shape + a compile-time `satisfies TransitionMap<…>` assertion keyed by the enum (§7) |
| D5 — three soft-delete conventions (`status`, `deleted:boolean`, stray `'deleted'`)                                                                                                   | no canonical primitive                              | one `archivedAt: Timestamp \| null` in `AuditFields` (§4)                                                       |

This package does **not** decide authority (that is the server's, per the `⚷`
column of SDK-SERVER-DESIGN §4). It only gives every layer above it **one**
vocabulary for IDs, time, money, pages, audit, enums, and machines.

---

## 1. Package layout

```
packages/domain/
├─ package.json                # name "@levelup/domain"; deps: { zod }; NO firebase, NO react
├─ tsconfig.json               # strict; "composite": true; no DOM lib needed (lib: ES2022)
├─ vitest.config.ts
├─ src/
│  ├─ index.ts                 # the ONLY public surface (barrel); re-exports everything below
│  │
│  ├─ primitives/
│  │  ├─ brand.ts              # Brand<T,B> + the 19 ID types + as*() factories + IdOf map
│  │  ├─ branded-id.zod.ts     # zBrandedId(brand) zod helper + per-id exported schemas
│  │  ├─ timestamp.ts          # Timestamp brand + ISO regex + toTimestamp() edge adapter + clock seam
│  │  ├─ timestamp.zod.ts      # zTimestamp / zTimestampInput zod schemas
│  │  ├─ money.ts              # Money type + Currency enum + helpers (minor-units, never float math)
│  │  ├─ money.zod.ts          # zMoney / zCurrency
│  │  ├─ page.ts              # Page<T>, PageParams, Cursor type (opaque brand)
│  │  ├─ page.zod.ts           # zPageParams + zPage(item) factory + zCursor
│  │  ├─ audit.ts              # AuditFields type + SoftDeletable + TenantScoped mixins
│  │  ├─ audit.zod.ts          # zAuditFields / zSoftDeletable / withAudit(shape) helper
│  │  └─ json.ts               # JsonValue, JsonObject (used by error meta downstream)
│  │
│  ├─ enums/
│  │  ├─ index.ts              # barrel for all enums
│  │  ├─ enum.ts               # asConstEnum() + zEnum() helpers (the as-const → zod bridge)
│  │  ├─ space.ts              # SPACE_STATUSES + SpaceStatus
│  │  ├─ exam.ts               # EXAM_STATUSES + ExamStatus
│  │  ├─ submission.ts         # SUBMISSION_PIPELINE_STATUSES + SubmissionPipelineStatus
│  │  ├─ question-grading.ts   # QUESTION_GRADING_STATUSES + QuestionGradingStatus
│  │  ├─ test-session.ts       # TEST_SESSION_STATUSES + TestSessionStatus
│  │  ├─ tenant.ts             # TENANT_STATUSES, TENANT_ROLES (TenantRole), MEMBERSHIP_STATUSES
│  │  ├─ content.ts            # QUESTION_TYPES, MATERIAL_TYPES, STORY_POINT_TYPES, ITEM_KINDS
│  │  ├─ grading.ts            # GRADE_THRESHOLDS, GradeLetter, BLOOMS_LEVELS, BloomsLevel
│  │  ├─ permissions.ts        # TEACHER_PERMISSION_KEYS, STAFF_PERMISSION_KEYS (+ key types)
│  │  └─ misc.ts               # AUTH_PROVIDERS, UPLOAD_SOURCES, NOTIFICATION_KINDS, …
│  │
│  ├─ transitions/
│  │  ├─ types.ts              # TransitionMap<S>, AllowedTransitions type-level contract
│  │  ├─ space.ts              # SPACE_TRANSITIONS satisfies TransitionMap<SpaceStatus>
│  │  ├─ exam.ts               # EXAM_TRANSITIONS satisfies TransitionMap<ExamStatus>
│  │  ├─ submission.ts         # SUBMISSION_TRANSITIONS satisfies TransitionMap<SubmissionPipelineStatus>
│  │  ├─ test-session.ts       # TEST_SESSION_TRANSITIONS satisfies TransitionMap<TestSessionStatus>
│  │  └─ index.ts              # ALLOWED_TRANSITIONS aggregate + canTransition()/assertTransition()
│  │
│  ├─ authoring/
│  │  ├─ strict.ts             # zObject() — the .strict() factory all entities MUST use
│  │  └─ infer.ts              # Infer<S>, InferIn<S> doc-types + Entity<S> convention helper
│  │
│  └─ entities/                # (authored here, detailed in sibling domain-entities.md)
│     └─ … one file per entity, each = zObject({...}).strict() + z.infer type
│
└─ src/__tests__/
   ├─ brand.contract.test.ts
   ├─ timestamp.adapter.test.ts
   ├─ transitions.assertion.test.ts
   ├─ strict-authoring.lint.test.ts
   └─ page-money-audit.test.ts
```

**Build-order note (SDK-SERVER-DESIGN §8 step 1):** this package is
non-behavioral and unblocks everything above it. It replaces the live
`packages/shared-types`. `zod` is the **only** runtime dep.

---

## 2. Branded IDs — all 19

### 2.1 Brand mechanism (`primitives/brand.ts`)

Carried verbatim from live `branded.ts` (the `unique symbol` technique is
correct — review §4 confirms the _mechanism_ is fine; the gap is that brands
never reach the schemas). Signature sketch:

```ts
declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };
```

### 2.2 The 19 ID types

16 existing (review §4 counts 16) **plus** the 3 the spec adds (`StaffId`,
`ScannerId`, `ExamQuestionId`).

| #   | Type                 | Brand tag              | Document / meaning                                      | Source   |
| --- | -------------------- | ---------------------- | ------------------------------------------------------- | -------- |
| 1   | `TenantId`           | `'TenantId'`           | `/tenants/{id}`                                         | existing |
| 2   | `ClassId`            | `'ClassId'`            | class within tenant                                     | existing |
| 3   | `StudentId`          | `'StudentId'`          | student profile                                         | existing |
| 4   | `TeacherId`          | `'TeacherId'`          | teacher profile                                         | existing |
| 5   | `ParentId`           | `'ParentId'`           | parent profile                                          | existing |
| 6   | `SpaceId`            | `'SpaceId'`            | learning space                                          | existing |
| 7   | `StoryPointId`       | `'StoryPointId'`       | story point (section)                                   | existing |
| 8   | `ItemId`             | `'ItemId'`             | `UnifiedItem`                                           | existing |
| 9   | `ExamId`             | `'ExamId'`             | exam                                                    | existing |
| 10  | `SubmissionId`       | `'SubmissionId'`       | submission                                              | existing |
| 11  | `UserId`             | `'UserId'`             | Firebase Auth uid (platform-wide)                       | existing |
| 12  | `SessionId`          | `'SessionId'`          | test/chat session                                       | existing |
| 13  | `AgentId`            | `'AgentId'`            | AI agent within space                                   | existing |
| 14  | `AcademicSessionId`  | `'AcademicSessionId'`  | academic session                                        | existing |
| 15  | `NotificationId`     | `'NotificationId'`     | notification                                            | existing |
| 16  | `QuestionBankItemId` | `'QuestionBankItemId'` | question-bank item                                      | existing |
| 17  | **`StaffId`**        | `'StaffId'`            | staff profile (spec §3; review §4)                      | **new**  |
| 18  | **`ScannerId`**      | `'ScannerId'`          | tenant-scoped scanner device (review D11 unification)   | **new**  |
| 19  | **`ExamQuestionId`** | `'ExamQuestionId'`     | exam question (linked ↔ `UnifiedItem.linkedQuestionId`) | **new**  |

Each as:

```ts
export type StaffId = Brand<string, "StaffId">;
export type ScannerId = Brand<string, "ScannerId">;
export type ExamQuestionId = Brand<string, "ExamQuestionId">;
```

### 2.3 Factory helpers (`as*()`)

One per ID — the **trust-boundary cast** (Firestore read, URL param, request
data → branded). All 19, including the 3 new ones (`asStaffId`, `asScannerId`,
`asExamQuestionId`). Signature:
`export const asStaffId = (id: string): StaffId => id as StaffId;`

> **Correction logged (review §4 stale note).** The review claims
> `asNotificationId`/`asQuestionBankItemId` are "unexported" — that is stale;
> they ARE exported in live `branded.ts:90-91`. We keep all 16 factories
> exported and add the 3 new ones. No factory is dropped.

### 2.4 `AnyId` + `IdOf` registry (new, for tooling)

A discriminant registry so contract tests and the `zBrandedId` helper can
enumerate brands:

```ts
export type AnyId =
  | TenantId
  | ClassId
  | StudentId
  | TeacherId
  | ParentId
  | SpaceId
  | StoryPointId
  | ItemId
  | ExamId
  | SubmissionId
  | UserId
  | SessionId
  | AgentId
  | AcademicSessionId
  | NotificationId
  | QuestionBankItemId
  | StaffId
  | ScannerId
  | ExamQuestionId;

export const BRAND_TAGS = [
  "TenantId",
  "ClassId",
  "StudentId",
  "TeacherId",
  "ParentId",
  "SpaceId",
  "StoryPointId",
  "ItemId",
  "ExamId",
  "SubmissionId",
  "UserId",
  "SessionId",
  "AgentId",
  "AcademicSessionId",
  "NotificationId",
  "QuestionBankItemId",
  "StaffId",
  "ScannerId",
  "ExamQuestionId",
] as const;
export type BrandTag = (typeof BRAND_TAGS)[number]; // length === 19 (asserted in test)
```

### 2.5 Zod helper for branded IDs (`primitives/branded-id.zod.ts`)

The bridge that puts brands **into** schemas (kills review D8). One generic
factory + per-ID exports:

```ts
import { z } from "zod";
// Non-empty trimmed string, re-typed to the brand. Firestore IDs: 1..1500 chars, no '/'.
export const zBrandedId = <B extends string>(_brand: B) =>
  z
    .string()
    .min(1)
    .max(1500)
    .regex(/^[^/]+$/, 'id must not contain "/"')
    .transform((s) => s as Brand<string, B>);

export const zTenantId = zBrandedId("TenantId");
export const zSpaceId = zBrandedId("SpaceId");
export const zItemId = zBrandedId("ItemId");
export const zExamQuestionId = zBrandedId("ExamQuestionId");
export const zStaffId = zBrandedId("StaffId");
export const zScannerId = zBrandedId("ScannerId");
// … all 19
```

`z.infer<typeof zSpaceId>` is `SpaceId` — so an entity authored with
`id: zSpaceId` yields a branded field automatically. **This is the single most
important schema change vs live** (every persisted ID field becomes branded
through `z.infer`, with no hand-written interface).

---

## 3. ISO-8601 `Timestamp` + the edge adapter

### 3.1 The type (`primitives/timestamp.ts`)

One canonical wall-clock representation everywhere above the storage edge:
**ISO-8601 UTC string**, branded so a raw `string` can't be passed where a
`Timestamp` is required.

```ts
export type Timestamp = Brand<string, "Timestamp">; // e.g. '2026-06-20T11:32:05.123Z'

/** Strict ISO-8601 with milliseconds + 'Z'. Canonical output of every adapter. */
export const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const isTimestamp = (v: unknown): v is Timestamp =>
  typeof v === "string" && ISO_8601_UTC.test(v);

/** Cast a known-good ISO string. Throws (dev) if it isn't canonical. */
export const asTimestamp = (iso: string): Timestamp => {
  if (!ISO_8601_UTC.test(iso))
    throw new RangeError(`not a canonical ISO-8601 UTC timestamp: ${iso}`);
  return iso as Timestamp;
};
```

### 3.2 The edge adapter — `toTimestamp()` (fixes D4 trichotomy)

The **only** place the three live time encodings are normalized. Lives in domain
so the server repository adapter, the transport adapter, and any test fixture
all use one normalizer. It accepts every shape the live model emits and produces
a canonical `Timestamp`:

```ts
/** Anything the storage edge can hand us. */
export type TimestampInput =
  | Timestamp // already canonical
  | string // any ISO-ish string (chat — D4)
  | number // epoch millis (progress/attempts — D4)
  | Date // JS Date
  | { seconds: number; nanoseconds: number } // FirestoreTimestamp (audit — D4); duck-typed,
  // NO firebase import — see §3.4
  | { toMillis(): number } // client/admin SDK Timestamp duck shape
  | { _seconds: number; _nanoseconds: number }; // serialized admin Timestamp over the wire

export function toTimestamp(input: TimestampInput): Timestamp;
export function toTimestamp(
  input: TimestampInput | null | undefined
): Timestamp | null;
export function toTimestamp(
  input: TimestampInput | null | undefined
): Timestamp | null {
  if (input == null) return null;
  const d = toDate(input); // internal: resolves every branch to a Date (UTC)
  return d.toISOString() as Timestamp; // toISOString() is always canonical ms+Z
}

/** Reverse edge: Timestamp → epoch millis (for duration math, sorting). */
export const toMillis = (t: Timestamp): number => Date.parse(t);
/** Timestamp → Date (UI formatting only; UI never parses ISO by hand). */
export const toDateObj = (t: Timestamp): Date => new Date(t);
```

Branch resolution inside `toDate(input)`:

- `number` → `new Date(input)` (epoch ms).
- `string` → `new Date(Date.parse(input))`; reject `NaN`.
- `Date` → as-is.
- `{seconds,nanoseconds}` / `{_seconds,_nanoseconds}` →
  `new Date(seconds*1000 + round(nanos/1e6))`.
- `{toMillis()}` → `new Date(input.toMillis())`.

### 3.3 The clock seam (server-authoritative, testable)

`AuthContext.now()` (SDK-SERVER-DESIGN §3.2) returns a `Timestamp`. Domain
provides the injectable clock type + a default so services can take
`now: Clock`:

```ts
export type Clock = () => Timestamp;
export const systemClock: Clock = () => new Date().toISOString() as Timestamp;
```

The SDK never trusts a client clock for authority (review #6); this seam keeps
"now" injectable and the test-session deadline server-driven.

### 3.4 Zod (`primitives/timestamp.zod.ts`) — two flavors, on purpose

```ts
// OUTPUT/canonical: what entities store & what response schemas validate. Strict.
export const zTimestamp = z
  .string()
  .regex(ISO_8601_UTC)
  .transform((s) => s as Timestamp);

// INPUT/lenient: edge ingestion only (repository adapter on the server). Accepts the trichotomy,
// normalizes via toTimestamp. NEVER used in a wire response schema.
export const zTimestampInput = z.preprocess(
  (v) => toTimestamp(v as TimestampInput),
  zTimestamp
);
```

**Rule:** entity field-level time is always `zTimestamp` (canonical).
`zTimestampInput` is reserved for the server-side admin adapter mapping raw
Firestore docs into domain entities — the one legitimate place the trichotomy is
collapsed. A lint test (§9) forbids `zTimestampInput` in any `api-contract`
response schema.

> **No firebase dependency.** `FirestoreTimestamp` is matched **structurally**
> (duck-typed `{seconds,nanoseconds}` / `{toMillis}`), never imported. This is
> what keeps `@levelup/domain` pure (SDK-SERVER-DESIGN §1.3) and is the explicit
> fix for the live `FirestoreTimestamp` interface in `identity/user.ts:11`
> leaking a Firebase-ish shape into the domain.

---

## 4. `AuditFields`, soft-delete, tenant-scoping (`primitives/audit.ts`)

Collapses review D5's three soft-delete conventions into **one** `archivedAt`.

```ts
export interface AuditFields {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: UserId;
  updatedBy: UserId;
}

/** Canonical soft-delete (D5): null = live, set = archived. No `deleted:boolean`, no status:'deleted'. */
export interface SoftDeletable {
  archivedAt: Timestamp | null;
}

/** Most tenant docs carry their tenantId for collection-group queries + defense-in-depth. */
export interface TenantScoped {
  tenantId: TenantId;
}

export type AuditedEntity = AuditFields & SoftDeletable;
```

Zod side (`audit.zod.ts`) provides the composable shapes + a `withAudit` mixin
so every entity schema appends audit uniformly:

```ts
export const zAuditFields = {
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  createdBy: zUserId,
  updatedBy: zUserId,
}; // a raw shape object, spread into zObject
export const zSoftDeletable = { archivedAt: zTimestamp.nullable() };
export const zTenantScoped = { tenantId: zTenantId };

/** entity authors: zObject({ ...fields, ...zAuditFields, ...zSoftDeletable }) */
export const withAudit = <T extends z.ZodRawShape>(shape: T) => ({
  ...shape,
  ...zAuditFields,
  ...zSoftDeletable,
});
```

---

## 5. The Zod-first `.strict()` authoring convention (`authoring/`)

This is the **enforced authoring law** that kills review D9/risk #5
(`.passthrough()` + inverted asserts).

### 5.1 `zObject()` — the only object factory (`authoring/strict.ts`)

```ts
import { z } from "zod";
/**
 * The ONE way to author an entity/object in @levelup/domain.
 * - Always .strict(): rejects unknown/renamed fields at the boundary (the D12 drift killer).
 * - A lint test (§9) forbids raw `z.object(` in src/entities/** — authors must use zObject.
 */
export const zObject = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).strict();
```

### 5.2 The `z.infer` pattern (`authoring/infer.ts`)

Types are **derived**, never hand-written (kills the "double source of truth",
review §4 last bullet):

```ts
export type Infer<S extends z.ZodTypeAny> = z.infer<S>; // output type (post-transform: branded)
export type InferIn<S extends z.ZodTypeAny> = z.input<S>; // input type (pre-transform)
```

**Authoring template every entity file follows** (the single canonical pattern):

```ts
// src/entities/space.ts
import { z } from "zod";
import { zObject } from "../authoring/strict";
import { zSpaceId, zClassId } from "../primitives/branded-id.zod";
import { withAudit, zTenantScoped } from "../primitives/audit.zod";
import { zSpaceStatus } from "../enums/space";

export const SpaceSchema = zObject({
  id: zSpaceId,
  ...zTenantScoped,
  title: z.string().min(1).max(200),
  status: zSpaceStatus,
  classIds: z.array(zClassId).default([]),
  ...withAudit({}), // appends audit + softDeletable
});
export type Space = z.infer<typeof SpaceSchema>; // ← the ONLY Space type. Branded ids, Timestamp times.
```

**Conventions (asserted by tests in §9):**

1. Every object uses `zObject` (⇒ `.strict()`), never bare `z.object`.
2. Every type is `z.infer<typeof XSchema>` — no hand-written `interface`/`type`
   duplicating a schema.
3. Every ID field uses a `zBrandedId`-derived schema (no bare `z.string()` for
   an id-named field).
4. Every time field uses `zTimestamp` (no `z.number()`/raw `z.string()` for
   `*At` fields).
5. Schema export is named `XSchema`; type export is `X`.

### 5.3 Naming surface

For each entity `X`: `export const XSchema` (the schema) +
`export type X = z.infer<typeof XSchema>`. `api-contract` then composes
request/response schemas from these (`SaveSpaceRequestSchema` embeds
`SpaceSchema.pick/partial/omit`) — one source, both sides (SDK-SERVER-DESIGN
§1.3).

---

## 6. `Page<T>`, cursor, money (transport-neutral primitives)

### 6.1 Pagination (`primitives/page.ts` + `page.zod.ts`)

The domain owns the **types**; `api-contract` owns the wire
`PageRequest`/`pageResponse` (common-api §7) but imports these so cursors are
opaque end-to-end (repos never leak a cursor to UI — SDK-SERVER-DESIGN §1.2c).

```ts
export type Cursor = Brand<string, "Cursor">; // opaque; base64 today, row-key tomorrow
export interface PageParams {
  cursor?: Cursor;
  limit: number;
} // limit 1..100, default 20
export interface Page<T> {
  items: T[];
  nextCursor: Cursor | null;
  total?: number;
}

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
```

```ts
// page.zod.ts
export const zCursor = z.string().transform((s) => s as Cursor);
export const zPageParams = zObject({
  cursor: zCursor.optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT)
    .default(DEFAULT_PAGE_LIMIT),
});
export const zPage = <T extends z.ZodTypeAny>(item: T) =>
  zObject({
    items: z.array(item),
    nextCursor: zCursor.nullable(),
    total: z.number().int().optional(),
  });
```

### 6.2 Money (`primitives/money.ts` + `money.zod.ts`)

Replaces the live ad-hoc `{ amount: number; currency: string }` on
`PurchaseRecord` (`identity/user.ts:22-29`) with a safe minor-units
representation (no float arithmetic on currency).

```ts
export const CURRENCIES = ["INR", "USD"] as const; // extend as B2C markets grow
export type Currency = (typeof CURRENCIES)[number];

/** Amount stored in MINOR units (paise/cents) as an integer — never a float. */
export interface Money {
  amountMinor: number;
  currency: Currency;
}

export const money = (amountMinor: number, currency: Currency): Money => ({
  amountMinor: Math.round(amountMinor),
  currency,
});
export const addMoney = (a: Money, b: Money): Money => {
  // same-currency only; throws otherwise
  if (a.currency !== b.currency)
    throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
};
export const formatMoney = (m: Money): string =>
  /* Intl.NumberFormat minor→major */ "";
```

```ts
// money.zod.ts
export const zCurrency = z.enum(CURRENCIES);
export const zMoney = zObject({
  amountMinor: z.number().int(),
  currency: zCurrency,
});
```

### 6.3 JSON value (`primitives/json.ts`)

For `ApiErrorDetails.meta` (consumed by `api-contract`, SDK-SERVER-DESIGN §5.2)
— kept here so the type is shared without `api-contract` redefining it.

```ts
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };
export type JsonObject = { [k: string]: JsonValue };
```

---

## 7. Shared enums + `ALLOWED_TRANSITIONS` data shape

### 7.1 The as-const → zod bridge (`enums/enum.ts`)

One helper so every enum is authored **once** as `as const` and gets a matching
zod schema + type, with no second source:

```ts
import { z } from "zod";
/** value tuple → readonly tuple type (already `as const` at the call site). */
export type ValuesOf<T extends readonly string[]> = T[number];
/** Build a z.enum from an as-const tuple. Members are guaranteed identical to the type. */
export const zEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values);
```

### 7.2 The status enums (each = `as const` tuple + `z.infer` type + zod)

Carried from live `constants/grades.ts` + `space.ts` and the new ones the
rebuild needs:

```ts
// enums/space.ts
export const SPACE_STATUSES = ["draft", "published", "archived"] as const;
export type SpaceStatus = (typeof SPACE_STATUSES)[number];
export const zSpaceStatus = zEnum(SPACE_STATUSES);
```

```ts
// enums/exam.ts  — REVIEW open-Q: 'completed' is unreachable (be-autograde). Decision logged §10.
export const EXAM_STATUSES = [
  "draft",
  "question_paper_uploaded",
  "question_paper_extracted",
  "published",
  "grading",
  "results_released",
  "archived", // 'completed' DROPPED (review open-Q)
] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];
export const zExamStatus = zEnum(EXAM_STATUSES);
```

```ts
// enums/submission.ts — REVIEW open-Q: OCR stage is dead. Decision logged §10 (kept behind a flag).
export const SUBMISSION_PIPELINE_STATUSES = [
  "uploaded",
  "scouting",
  "scouting_failed",
  "scouting_complete",
  "grading",
  "grading_partial",
  "grading_failed",
  "grading_complete",
  "finalization_failed",
  "ready_for_review",
  "reviewed",
  "failed",
  "manual_review_needed",
  // ocr_processing / ocr_failed retained ONLY if OCR is wired (see §10); excluded by default.
] as const;
export type SubmissionPipelineStatus =
  (typeof SUBMISSION_PIPELINE_STATUSES)[number];
export const zSubmissionPipelineStatus = zEnum(SUBMISSION_PIPELINE_STATUSES);
```

Also: `QUESTION_GRADING_STATUSES`/`QuestionGradingStatus`,
`TEST_SESSION_STATUSES`/`TestSessionStatus`
(`'in_progress' | 'submitted' | 'expired' | 'graded'`), `TENANT_STATUSES`
(`'active' | 'suspended' | 'deactivated'`), `MEMBERSHIP_STATUSES`,
`TENANT_ROLES`/`TenantRole`
(`'admin' | 'teacher' | 'parent' | 'student' | 'staff'`), content enums
(`QUESTION_TYPES` (15), `MATERIAL_TYPES` (7), `STORY_POINT_TYPES` (4),
`ITEM_KINDS`), `GRADE_THRESHOLDS`/`GradeLetter`, `BLOOMS_LEVELS`/`BloomsLevel`,
`AUTH_PROVIDERS`, `UPLOAD_SOURCES` (`'web'|'scanner'|'rn'` — adds the
live-missing `'gcs'` decision per review D12: **dropped**, single ingestion
path), and the permission-key tuples `TEACHER_PERMISSION_KEYS` /
`STAFF_PERMISSION_KEYS` (review §1 — typed keys, shared by rules-gen).

### 7.3 `ALLOWED_TRANSITIONS` — the type-level contract (`transitions/types.ts`)

The shape is **build-time-checked data**: a map from each status to the set of
statuses it may move to. The contract type guarantees keys and values are drawn
from the **same** as-const enum (this is the compile-time assertion that union
members match the status enums — open-Q / top-risk #5).

```ts
/** For a status union S: keys must be exactly the members of S; each value an array of members of S. */
export type TransitionMap<S extends string> = {
  readonly [From in S]: readonly S[];
};
```

### 7.4 The machines + the compile-time assertion (`transitions/*.ts`)

Each machine is authored as data and **`satisfies TransitionMap<TheEnumType>`**.
Because the type key is `[From in S]`, TypeScript fails the build if (a) a
status key is **missing**, (b) a key is **not** a member of the enum (typo /
renamed status), or (c) a target value is not a member. This is exactly the
guard the spec asks for.

```ts
// transitions/space.ts
import type { SpaceStatus } from "../enums/space";
export const SPACE_TRANSITIONS = {
  draft: ["published", "archived"],
  published: ["archived", "draft"],
  archived: ["draft"],
} as const satisfies TransitionMap<SpaceStatus>;
```

```ts
// transitions/exam.ts  (no 'completed' — matches the trimmed EXAM_STATUSES, §7.2)
export const EXAM_TRANSITIONS = {
  draft: ["question_paper_uploaded", "archived"],
  question_paper_uploaded: ["question_paper_extracted", "archived"],
  question_paper_extracted: ["published", "archived"],
  published: ["grading", "archived"],
  grading: ["results_released", "grading"], // self for partial re-grade
  results_released: ["archived"],
  archived: [],
} as const satisfies TransitionMap<ExamStatus>;
```

`submission.ts` and `test-session.ts` likewise (terminal states map to `[]`).

> **Why `satisfies` (not annotation).** `as const satisfies TransitionMap<S>`
> keeps the **literal** value types (so repos can do
> `SPACE_TRANSITIONS[from].includes(to)` with full narrowing) **while**
> enforcing the enum-membership contract at compile time. A plain
> `: TransitionMap<S>` annotation would widen the values and lose the literal
> precision the pre-check needs.

### 7.5 Aggregate + helpers (`transitions/index.ts`)

```ts
export const ALLOWED_TRANSITIONS = {
  space: SPACE_TRANSITIONS,
  exam: EXAM_TRANSITIONS,
  submission: SUBMISSION_TRANSITIONS,
  testSession: TEST_SESSION_TRANSITIONS,
} as const;
export type TransitionDomain = keyof typeof ALLOWED_TRANSITIONS;

/** Pure pre-check (UX in repos; server re-enforces — SDK-SERVER-DESIGN §2.4/§3). */
export const canTransition = <D extends TransitionDomain>(
  domain: D,
  from: keyof (typeof ALLOWED_TRANSITIONS)[D],
  to: string
): boolean =>
  (ALLOWED_TRANSITIONS[domain][from] as readonly string[]).includes(to);

/** Server enforcement helper (used by @levelup/services via assertTransition). */
export const assertTransition = <D extends TransitionDomain>(
  domain: D,
  from: keyof (typeof ALLOWED_TRANSITIONS)[D],
  to: string
): void => {
  if (!canTransition(domain, from, to))
    throw new InvalidTransitionError(domain, String(from), to);
};
```

`InvalidTransitionError` carries `{ domain, from, to }` so `api-contract`'s
`fail('INVALID_TRANSITION', …)` can map it (the error _code_ lives in
`api-contract`; domain only throws a typed marker error).

---

## 8. Public surface (`src/index.ts` barrel)

Single import point. Grouped re-exports:

```ts
// primitives
export * from "./primitives/brand"; // Brand, 19 ID types, as*(), AnyId, BRAND_TAGS
export * from "./primitives/branded-id.zod"; // zBrandedId + z<Id> schemas
export * from "./primitives/timestamp"; // Timestamp, toTimestamp, toMillis, Clock, systemClock
export * from "./primitives/timestamp.zod"; // zTimestamp, zTimestampInput
export * from "./primitives/money"; // Money, Currency, money(), addMoney, formatMoney
export * from "./primitives/money.zod";
export * from "./primitives/page"; // Page<T>, PageParams, Cursor, limits
export * from "./primitives/page.zod"; // zPageParams, zPage, zCursor
export * from "./primitives/audit"; // AuditFields, SoftDeletable, TenantScoped
export * from "./primitives/audit.zod"; // zAuditFields, withAudit, …
export * from "./primitives/json"; // JsonValue, JsonObject
// authoring
export * from "./authoring/strict"; // zObject
export * from "./authoring/infer"; // Infer, InferIn
// enums
export * from "./enums"; // all status/role/content/permission enums + z*
// transitions
export * from "./transitions"; // ALLOWED_TRANSITIONS, canTransition, assertTransition, types
// entities (detailed in domain-entities.md)
export * from "./entities";
```

---

## 9. Contract + lint tests this layer requires

All in `src/__tests__/` (vitest), plus repo-level `no-restricted-imports` lint
rules.

| Test / rule                              | File                                  | Asserts                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brand count + tags**                   | `brand.contract.test.ts`              | `BRAND_TAGS.length === 19`; every tag has a matching `as*` factory and a `z<Id>` schema; `z.infer<typeof zSpaceId>` is assignable to `SpaceId` (type-level via `expectTypeOf`). Guards against forgetting the 3 new brands.                                                                                                                         |
| **Timestamp adapter**                    | `timestamp.adapter.test.ts`           | `toTimestamp` collapses all 6 input branches (epoch number, ISO string, `Date`, `{seconds,nanoseconds}`, `{_seconds,_nanoseconds}`, `{toMillis}`) to **byte-identical** canonical `ISO_8601_UTC`; `null/undefined` → `null`; round-trip `toMillis(toTimestamp(ms)) === ms` within ms precision; rejects `NaN`/garbage. Directly proves D4 is fixed. |
| **Transition ↔ enum membership**         | `transitions.assertion.test.ts`       | runtime: every key of each machine ∈ its enum tuple AND every target ∈ the enum tuple (mirrors the compile-time `satisfies`); every enum member appears as a key (no missing source state); terminal states map to `[]`. `canTransition`/`assertTransition` behave; `assertTransition` throws `InvalidTransitionError` with `{domain,from,to}`.     |
| **Strict authoring**                     | `strict-authoring.lint.test.ts`       | for every exported `*Schema` in `entities/**`: it is a `ZodObject` with `unknownKeys === 'strict'` (no `.passthrough`); every field whose key matches `/Id$                                                                                                                                                                                         | Ids$/`is brand-derived; every`\*At`field is`zTimestamp`; a known-bad payload with an extra field **fails** `.parse`. Proves D9 inversion holds. |
| **Page/Money/Audit**                     | `page-money-audit.test.ts`            | `zPage(item)` shape; `zPageParams` default limit 20, max 100; `money()` rounds + integer minor units; `addMoney` throws on currency mismatch; `withAudit` injects the 6 audit/soft-delete fields.                                                                                                                                                   |
| **Purity (lint)**                        | `.eslintrc` `no-restricted-imports`   | `@levelup/domain` source may import **only** `zod` and relative paths — bans `firebase`, `firebase-admin`, `firebase-functions`, `react`, `@levelup/*` (no upward deps). Enforces SDK-SERVER-DESIGN §1.3.                                                                                                                                           |
| **No raw `z.object` in entities (lint)** | `no-restricted-syntax`                | bans `z.object(` CallExpression inside `src/entities/**`; authors must use `zObject`. Backstops the `.strict()` law.                                                                                                                                                                                                                                |
| **`zTimestampInput` containment (lint)** | `no-restricted-imports` (path-scoped) | `zTimestampInput` importable only by the server admin adapter package, never by `api-contract` response schemas (keeps the trichotomy collapse at the storage edge only).                                                                                                                                                                           |
| **RN-bundle build (CI)**                 | CI job                                | the package builds clean under an RN/Metro resolution (no node-only/DOM transitive dep) — mitigates SDK-SERVER-DESIGN §7.2 "RN pulls a web/node-only dep".                                                                                                                                                                                          |

---

## 10. Notes / decisions / open items reconciled here

- **Brand count.** Review §4 says live has **16**; spec adds **3** (`StaffId`,
  `ScannerId`, `ExamQuestionId`) ⇒ **19** total (matches the task;
  SDK-SERVER-DESIGN §1.1 ascii art still says "17" — that figure is stale,
  flagged for correction in the parent spec).
- **Stale review note corrected.** `asNotificationId`/`asQuestionBankItemId` ARE
  exported today; all 16 factories are carried forward (none dropped) + 3 added.
- **`FirestoreTimestamp` is duck-typed, never imported** — this is the mechanism
  that keeps domain pure while still ingesting the live audit shape; replaces
  the `identity/user.ts` `FirestoreTimestamp` interface.
- **Timestamp: two zod flavors on purpose.** `zTimestamp` (strict, canonical,
  used in entities + wire responses) vs `zTimestampInput` (lenient, edge-only).
  A lint rule prevents the lenient one leaking into the wire contract.
- **`satisfies` over annotation** for transition maps — preserves literal value
  types for repo pre-checks while enforcing enum-key membership at compile time.
- **Enum decisions deferred-but-recorded (review open-Qs):** `'completed'` exam
  status **dropped** (unreachable); OCR submission statuses **excluded by
  default** (dead pipeline) — both behind a documented toggle so re-introduction
  is a one-line tuple change; `'gcs'` upload source **dropped** (single
  `uploadAnswerSheets` ingestion path). These touch `EXAM_STATUSES` /
  `SUBMISSION_PIPELINE_STATUSES` / `UPLOAD_SOURCES` — confirm with autograde
  owners before lock.
- **Money is new** vs live (`PurchaseRecord` used bare `amount/currency`
  floats). Minor-units integer representation prevents float drift;
  `purchaseSpace` response contract (SDK-SERVER-DESIGN open-Q 6) should adopt
  `Money`.
- **Scope boundary:** per-entity schemas
  (Space/Item/Exam/Submission/User/Membership/…) are authored in this package
  using these primitives but specified field-by-field in the sibling
  `domain-entities.md` plan, including the `UnifiedItem.payload` **real
  `z.discriminatedUnion`** (review risk #3) — that union is built from the
  `QUESTION_TYPES`/`MATERIAL_TYPES`/`STORY_POINT_TYPES` enums defined here.
- **Downward-only respected:** the only runtime dependency is `zod`. Nothing in
  `@levelup/domain` imports `api-contract` or above, or any platform SDK.
  `api-contract` will import these primitives to compose the wire
  `PageRequest`/`pageResponse`, `ALLOWED_TRANSITIONS` (re-export), and
  request/response schemas.

```

```
