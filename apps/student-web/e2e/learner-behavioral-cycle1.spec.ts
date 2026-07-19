/**
 * Behavioral Learner — Cycle 1
 * Student: student.test@subhang.academy / Test@12345 / SUB001
 * Space: 1AqFwKSf59FiIrqzaQ7i (Behavioral Interview Mastery — 12 story points)
 *
 * Learning Path:
 *   Study: STAR Method, Leadership, Conflict Resolution, System Ownership
 *   Practice: Cross-Functional, Failure & Growth, Ambiguity
 *   Study: Staff+ Level, Company FAANG Prep
 *   Practice: Mock Interview
 *   Quiz + Timed Writing Assessment
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ─── Credentials ──────────────────────────────────────────────────────────────
const SCHOOL_CODE = "SUB001";
const EMAIL = "student.test@subhang.academy";
const PASSWORD = "Test@12345";
const BASE_URL = "http://localhost:4570";

// ─── Behavioral Space ─────────────────────────────────────────────────────────
const BEHAVIORAL_SPACE_ID = "1AqFwKSf59FiIrqzaQ7i";

const STORY_POINTS = {
  starMethod: "m3zlNk1jI2X9akRPg9rF", // standard - STAR Method & Storytelling
  leadership: "iwlqmOQ7Bdt8KMumvRqy", // standard - Leadership & Influence
  conflictRes: "RUiidhIOp3UCUzufCqBT", // standard - Conflict Resolution
  systemOwnership: "VkxFEpeuQlnhPSse6RWR", // standard - System Ownership
  crossFunctional: "AOvHhunJrCu3HtnMeDWs", // standard - Cross-Functional Collaboration
  failureGrowth: "YfGY2GxO6HUPWUPYD94T", // standard - Failure, Recovery & Growth
  ambiguity: "0VKwtLTt1VydSeI073VB", // standard - Ambiguity & Prioritization
  staffPlus: "QkgpzZUPMWMlOmBYUUDw", // standard - Staff+ Level Questions
  faangPrep: "QmAD88dwzZlGdHOHsPFA", // standard - Company-Specific FAANG
  mockInterview: "9GED1Jdhi93kWeepJ2kA", // practice - Mock Interview Practice
  quiz: "jIPacoKFRykWJ3mtQ8Cs", // quiz
  timedAssessment: "xBnumc8jTQje26POV6Lq", // timed_test
};

// ─── Paths ───────────────────────────────────────────────────────────────────
const REPORTS_DIR = "/Users/subhang/Desktop/Projects/auto-levleup/tests/e2e/reports";
const AUTH_STATE_PATH = path.join(os.tmpdir(), "behavioral-learner-auth.json");

// ─── Report Interface ─────────────────────────────────────────────────────────
interface LearnerReport {
  cycleNumber: number;
  timestamp: string;
  learner: string;
  space: string;
  loginStatus: string;
  workingFeatures: string[];
  issues: Array<{
    id: string;
    severity: "P0" | "P1" | "P2" | "P3";
    category: string;
    title: string;
    details: string;
  }>;
  contentAssessment: {
    storyPointsTested: number;
    storyPointsAccessible: number;
    writingInputFound: boolean;
    aiEvaluationEnabled: boolean;
    starTemplateGuidance: boolean;
    contentQualityNotes: string[];
  };
  uxAssessment: {
    navigationWorking: boolean;
    loadTimesAcceptable: boolean;
    mobileResponsive: boolean;
    textRenderingGood: boolean;
    uxIssues: string[];
  };
  practiceMode: {
    tested: boolean;
    writingInputWorks: boolean;
    paragraphQuestionsFound: boolean;
    aiEvaluationTriggered: boolean;
    notes: string[];
  };
  quizMode: {
    tested: boolean;
    questionTypesFound: string[];
    resultsDisplayed: boolean;
    notes: string[];
  };
  timedAssessment: {
    tested: boolean;
    timerVisible: boolean;
    writingUnderPressureWorks: boolean | null;
    starStoriesRequired: boolean;
    analyticsShown: boolean;
    notes: string[];
  };
  learningEffectiveness: {
    score: number;
    notes: string;
  };
  rawObservations: string[];
}

const report: LearnerReport = {
  cycleNumber: 1,
  timestamp: new Date().toISOString(),
  learner: "Behavioral Learner (tm_1773067969207_noxja982f)",
  space: "Behavioral Interview Mastery",
  loginStatus: "pending",
  workingFeatures: [],
  issues: [],
  contentAssessment: {
    storyPointsTested: 0,
    storyPointsAccessible: 0,
    writingInputFound: false,
    aiEvaluationEnabled: false,
    starTemplateGuidance: false,
    contentQualityNotes: [],
  },
  uxAssessment: {
    navigationWorking: false,
    loadTimesAcceptable: true,
    mobileResponsive: false,
    textRenderingGood: false,
    uxIssues: [],
  },
  practiceMode: {
    tested: false,
    writingInputWorks: false,
    paragraphQuestionsFound: false,
    aiEvaluationTriggered: false,
    notes: [],
  },
  quizMode: {
    tested: false,
    questionTypesFound: [],
    resultsDisplayed: false,
    notes: [],
  },
  timedAssessment: {
    tested: false,
    timerVisible: false,
    writingUnderPressureWorks: null,
    starStoriesRequired: false,
    analyticsShown: false,
    notes: [],
  },
  learningEffectiveness: {
    score: 0,
    notes: "",
  },
  rawObservations: [],
};

// ─── Helper: Login ───────────────────────────────────────────────────────────
async function loginStudent(page: Page) {
  if (fs.existsSync(AUTH_STATE_PATH)) {
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(1500);
    if (page.url().includes("/login")) {
      await doFreshLogin(page);
    }
  } else {
    await doFreshLogin(page);
  }
}

async function doFreshLogin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill("#schoolCode", SCHOOL_CODE);
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.waitForSelector("#credential", { timeout: 15_000 });
  const emailTab = page.getByRole("tab", { name: "Email" });
  if (await emailTab.isVisible().catch(() => false)) await emailTab.click();
  await page.fill("#credential", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]:has-text("Sign In")');
  await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), {
    timeout: 35_000,
  });
}

// ─── Helper: Navigate to story point ────────────────────────────────────────
async function navigateToStoryPoint(page: Page, spaceId: string, storyPointId: string) {
  await page.goto(`${BASE_URL}/spaces/${spaceId}/story/${storyPointId}`);
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
  await page.waitForTimeout(2000);
}

// ─── Helper: Save report ─────────────────────────────────────────────────────
function saveReport() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, "learner-behavioral-cycle-1.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report saved: ${reportPath}`);
}

test.setTimeout(120_000);

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Behavioral Learner - Cycle 1", () => {
  // Save auth state once
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE_URL}/login`);
      await page.fill("#schoolCode", SCHOOL_CODE);
      await page.click('button[type="submit"]:has-text("Continue")');
      await page.waitForSelector("#credential", { timeout: 15_000 });
      const emailTab = page.getByRole("tab", { name: "Email" });
      if (await emailTab.isVisible().catch(() => false)) await emailTab.click();
      await page.fill("#credential", EMAIL);
      await page.fill("#password", PASSWORD);
      await page.click('button[type="submit"]:has-text("Sign In")');
      await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), {
        timeout: 35_000,
      });
      await ctx.storageState({ path: AUTH_STATE_PATH });
      report.rawObservations.push("Auth state saved for reuse");
    } finally {
      await ctx.close();
    }
  });

  test.afterAll(() => {
    const workingCount = report.workingFeatures.length;
    const p0Count = report.issues.filter((i) => i.severity === "P0").length;
    const p1Count = report.issues.filter((i) => i.severity === "P1").length;

    let score = 5;
    score += Math.min(workingCount * 0.3, 3);
    score -= p0Count * 1.5;
    score -= p1Count * 0.75;
    score = Math.max(1, Math.min(10, score));

    report.learningEffectiveness = {
      score: Math.round(score * 10) / 10,
      notes: `${workingCount} working features, ${report.issues.length} total issues (${p0Count} P0, ${p1Count} P1). Story points accessible: ${report.contentAssessment.storyPointsAccessible}/${report.contentAssessment.storyPointsTested}.`,
    };

    saveReport();
  });

  // ─── Test 1: Login ───────────────────────────────────────────────────────
  test("L1: Login as student with school code", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    const schoolCodeInput = page.locator("#schoolCode");
    await expect(schoolCodeInput).toBeVisible({ timeout: 10_000 });
    await schoolCodeInput.fill(SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');

    await page.waitForSelector("#credential", { timeout: 15_000 });
    report.rawObservations.push("Login: school code accepted, credential form shown");

    const emailTab = page.getByRole("tab", { name: "Email" });
    if (await emailTab.isVisible().catch(() => false)) {
      await emailTab.click();
      report.rawObservations.push("Email tab visible and clickable");
    }

    await page.fill("#credential", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]:has-text("Sign In")');

    try {
      await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), {
        timeout: 35_000,
      });
      report.loginStatus = "success";
      report.workingFeatures.push("L1: Login with school code + email works");
      report.rawObservations.push(`Login successful. URL: ${page.url()}`);
    } catch {
      const errorEl = page.locator('[class*="destructive"], [role="alert"]').first();
      const errorText = await errorEl.textContent().catch(() => "no error shown");
      report.loginStatus = "failed";
      report.issues.push({
        id: "BEH-001",
        severity: "P0",
        category: "authentication",
        title: "Login failed",
        details: `URL: ${page.url()}, error: ${errorText}`,
      });
    }

    expect(report.loginStatus).toBe("success");
  });

  // ─── Test 2: Navigate to Behavioral Space ───────────────────────────────
  test("L2: Find Behavioral Interview space in spaces list", async ({ page }) => {
    await loginStudent(page);
    await page.goto(`${BASE_URL}/spaces`);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });

    report.rawObservations.push(`Spaces page URL: ${page.url()}`);

    const behavioralCard = page.locator("text=Behavioral Interview Mastery").first();
    const cardVisible = await behavioralCard.isVisible({ timeout: 10_000 }).catch(() => false);

    if (cardVisible) {
      report.workingFeatures.push("L2: Behavioral Interview Mastery card visible in spaces list");
      report.uxAssessment.navigationWorking = true;
      await behavioralCard.click();
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 });
      const spaceUrl = page.url();
      report.rawObservations.push(`Behavioral space URL after click: ${spaceUrl}`);
      if (spaceUrl.includes(BEHAVIORAL_SPACE_ID)) {
        report.workingFeatures.push("L2: Clicking space card navigates to correct URL");
      }
    } else {
      // Try alternate text
      const altCard = page.locator("text=Behavioral").first();
      const altVisible = await altCard.isVisible({ timeout: 5_000 }).catch(() => false);
      report.rawObservations.push(`Behavioral card (alt): ${altVisible}`);

      report.issues.push({
        id: "BEH-002",
        severity: "P1",
        category: "navigation",
        title: "Behavioral Interview space not visible in spaces list",
        details: 'Cannot find "Behavioral Interview Mastery" card on /spaces page',
      });
    }

    expect(cardVisible).toBeTruthy();
  });

  // ─── Test 3: Space Viewer ─────────────────────────────────────────────
  test("L3: Behavioral space viewer shows story points", async ({ page }) => {
    await loginStudent(page);
    await page.goto(`${BASE_URL}/spaces/${BEHAVIORAL_SPACE_ID}`);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
    await page.waitForTimeout(2000);

    const url = page.url();
    report.rawObservations.push(`Space viewer URL: ${url}`);

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 10_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Space viewer h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.workingFeatures.push(`L3: Space viewer h1 visible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "BEH-003",
        severity: "P1",
        category: "learning-flow",
        title: "Space viewer missing h1",
        details: `URL: ${url}`,
      });
    }

    // Story point links
    const storyLinks = page.locator('a[href*="/story/"]');
    const storyCount = await storyLinks.count();
    report.rawObservations.push(`Story point links found: ${storyCount}`);

    if (storyCount >= 5) {
      report.workingFeatures.push(`L3: Space viewer shows ${storyCount} story point links`);
    } else if (storyCount > 0) {
      report.workingFeatures.push(
        `L3: Space viewer shows ${storyCount} story point links (partial)`
      );
      report.issues.push({
        id: "BEH-004",
        severity: "P2",
        category: "content",
        title: `Only ${storyCount} story points visible (expected 12)`,
        details: "Behavioral space should have 12 story points",
      });
    } else {
      report.issues.push({
        id: "BEH-004",
        severity: "P1",
        category: "content",
        title: "No story point links found in Behavioral space viewer",
        details: `URL: ${url}`,
      });
    }

    // Progress indicator
    const progressEl = page.locator('[class*="progress"], [role="progressbar"]').first();
    const progressVisible = await progressEl.isVisible({ timeout: 5_000 }).catch(() => false);
    if (progressVisible) {
      report.workingFeatures.push("L3: Progress indicator visible on space viewer");
    }

    expect(h1Visible).toBeTruthy();
  });

  // ─── Test 4: STAR Method Study ───────────────────────────────────────
  test("L4: STAR Method & Storytelling Framework - study", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.starMethod);

    report.contentAssessment.storyPointsTested++;
    const url = page.url();
    report.rawObservations.push(`STAR Method URL: ${url}`);

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`STAR Method h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L4: STAR Method story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "BEH-005",
        severity: "P0",
        category: "learning-flow",
        title: "STAR Method story point viewer: no h1",
        details: `URL: ${url}`,
      });
    }

    // Check for STAR-related content
    const bodyText = (await page.textContent("body")) || "";
    const starKeywords = [
      "situation",
      "task",
      "action",
      "result",
      "STAR",
      "story",
      "framework",
      "behavioral",
    ];
    const foundKeywords = starKeywords.filter((kw) =>
      bodyText.toLowerCase().includes(kw.toLowerCase())
    );
    report.rawObservations.push(`STAR keywords found: ${foundKeywords.join(", ")}`);

    if (foundKeywords.length >= 3) {
      report.workingFeatures.push(
        `L4: STAR content contains relevant keywords: ${foundKeywords.join(", ")}`
      );
      report.contentAssessment.contentQualityNotes.push(
        `STAR Method content quality good: ${foundKeywords.length}/${starKeywords.length} keywords`
      );
    } else {
      report.issues.push({
        id: "BEH-006",
        severity: "P2",
        category: "content-quality",
        title: "STAR Method content missing expected keywords",
        details: `Found ${foundKeywords.length}/${starKeywords.length}: ${foundKeywords.join(", ")}`,
      });
    }

    // Check for template/example guidance
    const templateGuidance =
      bodyText.toLowerCase().includes("example") ||
      bodyText.toLowerCase().includes("template") ||
      bodyText.toLowerCase().includes("sample");
    if (templateGuidance) {
      report.contentAssessment.starTemplateGuidance = true;
      report.workingFeatures.push("L4: Story template guidance found in STAR content");
    }

    // Check item rendering
    const items = page.locator(
      '[class*="item"], [class*="content-item"], [class*="question-card"], [class*="material-card"]'
    );
    const itemCount = await items.count();
    report.rawObservations.push(`STAR content items: ${itemCount}`);

    expect(h1Visible).toBeTruthy();
  });

  // ─── Test 5: Leadership Study ────────────────────────────────────────
  test("L5: Leadership & Influence - study", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.leadership);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Leadership h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L5: Leadership story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "BEH-007",
        severity: "P0",
        category: "learning-flow",
        title: "Leadership story point viewer: no h1",
        details: `URL: ${page.url()}`,
      });
    }

    // Check nav prev/next
    const nextBtn = page.locator('button:has-text("Next"), button[aria-label*="next"]').first();
    const prevBtn = page.locator('button:has-text("Previous"), button[aria-label*="prev"]').first();
    const nextVisible = await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    const prevVisible = await prevBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    report.rawObservations.push(`Leadership nav: next=${nextVisible}, prev=${prevVisible}`);
    if (nextVisible || prevVisible) {
      report.workingFeatures.push("L5: Item navigation (prev/next) visible");
    }

    // Content quality check
    const bodyText = (await page.textContent("body")) || "";
    const leaderKeywords = [
      "lead",
      "influence",
      "team",
      "mentor",
      "decision",
      "ownership",
      "impact",
    ];
    const found = leaderKeywords.filter((kw) => bodyText.toLowerCase().includes(kw.toLowerCase()));
    report.rawObservations.push(`Leadership keywords found: ${found.join(", ")}`);
    if (found.length >= 3) {
      report.workingFeatures.push(
        `L5: Leadership content has relevant terms (${found.length}/${leaderKeywords.length})`
      );
    }
  });

  // ─── Test 6: Conflict Resolution Study ──────────────────────────────
  test("L6: Conflict Resolution & Difficult Conversations - study", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.conflictRes);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L6: Conflict Resolution story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "BEH-008",
        severity: "P0",
        category: "learning-flow",
        title: "Conflict Resolution story point viewer: no h1",
        details: `URL: ${page.url()}`,
      });
    }
    report.rawObservations.push(`Conflict Resolution h1: "${h1Text}"`);
  });

  // ─── Test 7: System Ownership Study ─────────────────────────────────
  test("L7: System Ownership & Technical Decision-Making - study", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.systemOwnership);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L7: System Ownership story point accessible: "${h1Text}"`);
    }
    report.rawObservations.push(`System Ownership h1: "${h1Text}"`);
  });

  // ─── Test 8: Cross-Functional Practice (Writing input focus) ─────────
  test("P1: Cross-Functional Collaboration - practice + writing input", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.crossFunctional);

    report.practiceMode.tested = true;
    report.contentAssessment.storyPointsTested++;

    const url = page.url();
    report.rawObservations.push(`Cross-Functional URL: ${url}`);

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Cross-Functional h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`P1: Cross-Functional story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "BEH-009",
        severity: "P0",
        category: "practice-mode",
        title: "Cross-Functional story point viewer: no h1",
        details: `URL: ${url}`,
      });
    }

    // Check for paragraph/text input (key for behavioral practice)
    const textareaEl = page.locator("textarea").first();
    const textareaVisible = await textareaEl.isVisible({ timeout: 10_000 }).catch(() => false);
    report.rawObservations.push(`Textarea input visible: ${textareaVisible}`);

    if (textareaVisible) {
      report.contentAssessment.writingInputFound = true;
      report.practiceMode.writingInputWorks = true;
      report.practiceMode.paragraphQuestionsFound = true;
      report.workingFeatures.push("P1: Writing textarea input found in behavioral practice");

      // Try typing a STAR response
      await textareaEl.click();
      await textareaEl.fill(
        "Situation: I was leading a cross-functional project. Task: Align 3 teams on timeline. Action: Set up weekly syncs and shared doc. Result: Shipped on time."
      );
      await page.waitForTimeout(500);

      const inputValue = await textareaEl.inputValue().catch(() => "");
      if (inputValue.length > 10) {
        report.workingFeatures.push("P1: Text input accepts behavioral answer content");
        report.practiceMode.notes.push("Successfully typed STAR answer in textarea");
      }

      // Look for AI evaluation / submit
      const submitBtn = page
        .locator('button:has-text("Submit"), button:has-text("Check"), button:has-text("Evaluate")')
        .first();
      const submitVisible = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);

      if (submitVisible) {
        report.workingFeatures.push("P1: Submit/Evaluate button visible for behavioral answer");
        await submitBtn.click();
        await page.waitForTimeout(3000);

        // Check for AI evaluation response
        const aiEvalEl = page
          .locator('[class*="feedback"], [class*="evaluation"], [class*="result"], [class*="ai"]')
          .first();
        const aiEvalVisible = await aiEvalEl.isVisible({ timeout: 10_000 }).catch(() => false);
        if (aiEvalVisible) {
          report.contentAssessment.aiEvaluationEnabled = true;
          report.practiceMode.aiEvaluationTriggered = true;
          report.workingFeatures.push("P1: AI evaluation feedback shown after answer submission");
        } else {
          report.practiceMode.notes.push("No AI evaluation feedback detected after submit");
        }
      }
    } else {
      // Check for other input types
      const inputEl = page
        .locator('input[type="text"], input:not([type="radio"]):not([type="checkbox"])')
        .first();
      const inputVisible = await inputEl.isVisible({ timeout: 5_000 }).catch(() => false);

      if (inputVisible) {
        report.practiceMode.writingInputWorks = true;
        report.workingFeatures.push("P1: Text input (non-textarea) found in behavioral practice");
      } else {
        report.issues.push({
          id: "BEH-010",
          severity: "P1",
          category: "practice-mode",
          title: "No writing input found in behavioral practice",
          details: "Expected textarea or text input for STAR answer composition",
        });
        report.practiceMode.notes.push(
          "No textarea or text input found — behavioral practice may not support free-form writing"
        );
      }
    }
  });

  // ─── Test 9: Failure & Growth Practice ──────────────────────────────
  test("P2: Failure, Recovery & Growth Mindset - practice", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.failureGrowth);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Failure & Growth h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`P2: Failure & Growth story point accessible: "${h1Text}"`);

      // Check for example answers / model STAR answers
      const bodyText = (await page.textContent("body")) || "";
      const hasExamples =
        bodyText.toLowerCase().includes("example") ||
        bodyText.toLowerCase().includes("sample answer");
      if (hasExamples) {
        report.workingFeatures.push("P2: Example/sample answer found in Failure & Growth content");
      }

      // Check for textarea
      const textarea = page.locator("textarea").first();
      const taVisible = await textarea.isVisible({ timeout: 5_000 }).catch(() => false);
      if (taVisible) {
        report.workingFeatures.push("P2: Writing input available in Failure & Growth practice");
      }
    }
  });

  // ─── Test 10: Ambiguity & Prioritization Practice ────────────────────
  test("P3: Ambiguity & Prioritization - practice", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.ambiguity);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`P3: Ambiguity & Prioritization accessible: "${h1Text}"`);

      // Check progress marks
      const progressMark = page
        .locator('[class*="completed"], [class*="check"], svg[class*="check"]')
        .first();
      const progressVisible = await progressMark.isVisible({ timeout: 5_000 }).catch(() => false);
      if (progressVisible) {
        report.workingFeatures.push("P3: Progress completion marks visible");
      }
    }
    report.rawObservations.push(`Ambiguity h1: "${h1Text}"`);
  });

  // ─── Test 11: Staff+ Level Study ────────────────────────────────────
  test("L8: Staff+ Level Questions - study", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.staffPlus);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Staff+ h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L8: Staff+ Level Questions accessible: "${h1Text}"`);

      // Check for staff-level-specific content
      const bodyText = (await page.textContent("body")) || "";
      const staffKeywords = [
        "staff",
        "principal",
        "senior",
        "architecture",
        "organization",
        "strategy",
        "vision",
      ];
      const found = staffKeywords.filter((kw) => bodyText.toLowerCase().includes(kw.toLowerCase()));
      report.rawObservations.push(`Staff+ keywords found: ${found.join(", ")}`);
      if (found.length >= 2) {
        report.workingFeatures.push(
          `L8: Staff+ content relevant to senior roles (${found.length}/${staffKeywords.length} keywords)`
        );
      }
    }
  });

  // ─── Test 12: FAANG Prep Study ───────────────────────────────────────
  test("L9: Company-Specific FAANG Preparation - study", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.faangPrep);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`FAANG Prep h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L9: FAANG Prep story point accessible: "${h1Text}"`);

      // Check for FAANG-specific content
      const bodyText = (await page.textContent("body")) || "";
      const faangKeywords = [
        "google",
        "amazon",
        "meta",
        "microsoft",
        "apple",
        "leadership principle",
        "lp",
        "culture",
      ];
      const found = faangKeywords.filter((kw) => bodyText.toLowerCase().includes(kw.toLowerCase()));
      report.rawObservations.push(`FAANG keywords found: ${found.join(", ")}`);
      if (found.length >= 2) {
        report.workingFeatures.push(
          `L9: FAANG prep has company-specific content (${found.length}/${faangKeywords.length} keywords)`
        );
      } else {
        report.issues.push({
          id: "BEH-011",
          severity: "P2",
          category: "content-quality",
          title: "FAANG Prep content may lack company-specific details",
          details: `Found ${found.length}/${faangKeywords.length} FAANG keywords: ${found.join(", ")}`,
        });
      }
    }
  });

  // ─── Test 13: Mock Interview Practice ───────────────────────────────
  test("MOCK: Mock Interview Scenarios with model STAR answers", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.mockInterview);

    report.contentAssessment.storyPointsTested++;

    const url = page.url();
    report.rawObservations.push(`Mock Interview URL: ${url}`);

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Mock Interview h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`MOCK: Mock Interview practice accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "BEH-012",
        severity: "P0",
        category: "practice-mode",
        title: "Mock Interview story point viewer: no h1",
        details: `URL: ${url}`,
      });
    }

    // Check for model answer / example answer
    const bodyText = (await page.textContent("body")) || "";
    const hasModelAnswer =
      bodyText.toLowerCase().includes("model answer") ||
      bodyText.toLowerCase().includes("sample answer") ||
      bodyText.toLowerCase().includes("example answer") ||
      bodyText.toLowerCase().includes("strong answer");
    if (hasModelAnswer) {
      report.workingFeatures.push("MOCK: Model STAR answer examples found in mock interview");
    } else {
      report.practiceMode.notes.push("No model/sample answer text detected in mock interview page");
    }

    // Check writing input
    const textarea = page.locator("textarea").first();
    const taVisible = await textarea.isVisible({ timeout: 5_000 }).catch(() => false);
    if (taVisible) {
      report.workingFeatures.push("MOCK: Writing textarea available in mock interview");
    }

    // Submit button
    const submitBtn = page
      .locator('button:has-text("Submit"), button:has-text("Check"), button:has-text("Evaluate")')
      .first();
    const submitVisible = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (submitVisible) {
      report.workingFeatures.push("MOCK: Submit button visible in mock interview practice");
    }
  });

  // ─── Test 14: Quiz Mode ──────────────────────────────────────────────
  test("Q1: Behavioral Interview Concepts Quiz", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.quiz);

    report.quizMode.tested = true;
    report.contentAssessment.storyPointsTested++;

    const url = page.url();
    report.rawObservations.push(`Quiz URL: ${url}`);

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Quiz h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`Q1: Quiz story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "BEH-013",
        severity: "P0",
        category: "quiz",
        title: "Behavioral Quiz story point viewer: no h1",
        details: `URL: ${url}`,
      });
    }

    // Check MCQ
    const mcqOption = page.locator('input[type="radio"]').first();
    const mcqVisible = await mcqOption.isVisible({ timeout: 5_000 }).catch(() => false);
    if (mcqVisible) {
      report.quizMode.questionTypesFound.push("MCQ");
      report.workingFeatures.push("Q1: MCQ question type visible in behavioral quiz");
    }

    // Check for paragraph/text answer questions
    const textarea = page.locator("textarea").first();
    const taVisible = await textarea.isVisible({ timeout: 5_000 }).catch(() => false);
    if (taVisible) {
      report.quizMode.questionTypesFound.push("paragraph");
      report.workingFeatures.push("Q1: Paragraph/text answer question found in behavioral quiz");
    }

    // Check question counter
    const questionCounter = page
      .locator(
        '[class*="question-count"], [class*="question-number"], text=/Question \\d+ of \\d+/'
      )
      .first();
    const counterVisible = await questionCounter.isVisible({ timeout: 5_000 }).catch(() => false);
    if (counterVisible) {
      const counterText = (await questionCounter.textContent()) || "";
      report.workingFeatures.push(`Q1: Question counter visible: "${counterText}"`);
    }

    // Try answering MCQ and checking feedback
    if (mcqVisible) {
      await mcqOption.click();
      const submitBtn = page
        .locator('button:has-text("Submit"), button:has-text("Check"), button:has-text("Next")')
        .first();
      const submitVisible = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (submitVisible) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
        const feedbackEl = page
          .locator(
            '[class*="correct"], [class*="incorrect"], [class*="feedback"], [class*="result"]'
          )
          .first();
        const feedbackVisible = await feedbackEl.isVisible({ timeout: 5_000 }).catch(() => false);
        if (feedbackVisible) {
          report.quizMode.resultsDisplayed = true;
          report.workingFeatures.push("Q1: Answer feedback shown after submit in behavioral quiz");
        }
      }
    }
  });

  // ─── Test 15: Timed Assessment (STAR Writing Under Pressure) ─────────
  test("T1: Behavioral Timed Assessment - craft 3 STAR stories", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.timedAssessment);

    report.timedAssessment.tested = true;
    report.contentAssessment.storyPointsTested++;

    const url = page.url();
    report.rawObservations.push(`Timed assessment URL: ${url}`);

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Timed assessment h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`T1: Timed assessment page accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "BEH-014",
        severity: "P1",
        category: "timed-assessment",
        title: "Behavioral Timed Assessment: no h1 on landing page",
        details: `URL: ${url}`,
      });
    }

    // Check for timer
    const timerEl = page
      .locator('[class*="timer"], [data-testid*="timer"], text=/\\d+:\\d+/')
      .first();
    const timerVisible = await timerEl.isVisible({ timeout: 5_000 }).catch(() => false);
    if (timerVisible) {
      report.timedAssessment.timerVisible = true;
      const timerText = (await timerEl.textContent()) || "";
      report.workingFeatures.push(`T1: Timer visible: "${timerText}"`);
    } else {
      report.timedAssessment.notes.push("Timer not visible on landing page");
    }

    // Check for start button
    const startBtn = page
      .locator('button:has-text("Start"), button:has-text("Begin"), button:has-text("Start Test")')
      .first();
    const startVisible = await startBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (startVisible) {
      report.workingFeatures.push("T1: Start Test button visible for behavioral timed assessment");
      const pageText = (await page.textContent("body")) || "";

      // Check for STAR story prompts
      const starInstructions =
        pageText.toLowerCase().includes("star") ||
        pageText.toLowerCase().includes("story") ||
        pageText.toLowerCase().includes("situation") ||
        pageText.toLowerCase().includes("write");
      if (starInstructions) {
        report.timedAssessment.starStoriesRequired = true;
        report.workingFeatures.push(
          "T1: STAR story-writing instructions found on timed assessment"
        );
      }

      const hasDuration = /\d+\s*(min|minutes?|hour)/i.test(pageText);
      if (hasDuration) report.workingFeatures.push("T1: Test duration displayed");

      report.timedAssessment.notes.push(
        "Landing page verified. Did not start test to preserve attempts."
      );
    } else {
      const pageText = (await page.textContent("body")) || "";
      if (/attempt|completed|results/i.test(pageText)) {
        report.timedAssessment.notes.push("Timed test shows attempt/results-related message");
        report.rawObservations.push(`Timed assessment body snippet: ${pageText.substring(0, 300)}`);
      }
    }

    // Analytics
    const analyticsEl = page
      .locator('[class*="analytics"], [class*="results"], [class*="score"]')
      .first();
    const analyticsVisible = await analyticsEl.isVisible({ timeout: 5_000 }).catch(() => false);
    if (analyticsVisible) {
      report.timedAssessment.analyticsShown = true;
      report.workingFeatures.push("T1: Analytics/results section visible on timed assessment");
    }
  });

  // ─── Test 16: UX Assessment ──────────────────────────────────────────
  test("UX1: Navigation, text rendering, and mobile responsiveness", async ({ page }) => {
    await loginStudent(page);

    // Navigate to a story point
    await navigateToStoryPoint(page, BEHAVIORAL_SPACE_ID, STORY_POINTS.starMethod);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });

    // Breadcrumbs
    const breadcrumb = page
      .locator('[aria-label*="breadcrumb"], [class*="breadcrumb"], nav ol')
      .first();
    const breadcrumbVisible = await breadcrumb.isVisible({ timeout: 5_000 }).catch(() => false);
    if (breadcrumbVisible) {
      report.workingFeatures.push("UX1: Breadcrumbs visible on story point page");
    } else {
      report.uxAssessment.uxIssues.push("Breadcrumbs not visible on story point viewer");
    }

    // Back navigation
    const backLink = page
      .locator('a:has-text("Spaces"), a:has-text("Back"), a[href*="/spaces"]')
      .first();
    const backVisible = await backLink.isVisible({ timeout: 5_000 }).catch(() => false);
    if (backVisible) {
      report.workingFeatures.push("UX1: Back/Spaces navigation link visible");
    }

    // Text rendering quality
    const bodyText = (await page.textContent("body")) || "";
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 2).length;
    report.rawObservations.push(`Page word count: ${wordCount}`);

    if (wordCount > 200) {
      report.uxAssessment.textRenderingGood = true;
      report.workingFeatures.push(`UX1: Good text rendering (${wordCount} words visible)`);
    } else if (wordCount < 50) {
      report.uxAssessment.uxIssues.push(`Low word count: ${wordCount} — possible rendering issue`);
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    const h1Mobile = await page
      .locator("h1")
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (h1Mobile) {
      report.uxAssessment.mobileResponsive = true;
      report.workingFeatures.push("UX1: Story point viewer responsive on mobile (375px)");
    } else {
      report.uxAssessment.uxIssues.push("Story point viewer not responsive on mobile");
    }

    // Reset
    await page.setViewportSize({ width: 1280, height: 720 });

    // Load time
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/spaces/${BEHAVIORAL_SPACE_ID}`);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
    const loadTime = Date.now() - startTime;
    report.rawObservations.push(`Behavioral space viewer load time: ${loadTime}ms`);

    if (loadTime < 3000) {
      report.workingFeatures.push(`UX1: Fast load time (${loadTime}ms)`);
    } else if (loadTime > 5000) {
      report.uxAssessment.uxIssues.push(`Slow load time: ${loadTime}ms`);
      report.uxAssessment.loadTimesAcceptable = false;
    }
  });
});
