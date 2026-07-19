import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const e2eHost = isCI ? "127.0.0.1" : "localhost";
const e2eUrl = (port: number) => `http://${e2eHost}:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  workers: 1,
  reporter: isCI ? [["html"], ["json", { outputFile: "test-results/results.json" }]] : "html",
  timeout: 60000,
  expect: {
    timeout: 15000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
      threshold: 0.2,
      animations: "disabled",
    },
  },
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  use: {
    headless: true,
    screenshot: "only-on-failure",
    video: "on",
    trace: "on-first-retry",
    actionTimeout: 15000,
  },
  webServer: isCI
    ? {
        command: "node scripts/e2e-preview-servers.mjs",
        url: e2eUrl(4570),
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,
  projects: [
    // ── CI smoke (auth login per app; used by GitHub Actions e2e job) ───────
    {
      name: "ci-smoke",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4570) },
      testMatch: "ci-smoke.spec.ts",
      timeout: 120_000,
    },

    // ── Desktop Chrome ──────────────────────────────────────────────────────
    {
      name: "super-admin",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4567) },
      testMatch: ["super-admin.spec.ts", "super-admin-left-panel.spec.ts"],
    },
    {
      name: "admin-web",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4568) },
      testMatch: "admin-web.spec.ts",
    },
    {
      name: "teacher-web",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4569) },
      testMatch: "teacher-web.spec.ts",
    },
    {
      name: "autograde",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env["TEACHER_WEB_URL"] ?? e2eUrl(4569),
        video: "on",
        screenshot: "on",
      },
      testMatch: ["autograde.spec.ts", "autograde-full-flow.spec.ts"],
      timeout: 300000,
      preserveOutput: "always",
    },
    {
      name: "student-web",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4570) },
      testMatch: ["student-web.spec.ts", "item-testing.spec.ts", "debug-spaces.spec.ts"],
    },
    {
      name: "parent-web",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4571) },
      testMatch: "parent-web.spec.ts",
    },

    // ── Cross-role flows ────────────────────────────────────────────────────
    {
      name: "cross-role",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4569) },
      testMatch: "cross-role-flows.spec.ts",
      timeout: 120000,
    },

    // ── Seed-driven E2E (data-driven from seed results) ──────────────────
    {
      name: "seed-subhang",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4568) },
      testMatch: "subhang-e2e.spec.ts",
      timeout: 120000,
    },

    // ── Learner Cycle 4 deep assessments ────────────────────────────────────
    {
      name: "lld-learner-c4",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4570) },
      testMatch: "lld-learner-cycle-4.spec.ts",
      timeout: 600000,
    },
    {
      name: "dsa-learner-c4",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4570) },
      testMatch: "dsa-learner-cycle-4.spec.ts",
      timeout: 600000,
    },
    {
      name: "sysdesign-learner-c4",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4570) },
      testMatch: "sysdesign-learner-cycle-4.spec.ts",
      timeout: 600000,
    },
    {
      name: "regression-c3",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4570) },
      testMatch: "regression-cycle-3.spec.ts",
      timeout: 600000,
    },
    {
      name: "feature-audit-c5",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4570) },
      testMatch: "feature-audit-cycle-5.spec.ts",
      timeout: 600000,
    },

    // ── Mobile viewports (iPhone 14) ────────────────────────────────────────
    {
      name: "admin-web-mobile",
      use: { ...devices["iPhone 14"], baseURL: e2eUrl(4568) },
      testMatch: "admin-web.spec.ts",
      grep: /@mobile|Authentication/,
    },
    {
      name: "student-web-mobile",
      use: { ...devices["iPhone 14"], baseURL: e2eUrl(4570) },
      testMatch: "student-web.spec.ts",
      grep: /@mobile|Authentication/,
    },
    {
      name: "teacher-web-mobile",
      use: { ...devices["iPhone 14"], baseURL: e2eUrl(4569) },
      testMatch: "teacher-web.spec.ts",
      grep: /@mobile|Authentication/,
    },
    {
      name: "parent-web-mobile",
      use: { ...devices["iPhone 14"], baseURL: e2eUrl(4571) },
      testMatch: "parent-web.spec.ts",
      grep: /@mobile|Authentication/,
    },

    // ── Tablet viewport (iPad) ──────────────────────────────────────────────
    {
      name: "admin-web-tablet",
      use: { ...devices["iPad (gen 7)"], baseURL: e2eUrl(4568) },
      testMatch: "admin-web.spec.ts",
      grep: /@tablet|Authentication/,
    },

    // ── Visual Regression & Accessibility ──────────────────────────────────
    {
      name: "visual-regression",
      use: { ...devices["Desktop Chrome"], baseURL: e2eUrl(4570) },
      testMatch: "visual-regression.spec.ts",
      timeout: 90000,
    },
  ],
});
