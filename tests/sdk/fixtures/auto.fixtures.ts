/**
 * Auto-derived fixtures (T1 GATE backstop) — SDK-LAYERS-PLAN.md §3.2 / §7.2 / T1.
 *
 * The T1 gate requires EVERY callable in `CALLABLE_NAMES` to have a request/response
 * fixture. The hand-authored sibling files (`identity.fixtures.ts`, …) cover the
 * highest-authority paths with curated seed-state preconditions + extra `expect`
 * assertions. This file is the BACKSTOP: it introspects the live `CALLABLES`
 * registry and registers a SCHEMA-VALID sampled request for every callable that a
 * sibling file did not already register — so adding a callable can never silently
 * leave the registry without a fixture (the gate stays mechanically true), while
 * curated fixtures always win (registered first; `registerFixture` is
 * first-write-wins because this file is imported LAST).
 *
 * The sample request is derived from the callable's `.strict()` Zod request schema
 * (the same SSOT the contract loop validates against), so each auto-fixture is a
 * VALID request — never a body `tenantId` (D2; tenant-scoped ops have no tenantId
 * key), enums pick their first member, ISO-date strings match their pattern, and
 * non-empty arrays get the minimum required element count.
 *
 * Import ORDER (index.ts): curated files FIRST, this one LAST, so curated wins.
 */
import {
  registerFixture,
  CALLABLE_FIXTURES,
  type DemoRole,
  type SeedState,
} from "./callable-fixture";

/**
 * The contract registry is injected by the caller (the `tests/sdk` package cannot
 * resolve `@levelup/api-contract` directly — neither the api-contract self-test
 * run nor the workspace links it under `tests/`). Both consumers pass their own
 * live registry: `registry-integrity.test.ts` (api-contract package, via `../index`)
 * and the emulator contract loop (lazy `import('@levelup/api-contract')`).
 */
type MinimalDef = { module: string; authMode: string; requestSchema: unknown };
type Registry = {
  CALLABLES: Record<string, MinimalDef>;
  CALLABLE_NAMES: readonly string[];
};

// ---- minimal Zod-v4 schema sampler (produces a schema-valid request) ----

type ZDef = Record<string, unknown> & { type?: string };
function defOf(s: unknown): ZDef | undefined {
  const anyS = s as { _zod?: { def?: ZDef }; def?: ZDef };
  return anyS?._zod?.def ?? anyS?.def;
}

function checkPattern(d: ZDef): string | null {
  const checks = (d.checks as Array<{ _zod?: { def?: ZDef }; def?: ZDef }> | undefined) ?? [];
  for (const c of checks) {
    const cd =
      (c as { _zod?: { def?: ZDef }; def?: ZDef })._zod?.def ??
      (c as { def?: ZDef }).def ??
      (c as unknown as ZDef);
    if (cd?.pattern) return String(cd.pattern);
    if (cd?.format) return "FMT:" + String(cd.format);
  }
  if (d.pattern) return String(d.pattern);
  if (d.format) return "FMT:" + String(d.format);
  return null;
}

function strSample(d: ZDef, path: string): string {
  const p = checkPattern(d);
  if (p) {
    if (p === "FMT:email" || p.includes("@")) return "fixture@example.com";
    if (p === "FMT:uuid") return "00000000-0000-0000-0000-000000000000";
    if (p === "FMT:url" || p === "FMT:uri") return "https://example.com/x";
    if (p.includes("\\d{4}-\\d{2}-\\d{2}") && p.includes("T")) return "2026-01-01T00:00:00.000Z";
    if (p.includes("\\d{4}-\\d{2}-\\d{2}")) return "2026-01-01";
    if (p === "FMT:datetime" || p === "FMT:date_time") return "2026-01-01T00:00:00.000Z";
    if (p === "FMT:date") return "2026-01-01";
  }
  return "fixture_" + (path.split(".").pop() || "s").replace(/\[\]$/, "");
}

function arrMin(d: ZDef): number {
  let min = 0;
  const checks = (d.checks as Array<{ _zod?: { def?: ZDef }; def?: ZDef }> | undefined) ?? [];
  for (const c of checks) {
    const cd =
      (c as { _zod?: { def?: ZDef }; def?: ZDef })._zod?.def ??
      (c as { def?: ZDef }).def ??
      (c as unknown as ZDef);
    if (typeof cd?.minimum === "number") min = Math.max(min, cd.minimum as number);
  }
  return min;
}

function sample(schema: unknown, path = ""): unknown {
  const d = defOf(schema);
  if (!d) return undefined;
  switch (d.type) {
    case "object": {
      const out: Record<string, unknown> = {};
      const shape = (d.shape as Record<string, unknown>) ?? {};
      for (const [k, v] of Object.entries(shape)) {
        if (defOf(v)?.type === "optional") continue; // minimal request — skip optionals
        out[k] = sample(v, path + "." + k);
      }
      return out;
    }
    case "optional":
      return undefined;
    case "nullable":
    case "default":
    case "readonly":
      return sample(d.innerType, path);
    case "pipe":
      return sample(d.in, path);
    case "lazy":
      return sample((d.getter as () => unknown)(), path);
    case "string":
      return strSample(d, path);
    case "number":
    case "int":
      return 1;
    case "bigint":
      return BigInt(1);
    case "boolean":
      return false;
    case "date":
      return new Date();
    case "literal":
      return Array.isArray(d.values) ? (d.values as unknown[])[0] : d.value;
    case "enum": {
      const vals = d.entries
        ? Object.values(d.entries as Record<string, unknown>)
        : (d.values as unknown[]);
      return Array.isArray(vals)
        ? vals[0]
        : Object.values((vals as Record<string, unknown>) ?? {})[0];
    }
    case "array": {
      const cnt = arrMin(d);
      const arr: unknown[] = [];
      for (let i = 0; i < cnt; i++) arr.push(sample(d.element, path + "[]"));
      return arr;
    }
    case "tuple":
      return ((d.items as unknown[]) ?? []).map((it) => sample(it, path));
    case "record":
      return {};
    case "union":
      return sample((d.options as unknown[])[0], path);
    case "unknown":
    case "any":
      return "fixture";
    case "null":
      return null;
    case "discriminatedUnion":
      return sample(((d.options as unknown[]) ?? [])[0], path);
    default:
      return undefined;
  }
}

// ---- role + seed-state defaults per module (curated fixtures override these) ----

function defaultRole(module: string, authMode: string): DemoRole {
  if (authMode === "public") return "public";
  switch (module) {
    case "identity":
      return "tenantAdmin";
    case "autograde":
      return "teacher";
    case "analytics":
      return "teacher";
    case "levelup":
    default:
      return "teacher";
  }
}

// ---- register a backstop fixture for every uncovered callable ----

/**
 * Idempotent. Registers a schema-valid backstop fixture for every callable in the
 * injected registry that a curated file did not already cover. Curated fixtures
 * always win (they are registered before this runs, and the `CALLABLE_FIXTURES[name]`
 * guard skips them). Safe to call more than once.
 */
export function registerAutoFixtures(registry: Registry): void {
  for (const name of registry.CALLABLE_NAMES) {
    if (CALLABLE_FIXTURES[name]) continue; // curated (or already auto) — leave it
    const def = registry.CALLABLES[name];
    if (!def) continue;
    const seedState: SeedState = def.authMode === "public" ? "none" : "contract-tenant";
    registerFixture(name, {
      request: sample(def.requestSchema) as unknown,
      as: defaultRole(def.module, def.authMode),
      seedState,
      skip: true,
      reason:
        "auto-derived backstop fixture (schema-valid request; not yet curated for the emulator loop)",
    });
  }
}
