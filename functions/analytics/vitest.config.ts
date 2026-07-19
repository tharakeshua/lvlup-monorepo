import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts", "src/utils/rate-limit.ts", "src/schedulers/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 79,
        statements: 80,
      },
    },
  },
});
