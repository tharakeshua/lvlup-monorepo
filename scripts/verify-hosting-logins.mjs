/**
 * One-off production hosting login verification for develop deploy handover.
 * Usage: node scripts/verify-hosting-logins.mjs
 */
import { chromium } from "@playwright/test";

const SCHOOL = "GRN001";
const PASS = "Test@12345";

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
  },
  {
    role: "admin",
    url: "https://lvlup-ff6fa-admin.web.app",
    login: async (page) => {
      await page.fill("#schoolCode", SCHOOL);
      await page.click('button[type="submit"]:has-text("Continue")');
      await page.waitForSelector("#email", { timeout: 15000 });
      await page.fill("#email", "admin@greenwood.edu");
      await page.fill("#password", PASS);
      await page.click('button[type="submit"]:has-text("Sign In")');
    },
    expect: /School Admin Dashboard/i,
  },
  {
    role: "teacher",
    url: "https://lvlup-ff6fa-teacher.web.app",
    login: async (page) => {
      await page.fill("#schoolCode", SCHOOL);
      await page.click('button[type="submit"]:has-text("Continue")');
      await page.waitForSelector("#email", { timeout: 15000 });
      await page.fill("#email", "priya.sharma@greenwood.edu");
      await page.fill("#password", PASS);
      await page.click('button[type="submit"]:has-text("Sign In")');
    },
    expect: /Teacher Dashboard/i,
  },
  {
    role: "student",
    url: "https://lvlup-ff6fa-student.web.app",
    login: async (page) => {
      await page.fill("#schoolCode", SCHOOL);
      await page.click('button[type="submit"]:has-text("Continue")');
      await page.waitForSelector("#credential", { timeout: 15000 });
      const emailTab = page.getByRole("tab", { name: /^email$/i });
      if (await emailTab.count()) await emailTab.click();
      await page.fill("#credential", "aarav.patel@greenwood.edu");
      await page.fill("#password", PASS);
      await page.click('button[type="submit"]:has-text("Sign In")');
    },
    expect: /Dashboard/i,
  },
  {
    role: "parent",
    url: "https://lvlup-ff6fa-parent.web.app",
    login: async (page) => {
      await page.fill("#schoolCode", SCHOOL);
      await page.click('button[type="submit"]:has-text("Continue")');
      await page.waitForSelector("#email", { timeout: 15000 });
      await page.fill("#email", "suresh.patel@gmail.com");
      await page.fill("#password", PASS);
      await page.click('button[type="submit"]:has-text("Sign In")');
    },
    expect: /Parent Dashboard/i,
  },
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const cfg of ROLES) {
  const page = await browser.newPage();
  let status = "PASS";
  let detail = "";
  try {
    await page.goto(`${cfg.url}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await cfg.login(page);
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 });
    const h1 = page.locator("h1").first();
    await h1.waitFor({ state: "visible", timeout: 30000 });
    const text = (await h1.textContent()) ?? "";
    if (!cfg.expect.test(text)) {
      status = "FAIL";
      detail = `heading="${text.trim()}" finalUrl=${page.url()}`;
    } else {
      detail = `heading="${text.trim()}"`;
    }
  } catch (err) {
    status = "FAIL";
    detail = `${err instanceof Error ? err.message : String(err)} url=${page.url()}`;
  } finally {
    results.push({ role: cfg.role, url: cfg.url, status, detail });
    await page.close();
  }
}

await browser.close();

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
process.exit(results.some((r) => r.status !== "PASS") ? 1 : 0);
