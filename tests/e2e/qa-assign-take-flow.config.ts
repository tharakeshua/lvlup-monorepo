import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "qa-assign-take-flow.spec.ts",
  timeout: 180_000,
  retries: 0,
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
  },
  reporter: [["list"]],
});
