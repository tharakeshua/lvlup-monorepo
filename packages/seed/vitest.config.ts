import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Emulator-dependent cases self-skip when FIRESTORE_EMULATOR_HOST is unset.
    testTimeout: 30_000,
  },
});
