import { defineConfig } from "vitest/config";
import type { UserConfig } from "vitest/config";

/**
 * Base Vitest configuration for the monorepo
 * Individual packages can extend this configuration
 */
export const baseVitestConfig: UserConfig = {
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "build/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/*.spec.*",
        "**/*.test.*",
        "**/test/**",
        "**/tests/**",
        "**/__tests__/**",
        "**/mockData/**",
        "**/__mocks__/**",
        "scripts/",
        ".eslintrc.*",
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
      },
    },
  },
};

export default defineConfig(baseVitestConfig);
