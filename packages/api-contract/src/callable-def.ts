/**
 * `CallableDef` — the per-callable contract unit (SDK-LAYERS-PLAN §3.1 /
 * api-contract-core.md §2).
 *
 * One entry per callable: the single source of truth for name, owning module,
 * wire schemas, auth/rate policy, idempotency, authority-sensitivity, and
 * invalidation hints. `Req`/`Res` are PHANTOM type params recovered via
 * `z.infer` at the registry boundary (see `registry.ts`).
 *
 * This layer is framework-free: `invalidates` uses plain query-key-root STRINGS
 * (not imported `@levelup/query` key factories) to keep the downward-only edge.
 */
import type { ZodType } from "zod";

/** The four deploy-independent bounded-context codebases. */
export type ApiModule = "identity" | "levelup" | "autograde" | "analytics";
export const API_MODULES = ["identity", "levelup", "autograde", "analytics"] as const;

/** Drives rate limiter + contract-test agreement on tier-per-callable (common-api §9). */
export type RateTier = "write" | "read" | "ai" | "auth" | "report";
export const RATE_TIERS = ["write", "read", "ai", "auth", "report"] as const;

/** 'public' is ONLY for pre-auth lookups (lookupTenantByCode). Everything else is 'authed'. */
export type AuthMode = "authed" | "public";

/**
 * Idempotency dedupe-key hint (MERGE-IDEMPOTENCY, §3.1).
 *  - `'transport'`     → dedupe on the api-client UUIDv7 retry key (envelope).
 *  - `'domain:<...>'`  → server dedupe key derived from named request fields.
 * NO request *schema* may declare an `idempotencyKey` field; the UUIDv7 lives in
 * the api-client envelope, the domain key is this def hint.
 */
export type IdempotencyKeyHint = "transport" | `domain:${string}`;

/**
 * One entry per callable. `name` is declared as a plain `string` on the generic
 * `CallableDef` to break the `CallableName = keyof typeof CALLABLES` cycle; the
 * registry re-narrows via the `satisfies` check (registry.ts §3).
 */
export interface CallableDef<Req = unknown, Res = unknown> {
  /** Versioned, namespaced, stable: `v1.<module>.<operation>`. MUST equal its registry key. */
  readonly name: string;
  /** Which codebase owns/deploys it. MUST equal the `<module>` segment of `name`. */
  readonly module: ApiModule;
  /** `.strict()` request schema. For tenant-scoped ops it MUST NOT contain a `tenantId` key (§10.1). */
  readonly requestSchema: ZodType<Req>;
  /** `.strict()` response schema. Validated client-side in dev to catch drift. */
  readonly responseSchema: ZodType<Res>;
  /** 'public' only for pre-auth (lookupTenantByCode). */
  readonly authMode: AuthMode;
  /** Tier for the limiter + contract agreement. */
  readonly rateTier: RateTier;
  /** Server dedupes retries when true. Pairs with `idempotencyKey` hint (MERGE-IDEMPOTENCY). */
  readonly idempotent?: boolean;
  /** Dedupe identity hint — never a request-schema field. */
  readonly idempotencyKey?: IdempotencyKeyHint;
  /**
   * Super-admin cross-tenant escape hatch. When true, the request schema MAY carry
   * an OPTIONAL `tenantOverride`; buildAuthContext honors it only if ctx.isSuperAdmin.
   * The ONLY way a tenant id legitimately appears in a request (audited). Default false.
   */
  readonly allowsTenantOverride?: boolean;
  /**
   * Query-key roots this mutation dirties — a HINT consumed by `@levelup/query`
   * invalidation. Plain strings, not live key factories. Reads omit this.
   */
  readonly invalidates?: readonly string[];
  /**
   * Tags mutating role/status/class/permission callables that MUST call
   * `syncMembershipClaims` server-side (common-api §4.5).
   */
  readonly resyncsClaims?: boolean;
  /**
   * The unified authority flag (T9 / CONV-4). Marks grading/publish/lifecycle/
   * purchase/claims/secret callables. `AUTHORITY_CALLABLES` is REGENERATED from
   * this flag — never hand-maintained. Never appears on an optimistic allow-list.
   */
  readonly authoritySensitive?: boolean;
}

/**
 * Authoring helper — gives inference + a single place to default flags. Domain
 * plans author defs through this so `name`/`module`/schemas stay consistent.
 */
export function defineCallable<Req, Res>(def: CallableDef<Req, Res>): CallableDef<Req, Res> {
  return def;
}
