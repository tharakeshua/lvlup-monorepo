import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "regression-cycle-1*.spec.ts",
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "reports/regression-cycle-1-results.json" }]],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:4570",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "regression-cycle-1",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
