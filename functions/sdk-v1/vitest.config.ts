import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Emulator-free unit tests for the deployable `v1.*` codebase. Pins the wiring
 * seams (`src/ai-seam.ts`) that use un-guarded `as unknown` casts in `bootstrap.ts`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: path.resolve(__dirname),
    include: ["src/**/*.test.ts"],
  },
});
