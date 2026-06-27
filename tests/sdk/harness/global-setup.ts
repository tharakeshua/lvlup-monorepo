/**
 * Vitest globalSetup for the SDK-rebuild integration project.
 *
 * Runs ONCE before any integration suite, and tears down ONCE after.
 *   1. export emulator host env (idempotent),
 *   2. verify the emulators are reachable; if not, the suites self-skip
 *      (per-test `requireEmulators()` guard) rather than hard-failing locally,
 *   3. CLEAR all emulator data (clean slate),
 *   4. LOAD the deterministic demo seed (the contract tenant) so every contract
 *      + integration suite has its preconditions.
 *
 * Teardown clears data + disposes client app handles so a re-run starts clean.
 */
import {
  exportEmulatorEnv,
  emulatorsReachable,
  functionsReachable,
  clearAllEmulators,
  disposeClients,
} from "./emulator";
import { loadDemoSeed } from "./seed";
import { seedContractTenant } from "./contract-seed";

export async function setup(): Promise<void> {
  exportEmulatorEnv();

  const reachable = await emulatorsReachable();
  if (!reachable) {
    // Leave a breadcrumb; suites guard with requireEmulators() and skip.
    process.env["SDK_EMULATORS_DOWN"] = "1";
    // eslint-disable-next-line no-console
    console.warn(
      "[tests/sdk] Firebase emulators not reachable — integration suites will SKIP. " +
        "Start them with: firebase emulators:start --only auth,firestore,functions,database --project demo-levelup"
    );
    return;
  }

  // Probe the Functions emulator. The wire-path (api-client → transport → callable)
  // suites need it AND the deployable functions codebase that assembles the new
  // `v1.*` callables; when either is absent they self-skip via `requireFunctions()`.
  if (!(await functionsReachable())) {
    process.env["SDK_FUNCTIONS_DOWN"] = "1";
    // eslint-disable-next-line no-console
    console.warn(
      "[tests/sdk] Functions emulator not reachable — wire-path (callable) suites will SKIP. " +
        "Boot it with `--only ...,functions` once the deployable v1.* callables codebase is built."
    );
  }

  await clearAllEmulators();

  try {
    const result = await loadDemoSeed();
    // Materialize the dedicated `contract` tenant fixtures the wire-path integration
    // suite addresses (harness `localSeedId` scheme — distinct from engine `seedId`).
    await seedContractTenant();
    // eslint-disable-next-line no-console
    console.log(
      `[tests/sdk] seeded contract dataset — tenants=${result.tenants.length + 1} users=${result.users}`
    );
  } catch (e) {
    // The seed engine may not be built yet (parallel track). Mark so suites can
    // skip seed-dependent cases with a clear reason rather than erroring opaquely.
    process.env["SDK_SEED_UNAVAILABLE"] = "1";
    // eslint-disable-next-line no-console
    console.warn(
      `[tests/sdk] demo seed unavailable — seed-dependent suites will SKIP. Reason: ${(e as Error).message}`
    );
  }
}

export async function teardown(): Promise<void> {
  if (process.env["SDK_EMULATORS_DOWN"]) return;
  await clearAllEmulators().catch(() => undefined);
  await disposeClients().catch(() => undefined);
}
