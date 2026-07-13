/**
 * Auto-generated E2E tests from seed results: subhang.json
 * Tests 5 apps across ports 4567-4571 with seeded data verification.
 *
 * Dataset: Subhang Academy (SUB001)
 * - 1 tenant, 1 class, 3 auth users, 1 space, 4 story points, 32 items
 */
import { test, expect, type Page } from "@playwright/test";
import { loginDirect, loginWithSchoolCode, expectDashboard } from "./helpers/auth";
import { CREDENTIALS, SELECTORS } from "./helpers/selectors";
import seedResults from "../../scripts/seed-results/subhang.json";
const primaryClass = seedResults.classes[0];
const primarySpace =
  seedResults.spaces.find((space) => space.classId === primaryClass.id) ?? seedResults.spaces[0];
// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED = {
  schoolCode: "SUB001",
  schoolName: seedResults.tenant.name, // "Subhang Academy"
  className: primaryClass.name, // "System Design Class"
  spaceTitle: primarySpace.title, // "System Design"
  storyPoints: primarySpace.storyPoints, // 4 story points
  entityCounts: seedResults.entityCounts,
  creds: seedResults.credentials,
};

// ── App URLs ──────────────────────────────────────────────────────────────────
const APP = {
  superAdmin: "http://localhost:4567",
  admin: "http://localhost:4568",
  teacher: "http://localhost:4569",
  student: "http://localhost:4570",
  parent: "http://localhost:4571",
} as const;

// ── Login helpers ─────────────────────────────────────────────────────────────

async function loginSuperAdmin(page: Page) {
  await page.goto(`${APP.superAdmin}/login`);
  await loginDirect(page, CREDENTIALS.superAdmin.email, CREDENTIALS.superAdmin.password);
  // Login page itself has "Super Admin Control Center" h1 — wait for URL to leave /login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 40000 });
  await page.waitForLoadState("domcontentloaded");
}

/** Admin login — new tenants land on Setup Wizard */
async function loginSeedAdmin(page: Page) {
  await page.goto(`${APP.admin}/login`);
  await loginWithSchoolCode(
    page,
    SEED.schoolCode,
    SEED.creds.admin.email,
    SEED.creds.admin.password
  );
  await expect(page).not.toHaveURL(/\/login/, { timeout: 40000 });
  await page.waitForLoadState("domcontentloaded");
}

async function loginSeedTeacher(page: Page) {
  await page.goto(`${APP.teacher}/login`);
  await loginWithSchoolCode(
    page,
    SEED.schoolCode,
    SEED.creds.admin.email,
    SEED.creds.admin.password
  );
  await expectDashboard(page, SELECTORS.dashboards.teacher);
}

/** Navigate to space detail Content tab in teacher app */
async function navigateToSpaceContent(page: Page) {
  await page.goto(`${APP.teacher}/spaces`);
  await page.waitForLoadState("domcontentloaded");
  await page
    .locator(`h3:has-text("${SEED.spaceTitle}"), a:has-text("${SEED.spaceTitle}")`)
    .first()
    .click();
  await page.waitForLoadState("domcontentloaded");
  // Space detail opens on Settings tab — switch to Content tab for story points
  const contentTab = page
    .locator('button:has-text("Content"), [role="tab"]:has-text("Content")')
    .first();
  await contentTab.click({ timeout: 10000 });
  await page.waitForTimeout(2000);
}

/**
 * Student login — handles Roll Number / Email tab toggle.
 * Uses text selector for the Email tab (more reliable than getByRole).
 */
async function loginSeedStudent(page: Page) {
  await page.goto(`${APP.student}/login`);

  // Step 1: School code
  await page.fill("#schoolCode", SEED.schoolCode);
  await page.click('button[type="submit"]:has-text("Continue")');

  // Wait for credentials step
  await page.waitForSelector("#credential", { timeout: 10000 });

  // Click "Email" tab
  const emailTab = page.locator('button:has-text("Email"), [role="tab"]:has-text("Email")').first();
  await emailTab.click({ timeout: 10000 });

  // Enter email and password
  await page.fill("#credential", SEED.creds.student.email);
  await page.fill("#password", SEED.creds.student.password);
  await page.click('button[type="submit"]:has-text("Sign In")');

  await expectDashboard(page, SELECTORS.dashboards.student);
}

async function loginSeedParent(page: Page) {
  await page.goto(`${APP.parent}/login`);
  await loginWithSchoolCode(
    page,
    SEED.schoolCode,
    SEED.creds.parent.email,
    SEED.creds.parent.password
  );
  await expectDashboard(page, SELECTORS.dashboards.parent);
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. SUPER ADMIN (port 4567) — 3 tests
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Seed: Super Admin @subhang", () => {
  test("SA-1: super admin can log in", async ({ page }) => {
    await loginSuperAdmin(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("SA-2: tenants page lists Subhang Academy", async ({ page }) => {
    await loginSuperAdmin(page);
    await page.goto(`${APP.superAdmin}/tenants`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(`text=${SEED.schoolName}`)).toBeVisible({ timeout: 15000 });
  });

  test("SA-3: tenant code SUB001 is visible on tenants page", async ({ page }) => {
    await loginSuperAdmin(page);
    await page.goto(`${APP.superAdmin}/tenants`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(`text=${SEED.schoolCode}`)).toBeVisible({ timeout: 15000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. ADMIN WEB (port 4568) — 8 tests
// New tenants land on the Setup Wizard which intercepts all routes.
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Seed: Admin Web @subhang", () => {
  test("AW-1: admin login with school code SUB001", async ({ page }) => {
    await loginSeedAdmin(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("AW-2: setup wizard shows Welcome heading after login", async ({ page }) => {
    await loginSeedAdmin(page);
    await expect(page.locator('h1:has-text("Welcome to Auto-LevelUp")')).toBeVisible({
      timeout: 10000,
    });
  });

  test("AW-3: setup wizard has School Info step with school name pre-filled", async ({ page }) => {
    await loginSeedAdmin(page);
    await expect(page.locator("text=School Information")).toBeVisible({ timeout: 10000 });
    // School name should be pre-filled in the first input
    const schoolNameInput = page.locator("input").first();
    const inputValue = await schoolNameInput.inputValue();
    expect(inputValue).toContain(SEED.schoolName);
  });

  test("AW-4: setup wizard shows stepper with Academic Session and First Class", async ({
    page,
  }) => {
    await loginSeedAdmin(page);
    // Stepper buttons have class="hidden sm:inline" — use specific locator to avoid sidebar conflicts
    await expect(
      page
        .locator('button:has-text("Academic Session"), span.hidden:has-text("Academic Session")')
        .first()
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=First Class").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=All Set!").first()).toBeVisible({ timeout: 5000 });
  });

  test("AW-5: sidebar contains Dashboard link", async ({ page }) => {
    await loginSeedAdmin(page);
    // Sidebar items may be collapsed/hidden but should be attached to DOM
    const dashLink = page.locator('a[href="/"], a[href="/dashboard"]').first();
    await expect(dashLink).toBeAttached({ timeout: 15000 });
  });

  test("AW-6: setup wizard has Continue button", async ({ page }) => {
    await loginSeedAdmin(page);
    await expect(page.locator('button:has-text("Continue")')).toBeVisible({ timeout: 10000 });
  });

  test("AW-7: setup wizard shows contact email pre-filled", async ({ page }) => {
    await loginSeedAdmin(page);
    await expect(page.locator("text=Contact Email")).toBeVisible({ timeout: 10000 });
    // Contact email input should contain admin email
    const inputs = page.locator("input");
    const emailInput = inputs.nth(1);
    const emailValue = await emailInput.inputValue();
    expect(emailValue).toContain("subhang");
  });

  test("AW-8: breadcrumb shows Setup Wizard path", async ({ page }) => {
    await loginSeedAdmin(page);
    await expect(page.locator("text=Setup Wizard")).toBeVisible({ timeout: 10000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. TEACHER WEB (port 4569) — 7 tests
// Space detail requires clicking the "Content" tab to see story points.
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Seed: Teacher Web @subhang", () => {
  test("TW-1: teacher login with school code SUB001", async ({ page }) => {
    await loginSeedTeacher(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("TW-2: dashboard shows Teacher Dashboard heading", async ({ page }) => {
    await loginSeedTeacher(page);
    await expect(page.locator("h1")).toContainText("Teacher Dashboard");
  });

  test("TW-3: spaces page shows System Design space", async ({ page }) => {
    await loginSeedTeacher(page);
    await page.goto(`${APP.teacher}/spaces`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(`h3:has-text("${SEED.spaceTitle}")`).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("TW-4: space detail Content tab shows story points", async ({ page }) => {
    await loginSeedTeacher(page);
    await navigateToSpaceContent(page);
    const firstSP = SEED.storyPoints[0];
    await expect(page.locator(`text=${firstSP.title}`)).toBeVisible({ timeout: 15000 });
  });

  test("TW-5: Fundamentals of Scalability story point in Content tab", async ({ page }) => {
    await loginSeedTeacher(page);
    await navigateToSpaceContent(page);
    await expect(page.locator("text=Fundamentals of Scalability")).toBeVisible({ timeout: 15000 });
  });

  test("TW-6: Database Design & Patterns story point in Content tab", async ({ page }) => {
    await loginSeedTeacher(page);
    await navigateToSpaceContent(page);
    await expect(page.locator("text=Database Design & Patterns")).toBeVisible({ timeout: 15000 });
  });

  test("TW-7: quiz and timed test story points in Content tab", async ({ page }) => {
    await loginSeedTeacher(page);
    await navigateToSpaceContent(page);
    await expect(page.locator("text=Caching & Load Balancing Quiz")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator("text=System Design Assessment")).toBeVisible({ timeout: 15000 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. STUDENT WEB (port 4570) — 7 tests
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Seed: Student Web @subhang", () => {
  test("SW-1: student login with email and school code", async ({ page }) => {
    await loginSeedStudent(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("SW-2: dashboard shows Dashboard heading", async ({ page }) => {
    await loginSeedStudent(page);
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("SW-3: dashboard shows System Design space card", async ({ page }) => {
    await loginSeedStudent(page);
    await expect(page.locator(`h3:has-text("${SEED.spaceTitle}")`).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("SW-4: space detail shows story points", async ({ page }) => {
    await loginSeedStudent(page);
    await page.locator(`h3:has-text("${SEED.spaceTitle}")`).first().click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await expect(page.locator(`text=${SEED.storyPoints[0].title}`)).toBeVisible({ timeout: 15000 });
  });

  test("SW-5: standard story point (Fundamentals of Scalability) is accessible", async ({
    page,
  }) => {
    await loginSeedStudent(page);
    await page.locator(`h3:has-text("${SEED.spaceTitle}")`).first().click();
    await page.waitForTimeout(3000);
    await expect(page.locator("text=Fundamentals of Scalability")).toBeVisible({ timeout: 15000 });
  });

  test("SW-6: practice story point (Database Design & Patterns) is accessible", async ({
    page,
  }) => {
    await loginSeedStudent(page);
    await page.locator(`h3:has-text("${SEED.spaceTitle}")`).first().click();
    await page.waitForTimeout(3000);
    await expect(page.locator("text=Database Design & Patterns")).toBeVisible({ timeout: 15000 });
  });

  test("SW-7: quiz story point (Caching & Load Balancing Quiz) is visible", async ({ page }) => {
    await loginSeedStudent(page);
    await page.locator(`h3:has-text("${SEED.spaceTitle}")`).first().click();
    await page.waitForTimeout(3000);
    await expect(page.locator("text=Caching & Load Balancing Quiz")).toBeVisible({
      timeout: 15000,
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. PARENT WEB (port 4571) — 5 tests
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Seed: Parent Web @subhang", () => {
  test("PW-1: parent login with school code SUB001", async ({ page }) => {
    await loginSeedParent(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("PW-2: dashboard shows Parent Dashboard heading", async ({ page }) => {
    await loginSeedParent(page);
    await expect(page.locator("h1")).toContainText("Parent Dashboard");
  });

  test("PW-3: main content area renders without errors", async ({ page }) => {
    await loginSeedParent(page);
    // Parent web has nested <main> elements — use .first() to avoid strict mode
    await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("PW-4: notifications page loads", async ({ page }) => {
    await loginSeedParent(page);
    await page.goto(`${APP.parent}/notifications`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("Notifications", { timeout: 15000 });
  });

  test("PW-5: settings page loads", async ({ page }) => {
    await loginSeedParent(page);
    await page.goto(`${APP.parent}/settings`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. CROSS-APP CONSISTENCY (multi-port) — 5 tests
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Seed: Cross-App Consistency @subhang", () => {
  test("XA-1: admin and student can both authenticate with SUB001", async ({ page }) => {
    // Admin login — lands on wizard
    await page.goto(`${APP.admin}/login`);
    await loginWithSchoolCode(
      page,
      SEED.schoolCode,
      SEED.creds.admin.email,
      SEED.creds.admin.password
    );
    await expect(page).not.toHaveURL(/\/login/, { timeout: 40000 });

    await page.context().clearCookies();

    // Student login
    await loginSeedStudent(page);
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("XA-2: System Design space visible in teacher app spaces page", async ({ page }) => {
    await loginSeedTeacher(page);
    await page.goto(`${APP.teacher}/spaces`);
    await expect(page.locator(`h3:has-text("${SEED.spaceTitle}")`).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("XA-3: teacher and parent use same school code SUB001", async ({ page }) => {
    await loginSeedTeacher(page);
    await expect(page.locator("h1")).toContainText("Teacher Dashboard");

    await page.context().clearCookies();

    await loginSeedParent(page);
    await expect(page.locator("h1")).toContainText("Parent Dashboard");
  });

  test("XA-4: student and teacher see same space title", async ({ page }) => {
    // Student sees the space
    await loginSeedStudent(page);
    await expect(page.locator(`h3:has-text("${SEED.spaceTitle}")`).first()).toBeVisible({
      timeout: 15000,
    });

    await page.context().clearCookies();

    // Teacher sees the space
    await loginSeedTeacher(page);
    await page.goto(`${APP.teacher}/spaces`);
    await expect(page.locator(`h3:has-text("${SEED.spaceTitle}")`).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("XA-5: student sees story points that match seed data", async ({ page }) => {
    await loginSeedStudent(page);
    await page.locator(`h3:has-text("${SEED.spaceTitle}")`).first().click();
    await page.waitForTimeout(3000);

    // Verify all 4 story points from seed data are present
    for (const sp of SEED.storyPoints) {
      await expect(page.locator(`text=${sp.title}`)).toBeVisible({ timeout: 15000 });
    }
  });
});
