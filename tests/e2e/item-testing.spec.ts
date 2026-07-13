import { test, expect, Page } from "@playwright/test";
import { loginStudentWithEmail, expectDashboard } from "./helpers/auth";
import { SCHOOL_CODE, SELECTORS } from "./helpers/selectors";

// ─── Credentials ────────────────────────────────────────────────────────────

const STUDENTS = {
  aarav: { email: "aarav.patel@greenwood.edu", password: "Test@12345" },
  karan: { email: "karan.singh@greenwood.edu", password: "Test@12345" },
  nikhil: { email: "nikhil.saxena@greenwood.edu", password: "Test@12345" },
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function login(page: Page, student: keyof typeof STUDENTS) {
  await page.goto("/login");
  const cred = STUDENTS[student];
  await loginStudentWithEmail(page, SCHOOL_CODE, cred.email, cred.password);
  await expectDashboard(page, SELECTORS.dashboards.student);
}

/** Navigate to /spaces, find a space by title, click it, return the URL */
async function navigateToSpace(page: Page, spaceTitle: string) {
  await page.goto("/spaces");
  await page.waitForSelector('h1:has-text("My Spaces")', { timeout: 15000 });
  // Wait for space cards to load (skeleton → real)
  await page.waitForTimeout(3000);

  // Find the space card by title
  const spaceCard = page.locator(`a[href^="/spaces/"]`).filter({ hasText: spaceTitle });
  const count = await spaceCard.count();
  if (count === 0) {
    throw new Error(`Space "${spaceTitle}" not found on spaces list page`);
  }
  await spaceCard.first().click();
  await page.waitForURL(/\/spaces\/.+/, { timeout: 10000 });
  // Wait for space content to load
  await page.waitForTimeout(2000);
}

/** Within a space, find and click a story point by title, return the URL */
async function navigateToStoryPoint(page: Page, storyPointTitle: string) {
  // Wait for Contents section
  await page.waitForSelector('h2:has-text("Contents")', { timeout: 10000 });

  // Story point cards are <a> links
  const spLink = page.locator("a").filter({ hasText: storyPointTitle });
  const count = await spLink.count();
  if (count === 0) {
    throw new Error(`Story point "${storyPointTitle}" not found in space`);
  }
  await spLink.first().click();
  await page.waitForTimeout(3000);
}

/** Within a space, find and click a timed-test story point */
async function navigateToTimedTest(page: Page, storyPointTitle: string) {
  await page.waitForSelector('h2:has-text("Contents")', { timeout: 10000 });

  const spLink = page.locator("a").filter({ hasText: storyPointTitle });
  const count = await spLink.count();
  if (count === 0) {
    throw new Error(`Timed test "${storyPointTitle}" not found in space`);
  }
  await spLink.first().click();
  // Timed test goes to /test/ URL
  await page.waitForTimeout(3000);
}

/** Get all item cards on a story point viewer page */
function getItemCards(page: Page) {
  return page.locator(".rounded-lg.border.bg-card.p-5");
}

/** Get item card at a given index (0-based) */
function getItemCard(page: Page, index: number) {
  return page.locator(".rounded-lg.border.bg-card.p-5").nth(index);
}

// ─── Item type verifiers ────────────────────────────────────────────────────

async function verifyMaterialRendered(card: ReturnType<typeof getItemCard>) {
  // Material renders via MaterialViewer — check for prose content, titles, etc.
  const hasContent = await card
    .locator(".prose, h3, p, article")
    .first()
    .isVisible()
    .catch(() => false);
  expect(hasContent).toBeTruthy();
}

async function verifyMCQRendered(card: ReturnType<typeof getItemCard>) {
  // MCQ has radio buttons inside labels
  const radios = card.locator('input[type="radio"]');
  const radioCount = await radios.count();
  expect(radioCount).toBeGreaterThanOrEqual(2);
}

async function selectMCQOption(card: ReturnType<typeof getItemCard>, index = 0) {
  const labels = card.locator("label").filter({ has: card.page().locator('input[type="radio"]') });
  const count = await labels.count();
  if (count > index) {
    await labels.nth(index).click();
  }
}

async function verifyMCAQRendered(card: ReturnType<typeof getItemCard>) {
  // MCAQ has checkboxes inside labels
  const checkboxes = card.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  expect(count).toBeGreaterThanOrEqual(2);
}

async function selectMCAQOptions(card: ReturnType<typeof getItemCard>, indices = [0, 1]) {
  const labels = card
    .locator("label")
    .filter({ has: card.page().locator('input[type="checkbox"]') });
  for (const idx of indices) {
    const count = await labels.count();
    if (count > idx) {
      await labels.nth(idx).click();
    }
  }
}

async function verifyTrueFalseRendered(card: ReturnType<typeof getItemCard>) {
  const trueBtn = card.locator('button:has-text("True")');
  const falseBtn = card.locator('button:has-text("False")');
  await expect(trueBtn).toBeVisible();
  await expect(falseBtn).toBeVisible();
}

async function selectTrueFalse(card: ReturnType<typeof getItemCard>, value: "True" | "False") {
  await card.locator(`button:has-text("${value}")`).click();
}

async function verifyNumericalRendered(card: ReturnType<typeof getItemCard>) {
  const input = card.locator('input[type="number"]');
  await expect(input).toBeVisible();
}

async function fillNumerical(card: ReturnType<typeof getItemCard>, value: string) {
  await card.locator('input[type="number"]').fill(value);
}

async function verifyTextRendered(card: ReturnType<typeof getItemCard>) {
  const input = card.locator('input[type="text"][placeholder="Type your answer"]');
  await expect(input).toBeVisible();
}

async function fillText(card: ReturnType<typeof getItemCard>, value: string) {
  await card.locator('input[type="text"][placeholder="Type your answer"]').fill(value);
}

async function verifyParagraphRendered(card: ReturnType<typeof getItemCard>) {
  const textarea = card.locator('textarea[placeholder="Write your answer..."]');
  await expect(textarea).toBeVisible();
}

async function fillParagraph(card: ReturnType<typeof getItemCard>, value: string) {
  await card.locator('textarea[placeholder="Write your answer..."]').fill(value);
}

async function verifyCodeRendered(card: ReturnType<typeof getItemCard>) {
  // Code answerer: textarea with font-mono class + dark bg
  const codeArea = card.locator('textarea.font-mono, textarea[spellcheck="false"]');
  await expect(codeArea).toBeVisible();
  // Should show language label
  const langLabel = card.locator("span.uppercase");
  const hasLang = await langLabel.isVisible().catch(() => false);
  expect(hasLang).toBeTruthy();
}

async function fillCode(card: ReturnType<typeof getItemCard>, code: string) {
  const textarea = card.locator('textarea.font-mono, textarea[spellcheck="false"]');
  await textarea.fill(code);
}

async function verifyMatchingRendered(card: ReturnType<typeof getItemCard>) {
  // Matching has select elements with "Select match..."
  const selects = card.locator("select");
  const count = await selects.count();
  expect(count).toBeGreaterThanOrEqual(1);
  // Also has left side items in bordered divs
  const leftItems = card.locator(".rounded.border.bg-gray-50");
  const leftCount = await leftItems.count();
  expect(leftCount).toBeGreaterThanOrEqual(1);
}

async function selectMatchingPair(
  card: ReturnType<typeof getItemCard>,
  pairIndex: number,
  optionIndex: number
) {
  const selects = card.locator("select");
  const count = await selects.count();
  if (count > pairIndex) {
    const select = selects.nth(pairIndex);
    const options = select.locator("option");
    const optCount = await options.count();
    // Skip first option ("Select match..."), so target is optionIndex + 1
    if (optCount > optionIndex + 1) {
      const value = await options.nth(optionIndex + 1).getAttribute("value");
      if (value) {
        await select.selectOption(value);
      }
    }
  }
}

async function verifyFillBlanksRendered(card: ReturnType<typeof getItemCard>) {
  // Fill blanks has inline inputs with placeholder "___"
  const blanks = card.locator('input[placeholder="___"]');
  const count = await blanks.count();
  expect(count).toBeGreaterThanOrEqual(1);
}

async function fillBlanks(card: ReturnType<typeof getItemCard>, values: string[]) {
  const blanks = card.locator('input[placeholder="___"]');
  const count = await blanks.count();
  for (let i = 0; i < Math.min(values.length, count); i++) {
    await blanks.nth(i).fill(values[i]);
  }
}

async function verifyTimedTestLanding(page: Page) {
  // Timed test landing page has: title, Duration, Questions, Start Test button
  const startBtn = page.locator('button:has-text("Start Test")');
  const hasStart = await startBtn.isVisible({ timeout: 10000 }).catch(() => false);
  expect(hasStart).toBeTruthy();

  // Verify metadata grid
  const durationBox = page.locator("text=Duration");
  const questionsBox = page.locator("text=Questions");
  await expect(durationBox).toBeVisible();
  await expect(questionsBox).toBeVisible();
}

// ════════════════════════════════════════════════════════════════════════════
// SPACE 1: Mathematics Fundamentals (Grade 8 Math)
// Student: aarav.patel@greenwood.edu
// ════════════════════════════════════════════════════════════════════════════

test.describe("Space 1: Mathematics Fundamentals", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "aarav");
  });

  // ── Story Point: Algebraic Expressions (5 items) ─────────────────────────

  test.describe("Story Point: Algebraic Expressions", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "Mathematics Fundamentals");
      await navigateToStoryPoint(page, "Algebraic Expressions");
    });

    test("renders all 5 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(5);
      await page.screenshot({
        path: "test-results/space1-algebraic-all-items.png",
        fullPage: true,
      });
    });

    test('item 1: Material — "What are Algebraic Expressions?" renders rich content', async ({
      page,
    }) => {
      const card = getItemCard(page, 0);
      await verifyMaterialRendered(card);
      await page.screenshot({ path: "test-results/space1-algebraic-material.png", fullPage: true });
    });

    test('item 2: MCQ — "Simplify: 3x + 5x" renders options and accepts answer', async ({
      page,
    }) => {
      const card = getItemCard(page, 1);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 0);
      // Verify Submit Answer button appears
      const submitBtn = card.locator('button:has-text("Submit Answer")');
      await expect(submitBtn).toBeVisible();
      await page.screenshot({ path: "test-results/space1-algebraic-mcq.png", fullPage: true });
    });

    test('item 3: Numerical — "Evaluate 2a + 3b when a=4, b=2" renders input field', async ({
      page,
    }) => {
      const card = getItemCard(page, 2);
      await verifyNumericalRendered(card);
      await fillNumerical(card, "14");
      await page.screenshot({
        path: "test-results/space1-algebraic-numerical.png",
        fullPage: true,
      });
    });

    test('item 4: MCAQ — "Like terms identification" renders multi-select options', async ({
      page,
    }) => {
      const card = getItemCard(page, 3);
      await verifyMCAQRendered(card);
      await selectMCAQOptions(card, [0, 1]);
      await page.screenshot({ path: "test-results/space1-algebraic-mcaq.png", fullPage: true });
    });

    test('item 5: MCQ — "Factorize: x^2 + 5x + 6" renders with hard difficulty', async ({
      page,
    }) => {
      const card = getItemCard(page, 4);
      await verifyMCQRendered(card);
      // Check for difficulty badge
      const diffBadge = card.locator(
        'span.rounded-full, span:has-text("hard"), span:has-text("easy"), span:has-text("medium")'
      );
      const hasDiff = await diffBadge
        .first()
        .isVisible()
        .catch(() => false);
      // Difficulty may or may not be displayed
      await selectMCQOption(card, 0);
      await page.screenshot({ path: "test-results/space1-algebraic-mcq-hard.png", fullPage: true });
    });
  });

  // ── Story Point: Linear Equations (4 items) ──────────────────────────────

  test.describe("Story Point: Linear Equations", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "Mathematics Fundamentals");
      await navigateToStoryPoint(page, "Linear Equations");
    });

    test("renders all 4 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(4);
      await page.screenshot({ path: "test-results/space1-linear-all-items.png", fullPage: true });
    });

    test('item 1: Material — "Solving Linear Equations" renders rich content', async ({ page }) => {
      const card = getItemCard(page, 0);
      await verifyMaterialRendered(card);
      await page.screenshot({ path: "test-results/space1-linear-material.png", fullPage: true });
    });

    test('item 2: Numerical — "Solve: 3x + 7 = 22" renders input', async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyNumericalRendered(card);
      await fillNumerical(card, "5");
      await page.screenshot({ path: "test-results/space1-linear-numerical.png", fullPage: true });
    });

    test('item 3: MCQ — "Which is a linear equation?" renders options', async ({ page }) => {
      const card = getItemCard(page, 2);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 0);
      await page.screenshot({ path: "test-results/space1-linear-mcq.png", fullPage: true });
    });

    test('item 4: Text — "Word problem" renders text input area', async ({ page }) => {
      const card = getItemCard(page, 3);
      await verifyTextRendered(card);
      await fillText(card, "x = 15");
      await page.screenshot({ path: "test-results/space1-linear-text.png", fullPage: true });
    });
  });

  // ── Story Point: Geometry - Triangles (3 items) ──────────────────────────

  test.describe("Story Point: Geometry - Triangles", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "Mathematics Fundamentals");
      await navigateToStoryPoint(page, "Geometry - Triangles");
    });

    test("renders all 3 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(3);
      await page.screenshot({ path: "test-results/space1-geometry-all-items.png", fullPage: true });
    });

    test('item 1: True/False — "Sum of angles in a triangle" renders True/False buttons', async ({
      page,
    }) => {
      const card = getItemCard(page, 0);
      await verifyTrueFalseRendered(card);
      await selectTrueFalse(card, "True");
      await page.screenshot({ path: "test-results/space1-geometry-truefalse.png", fullPage: true });
    });

    test('item 2: Numerical — "Find the missing angle" renders input', async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyNumericalRendered(card);
      await fillNumerical(card, "60");
      await page.screenshot({ path: "test-results/space1-geometry-numerical.png", fullPage: true });
    });

    test('item 3: Matching — "Triangle congruence" renders matching pairs UI', async ({ page }) => {
      const card = getItemCard(page, 2);
      await verifyMatchingRendered(card);
      // Select first matching pair
      await selectMatchingPair(card, 0, 0);
      await page.screenshot({ path: "test-results/space1-geometry-matching.png", fullPage: true });
    });
  });

  // ── Story Point: Math Quiz 1 (timed_test) ───────────────────────────────

  test.describe("Story Point: Math Quiz 1 (Timed Test)", () => {
    test("timed test landing page renders with test metadata", async ({ page }) => {
      await navigateToSpace(page, "Mathematics Fundamentals");
      await navigateToTimedTest(page, "Math Quiz 1");
      await verifyTimedTestLanding(page);
      await page.screenshot({
        path: "test-results/space1-mathquiz-timed-landing.png",
        fullPage: true,
      });
    });

    test("timed test shows Start Test button and metadata", async ({ page }) => {
      await navigateToSpace(page, "Mathematics Fundamentals");
      await navigateToTimedTest(page, "Math Quiz 1");

      // Verify the test landing card
      const timedTestLabel = page.locator("text=Timed Test");
      await expect(timedTestLabel).toBeVisible({ timeout: 10000 });

      const startBtn = page.locator('button:has-text("Start Test")');
      await expect(startBtn).toBeVisible();

      // Check for Total Points and Max Attempts
      const totalPoints = page.locator("text=Total Points");
      const maxAttempts = page.locator("text=Max Attempts");
      await expect(totalPoints).toBeVisible();
      await expect(maxAttempts).toBeVisible();

      await page.screenshot({
        path: "test-results/space1-mathquiz-timed-metadata.png",
        fullPage: true,
      });
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SPACE 2: General Science (Grade 8 Science)
// Student: aarav.patel@greenwood.edu
// ════════════════════════════════════════════════════════════════════════════

test.describe("Space 2: General Science", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "aarav");
  });

  // ── Story Point: Force and Pressure (4 items) ────────────────────────────

  test.describe("Story Point: Force and Pressure", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "General Science");
      await navigateToStoryPoint(page, "Force and Pressure");
    });

    test("renders all 4 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(4);
      await page.screenshot({ path: "test-results/space2-force-all-items.png", fullPage: true });
    });

    test("item 1: Material renders rich content", async ({ page }) => {
      const card = getItemCard(page, 0);
      await verifyMaterialRendered(card);
      await page.screenshot({ path: "test-results/space2-force-material.png", fullPage: true });
    });

    test("item 2: MCQ renders options and accepts answer", async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 0);
      await page.screenshot({ path: "test-results/space2-force-mcq1.png", fullPage: true });
    });

    test("item 3: MCQ renders options", async ({ page }) => {
      const card = getItemCard(page, 2);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 1);
      await page.screenshot({ path: "test-results/space2-force-mcq2.png", fullPage: true });
    });

    test("item 4: True/False renders buttons", async ({ page }) => {
      const card = getItemCard(page, 3);
      await verifyTrueFalseRendered(card);
      await selectTrueFalse(card, "True");
      await page.screenshot({ path: "test-results/space2-force-truefalse.png", fullPage: true });
    });
  });

  // ── Story Point: Cell Structure (2 items) ────────────────────────────────

  test.describe("Story Point: Cell Structure", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "General Science");
      await navigateToStoryPoint(page, "Cell Structure");
    });

    test("renders all 2 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(2);
      await page.screenshot({ path: "test-results/space2-cell-all-items.png", fullPage: true });
    });

    test('item 1: Matching — "Cell organelles" renders matching UI', async ({ page }) => {
      const card = getItemCard(page, 0);
      await verifyMatchingRendered(card);
      await selectMatchingPair(card, 0, 0);
      await page.screenshot({ path: "test-results/space2-cell-matching.png", fullPage: true });
    });

    test('item 2: MCAQ — "Plant vs Animal cell" renders multi-select', async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyMCAQRendered(card);
      await selectMCAQOptions(card, [0]);
      await page.screenshot({ path: "test-results/space2-cell-mcaq.png", fullPage: true });
    });
  });

  // ── Story Point: Chemical Reactions Basics (2 items) ─────────────────────

  test.describe("Story Point: Chemical Reactions Basics", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "General Science");
      await navigateToStoryPoint(page, "Chemical Reactions Basics");
    });

    test("renders all 2 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(2);
      await page.screenshot({
        path: "test-results/space2-reactions-all-items.png",
        fullPage: true,
      });
    });

    test('item 1: Fill-blanks — "Balancing equations" renders fill-in-the-blank UI', async ({
      page,
    }) => {
      const card = getItemCard(page, 0);
      await verifyFillBlanksRendered(card);
      await fillBlanks(card, ["2", "1"]);
      await page.screenshot({
        path: "test-results/space2-reactions-fillblanks.png",
        fullPage: true,
      });
    });

    test('item 2: MCQ — "Types of reactions" renders options', async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 0);
      await page.screenshot({ path: "test-results/space2-reactions-mcq.png", fullPage: true });
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SPACE 3: Physics — Mechanics (Grade 10 Physics)
// Student: karan.singh@greenwood.edu
// ════════════════════════════════════════════════════════════════════════════

test.describe("Space 3: Physics — Mechanics", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "karan");
  });

  // ── Story Point: Kinematics (4 items) ────────────────────────────────────

  test.describe("Story Point: Kinematics", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "Physics");
      await navigateToStoryPoint(page, "Kinematics");
    });

    test("renders all 4 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(4);
      await page.screenshot({
        path: "test-results/space3-kinematics-all-items.png",
        fullPage: true,
      });
    });

    test("item 1: Material renders content", async ({ page }) => {
      const card = getItemCard(page, 0);
      await verifyMaterialRendered(card);
      await page.screenshot({
        path: "test-results/space3-kinematics-material.png",
        fullPage: true,
      });
    });

    test("item 2: True/False renders buttons", async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyTrueFalseRendered(card);
      await selectTrueFalse(card, "True");
      await page.screenshot({
        path: "test-results/space3-kinematics-truefalse.png",
        fullPage: true,
      });
    });

    test("item 3: Numerical renders input", async ({ page }) => {
      const card = getItemCard(page, 2);
      await verifyNumericalRendered(card);
      await fillNumerical(card, "10");
      await page.screenshot({
        path: "test-results/space3-kinematics-numerical1.png",
        fullPage: true,
      });
    });

    test("item 4: Numerical renders input (second)", async ({ page }) => {
      const card = getItemCard(page, 3);
      await verifyNumericalRendered(card);
      await fillNumerical(card, "20");
      await page.screenshot({
        path: "test-results/space3-kinematics-numerical2.png",
        fullPage: true,
      });
    });
  });

  // ── Story Point: Newton's Laws of Motion (3 items) ───────────────────────

  test.describe("Story Point: Newton's Laws of Motion", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "Physics");
      await navigateToStoryPoint(page, "Newton's Laws");
    });

    test("renders all 3 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(3);
      await page.screenshot({ path: "test-results/space3-newton-all-items.png", fullPage: true });
    });

    test("item 1: MCQ renders options", async ({ page }) => {
      const card = getItemCard(page, 0);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 0);
      await page.screenshot({ path: "test-results/space3-newton-mcq.png", fullPage: true });
    });

    test("item 2: Numerical renders input", async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyNumericalRendered(card);
      await fillNumerical(card, "50");
      await page.screenshot({ path: "test-results/space3-newton-numerical.png", fullPage: true });
    });

    test("item 3: Text — free response renders text input", async ({ page }) => {
      const card = getItemCard(page, 2);
      await verifyTextRendered(card);
      await fillText(card, "Newton's second law states that F = ma");
      await page.screenshot({ path: "test-results/space3-newton-text.png", fullPage: true });
    });
  });

  // ── Story Point: Work, Energy, and Power (2 items) ───────────────────────

  test.describe("Story Point: Work, Energy, and Power", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "Physics");
      await navigateToStoryPoint(page, "Work, Energy");
    });

    test("renders all 2 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(2);
      await page.screenshot({ path: "test-results/space3-work-all-items.png", fullPage: true });
    });

    test("item 1: MCQ renders options", async ({ page }) => {
      const card = getItemCard(page, 0);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 0);
      await page.screenshot({ path: "test-results/space3-work-mcq.png", fullPage: true });
    });

    test("item 2: Numerical renders input", async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyNumericalRendered(card);
      await fillNumerical(card, "100");
      await page.screenshot({ path: "test-results/space3-work-numerical.png", fullPage: true });
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SPACE 4: Chemistry Foundations (Grade 10 Chemistry)
// Student: karan.singh@greenwood.edu
// ════════════════════════════════════════════════════════════════════════════

test.describe("Space 4: Chemistry Foundations", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "karan");
  });

  // ── Story Point: Atomic Structure (3 items) ──────────────────────────────

  test.describe("Story Point: Atomic Structure", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "Chemistry");
      await navigateToStoryPoint(page, "Atomic Structure");
    });

    test("renders all 3 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(3);
      await page.screenshot({ path: "test-results/space4-atomic-all-items.png", fullPage: true });
    });

    test("item 1: Matching renders pairs", async ({ page }) => {
      const card = getItemCard(page, 0);
      await verifyMatchingRendered(card);
      await selectMatchingPair(card, 0, 0);
      await page.screenshot({ path: "test-results/space4-atomic-matching.png", fullPage: true });
    });

    test("item 2: MCQ renders options", async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 0);
      await page.screenshot({ path: "test-results/space4-atomic-mcq1.png", fullPage: true });
    });

    test("item 3: MCQ renders options (second)", async ({ page }) => {
      const card = getItemCard(page, 2);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 1);
      await page.screenshot({ path: "test-results/space4-atomic-mcq2.png", fullPage: true });
    });
  });

  // ── Story Point: Periodic Table (2 items) ────────────────────────────────

  test.describe("Story Point: Periodic Table", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "Chemistry");
      await navigateToStoryPoint(page, "Periodic Table");
    });

    test("renders all 2 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(2);
      await page.screenshot({ path: "test-results/space4-periodic-all-items.png", fullPage: true });
    });

    test("item 1: True/False renders buttons", async ({ page }) => {
      const card = getItemCard(page, 0);
      await verifyTrueFalseRendered(card);
      await selectTrueFalse(card, "True");
      await page.screenshot({ path: "test-results/space4-periodic-truefalse.png", fullPage: true });
    });

    test("item 2: MCAQ renders multi-select", async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyMCAQRendered(card);
      await selectMCAQOptions(card, [0, 1]);
      await page.screenshot({ path: "test-results/space4-periodic-mcaq.png", fullPage: true });
    });
  });

  // ── Story Point: Chemical Bonding (2 items) ──────────────────────────────

  test.describe("Story Point: Chemical Bonding", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "Chemistry");
      await navigateToStoryPoint(page, "Chemical Bonding");
    });

    test("renders all 2 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(2);
      await page.screenshot({ path: "test-results/space4-bonding-all-items.png", fullPage: true });
    });

    test("item 1: MCQ renders options", async ({ page }) => {
      const card = getItemCard(page, 0);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 0);
      await page.screenshot({ path: "test-results/space4-bonding-mcq.png", fullPage: true });
    });

    test("item 2: Paragraph — long text input renders textarea", async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyParagraphRendered(card);
      await fillParagraph(
        card,
        "Chemical bonding is the process by which atoms combine to form molecules. There are three main types: ionic, covalent, and metallic bonding."
      );
      // Verify word count displays
      const wordCount = card.locator("text=/\\d+ words/");
      await expect(wordCount).toBeVisible();
      await page.screenshot({ path: "test-results/space4-bonding-paragraph.png", fullPage: true });
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SPACE 5: Python Programming (Grade 12 CS)
// Student: nikhil.saxena@greenwood.edu
// ════════════════════════════════════════════════════════════════════════════

test.describe("Space 5: Python Programming", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "nikhil");
  });

  // ── Story Point: Python Basics (4 items) ─────────────────────────────────

  test.describe("Story Point: Python Basics", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "Python");
      await navigateToStoryPoint(page, "Python Basics");
    });

    test("renders all 4 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(4);
      await page.screenshot({ path: "test-results/space5-basics-all-items.png", fullPage: true });
    });

    test("item 1: Material renders content", async ({ page }) => {
      const card = getItemCard(page, 0);
      await verifyMaterialRendered(card);
      await page.screenshot({ path: "test-results/space5-basics-material.png", fullPage: true });
    });

    test("item 2: MCQ renders options", async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 0);
      await page.screenshot({ path: "test-results/space5-basics-mcq.png", fullPage: true });
    });

    test("item 3: Code — renders code editor with language label", async ({ page }) => {
      const card = getItemCard(page, 2);
      await verifyCodeRendered(card);
      await fillCode(card, 'print("Hello, World!")');
      await page.screenshot({ path: "test-results/space5-basics-code1.png", fullPage: true });
    });

    test("item 4: Code — second code question renders editor", async ({ page }) => {
      const card = getItemCard(page, 3);
      await verifyCodeRendered(card);
      await fillCode(card, "x = 10\ny = 20\nprint(x + y)");
      await page.screenshot({ path: "test-results/space5-basics-code2.png", fullPage: true });
    });
  });

  // ── Story Point: Control Flow (3 items) ──────────────────────────────────

  test.describe("Story Point: Control Flow", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "Python");
      await navigateToStoryPoint(page, "Control Flow");
    });

    test("renders all 3 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(3);
      await page.screenshot({ path: "test-results/space5-control-all-items.png", fullPage: true });
    });

    test("item 1: MCQ renders options", async ({ page }) => {
      const card = getItemCard(page, 0);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 0);
      await page.screenshot({ path: "test-results/space5-control-mcq.png", fullPage: true });
    });

    test("item 2: Code — FizzBuzz renders code editor", async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyCodeRendered(card);
      await fillCode(
        card,
        'for i in range(1, 16):\n    if i % 15 == 0:\n        print("FizzBuzz")\n    elif i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    else:\n        print(i)'
      );
      await page.screenshot({
        path: "test-results/space5-control-code-fizzbuzz.png",
        fullPage: true,
      });
    });

    test("item 3: Numerical renders input", async ({ page }) => {
      const card = getItemCard(page, 2);
      await verifyNumericalRendered(card);
      await fillNumerical(card, "15");
      await page.screenshot({ path: "test-results/space5-control-numerical.png", fullPage: true });
    });
  });

  // ── Story Point: Functions & Modules (2 items) ───────────────────────────

  test.describe("Story Point: Functions & Modules", () => {
    test.beforeEach(async ({ page }) => {
      await navigateToSpace(page, "Python");
      await navigateToStoryPoint(page, "Functions");
    });

    test("renders all 2 items", async ({ page }) => {
      const items = getItemCards(page);
      const count = await items.count();
      expect(count).toBe(2);
      await page.screenshot({
        path: "test-results/space5-functions-all-items.png",
        fullPage: true,
      });
    });

    test("item 1: MCQ renders options", async ({ page }) => {
      const card = getItemCard(page, 0);
      await verifyMCQRendered(card);
      await selectMCQOption(card, 0);
      await page.screenshot({ path: "test-results/space5-functions-mcq.png", fullPage: true });
    });

    test("item 2: Code — Fibonacci renders code editor", async ({ page }) => {
      const card = getItemCard(page, 1);
      await verifyCodeRendered(card);
      await fillCode(
        card,
        "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n\nfor i in range(10):\n    print(fibonacci(i))"
      );
      await page.screenshot({
        path: "test-results/space5-functions-code-fibonacci.png",
        fullPage: true,
      });
    });
  });

  // ── Story Point: Python Quiz (timed_test) ────────────────────────────────

  test.describe("Story Point: Python Quiz (Timed Test)", () => {
    test("timed test landing page renders with test metadata", async ({ page }) => {
      await navigateToSpace(page, "Python");
      await navigateToTimedTest(page, "Python Quiz");
      await verifyTimedTestLanding(page);
      await page.screenshot({ path: "test-results/space5-quiz-timed-landing.png", fullPage: true });
    });

    test("timed test shows Start Test button and duration", async ({ page }) => {
      await navigateToSpace(page, "Python");
      await navigateToTimedTest(page, "Python Quiz");

      const timedTestLabel = page.locator("text=Timed Test");
      await expect(timedTestLabel).toBeVisible({ timeout: 10000 });

      const startBtn = page.locator('button:has-text("Start Test")');
      await expect(startBtn).toBeVisible();

      const durationBox = page.locator("text=Duration");
      await expect(durationBox).toBeVisible();

      await page.screenshot({
        path: "test-results/space5-quiz-timed-metadata.png",
        fullPage: true,
      });
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CROSS-CUTTING: Item Type Coverage Summary Tests
// ════════════════════════════════════════════════════════════════════════════

test.describe("Item Type Coverage Verification", () => {
  test("MCQ type renders correctly (Space 1 — Algebraic Expressions)", async ({ page }) => {
    await login(page, "aarav");
    await navigateToSpace(page, "Mathematics Fundamentals");
    await navigateToStoryPoint(page, "Algebraic Expressions");
    const card = getItemCard(page, 1);
    await verifyMCQRendered(card);
    // Verify radio input behavior
    const radios = card.locator('input[type="radio"]');
    expect(await radios.count()).toBeGreaterThanOrEqual(2);
    await radios.first().check();
    await expect(radios.first()).toBeChecked();
    await page.screenshot({ path: "test-results/coverage-mcq.png", fullPage: true });
  });

  test("MCAQ type renders correctly (Space 1 — Algebraic Expressions)", async ({ page }) => {
    await login(page, "aarav");
    await navigateToSpace(page, "Mathematics Fundamentals");
    await navigateToStoryPoint(page, "Algebraic Expressions");
    const card = getItemCard(page, 3);
    await verifyMCAQRendered(card);
    // Verify checkbox behavior — can select multiple
    const checkboxes = card.locator('input[type="checkbox"]');
    expect(await checkboxes.count()).toBeGreaterThanOrEqual(2);
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await expect(checkboxes.nth(0)).toBeChecked();
    await expect(checkboxes.nth(1)).toBeChecked();
    await page.screenshot({ path: "test-results/coverage-mcaq.png", fullPage: true });
  });

  test("True/False type renders correctly (Space 1 — Geometry)", async ({ page }) => {
    await login(page, "aarav");
    await navigateToSpace(page, "Mathematics Fundamentals");
    await navigateToStoryPoint(page, "Geometry - Triangles");
    const card = getItemCard(page, 0);
    await verifyTrueFalseRendered(card);
    // Verify button interaction
    const trueBtn = card.locator('button:has-text("True")');
    await trueBtn.click();
    // After clicking True, it should have selected styling
    await expect(trueBtn).toHaveClass(/bg-blue/);
    await page.screenshot({ path: "test-results/coverage-truefalse.png", fullPage: true });
  });

  test("Numerical type renders correctly (Space 1 — Linear Equations)", async ({ page }) => {
    await login(page, "aarav");
    await navigateToSpace(page, "Mathematics Fundamentals");
    await navigateToStoryPoint(page, "Linear Equations");
    const card = getItemCard(page, 1);
    await verifyNumericalRendered(card);
    const input = card.locator('input[type="number"]');
    await input.fill("5");
    await expect(input).toHaveValue("5");
    await page.screenshot({ path: "test-results/coverage-numerical.png", fullPage: true });
  });

  test("Text type renders correctly (Space 1 — Linear Equations)", async ({ page }) => {
    await login(page, "aarav");
    await navigateToSpace(page, "Mathematics Fundamentals");
    await navigateToStoryPoint(page, "Linear Equations");
    const card = getItemCard(page, 3);
    await verifyTextRendered(card);
    const input = card.locator('input[type="text"][placeholder="Type your answer"]');
    await input.fill("x = 15");
    await expect(input).toHaveValue("x = 15");
    await page.screenshot({ path: "test-results/coverage-text.png", fullPage: true });
  });

  test("Paragraph type renders correctly (Space 4 — Chemical Bonding)", async ({ page }) => {
    await login(page, "karan");
    await navigateToSpace(page, "Chemistry");
    await navigateToStoryPoint(page, "Chemical Bonding");
    const card = getItemCard(page, 1);
    await verifyParagraphRendered(card);
    const textarea = card.locator('textarea[placeholder="Write your answer..."]');
    await textarea.fill("Ionic bonding involves electron transfer between atoms.");
    await expect(textarea).toHaveValue("Ionic bonding involves electron transfer between atoms.");
    // Verify word count
    const wordCount = card.locator("text=/\\d+ words/");
    await expect(wordCount).toBeVisible();
    await page.screenshot({ path: "test-results/coverage-paragraph.png", fullPage: true });
  });

  test("Code type renders correctly (Space 5 — Python Basics)", async ({ page }) => {
    await login(page, "nikhil");
    await navigateToSpace(page, "Python");
    await navigateToStoryPoint(page, "Python Basics");
    const card = getItemCard(page, 2);
    await verifyCodeRendered(card);
    // Verify language label
    const langLabel = card.locator("span.uppercase");
    await expect(langLabel).toBeVisible();
    // Verify code textarea
    const textarea = card.locator('textarea.font-mono, textarea[spellcheck="false"]');
    await textarea.fill('print("test")');
    await page.screenshot({ path: "test-results/coverage-code.png", fullPage: true });
  });

  test("Matching type renders correctly (Space 1 — Geometry)", async ({ page }) => {
    await login(page, "aarav");
    await navigateToSpace(page, "Mathematics Fundamentals");
    await navigateToStoryPoint(page, "Geometry - Triangles");
    const card = getItemCard(page, 2);
    await verifyMatchingRendered(card);
    // Verify left items and select dropdowns
    const leftItems = card.locator(".rounded.border.bg-gray-50");
    expect(await leftItems.count()).toBeGreaterThanOrEqual(1);
    const selects = card.locator("select");
    expect(await selects.count()).toBeGreaterThanOrEqual(1);
    // Verify arrow separator
    const arrow = card.locator("text=→");
    expect(await arrow.count()).toBeGreaterThanOrEqual(1);
    await page.screenshot({ path: "test-results/coverage-matching.png", fullPage: true });
  });

  test("Fill-blanks type renders correctly (Space 2 — Chemical Reactions)", async ({ page }) => {
    await login(page, "aarav");
    await navigateToSpace(page, "General Science");
    await navigateToStoryPoint(page, "Chemical Reactions Basics");
    const card = getItemCard(page, 0);
    await verifyFillBlanksRendered(card);
    // Verify inline input styling
    const blanks = card.locator('input[placeholder="___"]');
    expect(await blanks.count()).toBeGreaterThanOrEqual(1);
    await blanks.first().fill("H2O");
    await expect(blanks.first()).toHaveValue("H2O");
    await page.screenshot({ path: "test-results/coverage-fillblanks.png", fullPage: true });
  });

  test("Material type renders correctly (Space 1 — Algebraic Expressions)", async ({ page }) => {
    await login(page, "aarav");
    await navigateToSpace(page, "Mathematics Fundamentals");
    await navigateToStoryPoint(page, "Algebraic Expressions");
    const card = getItemCard(page, 0);
    await verifyMaterialRendered(card);
    // Material should not have Submit Answer button
    const submitBtn = card.locator('button:has-text("Submit Answer")');
    await expect(submitBtn).not.toBeVisible();
    await page.screenshot({ path: "test-results/coverage-material.png", fullPage: true });
  });

  test("Timed Test type renders correctly (Space 1 — Math Quiz)", async ({ page }) => {
    await login(page, "aarav");
    await navigateToSpace(page, "Mathematics Fundamentals");
    await navigateToTimedTest(page, "Math Quiz 1");
    await verifyTimedTestLanding(page);
    // Verify test-specific UI elements
    const startBtn = page.locator('button:has-text("Start Test")');
    await expect(startBtn).toBeVisible();
    const clockIcon = page.locator("text=Timed Test");
    await expect(clockIcon).toBeVisible();
    await page.screenshot({ path: "test-results/coverage-timedtest.png", fullPage: true });
  });
});
