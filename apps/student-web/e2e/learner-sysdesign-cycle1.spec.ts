/**
 * System Design Learner — Cycle 1
 * Student: student.test@subhang.academy / Test@12345 / SUB001
 * Space: PDFq1OluyAGNAz6Fpx0j (System Design — 4 story points, 32 items)
 *
 * Key finding:
 *   P0 — SpaceViewerPage.tsx line 103: `useState(false)` called AFTER
 *   conditional early-returns (lines 63–98), violating React Rules of Hooks.
 *   Error: "Rendered more hooks than during the previous render."
 *   Fix: move useState to before line 63.
 *
 * Auth note: Firebase uses IndexedDB for auth tokens. Playwright storageState
 * only persists cookies/localStorage. We share a single BrowserContext across
 * all tests to keep the in-memory Firebase token alive.
 */

import { test, expect, type Page, type Browser, type BrowserContext } from "@playwright/test";
import * as fs from "fs";

const REPORTS_DIR = "/Users/subhang/Desktop/Projects/auto-levleup/tests/e2e/reports";
const SCHOOL_CODE = "SUB001";
const EMAIL = "student.test@subhang.academy";
const PASSWORD = "Test@12345";
const SYSDESIGN_SPACE_ID = "PDFq1OluyAGNAz6Fpx0j";
const SYSDESIGN_SPACE_ID_2 = "8rPWlVP4kyDp1xd75SnH";

// ─── Login helper ─────────────────────────────────────────────────────────────

async function doLogin(page: Page): Promise<boolean> {
  await page.goto("/login");
  await page.waitForSelector("#schoolCode", { timeout: 15_000 });
  await page.fill("#schoolCode", SCHOOL_CODE);
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.waitForSelector("#credential", { timeout: 15_000 });
  const emailTab = page.getByRole("tab", { name: "Email" });
  if (await emailTab.isVisible().catch(() => false)) await emailTab.click();
  await page.fill("#credential", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]:has-text("Sign In")');
  try {
    await page.waitForFunction(() => !window.location.href.includes("/login"), { timeout: 30_000 });
    return true;
  } catch {
    const errMsg = await page
      .locator('[role="alert"]:not([aria-live])')
      .textContent()
      .catch(() => "");
    console.log(`Login failed. Error: "${errMsg}". URL: ${page.url()}`);
    return false;
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

interface Issue {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  title: string;
  detail: string;
  rootCause?: string;
  fix?: string;
}

const report = {
  cycle: 1,
  role: "System Design Learner",
  spaceId: SYSDESIGN_SPACE_ID,
  timestamp: new Date().toISOString(),
  workingFeatures: [] as string[],
  issues: [] as Issue[],
  contentAssessment: {
    spacesListCount: 0,
    spacesListWorking: false,
    spaceViewerCrashed: false,
    spaceViewerCrashReason: "",
    storyPointsFound: 0,
    storyPointTitles: [] as string[],
    materialsRendered: false,
    architectureDiagramsFound: false,
    quizFound: false,
    timedTestFound: false,
  },
  uxAssessment: {
    loginFlow: "unknown" as "pass" | "fail" | "unknown",
    spacesListNavigation: "unknown" as "pass" | "fail" | "unknown",
    spaceViewerNavigation: "unknown" as "pass" | "fail" | "unknown",
    breadcrumbs: "unknown" as "pass" | "fail" | "unknown",
    progressDisplay: "unknown" as "pass" | "fail" | "unknown",
    timerAccuracy: "unknown" as "pass" | "fail" | "unknown",
    resultsPage: "unknown" as "pass" | "fail" | "unknown",
  },
  learningEffectiveness: {
    canFindSpaces: false,
    canOpenSpaceViewer: false,
    canFindContent: false,
    canAttemptQuiz: false,
    canAttemptTimedTest: false,
    canViewResults: false,
    canViewAnalytics: false,
  },
};

function pass(feature: string) {
  if (!report.workingFeatures.includes(feature)) report.workingFeatures.push(feature);
}

function addIssue(
  id: string,
  severity: Issue["severity"],
  title: string,
  detail: string,
  rootCause?: string,
  fix?: string
) {
  // Avoid duplicates
  if (!report.issues.find((i) => i.id === id)) {
    report.issues.push({ id, severity, title, detail, rootCause, fix });
  }
}

// Shared context/page (Firebase auth lives in IndexedDB, can't be serialised)
let sharedCtx: BrowserContext;
let sharedPage: Page;
let loginOk = false;

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe("System Design Learner — Cycle 1", () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    sharedCtx = await browser.newContext();
    sharedPage = await sharedCtx.newPage();
    loginOk = await doLogin(sharedPage);
    if (loginOk) {
      report.uxAssessment.loginFlow = "pass";
      pass("Student login — SUB001 + email + password");
      const h1 = await sharedPage
        .locator("h1")
        .first()
        .textContent()
        .catch(() => "");
      console.log(`Logged in. URL=${sharedPage.url()} h1="${h1}"`);
    } else {
      report.uxAssessment.loginFlow = "fail";
      addIssue("AUTH-01", "P0", "Login failed", `Could not login as ${EMAIL}`);
    }
  });

  test.afterAll(async () => {
    await sharedPage?.close().catch(() => {});
    await sharedCtx?.close().catch(() => {});
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const outPath = `${REPORTS_DIR}/learner-system-design-cycle-1.json`;
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 LearnerReport → ${outPath}`);
    const p0 = report.issues.filter((i) => i.severity === "P0").length;
    const p1 = report.issues.filter((i) => i.severity === "P1").length;
    console.log(
      `✅ Working: ${report.workingFeatures.length} | ⚠️ Issues: ${report.issues.length} (${p0} P0, ${p1} P1)`
    );
  });

  // ── 1. Login ────────────────────────────────────────────────────────────────

  test("1. Login as student with SUB001 school code", async () => {
    if (!loginOk) {
      addIssue("AUTH-01", "P0", "Login failed", `Could not login as ${EMAIL}`);
      test.skip();
    }
    const url = sharedPage.url();
    const h1 = await sharedPage
      .locator("h1")
      .first()
      .textContent()
      .catch(() => "");
    expect(url).not.toContain("/login");
    pass(`Dashboard renders after login (h1="${h1?.trim()}")`);
  });

  // ── 2. Spaces List ──────────────────────────────────────────────────────────

  test("2. Spaces list shows System Design space", async () => {
    if (!loginOk) test.skip();

    await sharedPage.goto("/spaces");
    await sharedPage.waitForTimeout(3_000);

    const spaceLinks = sharedPage.locator('a[href^="/spaces/"]');
    const count = await spaceLinks.count();
    report.contentAssessment.spacesListCount = count;
    console.log(`Spaces: ${count}`);

    for (const lnk of await spaceLinks.all()) {
      const href = await lnk.getAttribute("href");
      const text = (await lnk.textContent())?.trim() ?? "";
      console.log(`  ${href}: ${text.substring(0, 80)}`);
    }

    if (count > 0) {
      report.contentAssessment.spacesListWorking = true;
      report.learningEffectiveness.canFindSpaces = true;
      report.uxAssessment.spacesListNavigation = "pass";
      pass(`Spaces list renders ${count} space(s)`);
    } else {
      report.uxAssessment.spacesListNavigation = "fail";
      addIssue("SPACES-01", "P0", "Spaces list is empty", "No space cards visible on /spaces");
    }

    const sdLink = sharedPage.locator('a:has-text("System Design")').first();
    if (await sdLink.isVisible().catch(() => false)) pass("System Design space visible in list");

    const h1 = await sharedPage
      .locator("h1")
      .first()
      .textContent()
      .catch(() => "");
    expect(h1).toContain("My Spaces");
  });

  // ── 3. Space Viewer Crash (P0) ──────────────────────────────────────────────

  test("3. Space viewer — document hook crash P0", async () => {
    if (!loginOk) test.skip();

    await sharedPage.goto(`/spaces/${SYSDESIGN_SPACE_ID}`);
    await sharedPage.waitForTimeout(4_000);
    const crashed1 = await sharedPage
      .locator("text=Something went wrong")
      .isVisible()
      .catch(() => false);

    await sharedPage.goto(`/spaces/${SYSDESIGN_SPACE_ID_2}`);
    await sharedPage.waitForTimeout(4_000);
    const crashed2 = await sharedPage
      .locator("text=Something went wrong")
      .isVisible()
      .catch(() => false);

    console.log(`Crash ID1: ${crashed1}, ID2: ${crashed2}`);
    report.contentAssessment.spaceViewerCrashed = crashed1 || crashed2;

    if (crashed1 || crashed2) {
      report.contentAssessment.spaceViewerCrashReason =
        "useState() called after conditional returns — React hook order violation";
      report.uxAssessment.spaceViewerNavigation = "fail";
      addIssue(
        "SPACE-P0-01",
        "P0",
        'SpaceViewerPage crashes: "Rendered more hooks than during the previous render"',
        `Both System Design spaces crash. All space content blocked. ID1=${SYSDESIGN_SPACE_ID}:${crashed1}, ID2=${SYSDESIGN_SPACE_ID_2}:${crashed2}`,
        "SpaceViewerPage.tsx:103 — `const [celebrationShown, setCelebrationShown] = useState(false)` is called AFTER conditional early-returns at lines 63-98 (loading/error/null states). This violates React Rules of Hooks.",
        "Move `const [celebrationShown, setCelebrationShown] = useState(false)` from line 103 to BEFORE line 63 (before any conditional returns). One-line move."
      );
    } else {
      report.uxAssessment.spaceViewerNavigation = "pass";
      report.learningEffectiveness.canOpenSpaceViewer = true;
      pass("Space viewer loads without crash");
    }

    // Try Again button behaviour
    await sharedPage.goto(`/spaces/${SYSDESIGN_SPACE_ID}`);
    await sharedPage.waitForTimeout(4_000);
    const retryBtn = sharedPage.locator('button:has-text("Try Again")');
    if (await retryBtn.isVisible().catch(() => false)) {
      pass('Error boundary shows "Try Again" button');
      await retryBtn.click();
      await sharedPage.waitForTimeout(3_000);
      const stillCrashed = await sharedPage
        .locator("text=Something went wrong")
        .isVisible()
        .catch(() => false);
      if (stillCrashed) {
        addIssue(
          "SPACE-P0-02",
          "P1",
          '"Try Again" cannot fix hook crash',
          "Re-render crashes again since it's a code bug"
        );
      } else {
        pass('"Try Again" recovers from crash');
      }
    }
  });

  // ── 4. Story points via spaces list click ───────────────────────────────────

  test("4. Story points accessible from spaces list", async () => {
    if (!loginOk) test.skip();

    await sharedPage.goto("/spaces");
    await sharedPage.waitForTimeout(2_000);

    const spaceLinks = sharedPage.locator('a[href^="/spaces/"]');
    if ((await spaceLinks.count()) === 0) test.skip();

    const firstHref = await spaceLinks.first().getAttribute("href");
    console.log("Clicking:", firstHref);
    await spaceLinks.first().click();
    await sharedPage.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
    await sharedPage.waitForTimeout(4_000);

    const crashed = await sharedPage
      .locator("text=Something went wrong")
      .isVisible()
      .catch(() => false);
    const hasH1 = await sharedPage
      .locator("h1")
      .isVisible()
      .catch(() => false);
    const storyLinks = await sharedPage
      .locator('a[href*="/story-points/"], a[href*="/practice/"], a[href*="/test/"]')
      .count();

    console.log(`Crashed: ${crashed}, H1: ${hasH1}, StoryLinks: ${storyLinks}`);
    report.contentAssessment.storyPointsFound = storyLinks;

    if (!crashed && hasH1 && storyLinks > 0) {
      report.learningEffectiveness.canFindContent = true;
      report.learningEffectiveness.canOpenSpaceViewer = true;
      pass(`Space viewer loads: ${storyLinks} story point links`);

      for (const lnk of await sharedPage
        .locator('a[href*="/story-points/"], a[href*="/practice/"], a[href*="/test/"]')
        .all()) {
        const text = (await lnk.textContent())?.trim() ?? "";
        if (text && !report.contentAssessment.storyPointTitles.includes(text)) {
          report.contentAssessment.storyPointTitles.push(text.substring(0, 100));
        }
      }

      const hasProgress = await sharedPage
        .locator("text=Overall Progress")
        .isVisible()
        .catch(() => false);
      report.uxAssessment.progressDisplay = hasProgress ? "pass" : "fail";
      if (hasProgress) pass("Overall Progress indicator visible");
      else
        addIssue(
          "UX-01",
          "P2",
          "No Overall Progress indicator",
          "Progress bar missing on space viewer"
        );

      const hasBreadcrumb = await sharedPage
        .locator('a:has-text("Spaces")')
        .isVisible()
        .catch(() => false);
      report.uxAssessment.breadcrumbs = hasBreadcrumb ? "pass" : "fail";
      if (hasBreadcrumb) pass("Breadcrumb navigation present");
    } else if (crashed) {
      addIssue(
        "STORY-P0-01",
        "P0",
        "Story points blocked by space viewer crash",
        "Fix SPACE-P0-01 first"
      );
    } else {
      addIssue(
        "CONTENT-01",
        "P1",
        "Space viewer loaded but no story points",
        `H1=${hasH1}, storyLinks=${storyLinks}`
      );
    }
  });

  // ── 5. Practice mode ───────────────────────────────────────────────────────

  test("5. Practice mode quiz interaction", async () => {
    if (!loginOk) test.skip();

    await sharedPage.goto("/spaces");
    await sharedPage.waitForTimeout(2_000);
    const spaceLinks = sharedPage.locator('a[href^="/spaces/"]');
    if ((await spaceLinks.count()) === 0) test.skip();

    await spaceLinks.first().click();
    await sharedPage.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
    await sharedPage.waitForTimeout(4_000);

    if (
      await sharedPage
        .locator("text=Something went wrong")
        .isVisible()
        .catch(() => false)
    ) {
      addIssue("QUIZ-P0-01", "P0", "Quiz blocked by space viewer crash", "Fix SPACE-P0-01 first");
      test.skip();
    }

    const practiceLinks = sharedPage.locator('a[href*="/practice/"]');
    if ((await practiceLinks.count()) === 0) {
      addIssue(
        "QUIZ-01",
        "P1",
        "No practice/quiz links found in space",
        "Check seeded story points"
      );
      test.skip();
    }

    report.contentAssessment.quizFound = true;
    pass(`Practice/quiz links found: ${await practiceLinks.count()}`);

    await practiceLinks.first().click();
    await sharedPage.waitForURL(/\/practice\//, { timeout: 10_000 });
    await sharedPage.waitForTimeout(3_000);

    const hasPracticeMode = await sharedPage
      .locator("text=Practice Mode")
      .isVisible()
      .catch(() => false);
    const hasQ1 = await sharedPage
      .locator("text=Question 1")
      .isVisible()
      .catch(() => false);

    if (hasPracticeMode || hasQ1) {
      pass("Practice/quiz mode page loads correctly");
      report.learningEffectiveness.canAttemptQuiz = true;
      if (
        await sharedPage
          .locator("text=Unlimited")
          .isVisible()
          .catch(() => false)
      ) {
        pass('Practice shows "Unlimited retries" label');
      }
    } else {
      addIssue(
        "QUIZ-02",
        "P1",
        "Practice page did not render",
        'No "Practice Mode" or question 1 visible'
      );
    }

    const opts = sharedPage.locator(
      '[role="radiogroup"] button, label:has(input[type="radio"]), button[data-option]'
    );
    if ((await opts.count()) > 0) {
      await opts.first().click();
      await sharedPage.waitForTimeout(400);
      pass("Can select MCQ option in quiz");
    }
  });

  // ── 6. Timed test landing ──────────────────────────────────────────────────

  test("6. Timed test landing page metadata", async () => {
    if (!loginOk) test.skip();

    await sharedPage.goto("/spaces");
    await sharedPage.waitForTimeout(2_000);
    const spaceLinks = sharedPage.locator('a[href^="/spaces/"]');
    if ((await spaceLinks.count()) === 0) test.skip();

    await spaceLinks.first().click();
    await sharedPage.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
    await sharedPage.waitForTimeout(4_000);

    if (
      await sharedPage
        .locator("text=Something went wrong")
        .isVisible()
        .catch(() => false)
    ) {
      addIssue(
        "TEST-P0-01",
        "P0",
        "Timed test blocked by space viewer crash",
        "Fix SPACE-P0-01 first"
      );
      test.skip();
    }

    const testLinks = sharedPage.locator('a[href*="/test/"]');
    if ((await testLinks.count()) === 0) {
      addIssue("TEST-01", "P1", "No timed test links in space", "Check seeded story points");
      test.skip();
    }

    report.contentAssessment.timedTestFound = true;
    await testLinks.first().click();
    await sharedPage.waitForURL(/\/test\//, { timeout: 10_000 });
    await sharedPage.waitForTimeout(3_000);

    const hasTTLabel = await sharedPage
      .locator("text=Timed Test")
      .isVisible()
      .catch(() => false);
    const hasDuration = await sharedPage
      .locator("text=Duration")
      .isVisible()
      .catch(() => false);
    const hasStartBtn = await sharedPage
      .locator('button:has-text("Start Test")')
      .isVisible()
      .catch(() => false);
    const hasMaxAttempts = await sharedPage
      .locator("text=Max Attempts")
      .isVisible()
      .catch(() => false);

    if (hasTTLabel) pass('Timed test landing: "Timed Test" label');
    if (hasDuration) pass("Timed test: Duration shown");
    if (hasMaxAttempts) pass("Timed test: Max Attempts shown");
    if (hasStartBtn) {
      pass("Start Test button visible");
      report.learningEffectiveness.canAttemptTimedTest = true;
    }
    if (!hasTTLabel)
      addIssue("TEST-02", "P1", "Timed test landing broken", 'No "Timed Test" label');

    const has30min = await sharedPage
      .locator(':text-matches("30\\s*(min|minutes|Min)", "i")')
      .isVisible()
      .catch(() => false);
    if (has30min) pass("30-minute duration confirmed on landing page");
  });

  // ── 7. Start timed test ────────────────────────────────────────────────────

  test("7. Start and submit System Design Assessment", async () => {
    test.setTimeout(120_000);
    if (!loginOk) test.skip();

    await sharedPage.goto("/spaces");
    await sharedPage.waitForTimeout(2_000);
    const spaceLinks = sharedPage.locator('a[href^="/spaces/"]');
    if ((await spaceLinks.count()) === 0) test.skip();

    await spaceLinks.first().click();
    await sharedPage.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
    await sharedPage.waitForTimeout(4_000);

    if (
      await sharedPage
        .locator("text=Something went wrong")
        .isVisible()
        .catch(() => false)
    )
      test.skip();

    const testLinks = sharedPage.locator('a[href*="/test/"]');
    if ((await testLinks.count()) === 0) test.skip();

    await testLinks.first().click();
    await sharedPage.waitForURL(/\/test\//, { timeout: 10_000 });
    await sharedPage.waitForTimeout(3_000);

    const startBtn = sharedPage.locator('button:has-text("Start Test")');
    if (!(await startBtn.isVisible().catch(() => false))) {
      const noAttempts = await sharedPage
        .locator(':text-matches("no attempts|max attempt", "i")')
        .isVisible()
        .catch(() => false);
      if (noAttempts) addIssue("TEST-03", "P2", "Max attempts reached", "Cannot start test");
      test.skip();
    }

    await startBtn.click();
    await sharedPage.waitForTimeout(5_000);

    const isInProgress = await sharedPage
      .locator("text=Question 1 of")
      .isVisible()
      .catch(() => false);
    const hasTimer = await sharedPage
      .locator(':text-matches("\\d+:\\d+")')
      .isVisible()
      .catch(() => false);

    if (isInProgress) pass("Timed test starts, shows question 1 of N");
    else
      addIssue(
        "TEST-04",
        "P1",
        "Test did not enter in-progress view",
        "No question shown after Start Test"
      );

    report.uxAssessment.timerAccuracy = hasTimer ? "pass" : "fail";
    if (hasTimer) pass("Countdown timer visible");
    else addIssue("TEST-05", "P2", "No countdown timer visible", "Timer UI not found in test view");

    if (isInProgress) {
      const opts = sharedPage.locator(
        '[role="radiogroup"] button, button[data-option], label:has(input[type="radio"])'
      );
      if ((await opts.count()) > 0) {
        await opts.first().click();
        await sharedPage.waitForTimeout(300);
        pass("Can select answer in timed test");
      }

      const submitBtn = sharedPage.locator('button:has-text("Submit Test")');
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await sharedPage.waitForTimeout(2_000);
        const confirmBtn = sharedPage
          .locator(
            '[role="dialog"] button:has-text("Submit"), [role="alertdialog"] button:has-text("Submit")'
          )
          .last();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await sharedPage.waitForTimeout(5_000);
          pass("Submit confirmation dialog works");
          if (
            await sharedPage
              .locator("text=Score")
              .isVisible()
              .catch(() => false)
          ) {
            pass("Test results shown after submission");
            report.learningEffectiveness.canViewResults = true;
          }
        }
      }
    }
  });

  // ── 8. Results & Analytics ─────────────────────────────────────────────────

  test("8. Results page and analytics", async () => {
    if (!loginOk) test.skip();

    await sharedPage.goto("/results");
    await sharedPage.waitForTimeout(3_000);

    const h1 = await sharedPage
      .locator("h1")
      .first()
      .textContent()
      .catch(() => "");
    const url = sharedPage.url();
    console.log(`Results URL: ${url}, h1="${h1}"`);

    if (!url.includes("/login") && (h1?.trim().length ?? 0) > 0) {
      report.uxAssessment.resultsPage = "pass";
      pass(`Results/Progress page loads (h1="${h1?.trim()}")`);
      report.learningEffectiveness.canViewResults = true;
    } else {
      report.uxAssessment.resultsPage = "fail";
      addIssue("RESULTS-01", "P2", "Results page not loading", `URL=${url}, h1="${h1}"`);
    }

    const hasOverall = await sharedPage
      .locator('button:has-text("Overall")')
      .isVisible()
      .catch(() => false);
    const hasSpaces = await sharedPage
      .locator('button:has-text("Spaces")')
      .isVisible()
      .catch(() => false);
    const hasExams = await sharedPage
      .locator('button:has-text("Exams")')
      .isVisible()
      .catch(() => false);

    if (hasOverall && hasSpaces && hasExams) {
      pass("Results page has all 3 tabs: Overall, Spaces, Exams");
    } else {
      addIssue(
        "RESULTS-02",
        "P2",
        "Results page missing tabs",
        `Overall:${hasOverall} Spaces:${hasSpaces} Exams:${hasExams}`
      );
    }

    if (hasSpaces) {
      await sharedPage.locator('button:has-text("Spaces")').click();
      await sharedPage.waitForTimeout(2_000);
      const spCount = await sharedPage.locator('a[href^="/spaces/"]').count();
      if (spCount > 0) {
        pass(`Spaces analytics: ${spCount} space(s) shown`);
        report.learningEffectiveness.canViewAnalytics = true;
      } else {
        pass("Spaces analytics: empty state shown");
      }
    }

    if (hasOverall) {
      await sharedPage.locator('button:has-text("Overall")').click();
      await sharedPage.waitForTimeout(1_500);
      const hasScore = await sharedPage
        .locator(':text-matches("Overall Score|Score", "i")')
        .isVisible()
        .catch(() => false);
      if (hasScore) pass("Overall score visible in analytics");
    }
  });

  // ── 9. Tests page ─────────────────────────────────────────────────────────

  test("9. Tests page accessible", async () => {
    if (!loginOk) test.skip();

    await sharedPage.goto("/tests");
    await sharedPage.waitForTimeout(3_000);

    const h1 = await sharedPage
      .locator("h1")
      .first()
      .textContent()
      .catch(() => "");
    const hasCrash = await sharedPage
      .locator("text=Something went wrong")
      .isVisible()
      .catch(() => false);
    const url = sharedPage.url();
    console.log(`Tests page: URL=${url}, h1="${h1}", crash=${hasCrash}`);

    if (!url.includes("/login") && !hasCrash && (h1?.trim().length ?? 0) > 0) {
      pass(`Tests page loads (h1="${h1?.trim()}")`);
    } else if (hasCrash) {
      addIssue("TESTS-01", "P2", "Tests page crashes", "/tests shows error boundary");
    } else if (url.includes("/login")) {
      addIssue("TESTS-02", "P2", "Tests page redirects to login", "Auth not persisting to /tests");
    }
  });

  // ── 10. Dashboard ─────────────────────────────────────────────────────────

  test("10. Dashboard shows learning stats", async () => {
    if (!loginOk) test.skip();

    await sharedPage.goto("/");
    await sharedPage.waitForTimeout(2_500);

    const h1 = await sharedPage
      .locator("h1")
      .first()
      .textContent()
      .catch(() => "");
    const url = sharedPage.url();
    console.log(`Dashboard: URL=${url}, h1="${h1}"`);

    if (!url.includes("/login") && (h1?.trim().length ?? 0) > 0) {
      pass(`Dashboard loads (h1="${h1?.trim()}")`);
    }

    if ((await sharedPage.locator('[class*="card"], [class*="stat"]').count()) > 0) {
      pass("Dashboard shows stat/card widgets");
    }

    if (
      await sharedPage
        .locator('a[href="/spaces"]')
        .isVisible()
        .catch(() => false)
    ) {
      pass("Dashboard: Spaces navigation link visible");
    }

    await expect(sharedPage.locator("h1").first()).toBeVisible();
  });

  // ── 11. Story point viewer materials ──────────────────────────────────────

  test("11. Story point viewer — content rendering", async () => {
    if (!loginOk) test.skip();

    await sharedPage.goto("/spaces");
    await sharedPage.waitForTimeout(2_000);
    const spaceLinks = sharedPage.locator('a[href^="/spaces/"]');
    if ((await spaceLinks.count()) === 0) test.skip();

    await spaceLinks.first().click();
    await sharedPage.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
    await sharedPage.waitForTimeout(4_000);

    if (
      await sharedPage
        .locator("text=Something went wrong")
        .isVisible()
        .catch(() => false)
    )
      test.skip();

    const spLinks = sharedPage.locator('a[href*="/story-points/"]');
    if ((await spLinks.count()) === 0) test.skip();

    await spLinks.first().click();
    await sharedPage.waitForURL(/\/story-points\//, { timeout: 10_000 });
    await sharedPage.waitForTimeout(3_500);

    const spH1 = await sharedPage
      .locator("h1")
      .first()
      .textContent()
      .catch(() => "");
    const items = await sharedPage.locator(".rounded-lg, article, section").count();
    const diagrams = await sharedPage
      .locator('img[src], svg[width], [class*="mermaid"], [class*="diagram"]')
      .count();

    console.log(`Story point: "${spH1}", items=${items}, diagrams=${diagrams}`);

    if ((spH1?.trim().length ?? 0) > 0) pass(`Story point viewer loads (h1="${spH1?.trim()}")`);

    if (items > 2) {
      report.contentAssessment.materialsRendered = true;
      pass(`Story point has content items (${items})`);
    } else {
      addIssue(
        "CONTENT-02",
        "P1",
        "Story point viewer shows few/no items",
        `items=${items}. May be EVAL-C1-002 or empty seed.`
      );
    }

    if (diagrams > 0) {
      report.contentAssessment.architectureDiagramsFound = true;
      pass(`Architecture diagrams/images found: ${diagrams}`);
    }
  });
});
