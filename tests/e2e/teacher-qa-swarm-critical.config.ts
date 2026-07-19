import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "teacher-qa-swarm-critical.spec.ts",
  timeout: 480_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4569",
    viewport: { width: 1440, height: 900 },
    actionTimeout: 25_000,
    navigationTimeout: 60_000,
    screenshot: "off",
    trace: "off",
    video: "off",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
