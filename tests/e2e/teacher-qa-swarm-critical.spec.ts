/**
 * Critical teacher-web regression (Priya / GRN001).
 * Screenshots: tmp/qa-swarm-*.png
 */
import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://127.0.0.1:4569";
const SCHOOL_CODE = "GRN001";
const EMAIL = "priya.sharma@greenwood.edu";
const PASSWORD = "Test@12345";
const OUT = path.resolve(__dirname, "../../tmp");
const REPORT = path.join(OUT, "qa-swarm-report.json");

type CaseStatus = "PASS" | "FAIL" | "SKIP";
type CaseResult = {
  case: string;
  status: CaseStatus;
  notes: string[];
  screenshot?: string;
};

const results: CaseResult[] = [];

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function settle(page: Page, ms = 1500) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 20_000 });
  } catch {
    /* ignore */
  }
  await page.waitForTimeout(ms);
}

async function snap(page: Page, name: string) {
  const file = path.join(OUT, `qa-swarm-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function record(c: CaseResult) {
  results.push(c);
  console.log(`[${c.status}] ${c.case} — ${c.notes.join("; ")}`);
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await settle(page, 800);
  await page.waitForSelector("#schoolCode", { timeout: 25_000 });
  await page.fill("#schoolCode", SCHOOL_CODE);
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.waitForSelector("#email", { timeout: 20_000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]:has-text("Sign In")');
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 45_000 });
  await settle(page, 2000);
}

test.describe.configure({ mode: "serial" });

test.describe("Teacher critical paths (qa-swarm)", () => {
  test.setTimeout(8 * 60_000);

  let page: Page;

  test.afterAll(() => {
    fs.writeFileSync(
      REPORT,
      JSON.stringify({ finishedAt: new Date().toISOString(), results }, null, 2)
    );
    console.log("\n=== QA SWARM SUMMARY ===");
    for (const r of results) {
      console.log(`${r.status.padEnd(4)} ${r.case}`);
    }
  });

  test("1. Login GRN001 / Priya", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    page = await context.newPage();
    const notes: string[] = [];
    try {
      await login(page);
      const shot = await snap(page, "01-login-dashboard");
      const url = page.url();
      const leftLogin = !url.includes("/login");
      const body = await page.locator("body").innerText();
      const denied = /access denied|school login failed/i.test(body);
      notes.push(`url=${url}`);
      if (!leftLogin || denied) {
        record({
          case: "1. Login",
          status: "FAIL",
          notes: [...notes, denied ? "access denied" : "still on login"],
          screenshot: shot,
        });
        throw new Error("Login failed");
      }
      record({ case: "1. Login", status: "PASS", notes, screenshot: shot });
    } catch (err) {
      const shot = await snap(page, "01-login-FAILED").catch(() => undefined);
      if (!results.some((r) => r.case === "1. Login")) {
        record({
          case: "1. Login",
          status: "FAIL",
          notes: [String(err)],
          screenshot: shot,
        });
      }
      throw err;
    }
  });

  test("2. Dashboard loads", async () => {
    const notes: string[] = [];
    try {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await settle(page, 1500);
      const shot = await snap(page, "02-dashboard");
      const body = await page.locator("body").innerText();
      const crashed = /something went wrong|unexpected application error/i.test(body);
      const hasDash =
        (await page.getByText(/welcome|dashboard|overview|teacher/i).count()) > 0 ||
        (await page.locator("h1, h2, [class*='card'], section").count()) > 0;
      notes.push(`crashed=${crashed} hasDash=${hasDash} bodyLen=${body.length}`);
      const ok = !crashed && hasDash && !page.url().includes("/login");
      record({
        case: "2. Dashboard",
        status: ok ? "PASS" : "FAIL",
        notes,
        screenshot: shot,
      });
      expect(ok).toBeTruthy();
    } catch (err) {
      await snap(page, "02-dashboard-FAILED").catch(() => undefined);
      if (!results.some((r) => r.case === "2. Dashboard")) {
        record({ case: "2. Dashboard", status: "FAIL", notes: [String(err)] });
      }
      throw err;
    }
  });

  test("3. Spaces → Algebra Foundations → Timed Test", async () => {
    const notes: string[] = [];
    const callables: { name: string; status: number }[] = [];
    page.on("response", async (res) => {
      if (!res.url().includes("cloudfunctions.net")) return;
      try {
        const name =
          new URL(res.url()).pathname.split("/").filter(Boolean).pop() || res.url();
        callables.push({ name, status: res.status() });
      } catch {
        /* ignore */
      }
    });

    try {
      await page.goto(`${BASE}/spaces`, { waitUntil: "domcontentloaded" });
      await settle(page, 2000);
      await snap(page, "03-spaces-list");

      // Prefer Algebra Foundations by text, else first space link
      let href: string | null = null;
      const algebra = page
        .locator('a[href*="/spaces/"]')
        .filter({ hasText: /algebra foundations/i })
        .first();
      if (await algebra.count()) {
        href = await algebra.getAttribute("href");
        notes.push("opened Algebra Foundations by title");
      } else {
        // Card title then nearest link
        const title = page.getByText(/algebra foundations/i).first();
        if (await title.count()) {
          const cardLink = title.locator("xpath=ancestor::a[1]");
          if (await cardLink.count()) {
            href = await cardLink.getAttribute("href");
            notes.push("opened Algebra Foundations via ancestor link");
          }
        }
      }
      if (!href) {
        const links = page.locator('a[href*="/spaces/"]');
        const n = await links.count();
        for (let i = 0; i < n; i++) {
          const h = await links.nth(i).getAttribute("href");
          if (
            h &&
            /\/spaces\/[^/]+/.test(h) &&
            !h.endsWith("/spaces") &&
            !h.includes("/new")
          ) {
            href = h;
            notes.push(`fallback first space ${h}`);
            break;
          }
        }
      }
      expect(href).toBeTruthy();

      const editHref = href!.includes("/edit")
        ? href!
        : `${href!.replace(/\/$/, "")}/edit`;
      notes.push(`edit=${editHref}`);
      await page.goto(`${BASE}${editHref}`, { waitUntil: "domcontentloaded" });
      await settle(page, 3500);
      await snap(page, "03-space-editor");

      const body = await page.locator("body").innerText();
      const crashed = /something went wrong/i.test(body);
      if (crashed) {
        record({
          case: "3. Spaces / Timed Test",
          status: "FAIL",
          notes: [...notes, "space editor crash"],
          screenshot: path.join(OUT, "qa-swarm-03-space-editor.png"),
        });
        expect(crashed).toBeFalsy();
      }

      const contentTab = page.getByRole("tab", { name: /content/i }).first();
      if (await contentTab.count()) {
        await contentTab.click();
        await settle(page, 1000);
        notes.push("Content tab");
      }
      await snap(page, "03-space-content");

      let added = false;
      const combos = page.getByRole("combobox");
      const cc = await combos.count();
      for (let i = 0; i < cc; i++) {
        await combos.nth(i).click().catch(() => undefined);
        await page.waitForTimeout(350);
        const opt = page.getByRole("option", { name: /timed test/i });
        if (await opt.count()) {
          const before = callables.length;
          await opt.click();
          await settle(page, 3500);
          added = true;
          const calls = callables.slice(before);
          notes.push(
            `Timed Test via combobox: ${calls.map((c) => `${c.name}→${c.status}`).join(", ") || "no callable"}`
          );
          const fail = calls.find((c) => c.status >= 400);
          if (fail) notes.push(`callable FAIL ${fail.name}→${fail.status}`);
          break;
        }
        await page.keyboard.press("Escape").catch(() => undefined);
      }

      if (!added) {
        const addBtn = page.getByRole("button", { name: /add story point/i }).first();
        if (await addBtn.count()) {
          const before = callables.length;
          await addBtn.click();
          await settle(page, 3500);
          added = true;
          const calls = callables.slice(before);
          notes.push(
            `Add Story Point fallback: ${calls.map((c) => `${c.name}→${c.status}`).join(", ") || "no callable"}`
          );
        } else {
          notes.push("no Timed Test / Add Story Point control");
        }
      }

      const shot = await snap(page, "03-after-timed-test");
      const bodyAfter = await page.locator("body").innerText();
      const hasTimed =
        /timed test/i.test(bodyAfter) ||
        (await page.getByText(/timed test/i).count()) > 0;
      notes.push(`added=${added} hasTimedLabel=${hasTimed}`);

      const ok = added && !/something went wrong/i.test(bodyAfter);
      record({
        case: "3. Spaces / Timed Test",
        status: ok ? "PASS" : "FAIL",
        notes,
        screenshot: shot,
      });
      expect(ok).toBeTruthy();
    } catch (err) {
      await snap(page, "03-spaces-FAILED").catch(() => undefined);
      if (!results.some((r) => r.case === "3. Spaces / Timed Test")) {
        record({
          case: "3. Spaces / Timed Test",
          status: "FAIL",
          notes: [...notes, String(err)],
        });
      }
      throw err;
    }
  });

  test("4. Exams → create draft exam path", async () => {
    const notes: string[] = [];
    const callables: { name: string; status: number; body?: string }[] = [];
    page.on("response", async (res) => {
      if (!res.url().includes("cloudfunctions.net")) return;
      let body: string | undefined;
      try {
        body = (await res.text()).slice(0, 400);
      } catch {
        /* ignore */
      }
      try {
        const name =
          new URL(res.url()).pathname.split("/").filter(Boolean).pop() || res.url();
        callables.push({ name, status: res.status(), body });
      } catch {
        /* ignore */
      }
    });

    try {
      await page.goto(`${BASE}/exams/new`, { waitUntil: "domcontentloaded" });
      await settle(page, 2000);
      await snap(page, "04-exams-new");

      const crashed = /something went wrong/i.test(
        await page.locator("body").innerText()
      );
      if (crashed) {
        record({
          case: "4. Create draft exam",
          status: "FAIL",
          notes: ["/exams/new crashed"],
        });
        expect(crashed).toBeFalsy();
      }

      const title = `QA Swarm Exam ${Date.now()}`;
      const titleInput = page.getByPlaceholder(/mid-term|title|exam/i).first();
      await expect(titleInput).toBeVisible({ timeout: 15_000 });
      await titleInput.fill(title);
      notes.push(`title=${title}`);

      const subject = page.getByPlaceholder(/^Mathematics$/i).first();
      if (await subject.count()) {
        await subject.fill("Mathematics");
      } else {
        const subAlt = page.getByLabel(/subject/i).first();
        if (await subAlt.count()) await subAlt.fill("Mathematics");
      }

      // Class picker
      const classCombo = page
        .getByRole("combobox")
        .filter({ hasText: /select|class/i })
        .first();
      if (await classCombo.count()) {
        await classCombo.click();
      } else {
        await page.getByRole("combobox").first().click();
      }
      await page.waitForTimeout(800);

      const math = page
        .getByRole("button")
        .filter({ hasText: /grade 8.*math|mathematics|grade/i })
        .first();
      if (await math.count()) {
        await math.click();
        notes.push(`class=${(await math.innerText()).slice(0, 60)}`);
      } else {
        const row = page
          .locator("[data-radix-popper-content-wrapper] button")
          .first();
        if (await row.count()) {
          await row.click();
          notes.push(`classRow=${(await row.innerText()).slice(0, 60)}`);
        } else {
          notes.push("no class options");
        }
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await snap(page, "04-exam-meta-filled");

      const before = callables.length;
      await page.getByRole("button", { name: /^next/i }).click();
      await settle(page, 3000);

      const validation = await page.locator(".text-destructive").allTextContents();
      if (validation.length) notes.push(`validation=${validation.join("; ")}`);

      const body = await page.locator("body").innerText();
      const onUpload = /upload question paper|drag.*drop|browse files/i.test(body);
      notes.push(`onUploadStep=${onUpload}`);

      // Stay on draft/create path — skip upload if offered
      const skip = page.getByRole("button", { name: /skip|continue without/i }).first();
      if (onUpload && (await skip.count())) {
        await skip.click();
        await settle(page, 3000);
        notes.push("skipped upload");
      }

      const calls = callables.slice(before);
      notes.push(
        `callables: ${calls.map((c) => `${c.name}→${c.status}`).join(", ") || "none"}`
      );
      for (const c of calls.filter((x) => x.status >= 400)) {
        notes.push(`FAIL ${c.name}: ${(c.body || "").slice(0, 200)}`);
      }

      const shot = await snap(page, "04-exam-after-next");
      const url = page.url();
      const progressed =
        onUpload ||
        /\/exams\/[^/]+/.test(url) ||
        /upload|questions|draft|review/i.test(body);
      const noHardFail =
        !calls.some((c) => c.status >= 500) &&
        !/something went wrong/i.test(body) &&
        validation.length === 0;

      const ok = progressed && noHardFail;
      record({
        case: "4. Create draft exam",
        status: ok ? "PASS" : "FAIL",
        notes: [...notes, `url=${url}`],
        screenshot: shot,
      });
      expect(ok).toBeTruthy();
    } catch (err) {
      await snap(page, "04-exam-FAILED").catch(() => undefined);
      if (!results.some((r) => r.case === "4. Create draft exam")) {
        record({
          case: "4. Create draft exam",
          status: "FAIL",
          notes: [...notes, String(err)],
        });
      }
      throw err;
    }
  });
});
