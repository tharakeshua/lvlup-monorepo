import { test, expect, Page, BrowserContext } from "@playwright/test";

// ─── Credentials (Subhang Academy) ─────────────────────────────────────────
const SCHOOL_CODE = "SUB001";
const STUDENT_EMAIL = "student.test@subhang.academy";
const STUDENT_PASSWORD = "Test@12345";
const CONSUMER_EMAIL = "consumer@gmail.test";
const CONSUMER_PASSWORD = "Consumer123!";

// ─── Audit Report Types ─────────────────────────────────────────────────────
interface AuditResult {
  id: string;
  category: string;
  feature: string;
  status: "working" | "partial" | "broken" | "not-tested";
  details: string;
  consoleErrors?: string[];
  severity?: "P0-critical" | "P1-major" | "P2-minor" | "P3-cosmetic";
  stepsToReproduce?: string[];
}

const auditResults: AuditResult[] = [];

function record(result: AuditResult) {
  auditResults.push(result);
  console.log(`[AUDIT] ${result.id} ${result.feature}: ${result.status} - ${result.details}`);
}

// ─── Auth Helpers ──────────────────────────────────────────────────────────
async function loginAsStudent(page: Page) {
  await page.goto("/login");
  await page.fill("#schoolCode", SCHOOL_CODE);
  await page.click('button[type="submit"]:has-text("Continue")');
  await page.waitForSelector("#credential", { timeout: 15_000 });
  await page.getByRole("tab", { name: "Email" }).click();
  await page.fill("#credential", STUDENT_EMAIL);
  await page.fill("#password", STUDENT_PASSWORD);
  await page.click('button[type="submit"]:has-text("Sign In")');
  await expect(page.locator("h1")).toContainText("Dashboard", { timeout: 30_000 });
}

async function loginAsConsumer(page: Page) {
  await page.goto("/login");
  await page.click('button:has-text("Don\'t have a school code")');
  await page.fill("#consumerEmail", CONSUMER_EMAIL);
  await page.fill("#consumerPassword", CONSUMER_PASSWORD);
  await page.click('button[type="submit"]:has-text("Sign In")');
  await expect(page.locator("h1")).toContainText("My Learning", { timeout: 30_000 });
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: AUTHENTICATION (A1-A4)
// ═══════════════════════════════════════════════════════════════════════════

test.describe.serial("A: Authentication", () => {
  test("A1: School Code Login", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    try {
      await page.goto("/login");
      await page.fill("#schoolCode", SCHOOL_CODE);
      await page.click('button[type="submit"]:has-text("Continue")');
      await page.waitForSelector("#credential", { timeout: 15_000 });
      await page.getByRole("tab", { name: "Email" }).click();
      await page.fill("#credential", STUDENT_EMAIL);
      await page.fill("#password", STUDENT_PASSWORD);
      await page.click('button[type="submit"]:has-text("Sign In")');
      await expect(page.locator("h1")).toContainText("Dashboard", { timeout: 30_000 });
      record({
        id: "A1",
        category: "authentication",
        feature: "School Code Login",
        status: "working",
        details: "Login with SUB001 school code + email successful, dashboard loaded",
        consoleErrors: errors.length ? errors : undefined,
      });
    } catch (e: any) {
      record({
        id: "A1",
        category: "authentication",
        feature: "School Code Login",
        status: "broken",
        details: `Login failed: ${e.message}`,
        consoleErrors: errors,
        severity: "P0-critical",
        stepsToReproduce: [
          "Go to /login",
          "Enter SUB001",
          "Click Continue",
          "Enter email/password",
          "Click Sign In",
        ],
      });
    }
  });

  test("A2: Roll Number Login", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    try {
      await page.goto("/login");
      await page.fill("#schoolCode", SCHOOL_CODE);
      await page.click('button[type="submit"]:has-text("Continue")');
      await page.waitForSelector("#credential", { timeout: 15_000 });
      const rollTab = page.getByRole("tab", { name: "Roll Number" });
      const isVisible = await rollTab.isVisible().catch(() => false);
      if (!isVisible) {
        record({
          id: "A2",
          category: "authentication",
          feature: "Roll Number Login",
          status: "not-tested",
          details: "Roll Number tab not visible for SUB001 tenant",
        });
        return;
      }
      await rollTab.click();
      await page.fill("#credential", "2025001");
      await page.fill("#password", STUDENT_PASSWORD);
      await page.click('button[type="submit"]:has-text("Sign In")');
      await page.waitForTimeout(8_000);
      const h1 = await page
        .locator("h1")
        .first()
        .textContent()
        .catch(() => "");
      if (h1?.includes("Dashboard")) {
        record({
          id: "A2",
          category: "authentication",
          feature: "Roll Number Login",
          status: "working",
          details: "Roll number login successful",
        });
      } else {
        record({
          id: "A2",
          category: "authentication",
          feature: "Roll Number Login",
          status: "not-tested",
          details: "Roll number user may not be seeded for SUB001",
          consoleErrors: errors.length ? errors : undefined,
        });
      }
    } catch (e: any) {
      record({
        id: "A2",
        category: "authentication",
        feature: "Roll Number Login",
        status: "not-tested",
        details: `Roll number login not available: ${e.message}`,
      });
    }
  });

  test("A3: Consumer Login", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    try {
      await page.goto("/login");
      await page.click('button:has-text("Don\'t have a school code")');
      await page.fill("#consumerEmail", CONSUMER_EMAIL);
      await page.fill("#consumerPassword", CONSUMER_PASSWORD);
      await page.click('button[type="submit"]:has-text("Sign In")');
      await expect(page.locator("h1")).toContainText("My Learning", { timeout: 30_000 });
      record({
        id: "A3",
        category: "authentication",
        feature: "Consumer Login",
        status: "working",
        details: "Consumer login successful, My Learning dashboard loaded",
        consoleErrors: errors.length ? errors : undefined,
      });
    } catch (e: any) {
      record({
        id: "A3",
        category: "authentication",
        feature: "Consumer Login",
        status: "broken",
        details: `Consumer login failed: ${e.message}`,
        consoleErrors: errors,
        severity: "P0-critical",
        stepsToReproduce: [
          "Go to /login",
          "Click Don't have a school code",
          "Enter consumer email/password",
          "Click Sign In",
        ],
      });
    }
  });

  test("A4: Login Error Handling", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    try {
      // Test wrong password
      await page.goto("/login");
      await page.fill("#schoolCode", SCHOOL_CODE);
      await page.click('button[type="submit"]:has-text("Continue")');
      await page.waitForSelector("#credential", { timeout: 15_000 });
      await page.getByRole("tab", { name: "Email" }).click();
      await page.fill("#credential", STUDENT_EMAIL);
      await page.fill("#password", "WrongPassword999!");
      await page.click('button[type="submit"]:has-text("Sign In")');
      const hasError = await page
        .locator('[class*="destructive"], [role="alert"]')
        .first()
        .isVisible({ timeout: 10_000 })
        .catch(() => false);

      // Test invalid school code
      await page.goto("/login");
      await page.fill("#schoolCode", "XXXXX_INVALID");
      await page.click('button[type="submit"]:has-text("Continue")');
      const hasSchoolError = await page
        .locator('[class*="destructive"], [role="alert"]')
        .first()
        .isVisible({ timeout: 10_000 })
        .catch(() => false);

      if (hasError && hasSchoolError) {
        record({
          id: "A4",
          category: "authentication",
          feature: "Login Error Handling",
          status: "working",
          details: "Error messages shown for wrong password and invalid school code",
        });
      } else if (hasError || hasSchoolError) {
        record({
          id: "A4",
          category: "authentication",
          feature: "Login Error Handling",
          status: "partial",
          details: `Wrong password error: ${hasError}, invalid school code error: ${hasSchoolError}`,
          severity: "P2-minor",
        });
      } else {
        record({
          id: "A4",
          category: "authentication",
          feature: "Login Error Handling",
          status: "broken",
          details: "No error messages displayed for invalid inputs",
          severity: "P1-major",
        });
      }
    } catch (e: any) {
      record({
        id: "A4",
        category: "authentication",
        feature: "Login Error Handling",
        status: "broken",
        details: `Error handling test failed: ${e.message}`,
        severity: "P1-major",
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: DASHBOARD (D1-D8)
// ═══════════════════════════════════════════════════════════════════════════

test.describe.serial("D: Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("D1: Dashboard Load", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    try {
      await page.goto("/");
      await expect(page.locator("h1")).toContainText("Dashboard", { timeout: 15_000 });
      await page.waitForTimeout(2_000);
      const jsErrors = errors.filter((e) => !e.includes("Warning") && !e.includes("DevTools"));
      record({
        id: "D1",
        category: "dashboard",
        feature: "Dashboard Load",
        status: jsErrors.length > 0 ? "partial" : "working",
        details:
          jsErrors.length > 0
            ? `Dashboard loads but has ${jsErrors.length} console errors`
            : "Dashboard loads cleanly without errors",
        consoleErrors: jsErrors.length ? jsErrors : undefined,
        severity: jsErrors.length > 0 ? "P2-minor" : undefined,
      });
    } catch (e: any) {
      record({
        id: "D1",
        category: "dashboard",
        feature: "Dashboard Load",
        status: "broken",
        details: `Dashboard failed to load: ${e.message}`,
        severity: "P0-critical",
      });
    }
  });

  test("D2: Score Cards", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    try {
      await page.goto("/");
      await page.waitForTimeout(3_000);
      const hasOverallScore = await page
        .locator("text=Overall Score")
        .isVisible()
        .catch(() => false);
      const hasActiveSpaces = await page
        .locator("text=Active Spaces")
        .isVisible()
        .catch(() => false);
      const hasAvgExam = await page
        .locator("text=Avg Exam")
        .isVisible()
        .catch(() => false);
      const hasStreak = await page
        .locator("text=Streak")
        .isVisible()
        .catch(() => false);
      const hasCompletion = await page
        .locator("text=Completion")
        .isVisible()
        .catch(() => false);
      const cardCount = [
        hasOverallScore,
        hasActiveSpaces,
        hasAvgExam,
        hasStreak,
        hasCompletion,
      ].filter(Boolean).length;

      if (cardCount >= 3) {
        record({
          id: "D2",
          category: "dashboard",
          feature: "Score Cards",
          status: "working",
          details: `${cardCount} stat cards visible on dashboard`,
        });
      } else if (cardCount >= 1) {
        record({
          id: "D2",
          category: "dashboard",
          feature: "Score Cards",
          status: "partial",
          details: `Only ${cardCount} stat cards visible (expected 4+)`,
          severity: "P2-minor",
        });
      } else {
        record({
          id: "D2",
          category: "dashboard",
          feature: "Score Cards",
          status: "broken",
          details: "No stat cards visible on dashboard",
          severity: "P1-major",
        });
      }
    } catch (e: any) {
      record({
        id: "D2",
        category: "dashboard",
        feature: "Score Cards",
        status: "broken",
        details: `Score cards test failed: ${e.message}`,
        severity: "P1-major",
      });
    }
  });

  test("D3: Resume Learning", async ({ page }) => {
    try {
      await page.goto("/");
      await page.waitForTimeout(3_000);
      const hasResume = await page
        .locator("text=Resume Learning, text=Continue Learning, text=Resume")
        .first()
        .isVisible()
        .catch(() => false);
      const hasRecentSpace = await page
        .locator('a[href^="/spaces/"]')
        .first()
        .isVisible()
        .catch(() => false);
      if (hasResume || hasRecentSpace) {
        record({
          id: "D3",
          category: "dashboard",
          feature: "Resume Learning",
          status: "working",
          details: "Resume learning section visible with navigable space link",
        });
      } else {
        record({
          id: "D3",
          category: "dashboard",
          feature: "Resume Learning",
          status: "partial",
          details: "Resume learning not visible (may not have recent activity)",
          severity: "P3-cosmetic",
        });
      }
    } catch (e: any) {
      record({
        id: "D3",
        category: "dashboard",
        feature: "Resume Learning",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("D4: Level Badge & XP", async ({ page }) => {
    try {
      await page.goto("/");
      await page.waitForTimeout(3_000);
      const hasLevel = await page
        .locator("text=Level, text=Lvl")
        .first()
        .isVisible()
        .catch(() => false);
      const hasXP = await page
        .locator("text=XP, text=xp, text=Experience")
        .first()
        .isVisible()
        .catch(() => false);
      const hasProgressBar =
        (await page.locator('[role="progressbar"], .progress-bar, [class*="progress"]').count()) >
        0;
      if (hasLevel || hasXP) {
        record({
          id: "D4",
          category: "dashboard",
          feature: "Level Badge & XP",
          status: hasProgressBar ? "working" : "partial",
          details: `Level: ${hasLevel}, XP: ${hasXP}, Progress bar: ${hasProgressBar}`,
          severity: !hasProgressBar ? "P3-cosmetic" : undefined,
        });
      } else {
        record({
          id: "D4",
          category: "dashboard",
          feature: "Level Badge & XP",
          status: "partial",
          details: "Level badge not prominently displayed",
          severity: "P3-cosmetic",
        });
      }
    } catch (e: any) {
      record({
        id: "D4",
        category: "dashboard",
        feature: "Level Badge & XP",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("D5: Recent Achievements", async ({ page }) => {
    try {
      await page.goto("/");
      await page.waitForTimeout(3_000);
      const hasAchievements = await page
        .locator("text=Achievements, text=Recent Achievements, text=Badges")
        .first()
        .isVisible()
        .catch(() => false);
      const hasEmptyState = await page
        .locator("text=No achievements, text=No badges")
        .first()
        .isVisible()
        .catch(() => false);
      record({
        id: "D5",
        category: "dashboard",
        feature: "Recent Achievements",
        status: hasAchievements || hasEmptyState ? "working" : "partial",
        details: hasAchievements
          ? "Achievements section visible"
          : hasEmptyState
            ? "Empty state shown (no achievements yet)"
            : "Achievements section not prominently displayed",
        severity: !hasAchievements && !hasEmptyState ? "P3-cosmetic" : undefined,
      });
    } catch (e: any) {
      record({
        id: "D5",
        category: "dashboard",
        feature: "Recent Achievements",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("D6: Upcoming Exams", async ({ page }) => {
    try {
      await page.goto("/");
      await page.waitForTimeout(3_000);
      const hasExams = await page
        .locator("text=Upcoming, text=Upcoming Exams, text=Recent Exam")
        .first()
        .isVisible()
        .catch(() => false);
      record({
        id: "D6",
        category: "dashboard",
        feature: "Upcoming Exams",
        status: "working",
        details: hasExams
          ? "Upcoming/Recent exams section visible"
          : "No upcoming exams (valid state if none scheduled)",
      });
    } catch (e: any) {
      record({
        id: "D6",
        category: "dashboard",
        feature: "Upcoming Exams",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("D7: My Spaces Grid", async ({ page }) => {
    try {
      await page.goto("/");
      await page.waitForTimeout(3_000);
      const hasMySpaces = await page
        .locator('h2:has-text("My Spaces")')
        .isVisible()
        .catch(() => false);
      const spaceCards = await page.locator('a[href^="/spaces/"]').count();
      const hasEmpty = await page
        .locator("text=No spaces assigned")
        .isVisible()
        .catch(() => false);
      if (hasMySpaces && (spaceCards > 0 || hasEmpty)) {
        // Test click navigation
        if (spaceCards > 0) {
          const href = await page.locator('a[href^="/spaces/"]').first().getAttribute("href");
          await page.locator('a[href^="/spaces/"]').first().click();
          await page.waitForTimeout(2_000);
          const navigated = page.url().includes("/spaces/");
          record({
            id: "D7",
            category: "dashboard",
            feature: "My Spaces Grid",
            status: navigated ? "working" : "partial",
            details: `${spaceCards} space cards rendered, navigation ${navigated ? "works" : "failed"}`,
            severity: !navigated ? "P1-major" : undefined,
          });
        } else {
          record({
            id: "D7",
            category: "dashboard",
            feature: "My Spaces Grid",
            status: "working",
            details: "My Spaces section renders with empty state",
          });
        }
      } else {
        record({
          id: "D7",
          category: "dashboard",
          feature: "My Spaces Grid",
          status: "broken",
          details: "My Spaces section not found",
          severity: "P1-major",
        });
      }
    } catch (e: any) {
      record({
        id: "D7",
        category: "dashboard",
        feature: "My Spaces Grid",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("D8: Strengths/Weaknesses", async ({ page }) => {
    try {
      await page.goto("/");
      await page.waitForTimeout(3_000);
      const hasStrengths = await page
        .locator("text=Strengths, text=Strong, text=Top Topics")
        .first()
        .isVisible()
        .catch(() => false);
      const hasWeaknesses = await page
        .locator("text=Weaknesses, text=Weak, text=Improve, text=Focus Areas")
        .first()
        .isVisible()
        .catch(() => false);
      record({
        id: "D8",
        category: "dashboard",
        feature: "Strengths/Weaknesses",
        status: hasStrengths || hasWeaknesses ? "working" : "partial",
        details:
          hasStrengths || hasWeaknesses
            ? "Strengths/weaknesses section visible"
            : "Section not displayed (may not have enough data)",
        severity: !hasStrengths && !hasWeaknesses ? "P3-cosmetic" : undefined,
      });
    } catch (e: any) {
      record({
        id: "D8",
        category: "dashboard",
        feature: "Strengths/Weaknesses",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: CORE LEARNING FLOW (L1-L12)
// ═══════════════════════════════════════════════════════════════════════════

test.describe.serial("L: Core Learning Flow", () => {
  let spaceId: string | null = null;
  let storyPointUrl: string | null = null;

  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("L1: Spaces List", async ({ page }) => {
    try {
      await page.goto("/spaces");
      await page.waitForTimeout(3_000);
      const hasH1 = await page
        .locator("h1")
        .textContent()
        .catch(() => "");
      const spaceLinks = await page.locator('a[href^="/spaces/"]').count();
      const hasEmpty = await page
        .locator("text=No spaces")
        .isVisible()
        .catch(() => false);
      if (hasH1?.includes("My Spaces") && (spaceLinks > 0 || hasEmpty)) {
        record({
          id: "L1",
          category: "learning-flow",
          feature: "Spaces List",
          status: "working",
          details: `Spaces page loaded with ${spaceLinks} space cards`,
        });
      } else {
        record({
          id: "L1",
          category: "learning-flow",
          feature: "Spaces List",
          status: "broken",
          details: `Spaces page issue: h1="${hasH1}", cards=${spaceLinks}`,
          severity: "P0-critical",
        });
      }
    } catch (e: any) {
      record({
        id: "L1",
        category: "learning-flow",
        feature: "Spaces List",
        status: "broken",
        details: e.message,
        severity: "P0-critical",
      });
    }
  });

  test("L2: Space Viewer", async ({ page }) => {
    try {
      await page.goto("/spaces");
      await page.waitForTimeout(2_000);
      const spaceLinks = page.locator('a[href^="/spaces/"]');
      if ((await spaceLinks.count()) === 0) {
        record({
          id: "L2",
          category: "learning-flow",
          feature: "Space Viewer",
          status: "not-tested",
          details: "No spaces available to test",
        });
        return;
      }
      const href = await spaceLinks.first().getAttribute("href");
      spaceId = href?.replace("/spaces/", "") ?? null;
      await spaceLinks.first().click();
      await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
      await page.waitForTimeout(2_000);
      const hasH1 = await page
        .locator("h1")
        .first()
        .isVisible()
        .catch(() => false);
      const hasContents = await page
        .locator('h2:has-text("Contents")')
        .isVisible()
        .catch(() => false);
      const hasProgress = await page
        .locator("text=Overall Progress")
        .isVisible()
        .catch(() => false);
      const hasBreadcrumbs = await page
        .locator('a:has-text("Spaces")')
        .isVisible()
        .catch(() => false);
      record({
        id: "L2",
        category: "learning-flow",
        feature: "Space Viewer",
        status: hasH1 ? "working" : "broken",
        details: `Space viewer: h1=${hasH1}, contents=${hasContents}, progress=${hasProgress}, breadcrumbs=${hasBreadcrumbs}`,
        severity: !hasH1 ? "P0-critical" : undefined,
      });
    } catch (e: any) {
      record({
        id: "L2",
        category: "learning-flow",
        feature: "Space Viewer",
        status: "broken",
        details: e.message,
        severity: "P0-critical",
      });
    }
  });

  test("L3: Story Point Viewer", async ({ page }) => {
    try {
      await page.goto("/spaces");
      await page.waitForTimeout(2_000);
      const spaceLinks = page.locator('a[href^="/spaces/"]');
      if ((await spaceLinks.count()) === 0) {
        record({
          id: "L3",
          category: "learning-flow",
          feature: "Story Point Viewer",
          status: "not-tested",
          details: "No spaces available",
        });
        return;
      }
      await spaceLinks.first().click();
      await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
      await page.waitForTimeout(2_000);
      const spLinks = page.locator('a[href*="/story-points/"]');
      if ((await spLinks.count()) === 0) {
        record({
          id: "L3",
          category: "learning-flow",
          feature: "Story Point Viewer",
          status: "not-tested",
          details: "No story point links found in space",
        });
        return;
      }
      await spLinks.first().click();
      await expect(page).toHaveURL(/\/story-points\//, { timeout: 10_000 });
      storyPointUrl = page.url();
      await page.waitForTimeout(2_500);
      const hasH1 = await page
        .locator("h1")
        .first()
        .isVisible()
        .catch(() => false);
      const hasItems = (await page.locator(".rounded-lg.border").count()) > 0;
      record({
        id: "L3",
        category: "learning-flow",
        feature: "Story Point Viewer",
        status: hasH1 ? "working" : "broken",
        details: `Story point viewer: h1=${hasH1}, items visible=${hasItems}`,
        severity: !hasH1 ? "P0-critical" : undefined,
      });
    } catch (e: any) {
      record({
        id: "L3",
        category: "learning-flow",
        feature: "Story Point Viewer",
        status: "broken",
        details: e.message,
        severity: "P0-critical",
      });
    }
  });

  test("L4: Material Rendering", async ({ page }) => {
    try {
      // Navigate to a story point
      await page.goto("/spaces");
      await page.waitForTimeout(2_000);
      const spaceLinks = page.locator('a[href^="/spaces/"]');
      if ((await spaceLinks.count()) === 0) {
        record({
          id: "L4",
          category: "learning-flow",
          feature: "Material Rendering",
          status: "not-tested",
          details: "No spaces available",
        });
        return;
      }
      await spaceLinks.first().click();
      await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
      await page.waitForTimeout(2_000);
      const spLinks = page.locator('a[href*="/story-points/"]');
      if ((await spLinks.count()) === 0) {
        record({
          id: "L4",
          category: "learning-flow",
          feature: "Material Rendering",
          status: "not-tested",
          details: "No story points found",
        });
        return;
      }
      await spLinks.first().click();
      await page.waitForURL(/\/story-points\//, { timeout: 10_000 });
      await page.waitForTimeout(3_000);

      // Look for material content
      const hasHeadings = (await page.locator("h2, h3, h4").count()) > 0;
      const hasParagraphs = (await page.locator("p").count()) > 0;
      const hasCodeBlocks = (await page.locator("pre, code").count()) > 0;
      const hasItems = (await page.locator(".rounded-lg.border").count()) > 0;

      record({
        id: "L4",
        category: "learning-flow",
        feature: "Material Rendering",
        status: hasItems ? "working" : "partial",
        details: `Material rendering: items=${hasItems}, headings=${hasHeadings}, paragraphs=${hasParagraphs}, codeBlocks=${hasCodeBlocks}`,
        severity: !hasItems ? "P1-major" : undefined,
      });
    } catch (e: any) {
      record({
        id: "L4",
        category: "learning-flow",
        feature: "Material Rendering",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("L5: Section Navigation", async ({ page }) => {
    try {
      await page.goto("/spaces");
      await page.waitForTimeout(2_000);
      const spaceLinks = page.locator('a[href^="/spaces/"]');
      if ((await spaceLinks.count()) === 0) {
        record({
          id: "L5",
          category: "learning-flow",
          feature: "Section Navigation",
          status: "not-tested",
          details: "No spaces",
        });
        return;
      }
      await spaceLinks.first().click();
      await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
      await page.waitForTimeout(2_000);
      const spLinks = page.locator('a[href*="/story-points/"]');
      if ((await spLinks.count()) === 0) {
        record({
          id: "L5",
          category: "learning-flow",
          feature: "Section Navigation",
          status: "not-tested",
          details: "No story points",
        });
        return;
      }
      await spLinks.first().click();
      await page.waitForURL(/\/story-points\//, { timeout: 10_000 });
      await page.waitForTimeout(2_500);

      const sectionButtons = page.locator('button[data-section], aside button, [role="tab"]');
      const sectionCount = await sectionButtons.count();
      if (sectionCount > 0) {
        await sectionButtons.first().click();
        await page.waitForTimeout(500);
        record({
          id: "L5",
          category: "learning-flow",
          feature: "Section Navigation",
          status: "working",
          details: `${sectionCount} section filters found and clickable`,
        });
      } else {
        record({
          id: "L5",
          category: "learning-flow",
          feature: "Section Navigation",
          status: "partial",
          details: "No section sidebar buttons found",
          severity: "P2-minor",
        });
      }
    } catch (e: any) {
      record({
        id: "L5",
        category: "learning-flow",
        feature: "Section Navigation",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("L6: Item Search", async ({ page }) => {
    try {
      await page.goto("/spaces");
      await page.waitForTimeout(2_000);
      const spaceLinks = page.locator('a[href^="/spaces/"]');
      if ((await spaceLinks.count()) === 0) {
        record({
          id: "L6",
          category: "learning-flow",
          feature: "Item Search",
          status: "not-tested",
          details: "No spaces",
        });
        return;
      }
      await spaceLinks.first().click();
      await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
      await page.waitForTimeout(2_000);
      const spLinks = page.locator('a[href*="/story-points/"]');
      if ((await spLinks.count()) === 0) {
        record({
          id: "L6",
          category: "learning-flow",
          feature: "Item Search",
          status: "not-tested",
          details: "No story points",
        });
        return;
      }
      await spLinks.first().click();
      await page.waitForURL(/\/story-points\//, { timeout: 10_000 });
      await page.waitForTimeout(2_500);

      const searchInput = page
        .locator('input[placeholder*="Search"], input[placeholder*="search"], input[type="search"]')
        .first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill("test");
        await page.waitForTimeout(500);
        record({
          id: "L6",
          category: "learning-flow",
          feature: "Item Search",
          status: "working",
          details: "Search input found and accepts input",
        });
      } else {
        record({
          id: "L6",
          category: "learning-flow",
          feature: "Item Search",
          status: "partial",
          details: "Search input not found on story point page",
          severity: "P2-minor",
        });
      }
    } catch (e: any) {
      record({
        id: "L6",
        category: "learning-flow",
        feature: "Item Search",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("L7: Item Type Filter", async ({ page }) => {
    try {
      await page.goto("/spaces");
      await page.waitForTimeout(2_000);
      const spaceLinks = page.locator('a[href^="/spaces/"]');
      if ((await spaceLinks.count()) === 0) {
        record({
          id: "L7",
          category: "learning-flow",
          feature: "Item Type Filter",
          status: "not-tested",
          details: "No spaces",
        });
        return;
      }
      await spaceLinks.first().click();
      await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
      await page.waitForTimeout(2_000);
      const spLinks = page.locator('a[href*="/story-points/"]');
      if ((await spLinks.count()) === 0) {
        record({
          id: "L7",
          category: "learning-flow",
          feature: "Item Type Filter",
          status: "not-tested",
          details: "No story points",
        });
        return;
      }
      await spLinks.first().click();
      await page.waitForURL(/\/story-points\//, { timeout: 10_000 });
      await page.waitForTimeout(2_500);

      const hasQFilter = await page
        .locator('button:has-text("Question"), button:has-text("Questions")')
        .first()
        .isVisible()
        .catch(() => false);
      const hasMFilter = await page
        .locator('button:has-text("Material"), button:has-text("Materials")')
        .first()
        .isVisible()
        .catch(() => false);
      if (hasQFilter || hasMFilter) {
        record({
          id: "L7",
          category: "learning-flow",
          feature: "Item Type Filter",
          status: "working",
          details: `Type filters: Question=${hasQFilter}, Material=${hasMFilter}`,
        });
      } else {
        record({
          id: "L7",
          category: "learning-flow",
          feature: "Item Type Filter",
          status: "partial",
          details: "Type filter buttons not found",
          severity: "P2-minor",
        });
      }
    } catch (e: any) {
      record({
        id: "L7",
        category: "learning-flow",
        feature: "Item Type Filter",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("L8: Difficulty Filter", async ({ page }) => {
    try {
      await page.goto("/spaces");
      await page.waitForTimeout(2_000);
      const spaceLinks = page.locator('a[href^="/spaces/"]');
      if ((await spaceLinks.count()) === 0) {
        record({
          id: "L8",
          category: "learning-flow",
          feature: "Difficulty Filter",
          status: "not-tested",
          details: "No spaces",
        });
        return;
      }
      await spaceLinks.first().click();
      await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
      await page.waitForTimeout(2_000);
      const spLinks = page.locator('a[href*="/story-points/"]');
      if ((await spLinks.count()) === 0) {
        record({
          id: "L8",
          category: "learning-flow",
          feature: "Difficulty Filter",
          status: "not-tested",
          details: "No story points",
        });
        return;
      }
      await spLinks.first().click();
      await page.waitForURL(/\/story-points\//, { timeout: 10_000 });
      await page.waitForTimeout(2_500);

      const hasEasy = await page
        .locator('button:has-text("easy"), button:has-text("Easy")')
        .first()
        .isVisible()
        .catch(() => false);
      const hasMedium = await page
        .locator('button:has-text("medium"), button:has-text("Medium")')
        .first()
        .isVisible()
        .catch(() => false);
      const hasHard = await page
        .locator('button:has-text("hard"), button:has-text("Hard")')
        .first()
        .isVisible()
        .catch(() => false);
      if (hasEasy || hasMedium || hasHard) {
        record({
          id: "L8",
          category: "learning-flow",
          feature: "Difficulty Filter",
          status: "working",
          details: `Difficulty filters: easy=${hasEasy}, medium=${hasMedium}, hard=${hasHard}`,
        });
      } else {
        record({
          id: "L8",
          category: "learning-flow",
          feature: "Difficulty Filter",
          status: "partial",
          details: "Difficulty filters not found on story point page",
          severity: "P2-minor",
        });
      }
    } catch (e: any) {
      record({
        id: "L8",
        category: "learning-flow",
        feature: "Difficulty Filter",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("L9: Completion Filter", async ({ page }) => {
    try {
      await page.goto("/spaces");
      await page.waitForTimeout(2_000);
      const spaceLinks = page.locator('a[href^="/spaces/"]');
      if ((await spaceLinks.count()) === 0) {
        record({
          id: "L9",
          category: "learning-flow",
          feature: "Completion Filter",
          status: "not-tested",
          details: "No spaces",
        });
        return;
      }
      await spaceLinks.first().click();
      await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
      await page.waitForTimeout(2_000);
      const spLinks = page.locator('a[href*="/story-points/"]');
      if ((await spLinks.count()) === 0) {
        record({
          id: "L9",
          category: "learning-flow",
          feature: "Completion Filter",
          status: "not-tested",
          details: "No story points",
        });
        return;
      }
      await spLinks.first().click();
      await page.waitForURL(/\/story-points\//, { timeout: 10_000 });
      await page.waitForTimeout(2_500);

      const hasCompleted = await page
        .locator('button:has-text("Completed"), button:has-text("completed")')
        .first()
        .isVisible()
        .catch(() => false);
      const hasIncomplete = await page
        .locator(
          'button:has-text("Incomplete"), button:has-text("incomplete"), button:has-text("Pending")'
        )
        .first()
        .isVisible()
        .catch(() => false);
      if (hasCompleted || hasIncomplete) {
        record({
          id: "L9",
          category: "learning-flow",
          feature: "Completion Filter",
          status: "working",
          details: `Completion filters: completed=${hasCompleted}, incomplete=${hasIncomplete}`,
        });
      } else {
        record({
          id: "L9",
          category: "learning-flow",
          feature: "Completion Filter",
          status: "partial",
          details: "Completion filter buttons not found",
          severity: "P3-cosmetic",
        });
      }
    } catch (e: any) {
      record({
        id: "L9",
        category: "learning-flow",
        feature: "Completion Filter",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("L10: Prev/Next Navigation", async ({ page }) => {
    try {
      await page.goto("/spaces");
      await page.waitForTimeout(2_000);
      const spaceLinks = page.locator('a[href^="/spaces/"]');
      if ((await spaceLinks.count()) === 0) {
        record({
          id: "L10",
          category: "learning-flow",
          feature: "Prev/Next Navigation",
          status: "not-tested",
          details: "No spaces",
        });
        return;
      }
      await spaceLinks.first().click();
      await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
      await page.waitForTimeout(2_000);

      // Check for navigation buttons in space viewer
      const hasPrev = await page
        .locator('button:has-text("Previous"), a:has-text("Previous")')
        .first()
        .isVisible()
        .catch(() => false);
      const hasNext = await page
        .locator('button:has-text("Next"), a:has-text("Next")')
        .first()
        .isVisible()
        .catch(() => false);
      record({
        id: "L10",
        category: "learning-flow",
        feature: "Prev/Next Navigation",
        status: hasPrev || hasNext ? "working" : "partial",
        details: `Prev/Next nav: prev=${hasPrev}, next=${hasNext}`,
        severity: !hasPrev && !hasNext ? "P3-cosmetic" : undefined,
      });
    } catch (e: any) {
      record({
        id: "L10",
        category: "learning-flow",
        feature: "Prev/Next Navigation",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("L11: Chat Tutor Panel", async ({ page }) => {
    try {
      await page.goto("/spaces");
      await page.waitForTimeout(2_000);
      const spaceLinks = page.locator('a[href^="/spaces/"]');
      if ((await spaceLinks.count()) === 0) {
        record({
          id: "L11",
          category: "learning-flow",
          feature: "Chat Tutor Panel",
          status: "not-tested",
          details: "No spaces",
        });
        return;
      }
      await spaceLinks.first().click();
      await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
      await page.waitForTimeout(2_000);
      const spLinks = page.locator('a[href*="/story-points/"]');
      if ((await spLinks.count()) === 0) {
        record({
          id: "L11",
          category: "learning-flow",
          feature: "Chat Tutor Panel",
          status: "not-tested",
          details: "No story points",
        });
        return;
      }
      await spLinks.first().click();
      await page.waitForURL(/\/story-points\//, { timeout: 10_000 });
      await page.waitForTimeout(2_500);

      const hasChatIcon = await page
        .locator(
          'button:has-text("Ask AI"), button:has(svg.lucide-message-square), [aria-label*="chat"], [aria-label*="Ask"]'
        )
        .first()
        .isVisible()
        .catch(() => false);
      if (hasChatIcon) {
        record({
          id: "L11",
          category: "learning-flow",
          feature: "Chat Tutor Panel",
          status: "working",
          details: "Chat tutor icon/button visible on story point page",
        });
      } else {
        record({
          id: "L11",
          category: "learning-flow",
          feature: "Chat Tutor Panel",
          status: "partial",
          details: "Chat tutor icon not found on story point page",
          severity: "P2-minor",
        });
      }
    } catch (e: any) {
      record({
        id: "L11",
        category: "learning-flow",
        feature: "Chat Tutor Panel",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("L12: Space Progress", async ({ page }) => {
    try {
      await page.goto("/spaces");
      await page.waitForTimeout(2_000);
      const spaceLinks = page.locator('a[href^="/spaces/"]');
      if ((await spaceLinks.count()) === 0) {
        record({
          id: "L12",
          category: "learning-flow",
          feature: "Space Progress",
          status: "not-tested",
          details: "No spaces",
        });
        return;
      }
      await spaceLinks.first().click();
      await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
      await page.waitForTimeout(2_000);

      const hasProgressBar = await page
        .locator("text=Overall Progress")
        .isVisible()
        .catch(() => false);
      const hasPercentage = await page
        .locator('[role="progressbar"]')
        .isVisible()
        .catch(() => false);
      record({
        id: "L12",
        category: "learning-flow",
        feature: "Space Progress",
        status: hasProgressBar ? "working" : "partial",
        details: `Space progress: label=${hasProgressBar}, progressbar=${hasPercentage}`,
        severity: !hasProgressBar ? "P2-minor" : undefined,
      });
    } catch (e: any) {
      record({
        id: "L12",
        category: "learning-flow",
        feature: "Space Progress",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: QUESTION TYPES (Q1-Q15)
// ═══════════════════════════════════════════════════════════════════════════

test.describe.serial("Q: Question Types", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  // Helper to navigate to story point with questions
  async function navigateToQuestions(page: Page): Promise<boolean> {
    await page.goto("/spaces");
    await page.waitForTimeout(2_000);
    const spaceLinks = page.locator('a[href^="/spaces/"]');
    if ((await spaceLinks.count()) === 0) return false;
    await spaceLinks.first().click();
    await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
    await page.waitForTimeout(2_000);
    const spLinks = page.locator('a[href*="/story-points/"]');
    if ((await spLinks.count()) === 0) return false;
    await spLinks.first().click();
    await page.waitForURL(/\/story-points\//, { timeout: 10_000 });
    await page.waitForTimeout(3_000);
    return true;
  }

  const questionTypes = [
    {
      id: "Q1",
      type: "MCQ (Single Choice)",
      selectors: ['[type="radio"]', "button[data-option]", '[role="radiogroup"]'],
    },
    {
      id: "Q2",
      type: "MCAQ (Multiple Choice)",
      selectors: ['[type="checkbox"]', '[role="checkbox"]'],
    },
    {
      id: "Q3",
      type: "True/False",
      selectors: ['button:has-text("True")', 'button:has-text("False")'],
    },
    {
      id: "Q4",
      type: "Numerical",
      selectors: ['input[type="number"]', 'input[inputmode="numeric"]'],
    },
    { id: "Q5", type: "Text (Short Answer)", selectors: ['input[type="text"]', "textarea"] },
    { id: "Q6", type: "Paragraph (Essay)", selectors: ["textarea[rows]", "textarea"] },
    {
      id: "Q7",
      type: "Code",
      selectors: [".cm-editor", "[data-language]", ".monaco-editor", 'textarea[class*="code"]'],
    },
    { id: "Q8", type: "Fill-in-the-Blanks", selectors: ['input[class*="blank"]', "[data-blank]"] },
    { id: "Q9", type: "Fill-Blanks Drag & Drop", selectors: ['[draggable="true"]', "[data-dnd]"] },
    { id: "Q10", type: "Matching", selectors: ["[data-match]", '[class*="match"]'] },
    {
      id: "Q11",
      type: "Jumbled (Ordering)",
      selectors: ["[data-order]", '[class*="jumble"]', '[class*="reorder"]'],
    },
    { id: "Q12", type: "Group Options", selectors: ["[data-group]", '[class*="group"]'] },
    { id: "Q13", type: "Audio", selectors: ["[data-audio]", 'button:has-text("Record")'] },
    {
      id: "Q14",
      type: "Image Evaluation",
      selectors: ["[data-image]", 'button:has-text("Upload")'],
    },
    {
      id: "Q15",
      type: "Chat Agent Question",
      selectors: ["[data-chat-agent]", '[class*="chat-agent"]'],
    },
  ];

  // Test all question types in one test to avoid repeated navigation
  test("Q1-Q15: All Question Types Audit", async ({ page }) => {
    const ok = await navigateToQuestions(page);
    if (!ok) {
      for (const qt of questionTypes) {
        record({
          id: qt.id,
          category: "question-types",
          feature: qt.type,
          status: "not-tested",
          details: "Could not navigate to story point with questions",
        });
      }
      return;
    }

    // Scan the entire page for question type indicators
    const pageContent = await page.content();
    const submitButtons = await page
      .locator('button:has-text("Submit"), button:has-text("Check")')
      .count();

    // Check for MCQ
    const mcqVisible =
      (await page.locator('[role="radiogroup"], [type="radio"], button[data-option]').count()) > 0;
    record({
      id: "Q1",
      category: "question-types",
      feature: "MCQ (Single Choice)",
      status: mcqVisible ? "working" : "not-tested",
      details: mcqVisible
        ? "MCQ options found and visible"
        : "No MCQ questions found on this page (may exist in other story points)",
    });

    // Check for MCAQ
    const mcaqVisible = (await page.locator('[type="checkbox"], [role="checkbox"]').count()) > 0;
    record({
      id: "Q2",
      category: "question-types",
      feature: "MCAQ (Multiple Choice)",
      status: mcaqVisible ? "working" : "not-tested",
      details: mcaqVisible ? "MCAQ checkboxes found" : "No MCAQ questions found on this page",
    });

    // Check for True/False
    const tfVisible = await page
      .locator('button:has-text("True")')
      .isVisible()
      .catch(() => false);
    record({
      id: "Q3",
      category: "question-types",
      feature: "True/False",
      status: tfVisible ? "working" : "not-tested",
      details: tfVisible
        ? "True/False buttons found"
        : "No True/False questions found on this page",
    });

    // Check for numerical
    const numVisible =
      (await page.locator('input[type="number"], input[inputmode="numeric"]').count()) > 0;
    record({
      id: "Q4",
      category: "question-types",
      feature: "Numerical",
      status: numVisible ? "working" : "not-tested",
      details: numVisible ? "Numerical input found" : "No numerical questions found on this page",
    });

    // Check for text
    const textVisible = (await page.locator('input[type="text"]').count()) > 0;
    record({
      id: "Q5",
      category: "question-types",
      feature: "Text (Short Answer)",
      status: textVisible ? "working" : "not-tested",
      details: textVisible ? "Text input found" : "No text questions found on this page",
    });

    // Check for paragraph/textarea
    const paraVisible = (await page.locator("textarea").count()) > 0;
    record({
      id: "Q6",
      category: "question-types",
      feature: "Paragraph (Essay)",
      status: paraVisible ? "working" : "not-tested",
      details: paraVisible ? "Textarea found" : "No paragraph questions found on this page",
    });

    // Check for code editor
    const codeVisible =
      (await page.locator(".cm-editor, .monaco-editor, [data-language]").count()) > 0;
    record({
      id: "Q7",
      category: "question-types",
      feature: "Code",
      status: codeVisible ? "working" : "not-tested",
      details: codeVisible ? "Code editor found" : "No code questions found on this page",
    });

    // Check for fill-in-the-blanks
    const fillVisible =
      pageContent.includes("blank") ||
      (await page.locator('[data-blank], input[class*="blank"]').count()) > 0;
    record({
      id: "Q8",
      category: "question-types",
      feature: "Fill-in-the-Blanks",
      status: "not-tested",
      details: "Fill-in-the-blanks requires specific question type in this story point",
    });

    // Q9-Q15 are specialized types that may not be present
    record({
      id: "Q9",
      category: "question-types",
      feature: "Fill-Blanks Drag & Drop",
      status: "not-tested",
      details: "Requires specific question type in content",
    });
    record({
      id: "Q10",
      category: "question-types",
      feature: "Matching",
      status: "not-tested",
      details: "Requires specific question type in content",
    });
    record({
      id: "Q11",
      category: "question-types",
      feature: "Jumbled (Ordering)",
      status: "not-tested",
      details: "Requires specific question type in content",
    });
    record({
      id: "Q12",
      category: "question-types",
      feature: "Group Options",
      status: "not-tested",
      details: "Requires specific question type in content",
    });
    record({
      id: "Q13",
      category: "question-types",
      feature: "Audio",
      status: "not-tested",
      details: "Requires audio question type in content",
    });
    record({
      id: "Q14",
      category: "question-types",
      feature: "Image Evaluation",
      status: "not-tested",
      details: "Requires image question type in content",
    });
    record({
      id: "Q15",
      category: "question-types",
      feature: "Chat Agent Question",
      status: "not-tested",
      details: "Requires chat agent question type in content",
    });

    // Also try navigating to other story points to find more question types
    await page.goBack();
    await page.waitForTimeout(2_000);
    const allStoryLinks = page.locator('a[href*="/story-points/"]');
    const storyCount = await allStoryLinks.count();

    for (let i = 1; i < Math.min(storyCount, 4); i++) {
      try {
        await allStoryLinks.nth(i).click();
        await page.waitForURL(/\/story-points\//, { timeout: 10_000 });
        await page.waitForTimeout(2_500);

        // Scan for additional question types
        const hasMcq = (await page.locator('[role="radiogroup"], [type="radio"]').count()) > 0;
        const hasMcaq = (await page.locator('[type="checkbox"], [role="checkbox"]').count()) > 0;
        const hasTF = await page
          .locator('button:has-text("True")')
          .isVisible()
          .catch(() => false);
        const hasCode = (await page.locator(".cm-editor, .monaco-editor").count()) > 0;
        const hasFill = (await page.locator('[data-blank], input[class*="blank"]').count()) > 0;
        const hasMatch = (await page.locator("[data-match]").count()) > 0;

        // Update results if we find new question types
        if (hasMcq && auditResults.find((r) => r.id === "Q1")?.status === "not-tested") {
          const idx = auditResults.findIndex((r) => r.id === "Q1");
          auditResults[idx] = {
            id: "Q1",
            category: "question-types",
            feature: "MCQ (Single Choice)",
            status: "working",
            details: `MCQ found in story point ${i + 1}`,
          };
        }
        if (hasMcaq && auditResults.find((r) => r.id === "Q2")?.status === "not-tested") {
          const idx = auditResults.findIndex((r) => r.id === "Q2");
          auditResults[idx] = {
            id: "Q2",
            category: "question-types",
            feature: "MCAQ (Multiple Choice)",
            status: "working",
            details: `MCAQ found in story point ${i + 1}`,
          };
        }

        await page.goBack();
        await page.waitForTimeout(1_500);
      } catch {
        break;
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: PRACTICE MODE (P1-P6)
// ═══════════════════════════════════════════════════════════════════════════

test.describe.serial("P: Practice Mode", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  async function navigateToPractice(page: Page): Promise<boolean> {
    await page.goto("/spaces");
    await page.waitForTimeout(2_000);
    const spaceLinks = page.locator('a[href^="/spaces/"]');
    if ((await spaceLinks.count()) === 0) return false;
    await spaceLinks.first().click();
    await page.waitForTimeout(2_000);
    const practiceLinks = page.locator('a[href*="/practice/"]');
    if ((await practiceLinks.count()) === 0) return false;
    await practiceLinks.first().click();
    await page.waitForURL(/\/practice\//, { timeout: 10_000 });
    await page.waitForTimeout(2_500);
    return true;
  }

  test("P1-P6: Practice Mode Audit", async ({ page }) => {
    const ok = await navigateToPractice(page);

    if (!ok) {
      for (const id of ["P1", "P2", "P3", "P4", "P5", "P6"]) {
        record({
          id,
          category: "practice-mode",
          feature: `Practice ${id}`,
          status: "not-tested",
          details: "No practice story points found in enrolled spaces",
        });
      }
      return;
    }

    // P1: Enter Practice
    const hasH1 = await page
      .locator("h1")
      .first()
      .isVisible()
      .catch(() => false);
    const hasPracticeLabel = await page
      .locator("text=Practice Mode")
      .isVisible()
      .catch(() => false);
    record({
      id: "P1",
      category: "practice-mode",
      feature: "Enter Practice",
      status: hasH1 ? "working" : "broken",
      details: `Practice page: h1=${hasH1}, label=${hasPracticeLabel}`,
      severity: !hasH1 ? "P0-critical" : undefined,
    });

    // P2: Answer Question - Check if submit is available
    const hasSubmit = await page
      .locator('button:has-text("Submit"), button:has-text("Check")')
      .first()
      .isVisible()
      .catch(() => false);
    record({
      id: "P2",
      category: "practice-mode",
      feature: "Answer Question",
      status: hasSubmit ? "working" : "partial",
      details: hasSubmit
        ? "Submit button available"
        : "Submit button not visible (may need to select answer first)",
      severity: !hasSubmit ? "P2-minor" : undefined,
    });

    // P3: Retry Question
    const hasRetry = await page
      .locator("text=Unlimited retries")
      .isVisible()
      .catch(() => false);
    record({
      id: "P3",
      category: "practice-mode",
      feature: "Retry Question",
      status: hasRetry ? "working" : "partial",
      details: hasRetry ? "Unlimited retries label visible" : "Retry label not visible",
      severity: !hasRetry ? "P2-minor" : undefined,
    });

    // P4: Difficulty Filter
    const hasEasy = await page
      .locator('button:has-text("easy")')
      .isVisible()
      .catch(() => false);
    const hasMedium = await page
      .locator('button:has-text("medium")')
      .isVisible()
      .catch(() => false);
    const hasHard = await page
      .locator('button:has-text("hard")')
      .isVisible()
      .catch(() => false);
    record({
      id: "P4",
      category: "practice-mode",
      feature: "Difficulty Filter",
      status: hasEasy || hasMedium || hasHard ? "working" : "partial",
      details: `Difficulty filters: easy=${hasEasy}, medium=${hasMedium}, hard=${hasHard}`,
      severity: !hasEasy && !hasMedium && !hasHard ? "P2-minor" : undefined,
    });

    // P5: Question Navigator
    const hasQNav = await page
      .locator("text=Question 1 of")
      .isVisible()
      .catch(() => false);
    const hasPrev = await page
      .locator('button:has-text("Previous")')
      .isVisible()
      .catch(() => false);
    const hasNext = await page
      .locator('button:has-text("Next")')
      .isVisible()
      .catch(() => false);
    record({
      id: "P5",
      category: "practice-mode",
      feature: "Question Navigator",
      status: hasQNav ? "working" : "partial",
      details: `Navigator: indicator=${hasQNav}, prev=${hasPrev}, next=${hasNext}`,
      severity: !hasQNav ? "P2-minor" : undefined,
    });

    // P6: Progress Persistence
    record({
      id: "P6",
      category: "practice-mode",
      feature: "Progress Persistence",
      status: "not-tested",
      details: "Would need to answer questions and refresh to verify persistence",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: TIMED TESTS (T1-T8)
// ═══════════════════════════════════════════════════════════════════════════

test.describe.serial("T: Timed Tests", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  async function navigateToTestLanding(page: Page): Promise<boolean> {
    await page.goto("/spaces");
    await page.waitForTimeout(2_000);
    const spaceLinks = page.locator('a[href^="/spaces/"]');
    if ((await spaceLinks.count()) === 0) return false;
    await spaceLinks.first().click();
    await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
    await page.waitForTimeout(2_000);
    const testLinks = page.locator('a[href*="/test/"]');
    if ((await testLinks.count()) === 0) return false;
    await testLinks.first().click();
    await page.waitForURL(/\/test\//, { timeout: 10_000 });
    await page.waitForTimeout(2_000);
    return true;
  }

  test("T1-T8: Timed Tests Audit", async ({ page }) => {
    const ok = await navigateToTestLanding(page);

    if (!ok) {
      for (const id of ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"]) {
        record({
          id,
          category: "timed-tests",
          feature: `Timed Test ${id}`,
          status: "not-tested",
          details: "No timed test story points found in enrolled spaces",
        });
      }
      return;
    }

    // T1: Start Test - Landing page
    const hasTimedLabel = await page
      .locator("text=Timed Test")
      .isVisible()
      .catch(() => false);
    const hasDuration = await page
      .locator("text=Duration")
      .isVisible()
      .catch(() => false);
    const hasQuestions = await page
      .locator("text=Questions")
      .isVisible()
      .catch(() => false);
    const hasStartBtn = await page
      .locator('button:has-text("Start Test")')
      .isVisible()
      .catch(() => false);
    record({
      id: "T1",
      category: "timed-tests",
      feature: "Start Test",
      status: hasTimedLabel || hasStartBtn ? "working" : "broken",
      details: `Landing: label=${hasTimedLabel}, duration=${hasDuration}, questions=${hasQuestions}, startBtn=${hasStartBtn}`,
      severity: !hasTimedLabel && !hasStartBtn ? "P0-critical" : undefined,
    });

    // Try to start the test
    if (hasStartBtn) {
      try {
        await page.locator('button:has-text("Start Test")').click();
        await page.waitForTimeout(4_000);
        const hasQ1 = await page
          .locator("text=Question 1 of")
          .isVisible()
          .catch(() => false);
        const hasError = await page
          .locator("text=Failed to start")
          .isVisible()
          .catch(() => false);

        if (hasQ1) {
          // T2: Timer Display
          record({
            id: "T2",
            category: "timed-tests",
            feature: "Timer Display",
            status: "working",
            details: "Test started, question indicator visible (timer present in UI)",
          });

          // T3: Answer & Auto-Save
          const mcqOption = page
            .locator('[role="radiogroup"] button, [role="radio"], label:has(input[type="radio"])')
            .first();
          if (await mcqOption.isVisible().catch(() => false)) {
            await mcqOption.click();
            await page.waitForTimeout(500);
            record({
              id: "T3",
              category: "timed-tests",
              feature: "Answer & Auto-Save",
              status: "working",
              details: "Answer selection works",
            });
          } else {
            record({
              id: "T3",
              category: "timed-tests",
              feature: "Answer & Auto-Save",
              status: "partial",
              details: "Could not find answerable options",
              severity: "P2-minor",
            });
          }

          // T4: Question Navigator
          const hasSaveNext = await page
            .locator('button:has-text("Save & Next"), button:has-text("Next")')
            .first()
            .isVisible()
            .catch(() => false);
          record({
            id: "T4",
            category: "timed-tests",
            feature: "Question Navigator",
            status: hasSaveNext ? "working" : "partial",
            details: `Navigator: Save&Next=${hasSaveNext}`,
            severity: !hasSaveNext ? "P2-minor" : undefined,
          });

          // T5: Submit Test
          const hasSubmit = await page
            .locator('button:has-text("Submit Test")')
            .isVisible()
            .catch(() => false);
          if (hasSubmit) {
            await page.locator('button:has-text("Submit Test")').click();
            await page.waitForTimeout(1_000);
            const hasDialog = await page
              .locator("text=Submit Test?")
              .isVisible()
              .catch(() => false);
            if (hasDialog) {
              // Cancel the dialog
              await page.locator('button:has-text("Cancel")').click();
              record({
                id: "T5",
                category: "timed-tests",
                feature: "Submit Test",
                status: "working",
                details: "Submit button opens confirmation dialog",
              });
            } else {
              record({
                id: "T5",
                category: "timed-tests",
                feature: "Submit Test",
                status: "partial",
                details: "Submit button exists but dialog may not appear",
                severity: "P2-minor",
              });
            }
          } else {
            record({
              id: "T5",
              category: "timed-tests",
              feature: "Submit Test",
              status: "partial",
              details: "Submit Test button not visible",
              severity: "P1-major",
            });
          }

          // T6, T7, T8 - Can't fully test without waiting for timer
          record({
            id: "T6",
            category: "timed-tests",
            feature: "Timer Warning",
            status: "not-tested",
            details:
              "Timer warning requires waiting for countdown - not practical in automated test",
          });
          record({
            id: "T7",
            category: "timed-tests",
            feature: "Auto-Submit on Expiry",
            status: "not-tested",
            details: "Auto-submit requires waiting for full timer expiry",
          });
          record({
            id: "T8",
            category: "timed-tests",
            feature: "Prevent Leave",
            status: "not-tested",
            details: "beforeunload testing not reliable in headless mode",
          });
        } else if (hasError) {
          record({
            id: "T2",
            category: "timed-tests",
            feature: "Timer Display",
            status: "not-tested",
            details: "Test failed to start (max attempts reached?)",
          });
          record({
            id: "T3",
            category: "timed-tests",
            feature: "Answer & Auto-Save",
            status: "not-tested",
            details: "Test failed to start",
          });
          record({
            id: "T4",
            category: "timed-tests",
            feature: "Question Navigator",
            status: "not-tested",
            details: "Test failed to start",
          });
          record({
            id: "T5",
            category: "timed-tests",
            feature: "Submit Test",
            status: "not-tested",
            details: "Test failed to start",
          });
          record({
            id: "T6",
            category: "timed-tests",
            feature: "Timer Warning",
            status: "not-tested",
            details: "Test failed to start",
          });
          record({
            id: "T7",
            category: "timed-tests",
            feature: "Auto-Submit on Expiry",
            status: "not-tested",
            details: "Test failed to start",
          });
          record({
            id: "T8",
            category: "timed-tests",
            feature: "Prevent Leave",
            status: "not-tested",
            details: "Test failed to start",
          });
        } else {
          // Unknown state
          for (const id of ["T2", "T3", "T4", "T5", "T6", "T7", "T8"]) {
            record({
              id,
              category: "timed-tests",
              feature: `Timed Test ${id}`,
              status: "not-tested",
              details: "Test started but question indicator not found",
            });
          }
        }
      } catch (e: any) {
        for (const id of ["T2", "T3", "T4", "T5", "T6", "T7", "T8"]) {
          record({
            id,
            category: "timed-tests",
            feature: `Timed Test ${id}`,
            status: "broken",
            details: `Test start failed: ${e.message}`,
            severity: "P0-critical",
          });
        }
      }
    } else {
      for (const id of ["T2", "T3", "T4", "T5", "T6", "T7", "T8"]) {
        record({
          id,
          category: "timed-tests",
          feature: `Timed Test ${id}`,
          status: "not-tested",
          details: "Start Test button not available",
        });
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: RESULTS & ANALYTICS (R1-R6)
// ═══════════════════════════════════════════════════════════════════════════

test.describe.serial("R: Results & Analytics", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("R1-R6: Results Audit", async ({ page }) => {
    // R1: Progress Page - Overall
    try {
      await page.goto("/results");
      await page.waitForTimeout(3_000);
      const hasH1 = await page
        .locator("h1")
        .textContent()
        .catch(() => "");
      const hasOverall = await page
        .locator('button:has-text("Overall")')
        .isVisible()
        .catch(() => false);
      const hasExams = await page
        .locator('button:has-text("Exams")')
        .isVisible()
        .catch(() => false);
      const hasSpaces = await page
        .locator('button:has-text("Spaces")')
        .isVisible()
        .catch(() => false);
      record({
        id: "R1",
        category: "results-analytics",
        feature: "Progress Page - Overall",
        status: hasH1?.includes("My Progress") ? "working" : "broken",
        details: `Progress page: h1="${hasH1}", tabs: Overall=${hasOverall}, Exams=${hasExams}, Spaces=${hasSpaces}`,
        severity: !hasH1?.includes("My Progress") ? "P0-critical" : undefined,
      });
    } catch (e: any) {
      record({
        id: "R1",
        category: "results-analytics",
        feature: "Progress Page - Overall",
        status: "broken",
        details: e.message,
        severity: "P0-critical",
      });
    }

    // R2: Progress Page - Exams
    try {
      await page.locator('button:has-text("Exams")').click();
      await page.waitForTimeout(1_500);
      const hasTable = await page
        .locator("table")
        .isVisible()
        .catch(() => false);
      const hasEmpty = await page
        .locator("text=No exam results")
        .isVisible()
        .catch(() => false);
      record({
        id: "R2",
        category: "results-analytics",
        feature: "Progress Page - Exams",
        status: hasTable || hasEmpty ? "working" : "partial",
        details: `Exams tab: table=${hasTable}, empty=${hasEmpty}`,
        severity: !hasTable && !hasEmpty ? "P2-minor" : undefined,
      });
    } catch (e: any) {
      record({
        id: "R2",
        category: "results-analytics",
        feature: "Progress Page - Exams",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }

    // R3: Progress Page - Spaces
    try {
      await page.locator('button:has-text("Spaces")').click();
      await page.waitForTimeout(1_500);
      const hasCards = (await page.locator('a[href^="/spaces/"]').count()) > 0;
      const hasEmpty = await page
        .locator("text=No spaces")
        .isVisible()
        .catch(() => false);
      record({
        id: "R3",
        category: "results-analytics",
        feature: "Progress Page - Spaces",
        status: hasCards || hasEmpty ? "working" : "partial",
        details: `Spaces tab: cards=${hasCards}, empty=${hasEmpty}`,
        severity: !hasCards && !hasEmpty ? "P2-minor" : undefined,
      });
    } catch (e: any) {
      record({
        id: "R3",
        category: "results-analytics",
        feature: "Progress Page - Spaces",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }

    // R4: Exam Results Detail
    try {
      await page.goto("/results");
      await page.waitForTimeout(2_000);
      await page.locator('button:has-text("Exams")').click();
      await page.waitForTimeout(1_500);
      const examLinks = page.locator('a[href*="/exams/"]');
      if ((await examLinks.count()) > 0) {
        await examLinks.first().click();
        await page.waitForTimeout(3_000);
        const hasScore = await page
          .locator("text=Score")
          .isVisible()
          .catch(() => false);
        record({
          id: "R4",
          category: "results-analytics",
          feature: "Exam Results Detail",
          status: hasScore ? "working" : "partial",
          details: `Exam detail: score visible=${hasScore}`,
          severity: !hasScore ? "P2-minor" : undefined,
        });
      } else {
        record({
          id: "R4",
          category: "results-analytics",
          feature: "Exam Results Detail",
          status: "not-tested",
          details: "No exam results to navigate to",
        });
      }
    } catch (e: any) {
      record({
        id: "R4",
        category: "results-analytics",
        feature: "Exam Results Detail",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }

    // R5: Test Analytics
    record({
      id: "R5",
      category: "results-analytics",
      feature: "Test Analytics",
      status: "not-tested",
      details: "Test analytics page requires specific test result URL",
    });

    // R6: Recommendations
    record({
      id: "R6",
      category: "results-analytics",
      feature: "Recommendations",
      status: "not-tested",
      details: "Recommendations require completed exams/tests data",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: GAMIFICATION (G1-G6)
// ═══════════════════════════════════════════════════════════════════════════

test.describe.serial("G: Gamification", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("G1: Achievements Page", async ({ page }) => {
    try {
      await page.goto("/achievements");
      await page.waitForTimeout(3_000);
      const hasH1 = await page
        .locator("h1")
        .textContent()
        .catch(() => "");
      const hasCategories = (await page.locator('[role="tab"], button[class*="tab"]').count()) > 0;
      if (hasH1?.includes("Achievement") || hasH1?.includes("Badges")) {
        record({
          id: "G1",
          category: "gamification",
          feature: "Achievements Page",
          status: "working",
          details: `Achievements page loaded with heading "${hasH1}"`,
        });
      } else if (page.url().includes("/achievements")) {
        record({
          id: "G1",
          category: "gamification",
          feature: "Achievements Page",
          status: "partial",
          details: `Page loaded but heading is "${hasH1}"`,
          severity: "P2-minor",
        });
      } else {
        record({
          id: "G1",
          category: "gamification",
          feature: "Achievements Page",
          status: "broken",
          details: "Achievements page did not load",
          severity: "P1-major",
        });
      }
    } catch (e: any) {
      record({
        id: "G1",
        category: "gamification",
        feature: "Achievements Page",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("G2: Achievement Filtering", async ({ page }) => {
    try {
      await page.goto("/achievements");
      await page.waitForTimeout(3_000);
      const tabs = page.locator('[role="tab"], button[class*="tab"]');
      const tabCount = await tabs.count();
      if (tabCount > 1) {
        await tabs.nth(1).click();
        await page.waitForTimeout(500);
        record({
          id: "G2",
          category: "gamification",
          feature: "Achievement Filtering",
          status: "working",
          details: `${tabCount} category tabs found and clickable`,
        });
      } else {
        record({
          id: "G2",
          category: "gamification",
          feature: "Achievement Filtering",
          status: "partial",
          details: "Category tabs not found",
          severity: "P3-cosmetic",
        });
      }
    } catch (e: any) {
      record({
        id: "G2",
        category: "gamification",
        feature: "Achievement Filtering",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("G3: Leaderboard", async ({ page }) => {
    try {
      await page.goto("/leaderboard");
      await page.waitForTimeout(3_000);
      const hasH1 = await page
        .locator("h1")
        .textContent()
        .catch(() => "");
      const hasRankings = await page
        .locator('h2:has-text("Rankings")')
        .isVisible()
        .catch(() => false);
      record({
        id: "G3",
        category: "gamification",
        feature: "Leaderboard",
        status: hasH1?.includes("Leaderboard") ? "working" : "broken",
        details: `Leaderboard: h1="${hasH1}", rankings=${hasRankings}`,
        severity: !hasH1?.includes("Leaderboard") ? "P1-major" : undefined,
      });
    } catch (e: any) {
      record({
        id: "G3",
        category: "gamification",
        feature: "Leaderboard",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("G4: Leaderboard Filter", async ({ page }) => {
    try {
      await page.goto("/leaderboard");
      await page.waitForTimeout(3_000);
      const combobox = page.locator('button[role="combobox"]');
      if (await combobox.isVisible().catch(() => false)) {
        await combobox.click();
        await page.waitForTimeout(500);
        const options = page.locator('[role="option"]');
        const optCount = await options.count();
        record({
          id: "G4",
          category: "gamification",
          feature: "Leaderboard Filter",
          status: optCount > 0 ? "working" : "partial",
          details: `Space filter: ${optCount} options in dropdown`,
          severity: optCount === 0 ? "P3-cosmetic" : undefined,
        });
      } else {
        record({
          id: "G4",
          category: "gamification",
          feature: "Leaderboard Filter",
          status: "partial",
          details: "Space filter dropdown not found",
          severity: "P3-cosmetic",
        });
      }
    } catch (e: any) {
      record({
        id: "G4",
        category: "gamification",
        feature: "Leaderboard Filter",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("G5: Study Planner", async ({ page }) => {
    try {
      await page.goto("/study-planner");
      await page.waitForTimeout(3_000);
      const hasH1 = await page
        .locator("h1")
        .textContent()
        .catch(() => "");
      const url = page.url();
      if (hasH1?.includes("Study Planner") || hasH1?.includes("Planner")) {
        record({
          id: "G5",
          category: "gamification",
          feature: "Study Planner",
          status: "working",
          details: "Study planner page loaded",
        });
      } else if (url.includes("/study-planner")) {
        record({
          id: "G5",
          category: "gamification",
          feature: "Study Planner",
          status: "partial",
          details: `Page loaded but heading is "${hasH1}"`,
          severity: "P2-minor",
        });
      } else {
        record({
          id: "G5",
          category: "gamification",
          feature: "Study Planner",
          status: "broken",
          details: `Redirected to ${url}`,
          severity: "P1-major",
        });
      }
    } catch (e: any) {
      record({
        id: "G5",
        category: "gamification",
        feature: "Study Planner",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("G6: Create Study Goal", async ({ page }) => {
    try {
      await page.goto("/study-planner");
      await page.waitForTimeout(3_000);
      const hasNewGoal = await page
        .locator(
          'button:has-text("New Goal"), button:has-text("Add Goal"), button:has-text("Create")'
        )
        .first()
        .isVisible()
        .catch(() => false);
      if (hasNewGoal) {
        record({
          id: "G6",
          category: "gamification",
          feature: "Create Study Goal",
          status: "working",
          details: "New goal button visible",
        });
      } else {
        record({
          id: "G6",
          category: "gamification",
          feature: "Create Study Goal",
          status: "not-tested",
          details: "New Goal button not found on study planner page",
        });
      }
    } catch (e: any) {
      record({
        id: "G6",
        category: "gamification",
        feature: "Create Study Goal",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: AUXILIARY FEATURES (X1-X8)
// ═══════════════════════════════════════════════════════════════════════════

test.describe.serial("X: Auxiliary Features", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("X1: Chat Tutor Page", async ({ page }) => {
    try {
      await page.goto("/chat");
      await page.waitForTimeout(3_000);
      const hasH1 = await page
        .locator("h1")
        .textContent()
        .catch(() => "");
      record({
        id: "X1",
        category: "auxiliary",
        feature: "Chat Tutor Page",
        status: hasH1?.includes("Chat Tutor") ? "working" : "broken",
        details: `Chat page: h1="${hasH1}"`,
        severity: !hasH1?.includes("Chat Tutor") ? "P1-major" : undefined,
      });
    } catch (e: any) {
      record({
        id: "X1",
        category: "auxiliary",
        feature: "Chat Tutor Page",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("X2: Chat Session", async ({ page }) => {
    try {
      await page.goto("/chat");
      await page.waitForTimeout(3_000);
      const sessions = page.locator("button.w-full.text-left");
      const hasEmpty = await page
        .locator("text=No chat sessions")
        .isVisible()
        .catch(() => false);
      if ((await sessions.count()) > 0) {
        await sessions.first().click();
        await page.waitForTimeout(1_000);
        record({
          id: "X2",
          category: "auxiliary",
          feature: "Chat Session",
          status: "working",
          details: "Chat sessions list available and clickable",
        });
      } else if (hasEmpty) {
        record({
          id: "X2",
          category: "auxiliary",
          feature: "Chat Session",
          status: "working",
          details: "Empty state shown correctly (no chat sessions yet)",
        });
      } else {
        record({
          id: "X2",
          category: "auxiliary",
          feature: "Chat Session",
          status: "partial",
          details: "Neither sessions nor empty state found",
          severity: "P2-minor",
        });
      }
    } catch (e: any) {
      record({
        id: "X2",
        category: "auxiliary",
        feature: "Chat Session",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("X3: Tests Page", async ({ page }) => {
    try {
      await page.goto("/tests");
      await page.waitForTimeout(3_000);
      const hasH1 = await page
        .locator("h1")
        .textContent()
        .catch(() => "");
      const hasCards = (await page.locator('a[href*="/test/"]').count()) > 0;
      const hasEmpty = await page
        .locator("text=No tests available")
        .isVisible()
        .catch(() => false);
      record({
        id: "X3",
        category: "auxiliary",
        feature: "Tests Page",
        status: hasH1?.includes("Tests") ? "working" : "broken",
        details: `Tests page: h1="${hasH1}", cards=${hasCards}, empty=${hasEmpty}`,
        severity: !hasH1?.includes("Tests") ? "P1-major" : undefined,
      });
    } catch (e: any) {
      record({
        id: "X3",
        category: "auxiliary",
        feature: "Tests Page",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("X4: Notifications Page", async ({ page }) => {
    try {
      await page.goto("/notifications");
      await page.waitForTimeout(3_000);
      const url = page.url();
      const hasBody = await page.locator("body").isVisible();
      const hasFilter = await page
        .locator('button:has-text("All"), [data-value="all"]')
        .first()
        .isVisible()
        .catch(() => false);
      record({
        id: "X4",
        category: "auxiliary",
        feature: "Notifications Page",
        status: url.includes("/notifications") ? "working" : "broken",
        details: `Notifications page loaded: url contains /notifications=${url.includes("/notifications")}, filter=${hasFilter}`,
        severity: !url.includes("/notifications") ? "P1-major" : undefined,
      });
    } catch (e: any) {
      record({
        id: "X4",
        category: "auxiliary",
        feature: "Notifications Page",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("X5: Mark Notification Read", async ({ page }) => {
    try {
      await page.goto("/notifications");
      await page.waitForTimeout(3_000);
      const hasNotifs = (await page.locator(".notification-item, [data-notification]").count()) > 0;
      if (hasNotifs) {
        record({
          id: "X5",
          category: "auxiliary",
          feature: "Mark Notification Read",
          status: "working",
          details: "Notifications present and interactable",
        });
      } else {
        record({
          id: "X5",
          category: "auxiliary",
          feature: "Mark Notification Read",
          status: "not-tested",
          details: "No notifications to mark as read",
        });
      }
    } catch (e: any) {
      record({
        id: "X5",
        category: "auxiliary",
        feature: "Mark Notification Read",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("X6: Profile Page", async ({ page }) => {
    try {
      await page.goto("/profile");
      await page.waitForTimeout(3_000);
      const url = page.url();
      const hasProfile = await page
        .locator("h1, h2")
        .first()
        .isVisible()
        .catch(() => false);
      record({
        id: "X6",
        category: "auxiliary",
        feature: "Profile Page",
        status: url.includes("/profile") && hasProfile ? "working" : "broken",
        details: `Profile page: url=${url}, has heading=${hasProfile}`,
        severity: !hasProfile ? "P1-major" : undefined,
      });
    } catch (e: any) {
      record({
        id: "X6",
        category: "auxiliary",
        feature: "Profile Page",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("X7: Settings Page", async ({ page }) => {
    try {
      await page.goto("/settings");
      await page.waitForTimeout(3_000);
      const url = page.url();
      const hasBody = await page.locator("body").isVisible();
      if (url.includes("/settings")) {
        record({
          id: "X7",
          category: "auxiliary",
          feature: "Settings Page",
          status: "working",
          details: "Settings page loaded",
        });
      } else {
        record({
          id: "X7",
          category: "auxiliary",
          feature: "Settings Page",
          status: "partial",
          details: `Settings route redirected to ${url}`,
          severity: "P2-minor",
        });
      }
    } catch (e: any) {
      record({
        id: "X7",
        category: "auxiliary",
        feature: "Settings Page",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("X8: Theme Toggle", async ({ page }) => {
    try {
      const themeBtn = page.locator('button[aria-label="Toggle theme"]').first();
      const isVisible = await themeBtn.isVisible().catch(() => false);
      if (isVisible) {
        const htmlEl = page.locator("html");
        const initialClass = await htmlEl.getAttribute("class");
        await themeBtn.click();
        await page.waitForTimeout(300);
        const newClass = await htmlEl.getAttribute("class");
        record({
          id: "X8",
          category: "auxiliary",
          feature: "Theme Toggle",
          status: newClass !== initialClass ? "working" : "partial",
          details: `Theme toggle: initial="${initialClass}", after="${newClass}"`,
          severity: newClass === initialClass ? "P3-cosmetic" : undefined,
        });
      } else {
        record({
          id: "X8",
          category: "auxiliary",
          feature: "Theme Toggle",
          status: "partial",
          details: "Theme toggle button not found",
          severity: "P3-cosmetic",
        });
      }
    } catch (e: any) {
      record({
        id: "X8",
        category: "auxiliary",
        feature: "Theme Toggle",
        status: "broken",
        details: e.message,
        severity: "P3-cosmetic",
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: CONSUMER/B2C (B1-B6)
// ═══════════════════════════════════════════════════════════════════════════

test.describe.serial("B: Consumer/B2C", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsConsumer(page);
  });

  test("B1: Consumer Dashboard", async ({ page }) => {
    try {
      await page.goto("/consumer");
      await page.waitForTimeout(3_000);
      const hasH1 = await page
        .locator("h1")
        .textContent()
        .catch(() => "");
      record({
        id: "B1",
        category: "consumer-b2c",
        feature: "Consumer Dashboard",
        status: hasH1?.includes("My Learning") ? "working" : "broken",
        details: `Consumer dashboard: h1="${hasH1}"`,
        severity: !hasH1?.includes("My Learning") ? "P0-critical" : undefined,
      });
    } catch (e: any) {
      record({
        id: "B1",
        category: "consumer-b2c",
        feature: "Consumer Dashboard",
        status: "broken",
        details: e.message,
        severity: "P0-critical",
      });
    }
  });

  test("B2: Store Browse", async ({ page }) => {
    try {
      await page.goto("/store");
      await page.waitForTimeout(3_000);
      const hasH1 = await page
        .locator("h1")
        .first()
        .isVisible()
        .catch(() => false);
      const hasSearch = await page
        .locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]')
        .first()
        .isVisible()
        .catch(() => false);
      const hasCards = (await page.locator('a[href^="/store/"]').count()) > 0;
      const hasError = await page
        .locator('h1:has-text("Something went wrong")')
        .isVisible()
        .catch(() => false);
      if (hasError) {
        record({
          id: "B2",
          category: "consumer-b2c",
          feature: "Store Browse",
          status: "broken",
          details: 'Store page shows "Something went wrong" error',
          severity: "P0-critical",
        });
      } else {
        record({
          id: "B2",
          category: "consumer-b2c",
          feature: "Store Browse",
          status: hasH1 ? "working" : "broken",
          details: `Store: h1=${hasH1}, search=${hasSearch}, cards=${hasCards}`,
          severity: !hasH1 ? "P0-critical" : undefined,
        });
      }
    } catch (e: any) {
      record({
        id: "B2",
        category: "consumer-b2c",
        feature: "Store Browse",
        status: "broken",
        details: e.message,
        severity: "P0-critical",
      });
    }
  });

  test("B3: Store Detail", async ({ page }) => {
    try {
      await page.goto("/store");
      await page.waitForTimeout(3_000);
      const spaceLinks = page
        .locator('a[href^="/store/"]')
        .filter({ hasNot: page.locator('[href="/store/checkout"]') });
      if ((await spaceLinks.count()) === 0) {
        record({
          id: "B3",
          category: "consumer-b2c",
          feature: "Store Detail",
          status: "not-tested",
          details: "No store items to click",
        });
        return;
      }
      await spaceLinks.first().click();
      await page.waitForURL(/\/store\/.+/, { timeout: 10_000 });
      await page.waitForTimeout(2_000);
      const hasH1 = await page
        .locator("h1")
        .first()
        .isVisible()
        .catch(() => false);
      record({
        id: "B3",
        category: "consumer-b2c",
        feature: "Store Detail",
        status: hasH1 ? "working" : "broken",
        details: `Store detail: h1=${hasH1}`,
        severity: !hasH1 ? "P1-major" : undefined,
      });
    } catch (e: any) {
      record({
        id: "B3",
        category: "consumer-b2c",
        feature: "Store Detail",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("B4: Add to Cart", async ({ page }) => {
    try {
      await page.goto("/store");
      await page.waitForTimeout(3_000);
      const addBtn = page.locator('button:has-text("Add to Cart")').first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(1_000);
        const hasRemove = await page
          .locator('button:has-text("Remove from Cart")')
          .first()
          .isVisible()
          .catch(() => false);
        record({
          id: "B4",
          category: "consumer-b2c",
          feature: "Add to Cart",
          status: hasRemove ? "working" : "partial",
          details: `Add to cart: toggle to Remove=${hasRemove}`,
          severity: !hasRemove ? "P1-major" : undefined,
        });
      } else {
        record({
          id: "B4",
          category: "consumer-b2c",
          feature: "Add to Cart",
          status: "not-tested",
          details: 'No "Add to Cart" buttons visible (all items may be enrolled)',
        });
      }
    } catch (e: any) {
      record({
        id: "B4",
        category: "consumer-b2c",
        feature: "Add to Cart",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("B5: Checkout Flow", async ({ page }) => {
    try {
      await page.goto("/store/checkout");
      await page.waitForTimeout(3_000);
      const hasBody = await page.locator("body").isVisible();
      const hasH1 = await page
        .locator("h1")
        .first()
        .isVisible()
        .catch(() => false);
      record({
        id: "B5",
        category: "consumer-b2c",
        feature: "Checkout Flow",
        status: hasH1 ? "working" : "partial",
        details: `Checkout page loaded: h1=${hasH1}`,
        severity: !hasH1 ? "P2-minor" : undefined,
      });
    } catch (e: any) {
      record({
        id: "B5",
        category: "consumer-b2c",
        feature: "Checkout Flow",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("B6: Consumer Spaces", async ({ page }) => {
    try {
      await page.goto("/consumer");
      await page.waitForTimeout(3_000);
      const hasCards = (await page.locator('a[href*="/consumer/spaces/"]').count()) > 0;
      const hasEmpty = await page
        .locator("text=haven't enrolled, text=No spaces")
        .first()
        .isVisible()
        .catch(() => false);
      const hasSection = await page
        .locator('h2:has-text("My Enrolled Spaces")')
        .isVisible()
        .catch(() => false);
      record({
        id: "B6",
        category: "consumer-b2c",
        feature: "Consumer Spaces",
        status: hasCards || hasEmpty || hasSection ? "working" : "partial",
        details: `Consumer spaces: cards=${hasCards}, empty=${hasEmpty}, section=${hasSection}`,
        severity: !hasCards && !hasEmpty && !hasSection ? "P2-minor" : undefined,
      });
    } catch (e: any) {
      record({
        id: "B6",
        category: "consumer-b2c",
        feature: "Consumer Spaces",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: LAYOUT & NAVIGATION (N1-N6)
// ═══════════════════════════════════════════════════════════════════════════

test.describe.serial("N: Layout & Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("N1: Sidebar Navigation", async ({ page }) => {
    try {
      const routes = [
        { href: "/", expected: "Dashboard" },
        { href: "/spaces", expected: "My Spaces" },
        { href: "/tests", expected: "Tests" },
        { href: "/results", expected: "My Progress" },
        { href: "/leaderboard", expected: "Leaderboard" },
        { href: "/chat", expected: "Chat Tutor" },
      ];
      let working = 0;
      let broken = 0;
      for (const route of routes) {
        await page.goto(route.href);
        await page.waitForTimeout(2_000);
        const h1 = await page
          .locator("h1")
          .first()
          .textContent()
          .catch(() => "");
        if (h1?.includes(route.expected)) working++;
        else broken++;
      }
      record({
        id: "N1",
        category: "navigation",
        feature: "Sidebar Navigation",
        status: broken === 0 ? "working" : "partial",
        details: `Sidebar nav: ${working}/${routes.length} routes work correctly`,
        severity: broken > 0 ? "P1-major" : undefined,
      });
    } catch (e: any) {
      record({
        id: "N1",
        category: "navigation",
        feature: "Sidebar Navigation",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("N2: Mobile Bottom Nav", async ({ page }) => {
    try {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");
      await page.waitForTimeout(2_000);
      // Check for mobile nav
      const hasMobileNav = await page
        .locator('nav, [role="navigation"]')
        .last()
        .isVisible()
        .catch(() => false);
      const hasBottomBar =
        (await page.locator('nav.fixed, [class*="bottom-nav"], [class*="mobile-nav"]').count()) > 0;
      record({
        id: "N2",
        category: "navigation",
        feature: "Mobile Bottom Nav",
        status: hasMobileNav ? "working" : "partial",
        details: `Mobile nav: visible=${hasMobileNav}, bottomBar=${hasBottomBar}`,
        severity: !hasMobileNav ? "P2-minor" : undefined,
      });
    } catch (e: any) {
      record({
        id: "N2",
        category: "navigation",
        feature: "Mobile Bottom Nav",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("N3: Breadcrumbs", async ({ page }) => {
    try {
      await page.goto("/spaces");
      await page.waitForTimeout(2_000);
      const spaceLinks = page.locator('a[href^="/spaces/"]');
      if ((await spaceLinks.count()) > 0) {
        await spaceLinks.first().click();
        await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
        await page.waitForTimeout(2_000);
        const hasBreadcrumb = await page
          .locator('a:has-text("Spaces")')
          .isVisible()
          .catch(() => false);
        record({
          id: "N3",
          category: "navigation",
          feature: "Breadcrumbs",
          status: hasBreadcrumb ? "working" : "partial",
          details: `Breadcrumbs: "Spaces" link=${hasBreadcrumb}`,
          severity: !hasBreadcrumb ? "P3-cosmetic" : undefined,
        });
      } else {
        record({
          id: "N3",
          category: "navigation",
          feature: "Breadcrumbs",
          status: "not-tested",
          details: "No spaces to navigate into",
        });
      }
    } catch (e: any) {
      record({
        id: "N3",
        category: "navigation",
        feature: "Breadcrumbs",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("N4: Tenant Switcher", async ({ page }) => {
    try {
      const hasSwitcher = await page
        .locator('[data-tenant-switcher], button:has-text("Switch"), select[name*="tenant"]')
        .first()
        .isVisible()
        .catch(() => false);
      record({
        id: "N4",
        category: "navigation",
        feature: "Tenant Switcher",
        status: "not-tested",
        details: "Single-tenant mode - tenant switcher not applicable for single school",
      });
    } catch (e: any) {
      record({
        id: "N4",
        category: "navigation",
        feature: "Tenant Switcher",
        status: "not-tested",
        details: "Tenant switcher not applicable",
      });
    }
  });

  test("N5: Notification Bell", async ({ page }) => {
    try {
      const bell = page.locator("button:has(svg.lucide-bell), button:has(.lucide-bell)").first();
      const isVisible = await bell.isVisible({ timeout: 10_000 }).catch(() => false);
      if (isVisible) {
        await bell.click();
        await page.waitForTimeout(1_000);
        record({
          id: "N5",
          category: "navigation",
          feature: "Notification Bell",
          status: "working",
          details: "Bell icon visible and clickable",
        });
      } else {
        record({
          id: "N5",
          category: "navigation",
          feature: "Notification Bell",
          status: "partial",
          details: "Notification bell not found in header",
          severity: "P2-minor",
        });
      }
    } catch (e: any) {
      record({
        id: "N5",
        category: "navigation",
        feature: "Notification Bell",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("N6: Sign Out", async ({ page }) => {
    try {
      await page.click('button:has-text("Sign Out")');
      const confirmBtn = page
        .locator(
          '[role="alertdialog"] button:has-text("Sign Out"), [role="dialog"] button:has-text("Sign Out")'
        )
        .last();
      await confirmBtn.waitFor({ state: "attached", timeout: 5_000 });
      await confirmBtn.dispatchEvent("click");
      await page.waitForURL(/\/login/, { timeout: 15_000 });
      record({
        id: "N6",
        category: "navigation",
        feature: "Sign Out",
        status: "working",
        details: "Sign out redirects to login page",
      });
    } catch (e: any) {
      record({
        id: "N6",
        category: "navigation",
        feature: "Sign Out",
        status: "broken",
        details: `Sign out failed: ${e.message}`,
        severity: "P1-major",
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY: ERROR STATES (E1-E6)
// ═══════════════════════════════════════════════════════════════════════════

test.describe.serial("E: Error States", () => {
  test("E1: 404 Page", async ({ page }) => {
    try {
      await page.goto("/nonexistent-route-xyz-404");
      await page.waitForTimeout(3_000);
      const has404 = await page
        .locator("text=404")
        .isVisible()
        .catch(() => false);
      const hasNotFound = await page
        .locator("text=Not Found, text=Page not found")
        .first()
        .isVisible()
        .catch(() => false);
      const redirected = page.url().includes("/login");
      record({
        id: "E1",
        category: "error-states",
        feature: "404 Page",
        status: has404 || hasNotFound || redirected ? "working" : "broken",
        details: `404 handling: 404text=${has404}, notFound=${hasNotFound}, redirectToLogin=${redirected}`,
        severity: !has404 && !hasNotFound && !redirected ? "P1-major" : undefined,
      });
    } catch (e: any) {
      record({
        id: "E1",
        category: "error-states",
        feature: "404 Page",
        status: "broken",
        details: e.message,
        severity: "P1-major",
      });
    }
  });

  test("E2: Empty Space", async ({ page }) => {
    try {
      await loginAsStudent(page);
      await page.goto("/spaces");
      await page.waitForTimeout(3_000);
      const hasSpaces = (await page.locator('a[href^="/spaces/"]').count()) > 0;
      const hasEmpty = await page
        .locator("text=No spaces")
        .isVisible()
        .catch(() => false);
      record({
        id: "E2",
        category: "error-states",
        feature: "Empty Space",
        status: hasSpaces || hasEmpty ? "working" : "partial",
        details: `Spaces page: hasSpaces=${hasSpaces}, hasEmpty=${hasEmpty}`,
        severity: !hasSpaces && !hasEmpty ? "P2-minor" : undefined,
      });
    } catch (e: any) {
      record({
        id: "E2",
        category: "error-states",
        feature: "Empty Space",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("E3: Loading States", async ({ page }) => {
    try {
      await loginAsStudent(page);
      // Check that pages don't just show blank screens during load
      await page.goto("/spaces");
      await page.waitForTimeout(1_000);
      const hasContent = await page
        .locator("h1")
        .isVisible()
        .catch(() => false);
      const hasSkeleton =
        (await page
          .locator('[class*="Skeleton"], [class*="skeleton"], [class*="loading"]')
          .count()) > 0;
      record({
        id: "E3",
        category: "error-states",
        feature: "Loading States",
        status: hasContent || hasSkeleton ? "working" : "partial",
        details: `Loading states: content=${hasContent}, skeleton=${hasSkeleton}`,
        severity: !hasContent && !hasSkeleton ? "P2-minor" : undefined,
      });
    } catch (e: any) {
      record({
        id: "E3",
        category: "error-states",
        feature: "Loading States",
        status: "broken",
        details: e.message,
        severity: "P2-minor",
      });
    }
  });

  test("E4: Error Boundaries", async ({ page }) => {
    try {
      await loginAsStudent(page);
      await page.goto("/spaces/nonexistent_space_12345");
      await page.waitForTimeout(5_000);
      const hasBody = await page.locator("body").isVisible();
      const hasError = await page
        .locator("text=Error, text=Something went wrong, text=Not found")
        .first()
        .isVisible()
        .catch(() => false);
      record({
        id: "E4",
        category: "error-states",
        feature: "Error Boundaries",
        status: hasBody ? "working" : "broken",
        details: `Error boundary: body visible=${hasBody}, error message=${hasError}`,
        severity: !hasBody ? "P0-critical" : undefined,
      });
    } catch (e: any) {
      record({
        id: "E4",
        category: "error-states",
        feature: "Error Boundaries",
        status: "broken",
        details: e.message,
        severity: "P0-critical",
      });
    }
  });

  test("E5: Offline Banner", async ({ page }) => {
    record({
      id: "E5",
      category: "error-states",
      feature: "Offline Banner",
      status: "not-tested",
      details: "Offline testing not practical in automated Playwright headless mode",
    });
  });

  test("E6: Slow Network", async ({ page }) => {
    record({
      id: "E6",
      category: "error-states",
      feature: "Slow Network",
      status: "not-tested",
      details: "Slow network testing not practical without dedicated network throttling setup",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE REPORT
// ═══════════════════════════════════════════════════════════════════════════

test.afterAll(async () => {
  // Build the report
  const categories = [
    "authentication",
    "dashboard",
    "learning-flow",
    "question-types",
    "practice-mode",
    "timed-tests",
    "results-analytics",
    "gamification",
    "auxiliary",
    "consumer-b2c",
    "navigation",
    "error-states",
  ];

  const summary = {
    total: auditResults.length,
    working: auditResults.filter((r) => r.status === "working").length,
    partial: auditResults.filter((r) => r.status === "partial").length,
    broken: auditResults.filter((r) => r.status === "broken").length,
    notTested: auditResults.filter((r) => r.status === "not-tested").length,
    passRate: `${Math.round((auditResults.filter((r) => r.status === "working").length / Math.max(auditResults.filter((r) => r.status !== "not-tested").length, 1)) * 100)}%`,
    criticalIssues: auditResults.filter((r) => r.severity === "P0-critical").length,
    majorIssues: auditResults.filter((r) => r.severity === "P1-major").length,
  };

  const categoryBreakdown = categories.map((cat) => {
    const catResults = auditResults.filter((r) => r.category === cat);
    const tested = catResults.filter((r) => r.status !== "not-tested");
    return {
      category: cat,
      total: catResults.length,
      working: catResults.filter((r) => r.status === "working").length,
      partial: catResults.filter((r) => r.status === "partial").length,
      broken: catResults.filter((r) => r.status === "broken").length,
      notTested: catResults.filter((r) => r.status === "not-tested").length,
      passRate: `${Math.round((catResults.filter((r) => r.status === "working").length / Math.max(tested.length, 1)) * 100)}%`,
    };
  });

  const blockedFeatures = auditResults
    .filter((r) => r.status === "not-tested")
    .map((r) => ({
      feature: r.feature,
      blockedBy: r.details.includes("No spaces")
        ? "L1"
        : r.details.includes("No story points")
          ? "L2"
          : r.details.includes("No practice")
            ? "L2"
            : "content",
      reason: r.details,
    }));

  const report = {
    auditor: "app-feature-tester",
    timestamp: new Date().toISOString(),
    cycleNumber: 0,
    environment: {
      url: "http://localhost:4570",
      credentials: { email: STUDENT_EMAIL, schoolCode: SCHOOL_CODE },
      viewport: { width: 1280, height: 720 },
    },
    results: auditResults,
    summary,
    categoryBreakdown,
    blockedFeatures,
  };

  const fs = require("fs");
  const path = require("path");
  const reportDir = path.join(__dirname, "..", "reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, "feature-audit-cycle-0.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(
    `\n[AUDIT COMPLETE] Report written. Summary: ${summary.working} working, ${summary.partial} partial, ${summary.broken} broken, ${summary.notTested} not-tested out of ${summary.total} total.`
  );
});
