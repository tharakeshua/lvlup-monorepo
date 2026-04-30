import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = "http://localhost:4569";
const SCHOOL_CODE = "SUB001";
const EMAIL = "subhang.rocklee@gmail.com";
const PASSWORD = "Test@12345";

const SCREENSHOT_DIR = path.resolve(__dirname, "reports/teacher-portal-screenshots");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

type RouteCapture = {
  filename: string;
  url: string;
  description: string;
};

const STATIC_ROUTES: RouteCapture[] = [
  { filename: "02-dashboard.png", url: "/", description: "Dashboard" },
  { filename: "03-spaces-list.png", url: "/spaces", description: "Space list" },
  { filename: "04-question-bank.png", url: "/question-bank", description: "Question bank" },
  { filename: "05-rubric-presets.png", url: "/rubric-presets", description: "Rubric presets" },
  { filename: "06-exams-list.png", url: "/exams", description: "Exam list" },
  { filename: "07-exams-new.png", url: "/exams/new", description: "Create exam form" },
  {
    filename: "08-analytics-classes.png",
    url: "/analytics/classes",
    description: "Class analytics",
  },
  { filename: "09-analytics-exams.png", url: "/analytics/exams", description: "Exam analytics" },
  { filename: "10-analytics-spaces.png", url: "/analytics/spaces", description: "Space analytics" },
  { filename: "11-analytics-tests.png", url: "/analytics/tests", description: "Test analytics" },
  { filename: "12-assignments.png", url: "/assignments", description: "Assignments" },
  { filename: "13-grading.png", url: "/grading", description: "Grading" },
  { filename: "14-students.png", url: "/students", description: "Students" },
  { filename: "15-settings.png", url: "/settings", description: "Settings" },
  { filename: "16-notifications.png", url: "/notifications", description: "Notifications" },
];

async function settle(page: Page) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 25_000 });
  } catch {
    // ignore
  }
  await page.waitForTimeout(1500);
}

async function snap(page: Page, filename: string) {
  const fullPath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`📸 saved ${filename}`);
}

test.describe.configure({ mode: "serial" });

test("full teacher portal tour", async ({ browser }) => {
  test.setTimeout(15 * 60_000);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // 1. Capture login page first (unauthenticated)
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await snap(page, "01-login.png");

  // 2. Log in
  console.log("→ logging in...");
  await page.waitForSelector("#schoolCode", { timeout: 20_000 });
  await page.fill("#schoolCode", SCHOOL_CODE);
  await page.click('button[type="submit"]:has-text("Continue")');

  await page.waitForSelector("#email", { timeout: 20_000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]:has-text("Sign In")');

  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 30_000 });
  await settle(page);
  console.log(`✅ logged in, current URL: ${page.url()}`);

  // 3. Static routes
  for (const route of STATIC_ROUTES) {
    try {
      console.log(`→ visiting ${route.url}`);
      await page.goto(`${BASE_URL}${route.url}`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await settle(page);
      await snap(page, route.filename);
    } catch (err) {
      console.error(`❌ failed ${route.url}: ${(err as Error).message}`);
      try {
        await snap(page, route.filename);
      } catch {
        /* ignore */
      }
    }
  }

  // 4. Drill-downs - try multiple selector strategies
  const drillDowns: Array<{
    listUrl: string;
    filename: string;
    label: string;
    findHref: (page: Page) => Promise<string | null>;
  }> = [
    {
      listUrl: "/analytics/classes",
      filename: "17-class-detail.png",
      label: "class detail",
      findHref: async (p) => {
        const links = p.locator('a[href^="/classes/"]');
        const count = await links.count();
        for (let i = 0; i < count; i++) {
          const href = await links.nth(i).getAttribute("href");
          if (href && href !== "/classes" && href !== "/classes/") return href;
        }
        return null;
      },
    },
    {
      listUrl: "/spaces",
      filename: "18-space-edit.png",
      label: "space edit",
      findHref: async (p) => {
        const links = p.locator('a[href*="/spaces/"][href*="/edit"]');
        if (await links.count()) {
          return await links.first().getAttribute("href");
        }
        const otherLinks = p.locator('a[href^="/spaces/"]');
        const count = await otherLinks.count();
        for (let i = 0; i < count; i++) {
          const href = await otherLinks.nth(i).getAttribute("href");
          if (href && href !== "/spaces" && href !== "/spaces/") return href;
        }
        return null;
      },
    },
    {
      listUrl: "/exams",
      filename: "19-exam-detail.png",
      label: "exam detail",
      findHref: async (p) => {
        const links = p.locator('a[href^="/exams/"]');
        const count = await links.count();
        for (let i = 0; i < count; i++) {
          const href = await links.nth(i).getAttribute("href");
          if (href && href !== "/exams" && href !== "/exams/" && href !== "/exams/new") return href;
        }
        return null;
      },
    },
    {
      listUrl: "/students",
      filename: "20-student-report.png",
      label: "student report",
      findHref: async (p) => {
        const links = p.locator('a[href^="/students/"]');
        const count = await links.count();
        for (let i = 0; i < count; i++) {
          const href = await links.nth(i).getAttribute("href");
          if (href && href !== "/students" && href !== "/students/") return href;
        }
        return null;
      },
    },
  ];

  for (const dd of drillDowns) {
    try {
      console.log(`→ drill ${dd.label}: visit ${dd.listUrl}`);
      await page.goto(`${BASE_URL}${dd.listUrl}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await settle(page);
      const href = await dd.findHref(page);
      if (href) {
        console.log(`  ↳ navigating to ${href}`);
        await page.goto(`${BASE_URL}${href}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await settle(page);
        await snap(page, dd.filename);
      } else {
        console.log(`  skip ${dd.label}: no link found`);
      }
    } catch (e) {
      console.error(`  ${dd.label} failed:`, (e as Error).message);
    }
  }

  await context.close();
});
