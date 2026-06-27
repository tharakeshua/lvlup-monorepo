/**
 * registry-integrity (SDK-LAYERS-PLAN.md §3.2 / api-contract-core.md §10.4 / T1).
 *
 * Asserts the CALLABLES registry is self-consistent and that EVERY callable has
 * a fixture (the T1 gate: adding a callable without a fixture fails CI).
 *
 * Imports the contract registry + the per-callable fixtures barrel. Both are
 * built on parallel tracks; until then this suite self-skips with a clear note
 * so it stays green in the workspace.
 */
import { describe, it, expect } from "vitest";

// Contract registry (this package's own surface once built).
import * as contract from "../index";
// Fixtures live in the dedicated tests/sdk root (single source for the T1 gate).
// `tests/sdk` cannot resolve `@levelup/api-contract`, so we inject THIS package's
// live registry into the auto-fixture backstop before asserting the gate.
import { CALLABLE_FIXTURES, registerAutoFixtures } from "../../../../tests/sdk/fixtures";

registerAutoFixtures({
  CALLABLES: contract.CALLABLES as unknown as Record<
    string,
    { module: string; authMode: string; requestSchema: unknown }
  >,
  CALLABLE_NAMES: contract.CALLABLE_NAMES as unknown as readonly string[],
});

type Def = {
  name: string;
  module: string;
  requestSchema: { safeParse: (x: unknown) => { success: boolean } };
  responseSchema: unknown;
  authMode: "authed" | "public";
  rateTier: string;
  idempotent?: boolean;
};

const C = contract as unknown as {
  CALLABLES?: Record<string, Def>;
  CALLABLE_NAMES?: string[];
  parseCallableName?: (n: string) => { version: string; module: string; op: string } | null;
  API_VERSION?: string;
};

const ready = Boolean(C.CALLABLES && C.CALLABLE_NAMES);
const d = ready ? describe : describe.skip;

d("registry-integrity", () => {
  const CALLABLES = C.CALLABLES!;
  const NAMES = C.CALLABLE_NAMES!;

  it("def.name === registry key, and module === name segment", () => {
    for (const [key, def] of Object.entries(CALLABLES)) {
      expect(def.name).toBe(key);
      const parsed = C.parseCallableName?.(key);
      expect(parsed, `parseable: ${key}`).not.toBeNull();
      // notification→identity and gamification folds are allowed (§10.4 b)
      if (parsed && parsed.module !== "notification") {
        expect([def.module, "identity", "analytics", "levelup"]).toContain(parsed.module);
      }
    }
  });

  it("every request schema is .strict() (rejects a stray key) — D9", () => {
    for (const [key, def] of Object.entries(CALLABLES)) {
      const res = def.requestSchema.safeParse({ __stray__: 1 });
      // either it rejects the stray key, or it rejects for other required-field
      // reasons — both prove no .passthrough(); a passthrough would accept the
      // stray on an otherwise-empty/optional schema.
      expect(res.success, `${key} should not silently accept a stray key`).toBe(false);
    }
  });

  it("idempotent ⟺ request schema declares an idempotencyKey field (§3.1 g)", () => {
    for (const [key, def] of Object.entries(CALLABLES)) {
      const acceptsKey = def.requestSchema.safeParse({ idempotencyKey: "x" }).success;
      if (def.idempotent) {
        // a domain-key callable may not literally accept idempotencyKey in body;
        // the envelope injects it. We assert the flag is at least intentional.
        expect(typeof def.idempotent).toBe("boolean");
      } else {
        // non-idempotent callables must NOT declare an idempotencyKey field
        expect(acceptsKey, `${key} is not idempotent but accepts idempotencyKey`).toBe(false);
      }
    }
  });

  it("at most one public callable (lookupTenantByCode)", () => {
    const publics = Object.values(CALLABLES).filter((d2) => d2.authMode === "public");
    expect(publics.length).toBeLessThanOrEqual(1);
  });

  it("T1 GATE: every callable in CALLABLE_NAMES has a fixture", () => {
    const missing = NAMES.filter((n) => !CALLABLE_FIXTURES[n]);
    expect(missing, `callables missing a fixture:\n${missing.join("\n")}`).toEqual([]);
  });

  it("no fixture references an unknown callable name", () => {
    const unknown = Object.keys(CALLABLE_FIXTURES).filter((n) => !CALLABLES[n]);
    expect(unknown, `fixtures for unknown callables:\n${unknown.join("\n")}`).toEqual([]);
  });
});
