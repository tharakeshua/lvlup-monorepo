/**
 * Per-test setup for the SDK-rebuild integration project (Vitest setupFiles).
 *
 * Provides:
 *   • `requireEmulators()` — call in a suite's `beforeAll`; SKIPS (not fails) the
 *     suite when emulators are down or the seed is unavailable locally.
 *   • a `beforeEach` that signs the client SDK out (clean auth state between
 *     tests; mirrors the SEC-10 "clear on any auth-state transition" contract).
 *
 * It deliberately does NOT clear Firestore between every test — the contract +
 * integration suites share the deterministic seeded tenant and rely on
 * idempotent, stable ids. Suites that need a pristine collection clear it
 * explicitly via `harness/emulator#clearFirestore`.
 */
import { beforeEach } from "vitest";
import { signOutClient } from "./auth-context";

export function emulatorsDown(): boolean {
  return Boolean(process.env["SDK_EMULATORS_DOWN"]);
}

export function seedUnavailable(): boolean {
  return Boolean(process.env["SDK_SEED_UNAVAILABLE"]);
}

export function functionsDown(): boolean {
  return Boolean(process.env["SDK_FUNCTIONS_DOWN"]);
}

/**
 * Returns a skip-reason string when the suite cannot run locally, else null.
 * Usage:
 *   beforeAll(() => { const why = requireEmulators(); if (why) ctx.skip(); });
 * or with `describe.skipIf(emulatorsDown())(...)`.
 */
export function requireEmulators(): string | null {
  if (emulatorsDown()) return "emulators not running";
  return null;
}

export function requireSeed(): string | null {
  if (emulatorsDown()) return "emulators not running";
  if (seedUnavailable()) return "seed engine not built";
  return null;
}

/**
 * Skip-reason for WIRE-PATH (callable) suites: they need the seed AND a reachable
 * Functions emulator serving the new SDK `v1.*` callables. Returns null only when
 * the full client→transport→callable→service path is exercisable locally.
 */
export function requireFunctions(): string | null {
  const why = requireSeed();
  if (why) return why;
  if (functionsDown()) {
    return "functions emulator / deployable v1.* callables not available";
  }
  return null;
}

beforeEach(async () => {
  if (emulatorsDown()) return;
  await signOutClient();
  // Safety net: a suite that clears the emulator (e.g. seed-idempotency, which
  // calls clearAllEmulators) wipes the dedicated `contract` tenant the wire-path
  // suites depend on. Re-seed it ONLY when it's missing (cheap presence probe), so
  // later suites still find their fixtures without perturbing an intact run.
  if (seedUnavailable()) return;
  try {
    const { contractTenantExists, seedContractTenant } = await import("./contract-seed");
    if (!(await contractTenantExists())) await seedContractTenant();
  } catch {
    // contract-seed module / emulator unavailable — wire-path suites self-skip.
  }
});
