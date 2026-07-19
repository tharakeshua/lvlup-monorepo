import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "regression-cycle-2.spec.ts",
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "reports/regression-cycle-2-results.json" }]],
  use: {
    baseURL: "http://localhost:4570",
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    {
      name: "regression-cycle-2",
      testDir: ".",
      testMatch: "regression-cycle-2.spec.ts",
    },
  ],
});
