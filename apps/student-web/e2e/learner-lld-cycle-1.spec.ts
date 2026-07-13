/**
 * LLD Learner — Cycle 1
 * Simulates a student learning Low-Level Design & OOP from the portal.
 * Login: student.test@subhang.academy / Test@12345 / SUB001
 * Space: XTw3bLqiT4dMyvFJkI0g (Low-Level Design & OOP)
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ─── Credentials ────────────────────────────────────────────────────────────
const SCHOOL_CODE = "SUB001";
const EMAIL = "student.test@subhang.academy";
const PASSWORD = "Test@12345";
const BASE_URL = "http://localhost:4570";

// ─── LLD Space ──────────────────────────────────────────────────────────────
const LLD_SPACE_ID = "XTw3bLqiT4dMyvFJkI0g";
const LLD_STORY_POINTS = {
  oop: "efDEBIVVuI4GYultzGX8", // standard  - OOP Fundamentals & SOLID Principles
  creational: "FU3WlPIdwlvPAo8lB4kG", // standard  - Design Patterns — Creational
  structural: "NEeNBrzgEcBPFZmxjvPC", // standard  - Design Patterns — Structural
  behavioral: "Q75RccoNWATUD5WvZXWp", // standard  - Design Patterns — Behavioral
  cleanArch: "fhpTejczKkx7lpcy1y17", // standard  - Clean Architecture & Dependency Injection
  parkingLot: "LncPDG1zx9eYP6AUhnsp", // practice  - LLD — Parking Lot & Elevator System
  library: "gWTGQp396udInGK0M1zh", // practice  - LLD — Library Management & Hotel Booking
  socialMedia: "vhVqSDgrWJ8Oy9YGMUl7", // practice  - LLD — Social Media Feed & Notification System
  chess: "baOuwlRTx8gC1mY7MrQb", // practice  - LLD — Chess Game & Card Game Engine
  cqrs: "23j1kbrCu2XrzksO0icc", // standard  - CQRS, Event Sourcing & Domain-Driven Design
  quiz: "JF7qkA9jOQgMdNP3efFL", // quiz      - LLD Comprehensive Quiz
  timedTest: "U8zyZhJtJX8MzHmN3NC6", // timed_test - LLD Staff-Level Assessment
};

const REPORTS_DIR = "/Users/subhang/Desktop/Projects/auto-levleup/tests/e2e/reports";
const AUTH_STATE_FILE = path.join(os.tmpdir(), "lld-learner-auth.json");

// ─── Report Structure ────────────────────────────────────────────────────────
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
    umlDiagramsFound: boolean;
    codeBlocksRendered: boolean;
    multiLanguageExamples: boolean;
    longFormAnswerInput: boolean;
    characterLimitVisible: boolean;
    aiFeedbackShown: boolean;
    syntaxHighlighting: boolean;
    contentQualityNotes: string[];
  };
  uxAssessment: {
    navigationWorking: boolean;
    loadTimesAcceptable: boolean;
    mobileResponsive: boolean;
    breadcrumbsVisible: boolean;
    sectionFilterWorks: boolean;
    uxIssues: string[];
  };
  practiceMode: {
    tested: boolean;
    designScenarioLoads: boolean;
    longFormAnswerWorks: boolean;
    retryWorks: boolean;
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
  learner: "LLD Learner (tm_1773067959781_vgloe0tc9)",
  space: "Low-Level Design & OOP",
  loginStatus: "pending",
  workingFeatures: [],
  issues: [],
  contentAssessment: {
    storyPointsTested: 0,
    storyPointsAccessible: 0,
    umlDiagramsFound: false,
    codeBlocksRendered: false,
    multiLanguageExamples: false,
    longFormAnswerInput: false,
    characterLimitVisible: false,
    aiFeedbackShown: false,
    syntaxHighlighting: false,
    contentQualityNotes: [],
  },
  uxAssessment: {
    navigationWorking: false,
    loadTimesAcceptable: true,
    mobileResponsive: false,
    breadcrumbsVisible: false,
    sectionFilterWorks: false,
    uxIssues: [],
  },
  practiceMode: {
    tested: false,
    designScenarioLoads: false,
    longFormAnswerWorks: false,
    retryWorks: false,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    return false;
  }
}

async function ensureLoggedIn(page: Page): Promise<void> {
  if (fs.existsSync(AUTH_STATE_FILE)) {
    await page.goto("/");
    await page.waitForTimeout(1500);
    if (page.url().includes("/login")) {
      await doLogin(page);
    }
  } else {
    await doLogin(page);
  }
}

async function navigateToStoryPoint(
  page: Page,
  spaceId: string,
  storyPointId: string
): Promise<void> {
  await page.goto(`${BASE_URL}/spaces/${spaceId}/story/${storyPointId}`);
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
  await page.waitForTimeout(2000);
}

function saveReport(): void {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, "learner-lld-cycle-1.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report saved: ${reportPath}`);
}

// ─── Timeout ─────────────────────────────────────────────────────────────────
test.setTimeout(120_000);

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe("LLD Learner — Cycle 1", () => {
  // Save auth state once for all tests
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
      await page.waitForFunction(() => !window.location.href.includes("/login"), {
        timeout: 35_000,
      });
      await ctx.storageState({ path: AUTH_STATE_FILE });
      report.rawObservations.push("Auth state saved successfully");
    } catch (e) {
      report.rawObservations.push(`beforeAll login error: ${e}`);
    } finally {
      await ctx.close();
    }
  });

  test.afterAll(() => {
    const workingCount = report.workingFeatures.length;
    const p0 = report.issues.filter((i) => i.severity === "P0").length;
    const p1 = report.issues.filter((i) => i.severity === "P1").length;

    let score = 5;
    score += Math.min(workingCount * 0.3, 3);
    score -= p0 * 1.5;
    score -= p1 * 0.75;
    score = Math.max(1, Math.min(10, score));

    report.learningEffectiveness = {
      score: Math.round(score * 10) / 10,
      notes: `${workingCount} working features, ${report.issues.length} total issues (${p0} P0, ${p1} P1). Accessible: ${report.contentAssessment.storyPointsAccessible}/${report.contentAssessment.storyPointsTested} story points.`,
    };

    saveReport();
  });

  // ─── L1: Login ────────────────────────────────────────────────────────
  test("L1: Login as student with school code", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    const schoolCodeInput = page.locator("#schoolCode");
    await expect(schoolCodeInput).toBeVisible({ timeout: 10_000 });
    await schoolCodeInput.fill(SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForSelector("#credential", { timeout: 15_000 });
    report.rawObservations.push("School code accepted, credential form shown");

    const emailTab = page.getByRole("tab", { name: "Email" });
    if (await emailTab.isVisible().catch(() => false)) {
      await emailTab.click();
      report.rawObservations.push("Email tab clicked");
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
      report.rawObservations.push(`Login succeeded. URL: ${page.url()}`);
    } catch {
      const errorEl = page.locator('[class*="destructive"], [role="alert"]').first();
      const errorText = await errorEl.textContent().catch(() => "no error shown");
      report.loginStatus = "failed";
      report.issues.push({
        id: "LLD-001",
        severity: "P0",
        category: "authentication",
        title: "Login failed — did not leave /login within 35s",
        details: `URL: ${page.url()}, error: ${errorText}`,
      });
    }

    expect(report.loginStatus).toBe("success");
  });

  // ─── L2: Spaces list — find LLD space ─────────────────────────────────
  test("L2: Navigate to spaces list and find LLD space", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto(`${BASE_URL}/spaces`);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });

    report.rawObservations.push(`Spaces page URL: ${page.url()}`);

    const lldCard = page.locator("text=Low-Level Design").first();
    const lldVisible = await lldCard.isVisible({ timeout: 10_000 }).catch(() => false);

    if (lldVisible) {
      report.workingFeatures.push("L2: LLD space card visible in spaces list");
      report.uxAssessment.navigationWorking = true;
      await lldCard.click();
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 });
      const url = page.url();
      report.rawObservations.push(`After clicking LLD card: ${url}`);
      if (url.includes(LLD_SPACE_ID)) {
        report.workingFeatures.push("L2: LLD card click navigates to correct space URL");
      }
    } else {
      report.issues.push({
        id: "LLD-002",
        severity: "P1",
        category: "navigation",
        title: "LLD space not visible in spaces list",
        details: 'Cannot find "Low-Level Design" card on /spaces page',
      });
    }

    expect(lldVisible).toBeTruthy();
  });

  // ─── L3: Space viewer — story point list ──────────────────────────────
  test("L3: LLD space viewer shows story points", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto(`${BASE_URL}/spaces/${LLD_SPACE_ID}`);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
    await page.waitForTimeout(2000);

    const url = page.url();
    report.rawObservations.push(`LLD Space viewer URL: ${url}`);

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 10_000 }).catch(() => false);
    const h1Text = h1Visible ? await h1.textContent() : "";
    report.rawObservations.push(`Space h1: "${h1Text}"`);

    if (h1Visible && h1Text) {
      report.workingFeatures.push(`L3: Space viewer h1 visible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "LLD-003",
        severity: "P1",
        category: "learning-flow",
        title: "LLD space viewer: no h1",
        details: `URL: ${url}`,
      });
    }

    const storyPointLinks = page.locator('a[href*="/story/"]');
    const linkCount = await storyPointLinks.count();
    report.rawObservations.push(`Story point links found: ${linkCount}`);

    if (linkCount >= 10) {
      report.workingFeatures.push(`L3: Space viewer shows ${linkCount} story point links`);
    } else if (linkCount > 0) {
      report.workingFeatures.push(
        `L3: Space viewer shows ${linkCount} story point links (partial, expected 12)`
      );
      report.issues.push({
        id: "LLD-004",
        severity: "P2",
        category: "content",
        title: `Only ${linkCount}/12 story points visible`,
        details: `LLD space should have 12 story points`,
      });
    } else {
      report.issues.push({
        id: "LLD-004",
        severity: "P1",
        category: "content",
        title: "No story point links in LLD space viewer",
        details: `URL: ${url}`,
      });
    }

    // Check section filter (e.g., "Standard", "Practice", "Quiz")
    const filterBtns = page.locator(
      'button:has-text("Standard"), button:has-text("Practice"), button:has-text("Quiz"), button:has-text("All")'
    );
    const filterCount = await filterBtns.count();
    if (filterCount > 0) {
      report.uxAssessment.sectionFilterWorks = true;
      report.workingFeatures.push(`L3: Section filter buttons visible (${filterCount})`);
    }

    // Progress indicator
    const progressEl = page.locator('[class*="progress"], [role="progressbar"]').first();
    const progressVisible = await progressEl.isVisible({ timeout: 5_000 }).catch(() => false);
    if (progressVisible) {
      report.workingFeatures.push("L3: Progress indicator visible on space viewer");
    }

    expect(h1Visible).toBeTruthy();
  });

  // ─── L4: OOP Fundamentals & SOLID Principles ──────────────────────────
  test("L4: OOP Fundamentals & SOLID Principles — standard viewer", async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToStoryPoint(page, LLD_SPACE_ID, LLD_STORY_POINTS.oop);

    report.contentAssessment.storyPointsTested++;
    const url = page.url();
    report.rawObservations.push(`OOP story point URL: ${url}`);

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`OOP h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L4: OOP story point h1: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "LLD-005",
        severity: "P0",
        category: "learning-flow",
        title: "OOP Fundamentals story point: no h1",
        details: `URL: ${url}`,
      });
    }

    const bodyText = (await page.textContent("body")) || "";

    // Check for OOP keywords
    const oopKeywords = [
      "encapsulation",
      "inheritance",
      "polymorphism",
      "abstraction",
      "SOLID",
      "interface",
      "class",
    ];
    const foundKeywords = oopKeywords.filter((k) =>
      bodyText.toLowerCase().includes(k.toLowerCase())
    );
    report.rawObservations.push(`OOP keywords found: ${foundKeywords.join(", ")}`);

    if (foundKeywords.length >= 3) {
      report.contentAssessment.contentQualityNotes.push(
        `OOP content has keywords: ${foundKeywords.join(", ")}`
      );
      report.workingFeatures.push(
        `L4: OOP content quality good (${foundKeywords.length}/${oopKeywords.length} keywords)`
      );
    } else {
      report.issues.push({
        id: "LLD-006",
        severity: "P2",
        category: "content-quality",
        title: "OOP content missing expected keywords",
        details: `Found ${foundKeywords.length}/${oopKeywords.length}: ${foundKeywords.join(", ")}`,
      });
    }

    // Check for UML/class diagram text representations
    const umlPatterns = ["class diagram", "UML", "```", "┌", "─", "│", "└", "+---", "|---"];
    const hasUml = umlPatterns.some((p) => bodyText.includes(p));
    if (hasUml) {
      report.contentAssessment.umlDiagramsFound = true;
      report.workingFeatures.push("L4: UML/class diagram representation found in OOP content");
    } else {
      report.contentAssessment.contentQualityNotes.push(
        "No UML diagram representation detected in OOP content"
      );
    }

    // Check for code blocks
    const codeBlocks = page.locator('pre code, [class*="language-"], [class*="code-block"]');
    const codeCount = await codeBlocks.count();
    report.rawObservations.push(`Code blocks: ${codeCount}`);
    if (codeCount > 0) {
      report.contentAssessment.codeBlocksRendered = true;
      report.workingFeatures.push(`L4: Code blocks rendered (${codeCount})`);
      // Syntax highlighting
      const tokens = page.locator('pre code span, [class*="token"]');
      if ((await tokens.count()) > 0) {
        report.contentAssessment.syntaxHighlighting = true;
        report.workingFeatures.push("L4: Syntax highlighting detected");
      }
    }

    // Multi-language examples
    const langLabels = page.locator(
      '[class*="language-java"], [class*="language-python"], [class*="language-typescript"], [class*="lang-"]'
    );
    const langCount = await langLabels.count();
    if (langCount >= 2) {
      report.contentAssessment.multiLanguageExamples = true;
      report.workingFeatures.push(
        `L4: Multi-language code examples (${langCount} language blocks)`
      );
    }

    expect(h1Visible).toBeTruthy();
  });

  // ─── L5: Creational Design Patterns ───────────────────────────────────
  test("L5: Creational Design Patterns — standard viewer", async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToStoryPoint(page, LLD_SPACE_ID, LLD_STORY_POINTS.creational);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Creational h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L5: Creational Patterns story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "LLD-007",
        severity: "P0",
        category: "learning-flow",
        title: "Creational Patterns story point: no h1",
        details: `URL: ${page.url()}`,
      });
    }

    const bodyText = (await page.textContent("body")) || "";
    const creationalKeywords = ["Singleton", "Factory", "Builder", "Prototype", "Abstract Factory"];
    const found = creationalKeywords.filter((k) => bodyText.includes(k));
    report.rawObservations.push(`Creational keywords: ${found.join(", ")}`);

    if (found.length >= 2) {
      report.workingFeatures.push(
        `L5: Creational patterns content quality (${found.length}/5 patterns: ${found.join(", ")})`
      );
    } else {
      report.issues.push({
        id: "LLD-008",
        severity: "P2",
        category: "content-quality",
        title: "Creational patterns content sparse",
        details: `Only ${found.length}/5 creational patterns found: ${found.join(", ")}`,
      });
    }

    // Check prev/next navigation
    const nextBtn = page.locator('button:has-text("Next"), button[aria-label*="next"]').first();
    const prevBtn = page.locator('button:has-text("Previous"), button[aria-label*="prev"]').first();
    const hasNav =
      (await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false)) ||
      (await prevBtn.isVisible({ timeout: 5_000 }).catch(() => false));
    if (hasNav) {
      report.workingFeatures.push("L5: Item navigation (prev/next) visible");
    }
  });

  // ─── L6: Structural Design Patterns ───────────────────────────────────
  test("L6: Structural Design Patterns — standard viewer", async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToStoryPoint(page, LLD_SPACE_ID, LLD_STORY_POINTS.structural);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L6: Structural Patterns story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "LLD-009",
        severity: "P0",
        category: "learning-flow",
        title: "Structural Patterns story point: no h1",
        details: `URL: ${page.url()}`,
      });
    }

    const bodyText = (await page.textContent("body")) || "";
    const structuralKeywords = [
      "Adapter",
      "Decorator",
      "Facade",
      "Proxy",
      "Composite",
      "Bridge",
      "Flyweight",
    ];
    const found = structuralKeywords.filter((k) => bodyText.includes(k));
    report.rawObservations.push(`Structural keywords: ${found.join(", ")}`);

    if (found.length >= 2) {
      report.workingFeatures.push(
        `L6: Structural patterns content (${found.length}/7: ${found.join(", ")})`
      );
    } else {
      report.issues.push({
        id: "LLD-010",
        severity: "P2",
        category: "content-quality",
        title: "Structural patterns content sparse",
        details: `Only ${found.length}/7 structural patterns found`,
      });
    }

    // Copy buttons
    const copyBtns = page.locator('button:has-text("Copy"), button[aria-label*="copy"]');
    const copyCount = await copyBtns.count();
    if (copyCount > 0) {
      report.workingFeatures.push(`L6: Copy buttons on code blocks (${copyCount})`);
    }

    report.rawObservations.push(`Structural h1: "${h1Text}"`);
  });

  // ─── L7: Behavioral Design Patterns ───────────────────────────────────
  test("L7: Behavioral Design Patterns — standard viewer", async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToStoryPoint(page, LLD_SPACE_ID, LLD_STORY_POINTS.behavioral);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L7: Behavioral Patterns story point accessible: "${h1Text}"`);
    }

    const bodyText = (await page.textContent("body")) || "";
    const behavioralKeywords = [
      "Observer",
      "Strategy",
      "Command",
      "Iterator",
      "State",
      "Template Method",
      "Chain of Responsibility",
    ];
    const found = behavioralKeywords.filter((k) => bodyText.includes(k));
    report.rawObservations.push(`Behavioral keywords: ${found.join(", ")}, h1: "${h1Text}"`);

    if (found.length >= 2) {
      report.workingFeatures.push(
        `L7: Behavioral patterns content (${found.length}/7: ${found.join(", ")})`
      );
    }
  });

  // ─── L8: Clean Architecture & Dependency Injection ────────────────────
  test("L8: Clean Architecture & Dependency Injection", async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToStoryPoint(page, LLD_SPACE_ID, LLD_STORY_POINTS.cleanArch);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L8: Clean Architecture story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "LLD-011",
        severity: "P1",
        category: "learning-flow",
        title: "Clean Architecture story point: no h1",
        details: `URL: ${page.url()}`,
      });
    }

    report.rawObservations.push(`Clean Arch h1: "${h1Text}"`);

    const bodyText = (await page.textContent("body")) || "";
    const archKeywords = [
      "dependency injection",
      "clean architecture",
      "hexagonal",
      "ports",
      "adapters",
      "use case",
      "repository",
    ];
    const found = archKeywords.filter((k) => bodyText.toLowerCase().includes(k.toLowerCase()));
    if (found.length >= 2) {
      report.workingFeatures.push(
        `L8: Clean Architecture content quality (${found.length}/7 keywords)`
      );
    }

    // Search input
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

  // ─── P1: Practice — Parking Lot & Elevator System ─────────────────────
  test("P1: LLD Practice — Parking Lot & Elevator System", async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToStoryPoint(page, LLD_SPACE_ID, LLD_STORY_POINTS.parkingLot);

    report.practiceMode.tested = true;
    report.contentAssessment.storyPointsTested++;

    const url = page.url();
    report.rawObservations.push(`Parking Lot URL: ${url}`);

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Parking Lot h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.practiceMode.designScenarioLoads = true;
      report.workingFeatures.push(`P1: Parking Lot scenario loads: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "LLD-012",
        severity: "P0",
        category: "practice-mode",
        title: "Parking Lot practice story point: no h1",
        details: `URL: ${url}`,
      });
    }

    // Check for design scenario description
    const bodyText = (await page.textContent("body")) || "";
    const designTerms = ["parking", "spot", "vehicle", "floor", "ticket", "capacity"];
    const foundTerms = designTerms.filter((t) => bodyText.toLowerCase().includes(t));
    report.rawObservations.push(`Design scenario terms: ${foundTerms.join(", ")}`);
    if (foundTerms.length >= 2) {
      report.workingFeatures.push(
        `P1: Parking Lot scenario has design context (${foundTerms.join(", ")})`
      );
    }

    // Check for long-form answer input (textarea)
    const textarea = page.locator("textarea").first();
    const textareaVisible = await textarea.isVisible({ timeout: 5_000 }).catch(() => false);
    report.rawObservations.push(`Textarea visible: ${textareaVisible}`);

    if (textareaVisible) {
      report.contentAssessment.longFormAnswerInput = true;
      report.practiceMode.longFormAnswerWorks = true;
      report.workingFeatures.push("P1: Long-form answer textarea visible");

      // Check character limit indicator
      const charLimit = page
        .locator('[class*="char"], [class*="count"], text=/\d+\s*\/\s*\d+/')
        .first();
      const charLimitVisible = await charLimit.isVisible({ timeout: 3_000 }).catch(() => false);
      if (charLimitVisible) {
        report.contentAssessment.characterLimitVisible = true;
        const charText = (await charLimit.textContent()) || "";
        report.workingFeatures.push(`P1: Character limit indicator visible: "${charText}"`);
      }

      // Try submitting a design answer
      await textarea.fill(
        "The Parking Lot system has a ParkingLot class that manages multiple floors. Each ParkingFloor has spots. ParkingSpot types: Compact, Large, Handicapped. Entry/Exit points issue tickets. Pricing strategy uses Strategy pattern."
      );
      await page.waitForTimeout(500);

      const submitBtn = page
        .locator('button:has-text("Submit"), button[type="submit"]:not(:has-text("Sign"))')
        .first();
      const submitVisible = await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (submitVisible) {
        await submitBtn.click();
        await page.waitForTimeout(3000);

        // Check for AI feedback
        const aiFeedback = page
          .locator('[class*="feedback"], [class*="ai"], [class*="evaluation"], [class*="result"]')
          .first();
        const feedbackVisible = await aiFeedback.isVisible({ timeout: 8_000 }).catch(() => false);
        if (feedbackVisible) {
          report.contentAssessment.aiFeedbackShown = true;
          const feedbackText = ((await aiFeedback.textContent()) || "").substring(0, 200);
          report.workingFeatures.push(`P1: AI evaluation feedback shown: "${feedbackText}"`);
        } else {
          report.practiceMode.notes.push("AI feedback not shown within 8s after submit");
          report.issues.push({
            id: "LLD-013",
            severity: "P1",
            category: "practice-mode",
            title: "AI evaluation feedback not shown after design answer submit",
            details: "Submitted a parking lot design answer; no feedback visible within 8s",
          });
        }

        // Check for retry
        const retryBtn = page
          .locator(
            'button:has-text("Try Again"), button:has-text("Retry"), button:has-text("Next")'
          )
          .first();
        if (await retryBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          report.practiceMode.retryWorks = true;
          report.workingFeatures.push("P1: Retry/Next available after design submit");
        }
      }
    } else {
      // Maybe MCQ-style questions for this scenario
      const mcqOption = page.locator('[type="radio"], input[type="radio"]').first();
      const mcqVisible = await mcqOption.isVisible({ timeout: 5_000 }).catch(() => false);
      if (mcqVisible) {
        report.workingFeatures.push("P1: MCQ questions visible in design practice");
      } else {
        report.issues.push({
          id: "LLD-014",
          severity: "P1",
          category: "practice-mode",
          title: "No answer input found in Parking Lot practice",
          details: "Neither textarea nor MCQ options visible",
        });
      }
    }
  });

  // ─── P2: Practice — Library Management ────────────────────────────────
  test("P2: LLD Practice — Library Management & Hotel Booking", async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToStoryPoint(page, LLD_SPACE_ID, LLD_STORY_POINTS.library);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Library h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`P2: Library Management story point loads: "${h1Text}"`);

      // Check design scenario completeness
      const bodyText = (await page.textContent("body")) || "";
      const libraryTerms = ["book", "member", "catalog", "checkout", "return", "reservation"];
      const found = libraryTerms.filter((t) => bodyText.toLowerCase().includes(t));
      if (found.length >= 2) {
        report.workingFeatures.push(
          `P2: Library scenario has design context (${found.join(", ")})`
        );
      }

      // Check progress marks (did we complete previous items?)
      const completedMarks = page.locator(
        '[class*="completed"], svg[class*="check"], [data-testid*="completed"]'
      );
      const marksCount = await completedMarks.count();
      if (marksCount > 0) {
        report.practiceMode.progressPersists = true;
        report.workingFeatures.push(`P2: Progress marks visible (${marksCount} completed items)`);
      }
    }
  });

  // ─── P3: Practice — Chess Game ────────────────────────────────────────
  test("P3: LLD Practice — Chess Game & Card Game Engine", async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToStoryPoint(page, LLD_SPACE_ID, LLD_STORY_POINTS.chess);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`Chess h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`P3: Chess Game story point loads: "${h1Text}"`);
    }

    // Chess design completeness check
    const bodyText = (await page.textContent("body")) || "";
    const chessTerms = ["piece", "board", "move", "player", "king", "queen", "check"];
    const found = chessTerms.filter((t) => bodyText.toLowerCase().includes(t));
    if (found.length >= 2) {
      report.workingFeatures.push(`P3: Chess scenario design context good (${found.join(", ")})`);
    }
  });

  // ─── L9: CQRS, Event Sourcing & DDD ───────────────────────────────────
  test("L9: CQRS, Event Sourcing & Domain-Driven Design", async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToStoryPoint(page, LLD_SPACE_ID, LLD_STORY_POINTS.cqrs);

    report.contentAssessment.storyPointsTested++;

    const h1 = page.locator("h1").first();
    const h1Visible = await h1.isVisible({ timeout: 15_000 }).catch(() => false);
    const h1Text = h1Visible ? (await h1.textContent()) || "" : "";
    report.rawObservations.push(`CQRS h1: "${h1Text}"`);

    if (h1Visible && h1Text.length > 0) {
      report.contentAssessment.storyPointsAccessible++;
      report.workingFeatures.push(`L9: CQRS/DDD story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "LLD-015",
        severity: "P1",
        category: "learning-flow",
        title: "CQRS/DDD story point: no h1",
        details: `URL: ${page.url()}`,
      });
    }

    const bodyText = (await page.textContent("body")) || "";
    const cqrsKeywords = [
      "CQRS",
      "command",
      "query",
      "event sourcing",
      "aggregate",
      "domain",
      "bounded context",
    ];
    const found = cqrsKeywords.filter((k) => bodyText.toLowerCase().includes(k.toLowerCase()));
    report.rawObservations.push(`CQRS keywords: ${found.join(", ")}`);

    if (found.length >= 3) {
      report.workingFeatures.push(`L9: CQRS/DDD content quality (${found.length}/7 keywords)`);
    } else {
      report.issues.push({
        id: "LLD-016",
        severity: "P2",
        category: "content-quality",
        title: "CQRS/DDD content sparse or missing",
        details: `Only ${found.length}/7 keywords: ${found.join(", ")}`,
      });
    }
  });

  // ─── Q1: LLD Comprehensive Quiz ───────────────────────────────────────
  test("Q1: LLD Comprehensive Quiz", async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToStoryPoint(page, LLD_SPACE_ID, LLD_STORY_POINTS.quiz);

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
      report.workingFeatures.push(`Q1: LLD Quiz story point accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "LLD-017",
        severity: "P0",
        category: "quiz",
        title: "LLD Quiz story point: no h1",
        details: `URL: ${url}`,
      });
    }

    // MCQ questions
    const mcq = page.locator('input[type="radio"]').first();
    const mcqVisible = await mcq.isVisible({ timeout: 5_000 }).catch(() => false);
    if (mcqVisible) {
      report.quizMode.questionTypesFound.push("MCQ");
      report.workingFeatures.push("Q1: MCQ questions visible in LLD quiz");
    }

    // Checkbox (MCAQ)
    const mcaq = page.locator('input[type="checkbox"]').first();
    const mcaqVisible = await mcaq.isVisible({ timeout: 3_000 }).catch(() => false);
    if (mcaqVisible) {
      report.quizMode.questionTypesFound.push("MCAQ");
      report.workingFeatures.push("Q1: MCAQ questions visible in LLD quiz");
    }

    // Textarea (long-form in quiz)
    const textareaInQuiz = page.locator("textarea").first();
    const textareaVisible = await textareaInQuiz.isVisible({ timeout: 3_000 }).catch(() => false);
    if (textareaVisible) {
      report.quizMode.questionTypesFound.push("LongForm");
      report.workingFeatures.push("Q1: Long-form answer questions in LLD quiz");
    }

    // Question counter
    const counter = page.locator("text=/Question \\d+ of \\d+/").first();
    if (await counter.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const counterText = (await counter.textContent()) || "";
      report.workingFeatures.push(`Q1: Question counter: "${counterText}"`);
    }

    // Try submitting
    if (mcqVisible) {
      await mcq.click();
      const submitBtn = page
        .locator('button:has-text("Submit"), button:has-text("Check"), button:has-text("Next")')
        .first();
      if (await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
        const feedback = page
          .locator('[class*="correct"], [class*="incorrect"], [class*="feedback"]')
          .first();
        if (await feedback.isVisible({ timeout: 5_000 }).catch(() => false)) {
          report.quizMode.resultsDisplayed = true;
          report.workingFeatures.push("Q1: Answer feedback shown after submit");
        }
      }
    }
  });

  // ─── T1: LLD Staff-Level Timed Assessment ─────────────────────────────
  test("T1: LLD Staff-Level Timed Assessment", async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToStoryPoint(page, LLD_SPACE_ID, LLD_STORY_POINTS.timedTest);

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
      report.workingFeatures.push(`T1: Timed Assessment page accessible: "${h1Text}"`);
    } else {
      report.issues.push({
        id: "LLD-018",
        severity: "P1",
        category: "timed-assessment",
        title: "LLD Timed Assessment: no h1 on landing",
        details: `URL: ${url}`,
      });
    }

    // Timer
    const timerEl = page
      .locator('[class*="timer"], [data-testid*="timer"], text=/\\d+:\\d+/')
      .first();
    if (await timerEl.isVisible({ timeout: 5_000 }).catch(() => false)) {
      report.timedAssessment.timerVisible = true;
      const timerText = (await timerEl.textContent()) || "";
      report.workingFeatures.push(`T1: Timer visible: "${timerText}"`);
    } else {
      report.timedAssessment.notes.push("Timer not visible (may appear after starting test)");
    }

    // Start button
    const startBtn = page
      .locator('button:has-text("Start"), button:has-text("Begin"), button:has-text("Start Test")')
      .first();
    if (await startBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      report.workingFeatures.push("T1: Start Test button visible");
      const bodyText = (await page.textContent("body")) || "";
      if (/\d+\s*(min|minutes?|hour)/i.test(bodyText))
        report.workingFeatures.push("T1: Test duration displayed");
      if (/\d+\s*questions?/i.test(bodyText))
        report.workingFeatures.push("T1: Question count displayed");
      report.timedAssessment.notes.push(
        "Test landing page verified. Did not start to preserve attempt count."
      );
    } else {
      const bodyText = (await page.textContent("body")) || "";
      if (bodyText.includes("attempt") || bodyText.includes("Attempt")) {
        report.timedAssessment.notes.push("Timed test shows attempt-related message");
      }
    }

    // Analytics / results
    const analyticsEl = page
      .locator('[class*="analytics"], [class*="results"], [class*="score"]')
      .first();
    if (await analyticsEl.isVisible({ timeout: 5_000 }).catch(() => false)) {
      report.timedAssessment.analyticsShown = true;
      report.workingFeatures.push("T1: Analytics/results section visible");
    }
  });

  // ─── UX1: Navigation & UX ─────────────────────────────────────────────
  test("UX1: Navigation flow and UX assessment", async ({ page }) => {
    await ensureLoggedIn(page);
    await navigateToStoryPoint(page, LLD_SPACE_ID, LLD_STORY_POINTS.oop);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });

    // Breadcrumbs
    const breadcrumb = page
      .locator('[aria-label*="breadcrumb"], [class*="breadcrumb"], nav ol')
      .first();
    const breadcrumbVisible = await breadcrumb.isVisible({ timeout: 5_000 }).catch(() => false);
    if (breadcrumbVisible) {
      report.uxAssessment.breadcrumbsVisible = true;
      report.workingFeatures.push("UX1: Breadcrumbs visible on story point page");
    } else {
      report.uxAssessment.uxIssues.push("Breadcrumbs not visible on story point page");
    }

    // Back link
    const backLink = page
      .locator('a:has-text("Spaces"), a:has-text("Back"), a[href*="/spaces"]')
      .first();
    if (await backLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      report.workingFeatures.push("UX1: Back/Spaces navigation link visible");
    }

    // Mobile responsiveness
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
    await page.setViewportSize({ width: 1280, height: 720 });

    // Load time
    const t0 = Date.now();
    await page.goto(`${BASE_URL}/spaces/${LLD_SPACE_ID}`);
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
    const loadTime = Date.now() - t0;
    report.rawObservations.push(`LLD space viewer load time: ${loadTime}ms`);

    if (loadTime < 3000) {
      report.workingFeatures.push(`UX1: Fast load time (${loadTime}ms)`);
    } else if (loadTime > 5000) {
      report.uxAssessment.uxIssues.push(`Slow load time: ${loadTime}ms`);
      report.uxAssessment.loadTimesAcceptable = false;
    }
  });
});
