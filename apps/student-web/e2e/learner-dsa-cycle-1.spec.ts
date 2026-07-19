/**
 * DSA Learner - Cycle 1
 * Simulates a student learning Data Structures & Algorithms from the portal.
 * Login: student.test@subhang.academy / Test@12345 / SUB001
 * Space: Data Structures & Algorithms (ZikR8xEHkqIaIsugmdQg)
 */
import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ─── Credentials ───────────────────────────────────────────────────────────
const SCHOOL_CODE = "SUB001";
const EMAIL = "student.test@subhang.academy";
const PASSWORD = "Test@12345";
const BASE_URL = "http://localhost:4570";

// ─── DSA Space IDs ──────────────────────────────────────────────────────────
const DSA_SPACE_ID = "ZikR8xEHkqIaIsugmdQg";
const DSA_STORY_POINTS = {
  arrays: "NUDWSZDR9YRnPJX6qoeP", // standard - Arrays & Strings
  hashmaps: "Zu86i5osXGCbp6Rf70Tm", // standard - Hash Maps & Sets
  linked: "sgdMKWWF0KpEytqHeTbh", // standard - Linked Lists
  trees: "QmHCyOaM0oexjrWEBVfN", // standard - Binary Trees
  graphs: "wGH5xwxuPQcOWyL55gFR", // practice - Graphs BFS/DFS
  advGraphs: "7VOUVJEiBH77fyYEg4is", // practice - Advanced Graphs
  dp1: "zHs2PGWwj2fnVsQMO8Yu", // practice - DP I
  dp2: "1pEg2NCNaajNJcTHxbJy", // practice - DP II
  tries: "9H8WbP0KlNvE1moOplD7", // standard - Tries & Segment Trees
  greedy: "Jn9kf9OAeiUlkfqeClpP", // practice - Greedy & Backtracking
  quiz: "DDvMqnfuSGs3btPIYpnK", // quiz
  timedTest: "7LgnRSSjBcZxj4PFoB1S", // timed_test
};

// ─── Report Structure ──────────────────────────────────────────────────────
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
    codeBlocksRendered: boolean;
    bigONotationDisplayed: boolean;
    syntaxHighlighting: boolean;
    contentQualityNotes: string[];
  };
  uxAssessment: {
    navigationWorking: boolean;
    loadTimesAcceptable: boolean;
    mobileResponsive: boolean;
    uxIssues: string[];
  };
  practiceMode: {
    tested: boolean;
    retryWorks: boolean;
    difficultyFilterWorks: boolean;
    progressPersists: boolean;
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
    autoSubmit: boolean | null;
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
  learner: "DSA Learner (tm_1773067938659_5fys6s24v)",
  space: "Data Structures & Algorithms",
  loginStatus: "pending",
  workingFeatures: [],
  issues: [],
  contentAssessment: {
    storyPointsTested: 0,
    storyPointsAccessible: 0,
    codeBlocksRendered: false,
    bigONotationDisplayed: false,
    syntaxHighlighting: false,
    contentQualityNotes: [],
  },
  uxAssessment: {
    navigationWorking: false,
    loadTimesAcceptable: true,
    mobileResponsive: false,
    uxIssues: [],
  },
  practiceMode: {
    tested: false,
    retryWorks: false,
    difficultyFilterWorks: false,
    progressPersists: false,
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
    autoSubmit: null,
    analyticsShown: false,
    notes: [],
  },
  learningEffectiveness: {
    score: 0,
    notes: "",
  },
  rawObservations: [],
};

// ─── Helper: Login (uses saved auth state for speed) ────────────────────────
async function loginStudent(page: Page) {
  // Restore saved auth state if available
  if (fs.existsSync(AUTH_STATE_PATH)) {
    // Navigate to dashboard with pre-authenticated state
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(1500);
    // If we're still on login page, do fresh login
    if (page.url().includes("/login")) {
      await page.fill("#schoolCode", SCHOOL_CODE);
      await page.click('button[type="submit"]:has-text("Continue")');
      await page.waitForSelector("#credential", { timeout: 15_000 });
      const emailTab = page.getByRole("tab", { name: "Email" });
      if (await emailTab.isVisible()) await emailTab.click();
      await page.fill("#credential", EMAIL);
      await page.fill("#password", PASSWORD);
      await page.click('button[type="submit"]:has-text("Sign In")');
      await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), {
        timeout: 35_000,
      });
    }
  } else {
    await page.goto(`${BASE_URL}/login`);
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForSelector("#credential", { timeout: 15_000 });
    const emailTab = page.getByRole("tab", { name: "Email" });
    if (await emailTab.isVisible()) await emailTab.click();
    await page.fill("#credential", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]:has-text("Sign In")');
    await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), {
      timeout: 35_000,
    });
  }
}

// ─── Helper: Navigate to story point ───────────────────────────────────────
async function navigateToStoryPoint(page: Page, spaceId: string, storyPointId: string) {
  await page.goto(`${BASE_URL}/spaces/${spaceId}/story-points/${storyPointId}`);
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
  await page.waitForTimeout(3000); // Wait for React to hydrate and Firestore to load
}

// ─── Helper: Save report ───────────────────────────────────────────────────
function saveReport() {
  const reportDir = path.join(process.cwd(), "../../tests/e2e/reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "learner-dsa-cycle-1.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report saved to: ${reportPath}`);
}

// ─── Storage state path for auth reuse ─────────────────────────────────────
const AUTH_STATE_PATH = "/tmp/dsa-learner-auth.json";

// Set per-test timeout to 120s to handle Firebase auth delays
test.setTimeout(120_000);

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe("DSA Learner - Cycle 1", () => {
  // Perform login once and save storage state for reuse
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/login`);
      await page.fill("#schoolCode", SCHOOL_CODE);
      await page.click('button[type="submit"]:has-text("Continue")');
      await page.waitForSelector("#credential", { timeout: 15_000 });
      const emailTab = page.getByRole("tab", { name: "Email" });
      if (await emailTab.isVisible()) await emailTab.click();
      await page.fill("#credential", EMAIL);
      await page.fill("#password", PASSWORD);
      await page.click('button[type="submit"]:has-text("Sign In")');
      await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), {
        timeout: 35_000,
      });
      await context.storageState({ path: AUTH_STATE_PATH });
    } finally {
      await context.close();
    }
  });

  test.afterAll(() => {
    // Calculate learning effectiveness score
    const workingCount = report.workingFeatures.length;
    const issueCount = report.issues.length;
    const p0Count = report.issues.filter((i) => i.severity === "P0").length;
    const p1Count = report.issues.filter((i) => i.severity === "P1").length;

    let score = 5; // baseline
    score += Math.min(workingCount * 0.3, 3);
    score -= p0Count * 1.5;
    score -= p1Count * 0.75;
    score = Math.max(1, Math.min(10, score));

    report.learningEffectiveness = {
      score: Math.round(score * 10) / 10,
      notes: `${workingCount} working features, ${report.issues.length} total issues (${p0Count} P0, ${p1Count} P1). Content accessible: ${report.contentAssessment.storyPointsAccessible}/${report.contentAssessment.storyPointsTested} story points.`,
    };

    saveReport();
  });

  // ─── Test 1: Login ─────────────────────────────────────────────────────
  test("L1: Login as student with school code", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Enter school code
    const schoolCodeInput = page.locator("#schoolCode");
    await expect(schoolCodeInput).toBeVisible({ timeout: 10_000 });
    await schoolCodeInput.fill(SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');

    // Wait for credential form
    await page.waitForSelector("#credential", { timeout: 15_000 });
    report.rawObservations.push("Login page: school code accepted, credential form shown");

    // Try email tab
    const emailTab = page.getByRole("tab", { name: "Email" });
    if (await emailTab.isVisible()) {
      await emailTab.click();
      report.rawObservations.push("Email tab is visible and clickable");
    }

    await page.fill("#credential", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]:has-text("Sign In")');

    try {
      // Wait for URL to change away from /login (handles "Signing in..." async state)
      await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), {
        timeout: 35_000,
      });
      const currentUrl = page.url();
      report.loginStatus = "success";
      report.workingFeatures.push("L1: Login with school code + email works");
      report.rawObservations.push(`Login successful. URL: ${currentUrl}`);
    } catch (e) {
      const currentUrl = page.url();
      // Check if still on login page - get error text
      const errorEl = page.locator('[class*="destructive"], [role="alert"]').first();
      const errorVisible = await errorEl.isVisible({ timeout: 3_000 }).catch(() => false);
      const errorText = errorVisible ? (await errorEl.textContent()) || "" : "no error shown";
      report.loginStatus = "failed";
      report.issues.push({
        id: "DSA-001",
        severity: "P0",
        category: "authentication",
        title: "Login failed - did not leave /login page within 35s",
        details: `URL: ${currentUrl}, error: ${errorText}`,
      });
      report.rawObservations.push(`Login FAILED. URL: ${currentUrl}, error: ${errorText}`);
    }

    expect(report.loginStatus).toBe("success");
  });

  // ─── Test 2: Navigate to Spaces List ──────────────────────────────────
  test("L2: Navigate to spaces list and find DSA space", async ({ page }) => {
    await loginStudent(page);

    // Navigate to spaces
    await page.goto(`${BASE_URL}/spaces`);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
    // Wait for loading state to resolve (Firestore data fetch)
    await page
      .waitForFunction(() => !document.body.textContent?.includes("Loading..."), {
        timeout: 15_000,
      })
      .catch(() => {});
    await page.waitForTimeout(2000); // Extra buffer for rendering

    const pageTitle = await page.title();
    report.rawObservations.push(`Spaces page title: ${pageTitle}`);

    // Look for DSA space card
    const dsaCard = page.locator("text=Data Structures & Algorithms").first();
    const dsaCardVisible = await dsaCard.isVisible({ timeout: 5_000 }).catch(() => false);

    // Record all visible spaces
    const spaceLinks = page.locator('a[href^="/spaces/"]');
    const spaceCount = await spaceLinks.count();
    const spaceTitles: string[] = [];
    for (const link of await spaceLinks.all()) {
      const text = ((await link.textContent()) || "").trim().substring(0, 60);
      if (text) spaceTitles.push(text);
    }
    report.rawObservations.push(
      `Spaces visible in My Spaces (${spaceCount}): ${spaceTitles.join(", ")}`
    );

    if (dsaCardVisible) {
      report.workingFeatures.push("L2: DSA Space card visible in spaces list");
      report.uxAssessment.navigationWorking = true;
      report.rawObservations.push("DSA Space card found in spaces list");
      await dsaCard.click();
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 });
      const spaceUrl = page.url();
      report.rawObservations.push(`DSA Space URL after click: ${spaceUrl}`);

      if (spaceUrl.includes(DSA_SPACE_ID)) {
        report.workingFeatures.push("L2: Clicking DSA space navigates to correct space URL");
      }
    } else {
      report.issues.push({
        id: "DSA-002",
        severity: "P2",
        category: "enrollment",
        title: "DSA Space not visible in My Spaces list",
        details: `Student appears not enrolled in DSA class. Visible spaces: ${spaceTitles.join(", ")}. NOTE: story points are still accessible via direct URL.`,
      });
      report.rawObservations.push(
        `DSA Space NOT found in spaces list. Student has ${spaceCount} spaces.`
      );
    }

    // Soft assertion — DSA space visibility depends on enrollment, not a hard failure
    expect(spaceCount).toBeGreaterThan(0); // Student should have at least some spaces
  });

  // ─── Test 3: DSA Space Viewer ─────────────────────────────────────────
  test("L3: DSA Space viewer shows story points", async ({ page }) => {
    await loginStudent(page);
    await page.goto(`${BASE_URL}/spaces/${DSA_SPACE_ID}`);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });

    const url = page.url();
    report.rawObservations.push(`DSA Space viewer URL: ${url}`);

    // Check h1
    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 10_000 }).catch(() => false);
    const h1Text = h1Visible ? await h1.textContent() : "";
    report.rawObservations.push(`Space viewer h1: "${h1Text}"`);

    if (h1Visible && h1Text && h1Text.length > 0) {
      report.workingFeatures.push(`L3: Space viewer h1 visible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "DSA-003",
        severity: "P1",
        category: "learning-flow",
        title: "Space viewer missing h1",
        details: `URL: ${url}`,
      });
    }

    // Check for story point list (chapters/sections)
    const storyPointLinks = page.locator(
      'a[href*="/story-points/"], a[href*="/practice/"], a[href*="/test/"]'
    );
    const storyPointCount = await storyPointLinks.count();
    report.rawObservations.push(`Story point links found: ${storyPointCount}`);

    if (storyPointCount >= 5) {
      report.workingFeatures.push(`L3: Space viewer shows ${storyPointCount} story point links`);
    } else if (storyPointCount > 0) {
      report.workingFeatures.push(
        `L3: Space viewer shows ${storyPointCount} story point links (partial)`
      );
      report.issues.push({
        id: "DSA-004",
        severity: "P2",
        category: "content",
        title: `Only ${storyPointCount} story points visible (expected 12)`,
        details: `DSA space should have 12 story points`,
      });
    } else {
      report.issues.push({
        id: "DSA-004",
        severity: "P1",
        category: "content",
        title: "No story point links found in DSA space viewer",
        details: `URL: ${url}`,
      });
    }

    // Check overall progress indicator
    const progressEl = page.locator('[class*="progress"], [role="progressbar"]').first();
    const progressVisible = await progressEl.isVisible({ timeout: 5_000 }).catch(() => false);
    if (progressVisible) {
      report.workingFeatures.push("L3: Progress indicator visible on space viewer");
    }

    // Soft assertion — space viewer may require enrollment; story points accessible via direct URL
    report.rawObservations.push(`L3 result: h1="${h1Text}", storyPointLinks=${storyPointCount}`);
    // Test passes regardless (we record observations)
  });

  // ─── Test 4: Arrays & Strings Material (standard) ────────────────────
  test("L4: Arrays & Strings - standard material viewer", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, DSA_SPACE_ID, DSA_STORY_POINTS.arrays);

    report.contentAssessment.storyPointsTested++;
    const url = page.url();
    report.rawObservations.push(`Arrays story point URL: ${url}`);

    // Check h1
    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Arrays h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L4: Arrays & Strings story point h1: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "DSA-005",
        severity: "P0",
        category: "learning-flow",
        title: "Arrays & Strings story point viewer: no h1",
        details: `URL: ${url}. Story Point Viewer may be broken (EVAL-C1-002).`,
      });
    }

    // Check for content items
    const items = page.locator(
      '[class*="item"], [class*="content-item"], [class*="question-card"], [class*="material-card"]'
    );
    const itemCount = await items.count();
    report.rawObservations.push(`Arrays content items found: ${itemCount}`);

    // Check for code blocks with syntax highlighting
    const codeBlocks = page.locator('pre code, [class*="language-"], [class*="code-block"]');
    const codeBlockCount = await codeBlocks.count();
    report.rawObservations.push(`Code blocks found: ${codeBlockCount}`);

    if (codeBlockCount > 0) {
      report.contentAssessment.codeBlocksRendered = true;
      report.workingFeatures.push(`L4: Code blocks rendered (${codeBlockCount} found)`);

      // Check for syntax highlighting (Prism/Shiki adds span elements inside code)
      const syntaxSpans = page.locator('pre code span, [class*="token"]');
      const spanCount = await syntaxSpans.count();
      if (spanCount > 0) {
        report.contentAssessment.syntaxHighlighting = true;
        report.workingFeatures.push(`L4: Syntax highlighting detected (${spanCount} token spans)`);
      } else {
        report.contentAssessment.contentQualityNotes.push(
          "Code blocks present but no syntax highlighting tokens detected"
        );
      }
    }

    // Check for Big-O notation (look for O( notation in text)
    const pageText = (await page.textContent("body")) || "";
    const hasBigO =
      pageText.includes("O(") || pageText.includes("O(n") || pageText.includes("O(log");
    if (hasBigO) {
      report.contentAssessment.bigONotationDisplayed = true;
      report.workingFeatures.push("L4: Big-O notation found in content");
    }

    // Check for material vs question rendering
    const materialTitle = page.locator("text=Concept, text=Example, text=Pattern").first();
    const hasMaterialContent = await materialTitle.isVisible({ timeout: 3_000 }).catch(() => false);
    report.rawObservations.push(`Arrays material content detected: ${hasMaterialContent}`);

    expect(h1Visible).toBeTruthy();
  });

  // ─── Test 5: Hash Maps Material ───────────────────────────────────────
  test("L5: Hash Maps & Sets - standard material viewer", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, DSA_SPACE_ID, DSA_STORY_POINTS.hashmaps);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Hash Maps h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L5: Hash Maps story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "DSA-006",
        severity: "P0",
        category: "learning-flow",
        title: "Hash Maps story point viewer: no h1",
        details: `URL: ${page.url()}`,
      });
    }

    // Look for navigation between items (prev/next buttons)
    const nextBtn = page
      .locator('button:has-text("Next"), button[aria-label*="next"], [data-testid*="next"]')
      .first();
    const prevBtn = page
      .locator('button:has-text("Previous"), button[aria-label*="prev"], [data-testid*="prev"]')
      .first();
    const nextVisible = await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    const prevVisible = await prevBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    report.rawObservations.push(`Hash Maps navigation: next=${nextVisible}, prev=${prevVisible}`);

    if (nextVisible || prevVisible) {
      report.workingFeatures.push("L5: Item navigation (prev/next) visible");
    }
  });

  // ─── Test 6: Linked Lists Material ────────────────────────────────────
  test("L6: Linked Lists & Stack/Queue - standard viewer", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, DSA_SPACE_ID, DSA_STORY_POINTS.linked);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L6: Linked Lists story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "DSA-007",
        severity: "P0",
        category: "learning-flow",
        title: "Linked Lists story point viewer: no h1",
        details: `URL: ${page.url()}`,
      });
    }

    // Check for copy button on code blocks
    const copyButtons = page.locator('button:has-text("Copy"), button[aria-label*="copy"]');
    const copyCount = await copyButtons.count();
    report.rawObservations.push(`Copy buttons found: ${copyCount}`);
    if (copyCount > 0) {
      report.workingFeatures.push(`L6: Copy buttons on code blocks (${copyCount} found)`);
    }

    // Check for language labels on code blocks
    const langLabels = page.locator('[class*="language-label"], [data-language]');
    const langCount = await langLabels.count();
    if (langCount > 0) {
      report.workingFeatures.push(`L6: Language labels on code blocks (${langCount} found)`);
    }
  });

  // ─── Test 7: Binary Trees Material ───────────────────────────────────
  test("L7: Binary Trees & BSTs - standard viewer", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, DSA_SPACE_ID, DSA_STORY_POINTS.trees);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L7: Binary Trees story point accessible: "${h1Text}"`);
    }

    report.rawObservations.push(`Trees h1: "${h1Text}"`);
  });

  // ─── Test 8: Practice Mode - Graphs BFS/DFS ──────────────────────────
  test("P1: Practice mode - Graphs BFS/DFS", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, DSA_SPACE_ID, DSA_STORY_POINTS.graphs);

    report.practiceMode.tested = true;
    report.contentAssessment.storyPointsTested++;

    const url = page.url();
    report.rawObservations.push(`Graphs practice URL: ${url}`);

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Graphs practice h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`P1: Graphs practice story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "DSA-008",
        severity: "P0",
        category: "practice-mode",
        title: "Graphs practice story point viewer: no h1 (Story Point Viewer bug)",
        details: `URL: ${url}`,
      });
    }

    // Check for submit button (practice mode) — Submit Answer is disabled until answer selected
    const submitBtn = page
      .locator('button:has-text("Submit Answer"), button:has-text("Submit")')
      .first();
    const submitVisible = await submitBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    const submitDisabled = submitVisible ? await submitBtn.isDisabled().catch(() => true) : true;
    report.rawObservations.push(
      `Submit button visible: ${submitVisible}, disabled: ${submitDisabled}`
    );

    if (submitVisible) {
      report.workingFeatures.push(
        `P1: Submit Answer button visible (disabled until answer selected: ${submitDisabled})`
      );
    }

    // Try to select an answer and submit
    const radioBtn = page
      .locator('input[type="radio"], button:has-text("True"), button:has-text("False")')
      .first();
    const radioVisible = await radioBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (radioVisible) {
      report.workingFeatures.push("P1: Answer options (radio/True/False) visible");
      await radioBtn.click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(500);

      // Check if submit is now enabled
      const submitEnabled = await submitBtn.isEnabled({ timeout: 3_000 }).catch(() => false);
      if (submitEnabled) {
        report.workingFeatures.push("P1: Submit Answer enabled after selecting answer");
        await submitBtn.click({ timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(2000);

        // Check for result feedback
        const feedbackEl = page
          .locator(
            '[class*="correct"], [class*="incorrect"], [class*="explanation"], text=/correct|incorrect|explanation/i'
          )
          .first();
        const feedbackVisible = await feedbackEl.isVisible({ timeout: 5_000 }).catch(() => false);
        if (feedbackVisible) {
          report.practiceMode.retryWorks = true;
          report.workingFeatures.push("P1: Answer feedback shown after submit");
        }

        // Check for Next button
        const nextBtn = page.locator('button:has-text("Next")').first();
        const nextVisible = await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false);
        if (nextVisible) {
          report.workingFeatures.push("P1: Next button visible after submit");
        }
      }
    }

    // Check for difficulty filter (combobox "All Levels")
    const diffFilter = page.locator('combobox, [role="combobox"], select').first();
    const diffVisible = await diffFilter.isVisible({ timeout: 5_000 }).catch(() => false);
    report.rawObservations.push(`Difficulty filter (combobox) visible: ${diffVisible}`);
    if (diffVisible) {
      report.practiceMode.difficultyFilterWorks = true;
      report.workingFeatures.push("P1: Difficulty/type filter (combobox) visible in practice mode");
    }

    // Check for section navigation
    const sectionNav = page.locator('[aria-label="breadcrumb"], nav button').first();
    const sectionNavVisible = await sectionNav.isVisible({ timeout: 3_000 }).catch(() => false);
    if (sectionNavVisible) {
      report.workingFeatures.push("P1: Section/breadcrumb navigation visible");
    }

    // Check for search input
    const searchInput = page
      .locator('input[placeholder*="Search"], input[placeholder*="search"]')
      .first();
    const searchVisible = await searchInput.isVisible({ timeout: 3_000 }).catch(() => false);
    if (searchVisible) {
      report.workingFeatures.push("P1: Search input visible in story point viewer");
    }

    // Check for Ask AI Tutor button
    const aiTutorBtn = page.locator('button:has-text("Ask AI Tutor")').first();
    const aiTutorVisible = await aiTutorBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (aiTutorVisible) {
      report.workingFeatures.push("P1: Ask AI Tutor button visible");
    }

    // Check for code blocks
    const codeBlocks = page.locator("pre code, code").first();
    const codeVisible = await codeBlocks.isVisible({ timeout: 3_000 }).catch(() => false);
    if (codeVisible) {
      report.contentAssessment.codeBlocksRendered = true;
      report.workingFeatures.push("P1: Code blocks visible in practice mode content");
    }
  });

  // ─── Test 9: Practice Mode - DP I ────────────────────────────────────
  test("P2: Practice mode - Dynamic Programming I", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, DSA_SPACE_ID, DSA_STORY_POINTS.dp1);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`DP I h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`P2: DP I practice story point accessible: "${h1Text}"`);

      // Check for hints
      const hintBtn = page
        .locator('button:has-text("Hint"), button:has-text("Show Hint"), [data-testid*="hint"]')
        .first();
      const hintVisible = await hintBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hintVisible) {
        report.workingFeatures.push("P2: Hint button visible in practice mode");
        await hintBtn.click();
        await page.waitForTimeout(1000);
        const hintContent = page.locator('[class*="hint"], [data-testid*="hint-content"]').first();
        const hintContentVisible = await hintContent
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        if (hintContentVisible) {
          report.workingFeatures.push("P2: Hint content displayed after click");
        }
      }

      // Check for solution view
      const solutionBtn = page
        .locator(
          'button:has-text("Solution"), button:has-text("Show Solution"), [data-testid*="solution"]'
        )
        .first();
      const solutionVisible = await solutionBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (solutionVisible) {
        report.workingFeatures.push("P2: Solution button visible in practice mode");
      }
    }
  });

  // ─── Test 10: Tries & Segment Trees ──────────────────────────────────
  test("L8: Tries & Segment Trees - standard viewer", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, DSA_SPACE_ID, DSA_STORY_POINTS.tries);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L8: Tries & Segment Trees accessible: "${h1Text}"`);
    }

    report.rawObservations.push(`Tries h1: "${h1Text}"`);

    // Check for section navigation
    const sectionNav = page
      .locator('[class*="section-nav"], [data-testid*="section"], nav[aria-label*="section"]')
      .first();
    const sectionNavVisible = await sectionNav.isVisible({ timeout: 5_000 }).catch(() => false);
    if (sectionNavVisible) {
      report.workingFeatures.push("L8: Section navigation visible");
    }

    // Check for search input
    const searchInput = page
      .locator('input[placeholder*="search" i], input[type="search"]')
      .first();
    const searchVisible = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (searchVisible) {
      report.workingFeatures.push("L8: Search input visible in story point viewer");
    } else {
      report.contentAssessment.contentQualityNotes.push(
        "No search input found in story point viewer"
      );
    }
  });

  // ─── Test 11: Quiz Mode ───────────────────────────────────────────────
  test("Q1: DSA Comprehensive Quiz", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, DSA_SPACE_ID, DSA_STORY_POINTS.quiz);

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
        id: "DSA-009",
        severity: "P0",
        category: "quiz",
        title: "DSA Quiz story point viewer: no h1",
        details: `URL: ${url}`,
      });
    }

    // Check for question types
    const mcqOption = page.locator('[type="radio"], input[type="radio"]').first();
    const mcqVisible = await mcqOption.isVisible({ timeout: 5_000 }).catch(() => false);
    if (mcqVisible) {
      report.quizMode.questionTypesFound.push("MCQ");
      report.workingFeatures.push("Q1: MCQ question type visible in quiz");
    }

    const checkboxOption = page.locator('[type="checkbox"]').first();
    const checkboxVisible = await checkboxOption.isVisible({ timeout: 3_000 }).catch(() => false);
    if (checkboxVisible) {
      report.quizMode.questionTypesFound.push("MCAQ");
      report.workingFeatures.push("Q1: MCAQ question type visible in quiz");
    }

    // Check for question count display
    const questionCounter = page
      .locator('[class*="question-count"], [class*="question-number"], text=/Question \d+ of \d+/')
      .first();
    const counterVisible = await questionCounter.isVisible({ timeout: 5_000 }).catch(() => false);
    if (counterVisible) {
      const counterText = (await questionCounter.textContent()) || "";
      report.workingFeatures.push(`Q1: Question counter visible: "${counterText}"`);
    }

    // Try submitting a question (if items loaded)
    if (mcqVisible) {
      await mcqOption.click();
      const submitBtn = page
        .locator('button:has-text("Submit"), button:has-text("Check"), button:has-text("Next")')
        .first();
      const submitVisible = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (submitVisible) {
        await submitBtn.click();
        await page.waitForTimeout(2000);

        // Check for result feedback
        const resultFeedback = page
          .locator(
            '[class*="correct"], [class*="incorrect"], [class*="feedback"], [class*="result"]'
          )
          .first();
        const feedbackVisible = await resultFeedback
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        if (feedbackVisible) {
          report.quizMode.resultsDisplayed = true;
          report.workingFeatures.push("Q1: Answer feedback shown after submit");
        }
      }
    }
  });

  // ─── Test 12: Timed Assessment ────────────────────────────────────────
  test("T1: DSA Staff-Level Timed Assessment", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, DSA_SPACE_ID, DSA_STORY_POINTS.timedTest);

    report.timedAssessment.tested = true;
    report.contentAssessment.storyPointsTested++;

    const url = page.url();
    report.rawObservations.push(`Timed test URL: ${url}`);

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Timed test h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`T1: Timed assessment page accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "DSA-010",
        severity: "P1",
        category: "timed-assessment",
        title: "DSA Timed Assessment: no h1 on landing page",
        details: `URL: ${url}`,
      });
    }

    // Check for timer display
    const timerEl = page
      .locator('[class*="timer"], [data-testid*="timer"], text=/\d+:\d+/')
      .first();
    const timerVisible = await timerEl.isVisible({ timeout: 5_000 }).catch(() => false);

    if (timerVisible) {
      report.timedAssessment.timerVisible = true;
      const timerText = (await timerEl.textContent()) || "";
      report.workingFeatures.push(`T1: Timer visible: "${timerText}"`);
    } else {
      report.timedAssessment.notes.push(
        "Timer not visible on landing page (may appear after starting test)"
      );
    }

    // Check for start test button
    const startBtn = page
      .locator('button:has-text("Start"), button:has-text("Begin"), button:has-text("Start Test")')
      .first();
    const startVisible = await startBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (startVisible) {
      report.workingFeatures.push("T1: Start Test button visible");
      report.rawObservations.push("Timed test has Start button");

      // Check test metadata (duration, question count)
      const pageText = (await page.textContent("body")) || "";
      const hasDuration = /\d+\s*(min|minutes?|hour)/i.test(pageText);
      const hasQuestionCount = /\d+\s*questions?/i.test(pageText);

      if (hasDuration) report.workingFeatures.push("T1: Test duration displayed");
      if (hasQuestionCount) report.workingFeatures.push("T1: Question count displayed");

      // Don't start the test (could exhaust attempts) — just verify landing page
      report.timedAssessment.notes.push(
        "Test landing page verified. Did not start test to preserve attempt count."
      );
    } else {
      // May show "max attempts reached" or similar
      const pageText = (await page.textContent("body")) || "";
      if (pageText.includes("attempt") || pageText.includes("Attempt")) {
        report.timedAssessment.notes.push("Timed test shows attempt-related message");
        report.rawObservations.push(`Timed test body snippet: ${pageText.substring(0, 300)}`);
      }
    }

    // Check for analytics/results section
    const analyticsEl = page
      .locator('[class*="analytics"], [class*="results"], [class*="score"]')
      .first();
    const analyticsVisible = await analyticsEl.isVisible({ timeout: 5_000 }).catch(() => false);
    if (analyticsVisible) {
      report.timedAssessment.analyticsShown = true;
      report.workingFeatures.push("T1: Analytics/results section visible");
    }
  });

  // ─── Test 13: Greedy & Backtracking Practice ──────────────────────────
  test("P3: Greedy & Backtracking practice mode", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, DSA_SPACE_ID, DSA_STORY_POINTS.greedy);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`P3: Greedy & Backtracking accessible: "${h1Text}"`);

      // Test progress persistence - check if completion marks exist
      const progressMark = page
        .locator('[class*="completed"], [class*="check"], svg[class*="check"]')
        .first();
      const progressVisible = await progressMark.isVisible({ timeout: 5_000 }).catch(() => false);
      if (progressVisible) {
        report.practiceMode.progressPersists = true;
        report.workingFeatures.push("P3: Progress completion marks visible");
      }
    }

    report.rawObservations.push(`Greedy h1: "${h1Text}"`);
  });

  // ─── Test 14: Content Quality Assessment ──────────────────────────────
  test("CQ1: Content quality - check Arrays & Strings in depth", async ({ page }) => {
    await loginStudent(page);
    await navigateToStoryPoint(page, DSA_SPACE_ID, DSA_STORY_POINTS.arrays);

    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });

    const h1Visible = await page
      .locator("h1")
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    if (h1Visible) {
      const bodyText = (await page.textContent("body")) || "";

      // Check for DSA-relevant content
      const dsaKeywords = [
        "array",
        "string",
        "two pointer",
        "sliding window",
        "complexity",
        "O(n",
        "O(log",
      ];
      const foundKeywords = dsaKeywords.filter((kw) =>
        bodyText.toLowerCase().includes(kw.toLowerCase())
      );
      report.rawObservations.push(`DSA keywords found: ${foundKeywords.join(", ")}`);

      if (foundKeywords.length >= 3) {
        report.contentAssessment.contentQualityNotes.push(
          `Arrays content contains DSA keywords: ${foundKeywords.join(", ")}`
        );
        report.workingFeatures.push(
          `CQ1: Arrays content has DSA-relevant terms (${foundKeywords.length}/${dsaKeywords.length})`
        );
      } else {
        report.issues.push({
          id: "DSA-011",
          severity: "P2",
          category: "content-quality",
          title: "Arrays content missing expected DSA keywords",
          details: `Only found ${foundKeywords.length}/${dsaKeywords.length} expected keywords: ${foundKeywords.join(", ")}`,
        });
      }

      // Check content depth
      const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 2).length;
      report.rawObservations.push(`Approximate word count on page: ${wordCount}`);

      if (wordCount > 500) {
        report.contentAssessment.contentQualityNotes.push(
          `Rich content: ~${wordCount} words on page`
        );
      } else if (wordCount < 100) {
        report.issues.push({
          id: "DSA-012",
          severity: "P2",
          category: "content-quality",
          title: "Sparse content on Arrays page",
          details: `Only ~${wordCount} words detected. Expected rich educational content.`,
        });
      }

      // Check for multiple items (materials + questions)
      const allItems = page.locator(
        '[class*="item-card"], [class*="content-card"], [class*="question"], [class*="material"]'
      );
      const itemCount = await allItems.count();
      report.rawObservations.push(`Content item cards: ${itemCount}`);

      if (itemCount >= 5) {
        report.workingFeatures.push(
          `CQ1: Rich content - ${itemCount} content items on Arrays page`
        );
      }
    }
  });

  // ─── Test 15: Navigation UX ───────────────────────────────────────────
  test("UX1: Navigation and UX assessment", async ({ page }) => {
    await loginStudent(page);

    // Test breadcrumb navigation from story point back to space
    await navigateToStoryPoint(page, DSA_SPACE_ID, DSA_STORY_POINTS.arrays);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });

    // Check breadcrumbs
    const breadcrumb = page
      .locator('[aria-label*="breadcrumb"], [class*="breadcrumb"], nav ol, nav[class*="bread"]')
      .first();
    const breadcrumbVisible = await breadcrumb.isVisible({ timeout: 5_000 }).catch(() => false);

    if (breadcrumbVisible) {
      report.workingFeatures.push("UX1: Breadcrumbs visible on story point page");
    } else {
      report.uxAssessment.uxIssues.push("Breadcrumbs not visible on story point viewer page");
    }

    // Check back to space navigation
    const backToSpaceLink = page
      .locator('a:has-text("Spaces"), a:has-text("Back"), a[href*="/spaces"]')
      .first();
    const backLinkVisible = await backToSpaceLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (backLinkVisible) {
      report.workingFeatures.push("UX1: Back/Spaces navigation link visible");
    }

    // Test mobile viewport responsiveness
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
      report.uxAssessment.uxIssues.push(
        "Story point viewer not responsive on mobile (h1 not visible at 375px)"
      );
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Test load time
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/spaces/${DSA_SPACE_ID}`);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
    const loadTime = Date.now() - startTime;
    report.rawObservations.push(`DSA Space viewer load time: ${loadTime}ms`);

    if (loadTime < 3000) {
      report.workingFeatures.push(`UX1: Fast load time (${loadTime}ms)`);
    } else if (loadTime > 5000) {
      report.uxAssessment.uxIssues.push(`Slow load time: ${loadTime}ms`);
      report.uxAssessment.loadTimesAcceptable = false;
    }
  });
});
