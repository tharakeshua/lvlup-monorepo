/**
 * Authentic live QA across Teacher / Student / Parent / Admin.
 * Evidence: tmp/qa-handover-*.png + tmp/QA-HANDOVER-AUTHENTIC.json
 * No PASS without Playwright proof (screenshot + URL + crash check).
 */
import { test, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const OUT = path.resolve(__dirname, "../../tmp");
const REPORT = path.join(OUT, "QA-HANDOVER-AUTHENTIC.json");
const MD = path.resolve(__dirname, "../../docs/handover/QA-LIVE-EVIDENCE.md");
const SCHOOL = "GRN001";
const PASSWORD = "Test@12345";

type Status = "PASS" | "FAIL" | "SKIP";
type RouteResult = {
  app: string;
  route: string;
  status: Status;
  url: string;
  notes: string[];
  screenshot?: string;
  consoleErrors?: string[];
  pageErrors?: string[];
};

const results: RouteResult[] = [];
const fixesApplied: { file: string; reason: string }[] = [
  {
    file: "apps/teacher-web/src/sdk/session.tsx",
    reason:
      "P0: HMR-safe SessionContext singleton — prevents useAuthSession crash outside SessionProvider after Vite module reload",
  },
  {
    file: "apps/admin-web/src/sdk/session.tsx",
    reason: "Same HMR-safe SessionContext singleton for admin SessionProvider",
  },
];

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.dirname(MD), { recursive: true });

async function settle(page: Page, ms = 1200) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  } catch {
    /* ignore */
  }
  await page.waitForTimeout(ms);
}

/** Wait until the route has real content, a crash banner, or timeout. */
async function waitForRouteReady(page: Page, timeoutMs = 25_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const body = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    const crashes = crashSignals(body);
    if (crashes.length) return { body, stuckLoading: false };
    // Consider ready when substantial text OR nav chrome + heading exist
    const hasHeading = (await page.locator("h1, h2, [role='heading']").count()) > 0;
    const hasNav = (await page.locator("nav, aside, [data-sidebar]").count()) > 0;
    if (
      body.trim().length >= 40 ||
      (hasHeading && hasNav) ||
      (hasHeading && body.trim().length >= 15)
    ) {
      // Extra beat for late skeletons
      await page.waitForTimeout(600);
      const body2 = await page
        .locator("body")
        .innerText()
        .catch(() => body);
      return { body: body2, stuckLoading: false };
    }
    await page.waitForTimeout(500);
  }
  const body = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  return { body, stuckLoading: body.trim().length < 40 };
}

function crashSignals(body: string): string[] {
  const hits: string[] = [];
  const patterns = [
    /something went wrong/i,
    /unexpected application error/i,
    /application error/i,
    /chunkloaderror/i,
    /cannot read propert/i,
    /is not a function/i,
    /minified react error/i,
    /access denied/i,
    /school login failed/i,
    /useAuthSession must be used within/i,
    /failed to fetch dynamically imported module/i,
  ];
  for (const p of patterns) {
    if (p.test(body)) hits.push(p.source);
  }
  return hits;
}

async function snap(page: Page, name: string) {
  const file = path.join(OUT, `qa-handover-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function attachCollectors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 400));
  });
  page.on("pageerror", (err) => pageErrors.push(String(err).slice(0, 400)));
  return { consoleErrors, pageErrors };
}

async function evaluateRoute(
  page: Page,
  app: string,
  route: string,
  shotName: string,
  collectors: { consoleErrors: string[]; pageErrors: string[] },
  extraOk?: (body: string, url: string) => string | null
): Promise<RouteResult> {
  const notes: string[] = [];
  const ready = await waitForRouteReady(page);
  const url = page.url();
  const body = ready.body;
  const shot = await snap(page, shotName);
  const crashes = crashSignals(body);
  const onLogin = /\/login/.test(url);
  const fatalPageErrors = collectors.pageErrors.filter(
    (e) =>
      /useAuthSession must be used within/i.test(e) ||
      /failed to fetch dynamically imported module/i.test(e) ||
      /is not defined/i.test(e) ||
      /cannot read propert/i.test(e)
  );
  notes.push(`url=${url}`);
  notes.push(`bodyLen=${body.length}`);
  if (ready.stuckLoading) notes.push("stuck-loading");
  if (crashes.length) notes.push(`crashSignals=${crashes.join(",")}`);
  if (fatalPageErrors.length) {
    notes.push(`pageErrors=${fatalPageErrors.slice(0, 3).join(" | ")}`);
  }
  let status: Status = "PASS";
  if (crashes.length) status = "FAIL";
  if (fatalPageErrors.length) status = "FAIL";
  if (onLogin && !route.includes("login") && !shotName.includes("01-login")) {
    status = "FAIL";
    notes.push("redirected-to-login");
  }
  if (ready.stuckLoading || body.trim().length < 15) {
    status = "FAIL";
    notes.push("empty-or-stuck");
  }
  if (extraOk) {
    const failReason = extraOk(body, url);
    if (failReason) {
      status = "FAIL";
      notes.push(failReason);
    }
  }
  const result: RouteResult = {
    app,
    route,
    status,
    url,
    notes,
    screenshot: path.basename(shot),
    consoleErrors: collectors.consoleErrors.slice(-8),
    pageErrors: collectors.pageErrors.slice(-5),
  };
  results.push(result);
  console.log(`[${status}] ${app} ${route} — ${notes.join("; ")}`);
  return result;
}

async function gotoAndEval(
  page: Page,
  app: string,
  base: string,
  routePath: string,
  shotName: string,
  collectors: { consoleErrors: string[]; pageErrors: string[] }
) {
  collectors.consoleErrors.length = 0;
  collectors.pageErrors.length = 0;
  await page.goto(`${base}${routePath}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await settle(page, 800);
  return evaluateRoute(page, app, routePath, shotName, collectors);
}

async function ensureBaseUp(base: string): Promise<boolean> {
  try {
    const res = await fetch(base, { signal: AbortSignal.timeout(5000) });
    return res.ok || res.status === 200;
  } catch {
    return false;
  }
}

async function schoolLogin(
  page: Page,
  base: string,
  email: string,
  password: string,
  opts?: { student?: boolean }
) {
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await settle(page, 800);
  await page.waitForSelector("#schoolCode", { timeout: 25_000 });
  await page.fill("#schoolCode", SCHOOL);
  await page.click('button[type="submit"]:has-text("Continue")');

  if (opts?.student) {
    await page.waitForSelector("#credential, #password", { timeout: 20_000 });
    // Prefer email tab if present
    const emailTab = page.getByRole("tab", { name: /email/i });
    if (await emailTab.count()) {
      await emailTab.click();
      await page.waitForTimeout(300);
    }
    const cred = page.locator("#credential");
    if (await cred.count()) {
      await cred.fill(email);
    } else {
      await page.fill("#email", email);
    }
    await page.fill("#password", password);
    await page.click('button[type="submit"]:has-text("Sign In")');
  } else {
    await page.waitForSelector("#email", { timeout: 20_000 });
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]:has-text("Sign In")');
  }
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 60_000 });
  await settle(page, 2000);
}

function writeReports() {
  const byApp: Record<string, { pass: number; fail: number; skip: number; routes: RouteResult[] }> =
    {};
  for (const r of results) {
    if (!byApp[r.app]) byApp[r.app] = { pass: 0, fail: 0, skip: 0, routes: [] };
    byApp[r.app].routes.push(r);
    if (r.status === "PASS") byApp[r.app].pass++;
    else if (r.status === "FAIL") byApp[r.app].fail++;
    else byApp[r.app].skip++;
  }
  const summary = {
    finishedAt: new Date().toISOString(),
    authentic: true,
    evidenceRequired: "Playwright screenshot + URL + crash/pageerror check",
    credentials: {
      school: SCHOOL,
      teacher: "priya.sharma@greenwood.edu",
      student: "aarav.patel@greenwood.edu",
      admin: "admin@greenwood.edu",
      parent: "suresh.patel@gmail.com",
    },
    ports: { admin: 4568, teacher: 4569, student: 4570, parent: 4571 },
    totals: {
      pass: results.filter((r) => r.status === "PASS").length,
      fail: results.filter((r) => r.status === "FAIL").length,
      skip: results.filter((r) => r.status === "SKIP").length,
    },
    byApp,
    fixesApplied,
    results,
  };
  fs.writeFileSync(REPORT, JSON.stringify(summary, null, 2));

  const lines: string[] = [
    "# QA Live Evidence (Authentic)",
    "",
    `Generated: ${summary.finishedAt}`,
    "",
    "Evidence rule: **PASS only with Playwright/browser proof** (screenshot under `tmp/qa-handover-*.png`).",
    "",
    "## Scorecard",
    "",
    `| App | PASS | FAIL | SKIP |`,
    `|-----|------|------|------|`,
  ];
  for (const [app, s] of Object.entries(byApp)) {
    lines.push(`| ${app} | ${s.pass} | ${s.fail} | ${s.skip} |`);
  }
  lines.push(
    `| **TOTAL** | ${summary.totals.pass} | ${summary.totals.fail} | ${summary.totals.skip} |`,
    "",
    "## Credentials & ports",
    "",
    `- School: \`${SCHOOL}\``,
    `- Teacher :4569 — \`priya.sharma@greenwood.edu\` / \`Test@12345\``,
    `- Student :4570 — \`aarav.patel@greenwood.edu\` / \`Test@12345\``,
    `- Admin :4568 — \`admin@greenwood.edu\` / \`Test@12345\``,
    `- Parent :4571 — \`suresh.patel@gmail.com\` / \`Test@12345\` (from TEST_CREDENTIALS.md)`,
    "",
    "## Per-route results",
    ""
  );
  for (const r of results) {
    lines.push(`### ${r.status} — ${r.app} \`${r.route}\``);
    lines.push("");
    lines.push(`- Final URL: \`${r.url}\``);
    if (r.screenshot) lines.push(`- Screenshot: \`tmp/${r.screenshot}\``);
    for (const n of r.notes) lines.push(`- Note: ${n}`);
    if (r.pageErrors?.length) lines.push(`- Page errors: ${r.pageErrors.join(" || ")}`);
    lines.push("");
  }
  if (fixesApplied.length) {
    lines.push("## Fixes applied", "");
    for (const f of fixesApplied) lines.push(`- \`${f.file}\`: ${f.reason}`);
    lines.push("");
  }
  lines.push("## Machine report", "", "See `tmp/QA-HANDOVER-AUTHENTIC.json`.", "");
  fs.writeFileSync(MD, lines.join("\n"));
  console.log("\n=== AUTHENTIC QA SUMMARY ===");
  console.log(JSON.stringify(summary.totals, null, 2));
  console.log(`Wrote ${REPORT}`);
  console.log(`Wrote ${MD}`);
}

test.describe.configure({ mode: "serial" });

test.describe("Authentic multi-app live QA", () => {
  test.setTimeout(30 * 60_000);

  test.afterAll(() => {
    writeReports();
  });

  test("Teacher Priya — login + core routes", async ({ browser }) => {
    const base = "http://127.0.0.1:4569";
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const collectors = attachCollectors(page);
    try {
      await schoolLogin(page, base, "priya.sharma@greenwood.edu", PASSWORD);
      await settle(page, 1500);
      await evaluateRoute(
        page,
        "teacher",
        "/ (post-login)",
        "teacher-01-login",
        collectors,
        (body, url) => {
          if (/\/login/.test(url)) return "still-on-login";
          if (/access denied/i.test(body)) return "access-denied";
          return null;
        }
      );

      const routes = [
        ["/", "teacher-02-dashboard"],
        ["/spaces", "teacher-03-spaces"],
        ["/question-bank", "teacher-04-question-bank"],
        ["/rubric-presets", "teacher-05-rubric-presets"],
        ["/exams", "teacher-06-exams"],
        ["/exams/new", "teacher-07-exam-create"],
        ["/classes", "teacher-08-classes"],
        ["/analytics/classes", "teacher-09-analytics-classes"],
        ["/analytics/exams", "teacher-10-analytics-exams"],
        ["/analytics/spaces", "teacher-11-analytics-spaces"],
        ["/analytics/tests", "teacher-12-analytics-tests"],
        ["/assignments", "teacher-13-assignments"],
        ["/grading", "teacher-14-grading"],
        ["/students", "teacher-15-students"],
        ["/settings", "teacher-16-settings"],
        ["/notifications", "teacher-17-notifications"],
      ] as const;

      for (const [route, shot] of routes) {
        await gotoAndEval(page, "teacher", base, route, shot, collectors);
      }

      // Drill into first class / space / exam if links exist
      await page.goto(`${base}/classes`, { waitUntil: "domcontentloaded" });
      await settle(page, 1200);
      const classLink = page.locator('a[href*="/classes/"]').first();
      if (await classLink.count()) {
        const href = await classLink.getAttribute("href");
        if (href)
          await gotoAndEval(
            page,
            "teacher",
            base,
            href.replace(base, "").split("?")[0],
            "teacher-18-class-detail",
            collectors
          );
      } else {
        results.push({
          app: "teacher",
          route: "/classes/:id",
          status: "SKIP",
          url: page.url(),
          notes: ["No class detail link visible for Priya"],
        });
      }

      await page.goto(`${base}/spaces`, { waitUntil: "domcontentloaded" });
      await settle(page, 1200);
      const spaceLink = page.locator('a[href*="/spaces/"][href*="/edit"]').first();
      if (await spaceLink.count()) {
        const href = await spaceLink.getAttribute("href");
        if (href) {
          await gotoAndEval(
            page,
            "teacher",
            base,
            href.replace(base, "").split("?")[0],
            "teacher-19-space-edit",
            collectors
          );
        }
      } else {
        results.push({
          app: "teacher",
          route: "/spaces/:id/edit",
          status: "SKIP",
          url: page.url(),
          notes: ["No space edit link visible"],
        });
      }

      await page.goto(`${base}/exams`, { waitUntil: "domcontentloaded" });
      await settle(page, 1200);
      const examLink = page.locator('a[href*="/exams/"]:not([href*="/exams/new"])').first();
      if (await examLink.count()) {
        const href = await examLink.getAttribute("href");
        if (href) {
          await gotoAndEval(
            page,
            "teacher",
            base,
            href.replace(base, "").split("?")[0],
            "teacher-20-exam-detail",
            collectors
          );
        }
      } else {
        results.push({
          app: "teacher",
          route: "/exams/:id",
          status: "SKIP",
          url: page.url(),
          notes: ["No exam detail link visible"],
        });
      }
    } catch (err) {
      await snap(page, "teacher-FATAL").catch(() => undefined);
      results.push({
        app: "teacher",
        route: "FATAL",
        status: "FAIL",
        url: page.url(),
        notes: [String(err)],
      });
      console.error("Teacher suite error:", err);
    } finally {
      await ctx.close();
    }
  });

  test("Student Aarav — login + core routes", async ({ browser }) => {
    const base = "http://127.0.0.1:4570";
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const collectors = attachCollectors(page);
    try {
      await schoolLogin(page, base, "aarav.patel@greenwood.edu", PASSWORD, { student: true });
      await settle(page, 1500);
      await evaluateRoute(
        page,
        "student",
        "/ (post-login)",
        "student-01-login",
        collectors,
        (body, url) => {
          if (/\/login/.test(url)) return "still-on-login";
          if (/access denied/i.test(body)) return "access-denied";
          return null;
        }
      );

      const routes = [
        ["/", "student-02-dashboard"],
        ["/spaces", "student-03-spaces"],
        ["/tests", "student-04-tests"],
        ["/results", "student-05-results"],
        ["/leaderboard", "student-06-leaderboard"],
        ["/achievements", "student-07-achievements"],
        ["/profile", "student-08-profile"],
        ["/settings", "student-09-settings"],
        ["/notifications", "student-10-notifications"],
      ] as const;

      for (const [route, shot] of routes) {
        await gotoAndEval(page, "student", base, route, shot, collectors);
      }

      await page.goto(`${base}/spaces`, { waitUntil: "domcontentloaded" });
      await settle(page, 1200);
      const spaceLink = page.locator('a[href*="/spaces/"]').filter({ hasNotText: /^$/ }).first();
      const spaceAnchors = page.locator('a[href^="/spaces/"]');
      const count = await spaceAnchors.count();
      let drilled = false;
      for (let i = 0; i < Math.min(count, 8); i++) {
        const href = await spaceAnchors.nth(i).getAttribute("href");
        if (href && /^\/spaces\/[^/]+$/.test(href.split("?")[0])) {
          await gotoAndEval(
            page,
            "student",
            base,
            href.split("?")[0],
            "student-11-space-viewer",
            collectors
          );
          drilled = true;
          break;
        }
      }
      if (!drilled) {
        results.push({
          app: "student",
          route: "/spaces/:id",
          status: "SKIP",
          url: page.url(),
          notes: ["No space detail link for Aarav"],
        });
      }
      void spaceLink;
    } catch (err) {
      await snap(page, "student-FATAL").catch(() => undefined);
      results.push({
        app: "student",
        route: "FATAL",
        status: "FAIL",
        url: page.url(),
        notes: [String(err)],
      });
      console.error("Student suite error:", err);
    } finally {
      await ctx.close();
    }
  });

  test("Admin Greenwood — login + core routes", async ({ browser }) => {
    const base = "http://127.0.0.1:4568";
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const collectors = attachCollectors(page);
    try {
      if (!(await ensureBaseUp(base))) {
        results.push({
          app: "admin",
          route: "SERVER",
          status: "FAIL",
          url: base,
          notes: ["Admin server not reachable on :4568"],
        });
        return;
      }
      await schoolLogin(page, base, "admin@greenwood.edu", PASSWORD);
      await settle(page, 1500);
      await evaluateRoute(
        page,
        "admin",
        "/ (post-login)",
        "admin-01-login",
        collectors,
        (body, url) => {
          if (/\/login/.test(url)) return "still-on-login";
          if (/access denied/i.test(body)) return "access-denied";
          return null;
        }
      );

      const routes = [
        ["/", "admin-02-dashboard"],
        ["/users", "admin-03-users"],
        ["/classes", "admin-04-classes"],
        ["/exams", "admin-05-exams"],
        ["/spaces", "admin-06-spaces"],
        ["/ai-usage", "admin-07-ai-usage"],
        ["/settings", "admin-08-settings"],
        ["/academic-sessions", "admin-09-academic-sessions"],
        ["/reports", "admin-10-reports"],
        ["/analytics", "admin-11-analytics"],
        ["/courses", "admin-12-courses"],
        ["/notifications", "admin-13-notifications"],
        ["/staff", "admin-14-staff"],
        ["/announcements", "admin-15-announcements"],
        ["/data-export", "admin-16-data-export"],
      ] as const;

      for (const [route, shot] of routes) {
        await gotoAndEval(page, "admin", base, route, shot, collectors);
      }
    } catch (err) {
      await snap(page, "admin-FATAL").catch(() => undefined);
      results.push({
        app: "admin",
        route: "FATAL",
        status: "FAIL",
        url: page.url(),
        notes: [String(err)],
      });
      console.error("Admin suite error:", err);
    } finally {
      await ctx.close();
    }
  });

  test("Parent Suresh — login + core routes", async ({ browser }) => {
    const base = "http://127.0.0.1:4571";
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const collectors = attachCollectors(page);
    try {
      if (!(await ensureBaseUp(base))) {
        results.push({
          app: "parent",
          route: "SERVER",
          status: "FAIL",
          url: base,
          notes: [
            "Parent server not reachable on :4571 — credentials exist in TEST_CREDENTIALS.md (suresh.patel@gmail.com) but app down",
          ],
        });
        return;
      }
      // Probe login page exists
      await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
      await settle(page, 800);
      const hasSchool = (await page.locator("#schoolCode").count()) > 0;
      if (!hasSchool) {
        const shot = await snap(page, "parent-00-no-login");
        results.push({
          app: "parent",
          route: "/login",
          status: "FAIL",
          url: page.url(),
          notes: ["Parent login form missing #schoolCode"],
          screenshot: path.basename(shot),
        });
        return;
      }

      await schoolLogin(page, base, "suresh.patel@gmail.com", PASSWORD);
      await settle(page, 1500);
      await evaluateRoute(
        page,
        "parent",
        "/ (post-login)",
        "parent-01-login",
        collectors,
        (body, url) => {
          if (/\/login/.test(url)) return "still-on-login";
          if (/access denied/i.test(body)) return "access-denied";
          return null;
        }
      );

      const routes = [
        ["/", "parent-02-dashboard"],
        ["/children", "parent-03-children"],
        ["/results", "parent-04-results"],
        ["/progress", "parent-05-progress"],
        ["/child-progress", "parent-06-child-progress"],
        ["/alerts", "parent-07-alerts"],
        ["/compare", "parent-08-compare"],
        ["/notifications", "parent-09-notifications"],
        ["/settings", "parent-10-settings"],
      ] as const;

      for (const [route, shot] of routes) {
        await gotoAndEval(page, "parent", base, route, shot, collectors);
      }
    } catch (err) {
      await snap(page, "parent-FATAL").catch(() => undefined);
      results.push({
        app: "parent",
        route: "FATAL",
        status: "FAIL",
        url: page.url(),
        notes: [String(err)],
      });
      console.error("Parent suite error:", err);
    } finally {
      await ctx.close();
    }
  });
});
