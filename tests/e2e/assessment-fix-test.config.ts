import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "assessment-fix-test.spec.ts",
  timeout: 300_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "reports/assessment-fix-test-results.json" }]],
  use: {
    baseURL: "http://localhost:4570",
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "off",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testDir: ".",
      testMatch: "assessment-fix-test.spec.ts",
    },
  ],
});
