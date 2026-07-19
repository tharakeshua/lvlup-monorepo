/**
 * Production hosting login verification for develop deploy handover.
 * Usage: node scripts/verify-hosting-logins.mjs
 */
import { chromium } from "@playwright/test";

const SCHOOL = "GRN001";
const PASS = "Test@12345";

async function schoolCodeThenEmail(page, email) {
  await page.fill("#schoolCode", SCHOOL);
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.locator("#email").waitFor({ state: "visible", timeout: 60000 });
  await page.fill("#email", email);
  await page.fill("#password", PASS);
  await page.click('button[type="submit"]:has-text("Sign In")');
}

async function waitPastLogin(page, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    const body = await page.locator("body").innerText();
    if (body.includes("Access Denied")) return "access-denied";
    if (!url.includes("/login") && !body.includes("Signing in") && body.trim().length > 40) {
      return "ok";
    }
    await page.waitForTimeout(1500);
  }
  return "timeout";
}

const ROLES = [
  {
    role: "super-admin",
    url: "https://lvlup-ff6fa-super-admin.web.app",
    login: async (page) => {
      await page.fill("#email", "superadmin@levelup.app");
      await page.fill("#password", PASS);
      await page.click('button[type="submit"]:has-text("Sign In")');
    },
    expect: /Super Admin Dashboard/i,
    success: (body) => /Super Admin Dashboard/i.test(body),
  },
  {
    role: "admin",
    url: "https://lvlup-ff6fa-admin.web.app",
    login: async (page) => schoolCodeThenEmail(page, "admin@greenwood.edu"),
    expect: /School Admin Dashboard|School Admin/i,
    success: (body) => /School Admin Dashboard|School Admin/i.test(body),
  },
  {
    role: "teacher",
    url: "https://lvlup-ff6fa-teacher.web.app",
    login: async (page) => schoolCodeThenEmail(page, "priya.sharma@greenwood.edu"),
    expect: /Teacher Dashboard|Teacher Portal/i,
    success: (body) => /Teacher Dashboard|Teacher Portal/i.test(body),
  },
  {
    role: "student",
    url: "https://lvlup-ff6fa-student.web.app",
    login: async (page) => {
      await page.fill("#schoolCode", SCHOOL);
      await page.click('button[type="submit"]:has-text("Continue")');
      await page.locator("#credential").waitFor({ state: "visible", timeout: 60000 });
      const emailTab = page.getByRole("tab", { name: /^email$/i });
      if (await emailTab.count()) await emailTab.click();
      await page.fill("#credential", "aarav.patel@greenwood.edu");
      await page.fill("#password", PASS);
      await page.click('button[type="submit"]:has-text("Sign In")');
    },
    expect: /Dashboard|Student Portal/i,
    success: (body) => /My Spaces|Dashboard/i.test(body) && /Sign in to start learning/i.test(body) === false,
  },
  {
    role: "parent",
    url: "https://lvlup-ff6fa-parent.web.app",
    login: async (page) => schoolCodeThenEmail(page, "suresh.patel@gmail.com"),
    expect: /Parent Dashboard|Parent Portal/i,
    success: (body) => /Parent Dashboard|Parent Portal|My Children/i.test(body) && !/Sign in to view/i.test(body),
  },
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const cfg of ROLES) {
  const page = await browser.newPage();
  let status = "PASS";
  let detail = "";
  try {
    await page.goto(`${cfg.url}/login`, { waitUntil: "networkidle", timeout: 90000 });
    await cfg.login(page);
    const outcome = await waitPastLogin(page);
    if (outcome === "access-denied") {
      status = "FAIL";
      detail = "auth OK but access-denied (superAdmin claims missing on Firebase user)";
    } else if (outcome === "timeout") {
      status = "FAIL";
      detail = `login timeout url=${page.url()}`;
    } else {
      const body = await page.locator("body").innerText();
      if (cfg.success(body)) {
        detail = `authenticated shell visible url=${page.url()}`;
      } else {
        status = "FAIL";
        detail = `post-login body missing expected markers url=${page.url()}`;
      }
    }
  } catch (err) {
    status = "FAIL";
    detail = `${err instanceof Error ? err.message : String(err)} url=${page.url()}`;
  } finally {
    results.push({ role: cfg.role, url: cfg.url, status, detail });
    await page.close();
    await new Promise((r) => setTimeout(r, 4000));
  }
}

await browser.close();

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), developSha: "1a6e89fda2db748842790ed5a0cb3b4ce44d36ce", results }, null, 2));
process.exit(results.some((r) => r.status !== "PASS") ? 1 : 0);
