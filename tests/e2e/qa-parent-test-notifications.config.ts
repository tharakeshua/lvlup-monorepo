import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "qa-parent-test-notifications.spec.ts",
  timeout: 90_000,
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PARENT_URL ?? "http://127.0.0.1:4571",
    screenshot: "only-on-failure",
    trace: "off",
  },
  reporter: [["list"]],
});
