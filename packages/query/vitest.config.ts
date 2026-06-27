import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // The shared cross-package harness (tests/sdk/fakes) lives at repo root, so
      // its bare `@levelup/*` specifiers resolve from tests/sdk/fakes/node_modules
      // (not packages/query/node_modules) and miss the workspace symlinks under
      // Vite's static import-analysis — even where the call site is a guarded
      // dynamic import()+try/catch (api-client, domain) or a real dep (api-contract).
      // Alias the three barrel-reachable specifiers to their built packages so
      // resolution succeeds at test time; each harness's own try/catch still
      // governs actual use. WITHOUT this the suites that import the fakes throw at
      // transform time (false "PERMISSION_DENIED"/resolve failures), never running.
      "@levelup/api-client": path.resolve(__dirname, "../api-client/dist/index.js"),
      "@levelup/api-contract": path.resolve(__dirname, "../api-contract/dist/index.js"),
      "@levelup/domain": path.resolve(__dirname, "../domain/dist/index.js"),
    },
  },
  test: {
    globals: true,
    // jsdom so the React hook/provider/error-boundary suites can render; the
    // suites self-skip via dynamic import when @testing-library/react isn't
    // installed in this phase (query-infra.md §9).
    environment: "jsdom",
    root: path.resolve(__dirname),
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
