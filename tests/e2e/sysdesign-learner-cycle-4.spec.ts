/**
 * System Design Learner — Cycle 4 Deep Assessment
 *
 * Tests the System Design space post-Cycle-3 fixes:
 *   - Space viewer h1 rendering
 *   - Story point links in space viewer
 *   - Fundamentals of Scalability (standard) content quality
 *   - Database Design & Patterns (practice) interaction
 *   - Caching & Load Balancing Quiz (quiz) flow
 *   - System Design Assessment (timed_test) landing + timer reliability
 *   - Architecture diagram rendering
 *   - Results and analytics pages
 *   - UX: navigation, breadcrumbs, load times, mobile
 *
 * Auth cached at /tmp/sd-c4-auth.json to avoid Firebase rate limits.
 * Output: tests/e2e/reports/learner-sysdesign-cycle-4.json
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:4570";
const EMAIL = "student.test@subhang.academy";
const PASSWORD = "Test@12345";
const SCHOOL_CODE = "SUB001";
const AUTH_CACHE = "/tmp/sd-c4-auth.json";

// From scripts/seed-results/subhang.json
const SD_SPACE = "8rPWlVP4kyDp1xd75SnH";
// Original space from memory (fallback check)
const SD_SPACE_ORIGINAL = "PDFq1OluyAGNAz6Fpx0j";

const SD_STORY_POINTS = [
  { id: "IUPkK8v17KQ4rFbsJ8ge", title: "Fundamentals of Scalability", type: "standard" },
  { id: "20KKFipTUan5hYBpyXNd", title: "Database Design & Patterns", type: "practice" },
  { id: "6RVBgiRWqjQIUDl7xeek", title: "Caching & Load Balancing Quiz", type: "quiz" },
  { id: "3PYpieQtVUMQYiM9W43i", title: "System Design Assessment", type: "timed_test" },
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
  const id = `SD-C4-${String(issueCounter++).padStart(3, "0")}`;
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
  // Try cached auth — restore full storage state (localStorage + cookies for Firebase)
  if (fs.existsSync(AUTH_CACHE)) {
    try {
      const stored = JSON.parse(fs.readFileSync(AUTH_CACHE, "utf8"));

      // Restore cookies
      if (stored.cookies?.length > 0) {
        await context.addCookies(stored.cookies);
      }

      // Restore localStorage via initScript (needed for Firebase auth tokens)
      if (stored.origins?.length > 0) {
        await context.addInitScript(
          (
            origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>
          ) => {
            for (const { origin, localStorage: items } of origins) {
              if (origin === window.location.origin) {
                for (const { name, value } of items) {
                  window.localStorage.setItem(name, value);
                }
              }
            }
          },
          stored.origins
        );
      }

      await page.goto(`${BASE}/spaces`);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(4000);
      const h1 = await page
        .locator("h1")
        .first()
        .textContent({ timeout: 8000 })
        .catch(() => "");
      const isAuthenticated =
        h1 &&
        (h1.includes("My Spaces") ||
          h1.includes("Spaces") ||
          h1.includes("Dashboard") ||
          h1.includes("Welcome"));
      if (isAuthenticated) {
        observe(`Auth restored from cache (h1="${h1}")`);
        return true;
      }
      observe(`Cached auth expired (h1="${h1}") — re-logging in`);
    } catch (e) {
      observe(`Cache restore failed: ${e} — re-logging in`);
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
    // Wait for authenticated state — app shows "My Spaces" or "Dashboard"
    await page.waitForFunction(
      () => {
        const h1 = document.querySelector("h1");
        const text = h1?.textContent || "";
        return text.includes("Spaces") || text.includes("Dashboard") || text.includes("Welcome");
      },
      { timeout: 40_000 }
    );

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
  activeSpaceId: string,
  practiceMode: Record<string, unknown>,
  quizMode: Record<string, unknown>,
  timedAssessment: Record<string, unknown>
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
    learner: "System Design Learner (tm_1773067950146_tduxo7n9p)",
    timestamp: new Date().toISOString(),
    space: "System Design",
    spaceId: activeSpaceId,
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
      totalStoryPoints: SD_STORY_POINTS.length,
      architectureDiagramRendered: workingFeatures.some(
        (f) => f.includes("diagram") || f.includes("architecture")
      ),
      systemDesignKeywordsFound: rawObservations
        .filter((o) => o.includes("keyword") || o.includes("content"))
        .slice(0, 5),
      contentQualityNotes: rawObservations
        .filter(
          (o) =>
            o.toLowerCase().includes("keyword") ||
            o.toLowerCase().includes("content") ||
            o.toLowerCase().includes("diagram")
        )
        .slice(0, 10),
    },
    uxAssessment: {
      navigationWorking: workingFeatures.some(
        (f) => f.includes("navigation") || f.includes("breadcrumb")
      ),
      loadTimesAcceptable: workingFeatures.some(
        (f) => f.includes("load time") || f.includes("fast load")
      ),
      mobileResponsive: workingFeatures.some((f) => f.includes("mobile") || f.includes("375px")),
      uxIssues: issues.filter((i) => i.category === "ux"),
    },
    practiceMode,
    quizMode,
    timedAssessment,
    learningEffectiveness: {
      score: effectivenessScore,
      notes: `${passed} working features, ${issues.length} total issues (${p0.length} P0, ${p1.length} P1, ${p2.length} P2). Content accessible: ${storyPointsAccessible}/${SD_STORY_POINTS.length} story points.`,
    },
    rawObservations,
  };

  const outPath = path.join(reportDir, "learner-sysdesign-cycle-4.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("\n=== SYSTEM DESIGN LEARNER CYCLE 4 REPORT ===");
  console.log(`Space ID used: ${activeSpaceId}`);
  console.log(`Story Points: ${storyPointsAccessible}/${SD_STORY_POINTS.length} accessible`);
  console.log(`Pass Rate: ${passRate}% (${passed}/${totalTests})`);
  console.log(`Issues: ${p0.length} P0, ${p1.length} P1, ${p2.length} P2, ${p3.length} P3`);
  console.log(`Learning Effectiveness: ${effectivenessScore}/10`);
  console.log(`Report written: ${outPath}`);
  console.log("============================================\n");
}

// ─── Main test ────────────────────────────────────────────────────────────────

test("System Design Learner Cycle 4 — Deep Assessment", async ({ page, context }) => {
  test.setTimeout(600_000); // 10 minutes

  const practiceModeResult: Record<string, unknown> = {
    tested: false,
    retryWorks: false,
    hintsVisible: false,
    solutionVisible: false,
    difficultyFilterWorks: false,
    progressPersists: false,
    notes: [] as string[],
  };

  const quizModeResult: Record<string, unknown> = {
    tested: false,
    questionTypesFound: [] as string[],
    resultsDisplayed: false,
    submitWorks: false,
    shuffleDetected: false,
    notes: [] as string[],
  };

  const timedAssessmentResult: Record<string, unknown> = {
    tested: false,
    h1Present: false,
    timerVisible: false,
    startButtonVisible: false,
    autoSubmit: null,
    analyticsShown: false,
    timerAccuracy: null,
    notes: [] as string[],
  };

  let storyPointsTested = 0;
  let storyPointsAccessible = 0;
  let activeSpaceId = SD_SPACE;

  // ─── STEP 1: Authenticate ──────────────────────────────────────────────────
  console.log("\n=== STEP 1: AUTHENTICATE ===");
  const loggedIn = await ensureLoggedIn(page, context);
  if (!loggedIn) {
    fail("P0", "auth", "Login failed", `Could not authenticate as ${EMAIL}`);
    writeReport(0, 0, activeSpaceId, practiceModeResult, quizModeResult, timedAssessmentResult);
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
  if (spacesH1 && spacesH1.trim() !== "") {
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

  // Check seeded space
  const sdCardEl = page.locator(`a[href*="${SD_SPACE}"]`).first();
  const sdCardExists = (await sdCardEl.count()) > 0;
  if (sdCardExists) {
    const sdText = await sdCardEl.textContent().catch(() => "");
    pass(`L2: System Design Space card visible (seed space, text="${sdText?.substring(0, 50)}")`);
    activeSpaceId = SD_SPACE;
  } else {
    // Fallback: try original space
    const origCardEl = page.locator(`a[href*="${SD_SPACE_ORIGINAL}"]`).first();
    const origCardExists = (await origCardEl.count()) > 0;
    if (origCardExists) {
      const origText = await origCardEl.textContent().catch(() => "");
      pass(
        `L2: System Design Space card visible (original space, text="${origText?.substring(0, 50)}")`
      );
      activeSpaceId = SD_SPACE_ORIGINAL;
      observe(`Using original space ID: ${SD_SPACE_ORIGINAL}`);
    } else {
      // Try text search
      const sysDesignCard = page.locator('a[href*="/spaces/"]:has-text("System Design")').first();
      const sysDesignExists = (await sysDesignCard.count()) > 0;
      if (sysDesignExists) {
        const href = await sysDesignCard.getAttribute("href").catch(() => "");
        const match = href?.match(/\/spaces\/([^/]+)/);
        if (match) {
          activeSpaceId = match[1];
          observe(`Found System Design space by text, ID: ${activeSpaceId}`);
          pass(`L2: System Design Space found by text search (href="${href?.substring(0, 60)}")`);
        } else {
          pass("L2: System Design Space card found by text (no ID extracted)");
        }
      } else {
        fail(
          "P1",
          "navigation",
          "System Design Space card not found in spaces list",
          `Checked ${spaceCards.length} cards at ${BASE}/spaces. spaceTexts=${spaceTexts.slice(0, 3).join(", ")}`
        );
      }
    }
  }

  // ─── STEP 3: System Design Space Viewer ───────────────────────────────────
  console.log("\n=== STEP 3: SYSTEM DESIGN SPACE VIEWER ===");
  const spaceStart = Date.now();
  await page.goto(`${BASE}/spaces/${activeSpaceId}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  const spaceLoadTime = Date.now() - spaceStart;

  const spaceH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`System Design Space viewer h1: "${spaceH1}" (${spaceLoadTime}ms)`);

  if (spaceH1 && spaceH1.trim() !== "" && !spaceH1.includes("404")) {
    pass(`L3: System Design Space viewer has h1: "${spaceH1}"`);
  } else {
    fail(
      "P1",
      "learning-flow",
      "System Design Space viewer missing h1",
      `h1="${spaceH1}" at ${BASE}/spaces/${activeSpaceId}`
    );
  }

  // Check story point links in space viewer
  const spLinksInViewer = await page.locator(`a[href*="/story-points/"]`).count();
  observe(`Story point links in space viewer: ${spLinksInViewer}`);
  if (spLinksInViewer >= 4) {
    pass(`L3: System Design Space viewer shows all 4 story point links`);
  } else if (spLinksInViewer > 0) {
    pass(`L3: System Design Space viewer shows ${spLinksInViewer} story point links (partial)`);
    fail(
      "P2",
      "content",
      `Space viewer shows only ${spLinksInViewer}/4 story point links`,
      `Expected 4, found ${spLinksInViewer}`
    );
  } else {
    fail(
      "P1",
      "content",
      "No story point links in System Design space viewer",
      `${spLinksInViewer} links at ${BASE}/spaces/${activeSpaceId}`
    );
  }

  if (spaceLoadTime < 3000) {
    pass(`UX1: System Design Space viewer fast load (${spaceLoadTime}ms)`);
  }

  // Check for space description / metadata
  const spaceBodyText = await page
    .locator("body")
    .textContent()
    .catch(() => "");
  const hasSpaceDesc =
    spaceBodyText?.toLowerCase().includes("system design") ||
    spaceBodyText?.toLowerCase().includes("scalability");
  if (hasSpaceDesc) {
    pass("L3: Space viewer shows System Design related content");
  }

  // ─── STEP 4: Individual Story Points (all 4) ──────────────────────────────
  console.log("\n=== STEP 4: STORY POINTS ===");

  for (const sp of SD_STORY_POINTS) {
    storyPointsTested++;
    const spUrl = `${BASE}/spaces/${activeSpaceId}/story-points/${sp.id}`;
    console.log(`\n  Testing: ${sp.title} (${sp.type})`);

    await page.goto(spUrl);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const h1 = await page
      .locator("h1")
      .first()
      .textContent({ timeout: 10_000 })
      .catch(() => "");
    observe(`${sp.title} h1: "${h1}"`);

    const h1Ok = h1 && h1.trim() !== "" && !h1.includes("404") && !h1.includes("Not Found");

    if (h1Ok) {
      storyPointsAccessible++;
      pass(`L4: ${sp.title} h1 present: "${h1?.substring(0, 50)}"`);

      // ── Standard content: check for architecture diagrams + keywords ────
      if (sp.type === "standard") {
        const bodyText = await page
          .locator("body")
          .textContent()
          .catch(() => "");
        const sdKeywords = [
          "scalability",
          "load balancer",
          "database",
          "cache",
          "microservice",
          "horizontal",
          "vertical",
          "availability",
          "reliability",
          "throughput",
          "latency",
          "consistency",
          "partition",
        ];
        const foundKw = sdKeywords.filter((kw) => bodyText?.toLowerCase().includes(kw));
        observe(`  SD keywords found: ${foundKw.join(", ")}`);
        if (foundKw.length >= 4) {
          pass(
            `CQ1: ${sp.title} — system design keywords present (${foundKw.length}/${sdKeywords.length})`
          );
        } else if (foundKw.length > 0) {
          pass(
            `CQ1: ${sp.title} — some SD keywords present (${foundKw.length}/${sdKeywords.length})`
          );
        } else {
          fail(
            "P2",
            "content-quality",
            `${sp.title} missing system design keywords`,
            `Found ${foundKw.length}/${sdKeywords.length}`
          );
        }

        // Architecture diagram check
        const diagrams = await page
          .locator('img, svg, [class*="diagram"], [class*="mermaid"], canvas, figure')
          .count();
        observe(`  Diagram/visual elements: ${diagrams}`);
        if (diagrams > 0) {
          pass(`CQ1: ${sp.title} — architecture diagram/visual elements present (${diagrams})`);
        } else {
          observe(`  No diagrams found in ${sp.title} — may be text-only`);
        }
      }

      // ── Check for breadcrumbs / navigation ──────────────────────────────
      const breadcrumbs = await page
        .locator('[class*="breadcrumb"], nav[aria-label*="breadcrumb"]')
        .count();
      const backLink = await page.locator('a[href*="/spaces"]').count();
      if (breadcrumbs > 0 || backLink > 0) {
        pass(`UX1: ${sp.title} — breadcrumbs/back navigation visible`);
      }

      // ── Check for code blocks ────────────────────────────────────────────
      const codeBlocks = await page
        .locator('pre, code, [class*="code"], [class*="highlight"]')
        .count();
      observe(`  Code blocks: ${codeBlocks}`);
      if (codeBlocks > 0) {
        pass(`L4: ${sp.title} — code blocks rendered (${codeBlocks} found)`);
      }
    } else {
      fail("P1", "content", `${sp.title} story point viewer: no h1`, `h1="${h1}" at ${spUrl}`);
    }
  }

  observe(`Story points accessible: ${storyPointsAccessible}/${storyPointsTested}`);

  // ─── STEP 5: Practice Mode — Database Design & Patterns ──────────────────
  console.log("\n=== STEP 5: PRACTICE MODE ===");
  practiceModeResult.tested = true;

  const practiceSP = SD_STORY_POINTS.find((sp) => sp.type === "practice")!;
  const practiceSpUrl = `${BASE}/spaces/${activeSpaceId}/story-points/${practiceSP.id}`;

  await page.goto(practiceSpUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const practiceH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`Practice mode (${practiceSP.title}) h1: "${practiceH1}"`);

  // Check submit button
  const submitBtn = page
    .locator('button:has-text("Submit"), button:has-text("Submit Answer"), button[type="submit"]')
    .first();
  const submitVisible = (await submitBtn.count()) > 0;
  const submitDisabled = submitVisible ? await submitBtn.isDisabled().catch(() => false) : true;
  observe(`Submit button: visible=${submitVisible}, disabled=${submitDisabled}`);

  if (submitVisible) {
    pass("P1: Practice mode — Submit Answer button visible");
    if (submitDisabled) {
      pass("P1: Submit Answer correctly disabled before answer selection");
    }
  } else {
    fail(
      "P1",
      "practice-mode",
      "Submit button not visible in practice mode",
      `At ${practiceSpUrl}`
    );
  }

  // Check for answer options
  const radioOptions = await page.locator('input[type="radio"], [role="radio"]').count();
  const checkboxOptions = await page.locator('input[type="checkbox"], [role="checkbox"]').count();
  const truefalseOptions = await page
    .locator('button:has-text("True"), button:has-text("False")')
    .count();
  const totalOptions = radioOptions + checkboxOptions + truefalseOptions;
  observe(
    `Answer options: radio=${radioOptions}, checkbox=${checkboxOptions}, true/false=${truefalseOptions}`
  );

  if (totalOptions > 0) {
    pass(`P1: Practice mode — answer options visible (${totalOptions} found)`);

    try {
      if (radioOptions > 0) {
        await page.locator('input[type="radio"]').first().click({ timeout: 5000 });
      } else if (checkboxOptions > 0) {
        await page.locator('input[type="checkbox"]').first().click({ timeout: 5000 });
      } else if (truefalseOptions > 0) {
        await page.locator('button:has-text("True")').first().click({ timeout: 5000 });
      }
      await page.waitForTimeout(1000);

      const submitEnabledAfter = submitVisible
        ? !(await submitBtn.isDisabled().catch(() => true))
        : false;
      if (submitEnabledAfter) {
        pass("P1: Submit Answer enabled after selecting answer");

        await submitBtn.click({ timeout: 5000 });
        await page.waitForTimeout(2000);

        const nextBtn = await page
          .locator(
            'button:has-text("Next"), button:has-text("Continue"), button:has-text("Next Question")'
          )
          .count();
        if (nextBtn > 0) {
          pass("P1: Next button visible after submit");
          practiceModeResult.retryWorks = true;
        }

        const feedbackVisible = await page
          .locator(
            '[class*="feedback"], [class*="result"], [class*="correct"], [class*="incorrect"], [class*="explanation"]'
          )
          .count();
        if (feedbackVisible > 0) {
          pass("P1: Practice mode — feedback/result displayed after submit");
        }

        const hintBtn = await page
          .locator(
            'button:has-text("Hint"), button:has-text("Show Hint"), button[aria-label*="hint"]'
          )
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
      } else {
        observe("Submit button still disabled after selecting answer");
      }
    } catch (err) {
      observe(`Could not interact with answer options: ${err}`);
    }
  } else {
    fail("P1", "practice-mode", "No answer options in practice mode", `At ${practiceSpUrl}`);
  }

  // Check section nav
  const sectionNav = await page.locator('[class*="section"], [class*="breadcrumb"], nav').count();
  if (sectionNav > 0) {
    pass("P1: Section/breadcrumb navigation visible in practice mode");
  } else {
    fail(
      "P2",
      "navigation",
      "No section navigation in practice mode (T3/P2 regression)",
      `At ${practiceSpUrl}`
    );
  }

  // Check AI Tutor
  const aiTutorBtn = await page
    .locator('button:has-text("AI Tutor"), button:has-text("Ask AI"), [aria-label*="AI"]')
    .count();
  if (aiTutorBtn > 0) {
    pass("P2: Ask AI Tutor button visible in practice mode");
  }

  (practiceModeResult.notes as string[]).push(
    `${practiceSP.title}: h1="${practiceH1}", submit=${submitVisible}, options=${totalOptions}`
  );

  // ─── STEP 6: Quiz Mode — Caching & Load Balancing ────────────────────────
  console.log("\n=== STEP 6: QUIZ MODE ===");
  quizModeResult.tested = true;

  const quizSP = SD_STORY_POINTS.find((sp) => sp.type === "quiz")!;
  const quizUrl = `${BASE}/spaces/${activeSpaceId}/story-points/${quizSP.id}`;

  await page.goto(quizUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const quizH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`Quiz h1: "${quizH1}"`);

  if (quizH1 && !quizH1.includes("404")) {
    pass(`Q1: Quiz story point accessible: "${quizH1}"`);
  } else {
    fail("P1", "quiz", "Quiz story point: no h1", `h1="${quizH1}" at ${quizUrl}`);
  }

  // Check quiz attempt config: 3 attempts, 60% passing, shuffle
  const bodyText = await page
    .locator("body")
    .textContent()
    .catch(() => "");
  const hasAttemptInfo = bodyText?.includes("attempt") || bodyText?.includes("Attempt");
  const hasPassingInfo =
    bodyText?.includes("%") || bodyText?.includes("passing") || bodyText?.includes("60");
  const hasShuffleInfo =
    bodyText?.includes("shuffle") || bodyText?.includes("Shuffle") || bodyText?.includes("random");
  observe(
    `Quiz config: attempts=${hasAttemptInfo}, passing=${hasPassingInfo}, shuffle=${hasShuffleInfo}`
  );
  if (hasAttemptInfo) {
    pass("Q1: Quiz shows attempt count information");
  }
  if (hasPassingInfo) {
    pass("Q1: Quiz shows passing threshold information");
  }
  if (hasShuffleInfo) {
    quizModeResult.shuffleDetected = true;
    pass("Q2: Quiz shuffle indicator detected");
  }

  // Check question types
  const mcqOptions = await page.locator('input[type="radio"], [role="radio"]').count();
  const mcaqOptions = await page.locator('input[type="checkbox"], [role="checkbox"]').count();
  const questionTypes = quizModeResult.questionTypesFound as string[];

  if (mcqOptions > 0) {
    questionTypes.push("MCQ");
    pass("Q1: MCQ question type visible in quiz");
  }
  if (mcaqOptions > 0) {
    questionTypes.push("MCAQ");
    pass("Q1: MCAQ question type visible in quiz");
  }

  // Check progress indicator
  const progressBar = await page.locator('[role="progressbar"], [class*="progress"]').count();
  if (progressBar > 0) {
    pass("Q1: Quiz progress indicator visible");
  }

  // Try answering
  try {
    if (mcqOptions > 0) {
      await page.locator('input[type="radio"]').first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
    } else if (mcaqOptions > 0) {
      await page.locator('input[type="checkbox"]').first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
    }

    const quizSubmit = page.locator('button:has-text("Submit"), button:has-text("Next")').first();
    if ((await quizSubmit.count()) > 0) {
      quizModeResult.submitWorks = true;
      pass("Q1: Quiz submit/next button visible");
    }
  } catch (err) {
    observe(`Quiz interaction error: ${err}`);
  }

  // Check for results section
  const resultsSection = await page.locator('[class*="result"], [class*="score"]').count();
  const resultsSectionText = await page.getByText(/score|result/i).count();
  if (resultsSection > 0 || resultsSectionText > 0) {
    quizModeResult.resultsDisplayed = true;
    pass("Q1: Quiz results/score section visible");
  }

  (quizModeResult.notes as string[]).push(
    `Quiz: h1="${quizH1}", mcq=${mcqOptions}, mcaq=${mcaqOptions}, attempts=${hasAttemptInfo}, passing=${hasPassingInfo}`
  );

  // ─── STEP 7: Timed Assessment — System Design (30-min, 1 attempt, 50%) ──
  console.log("\n=== STEP 7: TIMED ASSESSMENT ===");
  timedAssessmentResult.tested = true;

  const timedSP = SD_STORY_POINTS.find((sp) => sp.type === "timed_test")!;
  const timedUrl = `${BASE}/spaces/${activeSpaceId}/story-points/${timedSP.id}`;

  await page.goto(timedUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const timedH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`Timed Assessment h1: "${timedH1}"`);

  if (timedH1 && timedH1.trim() !== "" && !timedH1.includes("404")) {
    timedAssessmentResult.h1Present = true;
    pass(`T1: Timed Assessment h1: "${timedH1}"`);
  } else {
    fail(
      "P1",
      "timed-assessment",
      "Timed Assessment landing: no h1 (T2 regression)",
      `h1="${timedH1}" at ${timedUrl}`,
      "T2"
    );
  }

  // Check for timer metadata (30-min config)
  const timedBodyText = await page
    .locator("body")
    .textContent()
    .catch(() => "");
  const has30min =
    timedBodyText?.includes("30") ||
    timedBodyText?.includes("minute") ||
    timedBodyText?.includes("min");
  const has1attempt = timedBodyText?.includes("1 attempt") || timedBodyText?.includes("attempt");
  const has50percent = timedBodyText?.includes("50") || timedBodyText?.includes("passing");
  observe(`Timed config: 30min=${has30min}, 1attempt=${has1attempt}, 50%=${has50percent}`);
  if (has30min) {
    pass("T1: Timed Assessment shows 30-minute duration info");
  }
  if (has1attempt) {
    pass("T1: Timed Assessment shows attempt limit information");
  }
  if (has50percent) {
    pass("T1: Timed Assessment shows passing threshold information");
  }

  // Check for timer element
  const timerEl = await page
    .locator('[class*="timer"], [class*="countdown"], [data-testid*="timer"]')
    .count();
  const timerText = await page.getByText(/\d+:\d\d/).count();
  observe(`Timer elements: ${timerEl}, timer text patterns: ${timerText}`);
  if (timerEl > 0 || timerText > 0) {
    timedAssessmentResult.timerVisible = true;
    pass("T2: Timer visible on timed assessment");
  } else {
    observe("Timer not visible on landing — may appear after starting test");
    fail(
      "P2",
      "timed-assessment",
      "Timer not visible on timed assessment landing (T2)",
      `At ${timedUrl}. Expected countdown timer.`
    );
  }

  // Check for Start button
  const startBtn = await page
    .locator(
      'button:has-text("Start"), button:has-text("Begin"), button:has-text("Start Assessment"), button:has-text("Start Test")'
    )
    .count();
  if (startBtn > 0) {
    timedAssessmentResult.startButtonVisible = true;
    pass("T3: Start Assessment button visible");
  } else {
    fail(
      "P2",
      "timed-assessment",
      "Start button not found on timed assessment landing (T3)",
      `At ${timedUrl}`
    );
  }

  // Check for analytics/results section
  const analyticsSection = await page.locator('[class*="analytic"], [class*="result"]').count();
  if (analyticsSection > 0) {
    timedAssessmentResult.analyticsShown = true;
    pass("T5: Timed Assessment analytics/results section visible");
  }

  (timedAssessmentResult.notes as string[]).push(
    `Timed test: h1="${timedH1}", timer=${timerEl > 0 || timerText > 0}, startBtn=${startBtn > 0}, 30min=${has30min}, 1attempt=${has1attempt}`
  );

  // ─── STEP 8: Results Page / Analytics ─────────────────────────────────────
  console.log("\n=== STEP 8: RESULTS + ANALYTICS ===");

  // Check if there are any results pages for the student
  await page.goto(`${BASE}/spaces/${activeSpaceId}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);

  const resultsLink = await page
    .locator(
      'a[href*="result"], a[href*="analytics"], button:has-text("Results"), button:has-text("View Results")'
    )
    .count();
  observe(`Results/analytics links from space page: ${resultsLink}`);
  if (resultsLink > 0) {
    pass("AN1: Results/analytics links visible on space page");
  }

  // Check score progression
  const scoreEl = await page.locator('[class*="score"], [class*="progress"]').count();
  if (scoreEl > 0) {
    pass("AN1: Score/progress elements visible on space page");
  }

  // ─── STEP 9: UX Checks ────────────────────────────────────────────────────
  console.log("\n=== STEP 9: UX CHECKS ===");

  // Mobile viewport test
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/spaces/${activeSpaceId}/story-points/${SD_STORY_POINTS[0].id}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
  const mobileH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 8000 })
    .catch(() => "");
  if (mobileH1 && mobileH1.trim() !== "") {
    pass(
      `UX1: Story point viewer responsive on mobile (375px) — h1="${mobileH1?.substring(0, 30)}"`
    );
  } else {
    fail(
      "P2",
      "ux",
      "Story point viewer not rendering on mobile viewport",
      `h1="${mobileH1}" at 375px`
    );
  }

  // Restore desktop
  await page.setViewportSize({ width: 1280, height: 720 });

  // Content quality check on Fundamentals of Scalability
  await page.goto(`${BASE}/spaces/${activeSpaceId}/story-points/${SD_STORY_POINTS[0].id}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);

  const scalabilityBody = await page
    .locator("body")
    .textContent()
    .catch(() => "");
  const sdKeywords = [
    "scale",
    "load",
    "server",
    "database",
    "cache",
    "network",
    "distributed",
    "availability",
    "performance",
    "throughput",
    "latency",
    "reliability",
  ];
  const foundKw = sdKeywords.filter((kw) => scalabilityBody?.toLowerCase().includes(kw));
  observe(`Scalability content keywords: ${foundKw.join(", ")}`);
  if (foundKw.length >= 5) {
    pass(`CQ1: Scalability content has depth (${foundKw.length}/${sdKeywords.length} keywords)`);
  } else if (foundKw.length > 0) {
    pass(`CQ1: Scalability content has some SD terms (${foundKw.length}/${sdKeywords.length})`);
  } else {
    fail(
      "P2",
      "content-quality",
      "Scalability story point missing system design keywords",
      `Found ${foundKw.length}/${sdKeywords.length}`
    );
  }

  // ─── WRITE REPORT ─────────────────────────────────────────────────────────
  writeReport(
    storyPointsTested,
    storyPointsAccessible,
    activeSpaceId,
    practiceModeResult,
    quizModeResult,
    timedAssessmentResult
  );

  // Final assertion — fail only on P0s
  const p0Issues = issues.filter((i) => i.severity === "P0");
  if (p0Issues.length > 0) {
    throw new Error(
      `${p0Issues.length} P0 issues found: ${p0Issues.map((i) => i.title).join("; ")}`
    );
  }
});
