/**
 * Seed-load helper for the SDK-rebuild integration suite.
 *
 * Loads the deterministic demo dataset (the "contract" demo tenants) via the
 * `@levelup/seed` engine before integration/contract suites run.
 *
 * Contract this helper depends on (SDK-LAYERS-PLAN.md §7.2 / testability.md T2):
 *   • `seedId(kind, key)` → a stable, config-keyed branded id (NO randomness),
 *     so the same demo entity always resolves to the same id across runs. This
 *     is what lets contract fixtures reference seeded entities by logical key.
 *   • Idempotency = upsert-by-stable-id: re-running the seed is a no-op
 *     (asserted by the seed package's own idempotency test).
 *   • Claims are built through the SHARED membership→claims path, never a second
 *     claim-builder, so a seeded user's custom claims match the runtime's.
 *   • A fixed clock pins `serverDeadline`/`*At`/streak windows.
 *   • One write path, emulator-vs-prod env-switched. The engine auto-detects the
 *     emulator from FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST (exported
 *     by globalSetup before this runs).
 *
 * Real `@levelup/seed` public surface (packages/seed/src/index.ts):
 *   • `seed(config, opts)` — the orchestrator: validate → write (pipeline) →
 *     write derived docs → verify. Returns `{ counts, batch, verify }`.
 *   • `seedConfig` — the assembled, validated demo dataset.
 *   • `derivedSeedDocs(clock?)` — the rich DERIVED analytics/gamification docs.
 *   • `seedId(kind, key)` — deterministic, config-keyed branded id.
 */
import { FIXED_CLOCK_ISO } from "./fixtures-ids";

/** Summary the harness exposes to globalSetup (and any determinism check). */
export interface SeedResult {
  /** Logical tenant keys that were seeded. */
  tenants: string[];
  /** Total user-like accounts written (teachers + students + parents + staff + scanners + admins). */
  users: number;
  /** Per-kind write counts from the engine (the authoritative breakdown). */
  counts: Record<string, number>;
  /** Whether post-seed verify passed (actual collection counts >= expected). */
  verifyOk: boolean;
}

/** Pinned epoch (ms) the engine's fixed clock anchors to — mirrors FIXED_CLOCK_ISO. */
const FIXED_CLOCK_EPOCH_MS = Date.parse(FIXED_CLOCK_ISO);

/** Sum the user-like accounts in the assembled config across all tenants. */
function countUsers(config: {
  tenants: ReadonlyArray<{
    teachers?: readonly unknown[];
    students?: readonly unknown[];
    parents?: readonly unknown[];
    staff?: readonly unknown[];
    scanners?: readonly unknown[];
    admins?: readonly unknown[];
  }>;
  superAdmins?: readonly unknown[];
}): number {
  let n = config.superAdmins?.length ?? 0;
  for (const t of config.tenants) {
    n +=
      (t.teachers?.length ?? 0) +
      (t.students?.length ?? 0) +
      (t.parents?.length ?? 0) +
      (t.staff?.length ?? 0) +
      (t.scanners?.length ?? 0) +
      (t.admins?.length ?? 0);
  }
  return n;
}

/**
 * Load the demo dataset (deterministic ids, fixed clock) into the emulator.
 * Called once by globalSetup before any integration suite. Idempotent at the
 * STORAGE layer (upsert-by-stable-id): re-running the engine is a verifiable
 * no-op, so the seed-idempotency suite can call this twice and diff the tree.
 */
export async function loadDemoSeed(): Promise<SeedResult> {
  // Dynamic import so the workspace type-checks even if `@levelup/seed` is
  // mid-build; the global-setup catch turns a genuine failure into a SKIP.
  const { seed, seedConfig, derivedSeedDocs } = await import("@levelup/seed");

  const result = await seed(seedConfig, {
    projectId: process.env["GCLOUD_PROJECT"] ?? "demo-levelup",
    derivedDocs: derivedSeedDocs(),
    clockEpochMs: FIXED_CLOCK_EPOCH_MS,
    logLevel: "warn",
  });

  return {
    tenants: seedConfig.tenants.map((t) => t.key),
    users: countUsers(seedConfig),
    counts: result.counts,
    verifyOk: result.verify.ok,
  };
}

/**
 * Resolve a deterministic seeded id by (kind, key) for use inside fixtures /
 * assertions — e.g. `await seededId('student', 's-8a-01')`. Backed by the real
 * `@levelup/seed` `seedId` so the value matches what the engine wrote.
 */
export async function seededId(kind: string, key: string): Promise<string> {
  const { seedId } = await import("@levelup/seed");
  return seedId(kind as Parameters<typeof seedId>[0], key);
}
