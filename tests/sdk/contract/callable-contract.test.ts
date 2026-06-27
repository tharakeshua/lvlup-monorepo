/**
 * Per-callable EMULATOR contract test (SDK-LAYERS-PLAN.md §7.2 / T1).
 *
 * The durable backend gate. For every callable that has a fixture:
 *   1. ensure the fixture's `seedState` precondition holds (seed materializes
 *      most; a few produce via an in-line producer callable — ordering.ts),
 *   2. sign in as the fixture's demo role (real ID token + claims),
 *   3. invoke the callable through the REAL api-client → transport → emulator,
 *   4. validate the LIVE response with `def.responseSchema.parse(liveResponse)`,
 *   5. run the fixture's extra `expect` assertions (e.g. release-gate strips).
 *
 * Skips cleanly when emulators/seed/api-contract aren't available locally so the
 * file is safe to keep green in the workspace during the parallel build; CI runs
 * it under `firebase emulators:exec`.
 */
import { describe, it, beforeAll, expect } from "vitest";
import { requireFunctions } from "../harness/per-test-setup";
import { signInAsDemoUser } from "../harness/auth-context";
import { clientFunctions } from "../harness/emulator";
// Deployed-id (dashed) resolution from the dotted contract name — Firebase forbids
// dots in a function id; the v1.* codebase deploys `v1-<module>-<op>`. Same
// convention as `@levelup/transport-firebase`.
import { toDeployedCallableId } from "@levelup/transport-firebase";
import type { CallableName } from "@levelup/api-contract";
import {
  CALLABLE_FIXTURES,
  registerAutoFixtures,
  type CallableFixture,
  type DemoRole,
} from "../fixtures";
import { VIA_CALLABLE } from "../fixtures/ordering";

/** Resolve the contract registry lazily (api-contract built on a parallel track). */
async function loadContract(): Promise<{
  CALLABLES: Record<
    string,
    { responseSchema: { parse: (x: unknown) => unknown }; allowsTenantOverride?: boolean }
  >;
  CALLABLE_NAMES: string[];
} | null> {
  try {
    const mod = (await import("@levelup/api-contract")) as unknown as {
      CALLABLES?: Record<
        string,
        { responseSchema: { parse: (x: unknown) => unknown }; allowsTenantOverride?: boolean }
      >;
      CALLABLE_NAMES?: string[];
    };
    if (mod.CALLABLES && mod.CALLABLE_NAMES) {
      return { CALLABLES: mod.CALLABLES, CALLABLE_NAMES: mod.CALLABLE_NAMES };
    }
  } catch {
    /* not built yet */
  }
  return null;
}

/** Invoke a callable via the Functions emulator carrying the signed-in token. */
async function invokeCallable(name: string, data: unknown, role: DemoRole): Promise<unknown> {
  const { httpsCallable } = await import("firebase/functions");
  if (role !== "public") await signInAsDemoUser(role);
  // Wire name convention: the dotted contract registry key maps to the dashed
  // Firebase deployed id (`v1.x.y` → `v1-x-y`); a function id may not contain dots.
  const callable = httpsCallable(clientFunctions(), toDeployedCallableId(name as CallableName));
  const res = await callable(data);
  return res.data;
}

describe("callable contract (emulator)", () => {
  let contract: Awaited<ReturnType<typeof loadContract>> = null;
  let skipReason: string | null = null;

  beforeAll(async () => {
    skipReason = requireFunctions();
    contract = await loadContract();
    if (!contract) skipReason ??= "@levelup/api-contract not built yet";
    // Backstop every uncovered callable with a schema-valid (but `skip:true`)
    // fixture so the registry stays complete; curated fixtures already won.
    if (contract) {
      registerAutoFixtures({
        CALLABLES: contract.CALLABLES as unknown as Record<
          string,
          { module: string; authMode: string; requestSchema: unknown }
        >,
        CALLABLE_NAMES: contract.CALLABLE_NAMES,
      });
    }
  });

  it("every fixture has a registered request + seed precondition", () => {
    for (const [name, fx] of Object.entries(CALLABLE_FIXTURES)) {
      expect(fx.request, `${name} request`).toBeDefined();
      expect(fx.seedState, `${name} seedState`).toBeDefined();
    }
  });

  // Sweeps every fixtured callable serially (sign-in + wire round-trip each), incl.
  // AI-stubbed paths — the full pass exceeds the suite's 30s default, so give it
  // headroom (the AI gateway is stubbed, so this is throughput, not a hang).
  it(
    "runs req→res schema validation for each fixture against the emulator",
    { timeout: 600_000 },
    async () => {
      if (skipReason) {
        // eslint-disable-next-line no-console
        console.warn(`[contract] skipped: ${skipReason}`);
        return;
      }
      const { CALLABLES } = contract!;
      const failures: string[] = [];

      for (const [name, fx] of Object.entries(CALLABLE_FIXTURES) as [string, CallableFixture][]) {
        if (fx.skip) continue;
        const def = CALLABLES[name];
        if (!def) {
          failures.push(`${name}: in fixtures but missing from CALLABLES registry`);
          continue;
        }
        try {
          // write-before-read: produce via-callable preconditions in-line
          const producer = VIA_CALLABLE[fx.seedState];
          if (producer && producer !== name) {
            const pfx = CALLABLE_FIXTURES[producer];
            if (pfx) await invokeCallable(producer, pfx.request, pfx.as);
          }

          const { uid } = fx.as === "public" ? { uid: "<public>" } : await signInAsDemoUser(fx.as);
          const liveResponse = await invokeCallable(name, fx.request, fx.as);
          def.responseSchema.parse(liveResponse); // ← the gate
          fx.expect?.(liveResponse, { uid, tenantId: null });
        } catch (e) {
          // Surface the precise ZodError issues (path + expected/received) so a real
          // server↔client response drift is debuggable, not just "validation failed".
          const err = e as { issues?: unknown; message?: string };
          const detail = err.issues ? JSON.stringify(err.issues) : err.message;
          failures.push(`${name}: ${detail}`);
        }
      }

      expect(failures, `contract failures:\n${failures.join("\n")}`).toEqual([]);
    }
  );
});
