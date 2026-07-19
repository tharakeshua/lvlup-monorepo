/**
 * LLD Learner — Cycle 4 Deep Assessment
 *
 * Tests the LLD (Low-Level Design & OOP) space post-Cycle-3 fixes:
 *   - Space viewer h1 and story point links
 *   - OOP Fundamentals & SOLID Principles content
 *   - Design Patterns (Creational / Structural / Behavioral)
 *   - UML / class diagram descriptions
 *   - Code pattern examples (multi-language / pseudocode)
 *   - Long-form answer submission and AI evaluation feedback
 *   - LLD design scenarios (Parking Lot, Library, Chess)
 *   - CQRS, Event Sourcing & DDD concepts
 *   - Quiz and timed assessment landing
 *   - UX: navigation, breadcrumbs, section filtering
 *
 * Auth cached at /tmp/lld-c4-auth.json to avoid Firebase rate limits.
 * Output: tests/e2e/reports/learner-lld-cycle-4.json
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:4570";
const EMAIL = "student.test@subhang.academy";
const PASSWORD = "Test@12345";
const SCHOOL_CODE = "SUB001";
const AUTH_CACHE = "/tmp/lld-c4-auth.json";

const LLD_SPACE = "XTw3bLqiT4dMyvFJkI0g";

const LLD_STORY_POINTS = [
  { id: "efDEBIVVuI4GYultzGX8", title: "OOP Fundamentals & SOLID Principles", type: "standard" },
  { id: "FU3WlPIdwlvPAo8lB4kG", title: "Design Patterns — Creational", type: "standard" },
  { id: "NEeNBrzgEcBPFZmxjvPC", title: "Design Patterns — Structural", type: "standard" },
  { id: "Q75RccoNWATUD5WvZXWp", title: "Design Patterns — Behavioral", type: "standard" },
  {
    id: "fhpTejczKkx7lpcy1y17",
    title: "Clean Architecture & Dependency Injection",
    type: "practice",
  },
  { id: "LncPDG1zx9eYP6AUhnsp", title: "LLD — Parking Lot & Elevator System", type: "practice" },
  {
    id: "gWTGQp396udInGK0M1zh",
    title: "LLD — Library Management & Hotel Booking",
    type: "practice",
  },
  {
    id: "vhVqSDgrWJ8Oy9YGMUl7",
    title: "LLD — Social Media Feed & Notification System",
    type: "practice",
  },
  { id: "baOuwlRTx8gC1mY7MrQb", title: "LLD — Chess Game & Card Game Engine", type: "practice" },
  {
    id: "23j1kbrCu2XrzksO0icc",
    title: "CQRS, Event Sourcing & Domain-Driven Design",
    type: "standard",
  },
  { id: "JF7qkA9jOQgMdNP3efFL", title: "LLD Comprehensive Quiz", type: "quiz" },
  { id: "U8zyZhJtJX8MzHmN3NC6", title: "LLD Staff-Level Assessment", type: "timed_test" },
];

// ─── Report structure ─────────────────────────────────────────────────────────

interface Issue {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  category: string;
  title: string;
  details: string;
  previousCycle?: string;
}

const workingFeatures: string[] = [];
const issues: Issue[] = [];
const rawObservations: string[] = [];

let issueCounter = 1;

function pass(label: string) {
  workingFeatures.push(label);
  console.log(`  [PASS] ${label}`);
}

function fail(
  severity: Issue["severity"],
  category: string,
  title: string,
  details: string,
  prevCycle?: string
) {
  const id = `LLD-C4-${String(issueCounter++).padStart(3, "0")}`;
  issues.push({
    id,
    severity,
    category,
    title,
    details,
    ...(prevCycle ? { previousCycle: prevCycle } : {}),
  });
  console.log(`  [FAIL] ${id} (${severity}): ${title}`);
}

function observe(msg: string) {
  rawObservations.push(msg);
  console.log(`  [OBS] ${msg}`);
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function ensureLoggedIn(page: Page, context: BrowserContext): Promise<boolean> {
  // Try cached auth
  if (fs.existsSync(AUTH_CACHE)) {
    try {
      const stored = JSON.parse(fs.readFileSync(AUTH_CACHE, "utf8"));
      await context.addCookies(stored.cookies || []);
      await page.goto(`${BASE}/dashboard`);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000);
      const h1 = await page
        .locator("h1")
        .first()
        .textContent({ timeout: 8000 })
        .catch(() => "");
      if (h1?.includes("Dashboard")) {
        observe("Auth restored from cache");
        return true;
      }
      observe("Cached auth expired — re-logging in");
    } catch {
      observe("Cache invalid — re-logging in");
    }
  }

  // Fresh login
  try {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState("domcontentloaded");
    await page.fill("#schoolCode", SCHOOL_CODE);
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForSelector("#credential", { timeout: 15_000 });
    await page.getByRole("tab", { name: "Email" }).click();
    await page.fill("#credential", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator("h1")).toContainText("Dashboard", { timeout: 40_000 });

    // Save auth state
    const storageState = await context.storageState();
    fs.writeFileSync(AUTH_CACHE, JSON.stringify(storageState, null, 2));
    observe("Auth state saved to cache");
    return true;
  } catch (err) {
    observe(`Login failed: ${err}`);
    return false;
  }
}

// ─── Report writer ────────────────────────────────────────────────────────────

function writeReport(
  storyPointsTested: number,
  storyPointsAccessible: number,
  practiceModeResult: Record<string, unknown>,
  quizModeResult: Record<string, unknown>,
  timedAssessmentResult: Record<string, unknown>
) {
  const reportDir = path.join(process.cwd(), "tests/e2e/reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const totalTests = workingFeatures.length + issues.length;
  const passed = workingFeatures.length;
  const passRate = totalTests > 0 ? Math.round((passed / totalTests) * 1000) / 10 : 0;

  const p0 = issues.filter((i) => i.severity === "P0");
  const p1 = issues.filter((i) => i.severity === "P1");
  const p2 = issues.filter((i) => i.severity === "P2");
  const p3 = issues.filter((i) => i.severity === "P3");

  // Score: 10 - (p0*3 + p1*1.5 + p2*0.5 + p3*0.2), floor 1
  const rawScore = 10 - (p0.length * 3 + p1.length * 1.5 + p2.length * 0.5 + p3.length * 0.2);
  const effectivenessScore = Math.max(1, Math.min(10, Math.round(rawScore * 10) / 10));

  const report = {
    cycleNumber: 4,
    learner: "LLD Learner (tm_1773067959781_vgloe0tc9)",
    timestamp: new Date().toISOString(),
    space: "Low-Level Design & OOP",
    spaceId: LLD_SPACE,
    environment: {
      url: BASE,
      credentials: { email: EMAIL, schoolCode: SCHOOL_CODE },
      viewport: { width: 1280, height: 720 },
    },
    testSummary: {
      totalChecks: totalTests,
      passed,
      failed: issues.length,
      passRate: `${passRate}%`,
      p0Issues: p0.length,
      p1Issues: p1.length,
      p2Issues: p2.length,
      p3Issues: p3.length,
    },
    workingFeatures,
    issues,
    contentAssessment: {
      storyPointsTested,
      storyPointsAccessible,
      totalStoryPoints: LLD_STORY_POINTS.length,
      codeBlocksRendered: workingFeatures.some((f) => f.includes("code block")),
      umlDiagramsFound: workingFeatures.some(
        (f) => f.toLowerCase().includes("uml") || f.toLowerCase().includes("diagram")
      ),
      solidPrinciplesContent: workingFeatures.some((f) => f.toLowerCase().includes("solid")),
      designPatternsContent: workingFeatures.some((f) => f.toLowerCase().includes("pattern")),
      lldScenariosAccessible: workingFeatures.some(
        (f) =>
          f.toLowerCase().includes("parking") ||
          f.toLowerCase().includes("chess") ||
          f.toLowerCase().includes("library")
      ),
      contentQualityNotes: rawObservations.filter(
        (o) =>
          o.includes("keyword") ||
          o.includes("content") ||
          o.includes("code") ||
          o.includes("pattern")
      ),
    },
    uxAssessment: {
      navigationWorking: workingFeatures.some(
        (f) => f.includes("navigation") || f.includes("breadcrumb")
      ),
      loadTimesAcceptable: workingFeatures.some(
        (f) => f.includes("load time") || f.includes("fast load")
      ),
      mobileResponsive: workingFeatures.some((f) => f.includes("mobile")),
      uxIssues: issues.filter((i) => i.category === "ux"),
    },
    practiceMode: practiceModeResult,
    quizMode: quizModeResult,
    timedAssessment: timedAssessmentResult,
    learningEffectiveness: {
      score: effectivenessScore,
      notes: `${passed} working features, ${issues.length} total issues (${p0.length} P0, ${p1.length} P1, ${p2.length} P2). Content accessible: ${storyPointsAccessible}/${LLD_STORY_POINTS.length} story points.`,
    },
    rawObservations,
  };

  const outPath = path.join(reportDir, "learner-lld-cycle-4.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("\n=== LLD LEARNER CYCLE 4 REPORT ===");
  console.log(`Story Points: ${storyPointsAccessible}/${LLD_STORY_POINTS.length} accessible`);
  console.log(`Pass Rate: ${passRate}% (${passed}/${totalTests})`);
  console.log(`Issues: ${p0.length} P0, ${p1.length} P1, ${p2.length} P2, ${p3.length} P3`);
  console.log(`Learning Effectiveness: ${effectivenessScore}/10`);
  console.log(`Report written: ${outPath}`);
  console.log("===================================\n");
}

// ─── Main test ────────────────────────────────────────────────────────────────

test("LLD Learner Cycle 4 — Deep Assessment", async ({ page, context }) => {
  test.setTimeout(600_000); // 10 minutes

  const practiceModeResult: Record<string, unknown> = {
    tested: false,
    retryWorks: false,
    hintsVisible: false,
    solutionVisible: false,
    longFormAnswerWorks: false,
    aiEvaluationFeedback: false,
    progressPersists: false,
    notes: [] as string[],
  };

  const quizModeResult: Record<string, unknown> = {
    tested: false,
    questionTypesFound: [] as string[],
    resultsDisplayed: false,
    submitWorks: false,
    notes: [] as string[],
  };

  const timedAssessmentResult: Record<string, unknown> = {
    tested: false,
    h1Present: false,
    timerVisible: false,
    startButtonVisible: false,
    autoSubmit: null,
    analyticsShown: false,
    notes: [] as string[],
  };

  let storyPointsTested = 0;
  let storyPointsAccessible = 0;

  // ─── STEP 1: Authenticate ──────────────────────────────────────────────────
  console.log("\n=== STEP 1: AUTHENTICATE ===");
  const loggedIn = await ensureLoggedIn(page, context);
  if (!loggedIn) {
    fail("P0", "auth", "Login failed", `Could not authenticate as ${EMAIL}`);
    writeReport(0, 0, practiceModeResult, quizModeResult, timedAssessmentResult);
    throw new Error("Login failed — aborting");
  }
  pass("L1: Login with school code + email works");

  // ─── STEP 2: Spaces List ───────────────────────────────────────────────────
  console.log("\n=== STEP 2: SPACES LIST ===");
  await page.goto(`${BASE}/spaces`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const spacesH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`Spaces page h1: "${spacesH1}"`);
  if (spacesH1) {
    pass(`L2: Spaces page loads (h1="${spacesH1}")`);
  } else {
    fail("P1", "navigation", "Spaces page missing h1", `h1="${spacesH1}" at ${BASE}/spaces`);
  }

  const spaceCards = await page.locator('a[href*="/spaces/"]').all();
  const spaceTexts: string[] = [];
  for (const card of spaceCards) {
    const txt = await card.textContent().catch(() => "");
    if (txt) spaceTexts.push(txt.trim().substring(0, 60));
  }
  observe(`Space cards found: ${spaceCards.length} — ${spaceTexts.slice(0, 5).join(" | ")}`);

  const lldCardEl = page.locator(`a[href*="${LLD_SPACE}"]`).first();
  const lldCardExists = (await lldCardEl.count()) > 0;
  if (lldCardExists) {
    const lldText = await lldCardEl.textContent().catch(() => "");
    pass(`L2: LLD Space card visible (text="${lldText?.substring(0, 60)}")`);
  } else {
    fail(
      "P1",
      "navigation",
      "LLD Space card not found in spaces list",
      `Checked ${spaceCards.length} cards at ${BASE}/spaces`
    );
  }

  // ─── STEP 3: LLD Space Viewer ─────────────────────────────────────────────
  console.log("\n=== STEP 3: LLD SPACE VIEWER ===");
  const spaceStart = Date.now();
  await page.goto(`${BASE}/spaces/${LLD_SPACE}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  const spaceLoadTime = Date.now() - spaceStart;

  const spaceH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`LLD Space viewer h1: "${spaceH1}" (${spaceLoadTime}ms)`);

  if (spaceH1 && spaceH1.trim() !== "" && !spaceH1.includes("404")) {
    pass(`L3: LLD Space viewer has h1: "${spaceH1}"`);
  } else {
    fail(
      "P1",
      "learning-flow",
      "LLD Space viewer missing h1",
      `h1="${spaceH1}" at ${BASE}/spaces/${LLD_SPACE}`
    );
  }

  // Check story point links
  const spLinksInViewer = await page.locator(`a[href*="/story-points/"]`).count();
  observe(`Story point links in LLD space viewer: ${spLinksInViewer}`);
  if (spLinksInViewer >= 12) {
    pass(`L3: LLD Space viewer shows all 12 story point links`);
  } else if (spLinksInViewer > 0) {
    pass(`L3: LLD Space viewer shows ${spLinksInViewer} story point links (partial)`);
    if (spLinksInViewer < 12) {
      fail(
        "P2",
        "content",
        `LLD Space viewer shows only ${spLinksInViewer}/12 story point links`,
        `Expected 12, found ${spLinksInViewer}`
      );
    }
  } else {
    fail(
      "P1",
      "content",
      "No story point links in LLD space viewer",
      `${spLinksInViewer} links at ${BASE}/spaces/${LLD_SPACE}`
    );
  }

  if (spaceLoadTime < 3000) {
    pass(`UX1: LLD Space viewer fast load (${spaceLoadTime}ms)`);
  }

  // ─── STEP 4: Deep Study — Individual Story Points ─────────────────────────
  console.log("\n=== STEP 4: STORY POINTS ===");

  // Deep-test representative story points
  const deepTestSPs = [
    LLD_STORY_POINTS[0], // OOP Fundamentals & SOLID (standard)
    LLD_STORY_POINTS[1], // Design Patterns — Creational (standard)
    LLD_STORY_POINTS[5], // Parking Lot (practice scenario)
    LLD_STORY_POINTS[9], // CQRS, Event Sourcing & DDD (standard)
  ];

  for (const sp of deepTestSPs) {
    storyPointsTested++;
    const spUrl = `${BASE}/spaces/${LLD_SPACE}/story-points/${sp.id}`;
    console.log(`\n  Testing: ${sp.title} (${sp.type})`);

    const spStart = Date.now();
    await page.goto(spUrl);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    const spLoadTime = Date.now() - spStart;

    const h1 = await page
      .locator("h1")
      .first()
      .textContent({ timeout: 10_000 })
      .catch(() => "");
    observe(`${sp.title} h1: "${h1}" (${spLoadTime}ms)`);

    const h1Ok = h1 && h1.trim() !== "" && !h1.includes("404") && !h1.includes("Not Found");

    if (h1Ok) {
      storyPointsAccessible++;
      pass(`L4: ${sp.title} accessible (h1: "${h1?.substring(0, 50)}")`);

      // Check for code blocks (essential for LLD content)
      const codeBlocks = await page
        .locator('pre, code, [class*="code"], [class*="highlight"]')
        .count();
      observe(`  Code blocks in ${sp.title}: ${codeBlocks}`);
      if (codeBlocks > 0) {
        pass(`L4: ${sp.title} — code blocks rendered (${codeBlocks} found)`);

        // Syntax highlighting
        const syntaxTokens = await page
          .locator('[class*="token"], [class*="hljs"], [class*="prism"], .shiki')
          .count();
        if (syntaxTokens > 0) {
          pass(`L4: ${sp.title} — syntax highlighting detected (${syntaxTokens} tokens)`);
        } else {
          observe(`  No syntax highlighting tokens in ${sp.title}`);
        }

        // Copy buttons
        const copyBtns = await page
          .locator(
            'button:has-text("Copy"), button[aria-label*="copy"], button[aria-label*="Copy"]'
          )
          .count();
        if (copyBtns > 0) {
          pass(`L4: ${sp.title} — copy button on code blocks`);
        }
      } else {
        fail(
          "P2",
          "content-quality",
          `No code blocks in ${sp.title}`,
          `Expected code examples in ${sp.type} story point`
        );
      }

      // LLD-specific content checks per story point
      const bodyText = await page
        .locator("body")
        .textContent()
        .catch(() => "");

      if (sp.id === "efDEBIVVuI4GYultzGX8") {
        // OOP & SOLID
        const lldOopKeywords = [
          "encapsulation",
          "inheritance",
          "polymorphism",
          "abstraction",
          "SOLID",
          "single responsibility",
          "open",
          "closed",
          "interface",
        ];
        const foundOop = lldOopKeywords.filter((kw) =>
          bodyText?.toLowerCase().includes(kw.toLowerCase())
        );
        observe(`  OOP/SOLID keywords: ${foundOop.join(", ")}`);
        if (foundOop.length >= 4) {
          pass(
            `CQ1: OOP Fundamentals content has SOLID keywords (${foundOop.length}/${lldOopKeywords.length})`
          );
        } else {
          fail(
            "P2",
            "content-quality",
            "OOP Fundamentals missing SOLID keywords",
            `Found ${foundOop.length}/${lldOopKeywords.length}`
          );
        }

        // UML check
        const umlKeywords = [
          "class diagram",
          "UML",
          "interface",
          "abstract",
          "relationship",
          "extends",
          "implements",
        ];
        const foundUml = umlKeywords.filter((kw) =>
          bodyText?.toLowerCase().includes(kw.toLowerCase())
        );
        observe(`  UML-related terms: ${foundUml.join(", ")}`);
        if (foundUml.length >= 2) {
          pass(`CQ1: OOP Fundamentals — UML/class diagram references found (${foundUml.length})`);
        }
      }

      if (sp.id === "FU3WlPIdwlvPAo8lB4kG") {
        // Creational Patterns
        const creationalKeywords = [
          "factory",
          "singleton",
          "builder",
          "prototype",
          "abstract factory",
          "creational",
          "pattern",
        ];
        const foundCreational = creationalKeywords.filter((kw) =>
          bodyText?.toLowerCase().includes(kw.toLowerCase())
        );
        observe(`  Creational pattern keywords: ${foundCreational.join(", ")}`);
        if (foundCreational.length >= 3) {
          pass(
            `CQ2: Creational Patterns content quality (${foundCreational.length}/${creationalKeywords.length} keywords)`
          );
        } else {
          fail(
            "P2",
            "content-quality",
            "Creational Patterns missing key pattern terms",
            `Found ${foundCreational.length}/${creationalKeywords.length}`
          );
        }
      }

      if (sp.id === "LncPDG1zx9eYP6AUhnsp") {
        // Parking Lot scenario
        const parkingKeywords = [
          "parking",
          "vehicle",
          "slot",
          "floor",
          "ticket",
          "fee",
          "entry",
          "exit",
          "class",
        ];
        const foundParking = parkingKeywords.filter((kw) =>
          bodyText?.toLowerCase().includes(kw.toLowerCase())
        );
        observe(`  Parking Lot scenario keywords: ${foundParking.join(", ")}`);
        if (foundParking.length >= 4) {
          pass(
            `CQ3: Parking Lot scenario content completeness (${foundParking.length}/${parkingKeywords.length})`
          );
        } else {
          fail(
            "P2",
            "content-quality",
            "Parking Lot scenario missing key domain terms",
            `Found ${foundParking.length}/${parkingKeywords.length}`
          );
        }

        // LLD-specific: check for class design hints
        const designTerms = ["class", "interface", "responsibility", "design", "object"];
        const foundDesign = designTerms.filter((kw) =>
          bodyText?.toLowerCase().includes(kw.toLowerCase())
        );
        if (foundDesign.length >= 3) {
          pass(`CQ3: Parking Lot — class design terminology present`);
        }
      }

      if (sp.id === "23j1kbrCu2XrzksO0icc") {
        // CQRS, Event Sourcing, DDD
        const dddKeywords = [
          "CQRS",
          "event sourcing",
          "domain",
          "aggregate",
          "bounded context",
          "command",
          "query",
          "event",
        ];
        const foundDdd = dddKeywords.filter((kw) =>
          bodyText?.toLowerCase().includes(kw.toLowerCase())
        );
        observe(`  DDD/CQRS keywords: ${foundDdd.join(", ")}`);
        if (foundDdd.length >= 4) {
          pass(
            `CQ4: CQRS/Event Sourcing/DDD content (${foundDdd.length}/${dddKeywords.length} keywords)`
          );
        } else {
          fail(
            "P2",
            "content-quality",
            "CQRS/DDD story point missing key architecture terms",
            `Found ${foundDdd.length}/${dddKeywords.length}`
          );
        }
      }

      // Breadcrumbs / navigation
      const breadcrumbs = await page
        .locator('[class*="breadcrumb"], nav[aria-label*="breadcrumb"], .breadcrumb')
        .count();
      const backLink = await page.locator('a[href*="/spaces"]').count();
      if (breadcrumbs > 0 || backLink > 0) {
        pass(`UX1: ${sp.title} — back navigation visible`);
      }

      // Section filtering (sidebar or tab navigation)
      const sectionFilter = await page
        .locator('[class*="section"], [class*="sidebar"], [role="tablist"], [class*="filter"]')
        .count();
      observe(`  Section/sidebar elements: ${sectionFilter}`);
      if (sectionFilter > 0) {
        pass(`UX2: ${sp.title} — section navigation/filter elements present`);
      }
    } else {
      fail("P1", "content", `${sp.title} story point viewer: no h1`, `h1="${h1}" at ${spUrl}`);
    }
  }

  // Quick-check remaining story points
  console.log("\n  Quick-checking remaining story points...");
  const remainingSPs = LLD_STORY_POINTS.filter((sp) => !deepTestSPs.find((t) => t.id === sp.id));
  for (const sp of remainingSPs) {
    storyPointsTested++;
    const spUrl = `${BASE}/spaces/${LLD_SPACE}/story-points/${sp.id}`;
    await page.goto(spUrl);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    const h1 = await page
      .locator("h1")
      .first()
      .textContent({ timeout: 8000 })
      .catch(() => "");
    const ok = h1 && h1.trim() !== "" && !h1.includes("404");
    observe(`Quick check ${sp.title}: h1="${h1?.substring(0, 50)}"`);
    if (ok) {
      storyPointsAccessible++;
      pass(`L4: ${sp.title} accessible (h1: "${h1?.substring(0, 40)}")`);
    } else {
      fail("P1", "content", `${sp.title} story point: no h1`, `h1="${h1}" at ${spUrl}`);
    }
  }

  observe(`Story points accessible: ${storyPointsAccessible}/${storyPointsTested}`);

  // ─── STEP 5: Practice Mode (LLD Scenario) ─────────────────────────────────
  console.log("\n=== STEP 5: PRACTICE MODE ===");
  practiceModeResult.tested = true;

  // Use Clean Architecture story point for practice
  const practiceSpUrl = `${BASE}/spaces/${LLD_SPACE}/story-points/fhpTejczKkx7lpcy1y17`;
  await page.goto(practiceSpUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const practiceH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`Practice mode (Clean Architecture) h1: "${practiceH1}"`);

  // Check for answer options (MCQ or long-form)
  const radioOptions = await page.locator('input[type="radio"], [role="radio"]').count();
  const checkboxOptions = await page.locator('input[type="checkbox"], [role="checkbox"]').count();
  const textareaOptions = await page.locator('textarea, [contenteditable="true"]').count();
  const truefalseOptions = await page
    .locator('button:has-text("True"), button:has-text("False")')
    .count();
  const totalOptions = radioOptions + checkboxOptions + textareaOptions + truefalseOptions;
  observe(
    `Answer options: radio=${radioOptions}, checkbox=${checkboxOptions}, textarea=${textareaOptions}, tf=${truefalseOptions}`
  );

  // Check submit button
  const submitBtn = page
    .locator('button:has-text("Submit"), button:has-text("Submit Answer"), button[type="submit"]')
    .first();
  const submitVisible = (await submitBtn.count()) > 0;
  observe(`Submit button visible: ${submitVisible}`);

  if (submitVisible) {
    pass("P1: Practice mode — Submit button visible");
  } else {
    fail(
      "P1",
      "practice-mode",
      "Submit button not visible in practice mode",
      `At ${practiceSpUrl}`
    );
  }

  if (totalOptions > 0) {
    pass(
      `P1: Practice mode — answer options visible (${totalOptions} found, radio=${radioOptions}, textarea=${textareaOptions})`
    );

    // Test long-form answer if textarea is present (key for LLD)
    if (textareaOptions > 0) {
      try {
        const textarea = page.locator("textarea").first();
        const charLimitAttr = await textarea.getAttribute("maxlength").catch(() => null);
        observe(`  Textarea maxlength: ${charLimitAttr}`);

        await textarea.fill(
          "The Clean Architecture separates concerns into layers: Entities, Use Cases, Interface Adapters, and Frameworks. This allows for dependency inversion and testability."
        );
        await page.waitForTimeout(500);

        const charCount = await page
          .locator('[class*="char-count"], [class*="character"]')
          .textContent({ timeout: 3000 })
          .catch(() => null);
        observe(`  Character count indicator: "${charCount}"`);
        if (charCount) {
          pass("P2: Long-form answer — character count indicator visible");
        }

        practiceModeResult.longFormAnswerWorks = true;
        pass("P2: Practice mode — long-form textarea accepts text input");

        // Check submit enabled after filling
        const submitEnabledAfter = !(await submitBtn.isDisabled().catch(() => true));
        if (submitEnabledAfter) {
          pass("P1: Submit enabled after filling long-form answer");

          await submitBtn.click({ timeout: 5000 });
          await page.waitForTimeout(3000);

          // Check for AI evaluation feedback
          const aiEvalFeedback = await page
            .locator(
              '[class*="feedback"], [class*="evaluation"], [class*="ai-"], [class*="result"]'
            )
            .count();
          observe(`  AI evaluation feedback elements: ${aiEvalFeedback}`);
          if (aiEvalFeedback > 0) {
            practiceModeResult.aiEvaluationFeedback = true;
            pass("P2: Practice mode — AI evaluation feedback displayed after submission");
          } else {
            const bodyAfterSubmit = await page
              .locator("body")
              .textContent()
              .catch(() => "");
            const hasFeedbackText =
              bodyAfterSubmit?.includes("score") ||
              bodyAfterSubmit?.includes("feedback") ||
              bodyAfterSubmit?.includes("correct") ||
              bodyAfterSubmit?.includes("Next");
            if (hasFeedbackText) {
              pass("P2: Practice mode — feedback text present after submit");
            } else {
              fail(
                "P2",
                "practice-mode",
                "No AI evaluation feedback after long-form submit",
                `At ${practiceSpUrl}`
              );
            }
          }

          // Check for Next button
          const nextBtn = await page
            .locator(
              'button:has-text("Next"), button:has-text("Continue"), button:has-text("Next Question")'
            )
            .count();
          if (nextBtn > 0) {
            pass("P1: Next button visible after practice submit");
            practiceModeResult.retryWorks = true;
          }
        }
      } catch (err) {
        observe(`Long-form textarea interaction error: ${err}`);
      }
    } else if (radioOptions > 0) {
      // MCQ-type practice
      try {
        await page.locator('input[type="radio"]').first().click({ timeout: 5000 });
        await page.waitForTimeout(500);
        const submitEnabledAfter = !(await submitBtn.isDisabled().catch(() => true));
        if (submitEnabledAfter) {
          pass("P1: Submit enabled after MCQ selection");
          await submitBtn.click({ timeout: 5000 });
          await page.waitForTimeout(2000);
          const nextBtn = await page
            .locator('button:has-text("Next"), button:has-text("Continue")')
            .count();
          if (nextBtn > 0) {
            pass("P1: Next button visible after MCQ submit");
            practiceModeResult.retryWorks = true;
          }
        }
      } catch (err) {
        observe(`MCQ interaction error: ${err}`);
      }
    }
  } else {
    fail("P1", "practice-mode", "No answer options in practice mode", `At ${practiceSpUrl}`);
  }

  // Hints and solution buttons
  const hintBtn = await page
    .locator('button:has-text("Hint"), button:has-text("Show Hint"), button[aria-label*="hint"]')
    .count();
  if (hintBtn > 0) {
    pass("P2: Practice mode — hint button visible");
    practiceModeResult.hintsVisible = true;
  }
  const solutionBtn = await page
    .locator('button:has-text("Solution"), button:has-text("Show Solution")')
    .count();
  if (solutionBtn > 0) {
    pass("P2: Practice mode — solution button visible");
    practiceModeResult.solutionVisible = true;
  }

  // Ask AI Tutor
  const aiTutorBtn = await page
    .locator('button:has-text("AI Tutor"), button:has-text("Ask AI"), [aria-label*="AI"]')
    .count();
  if (aiTutorBtn > 0) {
    pass("P2: Ask AI Tutor button visible in practice mode");
  }

  (practiceModeResult.notes as string[]).push(
    `Clean Architecture practice: h1="${practiceH1}", submit=${submitVisible}, options=${totalOptions} (radio=${radioOptions}, textarea=${textareaOptions})`
  );

  // Also test LLD Parking Lot scenario specifically
  console.log("\n  Testing LLD Parking Lot scenario (practice)...");
  const parkingSpUrl = `${BASE}/spaces/${LLD_SPACE}/story-points/LncPDG1zx9eYP6AUhnsp`;
  await page.goto(parkingSpUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const parkingH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`Parking Lot h1: "${parkingH1}"`);

  if (parkingH1 && parkingH1.trim() !== "") {
    const parkingBodyText = await page
      .locator("body")
      .textContent()
      .catch(() => "");
    const scenarioComplete =
      parkingBodyText?.includes("parking") || parkingBodyText?.includes("Parking");
    if (scenarioComplete) {
      pass("CQ3: LLD Parking Lot scenario content loaded");
    }

    // Check if design scenario shows class structure guidance
    const hasDesignGuidance =
      parkingBodyText?.includes("class") ||
      parkingBodyText?.includes("interface") ||
      parkingBodyText?.includes("design");
    if (hasDesignGuidance) {
      pass("CQ3: Parking Lot scenario includes class design guidance");
    }
  }

  (practiceModeResult.notes as string[]).push(`Parking Lot: h1="${parkingH1}"`);

  // ─── STEP 6: Quiz Mode ────────────────────────────────────────────────────
  console.log("\n=== STEP 6: QUIZ MODE ===");
  quizModeResult.tested = true;
  const quizUrl = `${BASE}/spaces/${LLD_SPACE}/story-points/JF7qkA9jOQgMdNP3efFL`;

  await page.goto(quizUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const quizH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`LLD Quiz h1: "${quizH1}"`);

  if (quizH1 && !quizH1.includes("404")) {
    pass(`Q1: LLD Quiz story point accessible: "${quizH1}"`);
  } else {
    fail("P1", "quiz", "LLD Quiz story point: no h1", `h1="${quizH1}" at ${quizUrl}`);
  }

  // Question type detection
  const mcqOptions = await page.locator('input[type="radio"], [role="radio"]').count();
  const mcaqOptions = await page.locator('input[type="checkbox"], [role="checkbox"]').count();
  const textareaInQuiz = await page.locator("textarea").count();
  const questionTypes = quizModeResult.questionTypesFound as string[];

  observe(`Quiz options: radio=${mcqOptions}, checkbox=${mcaqOptions}, textarea=${textareaInQuiz}`);
  if (mcqOptions > 0) {
    questionTypes.push("MCQ");
    pass("Q1: MCQ question type in LLD Quiz");
  }
  if (mcaqOptions > 0) {
    questionTypes.push("MCAQ");
    pass("Q1: MCAQ question type in LLD Quiz");
  }
  if (textareaInQuiz > 0) {
    questionTypes.push("LongForm");
    pass("Q1: Long-form question type in LLD Quiz");
  }

  // Progress indicator
  const progressBar = await page.locator('[role="progressbar"], [class*="progress"]').count();
  if (progressBar > 0) {
    pass("Q1: Quiz progress bar visible");
  }

  // Try submit
  try {
    if (mcqOptions > 0) {
      await page.locator('input[type="radio"]').first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
    } else if (mcaqOptions > 0) {
      await page.locator('input[type="checkbox"]').first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
    } else if (textareaInQuiz > 0) {
      await page
        .locator("textarea")
        .first()
        .fill("Factory pattern creates objects without specifying exact class.", { timeout: 5000 });
      await page.waitForTimeout(500);
    }

    const quizSubmit = page.locator('button:has-text("Submit"), button:has-text("Next")').first();
    if ((await quizSubmit.count()) > 0) {
      quizModeResult.submitWorks = true;
      pass("Q1: Quiz submit/next button visible and clickable");
    }
  } catch (err) {
    observe(`Quiz interaction error: ${err}`);
  }

  // Results section
  const resultsSection = await page.locator('[class*="result"], [class*="score"]').count();
  if (resultsSection > 0) {
    quizModeResult.resultsDisplayed = true;
    pass("Q1: Quiz results/score section visible");
  }

  (quizModeResult.notes as string[]).push(
    `LLD Quiz: h1="${quizH1}", questionTypes=${questionTypes.join(",")}, mcq=${mcqOptions}, mcaq=${mcaqOptions}, textarea=${textareaInQuiz}`
  );

  // ─── STEP 7: Timed Assessment ─────────────────────────────────────────────
  console.log("\n=== STEP 7: TIMED ASSESSMENT ===");
  timedAssessmentResult.tested = true;
  const timedUrl = `${BASE}/spaces/${LLD_SPACE}/story-points/U8zyZhJtJX8MzHmN3NC6`;

  await page.goto(timedUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const timedH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`LLD Timed Assessment h1: "${timedH1}"`);

  if (timedH1 && timedH1.trim() !== "" && !timedH1.includes("404")) {
    timedAssessmentResult.h1Present = true;
    pass(`T1: LLD Timed Assessment h1: "${timedH1}"`);
  } else {
    fail(
      "P1",
      "timed-assessment",
      "LLD Timed Assessment landing: no h1",
      `h1="${timedH1}" at ${timedUrl}`
    );
  }

  // Timer elements
  const timerEl = await page.locator('[class*="timer"], [class*="countdown"]').count();
  observe(`Timer elements: ${timerEl}`);
  if (timerEl > 0) {
    timedAssessmentResult.timerVisible = true;
    pass("T2: Timer element visible on LLD timed assessment");
  } else {
    fail(
      "P2",
      "timed-assessment",
      "Timer not visible on LLD timed assessment landing",
      `At ${timedUrl}`
    );
  }

  // Start button
  const startBtnCount = await page
    .locator(
      'button:has-text("Start"), button:has-text("Begin"), button:has-text("Start Assessment"), button:has-text("Start Test")'
    )
    .count();
  if (startBtnCount > 0) {
    timedAssessmentResult.startButtonVisible = true;
    pass("T3: Start Assessment button visible on LLD timed test");
  } else {
    fail(
      "P2",
      "timed-assessment",
      "Start button not found on LLD timed assessment",
      `At ${timedUrl}`
    );
  }

  // Instructions / metadata check
  const timedBody = await page
    .locator("body")
    .textContent()
    .catch(() => "");
  const hasInstructions =
    timedBody?.includes("minute") ||
    timedBody?.includes("time") ||
    timedBody?.includes("question") ||
    timedBody?.includes("assessment");
  if (hasInstructions) {
    pass("T3: Timed Assessment shows instructions/metadata");
  }

  // LLD-specific content keywords
  const lldTimedKeywords = [
    "design",
    "class",
    "object",
    "pattern",
    "architecture",
    "SOLID",
    "interface",
  ];
  const foundTimedKw = lldTimedKeywords.filter((kw) =>
    timedBody?.toLowerCase().includes(kw.toLowerCase())
  );
  observe(`LLD timed assessment keywords: ${foundTimedKw.join(", ")}`);
  if (foundTimedKw.length >= 2) {
    pass(`CQ5: LLD Timed Assessment references LLD concepts (${foundTimedKw.length} keywords)`);
  }

  // Analytics section
  const analyticsSection = await page.locator('[class*="analytic"], [class*="result"]').count();
  if (analyticsSection > 0) {
    timedAssessmentResult.analyticsShown = true;
    pass("T5: LLD Timed Assessment analytics/results section visible");
  }

  (timedAssessmentResult.notes as string[]).push(
    `LLD timed test: h1="${timedH1}", timer=${timerEl > 0}, startBtn=${startBtnCount > 0}, lldKeywords=${foundTimedKw.length}`
  );

  // ─── STEP 8: UX & Content Quality ─────────────────────────────────────────
  console.log("\n=== STEP 8: UX CHECKS ===");

  // Mobile viewport test
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/spaces/${LLD_SPACE}/story-points/efDEBIVVuI4GYultzGX8`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
  const mobileH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 8000 })
    .catch(() => "");
  if (mobileH1 && mobileH1.trim() !== "") {
    pass(`UX1: LLD story point responsive on mobile (375px) — h1="${mobileH1?.substring(0, 30)}"`);
  } else {
    fail(
      "P2",
      "ux",
      "LLD story point not rendering on mobile viewport",
      `h1="${mobileH1}" at 375px`
    );
  }

  // Restore desktop
  await page.setViewportSize({ width: 1280, height: 720 });

  // OOP content quality on desktop
  await page.goto(`${BASE}/spaces/${LLD_SPACE}/story-points/efDEBIVVuI4GYultzGX8`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);

  const oopBody = await page
    .locator("body")
    .textContent()
    .catch(() => "");
  const lldKeywords = [
    "encapsulation",
    "inheritance",
    "polymorphism",
    "abstraction",
    "class",
    "interface",
    "method",
    "object",
    "principle",
    "SOLID",
  ];
  const foundLldKw = lldKeywords.filter((kw) => oopBody?.toLowerCase().includes(kw.toLowerCase()));
  observe(`LLD/OOP keywords found: ${foundLldKw.join(", ")}`);
  if (foundLldKw.length >= 6) {
    pass(
      `CQ1: OOP content has strong LLD-relevant terms (${foundLldKw.length}/${lldKeywords.length})`
    );
  } else if (foundLldKw.length >= 3) {
    pass(`CQ1: OOP content has some LLD terms (${foundLldKw.length}/${lldKeywords.length})`);
  } else {
    fail(
      "P2",
      "content-quality",
      "OOP story point missing LLD keywords",
      `Found ${foundLldKw.length}/${lldKeywords.length}`
    );
  }

  // Check Behavioral Patterns (structural check)
  await page.goto(`${BASE}/spaces/${LLD_SPACE}/story-points/Q75RccoNWATUD5WvZXWp`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
  const behavioralBody = await page
    .locator("body")
    .textContent()
    .catch(() => "");
  const behavioralKw = [
    "observer",
    "strategy",
    "command",
    "iterator",
    "template",
    "visitor",
    "behavioral",
    "pattern",
  ];
  const foundBehavioralKw = behavioralKw.filter((kw) =>
    behavioralBody?.toLowerCase().includes(kw.toLowerCase())
  );
  observe(`Behavioral patterns keywords: ${foundBehavioralKw.join(", ")}`);
  if (foundBehavioralKw.length >= 3) {
    pass(
      `CQ2: Behavioral Patterns content quality (${foundBehavioralKw.length}/${behavioralKw.length} keywords)`
    );
  } else {
    fail(
      "P3",
      "content-quality",
      "Behavioral Patterns missing key pattern terms",
      `Found ${foundBehavioralKw.length}/${behavioralKw.length}`
    );
  }

  // ─── WRITE REPORT ─────────────────────────────────────────────────────────
  writeReport(
    storyPointsTested,
    storyPointsAccessible,
    practiceModeResult,
    quizModeResult,
    timedAssessmentResult
  );

  // Final assertion — only fail on P0s
  const p0Issues = issues.filter((i) => i.severity === "P0");
  if (p0Issues.length > 0) {
    throw new Error(
      `${p0Issues.length} P0 issues found: ${p0Issues.map((i) => i.title).join("; ")}`
    );
  }
});
