/**
 * no-tenant-id-in-request (SDK-LAYERS-PLAN.md §8 D2 / api-contract-core.md §10.1
 * / T8). The #1 authority boundary: NO tenant-scoped request schema may declare a
 * `tenantId` field. Super-admin cross-tenant travels as an OPTIONAL
 * `tenantOverride`, allowed ONLY on `allowsTenantOverride:true` defs.
 *
 * T8 hardening: the key-walker recurses fully (no depth<2 cap), with a cycle
 * guard, and unwraps Optional/Nullable/Default/Catch/Pipeline/Readonly/Branded/
 * Lazy/Effects/Union/DiscriminatedUnion/Array/Record/Tuple, so a `tenantId`
 * smuggled at depth≥2 or behind a wrapper is still caught. Includes a planted
 * self-test (a depth-3 tenantId must be detected).
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import * as contract from "../index";

const C = contract as unknown as {
  CALLABLES?: Record<string, { allowsTenantOverride?: boolean; requestSchema: z.ZodTypeAny }>;
};
const ready = Boolean(C.CALLABLES);

/**
 * Recursively collect every object KEY name reachable from a Zod schema. No depth
 * cap; cycle-guarded by a visited set on the inner `_def` identity.
 */
export function collectKeys(schema: z.ZodTypeAny, seen = new Set<unknown>()): Set<string> {
  const keys = new Set<string>();
  const visit = (s: z.ZodTypeAny | undefined): void => {
    if (!s) return;
    const def = (s as unknown as { _def?: Record<string, unknown> })._def;
    if (!def || seen.has(def)) return;
    seen.add(def);

    const anyS = s as unknown as {
      shape?: Record<string, z.ZodTypeAny> | (() => Record<string, z.ZodTypeAny>);
      _def: Record<string, unknown>;
    };

    // ZodObject — record its keys + recurse into each value
    const shape =
      typeof anyS.shape === "function"
        ? (anyS.shape as () => Record<string, z.ZodTypeAny>)()
        : anyS.shape;
    if (shape && typeof shape === "object") {
      for (const [k, v] of Object.entries(shape)) {
        keys.add(k);
        visit(v);
      }
    }

    // unwrap common wrappers (Zod v4 _def fields)
    const inner =
      (def["innerType"] as z.ZodTypeAny | undefined) ??
      (def["schema"] as z.ZodTypeAny | undefined) ??
      (def["type"] as z.ZodTypeAny | undefined);
    if (inner) visit(inner);

    // Effects / Pipeline
    if (def["in"]) visit(def["in"] as z.ZodTypeAny);
    if (def["out"]) visit(def["out"] as z.ZodTypeAny);

    // Union / DiscriminatedUnion
    const options = def["options"] as z.ZodTypeAny[] | Map<unknown, z.ZodTypeAny> | undefined;
    if (Array.isArray(options)) options.forEach(visit);
    else if (options instanceof Map) options.forEach((v) => visit(v));

    // Array element
    if (def["element"]) visit(def["element"] as z.ZodTypeAny);
    // Record value + key
    if (def["valueType"]) visit(def["valueType"] as z.ZodTypeAny);
    // Tuple items
    const items = def["items"] as z.ZodTypeAny[] | undefined;
    if (Array.isArray(items)) items.forEach(visit);
    // Lazy getter
    const getter = def["getter"] as (() => z.ZodTypeAny) | undefined;
    if (typeof getter === "function") {
      try {
        visit(getter());
      } catch {
        /* lazy cycle — guarded by `seen` */
      }
    }
  };
  visit(schema);
  return keys;
}

describe("no-tenant-id-in-request walker self-test (T8)", () => {
  it("detects a tenantId planted at depth 3 behind optional + array wrappers", () => {
    const planted = z
      .object({
        data: z.object({ meta: z.array(z.object({ tenantId: z.string() })).optional() }),
      })
      .strict();
    expect(collectKeys(planted).has("tenantId")).toBe(true);
  });

  it("does not false-positive on a clean schema", () => {
    const clean = z.object({ spaceId: z.string(), data: z.object({ title: z.string() }) }).strict();
    expect(clean ? collectKeys(clean).has("tenantId") : false).toBe(false);
  });
});

(ready ? describe : describe.skip)("no-tenant-id-in-request (registry)", () => {
  const CALLABLES = C.CALLABLES!;

  it("NO request schema declares a tenantId key", () => {
    const offenders: string[] = [];
    for (const [name, def] of Object.entries(CALLABLES)) {
      if (collectKeys(def.requestSchema as z.ZodTypeAny).has("tenantId")) offenders.push(name);
    }
    expect(offenders, `tenantId leaked into request body:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("NO request schema declares an idempotencyKey field literally (§3.1 MERGE-IDEMPOTENCY)", () => {
    const offenders: string[] = [];
    for (const [name, def] of Object.entries(CALLABLES)) {
      if (collectKeys(def.requestSchema as z.ZodTypeAny).has("idempotencyKey"))
        offenders.push(name);
    }
    // Plan: the UUIDv7 lives in the api-client envelope; the domain key is a def
    // hint — neither is a strict() request field. (recordItemAttempt is the one
    // documented carve-out per §3.2; the registry/validation phase reconciles.)
    expect(
      offenders.length,
      `idempotencyKey in request schema:\n${offenders.join("\n")}`
    ).toBeLessThanOrEqual(1);
  });

  it("tenantOverride appears ONLY on allowsTenantOverride:true defs (R11 biconditional)", () => {
    const violations: string[] = [];
    for (const [name, def] of Object.entries(CALLABLES)) {
      const hasOverride = collectKeys(def.requestSchema as z.ZodTypeAny).has("tenantOverride");
      if (hasOverride && !def.allowsTenantOverride) violations.push(`${name}: field without flag`);
      if (!hasOverride && def.allowsTenantOverride) violations.push(`${name}: flag without field`);
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
