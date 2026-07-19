import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "teacher-full-qa-retest.spec.ts",
  timeout: 600_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4569",
    viewport: { width: 1440, height: 900 },
    actionTimeout: 25_000,
    navigationTimeout: 60_000,
    headless: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
