/**
 * Vitest workspace for the Auto-LevelUp SDK rebuild (FROZEN-CANDIDATE plan).
 *
 * This is the *SDK-rebuild* workspace. It enumerates ONLY the new `@levelup/*`
 * SDK/server packages (per SDK-LAYERS-PLAN.md §1.1) plus the dedicated
 * `tests/sdk/` integration project. It is intentionally separate from the
 * legacy root `vitest.workspace.ts` (which still points at the `shared-*`
 * packages and `functions/*`) so the two test graphs can co-exist during the
 * parallel rebuild and migration window.
 *
 * Wiring (see tests/sdk/README.md for the full matrix):
 *   • UNIT      — each package's own `vitest.config.ts` (node env, src/**.test.ts).
 *                 Pure, no emulator. Co-located in `packages/<pkg>/src/__tests__/`.
 *   • CONTRACT  — also co-located unit/contract tests in the pure layers
 *                 (`domain`, `api-contract`, `api-client`, `query`): registry
 *                 integrity, no-tenant-id-in-request, allowed-transitions-enum,
 *                 authority-flag-coverage, optimistic-allowlist, etc. These run
 *                 in the same per-package project (no emulator needed — they
 *                 introspect the Zod registries).
 *   • INTEGRATION (emulator) — the `tests/sdk` project below. Requires the
 *                 Firestore + Auth (+ Functions) emulators and the seeded
 *                 "contract tenant"; uses the harness in tests/sdk/harness/.
 *
 * Run:
 *   pnpm vitest --config vitest.sdk.workspace.ts run         # everything
 *   pnpm vitest --config vitest.sdk.workspace.ts run --project @levelup/domain
 *   firebase emulators:exec --project demo-levelup \
 *     "pnpm vitest --config vitest.sdk.workspace.ts run --project sdk-integration"
 *
 * NOTE: Vitest v3+ removed `defineWorkspace`; the workspace is expressed as the
 * `test.projects` array of a single root config (the v3/v4 API). Each entry is a
 * glob/path to a package's own config, or an inline project object.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      // ---- t0..t4 pure SDK packages (UNIT + CONTRACT, node, no emulator) ----
      "packages/domain/vitest.config.ts",
      "packages/api-contract/vitest.config.ts",
      "packages/api-client/vitest.config.ts",
      "packages/repositories/vitest.config.ts",
      "packages/query/vitest.config.ts",
      "packages/realtime/vitest.config.ts",
      "packages/offline/vitest.config.ts",

      // ---- transport adapters (UNIT, node; firestore/rtdb decode logic) ----
      "packages/transport-firebase/vitest.config.ts",

      // ---- server brain + seams (UNIT with in-memory fakes; emulator contract
      //      suites live alongside but are tagged and gated by the harness) ----
      "packages/services/vitest.config.ts",
      "packages/access/vitest.config.ts",
      "packages/ai/vitest.config.ts",
      "packages/functions-shared/vitest.config.ts",

      // ---- seed engine (determinism + idempotency unit tests) ----
      "packages/seed/vitest.config.ts",

      // ---- lint-boundaries: static/lint gates as tests (no emulator) ----
      // The `lint-boundaries` LAYER (lint-boundaries.md) is cross-cutting tooling
      // (@levelup/eslint-config + @levelup/build-config + root CI guards), not a
      // runtime package — so it has no own `vitest.config.ts` to point at. Its
      // import-graph assertions + ESLint RuleTester specs + tier/exports/depcruise
      // contract tests live under `packages/lint-boundaries/src/__tests__/` and run
      // as this INLINE node project (no emulator, no @levelup/* runtime import at
      // module-eval — they scan source text + introspect the eslint-config factory).
      {
        test: {
          name: "@levelup/lint-boundaries",
          environment: "node",
          globals: true,
          include: ["packages/lint-boundaries/src/__tests__/**/*.test.ts"],
        },
      },

      // ---- INTEGRATION (emulator-backed) ----
      // Dedicated project; gated by emulator env (see harness). Its own config
      // sets fileParallelism:false + longer timeouts and globalSetup that boots
      // the harness (emulator connect + contract-tenant seed).
      "tests/sdk/vitest.config.ts",
    ],
  },
});
