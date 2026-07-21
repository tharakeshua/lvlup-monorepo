import { test, expect } from "@playwright/test";
import { loginStudentWithEmail } from "./helpers";

// Real content in tenant SUB001 ("Subhang Academy") used to verify the
// app-testing.pptx fixes — see e2e exploration notes in the verification task.
const SPACE = "1AqFwKSf59FiIrqzaQ7i"; // Behavioral Interview Mastery
const MOCK_INTERVIEW_SP = "9GED1Jdhi93kWeepJ2kA"; // Mock Interview Practice (practice)
const PRIORITIZATION_SP = "0VKwtLTt1VydSeI073VB"; // Ambiguity & Prioritization (standard, matching Q)
const TIMED_TEST_SP = "xBnumc8jTQje26POV6Lq"; // Behavioral Interview Timed Assessment

const SCREENSHOT_DIR = "/Users/subhang/Desktop/app-testing-fix-screenshots";
const Q1_HEADING = 'h3:has-text("Tell me about yourself")';

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await loginStudentWithEmail(page, "SUB001", "student.test@subhang.academy", "Test@12345");
  await page.waitForTimeout(2500);
}

test("slide02: matching question renders content", async ({ page }) => {
  await login(page);
  await page.goto(`/spaces/${SPACE}/story-points/${PRIORITIZATION_SP}`);
  await page.waitForTimeout(2500);
  await page.locator("text=Frameworks").first().click();
  await page.waitForTimeout(1200);
  if ((await page.locator("text=Prioritization frameworks").count()) === 0) {
    await page.locator("text=Frameworks").first().click();
    await page.waitForTimeout(1200);
  }
  await expect(page.locator("text=Prioritization frameworks")).toBeVisible();
  await page.screenshot({ path: `${SCREENSHOT_DIR}/slide02-matching-content.png`, fullPage: true });
  const noPairs = await page.locator("text=No matching pairs configured").count();
  const selects = await page.locator("select").count();
  console.log(`RESULT slide02: noPairsMsg=${noPairs} selects=${selects}`);
  expect(selects).toBeGreaterThan(0);
  expect(noPairs).toBe(0);
});

test("Mock Interview Practice flow (slides 03,04,06,07,08,09,10,11)", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page);
  await page.goto(`/spaces/${SPACE}/practice/${MOCK_INTERVIEW_SP}`);
  await page.waitForTimeout(2500);
  await expect(page.locator(Q1_HEADING)).toBeVisible({ timeout: 20_000 });

  await test.step("slide04: voice input control", async () => {
    const micBtn = page.locator('button[aria-label="Answer with your voice"]');
    await expect(micBtn).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOT_DIR}/slide04-voice-input.png`, fullPage: true });
    let errored = false;
    page.once("pageerror", () => (errored = true));
    await micBtn.click();
    await page.waitForTimeout(1000);
    expect(errored).toBe(false);
  });

  const q1Answer =
    "I'm a senior backend engineer with 8 years of experience building distributed systems, most recently leading a payments platform migration.";

  await test.step("slide07a: loading indicator during eval", async () => {
    await page.locator("textarea").fill(q1Answer);
    await page.locator('button:has-text("Check answer"), button:has-text("Check Answer")').click();
    const loading = page.locator("text=Evaluating your answer");
    await expect(loading).toBeVisible({ timeout: 5_000 });
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/slide07a-loading-indicator.png`,
      fullPage: true,
    });
  });

  await test.step("slide06: auto-scroll to feedback (Q1)", async () => {
    await page.waitForSelector('[role="status"]', { timeout: 20_000 });
    await page.waitForTimeout(700);
    const feedback = page.locator('[role="status"]').first();
    const box = await feedback.boundingBox();
    const viewport = page.viewportSize();
    console.log(
      "slide06 feedback box:",
      JSON.stringify(box),
      "viewport:",
      JSON.stringify(viewport)
    );
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(viewport!.height);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/slide06-auto-scroll.png`, fullPage: false });
  });

  await test.step("slide07b: Try again keeps the answer", async () => {
    await page.locator('button:has-text("Try again")').click();
    await page.waitForTimeout(500);
    const textarea = page.locator("textarea");
    await expect(textarea).toHaveValue(q1Answer);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/slide07b-tryagain-answer-kept.png`,
      fullPage: true,
    });
  });

  await test.step("slide08: AI Tutor modal backdrop (opened from Q1)", async () => {
    await page.locator('button:has-text("Ask tutor")').click();
    await page.waitForTimeout(1500);
    const backdrop = page.locator('div[aria-hidden="true"].fixed.inset-0');
    await expect(backdrop).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/slide08-tutor-modal-backdrop.png`,
      fullPage: true,
    });
  });

  await test.step("slide09: AI Tutor sessions load + slide10 marker message", async () => {
    const input = page.locator('textarea, input[type="text"]').last();
    await input.fill("Marker message for Q1");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(6000);
    const sessionsBtn = page.locator('button:has-text("Sessions")');
    await expect(sessionsBtn).toBeVisible({ timeout: 10_000 });
    await sessionsBtn.click();
    await page.waitForTimeout(1500);
    const errorText = await page
      .locator("text=/error|failed|not working/i")
      .count()
      .catch(() => 0);
    console.log("slide09 error-text matches:", errorText);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/slide09-tutor-sessions-fixed.png`,
      fullPage: true,
    });
    expect(errorText).toBe(0);
    // Close the tutor panel
    await page
      .locator('button[aria-label="Close chat"]')
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(500);
  });

  await test.step("slide11: auto-scroll to feedback (Q2) + slide10 isolation check", async () => {
    const nextBtn = page.locator('button:has-text("Next")').last();
    await nextBtn.click();
    await page.waitForTimeout(1000);
    // Question order in practice mode doesn't match the seed script's authoring
    // order — just confirm we're on a different question than Q1.
    await expect(page.locator(Q1_HEADING)).not.toBeVisible();
    await expect(page.locator("h3").first()).toBeVisible();

    // slide10: open tutor on the NEW question, verify Q1's marker message did not carry over.
    await page.locator('button:has-text("Ask tutor")').click();
    await page.waitForTimeout(1500);
    const carriedOver = await page.locator("text=Marker message for Q1").count();
    console.log("slide10 carried-over message count on new question:", carriedOver);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/slide10-tutor-session-meaning.png`,
      fullPage: true,
    });
    expect(carriedOver).toBe(0);
    await page
      .locator('button[aria-label="Close chat"]')
      .first()
      .click()
      .catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);

    await page
      .locator("textarea")
      .fill(
        "I'm looking for a role with greater scope and technical ownership than my current position offers."
      );
    await page.locator('button:has-text("Check answer"), button:has-text("Check Answer")').click();
    await page.waitForSelector('[role="status"]', { timeout: 20_000 });
    await page.waitForTimeout(700);
    const feedback2 = page.locator('[role="status"]').first();
    const box2 = await feedback2.boundingBox();
    const viewport = page.viewportSize();
    console.log("slide11 feedback box:", JSON.stringify(box2));
    expect(box2).not.toBeNull();
    expect(box2!.y).toBeLessThan(viewport!.height);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/slide11-explanation-visible.png`,
      fullPage: false,
    });
  });

  await test.step("slide03: back navigation from question to list", async () => {
    const backBtn = page.locator('button:has-text("Back")');
    await expect(backBtn).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/slide03-back-navigation.png`,
      fullPage: true,
    });
    await backBtn.click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(new RegExp(`/spaces/${SPACE}$`));
  });
});

test("slide13: starting a timed test no longer errors", async ({ page }) => {
  await login(page);
  await page.goto(`/spaces/${SPACE}/test/${TIMED_TEST_SP}`);
  await page.waitForTimeout(2500);
  const startBtn = page.locator('button:has-text("Start Test")');
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click();
  }
  await Promise.race([
    page.waitForSelector("text=/Q1\\s*\\/\\s*\\d/", { timeout: 15_000 }).catch(() => null),
    page
      .waitForSelector("text=test timer could not be started", { timeout: 15_000 })
      .catch(() => null),
  ]);
  await page.waitForTimeout(1000);
  const errorMsg = page.locator("text=test timer could not be started");
  const hasError = await errorMsg.isVisible().catch(() => false);
  console.log("slide13 has 'test timer could not be started' error:", hasError);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/slide13-test-start-fixed.png`, fullPage: true });
  expect(hasError).toBe(false);
  await expect(page).not.toHaveURL(/\/spaces$/);
});

test("Exams list (slides 14, 17)", async ({ page }) => {
  await login(page);
  const start = Date.now();
  await page.goto("/exams");
  await page.waitForSelector("h1:has-text('Exams')", { timeout: 10_000 });
  const viewResults = page.locator('button:has-text("View results")');
  const notSubmitted = page.locator("text=Not submitted");
  const noSubmission = page.locator("text=No submission");
  await viewResults.or(notSubmitted).or(noSubmission).first().waitFor({ timeout: 10_000 });
  const elapsedMs = Date.now() - start;
  console.log(`slide14 Exams list load time: ${elapsedMs}ms`);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/slide14-exams-list-fast.png`, fullPage: true });
  expect(elapsedMs).toBeLessThan(3000);

  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const card = page.locator("button", { hasText: "Results ready" }).first();
  await card.click();
  await page.waitForTimeout(2000);
  await page.locator('a:has-text("Back to Results"), a:has-text("Results")').first().click();
  await page.waitForTimeout(1000);
  const scrollAfter = await page.evaluate(() => window.scrollY);
  console.log(`slide17 scrollBefore=${scrollBefore} scrollAfter=${scrollAfter}`);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/slide17-scroll-reset.png`, fullPage: false });
  expect(scrollAfter).toBe(0);
});
