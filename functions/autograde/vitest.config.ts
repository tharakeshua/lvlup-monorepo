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
      exclude: [
        "src/__tests__/**",
        "src/types/**",
        "src/index.ts",
        "src/utils/rate-limit.ts",
        "src/utils/parse-request.ts",
        "src/utils/secret-manager.ts",
        "src/utils/llm.ts",
        "src/utils/image-quality.ts",
        "src/utils/notification-sender.ts",
        "src/utils/index.ts",
      ],
      thresholds: {
        lines: 79,
        functions: 80,
        branches: 73,
        statements: 79,
      },
    },
  },
});
