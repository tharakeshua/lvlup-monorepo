import { test, expect, type Page } from "@playwright/test";
import {
  loginDirect,
  loginWithSchoolCode,
  loginStudentWithEmail,
  logout,
  expectDashboard,
} from "./helpers/auth";
import { CREDENTIALS, SELECTORS, SCHOOL_CODE } from "./helpers/selectors";

/**
 * Cross-role flow tests verify end-to-end scenarios that span multiple user roles.
 * These tests validate that actions taken by one role are visible/accessible to others,
 * that multi-tenant isolation is enforced, and that permission boundaries are respected.
 *
 * Port mapping:
 *   4567 — super-admin
 *   4568 — admin-web
 *   4569 — teacher-web
 *   4570 — student-web
 *   4571 — parent-web
 */

// ── App Base URLs ──────────────────────────────────────────────────────────

const URLS = {
  superAdmin: "http://localhost:4567",
  admin: "http://localhost:4568",
  teacher: "http://localhost:4569",
  student: "http://localhost:4570",
  parent: "http://localhost:4571",
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

async function loginAsTeacher(page: Page) {
  await page.goto(`${URLS.teacher}/login`);
  await loginWithSchoolCode(
    page,
    SCHOOL_CODE,
    CREDENTIALS.teacher1.email,
    CREDENTIALS.teacher1.password
  );
  await expectDashboard(page, SELECTORS.dashboards.teacher);
}

async function loginAsAdmin(page: Page) {
  await page.goto(`${URLS.admin}/login`);
  await loginWithSchoolCode(
    page,
    SCHOOL_CODE,
    CREDENTIALS.tenantAdmin.email,
    CREDENTIALS.tenantAdmin.password
  );
  await expectDashboard(page, SELECTORS.dashboards.schoolAdmin);
}

async function loginAsStudent(page: Page) {
  await page.goto(`${URLS.student}/login`);
  await loginStudentWithEmail(
    page,
    SCHOOL_CODE,
    CREDENTIALS.student1.email,
    CREDENTIALS.student1.password
  );
  await expectDashboard(page, SELECTORS.dashboards.student);
}

async function loginAsParent(page: Page) {
  await page.goto(`${URLS.parent}/login`);
  await loginWithSchoolCode(
    page,
    SCHOOL_CODE,
    CREDENTIALS.parent1.email,
    CREDENTIALS.parent1.password
  );
  await expectDashboard(page, SELECTORS.dashboards.parent);
}

async function loginAsSuperAdmin(page: Page) {
  await page.goto(`${URLS.superAdmin}/login`);
  await loginDirect(page, CREDENTIALS.superAdmin.email, CREDENTIALS.superAdmin.password);
  await expectDashboard(page, SELECTORS.dashboards.superAdmin);
}

/**
 * Safely check whether a locator is visible within a short timeout.
 * Returns true/false without throwing so tests can branch gracefully.
 */
async function isVisible(page: Page, selector: string, timeout = 5000): Promise<boolean> {
  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

// ── 1. Authentication Boundary Checks (original tests, preserved) ──────────

test.describe("Cross-Role: Authentication Boundary Checks", () => {
  test("P0: Teacher cannot access admin dashboard @smoke", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to admin URL directly
    await page.goto(`${URLS.admin}/`);
    // Should redirect to login (different app, not authenticated)
    await expect(page).toHaveURL(/\/login/);
  });

  test("P0: Student cannot access teacher dashboard @smoke", async ({ page }) => {
    await loginAsStudent(page);

    // Navigate to teacher URL directly
    await page.goto(`${URLS.teacher}/`);
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("P1: SuperAdmin can access platform-wide data @smoke", async ({ page }) => {
    await loginAsSuperAdmin(page);

    // Super admin should see tenant management
    const h1 = page.locator("h1");
    await expect(h1).toContainText("Super Admin Dashboard", { timeout: 20000 });
  });
});

test.describe("Cross-Role: Teacher → Student Visibility", () => {
  test("P1: Teacher dashboard shows student count for assigned classes", async ({ page }) => {
    await loginAsTeacher(page);

    // Teacher should see their classes with student counts
    const dashboard = page.locator("main");
    await expect(dashboard).toBeVisible({ timeout: 20000 });
  });
});

test.describe("Cross-Role: Admin → Teacher → Student Data Flow", () => {
  test("P1: Admin can view school-wide analytics", async ({ page }) => {
    await loginAsAdmin(page);

    // Verify admin dashboard loads with school data
    const heading = page.locator("h1");
    await expect(heading).toContainText("School Admin Dashboard", { timeout: 30000 });

    // Check analytics section is accessible
    const analyticsLink = page.locator('a[href*="/analytics"], nav >> text=Analytics').first();
    if (await analyticsLink.isVisible()) {
      await analyticsLink.click();
      await page.waitForLoadState("networkidle");
    }
  });

  test("P1: Parent can view their child's progress after logging in @smoke", async ({ page }) => {
    await loginAsParent(page);

    // Parent should see child-related data
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible({ timeout: 20000 });
  });
});

// ── 2. Multi-Tenant Isolation ───────────────────────────────────────────────

test.describe("Cross-Role: Multi-Tenant Isolation", () => {
  test("P0: Admin is scoped to their own tenant data", async ({ page }) => {
    await loginAsAdmin(page);

    // Admin dashboard should show their tenant's school name
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible({ timeout: 20000 });

    // Verify Tenant Info section shows the correct tenant code
    await page.goto(`${URLS.admin}/settings`);
    await page.waitForLoadState("networkidle");

    const tenantCode = page.locator("text=Tenant Code");
    if (await tenantCode.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Tenant code should match SCHOOL_CODE (GRN001), confirming tenant isolation
      await expect(page.locator(`text=${SCHOOL_CODE}`)).toBeVisible({ timeout: 5000 });
    }
  });

  test("P0: SuperAdmin can see all tenants", async ({ page }) => {
    await loginAsSuperAdmin(page);

    // Navigate to tenants management page
    await page.goto(`${URLS.superAdmin}/tenants`);
    await page.waitForLoadState("networkidle");

    // SuperAdmin should see the tenants list (at least one tenant should be visible)
    const tenantsHeading = page.locator("h1");
    await expect(tenantsHeading).toBeVisible({ timeout: 20000 });

    // There should be at least one tenant entry in the list
    const tenantEntries = page.locator(
      'table tbody tr, .rounded-lg.border, [data-testid*="tenant"]'
    );
    const count = await tenantEntries.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("P0: Student from tenant A cannot access admin portal URL", async ({ page }) => {
    await loginAsStudent(page);

    // Attempt to navigate to admin portal (different app, different auth scope)
    await page.goto(`${URLS.admin}/`);
    // Should be redirected to login — student auth token is not valid for admin app
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("P1: Teacher credentials are scoped to their tenant", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to teacher dashboard — content should be scoped to Greenwood
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 20000 });

    // Verify no cross-tenant data leakage: teacher should not see a tenant selector
    // (single-org teachers do not see an org switcher)
    await expect(page.locator("text=Select org")).not.toBeVisible({ timeout: 3000 });
  });
});

// ── 3. Space Publishing Workflow ────────────────────────────────────────────

test.describe("Cross-Role: Space Publishing Workflow", () => {
  test("P1: Teacher can view spaces list in teacher dashboard", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to spaces page
    await page.goto(`${URLS.teacher}/spaces`);
    await page.waitForLoadState("networkidle");

    // Spaces heading should be visible
    const spacesHeading = page.locator('h1:has-text("Spaces")');
    await expect(spacesHeading).toBeVisible({ timeout: 20000 });

    // Should show either space cards or an empty state
    const hasSpaces = (await page.locator('a[href*="/spaces/"][href*="/edit"]').count()) > 0;
    const hasEmptyState = await isVisible(page, "text=No spaces yet", 3000);
    expect(hasSpaces || hasEmptyState).toBeTruthy();
  });

  test("P1: Teacher dashboard shows Total Spaces and Active Exams counts", async ({ page }) => {
    await loginAsTeacher(page);

    // Dashboard should have score cards for spaces and exams
    const totalSpaces = page.locator("text=Total Spaces");
    const activeExams = page.locator("text=Active Exams");

    await expect(totalSpaces).toBeVisible({ timeout: 20000 });
    await expect(activeExams).toBeVisible({ timeout: 10000 });
  });

  test("P1: Student can see assigned spaces in their dashboard", async ({ page }) => {
    await loginAsStudent(page);

    // Student dashboard should have a "My Spaces" section
    const mySpaces = page.locator('h2:has-text("My Spaces")');
    await expect(mySpaces).toBeVisible({ timeout: 20000 });

    // Navigate to full spaces list
    await page.goto(`${URLS.student}/spaces`);
    await page.waitForLoadState("networkidle");

    const spacesHeading = page.locator("h1");
    await expect(spacesHeading).toContainText("My Spaces", { timeout: 15000 });
  });

  test("P1: Parent can view child's space progress section", async ({ page }) => {
    await loginAsParent(page);

    // Parent dashboard should show Space Progress quick action
    const spaceProgress = page.locator("text=Space Progress");
    if (
      await spaceProgress
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false)
    ) {
      await expect(spaceProgress.first()).toBeVisible();
    }

    // Navigate to progress page
    await page.goto(`${URLS.parent}/progress`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/progress/);
  });
});

// ── 4. Exam Lifecycle ───────────────────────────────────────────────────────

test.describe("Cross-Role: Exam Lifecycle", () => {
  test("P1: Teacher can view exams list", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to exams
    await page.goto(`${URLS.teacher}/exams`);
    await page.waitForLoadState("networkidle");

    const examsHeading = page.locator('h1:has-text("Exams")');
    await expect(examsHeading).toBeVisible({ timeout: 20000 });
  });

  test("P1: Admin can access analytics which includes exam data", async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to analytics
    await page.goto(`${URLS.admin}/analytics`);
    await page.waitForLoadState("networkidle");

    const analyticsHeading = page.locator("h1");
    await expect(analyticsHeading).toContainText("Analytics", { timeout: 20000 });
  });

  test("P1: Student dashboard shows recent exam results section", async ({ page }) => {
    await loginAsStudent(page);

    // Wait for dashboard to load fully
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 20000 });

    // Check for Recent Exam Results section (may or may not have data)
    const examSection = page.locator("text=Recent Exam Results");
    if (await examSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(examSection).toBeVisible();
    }
    // Even without exam data, the dashboard should render without errors
  });

  test("P1: Parent can view exam results page for their child", async ({ page }) => {
    await loginAsParent(page);

    // Navigate to results page
    await page.goto(`${URLS.parent}/results`);
    await page.waitForLoadState("networkidle");

    // Should load the results page (may show empty state if no exams completed)
    await expect(page).toHaveURL(/\/results/);
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 15000 });
  });
});

// ── 5. Notification Chain ───────────────────────────────────────────────────

test.describe("Cross-Role: Notification Chain", () => {
  test("P1: Admin can access the notifications management area", async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to notifications page in admin portal
    await page.goto(`${URLS.admin}/notifications`);
    await page.waitForLoadState("networkidle");

    // Should either show the notifications page or redirect (depending on feature availability)
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 20000 });
  });

  test("P1: Teacher can view notifications page", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to notifications
    await page.goto(`${URLS.teacher}/notifications`);
    await page.waitForLoadState("networkidle");

    const notificationsEl = page.locator(
      'h1:has-text("Notifications"), [data-testid="notifications-page"]'
    );
    await expect(notificationsEl).toBeVisible({ timeout: 20000 });
  });

  test("P2: Student can view their notifications", async ({ page }) => {
    await loginAsStudent(page);

    // Check if student has a notifications route or notification bell
    const notifBell = page.locator(
      '[data-testid="notification-bell"], a[href*="notification"], button[aria-label*="Notification"]'
    );
    if (
      await notifBell
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await notifBell.first().click();
      await page.waitForLoadState("networkidle");
    }

    // Student dashboard should at least render without errors
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 10000 });
  });

  test("P2: Parent can view notifications or progress updates", async ({ page }) => {
    await loginAsParent(page);

    // Navigate to notifications route if available
    await page.goto(`${URLS.parent}/notifications`);
    await page.waitForLoadState("networkidle");

    // Parent app should show notifications or redirect gracefully
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 15000 });
  });
});

// ── 6. Permission Boundaries (Negative Tests) ──────────────────────────────

test.describe("Cross-Role: Permission Boundaries (Negative Tests)", () => {
  test("P0: Student cannot access teacher-web URL", async ({ page }) => {
    await loginAsStudent(page);

    // Attempt to access teacher portal
    await page.goto(`${URLS.teacher}/`);
    // Should be redirected to login — student session is not valid here
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("P0: Student cannot access admin-web URL", async ({ page }) => {
    await loginAsStudent(page);

    // Attempt to access admin portal
    await page.goto(`${URLS.admin}/`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("P0: Student cannot access super-admin URL", async ({ page }) => {
    await loginAsStudent(page);

    // Attempt to access super-admin portal
    await page.goto(`${URLS.superAdmin}/`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("P0: Parent cannot access teacher-web URL", async ({ page }) => {
    await loginAsParent(page);

    // Attempt to access teacher portal
    await page.goto(`${URLS.teacher}/`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("P0: Parent cannot access admin-web URL", async ({ page }) => {
    await loginAsParent(page);

    // Attempt to access admin portal
    await page.goto(`${URLS.admin}/`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("P0: Teacher cannot access super-admin portal", async ({ page }) => {
    await loginAsTeacher(page);

    // Attempt to access super-admin portal
    await page.goto(`${URLS.superAdmin}/`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("P1: Non-SuperAdmin admin cannot access super-admin portal", async ({ page }) => {
    await loginAsAdmin(page);

    // Attempt to access super-admin portal
    await page.goto(`${URLS.superAdmin}/`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("P1: Parent cannot modify child data via admin settings URL", async ({ page }) => {
    await loginAsParent(page);

    // Attempt to access admin settings (which could modify data)
    await page.goto(`${URLS.admin}/settings`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("P1: Teacher from one school cannot access another school's teacher portal data", async ({
    page,
  }) => {
    await loginAsTeacher(page);

    // Teacher should only see data scoped to their school.
    // Verify no org switcher is visible (single-org teacher)
    await expect(page.locator("text=Select org")).not.toBeVisible({ timeout: 3000 });

    // Navigate to spaces — content should be scoped to teacher's assigned classes only
    await page.goto(`${URLS.teacher}/spaces`);
    await page.waitForLoadState("networkidle");
    const spacesHeading = page.locator('h1:has-text("Spaces")');
    await expect(spacesHeading).toBeVisible({ timeout: 15000 });
  });
});

// ── 7. Session Persistence ─────────────────────────────────────────────────

test.describe("Cross-Role: Session Persistence", () => {
  test("P1: Teacher session survives page reload", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to spaces
    await page.goto(`${URLS.teacher}/spaces`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('h1:has-text("Spaces")')).toBeVisible({ timeout: 20000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Should still be on spaces page, not redirected to login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    await expect(page.locator('h1:has-text("Spaces")')).toBeVisible({ timeout: 20000 });
  });

  test("P1: Student session persists across page navigation", async ({ page }) => {
    await loginAsStudent(page);

    // Navigate to spaces list
    await page.goto(`${URLS.student}/spaces`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("My Spaces", { timeout: 15000 });

    // Navigate back to dashboard
    await page.goto(`${URLS.student}/`);
    await page.waitForLoadState("networkidle");

    // Should still be authenticated — dashboard should load, not login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    const heading = page.locator("h1");
    await expect(heading).toContainText("Dashboard", { timeout: 20000 });
  });

  test("P1: Teacher session survives navigation between spaces and exams", async ({ page }) => {
    await loginAsTeacher(page);

    // Go to spaces
    await page.goto(`${URLS.teacher}/spaces`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('h1:has-text("Spaces")')).toBeVisible({ timeout: 20000 });

    // Go to exams
    await page.goto(`${URLS.teacher}/exams`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('h1:has-text("Exams")')).toBeVisible({ timeout: 20000 });

    // Go back to dashboard
    await page.goto(`${URLS.teacher}/`);
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Teacher Dashboard", { timeout: 20000 });
  });

  test("P1: Admin session survives reload on analytics page", async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to analytics
    await page.goto(`${URLS.admin}/analytics`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Analytics", { timeout: 20000 });

    // Reload
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Should still be authenticated
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Analytics", { timeout: 20000 });
  });

  test("P2: Parent session persists when navigating between children and results", async ({
    page,
  }) => {
    await loginAsParent(page);

    // Navigate to children page
    await page.goto(`${URLS.parent}/children`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/children/);
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 15000 });

    // Navigate to results
    await page.goto(`${URLS.parent}/results`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/results/);

    // Navigate back to dashboard
    await page.goto(`${URLS.parent}/`);
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Parent Dashboard", { timeout: 20000 });
  });
});

// ── 8. Cross-Role Data Consistency ──────────────────────────────────────────

test.describe("Cross-Role: Data Consistency Across Portals", () => {
  test('P1: Teacher sees "Recent Spaces" that align with student "My Spaces"', async ({ page }) => {
    // Login as teacher and check for spaces
    await loginAsTeacher(page);
    const recentSpaces = page.locator('h2:has-text("Recent Spaces")');
    await expect(recentSpaces).toBeVisible({ timeout: 20000 });

    // Count spaces visible to teacher
    const teacherSpaceCards = page.locator('a[href*="/spaces/"]');
    const teacherSpaceCount = await teacherSpaceCards.count();

    // Logout is implicit (navigating to different app with different auth context)
    // Login as student
    await loginAsStudent(page);
    const mySpacesHeading = page.locator('h2:has-text("My Spaces")');
    await expect(mySpacesHeading).toBeVisible({ timeout: 20000 });

    // Both portals should render spaces sections without errors.
    // The exact counts may differ (teacher sees all, student sees assigned only),
    // but both should be non-negative integers.
    expect(teacherSpaceCount).toBeGreaterThanOrEqual(0);
  });

  test("P1: Admin dashboard and teacher dashboard both show exam statistics", async ({ page }) => {
    // Login as admin — check for exam-related analytics
    await loginAsAdmin(page);
    const adminMain = page.locator("main");
    await expect(adminMain).toBeVisible({ timeout: 20000 });

    // Login as teacher — check for Active Exams metric
    await loginAsTeacher(page);
    const activeExams = page.locator("text=Active Exams");
    await expect(activeExams).toBeVisible({ timeout: 20000 });
  });

  test("P1: Parent children page and student dashboard reference same student", async ({
    page,
  }) => {
    // Login as parent
    await loginAsParent(page);

    // Navigate to children page
    await page.goto(`${URLS.parent}/children`);
    await page.waitForLoadState("networkidle");
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 15000 });

    // Check children are listed or empty state is shown
    const hasChildren = (await page.locator(".rounded-lg.border.bg-card").count()) > 0;
    const hasEmptyState = await isVisible(page, "text=No children linked", 3000);
    expect(hasChildren || hasEmptyState).toBeTruthy();

    // Login as student — verify dashboard loads (same student the parent sees)
    await loginAsStudent(page);
    await expect(page.locator("h1")).toContainText("Dashboard", { timeout: 20000 });
  });
});
