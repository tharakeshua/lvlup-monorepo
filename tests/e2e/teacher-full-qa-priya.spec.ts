/**
 * Full live teacher-web QA as Priya (GRN001).
 * Captures screenshots under tmp/, network/console failures, and a JSON report.
 */
import { test, expect, Page, Request, Response } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = "http://127.0.0.1:4569";
const SCHOOL_CODE = "GRN001";
const EMAIL = "priya.sharma@greenwood.edu";
const PASSWORD = "Test@12345";

const ROOT = path.resolve(__dirname, "../..");
const SCREENSHOT_DIR = path.resolve(ROOT, "tmp");
const REPORT_PATH = path.resolve(SCREENSHOT_DIR, "qa-teacher-full-report.json");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

type AreaStatus = "PASS" | "FAIL" | "PARTIAL" | "SKIP";

type AreaResult = {
  area: string;
  status: AreaStatus;
  evidence: string;
  rootCause?: string;
  consoleErrors: string[];
  networkFailures: Array<{
    url: string;
    status?: number;
    method?: string;
    bodySnippet?: string;
  }>;
  notes: string[];
};

type CapturedNet = {
  url: string;
  method: string;
  status: number;
  bodySnippet?: string;
  requestBodySnippet?: string;
};

const report: {
  startedAt: string;
  finishedAt?: string;
  loginOk: boolean;
  areas: AreaResult[];
  createTestSteps: string[];
  generateQuestionsSteps: string[];
  allConsoleErrors: string[];
  callableCalls: CapturedNet[];
} = {
  startedAt: new Date().toISOString(),
  loginOk: false,
  areas: [],
  createTestSteps: [],
  generateQuestionsSteps: [],
  allConsoleErrors: [],
  callableCalls: [],
};

function isInterestingUrl(url: string): boolean {
  return (
    url.includes("cloudfunctions.net") ||
    url.includes("googleapis.com") ||
    url.includes("firestore") ||
    url.includes("identitytoolkit") ||
    url.includes("securetoken") ||
    url.includes("firebase")
  );
}

function callableName(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || url;
  } catch {
    return url;
  }
}

async function settle(page: Page, ms = 1200) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 20_000 });
  } catch {
    /* ignore */
  }
  await page.waitForTimeout(ms);
}

async function snap(page: Page, name: string) {
  const file = path.join(SCREENSHOT_DIR, `qa-teacher-full-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function pushArea(partial: AreaResult) {
  report.areas.push(partial);
}

test.describe.configure({ mode: "serial" });

test("teacher-web full live QA as Priya", async ({ browser }) => {
  test.setTimeout(20 * 60_000);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const networkFailures: CapturedNet[] = [];
  const callableCalls: CapturedNet[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      consoleErrors.push(text);
      report.allConsoleErrors.push(text);
    }
  });
  page.on("pageerror", (err) => {
    const text = err.message;
    pageErrors.push(text);
    report.allConsoleErrors.push(`[pageerror] ${text}`);
  });

  const pendingBodies = new Map<Request, string>();

  page.on("request", (req) => {
    const url = req.url();
    if (!isInterestingUrl(url)) return;
    const post = req.postData();
    if (post) pendingBodies.set(req, post.slice(0, 800));
  });

  page.on("response", async (res: Response) => {
    const url = res.url();
    if (!isInterestingUrl(url)) return;
    const status = res.status();
    const method = res.request().method();
    let bodySnippet: string | undefined;
    try {
      const ct = res.headers()["content-type"] || "";
      if (ct.includes("json") || ct.includes("text") || status >= 400) {
        const text = await res.text();
        bodySnippet = text.slice(0, 1200);
      }
    } catch {
      /* ignore */
    }
    const entry: CapturedNet = {
      url,
      method,
      status,
      bodySnippet,
      requestBodySnippet: pendingBodies.get(res.request()),
    };
    if (url.includes("cloudfunctions.net")) {
      callableCalls.push(entry);
      report.callableCalls.push({
        ...entry,
        url: `${callableName(url)} | ${url}`,
      });
    }
    if (status >= 400) {
      networkFailures.push(entry);
    }
  });

  const drainErrors = () => {
    const c = [...consoleErrors, ...pageErrors];
    const n = [...networkFailures];
    consoleErrors.length = 0;
    pageErrors.length = 0;
    networkFailures.length = 0;
    return { consoleErrors: c, networkFailures: n };
  };

  // ─── LOGIN ───────────────────────────────────────────────────────────────
  console.log("→ Login");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await snap(page, "01-login");

  await page.waitForSelector("#schoolCode", { timeout: 20_000 });
  await page.fill("#schoolCode", SCHOOL_CODE);
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.waitForSelector("#email", { timeout: 20_000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]:has-text("Sign In")');

  try {
    await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 45_000 });
    report.loginOk = true;
    await settle(page, 2000);
    await snap(page, "02-after-login");
    console.log(`✅ logged in → ${page.url()}`);
  } catch (err) {
    await snap(page, "02-login-FAILED");
    const bodyText = await page.locator("body").innerText().catch(() => "");
    pushArea({
      area: "Login",
      status: "FAIL",
      evidence: `Still on login. body≈${bodyText.slice(0, 300)}`,
      rootCause: String(err),
      ...drainErrors(),
      notes: [],
    });
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    throw err;
  }

  // ─── helper to visit a route ──────────────────────────────────────────────
  async function visitArea(
    area: string,
    url: string,
    shotName: string,
    checks?: (page: Page) => Promise<{ ok: boolean; notes: string[] }>
  ) {
    console.log(`→ ${area} (${url})`);
    drainErrors();
    const notes: string[] = [];
    try {
      await page.goto(`${BASE_URL}${url}`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await settle(page);
      const shot = await snap(page, shotName);

      // Detect error boundaries / empty crash
      const body = await page.locator("body").innerText();
      const crashed =
        /something went wrong|unexpected application error|chunkloaderror|failed to fetch dynamically/i.test(
          body
        );
      const accessDenied = /access denied|permission|unauthorized|forbidden/i.test(body);

      let checkResult = { ok: true, notes: [] as string[] };
      if (checks) checkResult = await checks(page);

      const errs = drainErrors();
      const netFail = errs.networkFailures.filter((n) => n.status && n.status >= 400);
      const zodish = errs.consoleErrors.filter((e) =>
        /zod|validation|invalid|access denied|403|401|cors/i.test(e)
      );

      let status: AreaStatus = "PASS";
      let rootCause: string | undefined;
      if (crashed) {
        status = "FAIL";
        rootCause = "UI crash / error boundary";
      } else if (accessDenied && !checkResult.ok) {
        status = "FAIL";
        rootCause = "Access denied in UI";
      } else if (!checkResult.ok) {
        status = "FAIL";
        rootCause = checkResult.notes.join("; ") || "Check failed";
      } else if (netFail.length || zodish.length) {
        status = "PARTIAL";
        rootCause = [
          netFail
            .slice(0, 3)
            .map((n) => `${callableName(n.url)}→${n.status}`)
            .join(", "),
          zodish.slice(0, 2).join(" | "),
        ]
          .filter(Boolean)
          .join(" ; ");
      }

      notes.push(`shot=${path.basename(shot)}`);
      notes.push(...checkResult.notes);
      if (body.length < 40) notes.push("Very little body text — possible blank page");

      pushArea({
        area,
        status,
        evidence: `url=${page.url()} bodyLen=${body.length} netFails=${netFail.length} console=${errs.consoleErrors.length}`,
        rootCause,
        consoleErrors: errs.consoleErrors.slice(0, 20),
        networkFailures: netFail.slice(0, 15).map((n) => ({
          url: callableName(n.url),
          status: n.status,
          method: n.method,
          bodySnippet: n.bodySnippet?.slice(0, 400),
        })),
        notes,
      });
    } catch (err) {
      await snap(page, `${shotName}-FAILED`).catch(() => undefined);
      pushArea({
        area,
        status: "FAIL",
        evidence: String(err),
        rootCause: "Navigation/timeout exception",
        ...drainErrors(),
        notes,
      });
    }
  }

  // 1. Dashboard
  await visitArea("Dashboard", "/", "03-dashboard", async (p) => {
    const notes: string[] = [];
    const welcome = await p.getByText(/welcome|dashboard|overview/i).count();
    const widgets = await p.locator("[class*='card'], [data-testid], section").count();
    notes.push(`welcomeish=${welcome} widgets≈${widgets}`);
    return { ok: welcome > 0 || widgets > 0, notes };
  });

  // 2. Classes
  await visitArea("Classes — list", "/classes", "04-classes", async (p) => {
    const notes: string[] = [];
    const links = p.locator('a[href^="/classes/"]');
    const count = await links.count();
    notes.push(`classLinks=${count}`);
    return { ok: true, notes };
  });

  // Open first class if any
  {
    drainErrors();
    await page.goto(`${BASE_URL}/classes`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const links = page.locator('a[href^="/classes/"]');
    const count = await links.count();
    let href: string | null = null;
    for (let i = 0; i < count; i++) {
      const h = await links.nth(i).getAttribute("href");
      if (h && h !== "/classes" && !h.endsWith("/classes")) {
        href = h;
        break;
      }
    }
    if (href) {
      await page.goto(`${BASE_URL}${href}`, { waitUntil: "domcontentloaded" });
      await settle(page);
      await snap(page, "05-class-detail");
      const errs = drainErrors();
      const body = await page.locator("body").innerText();
      const fail = /something went wrong/i.test(body) || errs.networkFailures.some((n) => n.status! >= 500);
      pushArea({
        area: "Classes — detail",
        status: fail ? "FAIL" : errs.networkFailures.length ? "PARTIAL" : "PASS",
        evidence: `href=${href}`,
        rootCause: fail ? "Class detail error" : undefined,
        consoleErrors: errs.consoleErrors.slice(0, 15),
        networkFailures: errs.networkFailures.slice(0, 10).map((n) => ({
          url: callableName(n.url),
          status: n.status,
          bodySnippet: n.bodySnippet?.slice(0, 300),
        })),
        notes: [],
      });
    } else {
      pushArea({
        area: "Classes — detail",
        status: "PARTIAL",
        evidence: "No class links to open",
        consoleErrors: [],
        networkFailures: [],
        notes: ["Possibly empty class list for Priya"],
      });
      await snap(page, "05-class-detail-empty");
    }
  }

  // 3. Students
  await visitArea("Students", "/students", "06-students", async (p) => {
    const notes: string[] = [];
    const rows = await p.locator("table tr, [role='row'], li").count();
    notes.push(`rows≈${rows}`);
    return { ok: true, notes };
  });

  // 4. Spaces list
  await visitArea("Spaces — list", "/spaces", "07-spaces", async (p) => {
    const notes: string[] = [];
    const newBtn = await p.getByRole("button", { name: /new space|create space/i }).count();
    notes.push(`createBtn=${newBtn}`);
    return { ok: true, notes };
  });

  // 5. Question bank
  await visitArea("Question Bank", "/question-bank", "08-question-bank");

  // 6. Rubric presets
  await visitArea("Rubric Presets", "/rubric-presets", "09-rubric-presets");

  // 7. Exams list
  await visitArea("Exams — list", "/exams", "10-exams", async (p) => {
    const notes: string[] = [];
    const create = await p.getByRole("link", { name: /new|create|add/i }).count();
    const createBtn = await p.getByRole("button", { name: /new|create|add/i }).count();
    notes.push(`createLinks=${create} createBtns=${createBtn}`);
    return { ok: true, notes };
  });

  // 8. Assignments
  await visitArea("Assignments", "/assignments", "11-assignments");

  // 9. Batch grading
  await visitArea("Batch Grading", "/grading", "12-grading");

  // 10. Analytics
  await visitArea("Analytics — Classes", "/analytics/classes", "13-analytics-classes");
  await visitArea("Analytics — Exams", "/analytics/exams", "14-analytics-exams");
  await visitArea("Analytics — Spaces", "/analytics/spaces", "15-analytics-spaces");
  await visitArea("Analytics — Tests", "/analytics/tests", "16-analytics-tests");

  // 11. Settings / notifications
  await visitArea("Settings", "/settings", "17-settings", async (p) => {
    const notes: string[] = [];
    const switcher = await p.getByText(/school|tenant|switch|greenwood/i).count();
    notes.push(`schoolish=${switcher}`);
    return { ok: true, notes };
  });
  await visitArea("Notifications", "/notifications", "18-notifications");

  // ─── CREATE EXAM (autograde digital/paper exam) ───────────────────────────
  console.log("→ Create Exam end-to-end");
  report.createTestSteps.push("Navigate to /exams/new");
  drainErrors();
  await page.goto(`${BASE_URL}/exams/new`, { waitUntil: "domcontentloaded" });
  await settle(page, 2000);
  await snap(page, "20-exam-create-start");

  {
    const body = await page.locator("body").innerText();
    report.createTestSteps.push(`Page loaded. url=${page.url()} bodyLen=${body.length}`);
    if (/something went wrong/i.test(body)) {
      report.createTestSteps.push("FAIL: error boundary on /exams/new");
      pushArea({
        area: "Create Exam — page load",
        status: "FAIL",
        evidence: body.slice(0, 400),
        rootCause: "Exam create page crashed",
        ...drainErrors(),
        notes: [],
      });
    } else {
      // Fill metadata
      const titleInput = page.locator("#title, input[name='title'], input[placeholder*='itle' i]").first();
      const subjectInput = page
        .locator("#subject, input[name='subject'], input[placeholder*='ubject' i]")
        .first();

      if (await titleInput.count()) {
        await titleInput.fill(`QA Exam ${Date.now()}`);
        report.createTestSteps.push("Filled title");
      } else {
        report.createTestSteps.push("WARN: no title input found");
        // dump labels
        const labels = await page.locator("label, h1, h2, button").allTextContents();
        report.createTestSteps.push(`Visible labels/buttons: ${labels.slice(0, 30).join(" | ")}`);
      }

      if (await subjectInput.count()) {
        await subjectInput.fill("Mathematics");
        report.createTestSteps.push("Filled subject");
      } else {
        report.createTestSteps.push("WARN: no subject input found");
      }

      // Try numeric fields
      for (const [sel, val] of [
        ["#totalMarks, input[name='totalMarks']", "100"],
        ["#passingMarks, input[name='passingMarks']", "40"],
        ["#duration, input[name='duration']", "60"],
      ] as const) {
        const el = page.locator(sel).first();
        if (await el.count()) {
          await el.fill(val);
        }
      }
      report.createTestSteps.push("Attempted marks/duration fill");

      // Class multi-select — click first checkbox/option if present
      const classTrigger = page
        .getByRole("button", { name: /class|select class|choose/i })
        .first();
      if (await classTrigger.count()) {
        await classTrigger.click().catch(() => undefined);
        await page.waitForTimeout(500);
        const option = page.locator('[role="option"], [role="menuitemcheckbox"], input[type="checkbox"]').first();
        if (await option.count()) {
          await option.click().catch(() => undefined);
          report.createTestSteps.push("Selected a class option");
        } else {
          report.createTestSteps.push("WARN: class picker opened but no options");
        }
        await page.keyboard.press("Escape").catch(() => undefined);
      } else {
        // Try ClassMultiSelect patterns
        const anySelect = page.locator('[data-testid*="class"], .class-multi, [aria-label*="class" i]').first();
        if (await anySelect.count()) {
          await anySelect.click().catch(() => undefined);
          report.createTestSteps.push("Clicked class multi-select container");
          await page.waitForTimeout(500);
          const opt = page.locator('[role="option"], label').first();
          if (await opt.count()) await opt.click().catch(() => undefined);
        } else {
          report.createTestSteps.push("WARN: no class picker found");
        }
      }

      await snap(page, "21-exam-create-filled");

      // Click Next / Continue
      const nextBtn = page.getByRole("button", { name: /next|continue|save|create/i }).first();
      if (await nextBtn.count()) {
        const beforeCalls = report.callableCalls.length;
        await nextBtn.click();
        await settle(page, 3000);
        await snap(page, "22-exam-create-after-next");
        const newCalls = report.callableCalls.slice(beforeCalls);
        report.createTestSteps.push(
          `Clicked Next/Continue. New callables: ${newCalls
            .map((c) => `${callableName(c.url)}→${c.status}`)
            .join(", ") || "none"}`
        );
        for (const c of newCalls) {
          if (c.status >= 400) {
            report.createTestSteps.push(
              `CALLABLE FAIL ${callableName(c.url)} ${c.status}: ${(c.bodySnippet || "").slice(0, 500)}`
            );
          }
        }
        const toast = await page.locator("[data-sonner-toast], .toast, [role='status']").allTextContents();
        if (toast.length) report.createTestSteps.push(`Toasts: ${toast.join(" | ")}`);
        const validation = await page.locator(".text-destructive, [class*='error']").allTextContents();
        if (validation.length)
          report.createTestSteps.push(`Validation: ${validation.slice(0, 10).join(" | ")}`);
      } else {
        report.createTestSteps.push("FAIL: no Next/Continue button");
      }

      const errs = drainErrors();
      const failed = report.createTestSteps.some((s) => s.startsWith("FAIL") || s.includes("CALLABLE FAIL"));
      pushArea({
        area: "Create Exam — wizard",
        status: failed ? "FAIL" : errs.networkFailures.length ? "PARTIAL" : "PASS",
        evidence: report.createTestSteps.slice(-8).join(" → "),
        rootCause: failed
          ? report.createTestSteps.filter((s) => s.includes("FAIL") || s.includes("CALLABLE")).join("; ")
          : undefined,
        consoleErrors: errs.consoleErrors.slice(0, 20),
        networkFailures: errs.networkFailures.slice(0, 15).map((n) => ({
          url: callableName(n.url),
          status: n.status,
          bodySnippet: n.bodySnippet?.slice(0, 400),
        })),
        notes: [],
      });
    }
  }

  // ─── CREATE TIMED TEST in Spaces (digital test) ───────────────────────────
  console.log("→ Create Timed Test in Spaces");
  report.createTestSteps.push("--- Spaces timed_test flow ---");
  drainErrors();
  await page.goto(`${BASE_URL}/spaces`, { waitUntil: "domcontentloaded" });
  await settle(page, 2000);

  // Open first editable space or create one
  let spaceEditHref: string | null = null;
  const editLinks = page.locator('a[href*="/spaces/"][href*="/edit"]');
  if (await editLinks.count()) {
    spaceEditHref = await editLinks.first().getAttribute("href");
  } else {
    // Try card click → edit
    const spaceCards = page.locator('a[href^="/spaces/"]');
    const n = await spaceCards.count();
    for (let i = 0; i < n; i++) {
      const h = await spaceCards.nth(i).getAttribute("href");
      if (h && /\/spaces\/[^/]+/.test(h) && !h.endsWith("/spaces")) {
        spaceEditHref = h.includes("/edit") ? h : `${h.replace(/\/$/, "")}/edit`;
        break;
      }
    }
  }

  if (!spaceEditHref) {
    // Create new space
    report.createTestSteps.push("No existing space — attempting Create Space");
    const createBtn = page.getByRole("button", { name: /new space|create space/i }).first();
    if (await createBtn.count()) {
      await createBtn.click();
      await page.waitForTimeout(800);
      const nameInput = page.locator("#title, input[name='title'], input[placeholder*='itle' i]").first();
      if (await nameInput.count()) {
        await nameInput.fill(`QA Space ${Date.now()}`);
      }
      const confirm = page.getByRole("button", { name: /create space|create|save/i }).last();
      const before = report.callableCalls.length;
      await confirm.click();
      await settle(page, 4000);
      await snap(page, "23-space-create");
      const calls = report.callableCalls.slice(before);
      report.createTestSteps.push(
        `Create space callables: ${calls.map((c) => `${callableName(c.url)}→${c.status}`).join(", ") || "none"}`
      );
      for (const c of calls) {
        if (c.status >= 400) {
          report.createTestSteps.push(
            `SPACE CREATE FAIL ${callableName(c.url)}: ${(c.bodySnippet || "").slice(0, 500)}`
          );
        }
      }
      if (page.url().includes("/edit")) spaceEditHref = page.url().replace(BASE_URL, "");
    }
  }

  if (spaceEditHref) {
    report.createTestSteps.push(`Opening space editor ${spaceEditHref}`);
    await page.goto(`${BASE_URL}${spaceEditHref}`, { waitUntil: "domcontentloaded" });
    await settle(page, 2500);
    await snap(page, "24-space-editor");

    // Switch to Content / Story Points tab if needed
    const contentTab = page.getByRole("tab", { name: /content|story|curriculum|points/i }).first();
    if (await contentTab.count()) {
      await contentTab.click();
      await page.waitForTimeout(800);
      report.createTestSteps.push("Clicked Content/Story tab");
    }

    // Add Timed Test story point
    const typeSelect = page.getByRole("combobox").filter({ hasText: /add|type|story/i }).first();
    // UI: Select with Timed Test option near Add Story Point
    const addSelectTrigger = page.locator("button").filter({ hasText: /add story|story point|type/i }).first();
    // Look for SelectItem path via nearby select
    const beforeSp = report.callableCalls.length;
    // Prefer select that contains Timed Test
    const allComboboxes = page.getByRole("combobox");
    let addedTimed = false;
    const comboCount = await allComboboxes.count();
    for (let i = 0; i < comboCount; i++) {
      const cb = allComboboxes.nth(i);
      await cb.click().catch(() => undefined);
      await page.waitForTimeout(300);
      const timed = page.getByRole("option", { name: /timed test/i });
      if (await timed.count()) {
        await timed.click();
        addedTimed = true;
        report.createTestSteps.push("Selected Timed Test from dropdown");
        break;
      }
      await page.keyboard.press("Escape").catch(() => undefined);
    }
    if (!addedTimed) {
      const addBtn = page.getByRole("button", { name: /add story point/i }).first();
      if (await addBtn.count()) {
        await addBtn.click();
        report.createTestSteps.push("Clicked Add Story Point (standard fallback)");
      } else {
        report.createTestSteps.push("WARN: could not find Add Story Point / Timed Test control");
        if (await addSelectTrigger.count()) {
          report.createTestSteps.push("(addSelectTrigger existed but unused)");
        }
      }
    }
    await settle(page, 3000);
    await snap(page, "25-after-add-story-point");
    const spCalls = report.callableCalls.slice(beforeSp);
    report.createTestSteps.push(
      `Story point callables: ${spCalls.map((c) => `${callableName(c.url)}→${c.status}`).join(", ") || "none"}`
    );
    for (const c of spCalls) {
      if (c.status >= 400) {
        report.createTestSteps.push(
          `STORY POINT FAIL ${callableName(c.url)} ${c.status}: ${(c.bodySnippet || "").slice(0, 600)}`
        );
      }
    }

    // Expand a story point and Add Question
    const expandBtns = page.locator('button[aria-label*="Toggle"], button[aria-label*="expand" i]');
    if (await expandBtns.count()) {
      await expandBtns.first().click().catch(() => undefined);
      await page.waitForTimeout(600);
    }
    // Also try clicking story point row
    const spRow = page.getByText(/story point|timed test|quiz|test/i).first();
    if (await spRow.count()) await spRow.click().catch(() => undefined);

    const addQuestion = page.getByRole("button", { name: /add question|add item/i }).first();
    const beforeItem = report.callableCalls.length;
    if (await addQuestion.count()) {
      await addQuestion.click();
      await settle(page, 3000);
      await snap(page, "26-after-add-question");
      report.createTestSteps.push("Clicked Add Question");
      const itemCalls = report.callableCalls.slice(beforeItem);
      report.createTestSteps.push(
        `Add item callables: ${itemCalls.map((c) => `${callableName(c.url)}→${c.status}`).join(", ") || "none"}`
      );
      for (const c of itemCalls) {
        if (c.status >= 400) {
          report.createTestSteps.push(
            `ADD ITEM FAIL ${callableName(c.url)} ${c.status}: ${(c.bodySnippet || "").slice(0, 600)}`
          );
        }
      }
    } else {
      report.createTestSteps.push("WARN: Add Question button not visible (SP may not be expanded)");
      await snap(page, "26-no-add-question");
    }

    const errs = drainErrors();
    const failed = report.createTestSteps.some(
      (s) => s.includes("STORY POINT FAIL") || s.includes("ADD ITEM FAIL") || s.includes("SPACE CREATE FAIL")
    );
    pushArea({
      area: "Create Test — Spaces timed_test / questions",
      status: failed ? "FAIL" : "PARTIAL",
      evidence: report.createTestSteps.filter((s) => s.includes("Spaces") || s.includes("Story") || s.includes("Add") || s.includes("FAIL") || s.includes("callable")).slice(-10).join(" → "),
      rootCause: failed
        ? report.createTestSteps.filter((s) => s.includes("FAIL")).join("; ")
        : "See createTestSteps for details",
      consoleErrors: errs.consoleErrors.slice(0, 20),
      networkFailures: errs.networkFailures.slice(0, 15).map((n) => ({
        url: callableName(n.url),
        status: n.status,
        bodySnippet: n.bodySnippet?.slice(0, 400),
      })),
      notes: [`spaceEditHref=${spaceEditHref}`],
    });
  } else {
    report.createTestSteps.push("FAIL: could not open or create a space");
    pushArea({
      area: "Create Test — Spaces timed_test / questions",
      status: "FAIL",
      evidence: "No space available",
      rootCause: "Could not open/create space for Priya",
      ...drainErrors(),
      notes: [],
    });
  }

  // ─── GENERATE / EXTRACT QUESTIONS (exam AI extraction) ────────────────────
  console.log("→ Generate/Extract Questions");
  report.generateQuestionsSteps.push("Navigate to /exams list to find an exam");
  drainErrors();
  await page.goto(`${BASE_URL}/exams`, { waitUntil: "domcontentloaded" });
  await settle(page, 2000);
  await snap(page, "30-exams-for-extract");

  let examHref: string | null = null;
  const examLinks = page.locator('a[href^="/exams/"]');
  const ec = await examLinks.count();
  for (let i = 0; i < ec; i++) {
    const h = await examLinks.nth(i).getAttribute("href");
    if (h && h !== "/exams" && h !== "/exams/new" && !h.includes("/submissions")) {
      examHref = h;
      break;
    }
  }

  if (examHref) {
    report.generateQuestionsSteps.push(`Opening exam ${examHref}`);
    await page.goto(`${BASE_URL}${examHref}`, { waitUntil: "domcontentloaded" });
    await settle(page, 2500);
    await snap(page, "31-exam-detail");

    const extractBtn = page.getByRole("button", { name: /extract questions|generate|re-?extract/i }).first();
    if (await extractBtn.count()) {
      const before = report.callableCalls.length;
      const disabled = await extractBtn.isDisabled().catch(() => false);
      report.generateQuestionsSteps.push(`Extract button found (disabled=${disabled})`);
      if (!disabled) {
        await extractBtn.click();
        await settle(page, 5000);
        await snap(page, "32-after-extract");
        const calls = report.callableCalls.slice(before);
        report.generateQuestionsSteps.push(
          `Extract callables: ${calls.map((c) => `${callableName(c.url)}→${c.status}`).join(", ") || "none"}`
        );
        for (const c of calls) {
          report.generateQuestionsSteps.push(
            `  ${callableName(c.url)} ${c.status}: ${(c.bodySnippet || "").slice(0, 500)}`
          );
        }
        const toast = await page.locator("[data-sonner-toast], [role='status']").allTextContents();
        if (toast.length) report.generateQuestionsSteps.push(`Toasts: ${toast.join(" | ")}`);
      } else {
        report.generateQuestionsSteps.push("Extract button disabled — cannot run");
      }
    } else {
      report.generateQuestionsSteps.push("No Extract Questions button on exam detail");
      const texts = await page.locator("button, h1, h2").allTextContents();
      report.generateQuestionsSteps.push(`Buttons/headings: ${texts.slice(0, 40).join(" | ")}`);
    }

    const errs = drainErrors();
    const failed = report.generateQuestionsSteps.some((s) => /→4\d\d|→5\d\d/.test(s));
    pushArea({
      area: "Generate Questions — Extract on exam",
      status: failed ? "FAIL" : report.generateQuestionsSteps.some((s) => /disabled|No Extract/i.test(s))
        ? "PARTIAL"
        : "PASS",
      evidence: report.generateQuestionsSteps.slice(-6).join(" → "),
      rootCause: failed
        ? report.generateQuestionsSteps.filter((s) => /→[45]\d\d/.test(s)).join("; ")
        : undefined,
      consoleErrors: errs.consoleErrors.slice(0, 20),
      networkFailures: errs.networkFailures.slice(0, 15).map((n) => ({
        url: callableName(n.url),
        status: n.status,
        bodySnippet: n.bodySnippet?.slice(0, 400),
      })),
      notes: [`examHref=${examHref}`],
    });
  } else {
    report.generateQuestionsSteps.push("No existing exam to open — trying create flow already covered");
    // Also try question bank create
    await page.goto(`${BASE_URL}/question-bank`, { waitUntil: "domcontentloaded" });
    await settle(page);
    const createQ = page.getByRole("button", { name: /create|add|new question/i }).first();
    if (await createQ.count()) {
      await createQ.click();
      await settle(page, 1500);
      await snap(page, "33-question-bank-create");
      report.generateQuestionsSteps.push("Opened question bank create UI");
    } else {
      report.generateQuestionsSteps.push("No create question CTA in question bank");
    }
    pushArea({
      area: "Generate Questions — Extract on exam",
      status: "PARTIAL",
      evidence: "No exam available for extraction",
      rootCause: "Missing exam data or create-exam failed earlier",
      ...drainErrors(),
      notes: [],
    });
  }

  // ─── Sidebar inventory ────────────────────────────────────────────────────
  drainErrors();
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const navTexts = await page.locator("nav a, [data-sidebar] a, aside a").allTextContents();
  const uniqueNav = [...new Set(navTexts.map((t) => t.trim()).filter(Boolean))];
  await snap(page, "40-sidebar");
  pushArea({
    area: "Nav inventory",
    status: "PASS",
    evidence: uniqueNav.join(" | "),
    consoleErrors: [],
    networkFailures: [],
    notes: uniqueNav,
  });

  // Profile / school switcher in header
  const tenantSwitcher = page.locator('[aria-label*="tenant" i], [aria-label*="school" i], button').filter({
    hasText: /greenwood|GRN|switch|school/i,
  });
  if (await tenantSwitcher.count()) {
    await tenantSwitcher.first().click().catch(() => undefined);
    await page.waitForTimeout(500);
    await snap(page, "41-tenant-switcher");
    pushArea({
      area: "School switcher",
      status: "PASS",
      evidence: "Switcher interacted",
      consoleErrors: [],
      networkFailures: [],
      notes: [],
    });
  } else {
    pushArea({
      area: "School switcher",
      status: "PARTIAL",
      evidence: "No obvious school switcher control found in header",
      consoleErrors: [],
      networkFailures: [],
      notes: [],
    });
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report written to ${REPORT_PATH}`);
  console.log(`Areas: ${report.areas.map((a) => `${a.area}=${a.status}`).join(", ")}`);

  // Soft assertion — login must work; dump report either way
  expect(report.loginOk).toBeTruthy();
});
