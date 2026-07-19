import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/__tests__/**",
        "src/index.ts",
        "src/utils/rate-limit.ts",
        "src/utils/parse-request.ts",
        "src/utils/usage.ts",
        "src/utils/quota.ts",
        "src/utils/platform-activity.ts",
        "src/utils/firestore-helpers.ts",
        "src/utils/feature-gate.ts",
        "src/utils/audit-log.ts",
        "src/utils/auth-helpers.ts",
        "src/utils/assertions.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 63,
        branches: 80,
        statements: 80,
      },
    },
  },
});
