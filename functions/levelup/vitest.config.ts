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
        "src/prompts/**",
        "src/types/**",
        "src/utils/rate-limit.ts",
        "src/utils/parse-request.ts",
        "src/utils/notification-sender.ts",
        "src/utils/progress-updater.ts",
        "src/utils/rubric.ts",
        "src/utils/firestore.ts",
        "src/utils/helpers.ts",
        "src/callable/evaluate-answer.ts",
        "src/callable/format-item-for-edit.ts",
        "src/callable/record-item-attempt.ts",
        "src/callable/send-chat-message.ts",
        "src/callable/start-test-session.ts",
        "src/callable/submit-test-session.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 78,
        statements: 80,
      },
    },
  },
});
