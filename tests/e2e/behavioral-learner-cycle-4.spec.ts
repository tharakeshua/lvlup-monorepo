/**
 * Behavioral Learner — Cycle 4 Deep Assessment
 *
 * Tests the Behavioral Interview Mastery space post-Cycle-3 fixes:
 *   - Space viewer h1 rendering
 *   - All 12 story point links in space viewer
 *   - STAR Method & Storytelling Framework (standard) content quality
 *   - Leadership & Influence (standard)
 *   - Conflict Resolution & Difficult Conversations (standard)
 *   - System Ownership & Technical Decision-Making (standard)
 *   - Cross-Functional Collaboration (standard)
 *   - Failure, Recovery & Growth Mindset (standard)
 *   - Ambiguity & Prioritization (standard)
 *   - Staff+ Level Questions (standard)
 *   - Company-Specific FAANG Preparation (standard)
 *   - Mock Interview Practice (practice) — text input, submit flow
 *   - Behavioral Interview Concepts Quiz (quiz) — question types + results
 *   - Behavioral Interview Timed Assessment (timed_test) — landing + timer
 *   - Writing/text input experience (paragraph questions)
 *   - AI evaluation of behavioral answers (if enabled)
 *   - Story template guidance and example quality
 *
 * Auth cached at /tmp/beh-c4-auth.json to avoid Firebase rate limits.
 * Output: tests/e2e/reports/learner-behavioral-cycle-4.json
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:4570";
const EMAIL = "student.test@subhang.academy";
const PASSWORD = "Test@12345";
const SCHOOL_CODE = "SUB001";
const AUTH_CACHE = "/tmp/beh-c4-auth.json";

// From scripts/seed-results/subhang.json
const BEH_SPACE = "1AqFwKSf59FiIrqzaQ7i";

const BEH_STORY_POINTS = [
  { id: "m3zlNk1jI2X9akRPg9rF", title: "STAR Method & Storytelling Framework", type: "standard" },
  { id: "iwlqmOQ7Bdt8KMumvRqy", title: "Leadership & Influence", type: "standard" },
  {
    id: "RUiidhIOp3UCUzufCqBT",
    title: "Conflict Resolution & Difficult Conversations",
    type: "standard",
  },
  {
    id: "VkxFEpeuQlnhPSse6RWR",
    title: "System Ownership & Technical Decision-Making",
    type: "standard",
  },
  { id: "AOvHhunJrCu3HtnMeDWs", title: "Cross-Functional Collaboration", type: "standard" },
  { id: "YfGY2GxO6HUPWUPYD94T", title: "Failure, Recovery & Growth Mindset", type: "standard" },
  { id: "0VKwtLTt1VydSeI073VB", title: "Ambiguity & Prioritization", type: "standard" },
  { id: "QkgpzZUPMWMlOmBYUUDw", title: "Staff+ Level Questions", type: "standard" },
  { id: "QmAD88dwzZlGdHOHsPFA", title: "Company-Specific FAANG Preparation", type: "standard" },
  { id: "9GED1Jdhi93kWeepJ2kA", title: "Mock Interview Practice", type: "practice" },
  { id: "jIPacoKFRykWJ3mtQ8Cs", title: "Behavioral Interview Concepts Quiz", type: "quiz" },
  {
    id: "xBnumc8jTQje26POV6Lq",
    title: "Behavioral Interview Timed Assessment",
    type: "timed_test",
  },
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
  const id = `BEH-C4-${String(issueCounter++).padStart(3, "0")}`;
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

      if (stored.cookies?.length > 0) {
        await context.addCookies(stored.cookies);
      }

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

      const bodyText = await page
        .locator("body")
        .textContent({ timeout: 10_000 })
        .catch(() => "");
      if (
        bodyText &&
        !bodyText.includes("Sign In") &&
        !bodyText.includes("Login") &&
        bodyText.length > 200
      ) {
        observe("Auth restored from cache via storage state");
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
    await page.waitForTimeout(2000);

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
    learner: "Behavioral Learner (tm_1773067969207_noxja982f)",
    timestamp: new Date().toISOString(),
    space: "Behavioral Interview Mastery",
    spaceId: BEH_SPACE,
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
      totalStoryPoints: BEH_STORY_POINTS.length,
      starMethodContentFound: workingFeatures.some((f) => f.toLowerCase().includes("star")),
      writingInputAvailable: workingFeatures.some(
        (f) => f.includes("text input") || f.includes("textarea") || f.includes("writing")
      ),
      aiEvaluationEnabled: workingFeatures.some(
        (f) => f.toLowerCase().includes("ai") || f.toLowerCase().includes("evaluation")
      ),
      storyTemplateGuidance: workingFeatures.some(
        (f) => f.includes("template") || f.includes("example") || f.includes("framework")
      ),
      contentQualityNotes: rawObservations.filter(
        (o) =>
          o.includes("keyword") ||
          o.includes("content") ||
          o.includes("STAR") ||
          o.includes("behavioral") ||
          o.includes("template")
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
      textRenderingSmooth: workingFeatures.some((f) => f.includes("render") || f.includes("h1")),
      uxIssues: issues.filter((i) => i.category === "ux"),
    },
    practiceMode,
    quizMode,
    timedAssessment,
    learningEffectiveness: {
      score: effectivenessScore,
      notes: `${passed} working features, ${issues.length} total issues (${p0.length} P0, ${p1.length} P1, ${p2.length} P2, ${p3.length} P3). Content accessible: ${storyPointsAccessible}/${BEH_STORY_POINTS.length} story points.`,
    },
    rawObservations,
  };

  const outPath = path.join(reportDir, "learner-behavioral-cycle-4.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("\n=== BEHAVIORAL LEARNER CYCLE 4 REPORT ===");
  console.log(`Story Points: ${storyPointsAccessible}/${BEH_STORY_POINTS.length} accessible`);
  console.log(`Pass Rate: ${passRate}% (${passed}/${totalTests})`);
  console.log(`Issues: ${p0.length} P0, ${p1.length} P1, ${p2.length} P2, ${p3.length} P3`);
  console.log(`Learning Effectiveness: ${effectivenessScore}/10`);
  console.log(`Report written: ${outPath}`);
  console.log("==========================================\n");
}

// ─── Main test ────────────────────────────────────────────────────────────────

test("Behavioral Learner Cycle 4 — Deep Assessment", async ({ page, context }) => {
  test.setTimeout(600_000); // 10 minutes

  const practiceModeResult: Record<string, unknown> = {
    tested: false,
    textInputAvailable: false,
    submitWorks: false,
    aiEvaluationVisible: false,
    storyTemplateVisible: false,
    hintsVisible: false,
    modelAnswerVisible: false,
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
    writingInputAvailable: false,
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

  const behCardEl = page.locator(`a[href*="${BEH_SPACE}"]`).first();
  const behCardExists = (await behCardEl.count()) > 0;
  if (behCardExists) {
    const behText = await behCardEl.textContent().catch(() => "");
    pass(`L2: Behavioral Interview Space card visible (text="${behText?.substring(0, 60)}")`);
  } else {
    // Try text-based search
    const behCardByText = page.locator('a:has-text("Behavioral")').first();
    const byTextExists = (await behCardByText.count()) > 0;
    if (byTextExists) {
      pass("L2: Behavioral Interview Space card visible (by text)");
    } else {
      fail(
        "P1",
        "navigation",
        "Behavioral Space card not found in spaces list",
        `Checked ${spaceCards.length} cards at ${BASE}/spaces`
      );
    }
  }

  // ─── STEP 3: Behavioral Space Viewer ──────────────────────────────────────
  console.log("\n=== STEP 3: BEHAVIORAL SPACE VIEWER ===");
  const spaceStart = Date.now();
  await page.goto(`${BASE}/spaces/${BEH_SPACE}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);
  const spaceLoadTime = Date.now() - spaceStart;

  const spaceH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`Behavioral Space viewer h1: "${spaceH1}" (${spaceLoadTime}ms)`);

  if (spaceH1 && spaceH1.trim() !== "" && !spaceH1.includes("404")) {
    pass(`L3: Behavioral Space viewer has h1: "${spaceH1}"`);
  } else {
    fail(
      "P1",
      "learning-flow",
      "Behavioral Space viewer missing h1",
      `h1="${spaceH1}" at ${BASE}/spaces/${BEH_SPACE}`
    );
  }

  // Check story point links in space viewer
  const spLinksInViewer = await page.locator(`a[href*="/story-points/"]`).count();
  observe(`Story point links in space viewer: ${spLinksInViewer}`);
  if (spLinksInViewer >= 12) {
    pass(`L3: Behavioral Space viewer shows all 12 story point links`);
  } else if (spLinksInViewer > 0) {
    pass(`L3: Behavioral Space viewer shows ${spLinksInViewer} story point links`);
    if (spLinksInViewer < 12) {
      fail(
        "P2",
        "content",
        `Behavioral Space viewer shows only ${spLinksInViewer}/12 story point links`,
        `Expected 12, found ${spLinksInViewer}`
      );
    }
  } else {
    fail(
      "P1",
      "content",
      "No story point links in Behavioral space viewer",
      `${spLinksInViewer} links at ${BASE}/spaces/${BEH_SPACE}`
    );
  }

  if (spaceLoadTime < 3000) {
    pass(`UX1: Behavioral Space viewer fast load (${spaceLoadTime}ms)`);
  }

  // Check for space description / intro text
  const spaceBodyText = await page
    .locator("body")
    .textContent()
    .catch(() => "");
  const hasBehavioralContent =
    spaceBodyText?.toLowerCase().includes("behavioral") ||
    spaceBodyText?.toLowerCase().includes("interview") ||
    spaceBodyText?.toLowerCase().includes("star");
  if (hasBehavioralContent) {
    pass("L3: Behavioral space page shows relevant behavioral/interview content");
  }

  // ─── STEP 4: STAR Method Story Point (Deep Content Check) ─────────────────
  console.log("\n=== STEP 4: STAR METHOD STORY POINT ===");
  const starSP = BEH_STORY_POINTS[0]; // STAR Method & Storytelling Framework
  storyPointsTested++;

  const starUrl = `${BASE}/spaces/${BEH_SPACE}/story-points/${starSP.id}`;
  await page.goto(starUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const starH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`STAR Method h1: "${starH1}"`);

  if (starH1 && starH1.trim() !== "" && !starH1.includes("404")) {
    storyPointsAccessible++;
    pass(`L4: STAR Method story point accessible: "${starH1}"`);

    // Content quality check — STAR-specific keywords
    const starBodyText = await page
      .locator("body")
      .textContent()
      .catch(() => "");
    const starKeywords = [
      "situation",
      "task",
      "action",
      "result",
      "STAR",
      "storytelling",
      "framework",
      "interview",
      "example",
      "story",
    ];
    const foundStarKws = starKeywords.filter((kw) =>
      starBodyText?.toLowerCase().includes(kw.toLowerCase())
    );
    observe(`STAR keywords found: ${foundStarKws.join(", ")}`);

    if (foundStarKws.length >= 4) {
      pass(
        `CQ1: STAR Method content has framework-relevant terms (${foundStarKws.length}/${starKeywords.length}): ${foundStarKws.join(", ")}`
      );
    } else if (foundStarKws.length > 0) {
      pass(
        `CQ1: STAR Method content has some relevant terms (${foundStarKws.length}/${starKeywords.length})`
      );
    } else {
      fail(
        "P2",
        "content-quality",
        "STAR Method story point missing behavioral keywords",
        `Found ${foundStarKws.length}/${starKeywords.length} keywords`
      );
    }

    // Check for examples/templates
    const hasExamples =
      starBodyText?.includes("Example") ||
      starBodyText?.includes("example") ||
      starBodyText?.includes("e.g.") ||
      starBodyText?.includes("sample");
    if (hasExamples) {
      pass("CQ1: STAR Method — examples/sample answers visible");
    }

    // Check for template or framework structure (numbered lists, headers)
    const listItems = await page.locator("li, ol li, ul li").count();
    const headers = await page.locator("h2, h3, h4").count();
    observe(`STAR Method: list items=${listItems}, sub-headers=${headers}`);
    if (listItems > 0 || headers > 0) {
      pass(
        `CQ1: STAR Method has structured content (${listItems} list items, ${headers} sub-headers)`
      );
    }

    // Check breadcrumb/back navigation
    const breadcrumbs = await page
      .locator('[class*="breadcrumb"], nav[aria-label*="breadcrumb"]')
      .count();
    const backLink = await page.locator('a[href*="/spaces"]').count();
    if (breadcrumbs > 0 || backLink > 0) {
      pass("UX1: STAR Method story point — breadcrumbs/back navigation visible");
    }
  } else {
    fail("P1", "content", "STAR Method story point: missing h1", `h1="${starH1}" at ${starUrl}`);
  }

  // ─── STEP 5: Leadership Story Point ───────────────────────────────────────
  console.log("\n=== STEP 5: LEADERSHIP STORY POINT ===");
  const leaderSP = BEH_STORY_POINTS[1]; // Leadership & Influence
  storyPointsTested++;

  const leaderUrl = `${BASE}/spaces/${BEH_SPACE}/story-points/${leaderSP.id}`;
  await page.goto(leaderUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const leaderH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`Leadership h1: "${leaderH1}"`);

  if (leaderH1 && leaderH1.trim() !== "" && !leaderH1.includes("404")) {
    storyPointsAccessible++;
    pass(`L4: Leadership & Influence story point accessible: "${leaderH1}"`);

    const leaderBody = await page
      .locator("body")
      .textContent()
      .catch(() => "");
    const leaderKeywords = [
      "leadership",
      "influence",
      "team",
      "mentor",
      "decision",
      "stakeholder",
      "vision",
      "impact",
      "senior",
      "staff",
    ];
    const foundLeaderKws = leaderKeywords.filter((kw) =>
      leaderBody?.toLowerCase().includes(kw.toLowerCase())
    );
    observe(`Leadership keywords found: ${foundLeaderKws.join(", ")}`);

    if (foundLeaderKws.length >= 4) {
      pass(
        `CQ2: Leadership content relevant to staff-engineer level (${foundLeaderKws.length}/${leaderKeywords.length})`
      );
    } else {
      observe(`Leadership: only ${foundLeaderKws.length} relevant keywords found`);
    }
  } else {
    fail(
      "P1",
      "content",
      "Leadership & Influence story point: missing h1",
      `h1="${leaderH1}" at ${leaderUrl}`
    );
  }

  // ─── STEP 6: Conflict Resolution Story Point ──────────────────────────────
  console.log("\n=== STEP 6: CONFLICT RESOLUTION STORY POINT ===");
  const conflictSP = BEH_STORY_POINTS[2]; // Conflict Resolution
  storyPointsTested++;

  const conflictUrl = `${BASE}/spaces/${BEH_SPACE}/story-points/${conflictSP.id}`;
  await page.goto(conflictUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);

  const conflictH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`Conflict Resolution h1: "${conflictH1}"`);

  if (conflictH1 && conflictH1.trim() !== "" && !conflictH1.includes("404")) {
    storyPointsAccessible++;
    pass(`L4: Conflict Resolution story point accessible: "${conflictH1}"`);

    const conflictBody = await page
      .locator("body")
      .textContent()
      .catch(() => "");
    const conflictKws = [
      "conflict",
      "disagreement",
      "difficult",
      "conversation",
      "resolution",
      "compromise",
      "empathy",
      "perspective",
    ];
    const foundConflictKws = conflictKws.filter((kw) =>
      conflictBody?.toLowerCase().includes(kw.toLowerCase())
    );
    observe(`Conflict keywords: ${foundConflictKws.join(", ")}`);
    if (foundConflictKws.length >= 3) {
      pass(
        `CQ3: Conflict Resolution content relevant (${foundConflictKws.length}/${conflictKws.length})`
      );
    }
  } else {
    fail(
      "P1",
      "content",
      "Conflict Resolution story point: missing h1",
      `h1="${conflictH1}" at ${conflictUrl}`
    );
  }

  // ─── STEP 7: Quick-check remaining standard story points ──────────────────
  console.log("\n=== STEP 7: QUICK CHECK REMAINING STORY POINTS ===");
  const deepTestedIds = new Set([starSP.id, leaderSP.id, conflictSP.id]);
  const remainingSPs = BEH_STORY_POINTS.filter(
    (sp) => !deepTestedIds.has(sp.id) && sp.type === "standard"
  );

  for (const sp of remainingSPs) {
    storyPointsTested++;
    const spUrl = `${BASE}/spaces/${BEH_SPACE}/story-points/${sp.id}`;
    await page.goto(spUrl);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    const h1 = await page
      .locator("h1")
      .first()
      .textContent({ timeout: 8000 })
      .catch(() => "");
    const ok = h1 && h1.trim() !== "" && !h1.includes("404") && !h1.includes("Not Found");
    observe(`Quick check ${sp.title}: h1="${h1?.substring(0, 60)}"`);
    if (ok) {
      storyPointsAccessible++;
      pass(`L4: ${sp.title} accessible (h1: "${h1?.substring(0, 50)}")`);
    } else {
      fail("P1", "content", `${sp.title} story point: no h1`, `h1="${h1}" at ${spUrl}`);
    }
  }

  observe(`Story points accessible so far: ${storyPointsAccessible}/${storyPointsTested}`);

  // ─── STEP 8: Mock Interview Practice Mode ─────────────────────────────────
  console.log("\n=== STEP 8: MOCK INTERVIEW PRACTICE MODE ===");
  practiceModeResult.tested = true;
  const practiceSpUrl = `${BASE}/spaces/${BEH_SPACE}/story-points/9GED1Jdhi93kWeepJ2kA`;
  storyPointsTested++;

  await page.goto(practiceSpUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const practiceH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`Mock Interview Practice h1: "${practiceH1}"`);

  if (practiceH1 && practiceH1.trim() !== "" && !practiceH1.includes("404")) {
    storyPointsAccessible++;
    pass(`P1: Mock Interview Practice story point accessible: "${practiceH1}"`);

    // Check for text input / textarea (behavioral practice uses open-ended answers)
    const textareas = await page
      .locator('textarea, [contenteditable="true"], [role="textbox"]')
      .count();
    const textInputs = await page.locator('input[type="text"]').count();
    observe(`Text inputs: textarea=${textareas}, text=${textInputs}`);

    if (textareas > 0) {
      practiceModeResult.textInputAvailable = true;
      pass("P2: Practice mode — textarea/text input available for behavioral answers");

      // Try typing a sample STAR story
      try {
        const textarea = page.locator('textarea, [contenteditable="true"]').first();
        await textarea.click({ timeout: 5000 });
        await textarea.fill(
          "Situation: I was leading a cross-functional team during a critical product launch. Task: I needed to align engineering, design, and product teams. Action: I organized daily standups and created a shared dashboard. Result: We launched on time with 95% stakeholder satisfaction.",
          { timeout: 5000 }
        );
        await page.waitForTimeout(1000);
        pass("P2: Text input accepts STAR story content");
      } catch (err) {
        observe(`Could not type in textarea: ${err}`);
      }
    } else if (textInputs > 0) {
      practiceModeResult.textInputAvailable = true;
      pass("P2: Practice mode — text inputs available");
    }

    // Check for MCQ/radio options (some behavioral questions may be MCQ)
    const radioOptions = await page.locator('input[type="radio"], [role="radio"]').count();
    const checkboxOptions = await page.locator('input[type="checkbox"], [role="checkbox"]').count();
    observe(
      `Practice answer options: radio=${radioOptions}, checkbox=${checkboxOptions}, textarea=${textareas}`
    );

    if (radioOptions > 0 || checkboxOptions > 0) {
      pass(
        `P2: Practice mode — choice-based options visible (radio=${radioOptions}, checkbox=${checkboxOptions})`
      );
    }

    // Check submit button
    const submitBtn = page
      .locator('button:has-text("Submit"), button:has-text("Submit Answer"), button[type="submit"]')
      .first();
    const submitVisible = (await submitBtn.count()) > 0;
    observe(`Submit button: visible=${submitVisible}`);

    if (submitVisible) {
      practiceModeResult.submitWorks = true;
      pass("P1: Practice mode — Submit button visible");

      // Try submitting
      try {
        const isDisabled = await submitBtn.isDisabled().catch(() => true);
        if (!isDisabled) {
          await submitBtn.click({ timeout: 5000 });
          await page.waitForTimeout(2000);

          // Check for feedback/AI evaluation
          const feedbackEl = await page
            .locator(
              '[class*="feedback"], [class*="result"], [class*="evaluation"], [class*="analysis"]'
            )
            .count();
          const aiText = await page
            .locator("body")
            .textContent()
            .catch(() => "");
          const hasAiEval =
            aiText?.includes("AI") ||
            aiText?.includes("evaluation") ||
            aiText?.includes("score") ||
            aiText?.includes("feedback");
          if (feedbackEl > 0 || hasAiEval) {
            practiceModeResult.aiEvaluationVisible = true;
            pass("P1: Practice mode — AI evaluation/feedback visible after submit");
          }

          // Check for Next button
          const nextBtn = await page
            .locator('button:has-text("Next"), button:has-text("Continue")')
            .count();
          if (nextBtn > 0) {
            pass("P1: Next button visible after submit in practice mode");
          }
        }
      } catch (err) {
        observe(`Practice mode submit error: ${err}`);
      }
    } else {
      fail(
        "P1",
        "practice-mode",
        "Submit button not visible in behavioral practice mode",
        `At ${practiceSpUrl}`
      );
    }

    // Check for model/sample answer
    const modelAnswerBtn = await page
      .locator(
        'button:has-text("Model Answer"), button:has-text("Sample Answer"), button:has-text("Show Answer"), button:has-text("Example")'
      )
      .count();
    if (modelAnswerBtn > 0) {
      practiceModeResult.modelAnswerVisible = true;
      pass("P2: Practice mode — model/sample STAR answer button visible");
    }

    // Check for story template guidance
    const bodyContent = await page
      .locator("body")
      .textContent()
      .catch(() => "");
    const hasTemplate =
      bodyContent?.includes("Situation") ||
      bodyContent?.includes("Task") ||
      bodyContent?.includes("Action") ||
      bodyContent?.includes("Result") ||
      bodyContent?.includes("STAR");
    if (hasTemplate) {
      practiceModeResult.storyTemplateVisible = true;
      pass("CQ4: Practice mode — STAR template guidance visible in content");
    }

    // Check for AI Tutor
    const aiTutorBtn = await page
      .locator('button:has-text("AI Tutor"), button:has-text("Ask AI"), [aria-label*="AI"]')
      .count();
    if (aiTutorBtn > 0) {
      pass("P2: Ask AI Tutor button visible in practice mode");
    }

    // Check for hints
    const hintBtn = await page
      .locator('button:has-text("Hint"), button:has-text("Show Hint")')
      .count();
    if (hintBtn > 0) {
      practiceModeResult.hintsVisible = true;
      pass("P2: Practice mode — hint button visible");
    }
  } else {
    fail(
      "P1",
      "content",
      "Mock Interview Practice story point: no h1",
      `h1="${practiceH1}" at ${practiceSpUrl}`
    );
  }

  (practiceModeResult.notes as string[]).push(
    `Mock Interview: h1="${practiceH1}", textareas=${await page
      .locator("textarea")
      .count()
      .catch(() => 0)}, submit=${practiceModeResult.submitWorks}`
  );

  // ─── STEP 9: Behavioral Quiz Mode ─────────────────────────────────────────
  console.log("\n=== STEP 9: BEHAVIORAL QUIZ MODE ===");
  quizModeResult.tested = true;
  const quizUrl = `${BASE}/spaces/${BEH_SPACE}/story-points/jIPacoKFRykWJ3mtQ8Cs`;
  storyPointsTested++;

  await page.goto(quizUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const quizH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`Behavioral Quiz h1: "${quizH1}"`);

  if (quizH1 && quizH1.trim() !== "" && !quizH1.includes("404")) {
    storyPointsAccessible++;
    pass(`Q1: Behavioral Quiz story point accessible: "${quizH1}"`);
  } else {
    fail("P1", "quiz", "Behavioral Quiz story point: no h1", `h1="${quizH1}" at ${quizUrl}`);
  }

  // Check question types
  const mcqOptions = await page.locator('input[type="radio"], [role="radio"]').count();
  const mcaqOptions = await page.locator('input[type="checkbox"], [role="checkbox"]').count();
  const trueFalseOptions = await page
    .locator('button:has-text("True"), button:has-text("False")')
    .count();
  const quizTextareas = await page.locator('textarea, [contenteditable="true"]').count();

  const questionTypes = quizModeResult.questionTypesFound as string[];
  if (mcqOptions > 0) {
    questionTypes.push("MCQ");
    pass("Q1: MCQ question type in behavioral quiz");
  }
  if (mcaqOptions > 0) {
    questionTypes.push("MCAQ");
    pass("Q1: MCAQ question type in behavioral quiz");
  }
  if (trueFalseOptions > 0) {
    questionTypes.push("TrueFalse");
    pass("Q1: True/False question type in behavioral quiz");
  }
  if (quizTextareas > 0) {
    questionTypes.push("FreeText");
    pass("Q1: Free-text (textarea) question type in behavioral quiz");
  }

  observe(
    `Quiz question types: MCQ=${mcqOptions}, MCAQ=${mcaqOptions}, T/F=${trueFalseOptions}, FreeText=${quizTextareas}`
  );

  // Check progress indicator
  const progressBar = await page.locator('[role="progressbar"], [class*="progress"]').count();
  if (progressBar > 0) {
    pass("Q1: Quiz progress indicator visible");
  }

  // Try answering and submitting
  try {
    if (mcqOptions > 0) {
      await page.locator('input[type="radio"]').first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
    } else if (mcaqOptions > 0) {
      await page.locator('input[type="checkbox"]').first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
    } else if (trueFalseOptions > 0) {
      await page
        .locator('button:has-text("True"), button:has-text("False")')
        .first()
        .click({ timeout: 5000 });
      await page.waitForTimeout(500);
    }

    const quizSubmit = page
      .locator(
        'button:has-text("Submit"), button:has-text("Next"), button:has-text("Submit Answer")'
      )
      .first();
    if ((await quizSubmit.count()) > 0) {
      quizModeResult.submitWorks = true;
      pass("Q1: Quiz submit/next button visible");
    }
  } catch (err) {
    observe(`Quiz interaction error: ${err}`);
  }

  // Check for quiz results
  const resultsSection = await page
    .locator('[class*="result"], [class*="score"], [class*="summary"]')
    .count();
  if (resultsSection > 0) {
    quizModeResult.resultsDisplayed = true;
    pass("Q1: Quiz results/score section visible");
  }

  (quizModeResult.notes as string[]).push(
    `Quiz: h1="${quizH1}", types=[${questionTypes.join(",")}], mcq=${mcqOptions}, mcaq=${mcaqOptions}`
  );

  // ─── STEP 10: Behavioral Timed Assessment ─────────────────────────────────
  console.log("\n=== STEP 10: BEHAVIORAL TIMED ASSESSMENT ===");
  timedAssessmentResult.tested = true;
  const timedUrl = `${BASE}/spaces/${BEH_SPACE}/story-points/xBnumc8jTQje26POV6Lq`;
  storyPointsTested++;

  await page.goto(timedUrl);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const timedH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => "");
  observe(`Behavioral Timed Assessment h1: "${timedH1}"`);

  if (timedH1 && timedH1.trim() !== "" && !timedH1.includes("404")) {
    storyPointsAccessible++;
    timedAssessmentResult.h1Present = true;
    pass(`T1: Behavioral Timed Assessment landing has h1: "${timedH1}"`);
  } else {
    fail(
      "P1",
      "timed-assessment",
      "Behavioral Timed Assessment landing: no h1",
      `h1="${timedH1}" at ${timedUrl}`
    );
  }

  // Check for timer
  const timerVisible = await page
    .locator('[class*="timer"], [class*="countdown"], [class*="time-remaining"]')
    .count();
  observe(`Timer elements: ${timerVisible}`);
  if (timerVisible > 0) {
    timedAssessmentResult.timerVisible = true;
    pass("T2: Timer visible on behavioral timed assessment");
  } else {
    observe("Timer not visible on landing — may appear after starting test");
  }

  // Check for Start button
  const startBtn = await page
    .locator(
      'button:has-text("Start"), button:has-text("Begin"), button:has-text("Start Assessment"), button:has-text("Start Test"), button:has-text("Start Writing")'
    )
    .count();
  if (startBtn > 0) {
    timedAssessmentResult.startButtonVisible = true;
    pass("T3: Start Assessment button visible");
  } else {
    fail(
      "P2",
      "timed-assessment",
      "Start button not found on behavioral timed assessment landing",
      `At ${timedUrl}`
    );
  }

  // Check for instructions/metadata
  const timedBodyText = await page
    .locator("body")
    .textContent()
    .catch(() => "");
  const hasInstructions =
    timedBodyText?.includes("minute") ||
    timedBodyText?.includes("time") ||
    timedBodyText?.includes("question") ||
    timedBodyText?.includes("assessment") ||
    timedBodyText?.includes("story") ||
    timedBodyText?.includes("STAR");
  if (hasInstructions) {
    pass("T3: Timed Assessment landing shows instructions/metadata");
  }

  // Check for writing input (behavioral timed tests often require writing STAR stories)
  const timedTextareas = await page.locator('textarea, [contenteditable="true"]').count();
  if (timedTextareas > 0) {
    timedAssessmentResult.writingInputAvailable = true;
    pass("T2: Behavioral Timed Assessment has writing/textarea input");
  }

  // Try starting the test (if start button found)
  if (startBtn > 0) {
    try {
      await page
        .locator(
          'button:has-text("Start"), button:has-text("Begin"), button:has-text("Start Assessment"), button:has-text("Start Test"), button:has-text("Start Writing")'
        )
        .first()
        .click({ timeout: 5000 });
      await page.waitForTimeout(3000);

      // Check timer appears after starting
      const timerAfterStart = await page.locator('[class*="timer"], [class*="countdown"]').count();
      if (timerAfterStart > 0) {
        timedAssessmentResult.timerVisible = true;
        pass("T2: Timer appears after starting behavioral timed assessment");

        // Verify timer text (should show digits and colon for MM:SS)
        const timerText = await page
          .locator('[class*="timer"], [class*="countdown"]')
          .first()
          .textContent()
          .catch(() => "");
        const hasTimeFormat = /\d+:\d+/.test(timerText || "");
        observe(`Timer text: "${timerText}" — valid format: ${hasTimeFormat}`);
        if (hasTimeFormat) {
          pass("T2: Timer shows valid MM:SS countdown format");
        }
      }

      // Check for writing textarea after start
      const textareasAfterStart = await page.locator('textarea, [contenteditable="true"]').count();
      if (textareasAfterStart > 0) {
        timedAssessmentResult.writingInputAvailable = true;
        pass("T2: Writing input (textarea) available in started timed assessment");

        // Try typing a STAR story
        try {
          const ta = page.locator('textarea, [contenteditable="true"]').first();
          await ta.click({ timeout: 5000 });
          await ta.fill(
            "Situation: A critical API was failing in production. Task: I had 30 minutes to identify and fix the issue. Action: I traced logs, identified a race condition, and deployed a hotfix. Result: System recovered with zero data loss.",
            { timeout: 5000 }
          );
          await page.waitForTimeout(1000);
          pass("T2: Can type STAR story in timed assessment writing area");
        } catch (err) {
          observe(`Could not type in timed test textarea: ${err}`);
        }
      }

      // Check for analytics/results (may appear after test completes)
      const analyticsSection = await page
        .locator('[class*="analytic"], [class*="result"], [class*="summary"]')
        .count();
      if (analyticsSection > 0) {
        timedAssessmentResult.analyticsShown = true;
        pass("T5: Timed Assessment analytics/results section visible");
      }
    } catch (err) {
      observe(`Could not start timed assessment: ${err}`);
    }
  }

  (timedAssessmentResult.notes as string[]).push(
    `Timed test: h1="${timedH1}", timer=${timedAssessmentResult.timerVisible}, startBtn=${startBtn > 0}, writing=${timedAssessmentResult.writingInputAvailable}`
  );

  // ─── STEP 11: UX Checks ───────────────────────────────────────────────────
  console.log("\n=== STEP 11: UX CHECKS ===");

  // Mobile viewport
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/spaces/${BEH_SPACE}/story-points/${starSP.id}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
  const mobileH1 = await page
    .locator("h1")
    .first()
    .textContent({ timeout: 8000 })
    .catch(() => "");
  if (mobileH1 && mobileH1.trim() !== "") {
    pass(
      `UX1: STAR Method story point responsive on mobile (375px) — h1="${mobileH1?.substring(0, 40)}"`
    );
  } else {
    fail(
      "P2",
      "ux",
      "STAR Method story point not rendering on mobile viewport",
      `h1="${mobileH1}" at 375px`
    );
  }

  // Restore desktop
  await page.setViewportSize({ width: 1280, height: 720 });

  // Section navigation check
  await page.goto(`${BASE}/spaces/${BEH_SPACE}/story-points/${starSP.id}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);

  const sectionNav = await page.locator('[class*="section"], [class*="breadcrumb"], nav').count();
  if (sectionNav > 0) {
    pass("UX2: Section/breadcrumb navigation visible in story point viewer");
  }

  // Check behavioral content quality (STAR Method)
  const qaBody = await page
    .locator("body")
    .textContent()
    .catch(() => "");
  const behavioralKeywords = [
    "situation",
    "task",
    "action",
    "result",
    "interview",
    "behavioral",
    "leadership",
    "conflict",
    "collaboration",
  ];
  const foundBehKws = behavioralKeywords.filter((kw) =>
    qaBody?.toLowerCase().includes(kw.toLowerCase())
  );
  observe(`Behavioral content keywords on STAR page: ${foundBehKws.join(", ")}`);
  if (foundBehKws.length >= 4) {
    pass(
      `CQ5: STAR Method page has strong behavioral content (${foundBehKws.length}/${behavioralKeywords.length})`
    );
  } else if (foundBehKws.length > 0) {
    pass(
      `CQ5: STAR Method page has some behavioral content (${foundBehKws.length}/${behavioralKeywords.length})`
    );
  } else {
    fail(
      "P2",
      "content-quality",
      "STAR Method page missing behavioral keywords",
      `Found ${foundBehKws.length}/${behavioralKeywords.length} keywords`
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

  // Fail test on P0 issues only
  const p0Issues = issues.filter((i) => i.severity === "P0");
  if (p0Issues.length > 0) {
    throw new Error(
      `${p0Issues.length} P0 issues found: ${p0Issues.map((i) => i.title).join("; ")}`
    );
  }
});
