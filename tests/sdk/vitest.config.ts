/**
 * Vitest config for the SDK-rebuild INTEGRATION project (emulator-backed).
 *
 * This is the `sdk-integration` project enumerated by the root
 * `vitest.sdk.workspace.ts`. It is the ONLY SDK-rebuild project that needs the
 * Firebase emulators + seeded contract tenant.
 *
 * Conventions mirror the existing `tests/integration/vitest.config.ts`:
 *   • fileParallelism:false — suites share one emulator + one seeded tenant, so
 *     they must not run concurrently within a file-batch (between-suite clear is
 *     explicit; cross-suite isolation uses deterministic ids).
 *   • generous timeouts — emulator round-trips + AI fan-out.
 *   • globalSetup boots the harness once (connect + seed) and tears it down.
 *   • setupFiles wires per-test isolation hooks.
 *
 * Run via emulators:exec so the emulators are up + the project id matches CI:
 *   firebase emulators:exec --only auth,firestore,functions,database \
 *     --project demo-levelup \
 *     "pnpm vitest run --config tests/sdk/vitest.config.ts"
 */
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    name: "sdk-integration",
    root: path.resolve(__dirname),
    globals: true,
    environment: "node",
    // co-locate integration specs under tests/sdk/{contract,integration,security}
    include: ["contract/**/*.test.ts", "integration/**/*.test.ts", "security/**/*.test.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    teardownTimeout: 30_000,
    globalSetup: ["./harness/global-setup.ts"],
    setupFiles: ["./harness/per-test-setup.ts"],
    retry: process.env["CI"] ? 1 : 0,
  },
});
