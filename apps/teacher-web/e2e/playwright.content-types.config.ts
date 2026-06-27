import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: [
    "content-types-status.spec.ts",
    "explore.spec.ts",
    "diagnose.spec.ts",
    "quick-validate.spec.ts",
  ],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 90_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:4569",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "teacher-web",
      use: { browserName: "chromium" },
    },
  ],
});
