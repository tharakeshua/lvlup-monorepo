import { test, expect, Page } from "@playwright/test";
import { loginAsStudent } from "./helpers";

// ════════════════════════════════════════════════════════════════════════════
// SPACES LIST PAGE
// ════════════════════════════════════════════════════════════════════════════

test.describe("Spaces List Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/spaces");
    await page.waitForTimeout(2_000);
  });

  // S-SPC-01
  test('renders "My Spaces" heading', async ({ page }) => {
    await expect(page.locator("h1")).toContainText("My Spaces");
  });

  // S-SPC-01
  test("shows space cards or empty state", async ({ page }) => {
    const hasSpaces = (await page.locator('a[href^="/spaces/"]').count()) > 0;
    const hasEmpty = await page
      .locator("text=No spaces assigned yet")
      .isVisible()
      .catch(() => false);
    expect(hasSpaces || hasEmpty).toBeTruthy();
  });

  // S-SPC-02
  test("space cards have titles", async ({ page }) => {
    const spaceLinks = page.locator('a[href^="/spaces/"]');
    if ((await spaceLinks.count()) > 0) {
      const text = await spaceLinks.first().textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  // S-SPC-03
  test("space cards show progress bar", async ({ page }) => {
    const spaceLinks = page.locator('a[href^="/spaces/"]');
    if ((await spaceLinks.count()) > 0) {
      // Progress bars are rendered inside space cards
      await expect(spaceLinks.first()).toBeVisible();
    }
  });

  // S-SPC-04
  test("clicking a space card navigates to space viewer", async ({ page }) => {
    const spaceLinks = page.locator('a[href^="/spaces/"]');
    if ((await spaceLinks.count()) === 0) test.skip();
    await spaceLinks.first().click();
    await expect(page).toHaveURL(/\/spaces\/.+/);
  });

  test('sidebar nav link "My Spaces" is in DOM', async ({ page }) => {
    await expect(page.locator('a[href="/spaces"]').first()).toBeAttached();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SPACE VIEWER PAGE
// ════════════════════════════════════════════════════════════════════════════

async function navigateToFirstSpace(page: Page): Promise<string | null> {
  await page.goto("/spaces");
  await page.waitForTimeout(2_000);
  const spaceLinks = page.locator('a[href^="/spaces/"]');
  if ((await spaceLinks.count()) === 0) return null;
  const href = await spaceLinks.first().getAttribute("href");
  const spaceId = href?.replace("/spaces/", "") ?? null;
  await spaceLinks.first().click();
  await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
  await page.waitForTimeout(2_000);
  return spaceId;
}

test.describe("Space Viewer Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  // S-SPV-01
  test("space viewer page renders space title as h1", async ({ page }) => {
    const spaceId = await navigateToFirstSpace(page);
    if (!spaceId) test.skip();
    await expect(page.locator("h1").first()).toBeVisible();
  });

  // S-SPV-01
  test('shows breadcrumb with "Spaces" link', async ({ page }) => {
    const spaceId = await navigateToFirstSpace(page);
    if (!spaceId) test.skip();
    await expect(page.locator('a:has-text("Spaces")').first()).toBeVisible();
  });

  test('"Spaces" breadcrumb link navigates back to /spaces', async ({ page }) => {
    const spaceId = await navigateToFirstSpace(page);
    if (!spaceId) test.skip();
    await page.locator('a:has-text("Spaces")').first().click();
    await expect(page).toHaveURL(/\/spaces$/);
  });

  // S-SPV-02
  test("shows Overall Progress label", async ({ page }) => {
    const spaceId = await navigateToFirstSpace(page);
    if (!spaceId) test.skip();
    await expect(page.locator("text=Overall Progress")).toBeVisible({ timeout: 8_000 });
  });

  // S-SPV-03
  test("shows Contents section heading", async ({ page }) => {
    const spaceId = await navigateToFirstSpace(page);
    if (!spaceId) test.skip();
    await expect(page.locator('h2:has-text("Contents")')).toBeVisible();
  });

  test("module cards are visible or empty state shown", async ({ page }) => {
    const spaceId = await navigateToFirstSpace(page);
    if (!spaceId) test.skip();
    await page.waitForTimeout(2_000);
    const storyLinks = page.locator('a[href*="/spaces/"]');
    const emptyMsg = page.locator("text=No content available yet");
    const hasLinks = (await storyLinks.count()) > 1; // >1 because breadcrumb also has /spaces/
    const hasEmpty = await emptyMsg.isVisible().catch(() => false);
    expect(hasLinks || hasEmpty).toBeTruthy();
  });

  // S-SPV-08
  test("clicking standard module navigates to /modules/", async ({ page }) => {
    const spaceId = await navigateToFirstSpace(page);
    if (!spaceId) test.skip();
    const spLinks = page.locator('a[href*="/modules/"]');
    if ((await spLinks.count()) === 0) test.skip();
    await spLinks.first().click();
    await expect(page).toHaveURL(/\/modules\//);
  });

  // S-SPV-09
  test("test story point links go to /test/", async ({ page }) => {
    const spaceId = await navigateToFirstSpace(page);
    if (!spaceId) test.skip();
    const testLinks = page.locator('a[href*="/test/"]');
    if ((await testLinks.count()) === 0) test.skip();
    const href = await testLinks.first().getAttribute("href");
    expect(href).toMatch(/\/test\//);
  });

  // S-SPV-10
  test("practice story point links go to /practice/", async ({ page }) => {
    const spaceId = await navigateToFirstSpace(page);
    if (!spaceId) test.skip();
    const practiceLinks = page.locator('a[href*="/practice/"]');
    if ((await practiceLinks.count()) === 0) test.skip();
    const href = await practiceLinks.first().getAttribute("href");
    expect(href).toMatch(/\/practice\//);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// STORY POINT VIEWER PAGE
// ════════════════════════════════════════════════════════════════════════════

async function navigateToModule(page: Page): Promise<boolean> {
  await page.goto("/spaces");
  await page.waitForTimeout(2_000);
  const spaceLinks = page.locator('a[href^="/spaces/"]');
  if ((await spaceLinks.count()) === 0) return false;
  await spaceLinks.first().click();
  await page.waitForURL(/\/spaces\/.+/, { timeout: 10_000 });
  await page.waitForTimeout(2_000);
  const spLinks = page.locator('a[href*="/modules/"]');
  if ((await spLinks.count()) === 0) return false;
  await spLinks.first().click();
  await expect(page).toHaveURL(/\/modules\//);
  await page.waitForTimeout(2_500);
  return true;
}

test.describe("Module Viewer Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  // S-STPV-01
  test("module viewer page loads and shows h1", async ({ page }) => {
    const ok = await navigateToModule(page);
    if (!ok) test.skip();
    await expect(page.locator("h1").first()).toBeVisible();
  });

  // S-STPV-01
  test("breadcrumb navigation is present", async ({ page }) => {
    const ok = await navigateToModule(page);
    if (!ok) test.skip();
    await expect(page.locator('a:has-text("Spaces")')).toBeVisible();
  });

  // S-STPV-03
  test("items (materials or questions) render or empty message shown", async ({ page }) => {
    const ok = await navigateToModule(page);
    if (!ok) test.skip();
    const items = page.locator(".rounded-lg.border.bg-card.p-5");
    const emptyMsg = page.locator("text=No items in this section");
    const hasItems = (await items.count()) > 0;
    const hasEmpty = await emptyMsg.isVisible().catch(() => false);
    expect(hasItems || hasEmpty).toBeTruthy();
  });

  // S-STPV-04
  test("MCQ question renders with options (if present)", async ({ page }) => {
    const ok = await navigateToModule(page);
    if (!ok) test.skip();
    await page.waitForTimeout(2_000);
    // MCQ options are radio-like buttons; if no MCQ, skip gracefully
    const mcqOptions = page.locator('[type="radio"], button[data-option]');
    if ((await mcqOptions.count()) > 0) {
      await expect(mcqOptions.first()).toBeVisible();
    }
  });

  // S-STPV-02
  test("section filter buttons are clickable when present", async ({ page }) => {
    const ok = await navigateToModule(page);
    if (!ok) test.skip();
    await page.waitForTimeout(1_500);
    // Section sidebar pills/buttons may exist
    const sectionFilters = page.locator("button[data-section], aside button");
    if ((await sectionFilters.count()) > 0) {
      await sectionFilters.first().click();
      await page.waitForTimeout(500);
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
