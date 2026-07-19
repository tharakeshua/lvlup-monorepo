/**
 * Vitest project for the CONVERSATION cross-package QA suites that need NO
 * runtime/emulator (T-I; LLD §20.1/20.2/20.7). Pure Zod/contract/state-machine/
 * id/red-team assertions against the FROZEN domain + api-contract schemas and the
 * pure service logic. node env, no globalSetup, no seed — runnable at any time.
 *
 * Run: pnpm vitest run --config tests/sdk/conversation/vitest.config.ts
 */
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    name: "conversation-contract",
    root: path.resolve(__dirname),
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    testTimeout: 15_000,
  },
});
