import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts", "tests/integration/**/*.integration.test.ts"],
    exclude: ["tests/e2e/**", "packages/**", "node_modules/**", "**/dist/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text"],
    },
  },
});
