import { defineConfig, devices } from "@playwright/test";

/** Live production demo — no local webServer. */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 600_000,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    headless: true,
    screenshot: "on",
    video: "on",
    trace: "on",
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: "autograde-live",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env["TEACHER_WEB_URL"] ?? "https://lvlup-ff6fa-teacher.web.app",
      },
      testMatch: ["demo-autograde-5776-live.spec.ts", "demo-student-practice-verify.spec.ts"],
    },
  ],
});
