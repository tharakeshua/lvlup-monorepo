import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "space-crud.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:4569",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "NODE_ENV=development pnpm dev --host 127.0.0.1 --port 4569 --force",
    url: "http://127.0.0.1:4569/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "teacher-web",
      use: { browserName: "chromium" },
    },
  ],
});
