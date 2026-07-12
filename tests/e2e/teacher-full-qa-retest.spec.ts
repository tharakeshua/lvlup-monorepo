/**
 * Focused re-test after fixing SpaceEditor useAuthSession + QuestionBank SelectItem.
 * Exercises Create Exam, Spaces timed test + add question, Question Bank, Extract if exam exists.
 */
import { test, expect, Page, Response } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = "http://127.0.0.1:4569";
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.resolve(ROOT, "tmp");
const REPORT = path.resolve(OUT, "qa-teacher-full-retest-report.json");

type Net = { name: string; status: number; body?: string };
const callables: Net[] = [];
const steps: string[] = [];
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
    await page.waitForLoadState("networkidle", { timeout: 20_000 });
  } catch {
    /* ignore */
  }
  await page.waitForTimeout(ms);
}

async function snap(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT, `qa-teacher-full-${name}.png`),
    fullPage: true,
  });
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#schoolCode", { timeout: 20_000 });
  await page.fill("#schoolCode", "GRN001");
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.waitForSelector("#email", { timeout: 20_000 });
  await page.fill("#email", "priya.sharma@greenwood.edu");
  await page.fill("#password", "Test@12345");
  await page.click('button[type="submit"]:has-text("Sign In")');
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 45_000 });
  await settle(page, 2000);
  steps.push(`Logged in → ${page.url()}`);
}

test("retest create exam + space editor + question bank", async ({ page }) => {
  test.setTimeout(10 * 60_000);

  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));
  page.on("response", async (res: Response) => {
    const url = res.url();
    if (!url.includes("cloudfunctions.net")) return;
    let body: string | undefined;
    try {
      body = (await res.text()).slice(0, 800);
    } catch {
      /* ignore */
    }
    callables.push({ name: nameOf(url), status: res.status(), body });
  });

  await login(page);

  // ── Question Bank (should no longer crash) ───────────────────────────────
  steps.push("Open /question-bank");
  const qbBefore = consoleErrors.length;
  await page.goto(`${BASE_URL}/question-bank`, { waitUntil: "domcontentloaded" });
  await settle(page, 2000);
  await snap(page, "50-question-bank-fixed");
  const qbBody = await page.locator("body").innerText();
  const qbCrash =
    /something went wrong|Select\.Item|must have a value prop/i.test(qbBody) ||
    consoleErrors.slice(qbBefore).some((e) => /Select\.Item|empty string/i.test(e));
  steps.push(`Question bank crash=${qbCrash} bodyLen=${qbBody.length}`);
  const createQ = page.getByRole("button", { name: /new|create|add question/i }).first();
  if (await createQ.count()) {
    await createQ.click();
    await settle(page, 1000);
    await snap(page, "51-question-bank-editor");
    steps.push("Opened question bank create dialog/editor");
    await page.keyboard.press("Escape").catch(() => undefined);
  } else {
    steps.push("WARN: no create question button");
  }

  // ── Create Exam with label-associated fills ──────────────────────────────
  steps.push("Open /exams/new");
  const examBefore = callables.length;
  await page.goto(`${BASE_URL}/exams/new`, { waitUntil: "domcontentloaded" });
  await settle(page, 2000);

  // Inputs have no ids — fill by placeholder / order under labels
  const title = page.getByPlaceholder(/mid-term|title/i).first();
  if (await title.count()) {
    await title.fill(`QA Exam ${Date.now()}`);
    steps.push("Filled title via placeholder");
  } else {
    // Fallback: first text input in form area
    const inputs = page.locator("input[type='text']");
    if (await inputs.count()) {
      await inputs.nth(0).fill(`QA Exam ${Date.now()}`);
      steps.push("Filled title via first text input");
    }
  }

  const subject = page.getByPlaceholder(/^Mathematics$/i).first();
  if (await subject.count()) {
    await subject.fill("Mathematics");
    steps.push("Filled subject");
  } else {
    const inputs = page.locator("input[type='text']");
    if ((await inputs.count()) > 1) {
      await inputs.nth(1).fill("Mathematics");
      steps.push("Filled subject via 2nd text input");
    }
  }

  // Class picker
  const classBtn = page.getByRole("button", { name: /select one or more classes/i }).first();
  if (await classBtn.count()) {
    await classBtn.click();
    await page.waitForTimeout(600);
    // Click first class row / checkbox in popover
    const popover = page.locator('[data-radix-popper-content-wrapper], [role="dialog"]').last();
    const row = popover.locator("button, [role='option'], label, div").filter({ hasText: /grade|class|section|g\d/i }).first();
    if (await row.count()) {
      await row.click();
      steps.push("Selected a class from picker");
    } else {
      // any clickable with check
      const any = popover.locator("button").nth(1);
      if (await any.count()) {
        await any.click();
        steps.push("Clicked first/second button in class popover");
      } else {
        steps.push("WARN: class popover empty?");
        const txt = await popover.innerText().catch(() => "");
        steps.push(`Popover text: ${txt.slice(0, 200)}`);
      }
    }
    await page.keyboard.press("Escape").catch(() => undefined);
  } else {
    steps.push("WARN: class select button not found");
  }

  await snap(page, "52-exam-filled");
  await page.getByRole("button", { name: /^next/i }).click();
  await settle(page, 2500);
  await snap(page, "53-exam-after-next");

  const validation = await page.locator(".text-destructive").allTextContents();
  if (validation.length) steps.push(`Validation still: ${validation.join(" | ")}`);
  const onUpload = /upload|question paper|drag/i.test(await page.locator("body").innerText());
  steps.push(`Advanced to upload step=${onUpload}`);
  const examCalls = callables.slice(examBefore);
  steps.push(
    `Exam callables so far: ${examCalls.map((c) => `${c.name}→${c.status}`).join(", ") || "none"}`
  );

  // If on upload, create draft by attempting next without file — or just note
  if (onUpload) {
    // Try to proceed / create draft if UI does on upload
    const next2 = page.getByRole("button", { name: /next|continue|skip|save draft/i }).first();
    if (await next2.count()) {
      const before = callables.length;
      await next2.click();
      await settle(page, 4000);
      await snap(page, "54-exam-upload-next");
      const calls = callables.slice(before);
      steps.push(
        `Upload-step callables: ${calls.map((c) => `${c.name}→${c.status}`).join(", ") || "none"}`
      );
      for (const c of calls.filter((x) => x.status >= 400)) {
        steps.push(`FAIL ${c.name} ${c.status}: ${(c.body || "").slice(0, 400)}`);
      }
    }
  }

  // ── Space editor: add timed test + question ───────────────────────────────
  steps.push("Open spaces list");
  await page.goto(`${BASE_URL}/spaces`, { waitUntil: "domcontentloaded" });
  await settle(page, 2000);
  const edit = page.locator('a[href*="/spaces/"][href*="/edit"]').first();
  let href = (await edit.count()) ? await edit.getAttribute("href") : null;
  if (!href) {
    const any = page.locator('a[href^="/spaces/"]');
    const n = await any.count();
    for (let i = 0; i < n; i++) {
      const h = await any.nth(i).getAttribute("href");
      if (h && /\/spaces\/[^/]+/.test(h)) {
        href = h.includes("/edit") ? h : `${h.replace(/\/$/, "")}/edit`;
        break;
      }
    }
  }
  expect(href).toBeTruthy();
  steps.push(`Space editor ${href}`);

  const spBeforeErr = consoleErrors.length;
  const spBeforeCall = callables.length;
  await page.goto(`${BASE_URL}${href}`, { waitUntil: "domcontentloaded" });
  await settle(page, 3000);
  await snap(page, "55-space-editor-fixed");

  const spCrash = consoleErrors
    .slice(spBeforeErr)
    .some((e) => /useAuthSession is not defined|something went wrong/i.test(e));
  const body = await page.locator("body").innerText();
  const boundary = /something went wrong/i.test(body);
  steps.push(`Space editor crash=${spCrash || boundary}`);

  // Content tab
  const contentTab = page.getByRole("tab", { name: /content/i }).first();
  if (await contentTab.count()) {
    await contentTab.click();
    await settle(page, 1000);
    steps.push("Clicked Content tab");
  }
  await snap(page, "56-space-content-tab");

  // Add Timed Test via select near header
  let added = false;
  const combos = page.getByRole("combobox");
  const cc = await combos.count();
  for (let i = 0; i < cc; i++) {
    await combos.nth(i).click().catch(() => undefined);
    await page.waitForTimeout(300);
    const opt = page.getByRole("option", { name: /timed test/i });
    if (await opt.count()) {
      const before = callables.length;
      await opt.click();
      await settle(page, 3000);
      added = true;
      const calls = callables.slice(before);
      steps.push(
        `Added Timed Test. callables: ${calls.map((c) => `${c.name}→${c.status}`).join(", ") || "none"}`
      );
      for (const c of calls.filter((x) => x.status >= 400)) {
        steps.push(`FAIL saveStoryPoint ${c.name} ${c.status}: ${(c.body || "").slice(0, 500)}`);
      }
      break;
    }
    await page.keyboard.press("Escape").catch(() => undefined);
  }
  if (!added) {
    const addBtn = page.getByRole("button", { name: /add story point/i }).first();
    if (await addBtn.count()) {
      const before = callables.length;
      await addBtn.click();
      await settle(page, 3000);
      const calls = callables.slice(before);
      steps.push(
        `Add Story Point (standard). callables: ${calls.map((c) => `${c.name}→${c.status}`).join(", ") || "none"}`
      );
      for (const c of calls.filter((x) => x.status >= 400)) {
        steps.push(`FAIL ${c.name} ${c.status}: ${(c.body || "").slice(0, 500)}`);
      }
    } else {
      steps.push("WARN: no add story point control visible");
      const btns = await page.locator("button").allTextContents();
      steps.push(`Buttons: ${btns.slice(0, 40).join(" | ")}`);
    }
  }
  await snap(page, "57-after-add-sp");

  // Expand first SP and add question
  const toggle = page.locator('button[aria-label*="Toggle"]').first();
  if (await toggle.count()) await toggle.click();
  await page.waitForTimeout(500);

  const addQ = page.getByRole("button", { name: /add question/i }).first();
  if (await addQ.count()) {
    const before = callables.length;
    await addQ.click();
    await settle(page, 4000);
    await snap(page, "58-after-add-question");
    const calls = callables.slice(before);
    steps.push(
      `Add Question callables: ${calls.map((c) => `${c.name}→${c.status}`).join(", ") || "none"}`
    );
    for (const c of calls.filter((x) => x.status >= 400)) {
      steps.push(`FAIL saveItem ${c.name} ${c.status}: ${(c.body || "").slice(0, 500)}`);
    }
    // Try fill + save if editor open
    const qContent = page.locator("textarea").first();
    if (await qContent.count()) {
      await qContent.fill("What is 2+2?");
      const save = page.getByRole("button", { name: /save/i }).first();
      if (await save.count()) {
        const b2 = callables.length;
        await save.click();
        await settle(page, 3000);
        const c2 = callables.slice(b2);
        steps.push(`Save question: ${c2.map((c) => `${c.name}→${c.status}`).join(", ") || "none"}`);
        for (const c of c2.filter((x) => x.status >= 400)) {
          steps.push(`FAIL save ${c.name}: ${(c.body || "").slice(0, 400)}`);
        }
      }
    }
  } else {
    steps.push("WARN: Add Question not visible");
    await snap(page, "58-no-add-question");
  }

  // Space editor callables summary
  const spCalls = callables.slice(spBeforeCall);
  steps.push(
    `All space-editor callables: ${[...new Set(spCalls.map((c) => `${c.name}:${c.status}`))].join(", ")}`
  );

  // ── Exams list for extract ───────────────────────────────────────────────
  await page.goto(`${BASE_URL}/exams`, { waitUntil: "domcontentloaded" });
  await settle(page, 2000);
  await snap(page, "59-exams-list");
  const examLink = page.locator('a[href^="/exams/"]').filter({ hasNotText: /new/i });
  let examHref: string | null = null;
  const n = await examLink.count();
  for (let i = 0; i < n; i++) {
    const h = await examLink.nth(i).getAttribute("href");
    if (h && h !== "/exams" && h !== "/exams/new" && !h.includes("submissions")) {
      examHref = h;
      break;
    }
  }
  if (examHref) {
    steps.push(`Open exam ${examHref}`);
    await page.goto(`${BASE_URL}${examHref}`, { waitUntil: "domcontentloaded" });
    await settle(page, 2500);
    await snap(page, "60-exam-detail");
    const extract = page.getByRole("button", { name: /extract questions/i }).first();
    if (await extract.count()) {
      const disabled = await extract.isDisabled();
      steps.push(`Extract Questions disabled=${disabled}`);
      if (!disabled) {
        const before = callables.length;
        await extract.click();
        await settle(page, 8000);
        await snap(page, "61-after-extract");
        const calls = callables.slice(before);
        steps.push(
          `Extract callables: ${calls.map((c) => `${c.name}→${c.status}`).join(", ") || "none"}`
        );
        for (const c of calls) {
          steps.push(`  ${c.name} ${c.status}: ${(c.body || "").slice(0, 300)}`);
        }
      }
    } else {
      steps.push("No Extract Questions button");
    }
  } else {
    steps.push("Still no exams in list — create exam may not have persisted");
  }

  const report = {
    finishedAt: new Date().toISOString(),
    steps,
    failingCallables: callables.filter((c) => c.status >= 400),
    uniqueFailing: [
      ...new Map(
        callables.filter((c) => c.status >= 400).map((c) => [c.name, c] as const)
      ).values(),
    ],
    consoleErrors: [...new Set(consoleErrors)].slice(0, 40),
    callableStatusCounts: Object.fromEntries(
      Object.entries(
        callables.reduce(
          (acc, c) => {
            const k = `${c.name}:${c.status}`;
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        )
      ).sort((a, b) => b[1] - a[1])
    ),
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ steps, uniqueFailing: report.uniqueFailing }, null, 2));
});
