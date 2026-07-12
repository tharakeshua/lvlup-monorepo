/**
 * Final unblocking verification: create exam + space timed test after repo rebuild.
 */
import { test, Page, Response } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://127.0.0.1:4569";
const OUT = path.resolve(__dirname, "../../tmp");
const steps: string[] = [];
const calls: { name: string; status: number; body?: string }[] = [];
const consoleErrors: string[] = [];

function nameOf(url: string) {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).pop() || url;
  } catch {
    return url;
  }
}

async function settle(page: Page, ms = 1500) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 25_000 });
  } catch {
    /* ignore */
  }
  await page.waitForTimeout(ms);
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill("#schoolCode", "GRN001");
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.waitForSelector("#email");
  await page.fill("#email", "priya.sharma@greenwood.edu");
  await page.fill("#password", "Test@12345");
  await page.click('button[type="submit"]:has-text("Sign In")');
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 45_000 });
  await settle(page, 2500);
  // Force token refresh so healed classIds claims apply
  await page.evaluate(async () => {
    // @ts-expect-error firebase may be on window in some setups — fall back to reload
    const auth = (window as unknown as { firebase?: { auth?: () => { currentUser?: { getIdToken: (f: boolean) => Promise<string> } } } }).firebase?.auth?.();
    if (auth?.currentUser) await auth.currentUser.getIdToken(true);
  }).catch(() => undefined);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page, 2500);
  steps.push(`logged in ${page.url()}`);
}

test("final create exam + space test", async ({ page }) => {
  test.setTimeout(600_000);
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));
  page.on("response", async (res: Response) => {
    if (!res.url().includes("cloudfunctions.net")) return;
    let body: string | undefined;
    try {
      body = (await res.text()).slice(0, 700);
    } catch {
      /* ignore */
    }
    calls.push({ name: nameOf(res.url()), status: res.status(), body });
  });

  await login(page);

  // ── Create Exam ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/exams/new`);
  await settle(page, 2000);
  await page.getByPlaceholder(/mid-term|title/i).fill(`QA Exam ${Date.now()}`);
  await page.getByPlaceholder(/^Mathematics$/i).fill("Mathematics");

  // Class picker is role=combobox
  const classCombo = page.getByRole("combobox").filter({ hasText: /select|class/i }).first();
  if (await classCombo.count()) {
    await classCombo.click();
  } else {
    await page.getByRole("combobox").first().click();
  }
  await page.waitForTimeout(800);
  // Pick Grade 8 Math if present, else first class row button in popover
  const math = page.getByRole("button").filter({ hasText: /grade 8.*math|mathematics/i }).first();
  if (await math.count()) {
    await math.click();
    steps.push("Selected Grade 8 Math class");
  } else {
    const row = page.locator('[data-radix-popper-content-wrapper] button').filter({ hasText: /grade/i }).first();
    if (await row.count()) {
      await row.click();
      steps.push(`Selected class row: ${(await row.innerText()).slice(0, 80)}`);
    } else {
      steps.push("FAIL: no class options in picker");
      const pop = await page.locator('[data-radix-popper-content-wrapper]').innerText().catch(() => "");
      steps.push(`popover: ${pop.slice(0, 300)}`);
    }
  }
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.screenshot({ path: path.join(OUT, "qa-teacher-full-70-exam-meta.png"), fullPage: true });

  const beforeSave = calls.length;
  await page.getByRole("button", { name: /^next/i }).click();
  await settle(page, 3000);
  const validation = await page.locator(".text-destructive").allTextContents();
  steps.push(`after next validation=[${validation.join("; ")}]`);
  const body = await page.locator("body").innerText();
  const onUpload = /upload question paper|drag.*drop|browse files/i.test(body);
  steps.push(`onUploadStep=${onUpload}`);
  // Creating draft often happens when uploading; try clicking through with Skip if any
  const skip = page.getByRole("button", { name: /skip|continue without|next/i }).first();
  if (onUpload && (await skip.count())) {
    await skip.click();
    await settle(page, 4000);
  }
  const examCalls = calls.slice(beforeSave);
  steps.push(
    `exam calls: ${examCalls.map((c) => `${c.name}→${c.status}`).join(", ") || "none"}`
  );
  for (const c of examCalls.filter((x) => x.status >= 400)) {
    steps.push(`FAIL ${c.name}: ${(c.body || "").slice(0, 400)}`);
  }
  await page.screenshot({ path: path.join(OUT, "qa-teacher-full-71-exam-after-next.png"), fullPage: true });

  // ── Space editor: Algebra Foundations (published) or New Course ───────────
  await page.goto(`${BASE}/spaces`);
  await settle(page, 2000);
  // Prefer published algebra space
  let href: string | null = null;
  const links = page.locator('a[href*="/spaces/"]');
  const n = await links.count();
  for (let i = 0; i < n; i++) {
    const h = await links.nth(i).getAttribute("href");
    if (h && /spc_greenwood-space-space-algebra|V5VjUSqrAzy9CjxnVQvo/.test(h)) {
      href = h.includes("/edit") ? h : `${h.replace(/\/$/, "")}/edit`;
      if (h.includes("algebra")) break;
    }
  }
  if (!href) {
    for (let i = 0; i < n; i++) {
      const h = await links.nth(i).getAttribute("href");
      if (h && /\/spaces\/[^/]+/.test(h) && !h.endsWith("/spaces")) {
        href = h.includes("/edit") ? h : `${h.replace(/\/$/, "")}/edit`;
        break;
      }
    }
  }
  steps.push(`open space ${href}`);
  const beforeSp = calls.length;
  await page.goto(`${BASE}${href}`);
  await settle(page, 4000);
  await page.screenshot({ path: path.join(OUT, "qa-teacher-full-72-space-editor.png"), fullPage: true });

  const spCalls = calls.slice(beforeSp);
  steps.push(`space load calls: ${spCalls.map((c) => `${c.name}→${c.status}`).join(", ")}`);
  for (const c of spCalls.filter((x) => x.status >= 400)) {
    steps.push(`FAIL ${c.name}: ${(c.body || "").slice(0, 400)}`);
  }

  const crashed = consoleErrors.some((e) => /pageerror|useAuthSession|Select\.Item|something went wrong/i.test(e));
  const titleVisible = await page.locator("h1").first().isVisible().catch(() => false);
  steps.push(`spaceEditor titleVisible=${titleVisible} crashed=${crashed}`);

  // Content tab
  const contentTab = page.getByRole("tab", { name: /content/i });
  if (await contentTab.count()) {
    await contentTab.click();
    await settle(page, 1500);
    steps.push("clicked Content tab");
  }
  await page.screenshot({ path: path.join(OUT, "qa-teacher-full-73-space-content.png"), fullPage: true });

  // Add timed test
  let added = false;
  const combos = page.getByRole("combobox");
  for (let i = 0; i < (await combos.count()); i++) {
    await combos.nth(i).click().catch(() => undefined);
    await page.waitForTimeout(300);
    const opt = page.getByRole("option", { name: /timed test/i });
    if (await opt.count()) {
      const b = calls.length;
      await opt.click();
      await settle(page, 4000);
      added = true;
      const c = calls.slice(b);
      steps.push(`timed test calls: ${c.map((x) => `${x.name}→${x.status}`).join(", ") || "none"}`);
      for (const x of c.filter((y) => y.status >= 400)) {
        steps.push(`FAIL saveStoryPoint: ${(x.body || "").slice(0, 500)}`);
      }
      break;
    }
    await page.keyboard.press("Escape").catch(() => undefined);
  }
  if (!added) {
    const add = page.getByRole("button", { name: /add story point/i }).first();
    if (await add.count()) {
      const b = calls.length;
      await add.click();
      await settle(page, 4000);
      const c = calls.slice(b);
      steps.push(`add SP calls: ${c.map((x) => `${x.name}→${x.status}`).join(", ") || "none"}`);
      for (const x of c.filter((y) => y.status >= 400)) {
        steps.push(`FAIL: ${(x.body || "").slice(0, 500)}`);
      }
    } else {
      steps.push("FAIL: no Add Story Point / Timed Test control");
      steps.push(`buttons=${(await page.locator("button").allTextContents()).slice(0, 30).join("|")}`);
    }
  }
  await page.screenshot({ path: path.join(OUT, "qa-teacher-full-74-after-sp.png"), fullPage: true });

  // Expand + add question
  const toggle = page.locator('button[aria-label*="Toggle"]').first();
  if (await toggle.count()) await toggle.click();
  await page.waitForTimeout(500);
  const addQ = page.getByRole("button", { name: /add question/i }).first();
  if (await addQ.count()) {
    const b = calls.length;
    await addQ.click();
    await settle(page, 4000);
    const c = calls.slice(b);
    steps.push(`add question calls: ${c.map((x) => `${x.name}→${x.status}`).join(", ") || "none"}`);
    for (const x of c.filter((y) => y.status >= 400)) {
      steps.push(`FAIL saveItem: ${(x.body || "").slice(0, 500)}`);
    }
    await page.screenshot({ path: path.join(OUT, "qa-teacher-full-75-add-question.png"), fullPage: true });
  } else {
    steps.push("WARN: Add Question not visible");
  }

  // Exams list / extract
  await page.goto(`${BASE}/exams`);
  await settle(page, 2000);
  const examLinks = page.locator('a[href^="/exams/"]');
  let examHref: string | null = null;
  for (let i = 0; i < (await examLinks.count()); i++) {
    const h = await examLinks.nth(i).getAttribute("href");
    if (h && h !== "/exams" && h !== "/exams/new" && !h.includes("submissions")) {
      examHref = h;
      break;
    }
  }
  if (examHref) {
    await page.goto(`${BASE}${examHref}`);
    await settle(page, 2500);
    const extract = page.getByRole("button", { name: /extract questions/i }).first();
    if (await extract.count()) {
      const disabled = await extract.isDisabled();
      steps.push(`extract disabled=${disabled}`);
      if (!disabled) {
        const b = calls.length;
        await extract.click();
        await settle(page, 10000);
        const c = calls.slice(b);
        steps.push(`extract calls: ${c.map((x) => `${x.name}→${x.status}`).join(", ")}`);
        for (const x of c) steps.push(`  ${x.name} ${x.status} ${(x.body || "").slice(0, 250)}`);
      }
    } else steps.push("no Extract Questions button");
    await page.screenshot({ path: path.join(OUT, "qa-teacher-full-76-exam-detail.png"), fullPage: true });
  } else {
    steps.push("no exams in list yet");
  }

  const report = {
    steps,
    failing: calls.filter((c) => c.status >= 400),
    consoleErrors: [...new Set(consoleErrors)].slice(0, 30),
    counts: calls.reduce(
      (a, c) => {
        const k = `${c.name}:${c.status}`;
        a[k] = (a[k] || 0) + 1;
        return a;
      },
      {} as Record<string, number>
    ),
  };
  fs.writeFileSync(path.join(OUT, "qa-teacher-full-final-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});
