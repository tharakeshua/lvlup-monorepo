/**
 * `SubscriptionDef` — the per-channel realtime contract unit (SDK-LAYERS-PLAN
 * §3.3 / api-contract-core.md §7.1 / SDK-SERVER §5.6).
 *
 * Parallel to `CallableDef` but for the `subscribe()` seam: one entry per realtime
 * channel, the single source of truth for the channel name, owning module, the
 * `.strict()` params + slim-projection payload schemas, and a `source` HINT that
 * tells transport-firebase whether the wire location is a Firestore doc, a
 * Firestore query, or an RTDB node.
 *
 * **Authority invariant (MERGE-REALTIME-AUTHORITY).** Every `payload` here is a
 * SERVER-MAINTAINED SLIM PROJECTION — never a fat authoritative doc and never a
 * doc carrying answer-key / guidance / cost (⚷) or a release-gated score/grade.
 * The realtime read path is authority-equivalent to the callable read path.
 *
 * `name` is declared as a plain `string` on the generic `SubscriptionDef` to
 * break the `SubscriptionName = keyof typeof SUBSCRIPTIONS` cycle (mirrors the
 * `CallableDef` resolution); `registry.ts` re-narrows via the `satisfies` check.
 * The phantom `Params`/`Payload` carry inference through `ParamsOf`/`PayloadOf`.
 */
import type { ZodType } from "zod";
import type { ApiModule } from "../callable-def.js";

/** Underlying wire-source kind — a HINT for transport-firebase. */
export type SubscriptionSource = "firestore-doc" | "firestore-query" | "rtdb-node";

/** Realtime channel definition — parallel to CallableDef but for subscribe(). */
export interface SubscriptionDef<Params = unknown, Payload = unknown> {
  /** Versioned name `v1.<module>.<channel>`. MUST equal its registry key. */
  readonly name: string;
  /** Which codebase owns/produces the projection. */
  readonly module: ApiModule;
  /**
   * `.strict()` params schema (sessionId, submissionId, scope, …). The same
   * no-`tenantId` rule as requests applies — tenant is claim-derived server-side.
   */
  readonly params: ZodType<Params>;
  /**
   * `.strict()` slim-projection payload schema — what each emission is validated
   * against on the client. Drops ⚷ fields + any pre-release score/grade.
   */
  readonly payload: ZodType<Payload>;
  /** Underlying source kind — Firestore doc/query vs RTDB node. */
  readonly source: SubscriptionSource;
}

/**
 * Authoring helper — gives inference + a single place to shape defs. Mirrors
 * `defineCallable`; keeps `name`/`module`/schemas consistent across modules.
 */
export function defineSubscription<P, T>(def: SubscriptionDef<P, T>): SubscriptionDef<P, T> {
  return def;
}
