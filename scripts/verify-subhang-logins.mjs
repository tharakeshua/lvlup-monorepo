/**
 * Subhang Academy (SUB001) live hosting login verification.
 * Usage: node scripts/verify-subhang-logins.mjs
 */
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";

const SCHOOL = "SUB001";
const PASS = "Test@12345";

async function schoolCodeThenEmail(page, email) {
  await page.fill("#schoolCode", SCHOOL);
  await page.locator('button[type="submit"]').click({ force: true });
  const start = Date.now();
  while (Date.now() - start < 90000) {
    if (await page.locator("#email").isVisible().catch(() => false)) break;
    const alert = await page.locator('[role="alert"]').first().innerText().catch(() => "");
    if (alert) throw new Error(`school code step failed: ${alert}`);
    await page.waitForTimeout(2000);
  }
  if (!(await page.locator("#email").isVisible().catch(() => false))) {
    throw new Error("school code step timed out waiting for email field");
  }
  await page.fill("#email", email);
  await page.fill("#password", PASS);
  await page.locator('button[type="submit"]').click({ force: true });
}

async function waitPastLogin(page, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    const body = await page.locator("body").innerText();
    if (/^internal$/im.test(body) || /School login failed|Invalid school code/i.test(body)) {
      return { outcome: "error", detail: body.slice(0, 200), url };
    }
    if (body.includes("Access Denied")) return { outcome: "access-denied", url };
    if (!url.includes("/login") && !body.includes("Signing in") && body.trim().length > 40) {
      return { outcome: "ok", url, body };
    }
    await page.waitForTimeout(1500);
  }
  return { outcome: "timeout", url: page.url() };
}

const ROLES = [
  {
    role: "admin",
    url: "https://lvlup-ff6fa-admin.web.app",
    login: (page) => schoolCodeThenEmail(page, "subhang.rocklee@gmail.com"),
    success: (body) => /School Admin Dashboard/i.test(body),
  },
  {
    role: "teacher",
    url: "https://lvlup-ff6fa-teacher.web.app",
    login: (page) => schoolCodeThenEmail(page, "subhang.rocklee@gmail.com"),
    success: (body) => /Teacher Dashboard|Teacher Portal/i.test(body),
  },
  {
    role: "student",
    url: "https://lvlup-ff6fa-student.web.app",
    login: async (page) => {
      await page.fill("#schoolCode", SCHOOL);
      await page.locator('button[type="submit"]').click({ force: true });
      const start = Date.now();
      while (Date.now() - start < 90000) {
        if (await page.locator("#credential").isVisible().catch(() => false)) break;
        await page.waitForTimeout(2000);
      }
      await page.locator("#credential").waitFor({ state: "visible", timeout: 5000 });
      const emailTab = page.getByRole("tab", { name: /^email$/i });
      if (await emailTab.count()) await emailTab.click();
      await page.fill("#credential", "student.test@subhang.academy");
      await page.fill("#password", PASS);
      await page.locator('button[type="submit"]').click({ force: true });
    },
    success: (body) =>
      (/My Spaces|Dashboard|Active Spaces/i.test(body) &&
        !/Sign in to start learning/i.test(body)) ||
      /Test Student/i.test(body),
  },
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const cfg of ROLES) {
  const page = await browser.newPage();
  let status = "PASS";
  let detail = "";
  try {
    await page.goto(`${cfg.url}/login`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await cfg.login(page);
    const outcome = await waitPastLogin(page);
    if (outcome.outcome === "error") {
      status = "FAIL";
      detail = `login error: ${outcome.detail}`;
    } else if (outcome.outcome === "access-denied") {
      status = "FAIL";
      detail = "access-denied after auth";
    } else if (outcome.outcome === "timeout") {
      status = "FAIL";
      detail = `timeout url=${outcome.url}`;
    } else if (cfg.success(outcome.body ?? "")) {
      detail = `authenticated shell visible url=${outcome.url}`;
    } else {
      status = "FAIL";
      detail = `missing dashboard markers url=${outcome.url}`;
    }
  } catch (err) {
    status = "FAIL";
    detail = `${err instanceof Error ? err.message : String(err)} url=${page.url()}`;
  } finally {
    results.push({ role: cfg.role, url: cfg.url, status, detail });
    await page.close();
    await new Promise((r) => setTimeout(r, 10000));
  }
}

await browser.close();

let developSha = "unknown";
try {
  developSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch {
  /* ignore */
}

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), developSha, school: SCHOOL, results }, null, 2));
process.exit(results.some((r) => r.status !== "PASS") ? 1 : 0);
