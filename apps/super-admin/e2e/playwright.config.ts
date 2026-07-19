import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: "html",
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    headless: true,
    baseURL: "http://localhost:4567",
    screenshot: "only-on-failure",
    video: "on",
    trace: "on-first-retry",
    actionTimeout: 15000,
    ...devices["Desktop Chrome"],
  },
});
