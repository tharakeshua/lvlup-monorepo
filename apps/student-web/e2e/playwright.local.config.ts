import { defineConfig, devices } from "@playwright/test";

// Local-only override: port 4570 is occupied by the Maestro orchestration app on
// this dev machine, so the student-web dev server runs on 4571 instead.
export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:4571",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
  },
  projects: [
    {
      name: "student-web",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
